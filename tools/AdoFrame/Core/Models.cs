namespace AdoFrame.Core;

public enum CaptureMode
{
    Auto,
    WindowCapture,
    PresentMon,
}

public enum FrameSourceKind
{
    WindowCapture,
    PresentMon,
}

public enum LogLevel
{
    Info,
    Warning,
    Error,
}

public enum RunnerState
{
    Idle,
    Starting,
    Running,
    Stopping,
    Completed,
    Failed,
}

public sealed class WindowInfo
{
    public IntPtr Handle { get; init; }
    public uint ProcessId { get; init; }
    public string Title { get; init; } = "";
    public string ProcessName { get; init; } = "";
    public string ExecutablePath { get; init; } = "";
    public string ClassName { get; init; } = "";
    public bool IsBrowser { get; init; }
    public bool IsMinimized { get; init; }

    public string DisplayTitle => string.IsNullOrWhiteSpace(Title) ? "(无标题窗口)" : Title;
    public string ProcessLabel => string.IsNullOrWhiteSpace(ProcessName) ? $"PID {ProcessId}" : ProcessName;
    public string KindLabel => IsBrowser ? "浏览器" : "应用";
    public string KindShortLabel => IsBrowser ? "网页" : "应用";

    public override string ToString() => $"{DisplayTitle} · {ProcessLabel} ({ProcessId})";
}

public sealed class SessionMetadata
{
    public string AppName { get; set; } = "";
    public string Tester { get; set; } = "";
    public string Scene { get; set; } = "";
    public string Notes { get; set; } = "";
}

public sealed class SessionOptions
{
    public CaptureMode Mode { get; set; } = CaptureMode.Auto;
    public double DurationSeconds { get; set; } = 60;
    public double WarmupSeconds { get; set; } = 3;
    public double MaxFrameTimeMs { get; set; } = 1000;
    public int StartDelaySeconds { get; set; } = 3;
    public bool AutoExport { get; set; } = true;
    public string OutputDirectory { get; set; } = "";
    public string PresentMonPath { get; set; } = "";
    public bool AggregateProcessTree { get; set; } = true;

    public SessionOptions Clone() => (SessionOptions)MemberwiseClone();
}

public sealed class SystemInfo
{
    public string CpuName { get; set; } = "未知 CPU";
    public int LogicalProcessors { get; set; }
    public double TotalMemoryMB { get; set; }
    public string GpuName { get; set; } = "未知 GPU";
    public string OsName { get; set; } = "Windows";
    public string OsVersion { get; set; } = "";
    public string OsBuild { get; set; } = "";
    public string MachineName { get; set; } = "";
    public string UserName { get; set; } = "";

    public string MonitorName { get; set; } = "";
    public int MonitorWidth { get; set; }
    public int MonitorHeight { get; set; }
    public int MonitorRefreshHz { get; set; }
    public int WindowWidth { get; set; }
    public int WindowHeight { get; set; }
    public int Dpi { get; set; }

    public string CpuSummary => $"{CpuName} ({LogicalProcessors} 线程)";
    public string MemorySummary => $"{TotalMemoryMB / 1024.0:0.0} GB";
    public string MonitorSummary => MonitorWidth > 0
        ? $"{MonitorWidth}×{MonitorHeight} @ {MonitorRefreshHz} Hz"
        : "未知显示器";
}

public readonly record struct FrameSample(
    double SessionTimeMs,
    double FrameTimeMs,
    double? CpuBusyMs,
    double? GpuBusyMs,
    double? DisplayLatencyMs,
    double? DisplayedTimeMs,
    string? PresentMode,
    string? SwapChain,
    bool? Displayed,
    double SourceTimestampMs);

public sealed class ResourceSample
{
    public double ElapsedMs { get; set; }
    public double WorkingSetMB { get; set; }
    public double PrivateMB { get; set; }
    public double CpuPercent { get; set; }
    public int ProcessCount { get; set; }
    public int ThreadCount { get; set; }
    public int HandleCount { get; set; }
    public bool Foreground { get; set; }
    public bool Alive { get; set; } = true;
}

public sealed class TimelinePoint
{
    public int Second { get; set; }
    public int Frames { get; set; }
    public double Fps { get; set; }
    public double AvgFrameTimeMs { get; set; }
    public double P99FrameTimeMs { get; set; }
    public double? GpuBusyPercent { get; set; }
    public double WorkingSetMB { get; set; }
    public double PrivateMB { get; set; }
    public double CpuPercent { get; set; }
    public bool Foreground { get; set; }
    public bool IsWarmup { get; set; }
}

public sealed class LiveSnapshot
{
    public RunnerState State { get; set; }
    public string Status { get; set; } = "";
    public string SourceLabel { get; set; } = "";
    public string TargetTitle { get; set; } = "";
    public double ElapsedSeconds { get; set; }
    public long TotalFrames { get; set; }
    public long ValidFrames { get; set; }
    public double CurrentFps { get; set; }
    public double AverageFps { get; set; }
    public double OnePercentLowFps { get; set; }
    public double PointOnePercentLowFps { get; set; }
    public double LastFrameTimeMs { get; set; }
    public double AverageFrameTimeMs { get; set; }
    public double P99FrameTimeMs { get; set; }
    public double MaxFrameTimeMs { get; set; }
    public double WorkingSetMB { get; set; }
    public double PrivateMB { get; set; }
    public double PeakWorkingSetMB { get; set; }
    public double CpuPercent { get; set; }
    public double PeakCpuPercent { get; set; }
    public int Threads { get; set; }
    public int Handles { get; set; }
    public int ProcessCount { get; set; }
    public bool Foreground { get; set; }
    public bool TargetAlive { get; set; } = true;
    public bool HasFrames { get; set; }
}

public sealed class SessionSummary
{
    public string WindowTitle { get; set; } = "";
    public string WindowClass { get; set; } = "";
    public string ProcessName { get; set; } = "";
    public string ProcessPath { get; set; } = "";
    public uint ProcessId { get; set; }
    public string SourceLabel { get; set; } = "";
    public string CaptureModeLabel { get; set; } = "";

    public double RecordingSeconds { get; set; }
    public double AnalysisSeconds { get; set; }
    public long TotalFrames { get; set; }
    public long ValidFrames { get; set; }

    public int SwapChainCount { get; set; }
    public string PrimarySwapChain { get; set; } = "";

    public double AvgFps { get; set; }
    public double OnePercentLowFps { get; set; }
    public double PointOnePercentLowFps { get; set; }
    public double MinFps { get; set; }
    public double MaxFps { get; set; }

    public double AvgFrameTimeMs { get; set; }
    public double MedianFrameTimeMs { get; set; }
    public double P95FrameTimeMs { get; set; }
    public double P99FrameTimeMs { get; set; }
    public double MaxFrameTimeMs { get; set; }
    public double MinFrameTimeMs { get; set; }

    public double CpuAvgPercent { get; set; }
    public double CpuPeakPercent { get; set; }

    public double WorkingSetStartMB { get; set; }
    public double WorkingSetEndMB { get; set; }
    public double WorkingSetAvgMB { get; set; }
    public double WorkingSetPeakMB { get; set; }

    public double PrivateStartMB { get; set; }
    public double PrivateEndMB { get; set; }
    public double PrivatePeakMB { get; set; }

    public int PeakThreads { get; set; }
    public int PeakHandles { get; set; }
    public int PeakProcessCount { get; set; }
    public double ForegroundRatio { get; set; }

    public double? GpuBusyAvgPercent { get; set; }
    public double? DisplayLatencyAvgMs { get; set; }
    public double? DisplayLatencyP95Ms { get; set; }
    public string DominantPresentMode { get; set; } = "";

    public double WarmupSeconds { get; set; }
    public double MaxFrameTimeFilterMs { get; set; }
    public string StopReason { get; set; } = "";
    public string[] Warnings { get; set; } = Array.Empty<string>();

    public bool HasFrames => ValidFrames > 0;
}

public sealed class SessionResult
{
    public DateTime StartedAt { get; set; }
    public DateTime EndedAt { get; set; }
    public SessionMetadata Metadata { get; set; } = new();
    public SessionOptions Options { get; set; } = new();
    public WindowInfo Window { get; set; } = new();
    public SystemInfo SystemInfo { get; set; } = new();
    public FrameSourceKind SourceKind { get; set; }
    public string SourceLabel { get; set; } = "";
    public string StopReason { get; set; } = "";
    public List<string> Warnings { get; set; } = new();
    public List<FrameSample> Frames { get; set; } = new();
    public List<ResourceSample> Resources { get; set; } = new();
    public List<TimelinePoint> Timeline { get; set; } = new();
    public SessionSummary Summary { get; set; } = new();
    public string OutputDirectory { get; set; } = "";

    public string AppLabel => string.IsNullOrWhiteSpace(Metadata.AppName)
        ? (string.IsNullOrWhiteSpace(Window.ProcessName) ? "未命名作品" : Window.ProcessName)
        : Metadata.AppName;

    public bool HasFrames => Summary.ValidFrames > 0;
}

public readonly record struct LogEntry(DateTime Time, string Message, LogLevel Level);
