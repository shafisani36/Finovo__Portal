<?php

namespace App\Domain\Access\Services;

use App\Models\Permission;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class PermissionCatalogService
{
    private const CACHE_KEY = 'finovo:permissions:catalog';

    /**
     * Retrieve complete catalog of registered permissions grouped by module
     */
    public function getCatalog(): array
    {
        return Cache::remember(self::CACHE_KEY, 3600, function () {
            $allPermissions = Permission::orderBy('module')->orderBy('key')->get();

            $grouped = $allPermissions->groupBy('module')->map(function (Collection $items, string $module) {
                return [
                    'module' => $module,
                    'module_title' => $this->getModuleTitle($module),
                    'total_permissions' => $items->count(),
                    'permissions' => $items->map(fn (Permission $p) => [
                        'id' => $p->id,
                        'key' => $p->key,
                        'name' => $p->name,
                        'description' => $p->description,
                    ])->values()->all(),
                ];
            })->values()->all();

            return [
                'total_modules' => count($grouped),
                'total_permissions' => $allPermissions->count(),
                'modules' => $grouped,
            ];
        });
    }

    /**
     * Invalidate catalog cache
     */
    public function invalidateCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    private function getModuleTitle(string $moduleKey): string
    {
        return match (strtolower($moduleKey)) {
            'company' => 'M01 / M02: Organization & Structure',
            'roles' => 'M03: Roles & Access Control',
            'employees', 'members' => 'M04: Workforce & Employees',
            'recruitment' => 'M05: Recruitment & Talent',
            'lifecycle' => 'M06: Onboarding & Offboarding',
            'attendance', 'leave' => 'M07: Attendance, Leave & Schedules',
            'time_tracking' => 'M08: Web Time Tracking & Timesheets',
            'payroll', 'finance' => 'M09: Payroll & Compensation',
            'performance' => 'M10: Performance, Training & Goals',
            'projects' => 'Projects & Deliverables',
            'tasks' => 'Task Management',
            'collaboration' => 'Collaboration & Messaging',
            'clients' => 'Client Portal',
            'monitoring' => 'Telemetry & Monitoring',
            default => ucfirst(str_replace('_', ' ', $moduleKey)),
        };
    }
}
