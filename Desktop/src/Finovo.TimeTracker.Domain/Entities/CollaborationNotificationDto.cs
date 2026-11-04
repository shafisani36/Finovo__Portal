namespace Finovo.TimeTracker.Domain.Entities;

public class CollaborationNotificationDto
{
    public long Id { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Category { get; set; } = "collaboration";
    public string Priority { get; set; } = "normal";
    public string? ActionRoute { get; set; }
    public bool IsRead { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
}
