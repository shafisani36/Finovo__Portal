namespace Finovo.TimeTracker.Domain.Entities;

public class PerformanceReviewDto
{
    public long Id { get; set; }
    public long CompanyId { get; set; }
    public long CycleId { get; set; }
    public string CycleTitle { get; set; } = string.Empty;
    public string Status { get; set; } = "scheduled";
    public decimal? SelfRating { get; set; }
    public decimal? ManagerRating { get; set; }
    public decimal? FinalRating { get; set; }
    public decimal QualityScore { get; set; }
    public DateTime? ReleasedAt { get; set; }
    public DateTime? AcknowledgedAt { get; set; }
}
