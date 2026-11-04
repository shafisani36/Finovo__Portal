namespace Finovo.TimeTracker.Domain.Entities;

public class AttendanceStatusDto
{
    public string WorkDate { get; set; } = string.Empty;
    public string Status { get; set; } = "not_clocked_in";
    public string? ShiftName { get; set; }
    public string? ClockedInAt { get; set; }
    public string? ClockedOutAt { get; set; }
    public long WorkedSeconds { get; set; }
    public bool IsClockedIn => !string.IsNullOrEmpty(ClockedInAt) && string.IsNullOrEmpty(ClockedOutAt);
}
