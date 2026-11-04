<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('temporary_access_grants')) {
            Schema::table('temporary_access_grants', function (Blueprint $table) {
                if (!Schema::hasColumn('temporary_access_grants', 'grant_type')) {
                    $table->string('grant_type', 20)->default('grant')->after('permission_key');
                }
                if (!Schema::hasColumn('temporary_access_grants', 'is_permanent')) {
                    $table->boolean('is_permanent')->default(false)->after('granted_at');
                }
            });

            // Allow null expires_at for permanent / forever grants
            try {
                DB::statement('ALTER TABLE temporary_access_grants MODIFY expires_at DATETIME NULL');
            } catch (\Throwable $e) {
                // If already nullable or non-critical
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('temporary_access_grants')) {
            Schema::table('temporary_access_grants', function (Blueprint $table) {
                if (Schema::hasColumn('temporary_access_grants', 'is_permanent')) {
                    $table->dropColumn('is_permanent');
                }
                if (Schema::hasColumn('temporary_access_grants', 'grant_type')) {
                    $table->dropColumn('grant_type');
                }
            });
        }
    }
};

