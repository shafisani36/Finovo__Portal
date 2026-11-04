<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'bunny' => [
        'storage_zone' => env('BUNNY_STORAGE_ZONE', 'finovoglobal'),
        'api_key' => env('BUNNY_STORAGE_API_KEY'),
        'read_only_key' => env('BUNNY_STORAGE_READ_ONLY_KEY'),
        'region' => env('BUNNY_STORAGE_REGION', 'de'),
        'endpoint' => env('BUNNY_STORAGE_ENDPOINT', 'https://storage.bunnycdn.com'),
        's3_endpoint' => env('BUNNY_S3_ENDPOINT', 'https://de-s3.storage.bunnycdn.com'),
        'pull_zone_url' => env('BUNNY_PULL_ZONE_URL', 'https://finovoglobal.b-cdn.net'),
        'token_key' => env('BUNNY_SECURITY_TOKEN_KEY'),
    ],

];
