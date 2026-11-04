import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  BarChart3,
  MessageSquare,
  Folder,
  CheckSquare,
  FileText,
  Users,
  LayoutGrid,
  Shield,
  Clock,
  CalendarDays,
  Zap,
  TrendingUp,
  Settings,
  FileSpreadsheet,
  Plus,
  LogOut,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: 'Pages' | 'Actions' | 'Projects';
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { companySlug } = useParams<{ companySlug: string }>();
  const { logout } = useAuth();
  const slug = companySlug || 'default';

  const commands: CommandItem[] = [
    // Pages
    {
      id: 'dashboard',
      title: 'Workspace Dashboard',
      category: 'Pages',
      icon: <LayoutDashboard className="w-4 h-4 text-[#f95716]" />,
      shortcut: 'G D',
      action: () => navigate(`/app/${slug}/overview`),
    },
    {
      id: 'analytics',
      title: 'Activity & Analytics',
      category: 'Pages',
      icon: <BarChart3 className="w-4 h-4 text-blue-500" />,
      shortcut: 'G A',
      action: () => navigate(`/app/${slug}/monitoring`),
    },
    {
      id: 'messages',
      title: 'Messages & Collaboration',
      category: 'Pages',
      icon: <MessageSquare className="w-4 h-4 text-emerald-500" />,
      shortcut: 'G M',
      action: () => navigate(`/app/${slug}/collaboration`),
    },
    {
      id: 'projects',
      title: 'Projects Portfolio',
      category: 'Pages',
      icon: <Folder className="w-4 h-4 text-amber-500" />,
      shortcut: 'G P',
      action: () => navigate(`/app/${slug}/projects`),
    },
    {
      id: 'tasks',
      title: 'Task Management',
      category: 'Pages',
      icon: <CheckSquare className="w-4 h-4 text-purple-500" />,
      shortcut: 'G T',
      action: () => navigate(`/app/${slug}/tasks`),
    },
    {
      id: 'employees',
      title: 'Employee Directory',
      category: 'Pages',
      icon: <Users className="w-4 h-4 text-indigo-500" />,
      action: () => navigate(`/app/${slug}/employees`),
    },
    {
      id: 'departments',
      title: 'Departments & Squads',
      category: 'Pages',
      icon: <LayoutGrid className="w-4 h-4 text-teal-500" />,
      action: () => navigate(`/app/${slug}/departments`),
    },
    {
      id: 'roles',
      title: 'Roles & RBAC Governance',
      category: 'Pages',
      icon: <Shield className="w-4 h-4 text-purple-600" />,
      action: () => navigate(`/app/${slug}/roles`),
    },
    {
      id: 'time',
      title: 'Time & Attendance Tracking',
      category: 'Pages',
      icon: <Clock className="w-4 h-4 text-orange-500" />,
      action: () => navigate(`/app/${slug}/attendance`),
    },
    {
      id: 'live-tracker',
      title: 'Live Desktop Tracker',
      category: 'Pages',
      icon: <Zap className="w-4 h-4 text-amber-500" />,
      action: () => navigate(`/app/${slug}/time`),
    },
    {
      id: 'audit',
      title: 'System Audit Logs',
      category: 'Pages',
      icon: <FileSpreadsheet className="w-4 h-4 text-slate-500" />,
      action: () => navigate(`/app/${slug}/audit`),
    },
    {
      id: 'settings',
      title: 'Workspace Settings',
      category: 'Pages',
      icon: <Settings className="w-4 h-4 text-slate-600" />,
      action: () => navigate(`/app/${slug}/settings`),
    },

    // Actions
    {
      id: 'new-project',
      title: 'Create New Project',
      category: 'Actions',
      icon: <Plus className="w-4 h-4 text-[#f95716]" />,
      shortcut: 'C P',
      action: () => navigate(`/app/${slug}/projects`),
    },
    {
      id: 'add-employee',
      title: 'Onboard New Employee',
      category: 'Actions',
      icon: <Users className="w-4 h-4 text-blue-500" />,
      action: () => navigate(`/app/${slug}/employees`),
    },
    {
      id: 'logout',
      title: 'Sign Out of Finovo',
      category: 'Actions',
      icon: <LogOut className="w-4 h-4 text-rose-500" />,
      action: async () => {
        await logout();
        navigate('/login');
      },
    },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl bg-white rounded-3xl border border-slate-100 shadow-[0_24px_60px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.06)] overflow-hidden animate-in zoom-in-95 duration-150 font-['Inter',sans-serif]">
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, page, or search..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none font-medium"
          />
          <kbd className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold bg-white border border-slate-200 text-slate-400 shadow-2xs shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 custom-scrollbar space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching commands or pages found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-orange-500/10 text-slate-900 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0">{cmd.icon}</span>
                    <span className="truncate">{cmd.title}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {cmd.shortcut && (
                      <kbd className="px-1.5 py-0.5 rounded text-[9.5px] font-mono bg-white border border-slate-200 text-slate-400 shadow-2xs">
                        {cmd.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <ArrowRight className="w-3.5 h-3.5 text-[#f95716]" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.2 bg-white rounded border border-slate-200 text-[10px]">↑</kbd>
              <kbd className="px-1 py-0.2 bg-white rounded border border-slate-200 text-[10px] ml-0.5">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="px-1 py-0.2 bg-white rounded border border-slate-200 text-[10px]">↵</kbd> to select
            </span>
          </div>
          <span>Finovo Smart Search</span>
        </div>
      </div>
    </div>
  );
};
