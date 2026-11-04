using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

namespace FinovoTracker.Core
{
    public class OfflineEvent
    {
        public string EventId { get; set; }
        public string EventType { get; set; } // "start", "stop", "interval", "pause", "resume"
        public long? LocalSessionId { get; set; }
        public long? ProjectId { get; set; }
        public long? TaskId { get; set; }
        public string ActivityType { get; set; }
        public string Description { get; set; }
        public DateTime StartedAtUtc { get; set; }
        public DateTime? EndedAtUtc { get; set; }
        public int DurationSeconds { get; set; }
        public DateTime ObservedAtUtc { get; set; }
        public bool IsSynchronized { get; set; }

        public OfflineEvent()
        {
            EventId = Guid.NewGuid().ToString("N");
            ObservedAtUtc = DateTime.UtcNow;
            IsSynchronized = false;
        }
    }

    public static class DurableOfflineQueue
    {
        private static readonly object SyncLock = new object();
        private static readonly string JournalPath;

        static DurableOfflineQueue()
        {
            string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Finovo", "TimeTracker");
            if (!Directory.Exists(appData)) Directory.CreateDirectory(appData);
            JournalPath = Path.Combine(appData, "offline_journal.json");
        }

        public static void Enqueue(OfflineEvent evt)
        {
            if (evt == null) return;
            lock (SyncLock)
            {
                var list = LoadAllInternal();
                list.Add(evt);
                SaveAllInternal(list);
            }
        }

        public static List<OfflineEvent> GetPendingEvents(int limit = 50)
        {
            lock (SyncLock)
            {
                var list = LoadAllInternal();
                var pending = new List<OfflineEvent>();
                foreach (var e in list)
                {
                    if (!e.IsSynchronized)
                    {
                        pending.Add(e);
                        if (pending.Count >= limit) break;
                    }
                }
                return pending;
            }
        }

        public static void MarkSynchronized(IEnumerable<string> eventIds)
        {
            if (eventIds == null) return;
            var set = new HashSet<string>(eventIds);
            lock (SyncLock)
            {
                var list = LoadAllInternal();
                bool modified = false;
                foreach (var e in list)
                {
                    if (set.Contains(e.EventId))
                    {
                        e.IsSynchronized = true;
                        modified = true;
                    }
                }
                if (modified)
                {
                    var cutoff = DateTime.UtcNow.AddDays(-7);
                    list.RemoveAll(x => x.IsSynchronized && x.ObservedAtUtc < cutoff);
                    SaveAllInternal(list);
                }
            }
        }

        private static List<OfflineEvent> LoadAllInternal()
        {
            try
            {
                if (!File.Exists(JournalPath)) return new List<OfflineEvent>();
                string json = File.ReadAllText(JournalPath, Encoding.UTF8);
                if (string.IsNullOrEmpty(json)) return new List<OfflineEvent>();

                var serializer = new JavaScriptSerializer();
                return serializer.Deserialize<List<OfflineEvent>>(json) ?? new List<OfflineEvent>();
            }
            catch
            {
                return new List<OfflineEvent>();
            }
        }

        private static void SaveAllInternal(List<OfflineEvent> list)
        {
            try
            {
                var serializer = new JavaScriptSerializer();
                string json = serializer.Serialize(list);
                string temp = JournalPath + ".tmp";
                File.WriteAllText(temp, json, Encoding.UTF8);
                if (File.Exists(JournalPath)) File.Delete(JournalPath);
                File.Move(temp, JournalPath);
            }
            catch { }
        }
    }
}

