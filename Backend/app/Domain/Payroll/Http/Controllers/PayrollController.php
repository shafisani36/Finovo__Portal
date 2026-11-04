<?php

namespace App\Domain\Payroll\Http\Controllers;

use App\Domain\Access\Services\AuthorizationEngine;
use App\Domain\Organization\Services\TenantContextResolver;
use App\Domain\Payroll\Actions\ApprovePayrollRunAction;
use App\Domain\Payroll\Actions\FinalizePayrollRunAction;
use App\Domain\Payroll\Actions\PreparePayrollRunAction;
use App\Http\Controllers\Controller;
use App\Models\CompensationPackage;
use App\Models\PayrollRun;
use App\Models\Payslip;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayrollController extends Controller
{
    public function __construct(
        protected TenantContextResolver $tenantResolver,
        protected AuthorizationEngine $authEngine,
        protected PreparePayrollRunAction $prepareAction,
        protected ApprovePayrollRunAction $approveAction,
        protected FinalizePayrollRunAction $finalizeAction
    ) {}

    /**
     * List payroll runs
     */
    public function indexRuns(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'payroll.view');
        if (!$authResult->isAllowed) {
            return response()->json(['success' => false, 'message' => $authResult->reason], 403);
        }

        $runs = PayrollRun::where('company_id', $company->id)
            ->with(['preparedBy', 'approvedBy', 'finalizedBy'])
            ->orderByDesc('id')
            ->get();

        return response()->json(['success' => true, 'data' => $runs]);
    }

    /**
     * Create a new payroll run
     */
    public function storeRun(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'payroll.prepare');
        if (!$authResult->isAllowed) {
            return response()->json(['success' => false, 'message' => $authResult->reason], 403);
        }

        $validated = $request->validate([
            'period_start' => 'required|date',
            'period_end' => 'required|date|after_or_equal:period_start',
            'pay_date' => 'required|date|after_or_equal:period_end',
            'currency' => 'nullable|string|size:3',
            'notes' => 'nullable|string|max:500',
        ]);

        $yearMonth = date('Y-m', strtotime($validated['period_start']));
        $count = PayrollRun::where('company_id', $company->id)->count() + 1;
        $runNumber = sprintf('PAY-%s-%02d', $yearMonth, $count);

        $run = PayrollRun::create([
            'company_id' => $company->id,
            'run_number' => $runNumber,
            'period_start' => $validated['period_start'],
            'period_end' => $validated['period_end'],
            'pay_date' => $validated['pay_date'],
            'currency' => $validated['currency'] ?? 'USD',
            'status' => 'draft',
            'prepared_by_user_id' => $request->user()->id,
            'notes' => $validated['notes'] ?? null,
        ]);

        return response()->json(['success' => true, 'data' => $run], 201);
    }

    /**
     * Calculate batch payroll
     */
    public function calculateRun(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'payroll.prepare');
        if (!$authResult->isAllowed) {
            return response()->json(['success' => false, 'message' => $authResult->reason], 403);
        }

        $run = PayrollRun::where('company_id', $company->id)->where('id', $id)->firstOrFail();

        try {
            $calculated = $this->prepareAction->execute($run, $request->user()->id);

            return response()->json([
                'success' => true,
                'message' => 'Payroll calculation complete with DECIMAL(19,4) precision.',
                'data' => $calculated,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * Approve payroll run with maker-checker validation
     */
    public function approveRun(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'payroll.approve');
        if (!$authResult->isAllowed) {
            return response()->json(['success' => false, 'message' => $authResult->reason], 403);
        }

        $run = PayrollRun::where('company_id', $company->id)->where('id', $id)->firstOrFail();

        try {
            $approved = $this->approveAction->execute($run, $request->user()->id);

            return response()->json([
                'success' => true,
                'message' => 'Payroll batch successfully approved.',
                'data' => $approved,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * Finalize payroll run and publish payslips
     */
    public function finalizeRun(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'payroll.finalize');
        if (!$authResult->isAllowed) {
            return response()->json(['success' => false, 'message' => $authResult->reason], 403);
        }

        $run = PayrollRun::where('company_id', $company->id)->where('id', $id)->firstOrFail();

        try {
            $finalized = $this->finalizeAction->execute($run, $request->user()->id);

            return response()->json([
                'success' => true,
                'message' => 'Payroll finalized and employee payslips published.',
                'data' => $finalized,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * View employee payslips
     */
    public function indexPayslips(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $canViewAll = $this->authEngine->evaluate($membership, 'payroll.view')->isAllowed;

        $query = Payslip::where('company_id', $company->id)
            ->with(['run', 'employmentRecord.membership.user', 'lineItems']);

        if (!$canViewAll) {
            // Employee self-service payslip access
            $query->where('membership_id', $membership->id)
                ->where('status', 'published');
        }

        $payslips = $query->orderByDesc('id')->get();

        return response()->json(['success' => true, 'data' => $payslips]);
    }
}
