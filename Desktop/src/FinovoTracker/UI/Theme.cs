using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace FinovoTracker.UI
{
    public static class Theme
    {
        public static readonly Color BgDark = Color.FromArgb(10, 15, 29);       // #0A0F1D
        public static readonly Color CardBg = Color.FromArgb(17, 26, 46);       // #111A2E
        public static readonly Color CardBorder = Color.FromArgb(30, 43, 70);   // #1E2B46
        public static readonly Color InputBg = Color.FromArgb(14, 21, 38);      // #0E1526
        public static readonly Color InputBorder = Color.FromArgb(36, 50, 78);  // #24324E
        public static readonly Color Primary = Color.FromArgb(249, 87, 22);     // #F95716 (Finovo Orange)
        public static readonly Color PrimaryHover = Color.FromArgb(255, 105, 45);
        public static readonly Color TextWhite = Color.FromArgb(255, 255, 255);
        public static readonly Color TextMuted = Color.FromArgb(148, 163, 184); // #94A3B8
        public static readonly Color TextDim = Color.FromArgb(100, 116, 139);   // #64748B
        public static readonly Color GreenSuccess = Color.FromArgb(16, 185, 129);// #10B981
        public static readonly Color YellowWarning = Color.FromArgb(245, 158, 11);// #F59E0B
        public static readonly Color RedDanger = Color.FromArgb(239, 68, 68);   // #EF4444

        public static readonly Font FontHeading = new Font("Segoe UI", 16f, FontStyle.Bold);
        public static readonly Font FontSubheading = new Font("Segoe UI", 11f, FontStyle.Bold);
        public static readonly Font FontBody = new Font("Segoe UI", 9.5f, FontStyle.Regular);
        public static readonly Font FontSmall = new Font("Segoe UI", 8.5f, FontStyle.Regular);
        public static readonly Font FontSmallBold = new Font("Segoe UI", 8.5f, FontStyle.Bold);
        public static readonly Font FontDigits = new Font("Consolas", 38f, FontStyle.Bold);

        public static GraphicsPath GetRoundedPath(Rectangle rect, int radius)
        {
            GraphicsPath path = new GraphicsPath();
            int d = radius * 2;
            path.AddArc(rect.X, rect.Y, d, d, 180, 90);
            path.AddArc(rect.Right - d, rect.Y, d, d, 270, 90);
            path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0, 90);
            path.AddArc(rect.X, rect.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        public static void DrawRoundedRect(Graphics g, Pen pen, Rectangle rect, int radius)
        {
            using (var path = GetRoundedPath(rect, radius))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.DrawPath(pen, path);
            }
        }

        public static void FillRoundedRect(Graphics g, Brush brush, Rectangle rect, int radius)
        {
            using (var path = GetRoundedPath(rect, radius))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.FillPath(brush, path);
            }
        }

        public static void DrawFinovoLogo(Graphics g, Rectangle rect)
        {
            // Draw stylized orange FG logo box matching screenshot
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (var br = new LinearGradientBrush(rect, PrimaryHover, Primary, LinearGradientMode.ForwardDiagonal))
            {
                FillRoundedRect(g, br, rect, 8);
            }
            using (var pen = new Pen(Color.FromArgb(100, 255, 255, 255), 1.5f))
            {
                DrawRoundedRect(g, pen, rect, 8);
            }
            // Draw clean geometric initials FG inside logo box
            using (var font = new Font("Segoe UI", rect.Height * 0.45f, FontStyle.Bold))
            using (var brText = new SolidBrush(Color.White))
            {
                var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                g.DrawString("FG", font, brText, rect, sf);
            }
        }
    }
}

