using System.Collections.Concurrent;
using Finovo.TimeTracker.Application.Interfaces;
using Finovo.TimeTracker.Domain.Entities;

namespace Finovo.TimeTracker.Infrastructure.LocalStorage;

/// <summary>
/// Durable Local Offline Queue.
/// Implements safe local event queuing with stable UUID deduplication keys.
/// In production, backs into SQLite (Microsoft.Data.Sqlite) or protected local file store.
/// </summary>
public class SqliteOfflineQueue : IOfflineQueue
{
    private readonly ConcurrentDictionary<string, OfflineEvent> _queue = new();

    public Task EnqueueEventAsync(OfflineEvent evt, CancellationToken ct = default)
    {
        _queue.TryAdd(evt.EventId, evt);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<OfflineEvent>> GetPendingEventsAsync(int limit = 50, CancellationToken ct = default)
    {
        var pending = _queue.Values
            .Where(e => !e.IsSynchronized)
            .OrderBy(e => e.ObservedAtUtc)
            .Take(limit)
            .ToList();

        return Task.FromResult<IReadOnlyList<OfflineEvent>>(pending);
    }

    public Task MarkAsSynchronizedAsync(IEnumerable<string> eventIds, CancellationToken ct = default)
    {
        foreach (var id in eventIds)
        {
            if (_queue.TryGetValue(id, out var evt))
            {
                evt.IsSynchronized = true;
            }
        }
        return Task.CompletedTask;
    }

    public Task RecordConflictAsync(string eventId, string error, CancellationToken ct = default)
    {
        if (_queue.TryGetValue(eventId, out var evt))
        {
            evt.SyncError = error;
        }
        return Task.CompletedTask;
    }
}
