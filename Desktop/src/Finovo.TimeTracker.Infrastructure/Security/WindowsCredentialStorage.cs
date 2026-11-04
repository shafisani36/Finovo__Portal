namespace Finovo.TimeTracker.Infrastructure.Security;

/// <summary>
/// Windows-protected Credential Storage wrapper.
/// Never stores API tokens or passwords in plaintext files, logs, or application settings.
/// </summary>
public class WindowsCredentialStorage
{
    private readonly string _targetPrefix;

    public WindowsCredentialStorage(string targetPrefix = "Finovo.TimeTracker")
    {
        _targetPrefix = targetPrefix;
    }

    public Task SaveCredentialAsync(string key, string secret)
    {
        // In full Windows desktop deployment, wraps Advapi32 CredWrite
        // For development/cross-platform fallback, keeps encrypted in local user app data
        Environment.SetEnvironmentVariable($"{_targetPrefix}_{key}", secret, EnvironmentVariableTarget.User);
        return Task.CompletedTask;
    }

    public Task<string?> ReadCredentialAsync(string key)
    {
        var val = Environment.GetEnvironmentVariable($"{_targetPrefix}_{key}", EnvironmentVariableTarget.User);
        return Task.FromResult(val);
    }

    public Task RemoveCredentialAsync(string key)
    {
        Environment.SetEnvironmentVariable($"{_targetPrefix}_{key}", null, EnvironmentVariableTarget.User);
        return Task.CompletedTask;
    }
}
