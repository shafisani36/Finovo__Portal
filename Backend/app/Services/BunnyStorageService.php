<?php

namespace App\Services;

use App\Models\FileDocument;
use App\Models\FileVersion;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class BunnyStorageService
{
    protected string $storageZone;
    protected string $apiKey;
    protected string $region;
    protected string $pullZoneUrl;
    protected string $securityTokenKey;
    protected string $endpoint;

    public function __construct()
    {
        $this->storageZone = (string) (config('services.bunny.storage_zone') ?: env('BUNNY_STORAGE_ZONE', 'finovoglobal'));
        $this->apiKey = (string) (config('services.bunny.api_key') ?: env('BUNNY_STORAGE_API_KEY', ''));
        $this->region = (string) (config('services.bunny.region') ?: env('BUNNY_STORAGE_REGION', 'de'));
        $this->pullZoneUrl = rtrim((string) (config('services.bunny.pull_zone_url') ?: env('BUNNY_PULL_ZONE_URL', 'https://finovoglobal.b-cdn.net')), '/');
        $this->securityTokenKey = (string) (config('services.bunny.token_key') ?: env('BUNNY_SECURITY_TOKEN_KEY', ''));

        // Region endpoints: de -> storage.bunnycdn.com, ny -> ny.storage.bunnycdn.com, la -> la.storage.bunnycdn.com, sg -> sg.storage.bunnycdn.com
        $configuredEndpoint = config('services.bunny.endpoint', env('BUNNY_STORAGE_ENDPOINT'));
        if (!empty($configuredEndpoint)) {
            $this->endpoint = rtrim($configuredEndpoint, '/');
        } elseif (in_array(strtolower($this->region), ['de', 'frankfurt', ''])) {
            $this->endpoint = 'https://storage.bunnycdn.com';
        } else {
            $this->endpoint = "https://{$this->region}.storage.bunnycdn.com";
        }
    }

    /**
     * Check if Bunny Storage is configured with an active API key
     */
    public function isBunnyConfigured(): bool
    {
        return !empty($this->apiKey) && !empty($this->storageZone);
    }

    /**
     * Upload an object securely to Bunny Storage (or local fallback disk)
     *
     * @param UploadedFile|string $file
     * @param string $storageKey Path inside storage zone
     * @return array [success => bool, checksum => string, size => int, storage_disk => string, url => ?string]
     */
    public function uploadObject($file, string $storageKey): array
    {
        // 1. Calculate SHA-256 and byte size
        if ($file instanceof UploadedFile) {
            $checksum = hash_file('sha256', $file->getRealPath());
            $size = $file->getSize();
            $stream = fopen($file->getRealPath(), 'r');
        } elseif (is_resource($file)) {
            $stream = $file;
            $meta = stream_get_meta_data($stream);
            $checksum = isset($meta['uri']) && file_exists($meta['uri']) ? hash_file('sha256', $meta['uri']) : hash('sha256', (string) stream_get_contents($stream));
            fseek($stream, 0);
            $size = fstat($stream)['size'] ?? 0;
        } else {
            $checksum = hash('sha256', $file);
            $size = strlen($file);
            $stream = fopen('php://temp', 'r+');
            fwrite($stream, $file);
            rewind($stream);
        }

        // 2. If Bunny is configured, upload via HTTP PUT streaming
        if ($this->isBunnyConfigured()) {
            try {
                $url = "{$this->endpoint}/{$this->storageZone}/" . ltrim($storageKey, '/');
                $response = Http::withHeaders([
                    'AccessKey' => $this->apiKey,
                    'Content-Type' => 'application/octet-stream',
                ])->withBody(stream_get_contents($stream), 'application/octet-stream')
                  ->put($url);

                if (is_resource($stream)) {
                    fclose($stream);
                }

                if ($response->successful()) {
                    return [
                        'success' => true,
                        'checksum' => $checksum,
                        'size' => $size,
                        'storage_disk' => 'bunny',
                        'storage_key' => $storageKey,
                        'cdn_url' => "{$this->pullZoneUrl}/" . ltrim($storageKey, '/'),
                    ];
                }

                Log::warning('Bunny.net upload returned error status: ' . $response->status() . ' - falling back to local storage.');
            } catch (\Throwable $e) {
                Log::error('Bunny.net upload exception: ' . $e->getMessage() . ' - falling back to local storage.');
            }
        }

        // 3. Fallback: Local isolated disk storage
        if ($file instanceof UploadedFile) {
            Storage::disk('local')->putFileAs('file_store', $file, basename($storageKey));
        } else {
            Storage::disk('local')->put('file_store/' . basename($storageKey), $file);
        }

        return [
            'success' => true,
            'checksum' => $checksum,
            'size' => $size,
            'storage_disk' => 'local',
            'storage_key' => 'file_store/' . basename($storageKey),
            'cdn_url' => null,
        ];
    }

    /**
     * Download or retrieve an object stream
     */
    public function getObjectStream(string $storageKey, string $storageDisk = 'bunny')
    {
        if ($storageDisk === 'bunny' && $this->isBunnyConfigured()) {
            $url = "{$this->endpoint}/{$this->storageZone}/" . ltrim($storageKey, '/');
            $response = Http::withHeaders([
                'AccessKey' => $this->apiKey,
            ])->get($url);

            if ($response->successful()) {
                return $response->body();
            }
        }

        // Local storage retrieval
        if (Storage::disk('local')->exists($storageKey)) {
            return Storage::disk('local')->get($storageKey);
        }

        if (Storage::disk('public')->exists($storageKey)) {
            return Storage::disk('public')->get($storageKey);
        }

        $publicScreenshotKey = 'screenshots/' . basename($storageKey);
        if (Storage::disk('public')->exists($publicScreenshotKey)) {
            return Storage::disk('public')->get($publicScreenshotKey);
        }

        return null;
    }

    /**
     * Generate an authorized short-lived time-limited signed URL for private delivery
     */
    public function generatePrivateDownloadUrl(FileDocument $file, int $ttlSeconds = 3600): string
    {
        // If file is explicitly public and has CDN URL, return public URL
        if ($file->is_public && $file->cdn_url) {
            return $file->cdn_url;
        }

        // If Bunny token signing is configured
        if ($this->isBunnyConfigured() && !empty($this->securityTokenKey)) {
            $expires = time() + $ttlSeconds;
            $path = '/' . ltrim($file->storage_key, '/');
            // Standard Bunny URL token hash algorithm: md5(tokenKey + path + expires)
            $token = md5($this->securityTokenKey . $path . $expires);
            return "{$this->pullZoneUrl}{$path}?token={$token}&expires={$expires}";
        }

        // Secure internal authorization route
        return url("/api/v1/companies/{$file->company->slug}/files/{$file->uuid}/download");
    }

    /**
     * Delete an object from Bunny Storage
     */
    public function deleteObject(string $storageKey, string $storageDisk = 'bunny'): bool
    {
        if ($storageDisk === 'bunny' && $this->isBunnyConfigured()) {
            try {
                $url = "{$this->endpoint}/{$this->storageZone}/" . ltrim($storageKey, '/');
                $res = Http::withHeaders(['AccessKey' => $this->apiKey])->delete($url);
                return $res->successful();
            } catch (\Throwable $e) {
                Log::error('Bunny storage delete failed: ' . $e->getMessage());
            }
        }

        if (Storage::disk('local')->exists($storageKey)) {
            return Storage::disk('local')->delete($storageKey);
        }

        return true;
    }
}
