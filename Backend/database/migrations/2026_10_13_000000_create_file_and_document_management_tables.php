<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Folders Hierarchy Table (Adjacency List + Composite Indexes)
        Schema::create('file_folders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('file_folders')->nullOnDelete();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->string('color', 50)->default('orange'); // orange, blue, purple, emerald, rose, amber, teal, cyan
            $table->string('icon', 50)->default('folder');
            $table->boolean('is_starred')->default(false);
            $table->boolean('is_system')->default(false);
            $table->string('path', 1000)->default('/');
            $table->unsignedInteger('items_count')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['company_id', 'parent_id', 'created_at'], 'idx_folders_comp_parent_created');
            $table->index(['company_id', 'is_starred'], 'idx_folders_comp_starred');
        });

        // 2. Authoritative Files Table
        Schema::create('files', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('folder_id')->nullable()->constrained('file_folders')->nullOnDelete();
            $table->string('name');
            $table->string('original_name');
            $table->string('mime_type', 128);
            $table->string('extension', 32);
            $table->string('file_category', 64)->default('documents'); // documents, images, videos, code, archives, audio, others
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->string('storage_key', 500);
            $table->string('storage_disk', 64)->default('bunny'); // bunny, local, s3
            $table->string('cdn_url', 1000)->nullable();
            $table->enum('status', [
                'initiated',
                'uploading',
                'quarantined',
                'validated',
                'processing',
                'available',
                'rejected',
                'deletion_pending',
                'deleted'
            ])->default('available');
            $table->boolean('is_starred')->default(false);
            $table->boolean('is_public')->default(false);
            $table->unsignedInteger('version_count')->default(1);
            $table->unsignedBigInteger('current_version_id')->nullable();
            $table->string('security_scan_status', 32)->default('clean'); // clean, scan_pending, infected, rejected
            $table->string('checksum_sha256', 64)->nullable();
            $table->json('metadata')->nullable(); // dimensions, page_count, tags, custom attributes
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('last_accessed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['company_id', 'folder_id', 'created_at'], 'idx_files_comp_folder_created');
            $table->index(['company_id', 'file_category'], 'idx_files_comp_category');
            $table->index(['company_id', 'status', 'updated_at'], 'idx_files_comp_status_updated');
            $table->index(['company_id', 'is_starred'], 'idx_files_comp_starred');
            $table->index(['company_id', 'last_accessed_at'], 'idx_files_comp_accessed');
        });

        // 3. Immutable Document Versions Table
        Schema::create('file_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('file_id')->constrained('files')->cascadeOnDelete();
            $table->unsignedInteger('version_number');
            $table->string('storage_key', 500);
            $table->unsignedBigInteger('size_bytes');
            $table->string('checksum_sha256', 64);
            $table->string('mime_type', 128);
            $table->string('security_scan_status', 32)->default('clean');
            $table->text('changelog')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['file_id', 'version_number'], 'uniq_file_version');
            $table->index(['file_id', 'created_at'], 'idx_file_versions_created');
        });

        // 4. Secure Upload Sessions Table
        Schema::create('file_upload_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('session_token', 128)->unique();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('folder_id')->nullable()->constrained('file_folders')->nullOnDelete();
            $table->string('expected_filename');
            $table->unsignedBigInteger('expected_size_bytes');
            $table->json('allowed_mime_types')->nullable();
            $table->enum('status', ['initiated', 'uploading', 'completed', 'expired', 'failed'])->default('initiated');
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index(['company_id', 'status'], 'idx_upload_comp_status');
            $table->index(['session_token', 'expires_at'], 'idx_upload_token_exp');
        });

        // 5. File Audit Events Table
        Schema::create('file_audit_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('file_id')->nullable()->constrained('files')->nullOnDelete();
            $table->string('action', 64); // upload, download, preview, rename, move, delete, restore, star, share, version_created
            $table->json('details')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['company_id', 'created_at'], 'idx_audit_comp_created');
            $table->index(['file_id', 'action'], 'idx_audit_file_action');
        });

        // 6. Secure Document Shares Table
        Schema::create('file_shares', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('file_id')->constrained('files')->cascadeOnDelete();
            $table->string('share_token_hash', 128)->unique();
            $table->string('recipient_email')->nullable();
            $table->enum('permission', ['view', 'download', 'edit'])->default('download');
            $table->unsignedInteger('max_downloads')->nullable();
            $table->unsignedInteger('download_count')->default(0);
            $table->boolean('is_revoked')->default(false);
            $table->timestamp('expires_at')->nullable();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'file_id'], 'idx_shares_comp_file');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('file_shares');
        Schema::dropIfExists('file_audit_events');
        Schema::dropIfExists('file_upload_sessions');
        Schema::dropIfExists('file_versions');
        Schema::dropIfExists('files');
        Schema::dropIfExists('file_folders');
    }
};
