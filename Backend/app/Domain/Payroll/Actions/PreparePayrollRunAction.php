<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Payroll\Services\DeterministicPayrollCalculator;
use App\Models\CompensationPackage;
use App\Models\EmploymentRecord;
use App\Models\PayrollRun;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class PreparePayrollRunAction
{
    public function __construct(
        protected DeterministicPayrollCalculator $calculator
    ) {}

    /**
     * Executes atomic batch calculation across all active employees with compensation packages
     */
    public function execute(PayrollRun $run, int $preparerUserId): PayrollRun
    {
        if (!in_array($run->status, ['draft', 'calculating', 'calculated'], true)) {
            throw new InvalidArgumentException("Cannot recalculate payroll run with status '{$run->status}'.");
        }

        return DB::transaction(function () use ($run, $preparerUserId) {
            // Delete previous calculations if any
            $run->lineItems()->delete();
            $run->payslips()->delete();

            $run->update(['status' => 'calculating', 'prepared_by_user_id' => $preparerUserId]);

            // Query active employees with currently effective compensation packages
            $employees = EmploymentRecord::where('company_id', $run->company_id)
                ->where('status', 'active')
                ->get();

            $totalGross = '0.0000';
            $totalDeductions = '0.0000';
            $totalStatutory = '0.0000';
            $totalNet = '0.0000';
            $totalEmployer = '0.0000';
            $count = 0;

            foreach ($employees as $emp) {
                $comp = CompensationPackage::where('employment_record_id', $emp->id)
                    ->where('is_active', true)
                    ->where('effective_from', '<=', $run->period_end)
                    ->where(function ($q) use ($run) {
                        $q->whereNull('effective_to')->orWhere('effective_to', '>=', $run->period_start);
                    })
                    ->first();

                if (!$comp) {
                    continue; // Skip employees without configured compensation package
                }

                $res = $this->calculator->calculateEmployee($run, $emp, $comp);

                // Save line items
                foreach ($res['line_items'] as $item) {
                    $item->save();
                }

                // Save payslip
                $res['payslip']->save();

                $totalGross = bcadd($totalGross, $res['gross'], 4);
                $totalDeductions = bcadd($totalDeductions, $res['deductions'], 4);
                $totalStatutory = bcadd($totalStatutory, $res['statutory'], 4);
                $totalNet = bcadd($totalNet, $res['net'], 4);
                $totalEmployer = bcadd($totalEmployer, $res['employer_contributions'], 4);
                $count++;
            }

            $run->update([
                'status' => 'calculated',
                'total_gross' => $totalGross,
                'total_deductions' => $totalDeductions,
                'total_statutory' => $totalStatutory,
                'total_net' => $totalNet,
                'total_employer_contributions' => $totalEmployer,
                'employee_count' => $count,
            ]);

            return $run->fresh(['lineItems', 'payslips']);
        });
    }
}
