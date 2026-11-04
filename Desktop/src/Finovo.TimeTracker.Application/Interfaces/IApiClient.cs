using Finovo.TimeTracker.Domain.Entities;

namespace Finovo.TimeTracker.Application.Interfaces;

public interface IApiClient
{
    Task<WorkSession?> StartSessionAsync(string companySlug, long? taskId, string? idempotencyKey, CancellationToken ct = default);
    Task<WorkSession?> GetCurrentSessionAsync(string companySlug, CancellationToken ct = default);
    Task<WorkSession?> PauseSessionAsync(string companySlug, long sessionId, CancellationToken ct = default);
    Task<WorkSession?> ResumeSessionAsync(string companySlug, long sessionId, CancellationToken ct = default);
    Task<WorkSession?> StopSessionAsync(string companySlug, long sessionId, CancellationToken ct = default);
    Task<WorkSession?> SwitchTaskAsync(string companySlug, long sessionId, long newTaskId, CancellationToken ct = default);
    Task<bool> SyncBatchAsync(string companySlug, string batchUid, IEnumerable<OfflineEvent> events, CancellationToken ct = default);
    Task<bool> RegisterDeviceAsync(string companySlug, string deviceUid, string deviceName, CancellationToken ct = default);

    // M07 Attendance Integration
    Task<AttendanceStatusDto?> GetTodayAttendanceAsync(string companySlug, CancellationToken ct = default);
    Task<AttendanceStatusDto?> ClockInAttendanceAsync(string companySlug, string? deviceId, CancellationToken ct = default);
    Task<AttendanceStatusDto?> ClockOutAttendanceAsync(string companySlug, CancellationToken ct = default);

    // M08 Desktop Monitoring & Activity Intelligence
    Task<MonitoringPolicyDto?> GetEffectivePolicyAsync(string companySlug, CancellationToken ct = default);
    Task<bool> SubmitMonitoringBatchAsync(string companySlug, string deviceUid, string batchUid, IEnumerable<MonitoringEventDto> events, CancellationToken ct = default);
    Task<bool> SendHeartbeatAsync(string companySlug, long deviceId, int pendingCount, string syncStatus, CancellationToken ct = default);
}
