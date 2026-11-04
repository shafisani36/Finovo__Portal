<?php

namespace App\Services\Integrations;

use App\Models\IntegrationConnection;
use App\Models\IntegrationSyncRun;
use App\Models\IntegrationIdentityMapping;
use App\Models\Task;
use Illuminate\Support\Str;

class IntegrationSyncService
{
    /**
     * Section 21: Synchronization Algorithm
     */
    public function executeSync(IntegrationConnection $connection, string $resourceType = 'issues'): IntegrationSyncRun
    {
        $leaseToken = (string) Str::uuid();

        // 1. Acquire lease
        $syncRun = IntegrationSyncRun::create([
            'connection_id' => $connection->id,
            'company_id' => $connection->company_id,
            'resource_type' => $resourceType,
            'direction' => 'inbound',
            'status' => 'running',
            'lease_token' => $leaseToken,
            'lease_expires_at' => now()->addMinutes(15),
            'started_at' => now(),
        ]);

        try {
            // Simulated provider synchronization batch (e.g. GitHub Issues to Finovo Tasks)
            $simulatedExternalRecords = [
                [
                    'external_id' => 'gh_' . rand(100, 999),
                    'title' => 'Sync Automated Regression Test ' . rand(10, 99),
                    'body' => 'Synchronized from external source repository issue tracker.',
                    'state' => 'open',
                ],
            ];

            $processed = 0;
            $failed = 0;

            foreach ($simulatedExternalRecords as $record) {
                try {
                    // Check existing identity mapping
                    $mapping = IntegrationIdentityMapping::where('connection_id', $connection->id)
                        ->where('resource_type', $resourceType)
                        ->where('external_id', $record['external_id'])
                        ->first();

                    if (!$mapping) {
                        // Create internal task
                        $task = Task::create([
                            'company_id' => $connection->company_id,
                            'project_id' => $connection->company->projects()->first()?->id ?? 1,
                            'task_code' => 'INT-' . rand(1000, 9999),
                            'title' => $record['title'],
                            'description' => $record['body'],
                            'status' => 'open',
                            'priority' => 'medium',
                            'task_type' => 'feature',
                            'visibility' => 'internal',
                        ]);

                        // Record immutable mapping
                        IntegrationIdentityMapping::create([
                            'connection_id' => $connection->id,
                            'company_id' => $connection->company_id,
                            'resource_type' => $resourceType,
                            'external_id' => $record['external_id'],
                            'internal_id' => $task->id,
                            'last_synced_at' => now(),
                        ]);
                    } else {
                        // Update existing task
                        Task::where('id', $mapping->internal_id)->update([
                            'title' => $record['title'],
                            'updated_at' => now(),
                        ]);
                        $mapping->update(['last_synced_at' => now()]);
                    }

                    $processed++;
                } catch (\Exception $ex) {
                    $failed++;
                }
            }

            $syncRun->update([
                'status' => $failed > 0 ? 'partially_completed' : 'completed',
                'records_fetched' => count($simulatedExternalRecords),
                'records_processed' => $processed,
                'records_failed' => $failed,
                'completed_at' => now(),
            ]);

            $connection->update([
                'last_sync_at' => now(),
                'status' => 'connected',
            ]);
        } catch (\Exception $e) {
            $syncRun->update([
                'status' => 'failed',
                'error_summary' => $e->getMessage(),
                'completed_at' => now(),
            ]);
            $connection->update([
                'last_error' => $e->getMessage(),
                'status' => 'error',
            ]);
        }

        return $syncRun;
    }
}
