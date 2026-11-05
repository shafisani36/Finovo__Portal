<?php

namespace App\Helpers;

use App\Models\AttendanceRecord;
use App\Models\FileDocument;
use App\Models\FileFolder;
use App\Models\FileVersion;
use App\Services\BunnyStorageService;
use Exception;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class StorageHelper
{
    /**
     * Store screenshot on Bunny Storage / BunnyCDN and register in FileDocument (Files & Docs storage),
     * falling back to local public disk seamlessly.
     *
     * @param string $filename
     * @param string $content
     * @param AttendanceRecord|null $record
     * @param int|null $adminId
     * @return string Final accessible URL
     */
    public static function storeScreenshot(
        string $filename,
        string $content,
        ?AttendanceRecord $record = null,
        ?int $adminId = null
    ): string {
        $storageKey = 'screenshots/' . $filename;
        $localPublicPath = 'screenshots/' . $filename;

        // 1. Always ensure local public copy is saved for immediate dev / intranet streaming
        try {
            Storage::disk('public')->put($localPublicPath, $content);
        } catch (Exception $e) {
            Log::warning('Local public disk screenshot write failed: ' . $e->getMessage());
        }

        // 2. Upload to Bunny Storage via BunnyStorageService
        $bunnyService = app(BunnyStorageService::class);
        $uploadResult = $bunnyService->uploadObject($content, $storageKey);

        // Determine accessible URL
        $finalUrl = '/storage/' . $localPublicPath;
        if (!empty($uploadResult['cdn_url'])) {
            $finalUrl = $uploadResult['cdn_url'];
        }

        // 3. If AttendanceRecord is available, create FileFolder & FileDocument entry so it shows in Bunny Storage & Files Portal
        if ($record && $record->company_id) {
            try {
                $validAdminId = ($adminId && \App\Models\User::where('id', $adminId)->exists()) ? $adminId : null;

                // Ensure "Screenshots" system folder exists for this company
                $folder = FileFolder::firstOrCreate(
                    [
                        'company_id' => $record->company_id,
                        'slug'       => 'screenshots',
                    ],
                    [
                        'name'        => 'Screenshots',
                        'color'       => '#f95716',
                        'icon'        => 'camera',
                        'is_system'   => true,
                        'is_starred'  => true,
                        'items_count' => 0,
                        'created_by'  => $validAdminId,
                    ]
                );

                $record->loadMissing(['membership.user']);
                $employeeName = $record->membership?->user?->name ?? 'Employee';
                $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION) ?: 'png');
                $mime = $ext === 'svg' ? 'image/svg+xml' : 'image/png';
                $timeFormatted = now()->format('Y-m-d H:i:s');
                $originalTitle = "Screen Capture - {$employeeName} ({$timeFormatted})";

                $fileDoc = FileDocument::create([
                    'uuid'                 => (string) Str::uuid(),
                    'company_id'           => $record->company_id,
                    'folder_id'            => $folder->id,
                    'name'                 => $filename,
                    'original_name'        => $originalTitle,
                    'mime_type'            => $mime,
                    'extension'            => $ext,
                    'file_category'        => 'screenshots',
                    'size_bytes'           => strlen($content),
                    'storage_key'          => $uploadResult['storage_key'] ?? $storageKey,
                    'storage_disk'         => $uploadResult['storage_disk'] ?? 'local',
                    'cdn_url'              => $uploadResult['cdn_url'] ?? null,
                    'status'               => 'available',
                    'is_starred'           => false,
                    'is_public'            => true,
                    'version_count'        => 1,
                    'security_scan_status' => 'clean',
                    'checksum_sha256'      => $uploadResult['checksum'] ?? hash('sha256', $content),
                    'metadata'             => [
                        'attendance_record_id' => $record->id,
                        'employee_name'        => $employeeName,
                        'employee_id'          => $record->membership?->user_id,
                        'captured_by'          => $validAdminId,
                        'captured_at'          => now()->toIso8601String(),
                        'local_url'            => '/storage/' . $localPublicPath,
                        'cdn_url'              => $uploadResult['cdn_url'] ?? null,
                    ],
                    'uploaded_by'          => $validAdminId,
                    'last_accessed_at'     => now(),
                ]);

                // Create initial file version v1
                $version = FileVersion::create([
                    'file_id'              => $fileDoc->id,
                    'version_number'       => 1,
                    'storage_key'          => $uploadResult['storage_key'] ?? $storageKey,
                    'size_bytes'           => strlen($content),
                    'checksum_sha256'      => $uploadResult['checksum'] ?? hash('sha256', $content),
                    'mime_type'            => $mime,
                    'security_scan_status' => 'clean',
                    'changelog'            => 'Automatic employee screen capture snapshot',
                    'created_by'           => $validAdminId,
                ]);

                $fileDoc->update(['current_version_id' => $version->id]);
                $folder->increment('items_count');
            } catch (Exception $e) {
                Log::error('Failed to register screenshot in FileDocument: ' . $e->getMessage());
            }
        }

        return $finalUrl;
    }
}
