using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using FinovoTracker.Api;
using FinovoTracker.Security;
using FinovoTracker.UI;

namespace FinovoTracker
{
    static class Program
    {
        [DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        private const string MutexName = "Finovo.Global.TimeTracker.SingleInstance.Mutex";

        [STAThread]
        static void Main()
        {
            try
            {
                if (Environment.OSVersion.Version.Major >= 6)
                {
                    SetProcessDPIAware();
                }
            }
            catch { }

            bool createdNew;
            using (var mutex = new Mutex(true, MutexName, out createdNew))
            {
                if (!createdNew)
                {
                    MessageBox.Show("Finovo Global Time Tracker is already running in your system tray.", "Finovo Tracker", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                // Setup global crash handler
                AppDomain.CurrentDomain.UnhandledException += (s, e) =>
                {
                    try
                    {
                        string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Finovo", "TimeTracker");
                        if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                        string crashFile = Path.Combine(dir, "crash.log");
                        File.AppendAllText(crashFile, string.Format("[{0:O}] CRASH: {1}\n", DateTime.UtcNow, e.ExceptionObject));
                    }
                    catch { }
                };

                var apiClient = new FinovoApiClient("http://127.0.0.1:8000");

                // Check for existing DPAPI-encrypted user session
                var session = WindowsProtectedStorage.LoadSession();
                if (session != null && !string.IsNullOrEmpty(session.Token))
                {
                    apiClient.BearerToken = session.Token;
                    // Launch directly to tracking dashboard
                    Application.Run(new TrackerForm(apiClient, session));
                }
                else
                {
                    // Launch login window
                    Application.Run(new LoginForm(apiClient));
                }
            }
        }
    }
}

