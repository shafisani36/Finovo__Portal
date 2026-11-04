using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using FinovoTracker.Api;
using FinovoTracker.Monitoring;
using FinovoTracker.Security;
using FinovoTracker.Storage;

namespace FinovoTracker.Tests
{
    public static class TestRunner
    {
        private static int _passed = 0;
        private static int _failed = 0;

        public static int Main()
        {
            Console.WriteLine("=================================================");
            Console.WriteLine(" FINOVO GLOBAL TRACKER - AUTOMATED TEST SUITE    ");
            Console.WriteLine("=================================================");

            RunTest("DPAPI Vault Token Encryption Roundtrip", TestDpapiEncryption);
            RunTest("Hardware Device UID Generation & Store", TestDeviceUid);
            RunTest("Durable Offline Journal Enqueue & Mark", TestDurableOfflineQueue);
            RunTest("Win32 Last Input Idle Detection", TestWin32IdleDetection);
            RunTest("Live Backend Integration & Session Flow", TestBackendIntegration);

            Console.WriteLine("-------------------------------------------------");
            Console.WriteLine(string.Format("RESULTS: {0} Passed, {1} Failed", _passed, _failed));
            Console.WriteLine("=================================================");

            return _failed > 0 ? 1 : 0;
        }

        private static void RunTest(string name, Action testAction)
        {
            try
            {
                Console.Write(string.Format("[TEST] {0,-40} ... ", name));
                testAction();
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("PASSED");
                Console.ResetColor();
                _passed++;
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("FAILED");
                Console.WriteLine("       Error: " + ex.Message);
                Console.ResetColor();
                _failed++;
            }
        }

        private static void TestDpapiEncryption()
        {
            var session = new UserSession
            {
                Token = "test_bearer_token_xyz_9988",
                Email = "test.auditor@finovo.global",
                UserName = "Test Auditor",
                CompanySlug = "bitspark-ops",
                CompanyName = "Finovo Global Enterprise",
                UserId = 42
            };

            WindowsProtectedStorage.SaveSession(session);
            var loaded = WindowsProtectedStorage.LoadSession();

            if (loaded == null) throw new Exception("Loaded session is null");
            if (loaded.Token != session.Token) throw new Exception("Token mismatch: " + loaded.Token);
            if (loaded.Email != session.Email) throw new Exception("Email mismatch: " + loaded.Email);
            if (loaded.CompanySlug != "bitspark-ops") throw new Exception("CompanySlug mismatch");
        }

        private static void TestDeviceUid()
        {
            string uid1 = WindowsProtectedStorage.GetOrCreateDeviceUid();
            if (string.IsNullOrEmpty(uid1)) throw new Exception("Device UID is empty");

            string uid2 = WindowsProtectedStorage.GetOrCreateDeviceUid();
            if (uid1 != uid2) throw new Exception("Device UID is not stable across reads");
        }

        private static void TestDurableOfflineQueue()
        {
            var evt = new OfflineEvent
            {
                EventType = "interval",
                LocalSessionId = 999111,
                DurationSeconds = 60,
                Description = "Offline Unit Test Record"
            };

            DurableOfflineQueue.Enqueue(evt);
            var pending = DurableOfflineQueue.GetPendingEvents(100);

            bool found = false;
            foreach (var p in pending)
            {
                if (p.EventId == evt.EventId)
                {
                    found = true;
                    break;
                }
            }

            if (!found) throw new Exception("Enqueued event not found in pending list");

            // Mark synchronized
            DurableOfflineQueue.MarkSynchronized(new string[] { evt.EventId });
            var pendingAfter = DurableOfflineQueue.GetPendingEvents(100);
            foreach (var p in pendingAfter)
            {
                if (p.EventId == evt.EventId)
                {
                    throw new Exception("Event was marked synchronized but still appears in pending queue");
                }
            }
        }

        private static void TestWin32IdleDetection()
        {
            using (var manager = new Win32LifecycleManager())
            {
                int idleSec = manager.GetIdleSeconds();
                if (idleSec < 0) throw new Exception("GetIdleSeconds returned negative value");

                string cat = manager.GetCurrentAppCategory();
                if (string.IsNullOrEmpty(cat)) throw new Exception("App category is null or empty");
            }
        }

        private static void TestBackendIntegration()
        {
            var client = new FinovoApiClient("http://127.0.0.1:8000");
            bool healthy = client.CheckHealth();
            if (!healthy) throw new Exception("Backend API gateway is not reachable at 127.0.0.1:8000");

            var session = client.Login("samaria.fatima80@finovo.global", "Password123!");
            if (session == null || string.IsNullOrEmpty(session.Token)) throw new Exception("Login failed to produce valid token");

            var projects = client.GetProjects(session.CompanySlug);
            if (projects == null || projects.Count == 0) throw new Exception("No projects returned for company: " + session.CompanySlug);

            var tasks = client.GetTasks(session.CompanySlug, projects[0].Id);
            if (tasks == null) throw new Exception("GetTasks returned null");

            string devUid = WindowsProtectedStorage.GetOrCreateDeviceUid();
            bool devOk = client.RegisterDevice(session.CompanySlug, devUid, Environment.MachineName);
            if (!devOk) throw new Exception("RegisterDevice failed");

            // Test Session Lifecycle
            var s = client.StartSession(session.CompanySlug, projects[0].Id, tasks.Count > 0 ? (long?)tasks[0].Id : null, "task", "Automated Test Session", devUid);
            if (s == null || s.Status != "running") throw new Exception("StartSession did not return running status");

            var paused = client.PauseSession(session.CompanySlug, s.Id);
            if (paused == null || paused.Status != "paused") throw new Exception("PauseSession did not return paused status");

            var resumed = client.ResumeSession(session.CompanySlug, s.Id);
            if (resumed == null || resumed.Status != "running") throw new Exception("ResumeSession did not return running status");

            var stopped = client.StopSession(session.CompanySlug, s.Id);
            if (stopped == null || stopped.Status != "stopped") throw new Exception("StopSession did not return stopped status");
        }
    }
}

