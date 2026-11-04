namespace Finovo.TimeTracker.Domain.Rules;

/// <summary>
/// Algorithm C: Overlap detection for half-open intervals [a_s, a_e) and [b_s, b_e).
/// Overlap occurs when: a_s < b_e && b_s < a_e
/// </summary>
public static class OverlapDetector
{
    public static bool HasOverlap(DateTime aStart, DateTime aEnd, DateTime bStart, DateTime bEnd)
    {
        return aStart < bEnd && bStart < aEnd;
    }
}
