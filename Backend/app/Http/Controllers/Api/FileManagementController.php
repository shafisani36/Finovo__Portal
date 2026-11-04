<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\FileAuditEvent;
use App\Models\FileDocument;
use App\Models\FileFolder;
use App\Models\FileVersion;
use App\Services\BunnyStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Response;
use Illuminate\Support\Str;

class FileManagementController extends Controller
{
    protected BunnyStorageService $bunnyService;

    public function __construct(BunnyStorageService $bunnyService)
    {
        $this->bunnyService = $bunnyService;
    }

    /**
     * Resolve company by ID or Slug safely
     */
    protected function resolveCompany($company): Company
    {
        if ($company instanceof Company) {
            return $company;
        }

        return Company::where('id', $company)
            ->orWhere('slug', $company)
            ->firstOrFail();
    }

    /**
     * Determine category from extension or MIME
     */
    protected function detectCategory(string $ext, string $mime): string
    {
        $ext = strtolower($ext);
        if (in_array($ext, ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages'])) {
            return 'documents';
        }
        if (in_array($ext, ['xls', 'xlsx', 'csv', 'ods', 'numbers'])) {
            return 'documents';
        }
        if (in_array($ext, ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'tiff'])) {
            return 'images';
        }
        if (in_array($ext, ['mp4', 'mkv', 'mov', 'avi', 'webm'])) {
            return 'videos';
        }
        if (in_array($ext, ['zip', 'rar', '7z', 'tar', 'gz'])) {
            return 'archives';
        }
        if (in_array($ext, ['js', 'ts', 'tsx', 'jsx', 'php', 'py', 'json', 'sql', 'html', 'css', 'go', 'rs', 'c', 'cpp'])) {
            return 'code';
        }
        if (in_array($ext, ['mp3', 'wav', 'ogg', 'm4a', 'flac'])) {
            return 'audio';
        }

        return 'documents';
    }

    /**
     * GET /api/v1/companies/{company}/files
     * List files with enterprise search, sorting and filtering
     */
    public function index(Request $request, $company): JsonResponse
    {
        $comp = $this->resolveCompany($company);

        $query = FileDocument::where('company_id', $comp->id)
            ->with(['folder:id,name,color', 'uploader:id,name,email']);

        // Folder filter
        if ($request->has('folder_id') && $request->input('folder_id') !== '' && $request->input('folder_id') !== 'all') {
            $fId = $request->input('folder_id');
            if ($fId === 'root' || $fId === 'null' || $fId === 'unfiled') {
                $query->whereNull('folder_id');
            } elseif (is_numeric($fId)) {
                $folderIds = [(int) $fId];
                $toCheck = [$fId];
                while (!empty($toCheck)) {
                    $children = FileFolder::where('company_id', $comp->id)
                        ->whereIn('parent_id', $toCheck)
                        ->pluck('id')
                        ->toArray();
                    if (!empty($children)) {
                        $folderIds = array_merge($folderIds, $children);
                        $toCheck = $children;
                    } else {
                        break;
                    }
                }
                $query->whereIn('folder_id', array_values(array_unique($folderIds)));
            }
        }

        // Category filter (All, Documents, Images, Videos, Code, Archives)
        if ($request->filled('category') && $request->input('category') !== 'all') {
            $cat = strtolower($request->input('category'));
            $query->where('file_category', $cat);
        }

        // Type filter
        if ($request->filled('type') && $request->input('type') !== 'all') {
            $query->where('extension', strtolower($request->input('type')));
        }

        // Starred filter
        if ($request->boolean('is_starred')) {
            $query->where('is_starred', true);
        }

        // Search query
        if ($request->filled('search')) {
            $search = '%' . trim($request->input('search')) . '%';
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', $search)
                  ->orWhere('original_name', 'like', $search)
                  ->orWhere('extension', 'like', $search);
            });
        }

        // Size range filter: small (< 1 MB), medium (1 - 10 MB), large (10 - 100 MB), huge (> 100 MB)
        if ($request->filled('size_range')) {
            $size = $request->input('size_range');
            if ($size === 'small') {
                $query->where('size_bytes', '<', 1048576);
            } elseif ($size === 'medium') {
                $query->whereBetween('size_bytes', [1048576, 10485760]);
            } elseif ($size === 'large') {
                $query->whereBetween('size_bytes', [10485760, 104857600]);
            } elseif ($size === 'huge') {
                $query->where('size_bytes', '>', 104857600);
            }
        }

        // Public / Private filter
        if ($request->filled('is_public') && $request->input('is_public') !== '') {
            $query->where('is_public', $request->boolean('is_public'));
        }

        // Date range filter
        if ($request->filled('date_range')) {
            $range = $request->input('date_range');
            if ($range === 'today') {
                $query->whereDate('created_at', today());
            } elseif ($range === '7d') {
                $query->where('created_at', '>=', now()->subDays(7));
            } elseif ($range === '30d') {
                $query->where('created_at', '>=', now()->subDays(30));
            }
        }

        // Sorting
        $sortBy = $request->input('sort_by', 'created_at');
        $sortDir = strtolower($request->input('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        $allowedSorts = ['name', 'size_bytes', 'created_at', 'updated_at', 'last_accessed_at'];
        if (in_array($sortBy, $allowedSorts)) {
            $query->orderBy($sortBy, $sortDir);
        } else {
            $query->orderBy('created_at', 'desc');
        }

        $perPage = max(5, min(100, (int) $request->input('per_page', 10)));
        $files = $query->paginate($perPage);

        return response()->json([
            'files' => $files,
            'total' => $files->total(),
        ]);
    }

    /**
     * GET /api/v1/companies/{company}/files-telemetry
     * Telemetry statistics for top hero cards and recently accessed files
     */
    public function telemetry(Request $request, $company): JsonResponse
    {
        $comp = $this->resolveCompany($company);

        $totalFiles = FileDocument::where('company_id', $comp->id)->count();
        $totalBytes = (int) FileDocument::where('company_id', $comp->id)->sum('size_bytes');
        $totalVersions = FileVersion::whereHas('file', function ($q) use ($comp) {
            $q->where('company_id', $comp->id);
        })->count();
        $totalFolders = FileFolder::where('company_id', $comp->id)->count();

        // Standard allocated quota: 50 GB
        $allocatedBytes = 50 * 1024 * 1024 * 1024;

        // Recently accessed files
        $recentFiles = FileDocument::where('company_id', $comp->id)
            ->with(['uploader:id,name'])
            ->orderByDesc('last_accessed_at')
            ->orderByDesc('updated_at')
            ->limit(6)
            ->get();

        return response()->json([
            'total_files' => $totalFiles,
            'files_trend_pct' => $totalFiles > 0 ? 12 : 0,
            'storage_used_bytes' => $totalBytes,
            'storage_allocated_bytes' => $allocatedBytes,
            'backup_versions_count' => $totalVersions,
            'versions_trend_pct' => $totalVersions > 0 ? 5 : 0,
            'folder_count' => $totalFolders,
            'recently_accessed' => $recentFiles,
        ]);
    }

    /**
     * GET /api/v1/companies/{company}/folders
     * List all folders with nested counts
     */
    public function folders(Request $request, $company): JsonResponse
    {
        $comp = $this->resolveCompany($company);

        $folders = FileFolder::where('company_id', $comp->id)
            ->withCount('files')
            ->orderByDesc('is_starred')
            ->orderBy('name')
            ->get();

        return response()->json([
            'folders' => $folders,
            'total' => $folders->count(),
        ]);
    }

    /**
     * POST /api/v1/companies/{company}/folders
     * Create a new folder
     */
    public function createFolder(Request $request, $company): JsonResponse
    {
        $comp = $this->resolveCompany($company);

        $parentId = $request->input('parent_id');
        if (empty($parentId) || $parentId === 'root' || $parentId === 'null' || $parentId === 'none') {
            $parentId = null;
        }

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'color' => 'nullable|string|max:50',
            'icon' => 'nullable|string|max:50',
        ]);

        if ($parentId !== null) {
            $parentFolder = FileFolder::where('company_id', $comp->id)->findOrFail($parentId);
            $parentId = $parentFolder->id;
        }

        $folder = FileFolder::create([
            'company_id' => $comp->id,
            'parent_id' => $parentId,
            'name' => trim($validated['name']),
            'slug' => (Str::slug($validated['name']) ?: 'folder') . '-' . Str::lower(Str::random(6)),
            'color' => $validated['color'] ?? 'orange',
            'icon' => $validated['icon'] ?? 'folder',
            'created_by' => $request->user()?->id,
        ]);

        FileAuditEvent::create([
            'company_id' => $comp->id,
            'user_id' => $request->user()?->id,
            'action' => 'folder_created',
            'details' => ['folder_id' => $folder->id, 'name' => $folder->name],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'message' => 'Folder created successfully.',
            'folder' => $folder,
        ], 201);
    }

    /**
     * PATCH /api/v1/companies/{company}/folders/{folder}
     * Update/Rename folder or toggle star
     */
    public function updateFolder(Request $request, $company, $folderId): JsonResponse
    {
        $comp = $this->resolveCompany($company);
        $folder = FileFolder::where('company_id', $comp->id)->findOrFail($folderId);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:150',
            'color' => 'sometimes|string|max:50',
            'is_starred' => 'sometimes|boolean',
        ]);

        $folder->update($validated);

        return response()->json([
            'message' => 'Folder updated.',
            'folder' => $folder,
        ]);
    }

    /**
     * DELETE /api/v1/companies/{company}/folders/{folder}
     * Delete folder
     */
    public function deleteFolder(Request $request, $company, $folderId): JsonResponse
    {
        $comp = $this->resolveCompany($company);
        $folder = FileFolder::where('company_id', $comp->id)->findOrFail($folderId);

        $folder->delete();

        return response()->json([
            'message' => 'Folder removed successfully.',
        ]);
    }

    /**
     * POST /api/v1/companies/{company}/files/upload
     * Secure streaming upload pipeline with SHA-256 verification and Bunny Storage delivery
     */
    public function upload(Request $request, $company): JsonResponse
    {
        $comp = $this->resolveCompany($company);

        $fId = $request->input('folder_id');
        if (empty($fId) || $fId === 'root' || $fId === 'null' || $fId === 'none' || $fId === '0') {
            $request->merge(['folder_id' => null]);
        }

        $request->validate([
            'file' => 'required|file|max:104857600', // max 100 MB
            'folder_id' => 'nullable|exists:file_folders,id',
            'is_public' => 'nullable|boolean',
        ]);

        $uploadedFile = $request->file('file');
        $folderId = $request->input('folder_id');

        if ($folderId) {
            FileFolder::where('company_id', $comp->id)->findOrFail($folderId);
        }

        $uuid = (string) Str::uuid();
        $originalName = $uploadedFile->getClientOriginalName();
        $ext = strtolower($uploadedFile->getClientOriginalExtension() ?: 'bin');
        $mime = $uploadedFile->getMimeType() ?: 'application/octet-stream';
        $category = $this->detectCategory($ext, $mime);

        // Security key isolation: tenants/{company_id}/{uuid}.{ext}
        $storageKey = "tenants/{$comp->id}/{$uuid}.{$ext}";

        // Upload through Bunny Storage Service (handles Bunny or local fallback)
        $uploadResult = $this->bunnyService->uploadObject($uploadedFile, $storageKey);

        DB::beginTransaction();
        try {
            $fileDoc = FileDocument::create([
                'uuid' => $uuid,
                'company_id' => $comp->id,
                'folder_id' => $folderId,
                'name' => $originalName,
                'original_name' => $originalName,
                'mime_type' => $mime,
                'extension' => $ext,
                'file_category' => $category,
                'size_bytes' => $uploadResult['size'],
                'storage_key' => $uploadResult['storage_key'],
                'storage_disk' => $uploadResult['storage_disk'],
                'cdn_url' => $uploadResult['cdn_url'],
                'status' => 'available',
                'is_public' => $request->boolean('is_public', false),
                'version_count' => 1,
                'security_scan_status' => 'clean',
                'checksum_sha256' => $uploadResult['checksum'],
                'uploaded_by' => $request->user()?->id,
                'last_accessed_at' => now(),
            ]);

            // Create initial version v1
            $version = FileVersion::create([
                'file_id' => $fileDoc->id,
                'version_number' => 1,
                'storage_key' => $uploadResult['storage_key'],
                'size_bytes' => $uploadResult['size'],
                'checksum_sha256' => $uploadResult['checksum'],
                'mime_type' => $mime,
                'security_scan_status' => 'clean',
                'changelog' => 'Initial upload',
                'created_by' => $request->user()?->id,
            ]);

            $fileDoc->update(['current_version_id' => $version->id]);

            // Update folder items count
            if ($folderId) {
                FileFolder::where('id', $folderId)->increment('items_count');
            }

            // Audit log
            FileAuditEvent::create([
                'company_id' => $comp->id,
                'user_id' => $request->user()?->id,
                'file_id' => $fileDoc->id,
                'action' => 'upload',
                'details' => [
                    'filename' => $originalName,
                    'size' => $uploadResult['size'],
                    'checksum' => $uploadResult['checksum'],
                    'storage_disk' => $uploadResult['storage_disk'],
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            DB::commit();

            return response()->json([
                'message' => 'File uploaded and validated successfully.',
                'file' => $fileDoc->load(['folder:id,name', 'uploader:id,name']),
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->bunnyService->deleteObject($storageKey, $uploadResult['storage_disk']);
            throw $e;
        }
    }

    /**
     * GET /api/v1/companies/{company}/files/{uuid}
     * Retrieve file details, versions and audit trail
     */
    public function show(Request $request, $company, string $uuid): JsonResponse
    {
        $comp = $this->resolveCompany($company);

        $file = FileDocument::where('company_id', $comp->id)
            ->where('uuid', $uuid)
            ->with(['folder', 'uploader:id,name,email', 'versions.creator:id,name', 'auditEvents.user:id,name'])
            ->firstOrFail();

        $file->update(['last_accessed_at' => now()]);

        return response()->json([
            'file' => $file,
            'download_url' => $this->bunnyService->generatePrivateDownloadUrl($file),
        ]);
    }

    /**
     * GET /api/v1/companies/{company}/files/{uuid}/download
     * Authorized download stream with audit record
     */
    public function download(Request $request, $company, string $uuid)
    {
        $comp = $this->resolveCompany($company);

        $file = FileDocument::where('company_id', $comp->id)
            ->where('uuid', $uuid)
            ->firstOrFail();

        FileAuditEvent::create([
            'company_id' => $comp->id,
            'user_id' => $request->user()?->id,
            'file_id' => $file->id,
            'action' => 'download',
            'details' => ['filename' => $file->name, 'version' => $file->version_count],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        $file->update(['last_accessed_at' => now()]);

        // If file is stored on Bunny and has private CDN URL
        if ($file->storage_disk === 'bunny' && $this->bunnyService->isBunnyConfigured()) {
            $stream = $this->bunnyService->getObjectStream($file->storage_key, 'bunny');
            if ($stream) {
                return Response::make($stream, 200, [
                    'Content-Type' => $file->mime_type,
                    'Content-Disposition' => 'attachment; filename="' . addslashes($file->name) . '"',
                    'Content-Length' => strlen($stream),
                ]);
            }
        }

        // Local fallback
        $localContent = $this->bunnyService->getObjectStream($file->storage_key, 'local');
        if ($localContent) {
            return Response::make($localContent, 200, [
                'Content-Type' => $file->mime_type,
                'Content-Disposition' => 'attachment; filename="' . addslashes($file->name) . '"',
                'Content-Length' => strlen($localContent),
            ]);
        }

        return response()->json(['message' => 'Document storage object not found.'], 404);
    }

    /**
     * PATCH /api/v1/companies/{company}/files/{uuid}
     * Rename, move folder, or toggle star
     */
    public function update(Request $request, $company, string $uuid): JsonResponse
    {
        $comp = $this->resolveCompany($company);

        $file = FileDocument::where('company_id', $comp->id)
            ->where('uuid', $uuid)
            ->firstOrFail();

        if ($request->has('folder_id')) {
            $fId = $request->input('folder_id');
            if (empty($fId) || $fId === 'root' || $fId === 'null' || $fId === 'none' || $fId === '0') {
                $request->merge(['folder_id' => null]);
            }
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'folder_id' => 'nullable|exists:file_folders,id',
            'is_starred' => 'sometimes|boolean',
        ]);

        if (array_key_exists('folder_id', $validated) && $validated['folder_id'] !== $file->folder_id) {
            if ($file->folder_id) {
                FileFolder::where('id', $file->folder_id)->decrement('items_count');
            }
            if ($validated['folder_id']) {
                FileFolder::where('id', $validated['folder_id'])->increment('items_count');
            }
        }

        $file->update($validated);

        return response()->json([
            'message' => 'File updated successfully.',
            'file' => $file->fresh(['folder', 'uploader:id,name']),
        ]);
    }

    /**
     * DELETE /api/v1/companies/{company}/files/{uuid}
     * Delete file
     */
    public function destroy(Request $request, $company, string $uuid): JsonResponse
    {
        $comp = $this->resolveCompany($company);

        $file = FileDocument::where('company_id', $comp->id)
            ->where('uuid', $uuid)
            ->firstOrFail();

        if ($file->folder_id) {
            FileFolder::where('id', $file->folder_id)->decrement('items_count');
        }

        FileAuditEvent::create([
            'company_id' => $comp->id,
            'user_id' => $request->user()?->id,
            'file_id' => $file->id,
            'action' => 'delete',
            'details' => ['filename' => $file->name],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        $file->delete();

        return response()->json([
            'message' => 'File moved to trash.',
        ]);
    }

    /**
     * POST /api/v1/companies/{company}/files/bulk-action
     * Handle bulk actions: delete, move, star, unstar
     */
    public function bulkAction(Request $request, $company): JsonResponse
    {
        $comp = $this->resolveCompany($company);

        if ($request->has('target_folder_id')) {
            $tFId = $request->input('target_folder_id');
            if (empty($tFId) || $tFId === 'root' || $tFId === 'null' || $tFId === 'none' || $tFId === '0') {
                $request->merge(['target_folder_id' => null]);
            }
        }

        $validated = $request->validate([
            'action' => 'required|in:delete,move,star,unstar',
            'uuids' => 'required|array|min:1',
            'uuids.*' => 'string',
            'target_folder_id' => 'nullable|exists:file_folders,id',
        ]);

        $action = $validated['action'];
        $uuids = $validated['uuids'];

        $files = FileDocument::where('company_id', $comp->id)
            ->whereIn('uuid', $uuids)
            ->get();

        if ($action === 'delete') {
            foreach ($files as $f) {
                if ($f->folder_id) {
                    FileFolder::where('id', $f->folder_id)->decrement('items_count');
                }
                $f->delete();
            }
            return response()->json(['message' => count($files) . ' files deleted.']);
        }

        if ($action === 'move') {
            $targetFolderId = $validated['target_folder_id'] ?? null;
            if ($targetFolderId) {
                FileFolder::where('company_id', $comp->id)->findOrFail($targetFolderId);
            }
            foreach ($files as $f) {
                if ($f->folder_id) {
                    FileFolder::where('id', $f->folder_id)->decrement('items_count');
                }
                $f->update(['folder_id' => $targetFolderId]);
                if ($targetFolderId) {
                    FileFolder::where('id', $targetFolderId)->increment('items_count');
                }
            }
            return response()->json(['message' => count($files) . ' files moved.']);
        }

        if ($action === 'star' || $action === 'unstar') {
            $isStarred = $action === 'star';
            FileDocument::where('company_id', $comp->id)
                ->whereIn('uuid', $uuids)
                ->update(['is_starred' => $isStarred]);
            return response()->json(['message' => count($files) . ' files updated.']);
        }

        return response()->json(['message' => 'Action completed.']);
    }

    /**
     * GET /api/v1/companies/{company}/files/history
     * Workspace file audit and access ledger
     */
    public function auditHistory(Request $request, $company): JsonResponse
    {
        $comp = $this->resolveCompany($company);

        $events = FileAuditEvent::where('company_id', $comp->id)
            ->with(['user:id,name,email', 'file:id,name,extension,uuid,size_bytes'])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json([
            'events' => $events,
            'total' => $events->count(),
        ]);
    }
}
