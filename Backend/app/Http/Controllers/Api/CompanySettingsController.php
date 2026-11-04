<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanySettings;
use App\Models\SecurityAuditEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CompanySettingsController extends Controller
{
    public function show(Request $request, Company $company): JsonResponse
    {
        $settings = $company->settings ?? CompanySettings::firstOrCreate([
            'company_id' => $company->id,
        ], [
            'working_days' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            'fiscal_year_start' => '01-01',
            'allow_employee_invites' => false,
            'enforce_mfa' => false,
            'session_timeout_minutes' => 1440,
            'date_format' => 'YYYY-MM-DD',
            'time_format' => '12h',
        ]);

        return response()->json([
            'settings' => $settings,
            'company' => [
                'id' => $company->id,
                'name' => $company->name,
                'slug' => $company->slug,
                'timezone' => $company->timezone,
                'locale' => $company->locale,
                'logo_path' => $company->logo_path,
            ],
        ]);
    }

    public function update(Request $request, Company $company): JsonResponse
    {
        $validated = $request->validate([
            'working_days' => ['sometimes', 'array'],
            'working_days.*' => ['string'],
            'fiscal_year_start' => ['sometimes', 'string', 'max:10'],
            'allow_employee_invites' => ['sometimes', 'boolean'],
            'enforce_mfa' => ['sometimes', 'boolean'],
            'session_timeout_minutes' => ['sometimes', 'integer', 'min:15', 'max:10080'],
            'date_format' => ['sometimes', 'string', 'max:20'],
            'time_format' => ['sometimes', 'string', 'in:12h,24h'],
            'preferences' => ['nullable', 'array'],
        ]);

        $settings = $company->settings ?? CompanySettings::create(['company_id' => $company->id]);
        $settings->update($validated);

        SecurityAuditEvent::record('settings.updated', $request->user()->id, $company->id, 'company_settings', (string) $settings->id, $validated);

        return response()->json([
            'message' => 'Company settings updated successfully.',
            'settings' => $settings,
        ]);
    }
}
