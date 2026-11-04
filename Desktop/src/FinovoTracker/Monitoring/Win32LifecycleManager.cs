using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32;

namespace FinovoTracker.Monitoring
{
    public class IdleStateChangedEventArgs : EventArgs
    {
        public bool IsIdle { get; set; }
        public int IdleSeconds { get; set; }
    }

    public class SessionLockChangedEventArgs : EventArgs
    {
        public bool IsLocked { get; set; }
    }

    public class PowerModeStateChangedEventArgs : EventArgs
    {
        public bool IsSuspending { get; set; }
    }

    /// <summary>
    /// Native Win32 Lifecycle and Inactivity Monitor for Windows 10 & 11.
    /// Transparent, privacy-preserving tracking of user activity, system lock, and sleep/resume events.
    /// Zero keystroke logging, zero form sniffing, zero covert screenshots.
    /// </summary>
    public class Win32LifecycleManager : IDisposable
    {
        [StructLayout(LayoutKind.Sequential)]
        private struct LASTINPUTINFO
        {
            public uint cbSize;
            public uint dwTime;
        }

        [DllImport("user32.dll")]
        private static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

        public event EventHandler<IdleStateChangedEventArgs> IdleStateChanged;
        public event EventHandler<SessionLockChangedEventArgs> SessionLockChanged;
        public event EventHandler<PowerModeStateChangedEventArgs> PowerModeStateChanged;

        private int _idleThresholdSeconds = 300; // 5 minutes default
        private bool _currentlyIdle = false;
        private bool _isLocked = false;

        public int IdleThresholdSeconds
        {
            get { return _idleThresholdSeconds; }
            set { _idleThresholdSeconds = Math.Max(30, value); }
        }

        public bool IsUserIdle
        {
            get { return _currentlyIdle; }
        }

        public bool IsSessionLocked
        {
            get { return _isLocked; }
        }

        public Win32LifecycleManager()
        {
            try
            {
                SystemEvents.SessionSwitch += OnSessionSwitch;
                SystemEvents.PowerModeChanged += OnPowerModeChanged;
            }
            catch { }
        }

        public int GetIdleSeconds()
        {
            var lii = new LASTINPUTINFO();
            lii.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO));
            if (GetLastInputInfo(ref lii))
            {
                uint envTicks = (uint)Environment.TickCount;
                uint diff = envTicks - lii.dwTime;
                return (int)(diff / 1000);
            }
            return 0;
        }

        public void CheckIdleStatus()
        {
            int idleSec = GetIdleSeconds();
            bool idleNow = idleSec >= _idleThresholdSeconds;

            if (idleNow != _currentlyIdle)
            {
                _currentlyIdle = idleNow;
                var handler = IdleStateChanged;
                if (handler != null)
                {
                    handler(this, new IdleStateChangedEventArgs
                    {
                        IsIdle = _currentlyIdle,
                        IdleSeconds = idleSec
                    });
                }
            }
        }

        public string GetCurrentAppCategory()
        {
            try
            {
                IntPtr hWnd = GetForegroundWindow();
                if (hWnd == IntPtr.Zero) return "unclassified";

                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                if (pid == 0) return "unclassified";

                using (var proc = Process.GetProcessById((int)pid))
                {
                    string name = proc.ProcessName.ToLowerInvariant();

                    if (name.Contains("code") || name.Contains("devenv") || name.Contains("antigravity") ||
                        name.Contains("rider") || name.Contains("terminal") || name.Contains("powershell") ||
                        name.Contains("cmd") || name.Contains("git"))
                    {
                        return "development";
                    }

                    if (name.Contains("slack") || name.Contains("teams") || name.Contains("discord") ||
                        name.Contains("zoom") || name.Contains("outlook") || name.Contains("thunderbird"))
                    {
                        return "communication";
                    }

                    if (name.Contains("chrome") || name.Contains("msedge") || name.Contains("firefox") ||
                        name.Contains("brave"))
                    {
                        return "research";
                    }

                    if (name.Contains("word") || name.Contains("excel") || name.Contains("notion") ||
                        name.Contains("obsidian") || name.Contains("acrobat") || name.Contains("powerpnt"))
                    {
                        return "documentation";
                    }

                    if (name.Contains("figma") || name.Contains("photoshop") || name.Contains("illustrator") ||
                        name.Contains("canva"))
                    {
                        return "design";
                    }

                    return "general_work";
                }
            }
            catch
            {
                return "unclassified";
            }
        }

        private void OnSessionSwitch(object sender, SessionSwitchEventArgs e)
        {
            if (e.Reason == SessionSwitchReason.SessionLock)
            {
                _isLocked = true;
                var handler = SessionLockChanged;
                if (handler != null) handler(this, new SessionLockChangedEventArgs { IsLocked = true });
            }
            else if (e.Reason == SessionSwitchReason.SessionUnlock)
            {
                _isLocked = false;
                var handler = SessionLockChanged;
                if (handler != null) handler(this, new SessionLockChangedEventArgs { IsLocked = false });
            }
        }

        private void OnPowerModeChanged(object sender, PowerModeChangedEventArgs e)
        {
            if (e.Mode == PowerModes.Suspend)
            {
                var handler = PowerModeStateChanged;
                if (handler != null) handler(this, new PowerModeStateChangedEventArgs { IsSuspending = true });
            }
            else if (e.Mode == PowerModes.Resume)
            {
                var handler = PowerModeStateChanged;
                if (handler != null) handler(this, new PowerModeStateChangedEventArgs { IsSuspending = false });
            }
        }

        public void Dispose()
        {
            try
            {
                SystemEvents.SessionSwitch -= OnSessionSwitch;
                SystemEvents.PowerModeChanged -= OnPowerModeChanged;
            }
            catch { }
        }
    }
}

