using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using FinovoTracker.Core;
using Drawing = System.Drawing;
using DrawingImaging = System.Drawing.Imaging;
using Forms = System.Windows.Forms;

namespace FinovoTracker.Views
{
    public partial class TrackerWindow : Window
    {
        private readonly FinovoApiClient _apiClient;
        private readonly UserSession _session;
        private readonly Win32LifecycleManager _lifecycleManager;

        private DispatcherTimer _secondTimer;
        private DispatcherTimer _syncTimer;

        private const int ScreenCapturePollIntervalMs = 3000;
        private const long ScreenCaptureJpegQuality = 80L;
        private FinovoApiClient _screenCaptureApiClient;
        private System.Threading.Timer _screenCaptureTimer;
        private int _isScreenCaptureBusy;

        private string _activeMode = "task"; // "task", "research", "learning"
        private bool _isTracking = false;
        private bool _isPaused = false;
        private DateTime? _trackingStartedUtc = null;
        private TimeSpan _accumulatedTime = TimeSpan.Zero;
        private DateTime _lastTickUtc = DateTime.UtcNow;
        private long _currentSessionId = 0;

        private List<ProjectDto> _cachedProjects = new List<ProjectDto>();

        public TrackerWindow(FinovoApiClient apiClient, UserSession session)
        {
            _apiClient = apiClient;
            _session = session;
            _lifecycleManager = new Win32LifecycleManager();

            InitializeComponent();
            SetupProfileUi();
            SetupLifecycleHooks();
            LoadProjectsAndState();
            StartTimers();
            StartScreenCaptureAgent();
        }

        private void SetupProfileUi()
        {
            if (!string.IsNullOrEmpty(_session.UserName))
            {
                TxtUserName.Text = _session.UserName;
                TxtAvatarInitial.Text = _session.UserName.Substring(0, 1).ToUpper();
            }
            if (!string.IsNullOrEmpty(_session.CompanyName))
            {
                TxtOrgName.Text = _session.CompanyName;
            }
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
            WindowState = WindowState.Minimized;
        }

        private void OnWorkTabClicked(object sender, MouseButtonEventArgs e)
        {
            SelectMode("task");
        }

        private void OnResearchTabClicked(object sender, MouseButtonEventArgs e)
        {
            SelectMode("research");
        }

        private void OnLearningTabClicked(object sender, MouseButtonEventArgs e)
        {
            SelectMode("learning");
        }

        private void SelectMode(string mode)
        {
            _activeMode = mode;
            var primaryBrush = (Brush)FindResource("BrushPrimaryGradient");
            var darkCardBrush = (Brush)FindResource("BrushCardBg");
            var borderBrush = (Brush)FindResource("BrushCardBorder");

            // Work
            TabWork.Background = mode == "task" ? primaryBrush : darkCardBrush;
            TabWork.BorderBrush = mode == "task" ? Brushes.Transparent : borderBrush;
            TxtTabWork.Foreground = mode == "task" ? Brushes.White : (Brush)FindResource("BrushTextMuted");

            // Research
            TabResearch.Background = mode == "research" ? primaryBrush : darkCardBrush;
            TabResearch.BorderBrush = mode == "research" ? Brushes.Transparent : borderBrush;
            TxtTabResearch.Foreground = mode == "research" ? Brushes.White : (Brush)FindResource("BrushTextMuted");

            // Learning
            TabLearning.Background = mode == "learning" ? primaryBrush : darkCardBrush;
            TabLearning.BorderBrush = mode == "learning" ? Brushes.Transparent : borderBrush;
            TxtTabLearning.Foreground = mode == "learning" ? Brushes.White : (Brush)FindResource("BrushTextMuted");
        }

        private void SetupLifecycleHooks()
        {
            _lifecycleManager.IdleStateChanged += (isIdle) =>
            {
                Dispatcher.Invoke(() =>
                {
                    if (isIdle && _isTracking && !_isPaused)
                    {
                        PauseTracking(isAutoIdle: true);
                    }
                });
            };

            _lifecycleManager.SessionLockChanged += (isLocked) =>
            {
                Dispatcher.Invoke(() =>
                {
                    if (isLocked && _isTracking && !_isPaused)
                    {
                        PauseTracking(isAutoIdle: true);
                    }
                });
            };
        }

        private void LoadProjectsAndState()
        {
            try
            {
                _cachedProjects = _apiClient.GetProjects(_session.CompanySlug);
                CmbProjects.Items.Clear();

                foreach (var p in _cachedProjects)
                {
                    CmbProjects.Items.Add(p.DisplayText);
                }

                if (CmbProjects.Items.Count > 0) CmbProjects.SelectedIndex = 0;

                // Check active server session
                var active = _apiClient.GetCurrentSession(_session.CompanySlug);
                if (active != null && active.Status == "running")
                {
                    _isTracking = true;
                    _currentSessionId = active.Id;
                    _trackingStartedUtc = active.StartedAtUtc;
                    _accumulatedTime = DateTime.UtcNow - active.StartedAtUtc;
                    UpdateTrackingUi(true);
                }
            }
            catch { }
        }

        private void OnProjectChanged(object sender, SelectionChangedEventArgs e)
        {
            int idx = CmbProjects.SelectedIndex;
            CmbTasks.Items.Clear();
            CmbTasks.Items.Add("-- No Specific Task (Project Level) --");

            if (idx >= 0 && idx < _cachedProjects.Count)
            {
                var proj = _cachedProjects[idx];
                var tasks = _apiClient.GetTasks(_session.CompanySlug, proj.Id);
                foreach (var t in tasks)
                {
                    CmbTasks.Items.Add(t.DisplayText);
                }
            }
            CmbTasks.SelectedIndex = 0;
        }

        private void StartTimers()
        {
            _secondTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
            _secondTimer.Tick += (s, e) =>
            {
                _lifecycleManager.CheckIdleStatus();

                if (_isTracking && !_isPaused)
                {
                    var now = DateTime.UtcNow;
                    _accumulatedTime += (now - _lastTickUtc);
                    _lastTickUtc = now;

                    TxtTimerDigits.Text = string.Format("{0:00}:{1:00}:{2:00}",
                        (int)_accumulatedTime.TotalHours,
                        _accumulatedTime.Minutes,
                        _accumulatedTime.Seconds);
                }
            };
            _secondTimer.Start();

            _syncTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(30) };
            _syncTimer.Tick += (s, e) =>
            {
                try
                {
                    var pending = DurableOfflineQueue.GetPendingEvents(25);
                    if (pending != null && pending.Count > 0)
                    {
                        string devUid = WindowsProtectedStorage.GetOrCreateDeviceUid();
                        bool ok = _apiClient.SyncBatch(_session.CompanySlug, devUid, pending);
                        if (ok)
                        {
                            var ids = new List<string>();
                            foreach (var p in pending) ids.Add(p.EventId);
                            DurableOfflineQueue.MarkSynchronized(ids);
                        }
                    }
                }
                catch { }
            };
            _syncTimer.Start();
        }

        /// <summary>
        /// Answers administrator screenshot requests in the background.
        /// Runs on a thread-pool timer with its own API client so the UI thread is never blocked.
        /// </summary>
        private void StartScreenCaptureAgent()
        {
            _screenCaptureApiClient = new FinovoApiClient(_apiClient.BaseUrl) { BearerToken = _apiClient.BearerToken };
            _screenCaptureTimer = new System.Threading.Timer(OnScreenCaptureTick, null, 0, ScreenCapturePollIntervalMs);
        }

        private void StopScreenCaptureAgent()
        {
            if (_screenCaptureTimer != null)
            {
                _screenCaptureTimer.Dispose();
                _screenCaptureTimer = null;
            }
        }

        private void OnScreenCaptureTick(object state)
        {
            if (Interlocked.Exchange(ref _isScreenCaptureBusy, 1) == 1) return;

            try
            {
                ScreenCaptureRequestDto request;
                try
                {
                    request = _screenCaptureApiClient.CheckScreenCaptureRequest();
                }
                catch
                {
                    // Backend unreachable or token expired: retry on the next tick.
                    return;
                }

                if (request == null) return;

                try
                {
                    byte[] jpegBytes = CaptureVirtualScreenAsJpeg();
                    _screenCaptureApiClient.SubmitScreenCapture(request, jpegBytes);
                }
                catch (Exception ex)
                {
                    WriteScreenCaptureLog(ex);
                }
            }
            finally
            {
                Interlocked.Exchange(ref _isScreenCaptureBusy, 0);
            }
        }

        /// <summary>
        /// Captures every connected monitor (the full virtual desktop) and encodes it as JPEG.
        /// </summary>
        private static byte[] CaptureVirtualScreenAsJpeg()
        {
            Drawing.Rectangle bounds = Forms.SystemInformation.VirtualScreen;

            using (var bitmap = new Drawing.Bitmap(bounds.Width, bounds.Height, DrawingImaging.PixelFormat.Format24bppRgb))
            {
                using (var graphics = Drawing.Graphics.FromImage(bitmap))
                {
                    graphics.CopyFromScreen(bounds.Left, bounds.Top, 0, 0, bounds.Size, Drawing.CopyPixelOperation.SourceCopy);
                }

                using (var stream = new MemoryStream())
                {
                    DrawingImaging.ImageCodecInfo jpegEncoder = Array.Find(
                        DrawingImaging.ImageCodecInfo.GetImageEncoders(),
                        codec => codec.FormatID == DrawingImaging.ImageFormat.Jpeg.Guid);

                    if (jpegEncoder == null)
                    {
                        bitmap.Save(stream, DrawingImaging.ImageFormat.Jpeg);
                    }
                    else
                    {
                        using (var encoderParameters = new DrawingImaging.EncoderParameters(1))
                        {
                            encoderParameters.Param[0] = new DrawingImaging.EncoderParameter(DrawingImaging.Encoder.Quality, ScreenCaptureJpegQuality);
                            bitmap.Save(stream, jpegEncoder, encoderParameters);
                        }
                    }

                    return stream.ToArray();
                }
            }
        }

        private static void WriteScreenCaptureLog(Exception ex)
        {
            try
            {
                string directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Finovo", "TimeTracker");
                if (!Directory.Exists(directory)) Directory.CreateDirectory(directory);
                File.AppendAllText(Path.Combine(directory, "screen_capture.log"), string.Format("[{0:O}] {1}{2}", DateTime.UtcNow, ex, Environment.NewLine));
            }
            catch { }
        }

        private void OnStartTrackingClicked(object sender, RoutedEventArgs e)
        {
            if (!_isTracking)
            {
                StartTracking();
            }
            else
            {
                StopTracking();
            }
        }

        private void StartTracking()
        {
            long? projId = null;
            int projIdx = CmbProjects.SelectedIndex;
            if (projIdx >= 0 && projIdx < _cachedProjects.Count) projId = _cachedProjects[projIdx].Id;

            long? taskId = null;
            string memo = TxtMemo.Text.Trim();
            string devUid = WindowsProtectedStorage.GetOrCreateDeviceUid();

            try
            {
                var s = _apiClient.StartSession(_session.CompanySlug, projId, taskId, _activeMode, memo, devUid);
                _currentSessionId = s.Id;
            }
            catch
            {
                _currentSessionId = DateTime.UtcNow.Ticks;
                DurableOfflineQueue.Enqueue(new OfflineEvent
                {
                    EventType = "start",
                    LocalSessionId = _currentSessionId,
                    ProjectId = projId,
                    TaskId = taskId,
                    ActivityType = _activeMode,
                    Description = memo,
                    StartedAtUtc = DateTime.UtcNow
                });
            }

            _isTracking = true;
            _isPaused = false;
            _trackingStartedUtc = DateTime.UtcNow;
            _accumulatedTime = TimeSpan.Zero;
            _lastTickUtc = DateTime.UtcNow;

            UpdateTrackingUi(true);
        }

        private void PauseTracking(bool isAutoIdle = false)
        {
            if (!_isTracking || _isPaused) return;

            try
            {
                _apiClient.PauseSession(_session.CompanySlug, _currentSessionId);
            }
            catch { }

            _isPaused = true;
            TxtStatusBadge.Text = "PAUSED";
            TxtStatusBadge.Foreground = (Brush)FindResource("BrushYellow");
            BorderStatusPill.BorderBrush = (Brush)FindResource("BrushYellow");
            BorderStatusPill.Background = new SolidColorBrush(Color.FromRgb(35, 28, 8));
            TxtTimerSubtitle.Text = isAutoIdle ? "Auto-paused: User inactivity detected." : "Tracking paused.";
            BtnStartTracking.Content = "▶   Resume Tracking";
        }

        private void StopTracking()
        {
            if (!_isTracking) return;

            try
            {
                _apiClient.StopSession(_session.CompanySlug, _currentSessionId);
            }
            catch
            {
                DurableOfflineQueue.Enqueue(new OfflineEvent
                {
                    EventType = "stop",
                    LocalSessionId = _currentSessionId,
                    StartedAtUtc = _trackingStartedUtc ?? DateTime.UtcNow,
                    EndedAtUtc = DateTime.UtcNow,
                    DurationSeconds = (int)_accumulatedTime.TotalSeconds
                });
            }

            _isTracking = false;
            _isPaused = false;
            _accumulatedTime = TimeSpan.Zero;
            _currentSessionId = 0;

            UpdateTrackingUi(false);
        }

        private void UpdateTrackingUi(bool tracking)
        {
            if (tracking)
            {
                TxtStatusBadge.Text = "TRACKING";
                TxtStatusBadge.Foreground = (Brush)FindResource("BrushGreen");
                BorderStatusPill.BorderBrush = (Brush)FindResource("BrushGreen");
                BorderStatusPill.Background = new SolidColorBrush(Color.FromRgb(8, 34, 24));

                string projText = CmbProjects.SelectedItem != null ? CmbProjects.SelectedItem.ToString() : "Active Project";
                TxtTimerSubtitle.Text = string.Format("Active: {0}", projText);

                BtnStartTracking.Content = "⏹   Stop Tracking";
                BtnStartTracking.Background = new LinearGradientBrush(Color.FromRgb(240, 70, 70), Color.FromRgb(220, 38, 38), 90);
            }
            else
            {
                TxtStatusBadge.Text = "READY";
                TxtStatusBadge.Foreground = (Brush)FindResource("BrushGreen");
                BorderStatusPill.BorderBrush = (Brush)FindResource("BrushGreen");
                BorderStatusPill.Background = new SolidColorBrush(Color.FromRgb(8, 34, 24));

                TxtTimerDigits.Text = "00:00:00";
                TxtTimerSubtitle.Text = "Ready to track. Select project or enter notes.";

                BtnStartTracking.Content = "▶   Start Tracking";
                BtnStartTracking.Background = (Brush)FindResource("BrushPrimaryGradient");
            }
        }

        private void OnLogoutClicked(object sender, RoutedEventArgs e)
        {
            if (MessageBox.Show("Are you sure you want to sign out of Finovo Global Enterprise?", "Sign Out", MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes)
            {
                if (_isTracking) StopTracking();
                StopScreenCaptureAgent();
                WindowsProtectedStorage.ClearSession();
                var login = new LoginWindow(_apiClient);
                login.Show();
                Close();
            }
        }

        protected override void OnClosed(EventArgs e)
        {
            StopScreenCaptureAgent();
            _lifecycleManager.Dispose();
            base.OnClosed(e);
        }
    }
}

