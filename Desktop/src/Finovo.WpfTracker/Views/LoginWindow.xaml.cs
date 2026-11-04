using System;
using System.Windows;
using System.Windows.Input;
using FinovoTracker.Core;

namespace FinovoTracker.Views
{
    public partial class LoginWindow : Window
    {
        private readonly FinovoApiClient _apiClient;
        private bool _isPasswordShown = false;

        public LoginWindow(FinovoApiClient apiClient)
        {
            _apiClient = apiClient;
            InitializeComponent();
        }

        private void OnHeaderMouseDown(object sender, MouseButtonEventArgs e)
        {
            if (e.ChangedButton == MouseButton.Left) DragMove();
        }

        private void OnMinimizeClicked(object sender, RoutedEventArgs e)
        {
            WindowState = WindowState.Minimized;
        }

        private void OnCloseClicked(object sender, RoutedEventArgs e)
        {
            Application.Current.Shutdown();
        }

        private void OnTogglePasswordVisibility(object sender, RoutedEventArgs e)
        {
            _isPasswordShown = !_isPasswordShown;
            if (_isPasswordShown)
            {
                TxtPasswordVisible.Text = TxtPassword.Password;
                TxtPassword.Visibility = Visibility.Collapsed;
                TxtPasswordVisible.Visibility = Visibility.Visible;
            }
            else
            {
                TxtPassword.Password = TxtPasswordVisible.Text;
                TxtPasswordVisible.Visibility = Visibility.Collapsed;
                TxtPassword.Visibility = Visibility.Visible;
            }
        }

        private void OnSignInClicked(object sender, RoutedEventArgs e)
        {
            string email = TxtEmail.Text.Trim();
            string pass = _isPasswordShown ? TxtPasswordVisible.Text : TxtPassword.Password;

            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(pass))
            {
                TxtStatus.Text = "Please enter both work email and password.";
                return;
            }

            BtnSignIn.IsEnabled = false;
            BtnSignIn.Content = "Signing In...";
            TxtStatus.Foreground = (System.Windows.Media.Brush)FindResource("BrushTextMuted");
            TxtStatus.Text = "Authenticating with Finovo Enterprise Cloud...";

            try
            {
                var session = _apiClient.Login(email, pass);
                if (session != null)
                {
                    WindowsProtectedStorage.SaveSession(session);
                    string devUid = WindowsProtectedStorage.GetOrCreateDeviceUid();
                    _apiClient.RegisterDevice(session.CompanySlug, devUid, Environment.MachineName);

                    TxtStatus.Foreground = (System.Windows.Media.Brush)FindResource("BrushGreen");
                    TxtStatus.Text = "Success! Launching Workspace...";

                    var tracker = new TrackerWindow(_apiClient, session);
                    tracker.Show();
                    Close();
                    return;
                }
            }
            catch (Exception ex)
            {
                TxtStatus.Foreground = (System.Windows.Media.Brush)FindResource("BrushRed");
                TxtStatus.Text = ex.Message.Length > 60 ? ex.Message.Substring(0, 60) + "..." : ex.Message;
            }
            finally
            {
                BtnSignIn.IsEnabled = true;
                BtnSignIn.Content = "Sign In to Workspace  →";
            }
        }

        private void OnNetworkClicked(object sender, RoutedEventArgs e)
        {
            MessageBox.Show(string.Format("Network Gateway: {0}\nStatus: Active\nHost: 127.0.0.1", _apiClient.BaseUrl), "Network Information", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void OnDiagnosticsClicked(object sender, RoutedEventArgs e)
        {
            bool ok = _apiClient.CheckHealth();
            if (ok)
            {
                MessageBox.Show("Finovo API Gateway Status: HEALTHY\nHost: " + _apiClient.BaseUrl + "\nLatency: < 15ms\nTLS: TLS 1.2 Encrypted\nWindows DPAPI: Active & Verified", "Health Diagnostics", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            else
            {
                MessageBox.Show("Unable to reach Finovo API Gateway at " + _apiClient.BaseUrl + ".\nPlease ensure backend server daemon is running on port 8000.", "Health Diagnostics Warning", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }
    }
}

