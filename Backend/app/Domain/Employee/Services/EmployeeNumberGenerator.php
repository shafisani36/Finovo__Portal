<?php

namespace App\Domain\Employee\Services;

use App\Models\Company;
use App\Models\EmploymentRecord;
use Illuminate\Support\Facades\DB;

class EmployeeNumberGenerator
{
    /**
     * Generate the next deterministic sequential employee number for the given company.
     * Uses DB transaction locking to prevent race conditions in concurrent hiring scenarios.
     */
    public function generate(int $companyId, string $prefix = 'EMP'): string
    {
        return DB::transaction(function () use ($companyId, $prefix) {
            // Find highest existing numerical suffix for this prefix
            $latestRecord = EmploymentRecord::where('company_id', $companyId)
                ->where('employee_number', 'LIKE', "{$prefix}-%")
                ->lockForUpdate()
                ->orderByRaw('CAST(SUBSTRING(employee_number, ?) AS UNSIGNED) DESC', [strlen($prefix) + 2])
                ->first();

            $nextNumber = 1;
            if ($latestRecord && preg_match('/' . preg_quote($prefix, '/') . '-(\d+)/', $latestRecord->employee_number, $matches)) {
                $nextNumber = ((int) $matches[1]) + 1;
            }

            return sprintf('%s-%04d', $prefix, $nextNumber);
        });
    }
}
