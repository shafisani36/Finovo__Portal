using Finovo.TimeTracker.Domain.Entities;
using Finovo.TimeTracker.Infrastructure.LocalStorage;
using Xunit;

namespace Finovo.TimeTracker.UnitTests;

public class OfflineQueueTests
{
    [Fact]
    public async Task EnqueueAndSync_MarksEventsSynchronized()
    {
        var queue = new SqliteOfflineQueue();
        var evt = new OfflineEvent
        {
            EventId = "evt-unit-001",
            EventType = "interval",
            StartedAtUtc = DateTime.UtcNow.AddHours(-1),
            EndedAtUtc = DateTime.UtcNow,
            MonotonicElapsedMs = 3600000,
        };

        await queue.EnqueueEventAsync(evt);
        var pending = await queue.GetPendingEventsAsync();

        Assert.Single(pending);
        Assert.Equal("evt-unit-001", pending[0].EventId);

        await queue.MarkAsSynchronizedAsync(new[] { "evt-unit-001" });
        var afterSync = await queue.GetPendingEventsAsync();

        Assert.Empty(afterSync);
    }
}
