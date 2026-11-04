namespace Finovo.TimeTracker.Domain.ValueObjects;

public enum SessionStatus
{
    Idle,
    Running,
    Paused,
    Stopped,
    Synchronizing,
    Conflict
}
