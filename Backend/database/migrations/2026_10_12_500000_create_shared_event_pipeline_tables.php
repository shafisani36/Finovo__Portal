<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for Shared Event Pipeline & Outbox (Section 32).
     */
    public function up(): void
    {
        Schema::create('domain_event_outbox', function (Blueprint $table) {
            $table->id();
            $table->string('event_id')->unique(); // UUID / Ulid
            $table->string('event_type')->index(); // e.g. subscription.activated, analytics.anomaly_detected, etc.
            $table->integer('schema_version')->default(1);
            $table->timestamp('occurred_at')->useCurrent();
            $table->foreignId('company_id')->nullable()->constrained('companies')->onDelete('cascade');
            $table->string('correlation_id')->nullable()->index();
            $table->string('causation_id')->nullable();
            $table->string('producer')->default('finovo_core');
            $table->json('payload');
            // Status: pending, dispatched, failed, dead_letter
            $table->string('status')->default('pending')->index();
            $table->integer('attempts')->default(0);
            $table->text('last_error')->nullable();
            $table->timestamp('locked_until')->nullable();
            $table->timestamp('dispatched_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'locked_until']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('domain_event_outbox');
    }
};
