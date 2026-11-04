<?php

namespace App\Domain\Payroll\Actions;

use App\Models\PayrollRun;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class ApprovePayrollRunAction
{
    /**
     * Approves payroll run enforcing Maker-Checker dual custody / Separation of Duties (SoD)
     */
    public function execute(PayrollRun $run, int $approverUserId): PayrollRun
    {
        // Enforce dual custody: Maker-Checker rule
        if ($run->prepared_by_user_id === $approverUserId) {
            throw new InvalidArgumentException(
                "Separation of duties violation: User #{$approverUserId} prepared this payroll run and cannot approve it."
            );
        }

        if ($run->status !== 'calculated') {
            throw new InvalidArgumentException("Cannot approve payroll run with status '{$run->status}'. Must be 'calculated'.");
        }

        return DB::transaction(function () use ($run, $approverUserId) {
            $run->update([
                'status' => 'approved',
                'approved_by_user_id' => $approverUserId,
                'approved_at' => now(),
            ]);

            // Outbox event
            DB::table('domain_event_outbox')->insert([
                'event_id' => (string) Str::uuid(),
                'company_id' => $run->company_id,
                'event_type' => 'payroll.approved',
                'schema_version' => 1,
                'producer' => 'finovo_m09_payroll',
                'payload' => json_encode([
                    'payroll_run_id' => $run->id,
                    'run_number' => $run->run_number,
                    'total_gross' => $run->total_gross,
                    'total_net' => $run->total_net,
                    'approver_user_id' => $approverUserId,
                ]),
                'status' => 'pending',
                'occurred_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $run->fresh();
        });
    }
}
