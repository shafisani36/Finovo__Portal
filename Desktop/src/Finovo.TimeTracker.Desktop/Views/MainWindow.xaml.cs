using System.Windows;
using Finovo.TimeTracker.Desktop.ViewModels;
using Finovo.TimeTracker.Infrastructure.Api;
using Finovo.TimeTracker.Infrastructure.Diagnostics;
using Finovo.TimeTracker.Infrastructure.LocalStorage;
using Finovo.TimeTracker.Application.Sessions;
using Finovo.TimeTracker.Application.Synchronization;

namespace Finovo.TimeTracker.Desktop.Views;

public partial class MainWindow : Window
{
    private readonly MainViewModel _vm;

    public MainWindow()
    {
        InitializeComponent();

        var httpClient = new HttpClient { BaseAddress = new Uri("http://127.0.0.1:8000") };
        var apiClient = new TimeTrackerApiClient(httpClient);
        var offlineQueue = new SqliteOfflineQueue();
        var timerService = new StopwatchTimerService();

        var sessionManager = new SessionManager(apiClient, offlineQueue, timerService);
        var syncEngine = new SyncEngine(apiClient, offlineQueue);
        var timerVm = new TimerViewModel(sessionManager, timerService);

        _vm = new MainViewModel(sessionManager, syncEngine, timerVm);
        DataContext = _vm;
    }

    private async void OnStartClicked(object sender, RoutedEventArgs e)
    {
        await _vm.SessionManager.StartSessionAsync(_vm.CompanySlug, taskId: null, taskTitle: "Active Task Session");
    }

    private async void OnPauseClicked(object sender, RoutedEventArgs e)
    {
        await _vm.SessionManager.PauseSessionAsync(_vm.CompanySlug);
    }

    private async void OnResumeClicked(object sender, RoutedEventArgs e)
    {
        await _vm.SessionManager.ResumeSessionAsync(_vm.CompanySlug);
    }

    private async void OnStopClicked(object sender, RoutedEventArgs e)
    {
        await _vm.SessionManager.StopSessionAsync(_vm.CompanySlug);
        await _vm.SyncEngine.FlushQueueAsync(_vm.CompanySlug);
    }
}
