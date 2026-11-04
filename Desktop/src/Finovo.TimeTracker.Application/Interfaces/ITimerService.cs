namespace Finovo.TimeTracker.Application.Interfaces;

public interface ITimerService
{
    bool IsRunning { get; }
    TimeSpan Elapsed { get; }
    void Start();
    void Pause();
    void Resume();
    void Reset();
    event Action<TimeSpan>? Tick;
}
