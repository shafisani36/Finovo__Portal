using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Finovo.TimeTracker.Application.Interfaces;
using Finovo.TimeTracker.Domain.Entities;
using Finovo.TimeTracker.Domain.ValueObjects;

namespace Finovo.TimeTracker.Infrastructure.Api;

public class TimeTrackerApiClient : IApiClient
{
    private readonly HttpClient _httpClient;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public TimeTrackerApiClient(HttpClient httpClient, string? bearerToken = null)
    {
        _httpClient = httpClient;
        if (!string.IsNullOrEmpty(bearerToken))
        {
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", bearerToken);
        }
        _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public async Task<WorkSession?> StartSessionAsync(string companySlug, long? taskId, string? idempotencyKey, CancellationToken ct = default)
    {
        var response = await _httpClient.PostAsJsonAsync($"/api/v1/companies/{companySlug}/time/sessions", new
        {
            task_id = taskId,
            idempotency_key = idempotencyKey,
            started_at = DateTime.UtcNow.ToString("O"),
        }, _jsonOptions, ct);

        if (!response.IsSuccessStatusCode) return null;

        var json = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions, ct);
        if (json.TryGetProperty("session", out var s))
        {
            return ParseWorkSession(s);
        }
        return null;
    }

    public async Task<WorkSession?> GetCurrentSessionAsync(string companySlug, CancellationToken ct = default)
    {
        var response = await _httpClient.GetAsync($"/api/v1/companies/{companySlug}/time/sessions/current", ct);
        if (!response.IsSuccessStatusCode) return null;

        var json = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions, ct);
        if (json.TryGetProperty("session", out var s) && s.ValueKind == JsonValueKind.Object)
        {
            return ParseWorkSession(s);
        }
        return null;
    }

    public async Task<WorkSession?> PauseSessionAsync(string companySlug, long sessionId, CancellationToken ct = default)
    {
        var response = await _httpClient.PostAsync($"/api/v1/companies/{companySlug}/time/sessions/{sessionId}/pause", null, ct);
        if (!response.IsSuccessStatusCode) return null;

        var json = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions, ct);
        return json.TryGetProperty("session", out var s) ? ParseWorkSession(s) : null;
    }

    public async Task<WorkSession?> ResumeSessionAsync(string companySlug, long sessionId, CancellationToken ct = default)
    {
        var response = await _httpClient.PostAsync($"/api/v1/companies/{companySlug}/time/sessions/{sessionId}/resume", null, ct);
        if (!response.IsSuccessStatusCode) return null;

        var json = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions, ct);
        return json.TryGetProperty("session", out var s) ? ParseWorkSession(s) : null;
    }

    public async Task<WorkSession?> StopSessionAsync(string companySlug, long sessionId, CancellationToken ct = default)
    {
        var response = await _httpClient.PostAsync($"/api/v1/companies/{companySlug}/time/sessions/{sessionId}/stop", null, ct);
        if (!response.IsSuccessStatusCode) return null;

        var json = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions, ct);
        return json.TryGetProperty("session", out var s) ? ParseWorkSession(s) : null;
    }

    public async Task<WorkSession?> SwitchTaskAsync(string companySlug, long sessionId, long newTaskId, CancellationToken ct = default)
    {
        var response = await _httpClient.PostAsJsonAsync($"/api/v1/companies/{companySlug}/time/sessions/{sessionId}/switch-task", new
        {
            task_id = newTaskId
        }, _jsonOptions, ct);

        if (!response.IsSuccessStatusCode) return null;

        var json = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions, ct);
        return json.TryGetProperty("session", out var s) ? ParseWorkSession(s) : null;
    }

    public async Task<bool> SyncBatchAsync(string companySlug, string batchUid, IEnumerable<OfflineEvent> events, CancellationToken ct = default)
    {
        var payload = new
        {
            batch_uid = batchUid,
            events = events.Select(e => new
            {
                event_id = e.EventId,
                event_type = e.EventType,
                task_id = e.TaskId,
                started_at = e.StartedAtUtc?.ToString("O") ?? DateTime.UtcNow.ToString("O"),
                ended_at = e.EndedAtUtc?.ToString("O"),
                duration_seconds = e.MonotonicElapsedMs > 0 ? (int)(e.MonotonicElapsedMs / 1000) : 0,
            })
        };

        var response = await _httpClient.PostAsJsonAsync($"/api/v1/companies/{companySlug}/time/sync-batches", payload, _jsonOptions, ct);
        return response.IsSuccessStatusCode;
    }

    public async Task<AttendanceStatusDto?> GetTodayAttendanceAsync(string companySlug, CancellationToken ct = default)
    {
        var response = await _httpClient.GetAsync($"/api/v1/companies/{companySlug}/attendance/me/today", ct);
        if (!response.IsSuccessStatusCode) return null;

        var json = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions, ct);
        var dto = new AttendanceStatusDto
        {
            WorkDate = json.TryGetProperty("work_date", out var wd) ? wd.GetString() ?? "" : "",
            Status = json.TryGetProperty("status", out var st) ? st.GetString() ?? "not_clocked_in" : "not_clocked_in",
        };

        if (json.TryGetProperty("shift", out var shift) && shift.ValueKind == JsonValueKind.Object)
        {
            dto.ShiftName = shift.TryGetProperty("name", out var sn) ? sn.GetString() : null;
        }

        if (json.TryGetProperty("attendance", out var att) && att.ValueKind == JsonValueKind.Object)
        {
            dto.ClockedInAt = att.TryGetProperty("first_clock_in_at", out var cin) ? cin.GetString() : null;
            dto.ClockedOutAt = att.TryGetProperty("last_clock_out_at", out var cout) ? cout.GetString() : null;
            dto.WorkedSeconds = att.TryGetProperty("worked_seconds", out var ws) ? ws.GetInt64() : 0;
        }

        return dto;
    }

    public async Task<AttendanceStatusDto?> ClockInAttendanceAsync(string companySlug, string? deviceId, CancellationToken ct = default)
    {
        var response = await _httpClient.PostAsJsonAsync($"/api/v1/companies/{companySlug}/attendance/clock-in", new
        {
            source = "desktop",
            device_id = deviceId ?? "WPF-TRACKER-01",
        }, _jsonOptions, ct);

        if (!response.IsSuccessStatusCode) return null;
        return await GetTodayAttendanceAsync(companySlug, ct);
    }

    public async Task<AttendanceStatusDto?> ClockOutAttendanceAsync(string companySlug, CancellationToken ct = default)
    {
        var response = await _httpClient.PostAsJsonAsync($"/api/v1/companies/{companySlug}/attendance/clock-out", new
        {
            source = "desktop",
        }, _jsonOptions, ct);

        if (!response.IsSuccessStatusCode) return null;
        return await GetTodayAttendanceAsync(companySlug, ct);
    }

    public async Task<MonitoringPolicyDto?> GetEffectivePolicyAsync(string companySlug, CancellationToken ct = default)
    {
        var response = await _httpClient.GetAsync($"/api/v1/companies/{companySlug}/monitoring/policy/current", ct);
        if (!response.IsSuccessStatusCode) return null;

        var json = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions, ct);
        if (!json.TryGetProperty("policy", out var pol)) return null;

        return new MonitoringPolicyDto
        {
            Id = pol.GetProperty("id").GetInt64(),
            Name = pol.GetProperty("name").GetString() ?? "Default Policy",
            Version = pol.GetProperty("version").GetInt32(),
            IsActive = pol.GetProperty("is_active").GetBoolean(),
            AllowAppCategoryCollection = pol.GetProperty("allow_app_category_collection").GetBoolean(),
            AllowForegroundApp = pol.GetProperty("allow_foreground_app").GetBoolean(),
            AllowInputActivity = pol.GetProperty("allow_input_activity").GetBoolean(),
            IdleThresholdSeconds = pol.GetProperty("idle_threshold_seconds").GetInt32(),
            AllowOfflineQueue = pol.GetProperty("allow_offline_queue").GetBoolean(),
            OfflineGraceHours = pol.GetProperty("offline_grace_hours").GetInt32(),
            RetentionDays = pol.GetProperty("retention_days").GetInt32(),
            MinClientVersion = pol.TryGetProperty("min_client_version", out var mcv) ? mcv.GetString() ?? "1.0.0" : "1.0.0",
            IsAcknowledged = json.TryGetProperty("is_acknowledged", out var ack) && ack.GetBoolean(),
        };
    }

    public async Task<bool> SubmitMonitoringBatchAsync(string companySlug, string deviceUid, string batchUid, IEnumerable<MonitoringEventDto> events, CancellationToken ct = default)
    {
        var payload = new
        {
            device_uid = deviceUid,
            batch_uid = batchUid,
            events = events.Select(e => new
            {
                event_uid = e.EventUid,
                event_type = e.EventType,
                client_occurred_at = e.ClientOccurredAt.ToString("O"),
                client_sequence = e.ClientSequence,
                category = e.Category,
                idle_duration_seconds = e.IdleDurationSeconds,
                project_id = e.ProjectId,
                task_id = e.TaskId,
                work_session_id = e.WorkSessionId,
            }).ToArray(),
        };

        var response = await _httpClient.PostAsJsonAsync($"/api/v1/companies/{companySlug}/monitoring/events/batches", payload, _jsonOptions, ct);
        return response.IsSuccessStatusCode;
    }

    public async Task<bool> SendHeartbeatAsync(string companySlug, long deviceId, int pendingCount, string syncStatus, CancellationToken ct = default)
    {
        var payload = new
        {
            pending_sync_count = pendingCount,
            last_sync_status = syncStatus,
        };

        var response = await _httpClient.PostAsJsonAsync($"/api/v1/companies/{companySlug}/monitoring/devices/{deviceId}/heartbeat", payload, _jsonOptions, ct);
        return response.IsSuccessStatusCode;
    }

    private static WorkSession ParseWorkSession(JsonElement s)
    {
        var session = new WorkSession
        {
            Id = s.GetProperty("id").GetInt64(),
            CompanyId = s.GetProperty("company_id").GetInt64(),
            Status = s.GetProperty("status").GetString() switch
            {
                "running" => SessionStatus.Running,
                "paused" => SessionStatus.Paused,
                "stopped" => SessionStatus.Stopped,
                _ => SessionStatus.Idle,
            },
            StartedAtUtc = DateTime.TryParse(s.GetProperty("started_at").GetString(), out var dt) ? dt : DateTime.UtcNow,
            ElapsedMilliseconds = s.TryGetProperty("duration_seconds", out var ds) ? ds.GetInt64() * 1000 : 0,
            Version = s.TryGetProperty("version", out var v) ? v.GetUInt32() : 1,
        };

        if (s.TryGetProperty("task_id", out var tid) && tid.ValueKind == JsonValueKind.Number)
        {
            session.TaskId = tid.GetInt64();
        }

        if (s.TryGetProperty("task", out var taskObj) && taskObj.ValueKind == JsonValueKind.Object)
        {
            session.TaskTitle = taskObj.TryGetProperty("title", out var title) ? title.GetString() : null;
        }

        return session;
    }
}
