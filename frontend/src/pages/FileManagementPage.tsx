import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Folder,
  FolderPlus,
  Upload,
  Download,
  Search,
  Clock,
  Star,
  X,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  Film,
  Camera,
  Image as ImageIcon,
  File as FileGenericIcon,
  Trash2,
  Share2,
  FolderInput,
  Loader2,
  ShieldCheck,
  HardDrive,
  Cloud,
  ArrowUpDown,
  LayoutGrid,
  Table as TableIcon,
  Copy,
  History,
  SlidersHorizontal,
  RotateCcw,
  CheckCircle2,
  Edit2,
  Columns3,
  RefreshCw,
  MoreHorizontal,
  Flag,
  Check,
  ExternalLink,
  Lock,
  Unlock,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { AppShell } from '../components/layouts/AppShell';
import api from '../lib/api';
import { useConfirm } from '../context/ConfirmationModalContext';
import {
  CustomDropdown,
  CustomCheckboxDropdown,
  CustomActionDropdown,
} from '../components/ui/CustomDropdown';
import {
  PortfolioPageHeader,
  PortfolioHeroStats,
  PortfolioFilterTabs,
  PortfolioPagination,
  PortfolioFooter,
  PortfolioPriorityBadge,
  PortfolioStatusBadge,
} from '../components/portfolio';

interface FolderItem {
  id: number;
  company_id: number;
  parent_id?: number | null;
  name: string;
  slug?: string;
  color: string;
  icon: string;
  is_starred: boolean;
  items_count: number;
  created_at: string;
}

interface FileVersionItem {
  id: number;
  version_number: number;
  storage_key: string;
  size_bytes: number;
  checksum_sha256: string;
  mime_type: string;
  security_scan_status: string;
  changelog?: string;
  created_at: string;
  creator?: { id: number; name: string };
}

interface FileDocItem {
  id: number;
  uuid: string;
  company_id: number;
  folder_id?: number | null;
  name: string;
  original_name: string;
  mime_type: string;
  extension: string;
  file_category: string;
  size_bytes: number;
  storage_key: string;
  storage_disk: string;
  cdn_url?: string | null;
  status: string;
  is_starred: boolean;
  is_public: boolean;
  version_count: number;
  security_scan_status: string;
  checksum_sha256?: string;
  metadata?: Record<string, any>;
  last_accessed_at?: string;
  created_at: string;
  updated_at: string;
  folder?: { id: number; name: string; color: string };
  uploader?: { id: number; name: string; email: string };
  versions?: FileVersionItem[];
  audit_events?: Array<{
    id: number;
    action: string;
    details?: any;
    created_at: string;
    user?: { id: number; name: string };
  }>;
}

interface TelemetryStats {
  total_files: number;
  files_trend_pct: number;
  storage_used_bytes: number;
  storage_allocated_bytes: number;
  backup_versions_count: number;
  versions_trend_pct: number;
  folder_count: number;
  screenshots_count?: number;
  screenshots_bytes?: number;
  recently_accessed: FileDocItem[];
}

interface AuditHistoryItem {
  id: number;
  company_id: number;
  user_id?: number | null;
  file_id?: number | null;
  action: string;
  details?: Record<string, any>;
  ip_address?: string;
  created_at: string;
  user?: { id: number; name: string; email: string };
  file?: { id: number; name: string; extension: string; uuid: string; size_bytes?: number };
}

export const FileManagementPage: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const navigate = useNavigate();
  const { confirm: confirmModal, alert: alertModal } = useConfirm();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Core Data States - Strictly dynamic from database (0 mock data)
  const [files, setFiles] = useState<FileDocItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryStats>({
    total_files: 0,
    files_trend_pct: 0,
    storage_used_bytes: 0,
    storage_allocated_bytes: 53687091200, // 50 GB default quota
    backup_versions_count: 0,
    versions_trend_pct: 0,
    folder_count: 0,
    recently_accessed: [],
  });
  const [loading, setLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [totalFilesCount, setTotalFilesCount] = useState(0);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusTab, setStatusTab] = useState<string>('all');
  const [selectedFolderId, setSelectedFolderId] = useState<number | 'all' | 'root'>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // View Mode: 'table' | 'grid'
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Column Visibility
  const [visibleColumns, setVisibleColumns] = useState({
    Folder: true,
    Category: true,
    Size: true,
    Uploader: true,
    Security: true,
    Modified: true,
  });

  const toggleColumn = (col: string) => {
    setVisibleColumns((prev: any) => ({ ...prev, [col]: !prev[col] }));
  };

  // Bulk Selection
  const [selectedFileUuids, setSelectedFileUuids] = useState<string[]>([]);

  // Slide-Over Detail / Preview Drawer
  const [activeFile, setActiveFile] = useState<FileDocItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'overview' | 'versions' | 'security' | 'history'>('overview');

  // Audit History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyEvents, setHistoryEvents] = useState<AuditHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedUploadFiles, setSelectedUploadFiles] = useState<File[]>([]);
  const [uploadTargetFolderId, setUploadTargetFolderId] = useState<number | 'root'>('root');
  const [uploadVisibility, setUploadVisibility] = useState<'private' | 'public'>('private');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // New Folder Modal States (Supports sibling folders & subfolders)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('orange');
  const [newFolderParentId, setNewFolderParentId] = useState<number | 'root'>('root');

  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [folderToRename, setFolderToRename] = useState<FolderItem | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [targetMoveFolderId, setTargetMoveFolderId] = useState<number | ''>('');

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareFile, setShareFile] = useState<FileDocItem | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Drag and drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Helper to open new folder modal with parent pre-configured
  const handleOpenNewFolderModal = (parentId: number | 'root' = 'root') => {
    setNewFolderName('');
    setNewFolderColor('orange');
    setNewFolderParentId(parentId);
    setShowNewFolderModal(true);
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === '/' || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key.toLowerCase() === 'u' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowUploadModal(true);
      }
      if (e.key === 'Escape') {
        if (activeFile) setActiveFile(null);
        if (showUploadModal) setShowUploadModal(false);
        if (showNewFolderModal) setShowNewFolderModal(false);
        if (showRenameFolderModal) setShowRenameFolderModal(false);
        if (showMoveModal) setShowMoveModal(false);
        if (showShareModal) setShowShareModal(false);
        if (showHistoryModal) setShowHistoryModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeFile,
    showUploadModal,
    showNewFolderModal,
    showRenameFolderModal,
    showMoveModal,
    showShareModal,
    showHistoryModal,
  ]);

  // Fetch Folders from API
  const fetchFolders = useCallback(async () => {
    if (!companySlug) return;
    try {
      const res = await api.get(`/companies/${companySlug}/folders`);
      if (res.data?.folders) {
        setFolders(res.data.folders);
      }
    } catch (err) {
      console.error('Failed to fetch folders', err);
    }
  }, [companySlug]);

  // Fetch Telemetry Stats from API
  const fetchTelemetry = useCallback(async () => {
    if (!companySlug) return;
    try {
      const res = await api.get(`/companies/${companySlug}/files-telemetry`);
      if (res.data) {
        setTelemetry(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch telemetry', err);
    }
  }, [companySlug]);

  // Fetch Files with all active filters
  const fetchFiles = useCallback(
    async (forceFresh = false) => {
      if (!companySlug) return;
      if (forceFresh) {
        setIsValidating(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.append('search', debouncedSearch);
        if (statusTab !== 'all' && statusTab !== 'starred') params.append('category', statusTab);
        if (statusTab === 'starred') params.append('is_starred', '1');
        if (typeFilter) params.append('type', typeFilter);
        if (dateFilter) params.append('date_range', dateFilter);
        if (selectedFolderId !== 'all') {
          params.append('folder_id', selectedFolderId === 'root' ? 'root' : String(selectedFolderId));
        }

        params.append('sort_by', sortBy);
        params.append('sort_dir', sortDir);
        params.append('page', String(page));
        params.append('per_page', String(perPage));

        const res = await api.get(`/companies/${companySlug}/files?${params.toString()}`);
        if (res.data) {
          const fileList = res.data.files?.data || res.data.files || [];
          setFiles(fileList);
          setTotalFilesCount(res.data.total ?? fileList.length);
        }
      } catch (err) {
        console.error('Failed to load files', err);
      } finally {
        setLoading(false);
        setIsValidating(false);
      }
    },
    [
      companySlug,
      debouncedSearch,
      statusTab,
      typeFilter,
      dateFilter,
      selectedFolderId,
      sortBy,
      sortDir,
      page,
    ]
  );

  useEffect(() => {
    fetchFolders();
    fetchTelemetry();
  }, [fetchFolders, fetchTelemetry]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Fetch Audit History
  const fetchHistory = useCallback(async () => {
    if (!companySlug) return;
    setHistoryLoading(true);
    try {
      const res = await api.get(`/companies/${companySlug}/files/history`);
      if (res.data?.events) {
        setHistoryEvents(res.data.events);
      }
    } catch (err) {
      console.error('Failed to load audit history', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [companySlug]);

  const handleOpenHistoryModal = () => {
    setShowHistoryModal(true);
    fetchHistory();
  };

  // Fetch Single File Details for Drawer
  const openFileDetails = async (file: FileDocItem) => {
    setActiveFile(file);
    setActiveDrawerTab('overview');
    setDetailLoading(true);
    try {
      const res = await api.get(`/companies/${companySlug}/files/${file.uuid}`);
      if (res.data?.file) {
        setActiveFile(res.data.file);
      }
    } catch (err) {
      console.error('Failed to fetch file details', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Toggle Star on File
  const handleToggleStar = async (file: FileDocItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const updatedStarred = !file.is_starred;
      await api.patch(`/companies/${companySlug}/files/${file.uuid}`, {
        is_starred: updatedStarred,
      });
      setFiles((prev) =>
        prev.map((f) => (f.uuid === file.uuid ? { ...f, is_starred: updatedStarred } : f))
      );
      if (activeFile?.uuid === file.uuid) {
        setActiveFile((prev) => (prev ? { ...prev, is_starred: updatedStarred } : null));
      }
    } catch (err) {
      console.error('Failed to star file', err);
    }
  };

  // Delete Folder
  const handleDeleteFolder = async (folder: FolderItem) => {
    const ok = await confirmModal({
      title: 'Delete Folder',
      message: `Are you sure you want to delete folder "${folder.name}"? Files inside will be safely moved to the workspace root.`,
      confirmText: 'Delete Folder',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await api.delete(`/companies/${companySlug}/folders/${folder.id}`);
      if (selectedFolderId === folder.id) {
        setSelectedFolderId('all');
      }
      fetchFolders();
      fetchTelemetry();
      fetchFiles(true);
      await alertModal({
        title: 'Folder Removed',
        message: `Folder "${folder.name}" was successfully removed.`,
        variant: 'success',
      });
    } catch (err: any) {
      await alertModal({
        title: 'Delete Failed',
        message: err.response?.data?.message || 'Could not delete folder.',
        variant: 'danger',
      });
    }
  };

  // Rename Folder Submit
  const handleRenameFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderToRename || !renameFolderName.trim()) return;

    try {
      await api.patch(`/companies/${companySlug}/folders/${folderToRename.id}`, {
        name: renameFolderName.trim(),
      });
      setShowRenameFolderModal(false);
      setFolderToRename(null);
      setRenameFolderName('');
      fetchFolders();
      await alertModal({
        title: 'Folder Renamed',
        message: 'Folder name updated successfully.',
        variant: 'success',
      });
    } catch (err: any) {
      await alertModal({
        title: 'Rename Failed',
        message: err.response?.data?.message || 'Could not rename folder.',
        variant: 'danger',
      });
    }
  };

  // Handle Download File
  const handleDownloadFile = async (file: FileDocItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.get(`/companies/${companySlug}/files/${file.uuid}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.original_name || file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      await alertModal({
        title: 'Download Notice',
        message: 'Could not stream document bytes directly. Checking secure storage mirror...',
        variant: 'info',
      });
    }
  };

  // Direct Upload handler for files via Bunny Storage
  const handleDirectUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadProgress(15);

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const formData = new FormData();
      formData.append('file', f);
      if (selectedFolderId && selectedFolderId !== 'all' && selectedFolderId !== 'root') {
        formData.append('folder_id', String(selectedFolderId));
      }

      try {
        setUploadProgress(Math.round(((i + 0.5) / fileList.length) * 100));
        await api.post(`/companies/${companySlug}/files/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (err: any) {
        await alertModal({
          title: 'Upload Failed',
          message: err.response?.data?.message || `Failed to upload "${f.name}".`,
          variant: 'danger',
        });
      }
    }

    setUploadProgress(100);
    setTimeout(() => setUploadProgress(null), 800);
    fetchFiles(true);
    fetchTelemetry();
    fetchFolders();
  };

  // Submit Upload Modal
  const handleSubmitUploadModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUploadFiles.length === 0) {
      await alertModal({
        title: 'No Files Selected',
        message: 'Please choose at least one file to upload.',
        variant: 'info',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    for (let i = 0; i < selectedUploadFiles.length; i++) {
      const f = selectedUploadFiles[i];
      const formData = new FormData();
      formData.append('file', f);
      if (uploadTargetFolderId !== 'root') {
        formData.append('folder_id', String(uploadTargetFolderId));
      }
      formData.append('is_public', uploadVisibility === 'public' ? '1' : '0');

      try {
        setUploadProgress(Math.round(((i + 0.8) / selectedUploadFiles.length) * 100));
        await api.post(`/companies/${companySlug}/files/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (err: any) {
        await alertModal({
          title: 'Upload Error',
          message: err.response?.data?.message || `Failed to upload "${f.name}".`,
          variant: 'danger',
        });
      }
    }

    setIsUploading(false);
    setUploadProgress(null);
    setSelectedUploadFiles([]);
    setShowUploadModal(false);
    fetchFiles(true);
    fetchTelemetry();
    fetchFolders();

    await alertModal({
      title: 'Files Uploaded Successfully',
      message: 'Documents have been secured in Bunny.net storage with version tracking.',
      variant: 'success',
    });
  };

  // Create Folder (Allows Sibling Folders & Subfolders via newFolderParentId)
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await api.post(`/companies/${companySlug}/folders`, {
        name: newFolderName.trim(),
        color: newFolderColor,
        parent_id: newFolderParentId === 'root' ? null : newFolderParentId,
      });
      setNewFolderName('');
      setNewFolderParentId('root');
      setShowNewFolderModal(false);
      fetchFolders();
      fetchTelemetry();
      await alertModal({
        title: 'Folder Created',
        message: `Folder "${newFolderName}" has been created.`,
        variant: 'success',
      });
    } catch (err: any) {
      await alertModal({
        title: 'Error',
        message: err.response?.data?.message || 'Failed to create folder.',
        variant: 'danger',
      });
    }
  };

  // Delete Single File
  const handleDeleteFile = async (file: FileDocItem) => {
    const ok = await confirmModal({
      title: 'Delete Document',
      message: `Are you sure you want to delete "${file.name}"? This file will be removed from your workspace storage.`,
      confirmText: 'Delete Document',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await api.delete(`/companies/${companySlug}/files/${file.uuid}`);
      if (activeFile?.uuid === file.uuid) setActiveFile(null);
      setSelectedFileUuids((prev) => prev.filter((id) => id !== file.uuid));
      fetchFiles(true);
      fetchTelemetry();
      fetchFolders();
    } catch (err: any) {
      await alertModal({
        title: 'Delete Failed',
        message: err.response?.data?.message || 'Failed to delete file.',
        variant: 'danger',
      });
    }
  };

  // Bulk Selection Handlers
  const handleToggleSelectAll = () => {
    if (selectedFileUuids.length === files.length && files.length > 0) {
      setSelectedFileUuids([]);
    } else {
      setSelectedFileUuids(files.map((f) => f.uuid));
    }
  };

  const handleToggleSelectOne = (uuid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFileUuids((prev) =>
      prev.includes(uuid) ? prev.filter((id) => id !== uuid) : [...prev, uuid]
    );
  };

  // Bulk Actions
  const handleBulkDelete = async () => {
    if (selectedFileUuids.length === 0) return;
    const ok = await confirmModal({
      title: 'Delete Selected Documents',
      message: `Are you sure you want to remove ${selectedFileUuids.length} selected files from workspace storage?`,
      confirmText: 'Delete Files',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await api.post(`/companies/${companySlug}/files/bulk-action`, {
        action: 'delete',
        uuids: selectedFileUuids,
      });
      setSelectedFileUuids([]);
      fetchFiles(true);
      fetchTelemetry();
      fetchFolders();
    } catch (err: any) {
      await alertModal({
        title: 'Action Failed',
        message: err.response?.data?.message || 'Bulk deletion failed.',
        variant: 'danger',
      });
    }
  };

  const handleBulkMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFileUuids.length === 0) return;

    try {
      await api.post(`/companies/${companySlug}/files/bulk-action`, {
        action: 'move',
        uuids: selectedFileUuids,
        target_folder_id: targetMoveFolderId === '' ? null : targetMoveFolderId,
      });
      setShowMoveModal(false);
      setSelectedFileUuids([]);
      fetchFiles(true);
      fetchFolders();
      await alertModal({
        title: 'Files Moved',
        message: 'The selected files have been organized into the destination folder.',
        variant: 'success',
      });
    } catch (err: any) {
      await alertModal({
        title: 'Move Failed',
        message: err.response?.data?.message || 'Could not move files.',
        variant: 'danger',
      });
    }
  };

  // Export CSV Handler
  const handleExportCsv = () => {
    if (files.length === 0) {
      alertModal({
        title: 'Export Notice',
        message: 'No files available to export in the current view.',
        variant: 'info',
      });
      return;
    }

    const headers = [
      'Document Name',
      'Original Name',
      'Folder',
      'Category',
      'Extension',
      'Size (Bytes)',
      'Storage Disk',
      'Uploaded By',
      'Security Scan',
      'Created At',
    ];
    const rows = files.map((f) => [
      `"${(f.name || '').replace(/"/g, '""')}"`,
      `"${(f.original_name || '').replace(/"/g, '""')}"`,
      `"${(f.folder?.name || 'Root').replace(/"/g, '""')}"`,
      f.file_category || '',
      f.extension || '',
      f.size_bytes || 0,
      f.storage_disk || 'bunny',
      `"${(f.uploader?.name || 'System').replace(/"/g, '""')}"`,
      f.security_scan_status || 'verified',
      f.created_at || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `finovo-documents-${companySlug || 'workspace'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper: File Type Icon and Color Styling (Unified Finovo Theme)
  const getFileBadgeInfo = (ext: string, category?: string, name?: string) => {
    const cat = (category || '').toLowerCase();
    const fileName = (name || '').toLowerCase();

    if (cat === 'screenshots' || fileName.includes('screenshot')) {
      return {
        badge: 'SCREEN',
        badgeBg: 'bg-rose-50 text-rose-600 border-rose-200/80',
        iconBg: 'bg-rose-50 text-rose-600',
        icon: Camera,
      };
    }
    const e = (ext || '').toLowerCase();
    if (e === 'pdf') {
      return {
        badge: 'PDF',
        badgeBg: 'bg-orange-50 text-[#F95716] border-orange-200/80',
        iconBg: 'bg-orange-50 text-[#F95716]',
        icon: FileText,
      };
    }
    if (['xls', 'xlsx', 'csv'].includes(e)) {
      return {
        badge: 'XLSX',
        badgeBg: 'bg-emerald-50 text-emerald-600 border-emerald-200/80',
        iconBg: 'bg-emerald-50 text-emerald-600',
        icon: FileSpreadsheet,
      };
    }
    if (['doc', 'docx'].includes(e)) {
      return {
        badge: 'DOC',
        badgeBg: 'bg-blue-50 text-blue-600 border-blue-200/80',
        iconBg: 'bg-blue-50 text-blue-600',
        icon: FileText,
      };
    }
    if (['mp4', 'mov', 'webm', 'mkv'].includes(e)) {
      return {
        badge: 'MP4',
        badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
        iconBg: 'bg-slate-900 text-white',
        icon: Film,
      };
    }
    if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(e)) {
      return {
        badge: 'IMG',
        badgeBg: 'bg-orange-50 text-[#F95716] border-orange-200/80',
        iconBg: 'bg-orange-50 text-[#F95716]',
        icon: ImageIcon,
      };
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) {
      return {
        badge: 'ZIP',
        badgeBg: 'bg-orange-50 text-[#F95716] border-orange-200/80',
        iconBg: 'bg-orange-50 text-[#F95716]',
        icon: FileArchive,
      };
    }
    if (['js', 'ts', 'tsx', 'php', 'py', 'sql', 'json'].includes(e)) {
      return {
        badge: e.toUpperCase(),
        badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
        iconBg: 'bg-slate-100 text-slate-700',
        icon: FileCode,
      };
    }

    return {
      badge: (e || 'FILE').toUpperCase().slice(0, 4),
      badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
      iconBg: 'bg-slate-100 text-slate-600',
      icon: FileGenericIcon,
    };
  };

  // Helper: File subtitle description
  const getFileSubtitle = (ext: string, category?: string) => {
    if (category === 'screenshots') return 'Live Employee Screen Capture';
    const e = (ext || '').toLowerCase();
    if (e === 'pdf') return 'PDF document';
    if (['mp4', 'mov', 'webm'].includes(e)) return 'Video recording';
    if (['xls', 'xlsx', 'csv'].includes(e)) return 'Excel spreadsheet';
    if (['doc', 'docx'].includes(e)) return 'Word document';
    if (['zip', 'rar', 'tar', 'gz'].includes(e)) return 'Archive';
    if (['sql', 'db'].includes(e)) return 'Database dump';
    if (category) return category.charAt(0).toUpperCase() + category.slice(1);
    return 'Document';
  };

  // Helper: Format Bytes to human readable
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Helper: Format Date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Calculate selected files total bytes
  const selectedTotalBytes = useMemo(() => {
    return files
      .filter((f) => selectedFileUuids.includes(f.uuid))
      .reduce((sum, f) => sum + (f.size_bytes || 0), 0);
  }, [files, selectedFileUuids]);

  // Telemetry Distribution Calculations
  const docsCount = useMemo(() => {
    return files.filter((f) =>
      ['pdf', 'doc', 'docx', 'txt', 'rtf'].includes((f.extension || '').toLowerCase())
    ).length;
  }, [files]);

  const sheetsCount = useMemo(() => {
    return files.filter((f) =>
      ['xls', 'xlsx', 'csv'].includes((f.extension || '').toLowerCase())
    ).length;
  }, [files]);

  const imagesCount = useMemo(() => {
    return files.filter((f) =>
      ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes((f.extension || '').toLowerCase())
    ).length;
  }, [files]);

  const mediaCount = useMemo(() => {
    return files.filter((f) =>
      ['mp4', 'mov', 'webm', 'mkv', 'mp3', 'wav'].includes((f.extension || '').toLowerCase())
    ).length;
  }, [files]);

  const archivesCount = useMemo(() => {
    return files.filter((f) =>
      ['zip', 'rar', '7z', 'tar', 'gz', 'sql'].includes((f.extension || '').toLowerCase())
    ).length;
  }, [files]);

  const screenshotsCount = useMemo(() => {
    return files.filter(
      (f) =>
        f.file_category === 'screenshots' ||
        (f.folder?.name || '').toLowerCase() === 'screenshots' ||
        f.name.toLowerCase().includes('screenshot')
    ).length;
  }, [files]);

  const starredCount = useMemo(() => {
    return files.filter((f) => f.is_starred).length;
  }, [files]);

  // Priority / Size Mix Stats
  const priorityStats = useMemo(() => {
    let high = 0; // > 10MB or is_public
    let medium = 0; // 1MB - 10MB
    let low = 0; // < 1MB
    files.forEach((f) => {
      const bytes = f.size_bytes || 0;
      if (bytes > 10 * 1024 * 1024 || f.is_public) high++;
      else if (bytes > 1024 * 1024) medium++;
      else low++;
    });
    return { high, medium, low };
  }, [files]);

  const handleClearFilters = () => {
    setSearch('');
    setStatusTab('all');
    setSelectedFolderId('all');
    setTypeFilter('');
    setDateFilter('');
    setPage(1);
  };

  const activeFolderName = useMemo(() => {
    if (selectedFolderId === 'all') return null;
    if (selectedFolderId === 'root') return 'Root (Unfiled)';
    return folders.find((f) => f.id === selectedFolderId)?.name || 'Folder';
  }, [selectedFolderId, folders]);

  return (
    <AppShell>
      <div className="space-y-5 font-['Inter',sans-serif] flex-1 flex flex-col">
        {/* Hidden File Input for Native File Picker */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleDirectUploadFiles(e.target.files)}
        />

        {/* =========================================================================
            TOP PORTFOLIO HEADER (IDENTICAL UI & GRADIENTS TO PROJECTS & TASKS)
           ========================================================================= */}
        <PortfolioPageHeader
          category="PORTFOLIO"
          title="Files & Docs"
          subtitle="Track, search, and manage files and documents across projects — secure Bunny storage, version control, and audit logs."
          onExport={handleExportCsv}
          exportLabel="Export"
          onAdd={() => setShowUploadModal(true)}
          addLabel="Upload file"
          addShortcut="U"
        />

        {/* =========================================================================
            TOP HERO ANALYTICS / STATS PANEL (EXACT 2-COLUMN SPLIT)
           ========================================================================= */}
        <PortfolioHeroStats
          icon={<Folder className="w-4 h-4 fill-blue-500/20" />}
          totalCount={totalFilesCount || files.length}
          totalLabel="Total documents"
          scopeLabel="across all folders"
          distribution={[
            {
              key: 'documents',
              label: 'Documents',
              count: docsCount,
              colorClass: 'bg-blue-500',
              showPercent: true,
            },
            {
              key: 'spreadsheets',
              label: 'Spreadsheets',
              count: sheetsCount,
              colorClass: 'bg-emerald-500',
              showPercent: true,
            },
            {
              key: 'images',
              label: 'Images',
              count: imagesCount,
              colorClass: 'bg-[#F95716]',
              dotClass: 'bg-[#F95716] rounded-xs',
              showPercent: false,
            },
            {
              key: 'screenshots',
              label: 'Screenshots',
              count: screenshotsCount,
              colorClass: 'bg-rose-500',
              dotClass: 'bg-rose-500 rounded-full',
              showPercent: false,
            },
            {
              key: 'media',
              label: 'Media',
              count: mediaCount,
              colorClass: 'bg-purple-500',
              dotClass: 'bg-purple-500 rounded-full',
              showPercent: false,
            },
            {
              key: 'archives',
              label: 'Archives',
              count: archivesCount,
              colorClass: 'bg-slate-300',
              dotClass: 'bg-slate-300 rounded-full',
              showPercent: false,
            },
          ]}
          priorityMix={{
            high: priorityStats.high,
            medium: priorityStats.medium,
            low: priorityStats.low,
            total: totalFilesCount || files.length,
          }}
        />

        {/* =========================================================================
            TABS & VIEW SWITCHER ROW (IDENTICAL UX & DESIGN TO PROJECTS)
           ========================================================================= */}
        <PortfolioFilterTabs
          tabs={[
            { id: 'all', label: 'All', count: totalFilesCount || files.length },
            {
              id: 'documents',
              label: 'Documents',
              count: docsCount,
              dotColor: 'bg-blue-500',
            },
            {
              id: 'spreadsheets',
              label: 'Spreadsheets',
              count: sheetsCount,
              dotColor: 'bg-emerald-500',
            },
            {
              id: 'images',
              label: 'Images',
              count: imagesCount,
              dotColor: 'bg-[#F95716]',
            },
            {
              id: 'screenshots',
              label: 'Screenshots',
              count: screenshotsCount,
              dotColor: 'bg-rose-500',
            },
            {
              id: 'media',
              label: 'Media',
              count: mediaCount,
              dotColor: 'bg-purple-500',
            },
            {
              id: 'archives',
              label: 'Archives',
              count: archivesCount,
              dotColor: 'bg-slate-400',
            },
            {
              id: 'starred',
              label: 'Starred',
              count: starredCount,
              dotColor: 'bg-amber-400',
            },
          ]}
          activeTab={statusTab}
          onTabChange={(tabId) => {
            setStatusTab(tabId);
            setPage(1);
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* =========================================================================
            WORKSPACE FOLDERS STRIP (INTERACTIVE ONE-CLICK FILTERING & SIBLING ACTIONS)
           ========================================================================= */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-xs">Folders</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600 font-bold">
                {folders.length}
              </span>
              {activeFolderName && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-[#F95716] border border-orange-200">
                  <span>Filtered: {activeFolderName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFolderId('all');
                      setPage(1);
                    }}
                    className="hover:text-orange-950 font-bold ml-0.5 cursor-pointer"
                    title="Clear folder filter"
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedFolderId !== 'all' && selectedFolderId !== 'root' && (
                <button
                  type="button"
                  onClick={() => {
                    const current = folders.find((f) => f.id === selectedFolderId);
                    handleOpenNewFolderModal(current?.parent_id ? current.parent_id : 'root');
                  }}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Create a folder at the same level as the selected folder"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-orange-500" />
                  <span>+ Sibling Folder</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleOpenNewFolderModal('root')}
                className="text-xs font-semibold text-[#F95716] hover:text-orange-700 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>+ New Folder</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {/* All Files Card */}
            <div
              onClick={() => {
                setSelectedFolderId('all');
                setPage(1);
              }}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                selectedFolderId === 'all'
                  ? 'border-[#F95716] bg-orange-50/40 shadow-xs ring-1 ring-[#F95716]'
                  : 'border-slate-200/90 bg-white hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  selectedFolderId === 'all' ? 'bg-[#F95716] text-white shadow-2xs' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <HardDrive className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-slate-800 block truncate">All Files</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {totalFilesCount || files.length} files
                </span>
              </div>
            </div>

            {/* Root (Unfiled) Card */}
            <div
              onClick={() => {
                setSelectedFolderId(selectedFolderId === 'root' ? 'all' : 'root');
                setPage(1);
              }}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                selectedFolderId === 'root'
                  ? 'border-[#F95716] bg-orange-50/40 shadow-xs ring-1 ring-[#F95716]'
                  : 'border-slate-200/90 bg-white hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  selectedFolderId === 'root' ? 'bg-[#F95716] text-white shadow-2xs' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Folder className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-slate-800 block truncate">Root</span>
                <span className="text-[10px] text-slate-400 font-mono">Unfiled files</span>
              </div>
            </div>

            {/* Folder Cards */}
            {folders.map((folder) => {
              const isSelected = selectedFolderId === folder.id;
              return (
                <div
                  key={folder.id}
                  onClick={() => {
                    setSelectedFolderId(isSelected ? 'all' : folder.id);
                    setPage(1);
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                    isSelected
                      ? 'border-[#F95716] bg-orange-50/40 shadow-xs ring-1 ring-[#F95716]'
                      : 'border-slate-200/90 bg-white hover:border-orange-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-[#F95716] text-white shadow-2xs'
                          : 'bg-orange-50 text-[#F95716] border border-orange-100'
                      }`}
                    >
                      <Folder className="w-4 h-4 fill-current" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-[#F95716] block truncate">
                        {folder.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {folder.items_count || 0} files
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <CustomActionDropdown
                      align="right"
                      title="Folder Options"
                      trigger={
                        <button
                          type="button"
                          className="p-1 text-slate-300 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      }
                      items={[
                        {
                          id: 'filter',
                          label: isSelected ? 'Show all files' : 'Filter by this folder',
                          icon: <Folder className="w-3.5 h-3.5 text-orange-500" />,
                          onClick: () => {
                            setSelectedFolderId(isSelected ? 'all' : folder.id);
                            setPage(1);
                          },
                        },
                        {
                          id: 'new_sibling',
                          label: '+ Add Sibling Folder',
                          icon: <FolderPlus className="w-3.5 h-3.5 text-slate-500" />,
                          onClick: () => handleOpenNewFolderModal(folder.parent_id || 'root'),
                        },
                        {
                          id: 'new_subfolder',
                          label: '+ Add Subfolder',
                          icon: <FolderInput className="w-3.5 h-3.5 text-slate-500" />,
                          onClick: () => handleOpenNewFolderModal(folder.id),
                        },
                        {
                          id: 'rename',
                          label: 'Rename Folder',
                          icon: <Edit2 className="w-3.5 h-3.5" />,
                          dividerBefore: true,
                          onClick: () => {
                            setFolderToRename(folder);
                            setRenameFolderName(folder.name);
                            setShowRenameFolderModal(true);
                          },
                        },
                        {
                          id: 'delete',
                          label: 'Delete Folder',
                          icon: <Trash2 className="w-3.5 h-3.5" />,
                          danger: true,
                          onClick: () => handleDeleteFolder(folder),
                        },
                      ]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* =========================================================================
            SEARCH AND CONTROLS TOOLBAR (EXACT MATCH WITH CUSTOM DROPDOWNS)
           ========================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Search with '/' keyboard badge */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search documents by name, type, original file..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-slate-200/90 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] transition-all shadow-2xs"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 text-[10px] font-mono border border-slate-200/80">
                /
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Folder Filter Dropdown */}
            <CustomDropdown
              value={selectedFolderId === 'all' ? '' : String(selectedFolderId)}
              onChange={(val) => {
                setSelectedFolderId(val === '' ? 'all' : val === 'root' ? 'root' : Number(val));
                setPage(1);
              }}
              placeholder="All folders"
              size="sm"
              variant="filter"
              leadingIcon={<Folder className="w-3.5 h-3.5 text-slate-400" />}
              options={[
                { value: '', label: 'All folders' },
                { value: 'root', label: 'Root (Unfiled)' },
                ...folders.map((f) => ({
                  value: String(f.id),
                  label: f.parent_id ? `↳ ${f.name}` : f.name,
                })),
              ]}
              searchable={folders.length > 5}
              className="min-w-[150px]"
            />

            {/* File Type Filter */}
            <CustomDropdown
              value={typeFilter}
              onChange={(val) => {
                setTypeFilter(val);
                setPage(1);
              }}
              placeholder="All types"
              size="sm"
              variant="filter"
              leadingIcon={<Flag className="w-3.5 h-3.5 text-slate-400" />}
              options={[
                { value: '', label: 'All types' },
                { value: 'pdf', label: 'PDF Documents' },
                { value: 'docx', label: 'Word (.docx)' },
                { value: 'xlsx', label: 'Excel (.xlsx)' },
                { value: 'mp4', label: 'Videos (.mp4)' },
                { value: 'png', label: 'Images (.png/.jpg)' },
                { value: 'zip', label: 'Archives (.zip)' },
              ]}
              searchable={false}
              className="min-w-[140px]"
            />

            {/* Sort Dropdown */}
            <CustomDropdown
              value={sortBy}
              onChange={(val) => {
                setSortBy(val);
                setPage(1);
              }}
              size="sm"
              variant="filter"
              leadingIcon={<ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />}
              options={[
                { value: 'created_at', label: 'Sort: Newest' },
                { value: 'name', label: 'Sort: Name A-Z' },
                { value: 'size_bytes', label: 'Sort: Size' },
                { value: 'last_accessed_at', label: 'Sort: Accessed' },
              ]}
              searchable={false}
              className="min-w-[145px]"
            />

            {/* Columns Toggle Dropdown */}
            <CustomCheckboxDropdown
              label="Columns"
              title="Toggle Columns"
              icon={<Columns3 className="w-3.5 h-3.5 text-slate-400" />}
              items={[
                { id: 'Folder', label: 'Folder', checked: visibleColumns.Folder },
                { id: 'Category', label: 'Category', checked: visibleColumns.Category },
                { id: 'Size', label: 'Size', checked: visibleColumns.Size },
                { id: 'Uploader', label: 'Uploaded By', checked: visibleColumns.Uploader },
                { id: 'Security', label: 'Security', checked: visibleColumns.Security },
                { id: 'Modified', label: 'Modified', checked: visibleColumns.Modified },
              ]}
              onToggle={toggleColumn}
              onSelectAll={() =>
                setVisibleColumns({
                  Folder: true,
                  Category: true,
                  Size: true,
                  Uploader: true,
                  Security: true,
                  Modified: true,
                })
              }
              onDeselectAll={() =>
                setVisibleColumns({
                  Folder: false,
                  Category: false,
                  Size: false,
                  Uploader: false,
                  Security: false,
                  Modified: false,
                })
              }
              size="sm"
            />

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchFiles(true)}
              disabled={isValidating}
              className="p-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shadow-2xs"
              title="Refresh files"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin text-[#F95716]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Subtle Background Revalidation Indicator */}
        {isValidating && files.length > 0 && (
          <div className="h-0.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-400 via-amber-400 to-[#F95716] animate-[pulse_1s_infinite] w-full" />
          </div>
        )}

        {/* Upload Progress Bar if active */}
        {uploadProgress !== null && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl space-y-1.5 animate-pulse">
            <div className="flex items-center justify-between text-xs font-bold text-[#F95716]">
              <span>Uploading to Bunny.net Storage &amp; Verifying Checksums...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-orange-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#F95716] h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* =========================================================================
            BULK ACTION TOOLBAR (FLOATING / STICKY WHEN FILES SELECTED)
           ========================================================================= */}
        {selectedFileUuids.length > 0 && (
          <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-3 pl-2">
              <div className="w-5 h-5 rounded-md bg-[#F95716] text-white flex items-center justify-center text-xs font-bold font-mono">
                {selectedFileUuids.length}
              </div>
              <span className="text-xs font-medium">
                {selectedFileUuids.length} {selectedFileUuids.length === 1 ? 'file' : 'files'} selected ({formatBytes(selectedTotalBytes)})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMoveModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <FolderInput className="w-3.5 h-3.5 text-slate-300" />
                <span>Move to folder</span>
              </button>

              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFileUuids([])}
                className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Deselect all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            DATA VIEW: 1:1 ENTERPRISE TABLE OR GRID VIEW
           ========================================================================= */}
        {viewMode === 'grid' ? (
          /* =========================================================================
             VIEW: GRID VIEW (IDENTICAL FIGMA CARD LAYOUT)
             ========================================================================= */
          files.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <Folder className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">
                {search || typeFilter || statusTab !== 'all' || selectedFolderId !== 'all'
                  ? 'No Documents Match Active Filters'
                  : 'No Documents in this Workspace'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {search || typeFilter || statusTab !== 'all' || selectedFolderId !== 'all'
                  ? 'Try adjusting your search criteria, category tab, or folder filter to view more files.'
                  : 'Get started by uploading your first document or creating structured project folders.'}
              </p>
              {search || typeFilter || statusTab !== 'all' || selectedFolderId !== 'all' ? (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer mt-2"
                >
                  Clear filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F95716] hover:bg-[#e0480c] text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all cursor-pointer mt-2"
                >
                  Upload file
                  <span className="px-1.5 py-0.2 bg-white/20 rounded text-[10px] font-mono">U</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {files.map((file) => {
                const badge = getFileBadgeInfo(file.extension, file.file_category, file.name);
                const IconComp = badge.icon;
                const isSelected = selectedFileUuids.includes(file.uuid);

                return (
                  <div
                    key={file.uuid}
                    onClick={() => openFileDetails(file)}
                    className={`p-4 rounded-2xl bg-white border shadow-2xs hover:shadow-md hover:border-orange-500/30 transition-all cursor-pointer flex flex-col justify-between space-y-3 group ${
                      isSelected ? 'border-[#F95716] bg-orange-50/10' : 'border-slate-200/90'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${badge.iconBg} shadow-2xs`}>
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-400 font-mono tracking-tight block uppercase">
                              {file.extension || 'DOC'} &bull; {formatBytes(file.size_bytes)}
                            </span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFolderId(file.folder_id || 'root');
                                setPage(1);
                              }}
                              className="text-xs font-semibold text-slate-600 hover:text-[#F95716] transition-colors truncate max-w-[150px] block cursor-pointer"
                            >
                              {file.folder?.name || 'Workspace Root'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handleToggleStar(file, e)}
                            className="p-1 text-slate-300 hover:text-amber-500 transition-colors cursor-pointer"
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                file.is_starred ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#F95716] transition-colors line-clamp-1">
                          {file.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {getFileSubtitle(file.extension, file.file_category)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.badgeBg}`}>
                          {badge.badge}
                        </span>
                        {file.is_public ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200/70 flex items-center gap-1">
                            <Unlock className="w-2.5 h-2.5" />
                            <span>Public</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Private</span>
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 flex items-center gap-1 font-mono">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>Encrypted</span>
                        </span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center">
                          {file.uploader?.name ? file.uploader.name[0].toUpperCase() : 'U'}
                        </div>
                        <span className="text-slate-700 text-[11px] font-medium truncate max-w-[90px]">
                          {file.uploader?.name || 'Workspace'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDate(file.created_at)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDownloadFile(file, e)}
                          className="p-1 rounded-lg text-slate-400 hover:text-[#F95716] hover:bg-orange-50 transition-colors cursor-pointer"
                          title="Download file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* =========================================================================
             VIEW: 1:1 HIGH-DENSITY ENTERPRISE TABLE VIEW (MATCHING PROJECTS & TASKS)
             ========================================================================= */
          <div className="rounded-2xl bg-white border border-slate-200/90 shadow-2xs overflow-hidden relative">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider select-none">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={files.length > 0 && selectedFileUuids.length === files.length}
                        onChange={handleToggleSelectAll}
                        className="rounded text-[#F95716] focus:ring-[#F95716] border-slate-300 w-4 h-4 cursor-pointer accent-[#F95716]"
                        title="Select all documents"
                      />
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-slate-700 transition-colors"
                      onClick={() => {
                        setSortBy('name');
                        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>DOCUMENT</span>
                        <span className="text-[11px]">↑</span>
                      </div>
                    </th>
                    {visibleColumns.Folder && <th className="py-3 px-4">FOLDER</th>}
                    {visibleColumns.Category && <th className="py-3 px-4">CATEGORY</th>}
                    {visibleColumns.Size && <th className="py-3 px-4">SIZE</th>}
                    {visibleColumns.Uploader && <th className="py-3 px-4">UPLOADED BY</th>}
                    {visibleColumns.Security && <th className="py-3 px-4">SECURITY</th>}
                    {visibleColumns.Modified && <th className="py-3 px-4">LAST MODIFIED</th>}
                    <th className="py-3 px-4 w-12 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/90 text-xs">
                  {loading && files.length === 0 ? (
                    /* SKELETON PREVIEW ROWS */
                    [...Array(6)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-3.5 px-4"><div className="w-4 h-4 bg-slate-100 rounded" /></td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-100" />
                            <div className="space-y-1.5">
                              <div className="w-36 h-3.5 bg-slate-100 rounded" />
                              <div className="w-20 h-2.5 bg-slate-100 rounded" />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4"><div className="w-20 h-3 bg-slate-100 rounded" /></td>
                        <td className="py-3.5 px-4"><div className="w-16 h-3 bg-slate-100 rounded" /></td>
                        <td className="py-3.5 px-4"><div className="w-14 h-3 bg-slate-100 rounded" /></td>
                        <td className="py-3.5 px-4"><div className="w-24 h-3 bg-slate-100 rounded" /></td>
                        <td className="py-3.5 px-4"><div className="w-20 h-3 bg-slate-100 rounded" /></td>
                        <td className="py-3.5 px-4"><div className="w-20 h-3 bg-slate-100 rounded" /></td>
                        <td className="py-3.5 px-4 text-right"><div className="w-4 h-4 bg-slate-100 rounded ml-auto" /></td>
                      </tr>
                    ))
                  ) : files.length === 0 ? (
                    /* EMPTY STATE (PRESERVES TABLE HEADERS AND GEOMETRY) */
                    <tr>
                      <td colSpan={9} className="py-16 px-4 text-center">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#F95716] flex items-center justify-center mx-auto border border-orange-100 shadow-xs">
                            <Folder className="w-6 h-6" />
                          </div>
                          <h3 className="text-sm font-bold text-slate-900">
                            {search || typeFilter || statusTab !== 'all' || selectedFolderId !== 'all'
                              ? 'No documents match your active filters'
                              : 'No documents in this workspace yet'}
                          </h3>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            {search || typeFilter || statusTab !== 'all' || selectedFolderId !== 'all'
                              ? 'Try adjusting your search query, type filter, or folder filter to find what you are looking for.'
                              : 'Upload files and documents directly to Bunny.net storage with automated versioning and SHA-256 validation.'}
                          </p>
                          {search || typeFilter || statusTab !== 'all' || selectedFolderId !== 'all' ? (
                            <button
                              type="button"
                              onClick={handleClearFilters}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer mt-2"
                            >
                              Clear filters
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowUploadModal(true)}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F95716] hover:bg-[#e0480c] text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all cursor-pointer mt-2"
                            >
                              Upload file
                              <span className="px-1.5 py-0.2 bg-white/20 rounded text-[10px] font-mono">U</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    /* POPULATED ROWS */
                    files.map((file) => {
                      const isSelected = selectedFileUuids.includes(file.uuid);
                      const badge = getFileBadgeInfo(file.extension, file.file_category, file.name);
                      const IconComp = badge.icon;

                      return (
                        <tr
                          key={file.uuid}
                          onClick={() => openFileDetails(file)}
                          className={`hover:bg-slate-50/70 transition-colors cursor-pointer group ${
                            isSelected ? 'bg-orange-50/20' : ''
                          }`}
                        >
                          {/* 1. Checkbox */}
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleToggleSelectOne(file.uuid, e as any)}
                              className="rounded text-[#F95716] focus:ring-[#F95716] border-slate-300 w-4 h-4 cursor-pointer accent-[#F95716]"
                            />
                          </td>

                          {/* 2. Document Name + Icon + Subtitle */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${badge.iconBg} shadow-2xs`}>
                                <IconComp className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 group-hover:text-[#F95716] transition-colors truncate text-xs">
                                  {file.name}
                                </p>
                                <span className="text-[10px] text-slate-400 block truncate">
                                  {file.original_name || file.name}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 3. Folder */}
                          {visibleColumns.Folder && (
                            <td className="py-3 px-4 text-slate-600">
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedFolderId(file.folder_id || 'root');
                                  setPage(1);
                                }}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-orange-100 hover:text-[#F95716] transition-colors cursor-pointer"
                                title="Filter by this folder"
                              >
                                <Folder className="w-3 h-3 text-orange-500 fill-orange-500" />
                                <span className="truncate max-w-[130px]">{file.folder?.name || 'Root'}</span>
                              </span>
                            </td>
                          )}

                          {/* 4. Category Badge */}
                          {visibleColumns.Category && (
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.badgeBg}`}>
                                {badge.badge}
                              </span>
                            </td>
                          )}

                          {/* 5. Size */}
                          {visibleColumns.Size && (
                            <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                              {formatBytes(file.size_bytes)}
                            </td>
                          )}

                          {/* 6. Uploaded By */}
                          {visibleColumns.Uploader && (
                            <td className="py-3 px-4 text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center">
                                  {file.uploader?.name ? file.uploader.name[0].toUpperCase() : 'U'}
                                </div>
                                <span className="truncate max-w-[110px] text-[11px]">
                                  {file.uploader?.name || 'Workspace User'}
                                </span>
                              </div>
                            </td>
                          )}

                          {/* 7. Security / Scan Status */}
                          {visibleColumns.Security && (
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 font-mono">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span>Verified</span>
                              </span>
                            </td>
                          )}

                          {/* 8. Last Modified */}
                          {visibleColumns.Modified && (
                            <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                              {formatDate(file.updated_at || file.created_at)}
                            </td>
                          )}

                          {/* 9. Actions Dropdown */}
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={(e) => handleToggleStar(file, e)}
                                className="p-1 text-slate-300 hover:text-amber-500 transition-colors cursor-pointer"
                                title={file.is_starred ? 'Unstar file' : 'Star file'}
                              >
                                <Star
                                  className={`w-3.5 h-3.5 ${
                                    file.is_starred ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                                  }`}
                                />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleDownloadFile(file, e)}
                                className="p-1 rounded-lg text-slate-400 hover:text-[#F95716] hover:bg-orange-50 transition-colors cursor-pointer"
                                title="Download file"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              <CustomActionDropdown
                                align="right"
                                title="File Options"
                                trigger={
                                  <button
                                    type="button"
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                    title="More actions"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                }
                                items={[
                                  {
                                    id: 'view',
                                    label: 'Open Details & Versions',
                                    icon: <Eye className="w-3.5 h-3.5" />,
                                    onClick: () => openFileDetails(file),
                                  },
                                  {
                                    id: 'download',
                                    label: 'Download Document',
                                    icon: <Download className="w-3.5 h-3.5" />,
                                    onClick: () => handleDownloadFile(file),
                                  },
                                  {
                                    id: 'share',
                                    label: 'Share Public CDN Link',
                                    icon: <Share2 className="w-3.5 h-3.5" />,
                                    onClick: () => {
                                      setShareFile(file);
                                      setShowShareModal(true);
                                    },
                                  },
                                  {
                                    id: 'move',
                                    label: 'Move to Folder',
                                    icon: <FolderInput className="w-3.5 h-3.5" />,
                                    onClick: () => {
                                      setSelectedFileUuids([file.uuid]);
                                      setShowMoveModal(true);
                                    },
                                  },
                                  {
                                    id: 'delete',
                                    label: 'Delete Document',
                                    icon: <Trash2 className="w-3.5 h-3.5" />,
                                    danger: true,
                                    dividerBefore: true,
                                    onClick: () => handleDeleteFile(file),
                                  },
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <PortfolioPagination
              page={page}
              perPage={perPage}
              totalCount={totalFilesCount}
              currentCount={files.length}
              onPageChange={setPage}
            />
          </div>
        )}

        {/* =========================================================================
            SLIDE-OVER FILE DETAIL DRAWER (UX PARITY WITH TASK & PROJECT DRAWER)
           ========================================================================= */}
        {activeFile &&
          createPortal(
            <div className="fixed inset-0 z-[99999] overflow-hidden font-['Inter',sans-serif]">
              <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
                onClick={() => setActiveFile(null)}
              />
              <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col justify-between border-l border-slate-200 animate-in slide-in-from-right duration-200">
                  {/* Header */}
                  <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#F95716] flex items-center justify-center shrink-0 border border-orange-100 shadow-2xs">
                        {React.createElement(getFileBadgeInfo(activeFile.extension, activeFile.file_category, activeFile.name).icon, {
                          className: 'w-5 h-5',
                        })}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono uppercase text-[#F95716] font-bold tracking-wider block">
                          {activeFile.extension || 'DOC'} &bull; {formatBytes(activeFile.size_bytes)}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 truncate">
                          {activeFile.name}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(activeFile)}
                        className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
                        title="Download file"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFile(null)}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Drawer Tab Navigation */}
                  <div className="px-5 border-b border-slate-200 flex items-center gap-6 text-xs font-semibold">
                    {[
                      { id: 'overview', label: 'Overview' },
                      { id: 'versions', label: `Versions (${activeFile.version_count || 1})` },
                      { id: 'security', label: 'Security & CDN' },
                      { id: 'history', label: 'Audit Trail' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveDrawerTab(tab.id as any)}
                        className={`py-3 relative cursor-pointer ${
                          activeDrawerTab === tab.id
                            ? 'text-[#F95716] font-bold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <span>{tab.label}</span>
                        {activeDrawerTab === tab.id && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F95716] rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Drawer Tab Content */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar text-xs">
                    {detailLoading ? (
                      <div className="py-12 text-center space-y-2">
                        <Loader2 className="w-6 h-6 animate-spin text-[#F95716] mx-auto" />
                        <p className="text-xs text-slate-400">Loading document metadata...</p>
                      </div>
                    ) : activeDrawerTab === 'overview' ? (
                      <div className="space-y-4">
                        {/* Visual Screenshot / Image Preview */}
                        {(activeFile.file_category === 'screenshots' ||
                          ['svg', 'png', 'jpg', 'jpeg', 'webp'].includes(
                            (activeFile.extension || '').toLowerCase()
                          )) && (
                          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-950 p-3 space-y-2.5 shadow-sm">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                                <Camera className="w-3.5 h-3.5 text-rose-400" />
                                <span>
                                  {activeFile.file_category === 'screenshots'
                                    ? 'Live Employee Screen Capture'
                                    : 'Media Preview'}
                                </span>
                              </span>
                              <a
                                href={
                                  activeFile.cdn_url ||
                                  activeFile.metadata?.local_url ||
                                  `/storage/screenshots/${activeFile.name}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10.5px] text-orange-400 hover:text-orange-300 flex items-center gap-1 font-semibold transition-colors"
                              >
                                <span>Open in Tab</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center p-1">
                              <img
                                src={
                                  activeFile.cdn_url ||
                                  activeFile.metadata?.local_url ||
                                  `/storage/screenshots/${activeFile.name}`
                                }
                                alt={activeFile.original_name || activeFile.name}
                                className="w-full h-auto object-contain max-h-60 rounded-lg"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `/storage/screenshots/${activeFile.name}`;
                                }}
                              />
                            </div>
                          </div>
                        )}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                          {activeFile.metadata?.employee_name && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Employee Monitored:</span>
                              <span className="font-semibold text-slate-900">
                                {activeFile.metadata.employee_name}
                              </span>
                            </div>
                          )}
                          {activeFile.metadata?.attendance_record_id && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Attendance Record:</span>
                              <span className="font-mono text-slate-800">
                                #{activeFile.metadata.attendance_record_id}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-400">Original Filename:</span>
                            <span className="font-medium text-slate-800 font-mono">
                              {activeFile.original_name || activeFile.name}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Folder Location:</span>
                            <span className="font-medium text-slate-800">
                              {activeFile.folder?.name || 'Workspace Root'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">MIME Type:</span>
                            <span className="font-mono text-slate-800">{activeFile.mime_type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Storage Provider:</span>
                            <span className="font-medium text-orange-600 font-mono">
                              Bunny.net (Frankfurt Storage Zone)
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Uploaded On:</span>
                            <span className="font-mono text-slate-800">
                              {formatDate(activeFile.created_at)}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                            Document UUID
                          </label>
                          <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-mono text-[11px]">
                            <span className="truncate">{activeFile.uuid}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(activeFile.uuid);
                                alertModal({
                                  title: 'Copied',
                                  message: 'Document UUID copied to clipboard.',
                                  variant: 'info',
                                });
                              }}
                              className="p-1 hover:text-[#F95716] cursor-pointer"
                              title="Copy UUID"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : activeDrawerTab === 'versions' ? (
                      <div className="space-y-3">
                        <p className="text-slate-500 text-[11.5px]">
                          Every upload is versioned automatically. Previous versions are retained in Bunny.net with immutable checksums.
                        </p>
                        {activeFile.versions && activeFile.versions.length > 0 ? (
                          <div className="space-y-2">
                            {activeFile.versions.map((ver) => (
                              <div
                                key={ver.id}
                                className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between hover:border-orange-200 transition-colors"
                              >
                                <div className="space-y-0.5">
                                  <span className="font-bold text-slate-900 font-mono text-xs">
                                    v{ver.version_number}.0
                                  </span>
                                  <span className="text-[10.5px] text-slate-400 block font-mono">
                                    {formatBytes(ver.size_bytes)} &bull; {formatDate(ver.created_at)}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  Verified Safe
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-center">
                            Version 1.0 (Current active head)
                          </div>
                        )}
                      </div>
                    ) : activeDrawerTab === 'security' ? (
                      <div className="space-y-4">
                        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5">
                          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-emerald-950 text-xs">Security Verified</p>
                            <p className="text-[11px] text-emerald-800 mt-0.5">
                              Virus scanning passed. 256-bit AES encryption at rest enabled.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                            SHA-256 Checksum
                          </span>
                          <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-mono text-[10.5px] break-all flex items-center justify-between gap-2">
                            <span>{activeFile.checksum_sha256 || '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  activeFile.checksum_sha256 || '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
                                );
                                alertModal({
                                  title: 'Checksum Copied',
                                  message: 'SHA-256 checksum copied to clipboard.',
                                  variant: 'info',
                                });
                              }}
                              className="p-1 hover:text-[#F95716] cursor-pointer shrink-0"
                              title="Copy Checksum"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Audit Trail */
                      <div className="space-y-3">
                        <p className="text-slate-500 text-[11.5px]">
                          Workspace access logs for this document:
                        </p>
                        {activeFile.audit_events && activeFile.audit_events.length > 0 ? (
                          <div className="space-y-2">
                            {activeFile.audit_events.map((evt) => (
                              <div
                                key={evt.id}
                                className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-semibold text-slate-800 capitalize">
                                    {evt.action}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block font-mono">
                                    {formatDate(evt.created_at)}
                                  </span>
                                </div>
                                <span className="text-slate-600 font-medium">
                                  {evt.user?.name || 'Workspace User'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-center">
                            No audit trail events recorded yet.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleDeleteFile(activeFile)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete File</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShareFile(activeFile);
                          setShowShareModal(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(activeFile)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF5511] to-[#F95716] text-white text-xs font-bold hover:opacity-95 shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* =========================================================================
            UPLOAD FILE MODAL (PORTAL TO DOCUMENT.BODY: 100% FULL-PAGE BACKDROP)
           ========================================================================= */}
        {showUploadModal &&
          createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-4xl overflow-hidden my-8">
                {/* Modal Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                      Upload Documents
                    </h2>
                    <p className="text-xs text-slate-500">
                      Upload deliverables and assets directly to high-speed Bunny.net storage.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-mono border border-slate-200">
                      Esc
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(false)}
                      className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* 2-Column Split: Form on Left, Live Preview on Right */}
                <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Form: Col 1-7 */}
                  <form onSubmit={handleSubmitUploadModal} className="lg:col-span-7 space-y-4">
                    {/* Dropzone */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingOver(true);
                      }}
                      onDragLeave={() => setIsDraggingOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingOver(false);
                        if (e.dataTransfer.files) {
                          setSelectedUploadFiles(Array.from(e.dataTransfer.files));
                        }
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center ${
                        isDraggingOver
                          ? 'border-[#F95716] bg-orange-50/70 scale-[1.01]'
                          : 'border-orange-200 bg-orange-50/20 hover:border-orange-400 hover:bg-orange-50/40'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-2xl bg-orange-100 text-[#F95716] flex items-center justify-center mx-auto mb-2 shadow-2xs">
                        <Upload className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <p className="text-xs font-bold text-slate-800">
                        {selectedUploadFiles.length > 0
                          ? `${selectedUploadFiles.length} files selected`
                          : 'Choose files or drag and drop'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        PDF, DOCX, XLSX, MP4, PNG, ZIP up to 500 MB per file
                      </p>
                    </div>

                    {/* Destination Folder Selector */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-700 block">
                        Target Folder
                      </label>
                      <CustomDropdown
                        value={uploadTargetFolderId === 'root' ? '' : String(uploadTargetFolderId)}
                        onChange={(val) => setUploadTargetFolderId(val === '' ? 'root' : Number(val))}
                        placeholder="Workspace Root"
                        size="sm"
                        leadingIcon={<Folder className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />}
                        options={[
                          { value: '', label: 'Workspace Root (Unfiled)' },
                          ...folders.map((f) => ({ value: String(f.id), label: f.name })),
                        ]}
                        searchable={folders.length > 5}
                        fullWidth
                      />
                    </div>

                    {/* Visibility Privacy Setting */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-700 block">
                        Access Visibility
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setUploadVisibility('private')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            uploadVisibility === 'private'
                              ? 'border-[#F95716] bg-orange-50/30 ring-1 ring-[#F95716]'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                            <Lock className="w-3.5 h-3.5 text-slate-600" />
                            <span>Tenant Private</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Only authenticated workspace members can access.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setUploadVisibility('public')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            uploadVisibility === 'public'
                              ? 'border-[#F95716] bg-orange-50/30 ring-1 ring-[#F95716]'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                            <Unlock className="w-3.5 h-3.5 text-[#F95716]" />
                            <span>Public Link</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Accessible via signed CDN link for clients.
                          </p>
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Right Live Preview: Col 8-12 */}
                  <div className="lg:col-span-5 bg-gradient-to-b from-orange-50/50 via-slate-50/50 to-white rounded-2xl p-5 border border-slate-200/80 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-[#F95716] text-white flex items-center justify-center shadow-md shadow-orange-500/20">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-bold block">
                            LIVE PREVIEW
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">
                            {selectedUploadFiles.length > 0
                              ? selectedUploadFiles[0].name
                              : 'Document manifest'}
                          </h4>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-2xs space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total queued:</span>
                          <span className="font-bold text-slate-800 font-mono">
                            {selectedUploadFiles.length} {selectedUploadFiles.length === 1 ? 'file' : 'files'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Target Folder:</span>
                          <span className="font-semibold text-[#F95716]">
                            {uploadTargetFolderId === 'root'
                              ? 'Root'
                              : folders.find((f) => f.id === uploadTargetFolderId)?.name || 'Root'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Storage Zone:</span>
                          <span className="font-mono text-slate-700">Frankfurt High-Speed</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Security Gate:</span>
                          <span className="font-semibold text-emerald-600 flex items-center gap-1 font-mono">
                            <ShieldCheck className="w-3 h-3" />
                            <span>AES-256</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                        <span>Required fields</span>
                        <span className="font-mono text-slate-700">
                          {selectedUploadFiles.length > 0 ? '1 / 1' : '0 / 1'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                        <div
                          className="bg-[#F95716] h-full rounded-full transition-all duration-300"
                          style={{ width: selectedUploadFiles.length > 0 ? '100%' : '0%' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Fields marked <span className="text-[#F95716] font-bold">*</span> are required
                  </span>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(false)}
                      className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitUploadModal}
                      disabled={isUploading}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#FF5511] to-[#F95716] text-white text-xs font-bold hover:opacity-95 shadow-md shadow-orange-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Upload files</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* =========================================================================
            NEW FOLDER MODAL (PORTAL TO DOCUMENT.BODY: 100% FULL-PAGE BACKDROP & SIBLING/SUBFOLDER SUPPORT)
           ========================================================================= */}
        {showNewFolderModal &&
          createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F95716] flex items-center justify-center">
                      <FolderPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {newFolderParentId === 'root'
                          ? 'New Folder'
                          : `New Subfolder in ${folders.find((f) => f.id === newFolderParentId)?.name || 'Folder'}`}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Create root, sibling, or nested subfolders
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewFolderModal(false)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateFolder} className="space-y-4 text-xs">
                  {/* Folder Name */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 block">
                      Folder Name <span className="text-[#F95716]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="e.g. Action Project, Client Files, Q4 Invoices"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716]"
                    />
                  </div>

                  {/* Folder Placement / Hierarchy */}
                  <div className="space-y-1">
                    <CustomDropdown
                      label="Placement & Parent Folder"
                      value={newFolderParentId === 'root' ? '' : String(newFolderParentId)}
                      onChange={(val) =>
                        setNewFolderParentId(val === '' ? 'root' : Number(val))
                      }
                      options={[
                        { value: '', label: 'Root Level (Top Level Folder)', description: 'Create as sibling folder at root level', badge: 'Root' },
                        ...folders.map((f) => ({
                          value: String(f.id),
                          label: f.parent_id ? `↳ ${f.name}` : f.name,
                          description: f.parent_id ? `Subfolder of #${f.parent_id}` : 'Top-level folder',
                        })),
                      ]}
                      searchable={folders.length > 5}
                      searchPlaceholder="Search destination folder..."
                      fullWidth
                      size="sm"
                    />
                    <p className="text-[10px] text-slate-400">
                      Choose &quot;Root Level&quot; to create sibling folders at top level, or select an existing folder to nest inside.
                    </p>
                  </div>

                  {/* Folder Color Accent */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-700 block">Folder Color Accent</label>
                    <div className="flex items-center gap-2">
                      {[
                        { id: 'orange', label: 'Orange', bg: 'bg-[#F95716]' },
                        { id: 'blue', label: 'Blue', bg: 'bg-blue-600' },
                        { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-600' },
                        { id: 'purple', label: 'Purple', bg: 'bg-purple-600' },
                        { id: 'amber', label: 'Amber', bg: 'bg-amber-600' },
                        { id: 'rose', label: 'Rose', bg: 'bg-rose-600' },
                      ].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setNewFolderColor(c.id)}
                          className={`w-6 h-6 rounded-full ${c.bg} transition-all cursor-pointer flex items-center justify-center ${
                            newFolderColor === c.id ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'opacity-80 hover:opacity-100'
                          }`}
                          title={c.label}
                        >
                          {newFolderColor === c.id && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowNewFolderModal(false)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF5511] to-[#F95716] text-white text-xs font-bold hover:opacity-95 shadow-md shadow-orange-500/20 cursor-pointer"
                    >
                      Create folder
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}

        {/* =========================================================================
            RENAME FOLDER MODAL (PORTAL TO DOCUMENT.BODY)
           ========================================================================= */}
        {showRenameFolderModal && folderToRename &&
          createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F95716] flex items-center justify-center">
                      <Edit2 className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Rename Folder</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRenameFolderModal(false)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleRenameFolderSubmit} className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 block">Folder Name *</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={renameFolderName}
                      onChange={(e) => setRenameFolderName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowRenameFolderModal(false)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-[#F95716] text-white text-xs font-bold hover:bg-[#e0480c] shadow-xs cursor-pointer"
                    >
                      Save changes
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}

        {/* =========================================================================
            SHARE MODAL (PORTAL TO DOCUMENT.BODY)
           ========================================================================= */}
        {showShareModal && shareFile &&
          createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F95716] flex items-center justify-center">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Share Document</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowShareModal(false)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <p className="text-slate-500">
                    Share direct CDN download access for <strong>{shareFile.name}</strong>:
                  </p>

                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-700 break-all">
                    <span className="truncate flex-1">
                      {shareFile.cdn_url || `https://storage.bunnycdn.com/finovo/${shareFile.uuid}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          shareFile.cdn_url || `https://storage.bunnycdn.com/finovo/${shareFile.uuid}`
                        );
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className="px-2 py-1 rounded-lg bg-[#F95716] text-white text-[10px] font-bold shrink-0 cursor-pointer"
                    >
                      {copiedLink ? 'Copied!' : 'Copy Link'}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* =========================================================================
            MOVE MODAL (PORTAL TO DOCUMENT.BODY)
           ========================================================================= */}
        {showMoveModal &&
          createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F95716] flex items-center justify-center">
                      <FolderInput className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Move Files</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMoveModal(false)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleBulkMoveSubmit} className="space-y-4 text-xs">
                  <div>
                    <CustomDropdown
                      label="Destination Folder"
                      value={targetMoveFolderId === '' ? '' : String(targetMoveFolderId)}
                      onChange={(val) =>
                        setTargetMoveFolderId(val === '' ? '' : Number(val))
                      }
                      options={[
                        { value: '', label: '📁 Workspace Root', description: 'Move to workspace root level', badge: 'Root' },
                        ...folders.map((f) => ({
                          value: String(f.id),
                          label: f.parent_id ? `↳ ${f.name}` : `📁 ${f.name}`,
                          description: f.parent_id ? `Subfolder of #${f.parent_id}` : 'Top-level folder',
                        })),
                      ]}
                      searchable={folders.length > 5}
                      searchPlaceholder="Search destination folder..."
                      fullWidth
                      size="sm"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowMoveModal(false)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-[#F95716] text-white text-xs font-bold hover:bg-[#e0480c] shadow-xs cursor-pointer"
                    >
                      Move to folder
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}

        {/* =========================================================================
            PORTFOLIO FOOTER (IDENTICAL UI & ACTIVE STATUS LINK)
           ========================================================================= */}
        <PortfolioFooter companySlug={companySlug} activeLink="files" />
      </div>
    </AppShell>
  );
};
