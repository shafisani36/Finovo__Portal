using Finovo.TimeTracker.Domain.ValueObjects;

namespace Finovo.TimeTracker.Domain.Entities;

public class WorkSession
{
    public long Id { get; set; }
    public long CompanyId { get; set; }
    public long? TaskId { get; set; }
    public string? TaskTitle { get; set; }
    public long? ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public SessionStatus Status { get; set; } = SessionStatus.Idle;
    public DateTime StartedAtUtc { get; set; }
    public DateTime? EndedAtUtc { get; set; }
    public long ElapsedMilliseconds { get; set; }
    public uint Version { get; set; } = 1;
    public string? IdempotencyKey { get; set; }
}
