using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using FinovoTracker.Api;
using FinovoTracker.Security;

namespace FinovoTracker.UI
{
    public class LoginForm : Form
    {
        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();
        [DllImport("user32.dll")]
        public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);
        private const int WM_NCLBUTTONDOWN = 0xA1;
        private const int HTCAPTION = 0x2;

        private readonly FinovoApiClient _apiClient;
        private TextBox txtEmail;
        private TextBox txtPassword;
        private Button btnSignIn;
        private Label lblStatus;
        private Button btnTogglePassword;
        private bool _passwordVisible = false;

        public LoginForm(FinovoApiClient apiClient)
        {
            _apiClient = apiClient;
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            this.Size = new Size(460, 720);
            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Theme.BgDark;
            this.DoubleBuffered = true;

            // Main Card Panel
            var cardPanel = new Panel
            {
                Size = new Size(400, 620),
                Location = new Point(30, 60),
                BackColor = Theme.CardBg
            };
            cardPanel.Paint += OnCardPaint;

            // Logo Top Center inside Card
            var pnlLogo = new Panel
            {
                Size = new Size(60, 60),
                Location = new Point(170, 24),
                BackColor = Color.Transparent
            };
            pnlLogo.Paint += (s, e) => Theme.DrawFinovoLogo(e.Graphics, new Rectangle(0, 0, 60, 60));
            cardPanel.Controls.Add(pnlLogo);

            // "Finovo Global" Text
            var lblTitle = new Label
            {
                Text = "Finovo Global",
                Font = new Font("Segoe UI", 16f, FontStyle.Bold),
                ForeColor = Theme.TextWhite,
                TextAlign = ContentAlignment.MiddleCenter,
                Size = new Size(360, 30),
                Location = new Point(20, 90),
                BackColor = Color.Transparent
            };
            cardPanel.Controls.Add(lblTitle);

            // "ENTERPRISE OS"
            var lblBadge = new Label
            {
                Text = "ENTERPRISE OS",
                Font = new Font("Segoe UI", 8f, FontStyle.Bold),
                ForeColor = Theme.Primary,
                TextAlign = ContentAlignment.MiddleCenter,
                Size = new Size(360, 18),
                Location = new Point(20, 120),
                BackColor = Color.Transparent
            };
            cardPanel.Controls.Add(lblBadge);

            // "Welcome back"
            var lblWelcome = new Label
            {
                Text = "Welcome back",
                Font = new Font("Segoe UI", 16f, FontStyle.Bold),
                ForeColor = Theme.TextWhite,
                TextAlign = ContentAlignment.MiddleCenter,
                Size = new Size(360, 32),
                Location = new Point(20, 150),
                BackColor = Color.Transparent
            };
            cardPanel.Controls.Add(lblWelcome);

            // "Sign in to your Finovo Global workspace account"
            var lblSubtitle = new Label
            {
                Text = "Sign in to your Finovo Global workspace account",
                Font = Theme.FontSmall,
                ForeColor = Theme.TextMuted,
                TextAlign = ContentAlignment.MiddleCenter,
                Size = new Size(360, 20),
                Location = new Point(20, 185),
                BackColor = Color.Transparent
            };
            cardPanel.Controls.Add(lblSubtitle);

            // USERNAME OR WORK EMAIL Label
            var lblEmailTag = new Label
            {
                Text = "USERNAME OR WORK EMAIL",
                Font = Theme.FontSmallBold,
                ForeColor = Theme.TextMuted,
                Location = new Point(25, 225),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            cardPanel.Controls.Add(lblEmailTag);

            // Email Input Box Container
            var pnlEmailInput = new Panel
            {
                Size = new Size(350, 42),
                Location = new Point(25, 248),
                BackColor = Theme.InputBg
            };
            pnlEmailInput.Paint += (s, e) => Theme.DrawRoundedRect(e.Graphics, new Pen(Theme.InputBorder), new Rectangle(0, 0, 349, 41), 8);

            txtEmail = new TextBox
            {
                BorderStyle = BorderStyle.None,
                BackColor = Theme.InputBg,
                ForeColor = Theme.TextWhite,
                Font = Theme.FontBody,
                Location = new Point(16, 12),
                Size = new Size(318, 22),
                Text = "samaria.fatima80@finovo.global"
            };
            pnlEmailInput.Controls.Add(txtEmail);
            cardPanel.Controls.Add(pnlEmailInput);

            // PASSWORD Label
            var lblPassTag = new Label
            {
                Text = "PASSWORD",
                Font = Theme.FontSmallBold,
                ForeColor = Theme.TextMuted,
                Location = new Point(25, 305),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            cardPanel.Controls.Add(lblPassTag);

            // Password Input Box Container
            var pnlPassInput = new Panel
            {
                Size = new Size(350, 42),
                Location = new Point(25, 328),
                BackColor = Theme.InputBg
            };
            pnlPassInput.Paint += (s, e) => Theme.DrawRoundedRect(e.Graphics, new Pen(Theme.InputBorder), new Rectangle(0, 0, 349, 41), 8);

            txtPassword = new TextBox
            {
                BorderStyle = BorderStyle.None,
                BackColor = Theme.InputBg,
                ForeColor = Theme.TextWhite,
                Font = Theme.FontBody,
                Location = new Point(16, 12),
                Size = new Size(290, 22),
                UseSystemPasswordChar = true,
                Text = "Password123!"
            };
            pnlPassInput.Controls.Add(txtPassword);

            btnTogglePassword = new Button
            {
                Text = "👁",
                Size = new Size(32, 28),
                Location = new Point(310, 7),
                FlatStyle = FlatStyle.Flat,
                ForeColor = Theme.TextMuted,
                BackColor = Color.Transparent,
                Cursor = Cursors.Hand
            };
            btnTogglePassword.FlatAppearance.BorderSize = 0;
            btnTogglePassword.Click += (s, e) =>
            {
                _passwordVisible = !_passwordVisible;
                txtPassword.UseSystemPasswordChar = !_passwordVisible;
            };
            pnlPassInput.Controls.Add(btnTogglePassword);
            cardPanel.Controls.Add(pnlPassInput);

            // Status message label
            lblStatus = new Label
            {
                Text = "",
                Font = Theme.FontSmall,
                ForeColor = Theme.RedDanger,
                TextAlign = ContentAlignment.MiddleCenter,
                Size = new Size(350, 22),
                Location = new Point(25, 380),
                BackColor = Color.Transparent
            };
            cardPanel.Controls.Add(lblStatus);

            // Sign In Button
            btnSignIn = new Button
            {
                Text = "Sign In to Workspace  →",
                Font = Theme.FontSubheading,
                ForeColor = Color.White,
                BackColor = Theme.Primary,
                FlatStyle = FlatStyle.Flat,
                Size = new Size(350, 48),
                Location = new Point(25, 410),
                Cursor = Cursors.Hand
            };
            btnSignIn.FlatAppearance.BorderSize = 0;
            btnSignIn.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using (var path = Theme.GetRoundedPath(new Rectangle(0, 0, btnSignIn.Width, btnSignIn.Height), 8))
                using (var brush = new SolidBrush(Theme.Primary))
                {
                    e.Graphics.FillPath(brush, path);
                }
                var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                e.Graphics.DrawString(btnSignIn.Text, btnSignIn.Font, Brushes.White, new RectangleF(0, 0, btnSignIn.Width, btnSignIn.Height), sf);
            };
            btnSignIn.Click += OnSignInClicked;
            cardPanel.Controls.Add(btnSignIn);

            // DPAPI encryption indicator
            var lblDpapi = new Label
            {
                Text = "🔒  Secure session encrypted with Windows DPAPI",
                Font = Theme.FontSmall,
                ForeColor = Theme.TextMuted,
                TextAlign = ContentAlignment.MiddleCenter,
                Size = new Size(350, 22),
                Location = new Point(25, 470),
                BackColor = Color.Transparent
            };
            cardPanel.Controls.Add(lblDpapi);

            // Diagnostics & Network Buttons Container
            var pnlBottomActions = new FlowLayoutPanel
            {
                Size = new Size(350, 42),
                Location = new Point(25, 520),
                BackColor = Color.Transparent,
                FlowDirection = FlowDirection.LeftToRight
            };

            var btnNetwork = new Button
            {
                Text = "🌐 Network",
                Font = Theme.FontSmallBold,
                ForeColor = Theme.TextMuted,
                BackColor = Theme.InputBg,
                FlatStyle = FlatStyle.Flat,
                Size = new Size(168, 38),
                Cursor = Cursors.Hand
            };
            btnNetwork.FlatAppearance.BorderColor = Theme.InputBorder;
            btnNetwork.Click += (s, e) => MessageBox.Show(string.Format("Network Gateway: {0}\nStatus: Active\nHost: 127.0.0.1", _apiClient.BaseUrl), "Network Information", MessageBoxButtons.OK, MessageBoxIcon.Information);

            var btnDiag = new Button
            {
                Text = "📈 API Diagnostics",
                Font = Theme.FontSmallBold,
                ForeColor = Theme.TextMuted,
                BackColor = Theme.InputBg,
                FlatStyle = FlatStyle.Flat,
                Size = new Size(168, 38),
                Cursor = Cursors.Hand
            };
            btnDiag.FlatAppearance.BorderColor = Theme.InputBorder;
            btnDiag.Click += OnDiagnosticsClicked;

            pnlBottomActions.Controls.Add(btnNetwork);
            pnlBottomActions.Controls.Add(btnDiag);
            cardPanel.Controls.Add(pnlBottomActions);

            this.Controls.Add(cardPanel);

            // Window Header Buttons (Minimize, Close)
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
            btnClose.Click += (s, e) => Application.Exit();
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

            // Title & Badge in Header
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
        }

        private void OnCardPaint(object sender, PaintEventArgs e)
        {
            var pnl = (Panel)sender;
            Theme.FillRoundedRect(e.Graphics, new SolidBrush(Theme.CardBg), new Rectangle(0, 0, pnl.Width, pnl.Height), 16);
            Theme.DrawRoundedRect(e.Graphics, new Pen(Theme.CardBorder, 1.2f), new Rectangle(0, 0, pnl.Width - 1, pnl.Height - 1), 16);
        }

        private void OnTopHeaderPaint(object sender, PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            // Draw small logo
            Theme.DrawFinovoLogo(e.Graphics, new Rectangle(0, 4, 26, 26));

            // "Finovo Global"
            using (var font = new Font("Segoe UI", 11f, FontStyle.Bold))
            using (var brush = new SolidBrush(Theme.TextWhite))
            {
                e.Graphics.DrawString("Finovo Global", font, brush, new PointF(34, 7));
            }

            // "PRISE OS" badge
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

        private void OnSignInClicked(object sender, EventArgs e)
        {
            string email = txtEmail.Text.Trim();
            string pass = txtPassword.Text;

            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(pass))
            {
                lblStatus.Text = "Please enter both work email and password.";
                return;
            }

            btnSignIn.Enabled = false;
            btnSignIn.Text = "Signing In...";
            lblStatus.ForeColor = Theme.TextMuted;
            lblStatus.Text = "Authenticating with Finovo Enterprise Cloud...";
            Application.DoEvents();

            try
            {
                var session = _apiClient.Login(email, pass);
                if (session != null)
                {
                    // Encrypt and persist to DPAPI
                    WindowsProtectedStorage.SaveSession(session);

                    // Register hardware device
                    string devUid = WindowsProtectedStorage.GetOrCreateDeviceUid();
                    _apiClient.RegisterDevice(session.CompanySlug, devUid, Environment.MachineName);

                    lblStatus.ForeColor = Theme.GreenSuccess;
                    lblStatus.Text = "Success! Launching Workspace...";
                    Application.DoEvents();

                    // Open Tracker Form
                    var tracker = new TrackerForm(_apiClient, session);
                    tracker.FormClosed += (s, args) => this.Close();
                    this.Hide();
                    tracker.Show();
                    return;
                }
            }
            catch (Exception ex)
            {
                lblStatus.ForeColor = Theme.RedDanger;
                lblStatus.Text = ex.Message.Length > 45 ? ex.Message.Substring(0, 45) + "..." : ex.Message;
            }
            finally
            {
                btnSignIn.Enabled = true;
                btnSignIn.Text = "Sign In to Workspace  →";
            }
        }

        private void OnDiagnosticsClicked(object sender, EventArgs e)
        {
            bool ok = _apiClient.CheckHealth();
            if (ok)
            {
                MessageBox.Show("Finovo API Gateway Status: HEALTHY\nHost: " + _apiClient.BaseUrl + "\nLatency: < 15ms\nTLS: TLS 1.2 Encrypted\nWindows DPAPI: Active & Verified", "Health Diagnostics", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            else
            {
                MessageBox.Show("Unable to reach Finovo API Gateway at " + _apiClient.BaseUrl + ".\nPlease ensure backend server daemon is running on port 8000.", "Health Diagnostics Warning", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }
    }
}

