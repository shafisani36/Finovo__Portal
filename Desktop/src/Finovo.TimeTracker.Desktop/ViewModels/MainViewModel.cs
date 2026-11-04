using System.ComponentModel;
using System.Runtime.CompilerServices;
using Finovo.TimeTracker.Application.Sessions;
using Finovo.TimeTracker.Application.Synchronization;

namespace Finovo.TimeTracker.Desktop.ViewModels;

public class MainViewModel : INotifyPropertyChanged
{
    public TimerViewModel Timer { get; }
    public SessionManager SessionManager { get; }
    public SyncEngine SyncEngine { get; }

    private string _companySlug = "finovo-tech";
    private string _syncStatusText = "Synced";
    private bool _isOnline = true;

    public string CompanySlug
    {
        get => _companySlug;
        set => SetField(ref _companySlug, value);
    }

    public string SyncStatusText
    {
        get => _syncStatusText;
        set => SetField(ref _syncStatusText, value);
    }

    public bool IsOnline
    {
        get => _isOnline;
        set => SetField(ref _isOnline, value);
    }

    public MainViewModel(SessionManager sessionManager, SyncEngine syncEngine, TimerViewModel timer)
    {
        SessionManager = sessionManager;
        SyncEngine = syncEngine;
        Timer = timer;

        SyncEngine.SyncStatusChanged += syncing =>
        {
            SyncStatusText = syncing ? "Synchronizing offline queue..." : "Synced with Finovo Portal";
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
