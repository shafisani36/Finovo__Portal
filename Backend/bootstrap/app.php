<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'company.access' => \App\Http\Middleware\EnsureCompanyMembership::class,
            'company.permission' => \App\Http\Middleware\RequireCompanyPermission::class,
            'subscription.entitlement' => \App\Http\Middleware\CheckSubscriptionEntitlement::class,
            'platform.admin' => \App\Http\Middleware\EnsurePlatformAdminAccess::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
