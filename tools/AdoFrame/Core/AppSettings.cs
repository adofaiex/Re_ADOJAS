using System.Text.Json;

namespace AdoFrame.Core;

public sealed class AppSettings
{
    public string OutputDirectory { get; set; } = "";
    public string LastTester { get; set; } = "";
    public string PresentMonPath { get; set; } = "";
    public CaptureMode LastCaptureMode { get; set; } = CaptureMode.Auto;
    public double LastDurationSeconds { get; set; } = 60;
    public double LastWarmupSeconds { get; set; } = 3;
    public double LastMaxFrameTimeMs { get; set; } = 1000;
    public int LastStartDelaySeconds { get; set; } = 3;
    public bool AutoExport { get; set; } = true;
    public bool AggregateProcessTree { get; set; } = true;
    public string GlobalStopHotkey { get; set; } = "关闭（仅窗口内 F9）";

    public static AppSettings Load()
    {
        try
        {
            var path = AppPaths.SettingsFile;
            if (File.Exists(path))
            {
                var json = File.ReadAllText(path);
                var settings = JsonSerializer.Deserialize<AppSettings>(json);
                if (settings != null)
                {
                    if (string.IsNullOrWhiteSpace(settings.OutputDirectory))
                    {
                        settings.OutputDirectory = AppPaths.DefaultOutputDirectory;
                    }

                    return settings;
                }
            }
        }
        catch
        {
            // Corrupt settings should never prevent the app from starting.
        }

        return new AppSettings
        {
            OutputDirectory = AppPaths.DefaultOutputDirectory,
        };
    }

    public void Save()
    {
        try
        {
            Directory.CreateDirectory(AppPaths.SettingsDirectory);
            var json = JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(AppPaths.SettingsFile, json);
        }
        catch
        {
            // Saving preferences is best-effort.
        }
    }
}

public static class AppPaths
{
    public static string SettingsDirectory =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AdoFrame");

    public static string SettingsFile => Path.Combine(SettingsDirectory, "settings.json");

    public static string DefaultOutputDirectory
    {
        get
        {
            var documents = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            if (string.IsNullOrWhiteSpace(documents))
            {
                documents = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            }

            return Path.Combine(documents, "AdoFrame");
        }
    }

    public static string? FindPresentMon(string? configuredPath = null)
    {
        var candidates = new List<string>();
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            candidates.Add(configuredPath);
        }

        var baseDir = AppContext.BaseDirectory;
        candidates.Add(Path.Combine(baseDir, "third_party", "PresentMon", "PresentMon.exe"));
        candidates.Add(Path.Combine(baseDir, "PresentMon.exe"));
        candidates.Add(Path.Combine(baseDir, "tools", "PresentMon", "PresentMon.exe"));
        candidates.Add(Path.Combine(baseDir, "..", "third_party", "PresentMon", "PresentMon.exe"));
        candidates.Add(Path.Combine(Directory.GetCurrentDirectory(), "third_party", "PresentMon", "PresentMon.exe"));

        return candidates
            .Select(Path.GetFullPath)
            .FirstOrDefault(File.Exists);
    }
}
