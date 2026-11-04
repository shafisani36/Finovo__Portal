using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using FinovoTracker.Api;
using FinovoTracker.Monitoring;
using FinovoTracker.Security;
using FinovoTracker.Storage;

namespace FinovoTracker.UI
{
    public class TrackerForm : Form
    {
        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();
        [DllImport("user32.dll")]
        public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);
        private const int WM_NCLBUTTONDOWN = 0xA1;
        private const int HTCAPTION = 0x2;

        private readonly FinovoApiClient _apiClient;
        private readonly UserSession _session;
        private readonly Win32LifecycleManager _lifecycleManager;

        // UI Controls
        private Label lblTimerDigits;
        private Label lblTimerSubtitle;
        private Label lblStatusPill;
        private Button btnModeWork;
        private Button btnModeResearch;
        private Button btnModeLearning;
        private ComboBox cmbProjects;
        private ComboBox cmbTasks;
        private TextBox txtSessionMemo;
        private Button btnPrimaryAction;
        private NotifyIcon trayIcon;
        private ContextMenuStrip trayMenu;

        // State variables
        private string _activeMode = "task"; // "task", "research", "learning"
        private bool _isTracking = false;
        private bool _isPaused = false;
        private DateTime? _trackingStartedUtc = null;
        private TimeSpan _accumulatedTime = TimeSpan.Zero;
        private DateTime _lastTickUtc = DateTime.UtcNow;
        private long _currentSessionId = 0;
        private List<ProjectDto> _cachedProjects = new List<ProjectDto>();
        private List<TaskDto> _cachedTasks = new List<TaskDto>();

        private Timer _secondTimer;
        private Timer _syncTimer;

        public TrackerForm(FinovoApiClient apiClient, UserSession session)
        {
            _apiClient = apiClient;
            _session = session;
            _lifecycleManager = new Win32LifecycleManager();

            InitializeComponent();
            SetupLifecycleHooks();
            LoadProjectsAndState();
        }

        private void InitializeComponent()
        {
            this.Size = new Size(460, 780);
            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Theme.BgDark;
            this.DoubleBuffered = true;

            // Header Title Bar
            var pnlTopHeader = new Panel
            {
                Location = new Point(16, 12),
                Size = new Size(300, 36),
                BackColor = Color.Transparent
            };
            pnlTopHeader.Paint += OnTopHeaderPaint;
            pnlTopHeader.MouseDown += OnTitleMouseDown;
            this.MouseDown += OnTitleMouseDown;
            this.Controls.Add(pnlTopHeader);

            // Close & Minimize Buttons
            var btnClose = new Button
            {
                Text = "✕",
                Font = new Font("Segoe UI", 9f),
                ForeColor = Theme.TextMuted,
                BackColor = Color.Transparent,
                FlatStyle = FlatStyle.Flat,
                Size = new Size(36, 30),
                Location = new Point(415, 10),
                Cursor = Cursors.Hand
            };
            btnClose.FlatAppearance.BorderSize = 0;
            btnClose.Click += (s, e) => this.Hide(); // Minimize to tray
            this.Controls.Add(btnClose);

            var btnMin = new Button
            {
                Text = "—",
                Font = new Font("Segoe UI", 9f),
                ForeColor = Theme.TextMuted,
                BackColor = Color.Transparent,
                FlatStyle = FlatStyle.Flat,
                Size = new Size(36, 30),
                Location = new Point(375, 10),
                Cursor = Cursors.Hand
            };
            btnMin.FlatAppearance.BorderSize = 0;
            btnMin.Click += (s, e) => this.WindowState = FormWindowState.Minimized;
            this.Controls.Add(btnMin);

            // 1. User Profile Header Card
            var pnlProfile = new Panel
            {
                Size = new Size(420, 68),
                Location = new Point(20, 56),
                BackColor = Theme.CardBg
            };
            pnlProfile.Paint += (s, e) =>
            {
                Theme.FillRoundedRect(e.Graphics, new SolidBrush(Theme.CardBg), new Rectangle(0, 0, pnlProfile.Width, pnlProfile.Height), 12);
                Theme.DrawRoundedRect(e.Graphics, new Pen(Theme.CardBorder), new Rectangle(0, 0, pnlProfile.Width - 1, pnlProfile.Height - 1), 12);

                // Avatar Circle
                var avRect = new Rectangle(14, 12, 44, 44);
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using (var avBrush = new LinearGradientBrush(avRect, Theme.PrimaryHover, Theme.Primary, LinearGradientMode.ForwardDiagonal))
                {
                    e.Graphics.FillEllipse(avBrush, avRect);
                }
                string initial = !string.IsNullOrEmpty(_session.UserName) ? _session.UserName.Substring(0, 1).ToUpper() : "U";
                using (var font = new Font("Segoe UI", 14f, FontStyle.Bold))
                using (var textBrush = new SolidBrush(Color.White))
                {
                    var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                    e.Graphics.DrawString(initial, font, textBrush, avRect, sf);
                }
            };

            var lblUserName = new Label
            {
                Text = _session.UserName,
                Font = Theme.FontSubheading,
                ForeColor = Theme.TextWhite,
                Location = new Point(68, 14),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            pnlProfile.Controls.Add(lblUserName);

            var lblOrg = new Label
            {
                Text = _session.CompanyName ?? "Finovo Global Enterprise",
                Font = Theme.FontSmall,
                ForeColor = Theme.TextMuted,
                Location = new Point(68, 36),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            pnlProfile.Controls.Add(lblOrg);

            // Status Pill (• READY / TRACKING)
            lblStatusPill = new Label
            {
                Text = "• READY",
                Font = Theme.FontSmallBold,
                ForeColor = Theme.GreenSuccess,
                BackColor = Color.FromArgb(10, 35, 25),
                TextAlign = ContentAlignment.MiddleCenter,
                Size = new Size(86, 26),
                Location = new Point(275, 21)
            };
            lblStatusPill.Paint += (s, e) => Theme.DrawRoundedRect(e.Graphics, new Pen(Theme.GreenSuccess), new Rectangle(0, 0, lblStatusPill.Width - 1, lblStatusPill.Height - 1), 12);
            pnlProfile.Controls.Add(lblStatusPill);

            // Power / Logout Button
            var btnPower = new Button
            {
                Text = "⏻",
                Font = new Font("Segoe UI", 12f, FontStyle.Bold),
                ForeColor = Theme.TextMuted,
                BackColor = Color.Transparent,
                FlatStyle = FlatStyle.Flat,
                Size = new Size(34, 34),
                Location = new Point(374, 17),
                Cursor = Cursors.Hand
            };
            btnPower.FlatAppearance.BorderSize = 0;
            btnPower.Click += OnLogoutClicked;
            pnlProfile.Controls.Add(btnPower);

            this.Controls.Add(pnlProfile);

            // 2. Large Session Duration Timer Card
            var pnlTimerCard = new Panel
            {
                Size = new Size(420, 160),
                Location = new Point(20, 134),
                BackColor = Theme.CardBg
            };
            pnlTimerCard.Paint += (s, e) =>
            {
                Theme.FillRoundedRect(e.Graphics, new SolidBrush(Theme.CardBg), new Rectangle(0, 0, pnlTimerCard.Width, pnlTimerCard.Height), 16);
                Theme.DrawRoundedRect(e.Graphics, new Pen(Theme.CardBorder, 1.2f), new Rectangle(0, 0, pnlTimerCard.Width - 1, pnlTimerCard.Height - 1), 16);
            };

            var lblDurationTag = new Label
            {
                Text = "⏱  SESSION DURATION",
                Font = Theme.FontSmallBold,
                ForeColor = Theme.Primary,
                Location = new Point(16, 14),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            pnlTimerCard.Controls.Add(lblDurationTag);

            lblTimerDigits = new Label
            {
                Text = "00:00:00",
                Font = Theme.FontDigits,
                ForeColor = Theme.TextWhite,
                TextAlign = ContentAlignment.MiddleCenter,
                Size = new Size(390, 65),
                Location = new Point(15, 42),
                BackColor = Color.Transparent
            };
            pnlTimerCard.Controls.Add(lblTimerDigits);

            lblTimerSubtitle = new Label
            {
                Text = "Ready to track. Select project or enter notes.",
                Font = Theme.FontSmall,
                ForeColor = Theme.TextMuted,
                TextAlign = ContentAlignment.MiddleCenter,
                Size = new Size(390, 24),
                Location = new Point(15, 115),
                BackColor = Color.Transparent
            };
            pnlTimerCard.Controls.Add(lblTimerSubtitle);

            this.Controls.Add(pnlTimerCard);

            // 3. Three Mode Switch Tabs (Work, Research, Learning)
            var pnlModeTabs = new Panel
            {
                Size = new Size(420, 44),
                Location = new Point(20, 304),
                BackColor = Color.Transparent
            };

            btnModeWork = CreateModeButton("💼 Work", 0, true);
            btnModeResearch = CreateModeButton("🔬 Research", 143, false);
            btnModeLearning = CreateModeButton("📖 Learning", 286, false);

            btnModeWork.Click += (s, e) => SelectMode("task");
            btnModeResearch.Click += (s, e) => SelectMode("research");
            btnModeLearning.Click += (s, e) => SelectMode("learning");

            pnlModeTabs.Controls.Add(btnModeWork);
            pnlModeTabs.Controls.Add(btnModeResearch);
            pnlModeTabs.Controls.Add(btnModeLearning);
            this.Controls.Add(pnlModeTabs);

            // 4. Form Fields Card (Assigned Project, Task Milestone, Session Memo)
            var pnlFields = new Panel
            {
                Size = new Size(420, 305),
                Location = new Point(20, 358),
                BackColor = Theme.CardBg
            };
            pnlFields.Paint += (s, e) =>
            {
                Theme.FillRoundedRect(e.Graphics, new SolidBrush(Theme.CardBg), new Rectangle(0, 0, pnlFields.Width, pnlFields.Height), 14);
                Theme.DrawRoundedRect(e.Graphics, new Pen(Theme.CardBorder), new Rectangle(0, 0, pnlFields.Width - 1, pnlFields.Height - 1), 14);
            };

            // Assigned Project Label & ComboBox
            var lblProjTag = new Label
            {
                Text = "📁  ASSIGNED PROJECT",
                Font = Theme.FontSmallBold,
                ForeColor = Theme.TextMuted,
                Location = new Point(16, 12),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            pnlFields.Controls.Add(lblProjTag);

            cmbProjects = new ComboBox
            {
                DropDownStyle = ComboBoxStyle.DropDownList,
                BackColor = Theme.InputBg,
                ForeColor = Theme.TextWhite,
                Font = Theme.FontBody,
                Size = new Size(388, 28),
                Location = new Point(16, 34),
                FlatStyle = FlatStyle.Flat
            };
            cmbProjects.SelectedIndexChanged += OnProjectSelectionChanged;
            pnlFields.Controls.Add(cmbProjects);

            // Task Milestone Label & ComboBox
            var lblTaskTag = new Label
            {
                Text = "🎯  TASK MILESTONE (OPTIONAL)",
                Font = Theme.FontSmallBold,
                ForeColor = Theme.TextMuted,
                Location = new Point(16, 76),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            pnlFields.Controls.Add(lblTaskTag);

            cmbTasks = new ComboBox
            {
                DropDownStyle = ComboBoxStyle.DropDownList,
                BackColor = Theme.InputBg,
                ForeColor = Theme.TextWhite,
                Font = Theme.FontBody,
                Size = new Size(388, 28),
                Location = new Point(16, 98),
                FlatStyle = FlatStyle.Flat
            };
            pnlFields.Controls.Add(cmbTasks);

            // Session Memo Label & Textarea
            var lblMemoTag = new Label
            {
                Text = "📝  SESSION MEMO / WORK NOTES",
                Font = Theme.FontSmallBold,
                ForeColor = Theme.TextMuted,
                Location = new Point(16, 140),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            pnlFields.Controls.Add(lblMemoTag);

            txtSessionMemo = new TextBox
            {
                Multiline = true,
                BackColor = Theme.InputBg,
                ForeColor = Theme.TextWhite,
                Font = Theme.FontBody,
                Size = new Size(388, 80),
                Location = new Point(16, 162),
                BorderStyle = BorderStyle.FixedSingle,
                Text = ""
            };
            pnlFields.Controls.Add(txtSessionMemo);

            // Bottom Action Buttons Panel
            btnPrimaryAction = new Button
            {
                Text = "▶   Start Tracking",
                Font = Theme.FontSubheading,
                ForeColor = Color.White,
                BackColor = Theme.Primary,
                FlatStyle = FlatStyle.Flat,
                Size = new Size(388, 44),
                Location = new Point(16, 250),
                Cursor = Cursors.Hand
            };
            btnPrimaryAction.FlatAppearance.BorderSize = 0;
            btnPrimaryAction.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                Color fill = _isTracking ? Theme.RedDanger : Theme.Primary;
                using (var path = Theme.GetRoundedPath(new Rectangle(0, 0, btnPrimaryAction.Width, btnPrimaryAction.Height), 8))
                using (var brush = new SolidBrush(fill))
                {
                    e.Graphics.FillPath(brush, path);
                }
                var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                e.Graphics.DrawString(btnPrimaryAction.Text, btnPrimaryAction.Font, Brushes.White, new RectangleF(0, 0, btnPrimaryAction.Width, btnPrimaryAction.Height), sf);
            };
            btnPrimaryAction.Click += OnPrimaryActionClicked;
            pnlFields.Controls.Add(btnPrimaryAction);

            this.Controls.Add(pnlFields);

            // Setup Timers
            _secondTimer = new Timer { Interval = 1000 };
            _secondTimer.Tick += OnSecondTick;
            _secondTimer.Start();

            _syncTimer = new Timer { Interval = 30000 }; // 30s offline sync cycle
            _syncTimer.Tick += OnSyncTimerTick;
            _syncTimer.Start();

            // Tray Icon Setup
            trayMenu = new ContextMenuStrip();
            trayMenu.Items.Add("Show Finovo Tracker", null, (s, e) => { this.Show(); this.WindowState = FormWindowState.Normal; });
            trayMenu.Items.Add("-");
            trayMenu.Items.Add("Exit", null, (s, e) => Application.Exit());

            trayIcon = new NotifyIcon
            {
                Text = "Finovo Global Time Tracker",
                Icon = SystemIcons.Application,
                ContextMenuStrip = trayMenu,
                Visible = true
            };
            trayIcon.DoubleClick += (s, e) => { this.Show(); this.WindowState = FormWindowState.Normal; };
        }

        private Button CreateModeButton(string text, int x, bool active)
        {
            var btn = new Button
            {
                Text = text,
                Font = Theme.FontSmallBold,
                ForeColor = active ? Color.White : Theme.TextMuted,
                BackColor = active ? Theme.Primary : Theme.CardBg,
                FlatStyle = FlatStyle.Flat,
                Size = new Size(130, 42),
                Location = new Point(x, 0),
                Cursor = Cursors.Hand
            };
            btn.FlatAppearance.BorderSize = 0;
            btn.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using (var path = Theme.GetRoundedPath(new Rectangle(0, 0, btn.Width, btn.Height), 8))
                using (var brush = new SolidBrush(btn.BackColor))
                {
                    e.Graphics.FillPath(brush, path);
                }
                var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                using (var textBrush = new SolidBrush(btn.ForeColor))
                {
                    e.Graphics.DrawString(btn.Text, btn.Font, textBrush, new RectangleF(0, 0, btn.Width, btn.Height), sf);
                }
            };
            return btn;
        }

        private void SelectMode(string mode)
        {
            _activeMode = mode;
            btnModeWork.BackColor = mode == "task" ? Theme.Primary : Theme.CardBg;
            btnModeWork.ForeColor = mode == "task" ? Color.White : Theme.TextMuted;

            btnModeResearch.BackColor = mode == "research" ? Theme.Primary : Theme.CardBg;
            btnModeResearch.ForeColor = mode == "research" ? Color.White : Theme.TextMuted;

            btnModeLearning.BackColor = mode == "learning" ? Theme.Primary : Theme.CardBg;
            btnModeLearning.ForeColor = mode == "learning" ? Color.White : Theme.TextMuted;

            btnModeWork.Invalidate();
            btnModeResearch.Invalidate();
            btnModeLearning.Invalidate();
        }

        private void SetupLifecycleHooks()
        {
            _lifecycleManager.IdleStateChanged += (s, e) =>
            {
                this.Invoke(new Action(() =>
                {
                    if (e.IsIdle && _isTracking && !_isPaused)
                    {
                        // Auto-pause session when idle
                        PauseTracking(isAutoIdle: true);
                    }
                }));
            };

            _lifecycleManager.SessionLockChanged += (s, e) =>
            {
                this.Invoke(new Action(() =>
                {
                    if (e.IsLocked && _isTracking && !_isPaused)
                    {
                        PauseTracking(isAutoIdle: true);
                    }
                }));
            };

            _lifecycleManager.PowerModeStateChanged += (s, e) =>
            {
                if (e.IsSuspending && _isTracking)
                {
                    // Flush offline record before power sleep
                    RecordIntervalSnapshot();
                }
            };
        }

        private void LoadProjectsAndState()
        {
            try
            {
                _cachedProjects = _apiClient.GetProjects(_session.CompanySlug);
                cmbProjects.Items.Clear();
                foreach (var p in _cachedProjects)
                {
                    cmbProjects.Items.Add(p);
                }
                if (cmbProjects.Items.Count > 0) cmbProjects.SelectedIndex = 0;

                // Check if a session is already active on the server
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

        private void OnProjectSelectionChanged(object sender, EventArgs e)
        {
            var sel = cmbProjects.SelectedItem as ProjectDto;
            cmbTasks.Items.Clear();
            cmbTasks.Items.Add("-- No Specific Task (Project Level) --");

            if (sel != null)
            {
                _cachedTasks = _apiClient.GetTasks(_session.CompanySlug, sel.Id);
                foreach (var t in _cachedTasks)
                {
                    cmbTasks.Items.Add(t);
                }
            }
            cmbTasks.SelectedIndex = 0;
        }

        private void OnPrimaryActionClicked(object sender, EventArgs e)
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
            var proj = cmbProjects.SelectedItem as ProjectDto;
            if (proj != null) projId = proj.Id;

            long? taskId = null;
            var task = cmbTasks.SelectedItem as TaskDto;
            if (task != null) taskId = task.Id;

            string memo = txtSessionMemo.Text.Trim();
            string devUid = WindowsProtectedStorage.GetOrCreateDeviceUid();

            try
            {
                var s = _apiClient.StartSession(_session.CompanySlug, projId, taskId, _activeMode, memo, devUid);
                _currentSessionId = s.Id;
            }
            catch
            {
                // Offline fallback: allocate local session ID and enqueue offline event
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
            lblStatusPill.Text = "• PAUSED";
            lblStatusPill.ForeColor = Theme.YellowWarning;
            lblTimerSubtitle.Text = isAutoIdle ? "Auto-paused: User inactivity detected." : "Tracking paused.";
            btnPrimaryAction.Text = "▶   Resume Tracking";
            btnPrimaryAction.Invalidate();
        }

        private void ResumeTracking()
        {
            if (!_isTracking || !_isPaused) return;

            try
            {
                _apiClient.ResumeSession(_session.CompanySlug, _currentSessionId);
            }
            catch { }

            _isPaused = false;
            _lastTickUtc = DateTime.UtcNow;
            UpdateTrackingUi(true);
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
                // Queue offline stop event
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
            // Flush any pending queue
            OnSyncTimerTick(null, null);
        }

        private void RecordIntervalSnapshot()
        {
            if (!_isTracking) return;
            DurableOfflineQueue.Enqueue(new OfflineEvent
            {
                EventType = "interval",
                LocalSessionId = _currentSessionId,
                StartedAtUtc = _trackingStartedUtc ?? DateTime.UtcNow,
                EndedAtUtc = DateTime.UtcNow,
                DurationSeconds = (int)_accumulatedTime.TotalSeconds,
                Description = txtSessionMemo.Text.Trim()
            });
        }

        private void UpdateTrackingUi(bool tracking)
        {
            if (tracking)
            {
                lblStatusPill.Text = "• TRACKING";
                lblStatusPill.ForeColor = Theme.GreenSuccess;
                var proj = cmbProjects.SelectedItem as ProjectDto;
                lblTimerSubtitle.Text = string.Format("Active: {0}", proj != null ? proj.Name : "General Activity");
                btnPrimaryAction.Text = "⏹   Stop Tracking";
            }
            else
            {
                lblStatusPill.Text = "• READY";
                lblStatusPill.ForeColor = Theme.GreenSuccess;
                lblTimerDigits.Text = "00:00:00";
                lblTimerSubtitle.Text = "Ready to track. Select project or enter notes.";
                btnPrimaryAction.Text = "▶   Start Tracking";
            }
            btnPrimaryAction.Invalidate();
        }

        private void OnSecondTick(object sender, EventArgs e)
        {
            _lifecycleManager.CheckIdleStatus();

            if (_isTracking && !_isPaused)
            {
                var now = DateTime.UtcNow;
                _accumulatedTime += (now - _lastTickUtc);
                _lastTickUtc = now;

                lblTimerDigits.Text = string.Format("{0:00}:{1:00}:{2:00}",
                    (int)_accumulatedTime.TotalHours,
                    _accumulatedTime.Minutes,
                    _accumulatedTime.Seconds);
            }
        }

        private void OnSyncTimerTick(object sender, EventArgs e)
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
        }

        private void OnLogoutClicked(object sender, EventArgs e)
        {
            if (MessageBox.Show("Are you sure you want to sign out of Finovo Global Enterprise?", "Sign Out", MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes)
            {
                if (_isTracking) StopTracking();
                WindowsProtectedStorage.ClearSession();
                var login = new LoginForm(_apiClient);
                login.Show();
                this.Dispose();
            }
        }

        private void OnTopHeaderPaint(object sender, PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            Theme.DrawFinovoLogo(e.Graphics, new Rectangle(0, 4, 26, 26));

            using (var font = new Font("Segoe UI", 11f, FontStyle.Bold))
            using (var brush = new SolidBrush(Theme.TextWhite))
            {
                e.Graphics.DrawString("Finovo Global", font, brush, new PointF(34, 7));
            }

            var badgeRect = new Rectangle(145, 8, 70, 20);
            Theme.DrawRoundedRect(e.Graphics, new Pen(Theme.Primary, 1.2f), badgeRect, 4);
            using (var badgeFont = new Font("Segoe UI", 7.5f, FontStyle.Bold))
            using (var badgeBrush = new SolidBrush(Theme.Primary))
            {
                var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                e.Graphics.DrawString("PRISE OS", badgeFont, badgeBrush, badgeRect, sf);
            }
        }

        private void OnTitleMouseDown(object sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                ReleaseCapture();
                SendMessage(this.Handle, WM_NCLBUTTONDOWN, HTCAPTION, 0);
            }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                this.Hide();
                trayIcon.ShowBalloonTip(2000, "Finovo Tracker", "Finovo Global Time Tracker is still running in the background.", ToolTipIcon.Info);
            }
            else
            {
                base.OnFormClosing(e);
            }
        }
    }
}
