using System.Diagnostics;
using Finovo.TimeTracker.Application.Interfaces;

namespace Finovo.TimeTracker.Infrastructure.Diagnostics;

/// <summary>
/// Precision Monotonic Clock Display Service using System.Diagnostics.Stopwatch.
/// Guarantees smooth UI rendering without unnecessary database writes or network latency polling.
/// </summary>
public class StopwatchTimerService : ITimerService
{
    private readonly Stopwatch _stopwatch = new();
    private readonly System.Timers.Timer _uiTicker;

    public bool IsRunning => _stopwatch.IsRunning;
    public TimeSpan Elapsed => _stopwatch.Elapsed;

    public event Action<TimeSpan>? Tick;

    public StopwatchTimerService()
    {
        _uiTicker = new System.Timers.Timer(100); // 10Hz smooth display tick
        _uiTicker.Elapsed += (_, _) =>
        {
            if (_stopwatch.IsRunning)
            {
                Tick?.Invoke(_stopwatch.Elapsed);
            }
        };
    }

    public void Start()
    {
        _stopwatch.Restart();
        _uiTicker.Start();
    }

    public void Pause()
    {
        _stopwatch.Stop();
    }

    public void Resume()
    {
        _stopwatch.Start();
    }

    public void Reset()
    {
        _stopwatch.Reset();
        _uiTicker.Stop();
        Tick?.Invoke(TimeSpan.Zero);
    }
}
