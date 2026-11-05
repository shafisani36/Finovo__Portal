<?php

namespace App\Helpers;

use Illuminate\Support\Facades\Storage;
use Exception;

class StorageHelper
{
    /**
     * Store screenshot on BunnyCDN; fall back to local public disk on any error.
     */
    public static function storeScreenshot(string $filename, string $content): string
    {
        try {
            if (Storage::disk('bunnycdn')->put($filename, $content)) {
                return Storage::disk('bunnycdn')->url($filename);
            }
        } catch (Exception $e) {
            // ignore – fallback below
        }
        // fallback to public storage (storage/app/public)
        $localPath = 'screenshots/' . $filename;
        Storage::disk('public')->put($localPath, $content);
        return '/storage/' . $localPath;
    }
}
