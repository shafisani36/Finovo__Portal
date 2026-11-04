namespace Finovo.TimeTracker.Domain.Entities;

public class OfflineEvent
{
    public string EventId { get; set; } = Guid.NewGuid().ToString("N");
    public long? LocalSessionId { get; set; }
    public string EventType { get; set; } = "interval"; // start, pause, resume, switch, stop, interval
    public DateTime ObservedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAtUtc { get; set; }
    public DateTime? EndedAtUtc { get; set; }
    public long MonotonicElapsedMs { get; set; }
    public long? TaskId { get; set; }
    public bool IsSynchronized { get; set; } = false;
    public string? SyncError { get; set; }
}
