using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

namespace FinovoTracker.Security
{
    public class UserSession
    {
        public string Token { get; set; }
        public string Email { get; set; }
        public string UserName { get; set; }
        public string CompanySlug { get; set; }
        public string CompanyName { get; set; }
        public long UserId { get; set; }
        public DateTime SavedAtUtc { get; set; }
    }

    /// <summary>
    /// Enterprise Windows DPAPI (Data Protection API) Vault.
    /// Encrypts all session tokens and hardware credentials using the user's Windows master key.
    /// Zero cleartext storage on disk or environment variables.
    /// </summary>
    public static class WindowsProtectedStorage
    {
        private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("Finovo.Enterprise.Tracker.Entropy.v2.4");
        private static readonly string AppDataDir;
        private static readonly string VaultFile;
        private static readonly string SettingsFile;

        static WindowsProtectedStorage()
        {
            AppDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Finovo", "TimeTracker");
            if (!Directory.Exists(AppDataDir))
            {
                Directory.CreateDirectory(AppDataDir);
            }
            VaultFile = Path.Combine(AppDataDir, "vault.dat");
            SettingsFile = Path.Combine(AppDataDir, "settings.dat");
        }

        public static void SaveSession(UserSession session)
        {
            if (session == null) return;
            session.SavedAtUtc = DateTime.UtcNow;
            var serializer = new JavaScriptSerializer();
            string json = serializer.Serialize(session);
            byte[] plainBytes = Encoding.UTF8.GetBytes(json);
            byte[] encrypted = ProtectedData.Protect(plainBytes, Entropy, DataProtectionScope.CurrentUser);
            File.WriteAllBytes(VaultFile, encrypted);
        }

        public static UserSession LoadSession()
        {
            try
            {
                if (!File.Exists(VaultFile)) return null;
                byte[] encrypted = File.ReadAllBytes(VaultFile);
                if (encrypted == null || encrypted.Length == 0) return null;

                byte[] plainBytes = ProtectedData.Unprotect(encrypted, Entropy, DataProtectionScope.CurrentUser);
                string json = Encoding.UTF8.GetString(plainBytes);
                var serializer = new JavaScriptSerializer();
                return serializer.Deserialize<UserSession>(json);
            }
            catch
            {
                return null;
            }
        }

        public static void ClearSession()
        {
            try
            {
                if (File.Exists(VaultFile))
                {
                    File.Delete(VaultFile);
                }
            }
            catch { }
        }

        public static string GetOrCreateDeviceUid()
        {
            try
            {
                string stored = GetSetting("DeviceUid", null);
                if (!string.IsNullOrEmpty(stored)) return stored;

                // Try reading Windows MachineGuid from registry
                string machineGuid = null;
                try
                {
                    using (var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography"))
                    {
                        if (key != null)
                        {
                            object val = key.GetValue("MachineGuid");
                            if (val != null) machineGuid = val.ToString();
                        }
                    }
                }
                catch { }

                if (string.IsNullOrEmpty(machineGuid))
                {
                    machineGuid = Guid.NewGuid().ToString("D");
                }

                SaveSetting("DeviceUid", machineGuid);
                return machineGuid;
            }
            catch
            {
                return Guid.NewGuid().ToString("D");
            }
        }

        public static void SaveSetting(string key, string value)
        {
            try
            {
                string file = Path.Combine(AppDataDir, "cfg_" + key + ".dat");
                if (value == null)
                {
                    if (File.Exists(file)) File.Delete(file);
                    return;
                }
                byte[] plain = Encoding.UTF8.GetBytes(value);
                byte[] enc = ProtectedData.Protect(plain, Entropy, DataProtectionScope.CurrentUser);
                File.WriteAllBytes(file, enc);
            }
            catch { }
        }

        public static string GetSetting(string key, string defaultValue)
        {
            try
            {
                string file = Path.Combine(AppDataDir, "cfg_" + key + ".dat");
                if (!File.Exists(file)) return defaultValue;
                byte[] enc = File.ReadAllBytes(file);
                byte[] plain = ProtectedData.Unprotect(enc, Entropy, DataProtectionScope.CurrentUser);
                return Encoding.UTF8.GetString(plain);
            }
            catch
            {
                return defaultValue;
            }
        }
    }
}

