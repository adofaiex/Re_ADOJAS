using System.Diagnostics;
using System.Globalization;
using System.Text;

namespace AdoFrame.Core.Capture;

/// <summary>
/// Process-level frame capture through Intel PresentMon's ETW backend.
/// This is the most accurate source for native games, including uncapped frame rates
/// and applications that present through a GPU process other than their window process.
/// </summary>
public sealed class PresentMonFrameSource : IFrameSource
{
    private readonly string _presentMonPath;
    private readonly uint _processId;
    private readonly string _sessionName;
    private readonly Stopwatch _clock = new();
    private readonly object _gate = new();
    private readonly Dictionary<string, int> _swapChainCounts = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, double> _lastSourceTime = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, int> _columns = new(StringComparer.OrdinalIgnoreCase);

    private Process? _process;
    private int _stopping;
    private bool IsStopping => Volatile.Read(ref _stopping) != 0;
    private bool _headerSeen;
    private bool _reportedElevationWarning;
    private bool _reportedMultipleSwapChains;
    private long _lastPrimarySelectionTick;
    private string? _primarySwapChain;

    public PresentMonFrameSource(string presentMonPath, uint processId)
    {
        _presentMonPath = presentMonPath;
        _processId = processId;
        // AdoFrame is a single-instance app, so a stable session name is safe and lets
        // the next launch clean up a session left behind by a forced shutdown.
        _sessionName = "AdoFramePerf";
    }

    public FrameSourceKind Kind => FrameSourceKind.PresentMon;

    public string Label => "PresentMon（进程级）";

    public string? PrimarySwapChain
    {
        get
        {
            lock (_gate)
            {
                return _primarySwapChain;
            }
        }
    }

    public event Action<FrameSample>? FrameReceived;
    public event Action<string, LogLevel>? Log;
    public event Action<string>? Faulted;

    public void Start()
    {
        if (!File.Exists(_presentMonPath))
        {
            throw new FileNotFoundException(
                "找不到 PresentMon.exe。请确认 third_party\\PresentMon\\PresentMon.exe 与程序一起发布。",
                _presentMonPath);
        }

        var args = string.Join(' ',
            $"--process_id {_processId}",
            "--output_stdout",
            "--no_console_stats",
            "--no_track_input",
            "--terminate_on_proc_exit",
            $"--session_name \"{_sessionName}\"",
            "--stop_existing_session");

        var startInfo = new ProcessStartInfo
        {
            FileName = _presentMonPath,
            Arguments = args,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
            WorkingDirectory = Path.GetDirectoryName(_presentMonPath) ?? AppContext.BaseDirectory,
        };

        _clock.Restart();
        _process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        _process.OutputDataReceived += OnOutputDataReceived;
        _process.ErrorDataReceived += OnErrorDataReceived;
        _process.Exited += OnProcessExited;

        if (!_process.Start())
        {
            throw new InvalidOperationException("PresentMon 启动失败。");
        }

        _process.BeginOutputReadLine();
        _process.BeginErrorReadLine();
        _lastPrimarySelectionTick = Environment.TickCount64;
        LogMessage($"PresentMon 已启动（PID {_processId}）。", LogLevel.Info);
    }

    public void Stop()
    {
        if (Interlocked.Exchange(ref _stopping, 1) != 0)
        {
            return;
        }

        try
        {
            if (_process is { HasExited: false })
            {
                _process.Kill();
                _process.WaitForExit(2000);
            }
        }
        catch
        {
        }

        // OutputDataReceived is asynchronous; give the reader a moment to drain the final rows.
        Thread.Sleep(120);
        _clock.Stop();

        Task.Run(CleanupEtwSession);
    }

    private void CleanupEtwSession()
    {
        try
        {
            var args = $"--terminate_existing_session --session_name \"{_sessionName}\"";
            var psi = new ProcessStartInfo
            {
                FileName = _presentMonPath,
                Arguments = args,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                WorkingDirectory = Path.GetDirectoryName(_presentMonPath) ?? AppContext.BaseDirectory,
            };
            using var cleanup = Process.Start(psi);
            if (cleanup == null)
            {
                return;
            }

            cleanup.WaitForExit(3000);
            if (!cleanup.HasExited)
            {
                try
                {
                    cleanup.Kill();
                }
                catch
                {
                }
            }
        }
        catch
        {
            // The ETW session is also stopped on next launch via --stop_existing_session.
        }
    }

    private void OnProcessExited(object? sender, EventArgs e)
    {
        if (IsStopping)
        {
            return;
        }

        var code = -1;
        try
        {
            code = _process?.ExitCode ?? -1;
        }
        catch
        {
        }

        LogMessage($"PresentMon 已退出（exit code {code}）。", LogLevel.Warning);
        Faulted?.Invoke($"PresentMon 已退出（exit code {code}）。目标进程可能已结束，或 ETW 捕获被系统中断。");
    }

    private void OnErrorDataReceived(object? sender, DataReceivedEventArgs e)
    {
        if (string.IsNullOrWhiteSpace(e.Data))
        {
            return;
        }

        var line = e.Data.Trim();
        if (line.Contains("elevated privilege", StringComparison.OrdinalIgnoreCase))
        {
            if (!_reportedElevationWarning)
            {
                _reportedElevationWarning = true;
                LogMessage("PresentMon 提示：以管理员身份运行可提高对受保护/高权限进程的兼容性。", LogLevel.Warning);
            }

            return;
        }

        if (line.Contains("failed", StringComparison.OrdinalIgnoreCase) ||
            line.Contains("error", StringComparison.OrdinalIgnoreCase) ||
            line.Contains("access denied", StringComparison.OrdinalIgnoreCase))
        {
            LogMessage("PresentMon: " + line, LogLevel.Error);
            return;
        }

        if (line.StartsWith("warning", StringComparison.OrdinalIgnoreCase))
        {
            LogMessage("PresentMon: " + line, LogLevel.Warning);
            return;
        }

        if (line.StartsWith("Started recording", StringComparison.OrdinalIgnoreCase) ||
            line.StartsWith("Stopped recording", StringComparison.OrdinalIgnoreCase))
        {
            LogMessage(line, LogLevel.Info);
        }
    }

    private void OnOutputDataReceived(object? sender, DataReceivedEventArgs e)
    {
        if (IsStopping || string.IsNullOrWhiteSpace(e.Data))
        {
            return;
        }

        var line = e.Data.TrimStart('\uFEFF');
        if (!_headerSeen)
        {
            if (line.StartsWith("Application,", StringComparison.OrdinalIgnoreCase) ||
                (line.Contains("Application", StringComparison.OrdinalIgnoreCase) &&
                 line.Contains("ProcessID", StringComparison.OrdinalIgnoreCase) &&
                 line.Contains("MsBetweenPresents", StringComparison.OrdinalIgnoreCase)))
            {
                ParseHeader(line);
                return;
            }

            if (line.StartsWith("warning", StringComparison.OrdinalIgnoreCase))
            {
                if (!_reportedElevationWarning)
                {
                    _reportedElevationWarning = true;
                    LogMessage("PresentMon: " + line, LogLevel.Warning);
                }
            }

            return;
        }

        ParseFrame(line);
    }

    private void ParseHeader(string line)
    {
        var fields = CsvUtil.Split(line);
        _columns.Clear();
        for (var i = 0; i < fields.Length; i++)
        {
            _columns[fields[i].Trim()] = i;
        }

        if (!_columns.ContainsKey("MsBetweenPresents"))
        {
            LogMessage("PresentMon CSV 缺少 MsBetweenPresents 列，无法统计帧率。", LogLevel.Error);
            Faulted?.Invoke("PresentMon 输出格式不兼容（缺少 MsBetweenPresents 列）。");
            return;
        }

        _headerSeen = true;
        LogMessage("PresentMon CSV 表头已就绪。", LogLevel.Info);
    }

    private void ParseFrame(string line)
    {
        string[] fields;
        try
        {
            fields = CsvUtil.Split(line);
        }
        catch
        {
            return;
        }

        if (fields.Length < 3)
        {
            return;
        }

        if (TryGetField(fields, "ProcessID", out var pidText) &&
            uint.TryParse(pidText, out var pid) && pid != 0 && pid != _processId)
        {
            return;
        }

        TryGetField(fields, "SwapChainAddress", out var swapChain);
        swapChain = string.IsNullOrWhiteSpace(swapChain) ? "default" : swapChain.Trim();

        var sourceTimeMs = ParseDoubleField(fields, "TimeInMs", out var parsedTime)
            ? parsedTime
            : _clock.Elapsed.TotalMilliseconds;

        double frameTimeMs;
        if (!ParseDoubleField(fields, "MsBetweenPresents", out frameTimeMs) || frameTimeMs <= 0)
        {
            lock (_gate)
            {
                if (_lastSourceTime.TryGetValue(swapChain, out var previousSourceTime) &&
                    sourceTimeMs > previousSourceTime)
                {
                    frameTimeMs = sourceTimeMs - previousSourceTime;
                }
                else
                {
                    _lastSourceTime[swapChain] = sourceTimeMs;
                    return;
                }
            }
        }

        lock (_gate)
        {
            _lastSourceTime[swapChain] = sourceTimeMs;
            _swapChainCounts.TryGetValue(swapChain, out var count);
            _swapChainCounts[swapChain] = count + 1;

            if (Environment.TickCount64 - _lastPrimarySelectionTick >= 2000)
            {
                _lastPrimarySelectionTick = Environment.TickCount64;
                SelectPrimarySwapChain();
            }
        }

        var cpuBusy = ParseNullableDoubleField(fields, "MsCPUBusy");
        var gpuBusy = ParseNullableDoubleField(fields, "MsGPUBusy");
        var untilDisplayed = ParseNullableDoubleField(fields, "MsUntilDisplayed");
        var displayChange = ParseNullableDoubleField(fields, "MsBetweenDisplayChange");
        bool? displayed = untilDisplayed.HasValue || displayChange.HasValue ? true : null;
        TryGetField(fields, "PresentMode", out var presentMode);

        var sample = new FrameSample(
            SessionTimeMs: _clock.Elapsed.TotalMilliseconds,
            FrameTimeMs: frameTimeMs,
            CpuBusyMs: cpuBusy,
            GpuBusyMs: gpuBusy,
            DisplayLatencyMs: untilDisplayed,
            DisplayedTimeMs: displayChange,
            PresentMode: string.IsNullOrWhiteSpace(presentMode) ? null : presentMode.Trim(),
            SwapChain: swapChain,
            Displayed: displayed,
            SourceTimestampMs: sourceTimeMs);

        try
        {
            FrameReceived?.Invoke(sample);
        }
        catch (Exception ex)
        {
            LogMessage("处理 PresentMon 帧数据时出错：" + ex.Message, LogLevel.Error);
        }
    }

    private void SelectPrimarySwapChain()
    {
        if (_swapChainCounts.Count == 0)
        {
            return;
        }

        var dominant = _swapChainCounts
            .OrderByDescending(kv => kv.Value)
            .ThenBy(kv => kv.Key, StringComparer.OrdinalIgnoreCase)
            .First();

        if (_swapChainCounts.Count > 1 && !_reportedMultipleSwapChains)
        {
            _reportedMultipleSwapChains = true;
            var detail = string.Join(", ", _swapChainCounts
                .OrderByDescending(kv => kv.Value)
                .Select(kv => $"{kv.Key}: {kv.Value} 帧"));
            LogMessage($"检测到多个交换链，仅用最活跃的交换链做统计（{detail}）。", LogLevel.Warning);
        }

        if (!string.Equals(_primarySwapChain, dominant.Key, StringComparison.OrdinalIgnoreCase))
        {
            _primarySwapChain = dominant.Key;
            LogMessage($"主交换链：{dominant.Key}", LogLevel.Info);
        }
    }

    private bool TryGetField(string[] fields, string name, out string value)
    {
        value = "";
        if (!_columns.TryGetValue(name, out var index) || index < 0 || index >= fields.Length)
        {
            return false;
        }

        value = fields[index];
        return true;
    }

    private bool ParseDoubleField(string[] fields, string name, out double value)
    {
        value = 0;
        return TryGetField(fields, name, out var text) &&
               double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out value);
    }

    private double? ParseNullableDoubleField(string[] fields, string name)
    {
        return ParseDoubleField(fields, name, out var value) ? value : null;
    }

    private void LogMessage(string message, LogLevel level)
    {
        try
        {
            Log?.Invoke(message, level);
        }
        catch
        {
        }
    }

    public void Dispose()
    {
        Stop();
        try
        {
            _process?.Dispose();
        }
        catch
        {
        }
    }
}
