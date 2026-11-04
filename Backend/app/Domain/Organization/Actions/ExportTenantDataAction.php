<?php

namespace App\Domain\Organization\Actions;

use App\Models\Company;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ExportTenantDataAction
{
    public function execute(Company $company, User $actor): array
    {
        $exportId = 'exp_' . Str::random(24);

        DB::table('domain_event_outbox')->insert([
            'event_id' => (string) Str::uuid(),
            'event_type' => 'TenantDataExportRequested',
            'schema_version' => 1,
            'company_id' => $company->id,
            'correlation_id' => $exportId,
            'producer' => 'm01_tenant_management',
            'payload' => json_encode([
                'export_id' => $exportId,
                'tenant_id' => $company->id,
                'requested_by_user_id' => $actor->id,
                'requested_at' => now()->toIso8601String(),
            ]),
            'status' => 'pending',
            'occurred_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return [
            'export_id' => $exportId,
            'status' => 'queued',
            'message' => 'Organization data export queued. Download link will be issued upon compilation.',
        ];
    }
}
