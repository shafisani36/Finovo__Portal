<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // SQLite does not support MODIFY ENUM, skip this change on SQLite
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE `messages` MODIFY COLUMN `message_type` ENUM('text', 'action', 'decision', 'announcement', 'system', 'call_log', 'meeting') NOT NULL DEFAULT 'text'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE `messages` MODIFY COLUMN `message_type` ENUM('text', 'action', 'decision', 'announcement', 'system') NOT NULL DEFAULT 'text'");
        }
    }
};