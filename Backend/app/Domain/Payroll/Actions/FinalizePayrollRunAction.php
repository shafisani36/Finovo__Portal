<?php

namespace App\Domain\Payroll\Actions;

use App\Models\PayrollRun;
use App\Models\Payslip;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class FinalizePayrollRunAction
{
    /**
     * Finalizes payroll batch: locks calculation permanently, publishes employee payslips, and posts to ledger
     */
    public function execute(PayrollRun $run, int $finalizerUserId): PayrollRun
    {
        if ($run->status !== 'approved') {
            throw new InvalidArgumentException("Cannot finalize payroll run with status '{$run->status}'. Must be 'approved'.");
        }

        return DB::transaction(function () use ($run, $finalizerUserId) {
            $now = now();

            $run->update([
                'status' => 'finalized',
                'finalized_by_user_id' => $finalizerUserId,
                'finalized_at' => $now,
            ]);

            // Publish all payslips in this run
            Payslip::where('payroll_run_id', $run->id)->update([
                'status' => 'published',
                'published_at' => $now,
            ]);

            // Emit Outbox event
            DB::table('domain_event_outbox')->insert([
                'event_id' => (string) Str::uuid(),
                'company_id' => $run->company_id,
                'event_type' => 'payroll.finalized',
                'schema_version' => 1,
                'producer' => 'finovo_m09_payroll',
                'payload' => json_encode([
                    'payroll_run_id' => $run->id,
                    'run_number' => $run->run_number,
                    'total_gross' => $run->total_gross,
                    'total_net' => $run->total_net,
                    'employee_count' => $run->employee_count,
                    'finalized_by_user_id' => $finalizerUserId,
                ]),
                'status' => 'pending',
                'occurred_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $run->fresh(['payslips']);
        });
    }
}
