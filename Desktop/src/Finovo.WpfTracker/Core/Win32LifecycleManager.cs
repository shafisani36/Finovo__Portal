using System;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace FinovoTracker.Core
{
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

        public event Action<bool> IdleStateChanged;
        public event Action<bool> SessionLockChanged;

        private int _idleThresholdSeconds = 300;
        private bool _currentlyIdle = false;

        public Win32LifecycleManager()
        {
            try
            {
                SystemEvents.SessionSwitch += OnSessionSwitch;
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
                if (handler != null) handler(_currentlyIdle);
            }
        }

        private void OnSessionSwitch(object sender, SessionSwitchEventArgs e)
        {
            if (e.Reason == SessionSwitchReason.SessionLock)
            {
                var handler = SessionLockChanged;
                if (handler != null) handler(true);
            }
            else if (e.Reason == SessionSwitchReason.SessionUnlock)
            {
                var handler = SessionLockChanged;
                if (handler != null) handler(false);
            }
        }

        public void Dispose()
        {
            try
            {
                SystemEvents.SessionSwitch -= OnSessionSwitch;
            }
            catch { }
        }
    }
}

