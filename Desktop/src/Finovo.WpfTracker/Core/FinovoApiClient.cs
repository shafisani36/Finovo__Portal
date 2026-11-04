using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Web.Script.Serialization;

namespace FinovoTracker.Core
{
    public class ProjectDto
    {
        public long Id { get; set; }
        public string Name { get; set; }
        public string ProjectCode { get; set; }

        public string DisplayText
        {
            get
            {
                if (string.IsNullOrEmpty(ProjectCode)) return Name;
                return string.Format("{0}   [{1}]", Name, ProjectCode);
            }
        }
    }

    public class TaskDto
    {
        public long Id { get; set; }
        public string Title { get; set; }
        public string TaskCode { get; set; }
        public long? ProjectId { get; set; }

        public string DisplayText
        {
            get
            {
                if (string.IsNullOrEmpty(TaskCode)) return Title;
                return string.Format("{0}   [{1}]", Title, TaskCode);
            }
        }
    }

    public class TrackingSessionDto
    {
        public long Id { get; set; }
        public long? ProjectId { get; set; }
        public string ProjectName { get; set; }
        public long? TaskId { get; set; }
        public string TaskTitle { get; set; }
        public string ActivityType { get; set; }
        public string Status { get; set; }
        public DateTime StartedAtUtc { get; set; }
        public int DurationSeconds { get; set; }
    }

    public class FinovoApiClient
    {
        private string _baseUrl;
        private string _bearerToken;
        private readonly JavaScriptSerializer _serializer;

        public string BaseUrl
        {
            get { return _baseUrl; }
            set { _baseUrl = value.TrimEnd('/'); }
        }

        public string BearerToken
        {
            get { return _bearerToken; }
            set { _bearerToken = value; }
        }

        public FinovoApiClient(string baseUrl = "http://127.0.0.1:8000")
        {
            BaseUrl = baseUrl;
            _serializer = new JavaScriptSerializer();
            try
            {
                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls;
            }
            catch { }
        }

        public bool CheckHealth()
        {
            try
            {
                var req = (HttpWebRequest)WebRequest.Create(_baseUrl + "/api/v1/auth/login");
                req.Method = "POST";
                req.Timeout = 4000;
                req.ContentType = "application/json";
                req.Accept = "application/json";
                byte[] dummy = Encoding.UTF8.GetBytes("{}");
                req.ContentLength = dummy.Length;
                using (var s = req.GetRequestStream()) s.Write(dummy, 0, dummy.Length);
                using (var resp = (HttpWebResponse)req.GetResponse())
                {
                    return true;
                }
            }
            catch (WebException ex)
            {
                var webResp = ex.Response as HttpWebResponse;
                if (webResp != null)
                {
                    int code = (int)webResp.StatusCode;
                    return code >= 200 && code < 500;
                }
                return false;
            }
            catch
            {
                return false;
            }
        }

        public UserSession Login(string email, string password)
        {
            string url = _baseUrl + "/api/v1/auth/login";
            var payload = new Dictionary<string, object>
            {
                { "email", email },
                { "password", password }
            };

            string json = SendRequest("POST", url, payload, null);
            var res = _serializer.Deserialize<Dictionary<string, object>>(json);

            if (res != null && res.ContainsKey("token"))
            {
                string token = res["token"].ToString();
                var userObj = res.ContainsKey("user") ? res["user"] as Dictionary<string, object> : null;

                var session = new UserSession
                {
                    Token = token,
                    Email = email,
                    UserName = userObj != null && userObj.ContainsKey("name") ? userObj["name"].ToString() : email,
                    UserId = userObj != null && userObj.ContainsKey("id") ? Convert.ToInt64(userObj["id"]) : 0,
                    CompanySlug = "bitspark-ops",
                    CompanyName = "Finovo Global Enterprise"
                };

                _bearerToken = token;

                try
                {
                    var meRes = GetMe(token);
                    if (meRes != null && meRes.ContainsKey("companies"))
                    {
                        var comps = meRes["companies"] as ArrayList;
                        if (comps != null && comps.Count > 0)
                        {
                            var firstMem = comps[0] as Dictionary<string, object>;
                            if (firstMem != null && firstMem.ContainsKey("company"))
                            {
                                var comp = firstMem["company"] as Dictionary<string, object>;
                                if (comp != null)
                                {
                                    if (comp.ContainsKey("slug")) session.CompanySlug = comp["slug"].ToString();
                                    if (comp.ContainsKey("name")) session.CompanyName = comp["name"].ToString();
                                }
                            }
                        }
                    }
                }
                catch { }

                return session;
            }

            throw new InvalidOperationException("Invalid response credentials from authentication server.");
        }

        public Dictionary<string, object> GetMe(string token = null)
        {
            string url = _baseUrl + "/api/v1/me";
            string json = SendRequest("GET", url, null, token ?? _bearerToken);
            return _serializer.Deserialize<Dictionary<string, object>>(json);
        }

        public bool RegisterDevice(string companySlug, string deviceUid, string deviceName)
        {
            try
            {
                string url = string.Format("{0}/api/v1/companies/{1}/time/devices/register", _baseUrl, companySlug);
                var payload = new Dictionary<string, object>
                {
                    { "device_uid", deviceUid },
                    { "device_name", deviceName },
                    { "os_version", Environment.OSVersion.VersionString },
                    { "client_version", "2.4.1" },
                    { "device_type", "desktop_windows" }
                };

                SendRequest("POST", url, payload, _bearerToken);
                return true;
            }
            catch
            {
                return false;
            }
        }

        public List<ProjectDto> GetProjects(string companySlug)
        {
            var list = new List<ProjectDto>();
            try
            {
                string url = string.Format("{0}/api/v1/companies/{1}/projects?per_page=100", _baseUrl, companySlug);
                string json = SendRequest("GET", url, null, _bearerToken);
                var root = _serializer.Deserialize<Dictionary<string, object>>(json);

                ArrayList data = null;
                if (root != null && root.ContainsKey("data")) data = root["data"] as ArrayList;
                else if (root != null && root.ContainsKey("projects"))
                {
                    var pObj = root["projects"] as Dictionary<string, object>;
                    if (pObj != null && pObj.ContainsKey("data")) data = pObj["data"] as ArrayList;
                }

                if (data != null)
                {
                    foreach (var item in data)
                    {
                        var d = item as Dictionary<string, object>;
                        if (d != null)
                        {
                            list.Add(new ProjectDto
                            {
                                Id = Convert.ToInt64(d["id"]),
                                Name = d.ContainsKey("name") && d["name"] != null ? d["name"].ToString() : "Untitled Project",
                                ProjectCode = d.ContainsKey("project_code") && d["project_code"] != null ? d["project_code"].ToString() : ""
                            });
                        }
                    }
                }
            }
            catch { }
            return list;
        }

        public List<TaskDto> GetTasks(string companySlug, long? projectId)
        {
            var list = new List<TaskDto>();
            try
            {
                string url = string.Format("{0}/api/v1/companies/{1}/tasks?per_page=100", _baseUrl, companySlug);
                if (projectId.HasValue) url += "&project_id=" + projectId.Value;

                string json = SendRequest("GET", url, null, _bearerToken);
                var root = _serializer.Deserialize<Dictionary<string, object>>(json);

                ArrayList data = null;
                if (root != null && root.ContainsKey("tasks"))
                {
                    var tObj = root["tasks"] as Dictionary<string, object>;
                    if (tObj != null && tObj.ContainsKey("data")) data = tObj["data"] as ArrayList;
                }
                else if (root != null && root.ContainsKey("data"))
                {
                    data = root["data"] as ArrayList;
                }

                if (data != null)
                {
                    foreach (var item in data)
                    {
                        var d = item as Dictionary<string, object>;
                        if (d != null)
                        {
                            list.Add(new TaskDto
                            {
                                Id = Convert.ToInt64(d["id"]),
                                Title = d.ContainsKey("title") && d["title"] != null ? d["title"].ToString() : "Untitled Task",
                                TaskCode = d.ContainsKey("task_code") && d["task_code"] != null ? d["task_code"].ToString() : "",
                                ProjectId = d.ContainsKey("project_id") && d["project_id"] != null ? (long?)Convert.ToInt64(d["project_id"]) : null
                            });
                        }
                    }
                }
            }
            catch { }
            return list;
        }

        public TrackingSessionDto GetCurrentSession(string companySlug)
        {
            try
            {
                string url = string.Format("{0}/api/v1/companies/{1}/time/sessions/current", _baseUrl, companySlug);
                string json = SendRequest("GET", url, null, _bearerToken);
                var root = _serializer.Deserialize<Dictionary<string, object>>(json);

                if (root != null && root.ContainsKey("session") && root["session"] != null)
                {
                    var s = root["session"] as Dictionary<string, object>;
                    if (s != null) return ParseSession(s);
                }
            }
            catch { }
            return null;
        }

        public TrackingSessionDto StartSession(string companySlug, long? projectId, long? taskId, string activityType, string memo, string deviceUid)
        {
            string url = string.Format("{0}/api/v1/companies/{1}/time/sessions", _baseUrl, companySlug);
            var payload = new Dictionary<string, object>
            {
                { "project_id", projectId },
                { "task_id", taskId },
                { "activity_type", string.IsNullOrEmpty(activityType) ? "task" : activityType },
                { "description", memo },
                { "idempotency_key", Guid.NewGuid().ToString("N") },
                { "started_at", DateTime.UtcNow.ToString("O") }
            };

            string json = SendRequest("POST", url, payload, _bearerToken);
            var root = _serializer.Deserialize<Dictionary<string, object>>(json);
            if (root != null && root.ContainsKey("session") && root["session"] != null)
            {
                return ParseSession(root["session"] as Dictionary<string, object>);
            }
            throw new InvalidOperationException("Failed to start session on backend server.");
        }

        public TrackingSessionDto PauseSession(string companySlug, long sessionId)
        {
            string url = string.Format("{0}/api/v1/companies/{1}/time/sessions/{2}/pause", _baseUrl, companySlug, sessionId);
            string json = SendRequest("POST", url, null, _bearerToken);
            var root = _serializer.Deserialize<Dictionary<string, object>>(json);
            if (root != null && root.ContainsKey("session") && root["session"] != null)
            {
                return ParseSession(root["session"] as Dictionary<string, object>);
            }
            return null;
        }

        public TrackingSessionDto ResumeSession(string companySlug, long sessionId)
        {
            string url = string.Format("{0}/api/v1/companies/{1}/time/sessions/{2}/resume", _baseUrl, companySlug, sessionId);
            string json = SendRequest("POST", url, null, _bearerToken);
            var root = _serializer.Deserialize<Dictionary<string, object>>(json);
            if (root != null && root.ContainsKey("session") && root["session"] != null)
            {
                return ParseSession(root["session"] as Dictionary<string, object>);
            }
            return null;
        }

        public TrackingSessionDto StopSession(string companySlug, long sessionId)
        {
            string url = string.Format("{0}/api/v1/companies/{1}/time/sessions/{2}/stop", _baseUrl, companySlug, sessionId);
            string json = SendRequest("POST", url, null, _bearerToken);
            var root = _serializer.Deserialize<Dictionary<string, object>>(json);
            if (root != null && root.ContainsKey("session") && root["session"] != null)
            {
                return ParseSession(root["session"] as Dictionary<string, object>);
            }
            return null;
        }

        public bool SyncBatch(string companySlug, string deviceUid, List<OfflineEvent> events)
        {
            if (events == null || events.Count == 0) return true;

            string url = string.Format("{0}/api/v1/companies/{1}/time/sync-batches", _baseUrl, companySlug);
            var eventList = new List<Dictionary<string, object>>();

            foreach (var e in events)
            {
                var evtDict = new Dictionary<string, object>
                {
                    { "event_id", e.EventId },
                    { "event_type", e.EventType ?? "interval" },
                    { "task_id", e.TaskId },
                    { "started_at", e.StartedAtUtc.ToString("O") },
                    { "ended_at", e.EndedAtUtc.HasValue ? e.EndedAtUtc.Value.ToString("O") : DateTime.UtcNow.ToString("O") },
                    { "duration_seconds", e.DurationSeconds }
                };
                eventList.Add(evtDict);
            }

            var payload = new Dictionary<string, object>
            {
                { "batch_uid", Guid.NewGuid().ToString("N") },
                { "device_uid", deviceUid },
                { "events", eventList }
            };

            try
            {
                SendRequest("POST", url, payload, _bearerToken);
                return true;
            }
            catch
            {
                return false;
            }
        }

        private TrackingSessionDto ParseSession(Dictionary<string, object> s)
        {
            if (s == null) return null;
            var dto = new TrackingSessionDto
            {
                Id = Convert.ToInt64(s["id"]),
                Status = s.ContainsKey("status") && s["status"] != null ? s["status"].ToString() : "idle",
                ActivityType = s.ContainsKey("activity_type") && s["activity_type"] != null ? s["activity_type"].ToString() : "task",
                DurationSeconds = s.ContainsKey("duration_seconds") && s["duration_seconds"] != null ? Convert.ToInt32(s["duration_seconds"]) : 0
            };

            if (s.ContainsKey("started_at") && s["started_at"] != null)
            {
                DateTime dt;
                if (DateTime.TryParse(s["started_at"].ToString(), out dt)) dto.StartedAtUtc = dt.ToUniversalTime();
            }

            if (s.ContainsKey("project_id") && s["project_id"] != null)
            {
                dto.ProjectId = Convert.ToInt64(s["project_id"]);
            }
            if (s.ContainsKey("project") && s["project"] != null)
            {
                var prj = s["project"] as Dictionary<string, object>;
                if (prj != null && prj.ContainsKey("name") && prj["name"] != null) dto.ProjectName = prj["name"].ToString();
            }

            if (s.ContainsKey("task_id") && s["task_id"] != null)
            {
                dto.TaskId = Convert.ToInt64(s["task_id"]);
            }
            if (s.ContainsKey("task") && s["task"] != null)
            {
                var tsk = s["task"] as Dictionary<string, object>;
                if (tsk != null && tsk.ContainsKey("title") && tsk["title"] != null) dto.TaskTitle = tsk["title"].ToString();
            }

            return dto;
        }

        private string SendRequest(string method, string url, object payload, string token)
        {
            var req = (HttpWebRequest)WebRequest.Create(url);
            req.Method = method;
            req.ContentType = "application/json";
            req.Accept = "application/json";
            req.Timeout = 12000;

            if (!string.IsNullOrEmpty(token)) req.Headers["Authorization"] = "Bearer " + token;

            if (payload != null && (method == "POST" || method == "PATCH" || method == "PUT"))
            {
                string jsonBody = _serializer.Serialize(payload);
                byte[] bytes = Encoding.UTF8.GetBytes(jsonBody);
                req.ContentLength = bytes.Length;
                using (var stream = req.GetRequestStream())
                {
                    stream.Write(bytes, 0, bytes.Length);
                }
            }

            using (var resp = (HttpWebResponse)req.GetResponse())
            using (var reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }
    }
}

