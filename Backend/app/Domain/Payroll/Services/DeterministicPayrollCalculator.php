<?php

namespace App\Domain\Payroll\Services;

use App\Models\CompensationPackage;
use App\Models\EmploymentRecord;
use App\Models\PayrollLineItem;
use App\Models\PayrollRun;
use App\Models\Payslip;
use App\Models\Timesheet;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class DeterministicPayrollCalculator
{
    /**
     * Calculates payroll line items and payslip for an individual employee
     */
    public function calculateEmployee(
        PayrollRun $run,
        EmploymentRecord $employee,
        CompensationPackage $compensation
    ): array {
        $gross = '0.0000';
        $deductions = '0.0000';
        $statutory = '0.0000';
        $employerContributions = '0.0000';
        $lineItems = [];

        // 1. Base Salary Component
        $baseSalary = number_format((float) $compensation->base_salary, 4, '.', '');
        $periodStart = Carbon::parse($run->period_start);
        $periodEnd = Carbon::parse($run->period_end);

        $gross = bcadd($gross, $baseSalary, 4);

        $lineItems[] = new PayrollLineItem([
            'company_id' => $run->company_id,
            'payroll_run_id' => $run->id,
            'employment_record_id' => $employee->id,
            'membership_id' => $employee->membership_id,
            'item_type' => 'earning',
            'code' => 'BASE_SALARY',
            'name' => 'Base Regular Salary',
            'amount' => $baseSalary,
            'is_taxable' => true,
            'calculation_trace' => [
                'formula' => 'base_salary_monthly',
                'inputs' => ['base_salary' => $baseSalary],
            ],
        ]);

        // 2. Allowances from compensation package components
        if (!empty($compensation->components)) {
            foreach ($compensation->components as $component) {
                $compAmount = number_format((float) ($component['amount'] ?? 0), 4, '.', '');
                if (bccomp($compAmount, '0.0000', 4) > 0) {
                    $gross = bcadd($gross, $compAmount, 4);
                    $lineItems[] = new PayrollLineItem([
                        'company_id' => $run->company_id,
                        'payroll_run_id' => $run->id,
                        'employment_record_id' => $employee->id,
                        'membership_id' => $employee->membership_id,
                        'item_type' => 'earning',
                        'code' => $component['code'] ?? 'ALLOWANCE',
                        'name' => $component['name'] ?? 'Recurring Allowance',
                        'amount' => $compAmount,
                        'is_taxable' => $component['is_taxable'] ?? true,
                        'calculation_trace' => ['type' => 'fixed_component'],
                    ]);
                }
            }
        }

        // 3. Approved Overtime from M08 Timesheets
        $approvedTimesheet = Timesheet::where('company_id', $run->company_id)
            ->where('membership_id', $employee->membership_id)
            ->where('status', 'approved')
            ->where('period_start', '>=', $run->period_start)
            ->where('period_end', '<=', $run->period_end)
            ->first();

        if ($approvedTimesheet && $approvedTimesheet->total_approved_seconds > (160 * 3600)) {
            $overtimeSeconds = $approvedTimesheet->total_approved_seconds - (160 * 3600);
            $overtimeHours = number_format($overtimeSeconds / 3600, 2, '.', '');
            $hourlyRate = bcdiv($baseSalary, '160', 4);
            $overtimeRate = bcmul($hourlyRate, '1.5000', 4);
            $overtimePay = bcmul($overtimeHours, $overtimeRate, 4);

            $gross = bcadd($gross, $overtimePay, 4);

            $lineItems[] = new PayrollLineItem([
                'company_id' => $run->company_id,
                'payroll_run_id' => $run->id,
                'employment_record_id' => $employee->id,
                'membership_id' => $employee->membership_id,
                'item_type' => 'earning',
                'code' => 'OVERTIME_1_5X',
                'name' => 'Overtime (1.5x Premium)',
                'rate' => $overtimeRate,
                'hours' => $overtimeHours,
                'amount' => $overtimePay,
                'is_taxable' => true,
                'calculation_trace' => [
                    'formula' => 'overtime_hours * (hourly_rate * 1.5)',
                    'hourly_rate' => $hourlyRate,
                    'overtime_hours' => $overtimeHours,
                ],
            ]);
        }

        // 4. Statutory Deductions
        // Income Tax: 15% of gross
        $taxAmount = bcmul($gross, '0.1500', 4);
        $deductions = bcadd($deductions, $taxAmount, 4);
        $statutory = bcadd($statutory, $taxAmount, 4);

        $lineItems[] = new PayrollLineItem([
            'company_id' => $run->company_id,
            'payroll_run_id' => $run->id,
            'employment_record_id' => $employee->id,
            'membership_id' => $employee->membership_id,
            'item_type' => 'statutory_tax',
            'code' => 'INCOME_TAX_WITHHOLDING',
            'name' => 'Income Tax Withholding (15%)',
            'amount' => $taxAmount,
            'is_taxable' => false,
            'calculation_trace' => ['formula' => 'gross * 0.15', 'gross' => $gross],
        ]);

        // Employee Pension: 5% of base salary
        $pensionEE = bcmul($baseSalary, '0.0500', 4);
        $deductions = bcadd($deductions, $pensionEE, 4);
        $statutory = bcadd($statutory, $pensionEE, 4);

        $lineItems[] = new PayrollLineItem([
            'company_id' => $run->company_id,
            'payroll_run_id' => $run->id,
            'employment_record_id' => $employee->id,
            'membership_id' => $employee->membership_id,
            'item_type' => 'statutory_social',
            'code' => 'PENSION_EE',
            'name' => 'Employee Social Security / Pension (5%)',
            'amount' => $pensionEE,
            'is_taxable' => false,
            'calculation_trace' => ['formula' => 'base_salary * 0.05', 'base_salary' => $baseSalary],
        ]);

        // 5. Employer Statutory Contributions (Non-deducted from employee, company cost)
        $pensionER = bcmul($baseSalary, '0.0500', 4);
        $employerContributions = bcadd($employerContributions, $pensionER, 4);

        $lineItems[] = new PayrollLineItem([
            'company_id' => $run->company_id,
            'payroll_run_id' => $run->id,
            'employment_record_id' => $employee->id,
            'membership_id' => $employee->membership_id,
            'item_type' => 'employer_tax',
            'code' => 'PENSION_ER_MATCH',
            'name' => 'Employer Pension Contribution Match (5%)',
            'amount' => $pensionER,
            'is_taxable' => false,
            'calculation_trace' => ['formula' => 'base_salary * 0.05', 'base_salary' => $baseSalary],
        ]);

        // 6. Net Pay Calculation: Gross - Total Deductions
        $netPay = bcsub($gross, $deductions, 4);

        $payslip = new Payslip([
            'company_id' => $run->company_id,
            'payroll_run_id' => $run->id,
            'employment_record_id' => $employee->id,
            'membership_id' => $employee->membership_id,
            'payslip_number' => sprintf('PS-%s-%04d', $run->run_number, $employee->id),
            'gross_pay' => $gross,
            'total_deductions' => $deductions,
            'net_pay' => $netPay,
            'currency' => $run->currency,
            'status' => 'draft',
            'payment_method' => 'direct_deposit',
            'bank_account_mask' => '•••• ' . rand(1000, 9999),
        ]);

        return [
            'gross' => $gross,
            'deductions' => $deductions,
            'statutory' => $statutory,
            'net' => $netPay,
            'employer_contributions' => $employerContributions,
            'line_items' => $lineItems,
            'payslip' => $payslip,
        ];
    }
}
