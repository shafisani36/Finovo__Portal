<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Windows-safe public storage file server (serves screenshots and assets with full CORS without Windows is_readable/symlink limitations)
Route::get('/storage/{path}', function (string $path) {
    $fullPath = storage_path('app/public/' . $path);
    if (!file_exists($fullPath)) {
        abort(404, 'File not found');
    }
    $content = file_get_contents($fullPath);
    if ($content === false) {
        abort(404, 'File could not be read');
    }
    $mime = 'application/octet-stream';
    if (str_ends_with($path, '.svg')) {
        $mime = 'image/svg+xml';
    } elseif (str_ends_with($path, '.png')) {
        $mime = 'image/png';
    } elseif (str_ends_with($path, '.jpg') || str_ends_with($path, '.jpeg')) {
        $mime = 'image/jpeg';
    }
    return response($content, 200, [
        'Content-Type' => $mime,
        'Content-Length' => strlen($content),
        'Access-Control-Allow-Origin' => '*',
        'Access-Control-Allow-Methods' => 'GET, HEAD, OPTIONS',
    ]);
})->where('path', '.*');
