namespace Finovo.TimeTracker.Domain.Entities;

public class MonitoringEventDto
{
    public string EventUid { get; set; } = Guid.NewGuid().ToString();
    public string EventType { get; set; } = "activity_presence"; // activity_presence, idle_interval, category_changed, context_changed, break_state
    public DateTime ClientOccurredAt { get; set; } = DateTime.UtcNow;
    public long ClientSequence { get; set; }
    public string? Category { get; set; } = "development";
    public int? IdleDurationSeconds { get; set; }
    public long? ProjectId { get; set; }
    public long? TaskId { get; set; }
    public long? WorkSessionId { get; set; }
}
