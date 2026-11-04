using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Input;
using Finovo.TimeTracker.Application.Interfaces;
using Finovo.TimeTracker.Application.Sessions;
using Finovo.TimeTracker.Domain.ValueObjects;

namespace Finovo.TimeTracker.Desktop.ViewModels;

public class TimerViewModel : INotifyPropertyChanged
{
    private readonly SessionManager _sessionManager;
    private readonly ITimerService _timerService;

    private string _formattedTime = "00:00:00";
    private string _taskTitle = "No Task Selected";
    private string _projectName = "General Workspace Activity";
    private string _statusDisplay = "Idle";
    private bool _canStart = true;
    private bool _canPause = false;
    private bool _canResume = false;
    private bool _canStop = false;

    public string FormattedTime
    {
        get => _formattedTime;
        set => SetField(ref _formattedTime, value);
    }

    public string TaskTitle
    {
        get => _taskTitle;
        set => SetField(ref _taskTitle, value);
    }

    public string ProjectName
    {
        get => _projectName;
        set => SetField(ref _projectName, value);
    }

    public string StatusDisplay
    {
        get => _statusDisplay;
        set => SetField(ref _statusDisplay, value);
    }

    public bool CanStart { get => _canStart; set => SetField(ref _canStart, value); }
    public bool CanPause { get => _canPause; set => SetField(ref _canPause, value); }
    public bool CanResume { get => _canResume; set => SetField(ref _canResume, value); }
    public bool CanStop { get => _canStop; set => SetField(ref _canStop, value); }

    public TimerViewModel(SessionManager sessionManager, ITimerService timerService)
    {
        _sessionManager = sessionManager;
        _timerService = timerService;

        _timerService.Tick += elapsed =>
        {
            FormattedTime = elapsed.ToString(@"hh\:mm\:ss");
        };

        _sessionManager.SessionChanged += session =>
        {
            if (session == null)
            {
                StatusDisplay = "Idle";
                CanStart = true;
                CanPause = false;
                CanResume = false;
                CanStop = false;
                FormattedTime = "00:00:00";
            }
            else
            {
                StatusDisplay = session.Status.ToString();
                TaskTitle = session.TaskTitle ?? "No Task Selected";
                CanStart = session.Status == SessionStatus.Stopped || session.Status == SessionStatus.Idle;
                CanPause = session.Status == SessionStatus.Running;
                CanResume = session.Status == SessionStatus.Paused;
                CanStop = session.Status == SessionStatus.Running || session.Status == SessionStatus.Paused;
            }
        };
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    protected void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }

    protected bool SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return false;
        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }
}
