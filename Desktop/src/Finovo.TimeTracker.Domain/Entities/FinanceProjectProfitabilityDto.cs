namespace Finovo.TimeTracker.Domain.Entities;

public class FinanceProjectProfitabilityDto
{
    public long ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public decimal ApprovedBudget { get; set; }
    public decimal ActualLaborCost { get; set; }
    public decimal ActualExpenses { get; set; }
    public decimal TotalActualCost { get; set; }
    public decimal InvoicedRevenue { get; set; }
    public decimal GrossProfit { get; set; }
    public decimal GrossMarginPercent { get; set; }
    public decimal ForecastFinalCost { get; set; }
    public decimal ForecastMarginPercent { get; set; }
    public decimal ForecastBudgetOverrun { get; set; }
}
