using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

namespace FinovoTracker.Core
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

    public static class WindowsProtectedStorage
    {
        private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("Finovo.Enterprise.Wpf.Entropy.v2.4");
        private static readonly string AppDataDir;
        private static readonly string VaultFile;

        static WindowsProtectedStorage()
        {
            AppDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Finovo", "TimeTracker");
            if (!Directory.Exists(AppDataDir)) Directory.CreateDirectory(AppDataDir);
            VaultFile = Path.Combine(AppDataDir, "vault.dat");
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
                if (File.Exists(VaultFile)) File.Delete(VaultFile);
            }
            catch { }
        }

        public static string GetOrCreateDeviceUid()
        {
            try
            {
                string path = Path.Combine(AppDataDir, "dev_uid.dat");
                if (File.Exists(path))
                {
                    byte[] enc = File.ReadAllBytes(path);
                    byte[] plain = ProtectedData.Unprotect(enc, Entropy, DataProtectionScope.CurrentUser);
                    return Encoding.UTF8.GetString(plain);
                }

                string uid = Guid.NewGuid().ToString("D");
                byte[] toEnc = Encoding.UTF8.GetBytes(uid);
                byte[] encBytes = ProtectedData.Protect(toEnc, Entropy, DataProtectionScope.CurrentUser);
                File.WriteAllBytes(path, encBytes);
                return uid;
            }
            catch
            {
                return Guid.NewGuid().ToString("D");
            }
        }
    }
}

