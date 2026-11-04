using Finovo.TimeTracker.Application.Interfaces;
using Finovo.TimeTracker.Domain.Entities;
using Finovo.TimeTracker.Domain.ValueObjects;

namespace Finovo.TimeTracker.Application.Sessions;

public class SessionManager
{
    private readonly IApiClient _apiClient;
    private readonly IOfflineQueue _offlineQueue;
    private readonly ITimerService _timerService;

    public WorkSession? CurrentSession { get; private set; }
    public SessionStatus CurrentStatus => CurrentSession?.Status ?? SessionStatus.Idle;

    public event Action<WorkSession?>? SessionChanged;

    public SessionManager(IApiClient apiClient, IOfflineQueue offlineQueue, ITimerService timerService)
    {
        _apiClient = apiClient;
        _offlineQueue = offlineQueue;
        _timerService = timerService;
    }

    public async Task<WorkSession?> StartSessionAsync(string companySlug, long? taskId, string? taskTitle, CancellationToken ct = default)
    {
        var idempotencyKey = Guid.NewGuid().ToString("N");
        var session = await _apiClient.StartSessionAsync(companySlug, taskId, idempotencyKey, ct);

        if (session != null)
        {
            session.TaskTitle = taskTitle;
            CurrentSession = session;
            _timerService.Start();
            SessionChanged?.Invoke(CurrentSession);

            await _offlineQueue.EnqueueEventAsync(new OfflineEvent
            {
                LocalSessionId = session.Id,
                EventType = "start",
                StartedAtUtc = session.StartedAtUtc,
                TaskId = taskId,
            }, ct);
        }

        return session;
    }

    public async Task PauseSessionAsync(string companySlug, CancellationToken ct = default)
    {
        if (CurrentSession == null || CurrentSession.Status != SessionStatus.Running) return;

        var updated = await _apiClient.PauseSessionAsync(companySlug, CurrentSession.Id, ct);
        if (updated != null)
        {
            CurrentSession = updated;
            _timerService.Pause();
            SessionChanged?.Invoke(CurrentSession);

            await _offlineQueue.EnqueueEventAsync(new OfflineEvent
            {
                LocalSessionId = CurrentSession.Id,
                EventType = "pause",
                ObservedAtUtc = DateTime.UtcNow,
            }, ct);
        }
    }

    public async Task ResumeSessionAsync(string companySlug, CancellationToken ct = default)
    {
        if (CurrentSession == null || CurrentSession.Status != SessionStatus.Paused) return;

        var updated = await _apiClient.ResumeSessionAsync(companySlug, CurrentSession.Id, ct);
        if (updated != null)
        {
            CurrentSession = updated;
            _timerService.Resume();
            SessionChanged?.Invoke(CurrentSession);

            await _offlineQueue.EnqueueEventAsync(new OfflineEvent
            {
                LocalSessionId = CurrentSession.Id,
                EventType = "resume",
                ObservedAtUtc = DateTime.UtcNow,
            }, ct);
        }
    }

    public async Task StopSessionAsync(string companySlug, CancellationToken ct = default)
    {
        if (CurrentSession == null) return;

        var updated = await _apiClient.StopSessionAsync(companySlug, CurrentSession.Id, ct);
        _timerService.Reset();

        if (updated != null)
        {
            CurrentSession = updated;
            SessionChanged?.Invoke(CurrentSession);

            await _offlineQueue.EnqueueEventAsync(new OfflineEvent
            {
                LocalSessionId = CurrentSession.Id,
                EventType = "stop",
                EndedAtUtc = DateTime.UtcNow,
                MonotonicElapsedMs = (long)_timerService.Elapsed.TotalMilliseconds,
            }, ct);
        }
        else
        {
            CurrentSession = null;
            SessionChanged?.Invoke(null);
        }
    }
}
