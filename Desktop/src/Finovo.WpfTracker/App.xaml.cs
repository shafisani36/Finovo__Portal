using System;
using System.IO;
using System.Threading;
using System.Windows;
using FinovoTracker.Core;
using FinovoTracker.Views;

namespace FinovoTracker
{
    public partial class App : Application
    {
        private Mutex _mutex;
        private const string MutexName = "Finovo.Global.Wpf.Tracker.SingleInstance";

        protected override void OnStartup(StartupEventArgs e)
        {
            bool createdNew;
            _mutex = new Mutex(true, MutexName, out createdNew);

            if (!createdNew)
            {
                MessageBox.Show("Finovo Global Time Tracker is already running.", "Finovo Tracker", MessageBoxButton.OK, MessageBoxImage.Information);
                Shutdown();
                return;
            }

            base.OnStartup(e);

            AppDomain.CurrentDomain.UnhandledException += (s, args) =>
            {
                try
                {
                    string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Finovo", "TimeTracker");
                    if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                    File.AppendAllText(Path.Combine(dir, "wpf_crash.log"), string.Format("[{0:O}] {1}\n", DateTime.UtcNow, args.ExceptionObject));
                }
                catch { }
            };

            var apiClient = new FinovoApiClient("http://127.0.0.1:8000");
            var session = WindowsProtectedStorage.LoadSession();

            if (session != null && !string.IsNullOrEmpty(session.Token))
            {
                apiClient.BearerToken = session.Token;
                var trackerWindow = new TrackerWindow(apiClient, session);
                trackerWindow.Show();
            }
            else
            {
                var loginWindow = new LoginWindow(apiClient);
                loginWindow.Show();
            }
        }

        protected override void OnExit(ExitEventArgs e)
        {
            if (_mutex != null)
            {
                _mutex.ReleaseMutex();
                _mutex.Dispose();
            }
            base.OnExit(e);
        }
    }
}

