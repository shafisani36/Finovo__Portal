using Finovo.TimeTracker.Domain.Rules;
using Xunit;

namespace Finovo.TimeTracker.UnitTests;

public class OverlapDetectorTests
{
    [Fact]
    public void OverlappingIntervals_ReturnTrue()
    {
        var aStart = new DateTime(2026, 10, 11, 9, 0, 0, DateTimeKind.Utc);
        var aEnd = new DateTime(2026, 10, 11, 12, 0, 0, DateTimeKind.Utc);

        var bStart = new DateTime(2026, 10, 11, 11, 0, 0, DateTimeKind.Utc);
        var bEnd = new DateTime(2026, 10, 11, 14, 0, 0, DateTimeKind.Utc);

        Assert.True(OverlapDetector.HasOverlap(aStart, aEnd, bStart, bEnd));
    }

    [Fact]
    public void NonOverlappingIntervals_ReturnFalse()
    {
        var aStart = new DateTime(2026, 10, 11, 9, 0, 0, DateTimeKind.Utc);
        var aEnd = new DateTime(2026, 10, 11, 12, 0, 0, DateTimeKind.Utc);

        var bStart = new DateTime(2026, 10, 11, 12, 0, 0, DateTimeKind.Utc);
        var bEnd = new DateTime(2026, 10, 11, 15, 0, 0, DateTimeKind.Utc);

        // Half-open interval [9, 12) and [12, 15) do not overlap
        Assert.False(OverlapDetector.HasOverlap(aStart, aEnd, bStart, bEnd));
    }
}
