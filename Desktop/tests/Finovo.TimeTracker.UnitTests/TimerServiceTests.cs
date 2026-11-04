using Finovo.TimeTracker.Infrastructure.Diagnostics;
using Xunit;

namespace Finovo.TimeTracker.UnitTests;

public class TimerServiceTests
{
    [Fact]
    public void TimerStartsAndPauses_Accurately()
    {
        var timer = new StopwatchTimerService();
        Assert.False(timer.IsRunning);
        Assert.Equal(TimeSpan.Zero, timer.Elapsed);

        timer.Start();
        Assert.True(timer.IsRunning);

        Thread.Sleep(50);
        timer.Pause();
        Assert.False(timer.IsRunning);
        Assert.True(timer.Elapsed.TotalMilliseconds >= 40);

        var pausedElapsed = timer.Elapsed;
        Thread.Sleep(50);
        Assert.Equal(pausedElapsed, timer.Elapsed);

        timer.Resume();
        Assert.True(timer.IsRunning);

        timer.Reset();
        Assert.False(timer.IsRunning);
        Assert.Equal(TimeSpan.Zero, timer.Elapsed);
    }
}
