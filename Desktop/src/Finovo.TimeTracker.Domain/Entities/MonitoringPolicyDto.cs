namespace Finovo.TimeTracker.Domain.Entities;

public class MonitoringPolicyDto
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Version { get; set; } = 1;
    public bool IsActive { get; set; } = true;
    public bool AllowAppCategoryCollection { get; set; } = true;
    public bool AllowForegroundApp { get; set; } = true;
    public bool AllowInputActivity { get; set; } = true;
    public int IdleThresholdSeconds { get; set; } = 300;
    public bool AllowOfflineQueue { get; set; } = true;
    public int OfflineGraceHours { get; set; } = 48;
    public int RetentionDays { get; set; } = 90;
    public string MinClientVersion { get; set; } = "1.0.0";
    public bool IsAcknowledged { get; set; } = true;
}
