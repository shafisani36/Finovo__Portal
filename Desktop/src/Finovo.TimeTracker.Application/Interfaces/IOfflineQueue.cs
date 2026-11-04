using Finovo.TimeTracker.Domain.Entities;

namespace Finovo.TimeTracker.Application.Interfaces;

public interface IOfflineQueue
{
    Task EnqueueEventAsync(OfflineEvent evt, CancellationToken ct = default);
    Task<IReadOnlyList<OfflineEvent>> GetPendingEventsAsync(int limit = 50, CancellationToken ct = default);
    Task MarkAsSynchronizedAsync(IEnumerable<string> eventIds, CancellationToken ct = default);
    Task RecordConflictAsync(string eventId, string error, CancellationToken ct = default);
}
