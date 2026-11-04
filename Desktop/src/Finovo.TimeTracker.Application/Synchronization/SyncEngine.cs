using Finovo.TimeTracker.Application.Interfaces;

namespace Finovo.TimeTracker.Application.Synchronization;

public class SyncEngine
{
    private readonly IApiClient _apiClient;
    private readonly IOfflineQueue _offlineQueue;

    public bool IsSyncing { get; private set; }
    public event Action<bool>? SyncStatusChanged;

    public SyncEngine(IApiClient apiClient, IOfflineQueue offlineQueue)
    {
        _apiClient = apiClient;
        _offlineQueue = offlineQueue;
    }

    public async Task<int> FlushQueueAsync(string companySlug, CancellationToken ct = default)
    {
        if (IsSyncing) return 0;

        try
        {
            IsSyncing = true;
            SyncStatusChanged?.Invoke(true);

            var pendingEvents = await _offlineQueue.GetPendingEventsAsync(limit: 50, ct);
            if (pendingEvents.Count == 0) return 0;

            var batchUid = "batch_" + Guid.NewGuid().ToString("N");
            var success = await _apiClient.SyncBatchAsync(companySlug, batchUid, pendingEvents, ct);

            if (success)
            {
                var ids = pendingEvents.Select(e => e.EventId).ToList();
                await _offlineQueue.MarkAsSynchronizedAsync(ids, ct);
                return pendingEvents.Count;
            }

            return 0;
        }
        finally
        {
            IsSyncing = false;
            SyncStatusChanged?.Invoke(false);
        }
    }
}
