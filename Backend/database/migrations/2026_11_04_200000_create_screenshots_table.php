<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('screenshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attendance_record_id')
                ->constrained('attendance_records')
                ->onDelete('cascade');
            $table->foreignId('admin_id')
                ->constrained('users')
                ->onDelete('cascade');
            $table->string('url');
            $table->timestamp('stored_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('screenshots');
    }
};
