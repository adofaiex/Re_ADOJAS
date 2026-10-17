using System.Collections.Concurrent;
using System.Diagnostics;
using AdoFrame.Core.Capture;

namespace AdoFrame.Core;

/// <summary>
/// Owns one capture session: chooses a frame source, samples process/memory data,
/// maintains live statistics and produces an immutable <see cref="SessionResult"/>.
/// </summary>
public sealed class BenchmarkRunner : IDisposable
{
    private const int MaxFrames = 3_000_000;
    private const double RecentWindowMs = 30_000;

    private sealed class LiveBucket
    {
        public TimelinePoint Point { get; } = new();
        public List<double> Intervals { get; } = new();
        public double Sum { get; set; }
        public double GpuBusySum { get; set; }
    }

    private readonly object _gate = new();
    private readonly object _stopGate = new();
    private readonly WindowInfo _window;
    private readonly SessionOptions _options;
    private readonly SessionMetadata _metadata;
    private readonly SystemInfo _systemInfo;
    private readonly string? _presentMonPath;

    private readonly List<FrameSample> _frames = new();
    private readonly List<ResourceSample> _resources = new();
    private readonly Queue<FrameSample> _recent = new();
    private readonly Dictionary<string, int> _swapChainCounts = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<int, LiveBucket> _buckets = new();
    private readonly ConcurrentQueue<LogEntry> _logs = new();
    private readonly Stopwatch _clock = new();

    private IFrameSource? _source;
    private ProcessTreeSampler? _sampler;
    private System.Threading.Timer? _timer;
    private RunnerState _state = RunnerState.Idle;
    private string _status = "未开始";
    private string _sourceLabel = "";
    private FrameSourceKind _sourceKind;
    private string _captureModeLabel = "";
    private DateTime _startedAt;
    private DateTime _endedAt;
    private double _recordingSeconds;
    private int _stopRequested;
    private bool _disposed;
    private bool _fallbackDone;
    private bool _fallbackStarted;
    private bool _maxFramesWarning;
    private bool _multipleSwapChainWarning;
    private bool _minimizeWarning;
    private bool _titleWarning;
    private bool _fallbackWarning;

    private string? _primarySwapChain;
    private long _lastSwapSelectionTick;
    private int _currentBucketSecond = -1;
    private LiveBucket? _currentBucket;

    private long _totalFrames;
    private long _validFrames;
    private double _validSumMs;
    private double _maxFrameTimeMs;
    private double _minFrameTimeMs = double.MaxValue;
    private double _lastFrameTimeMs;
    private double _peakWorkingSetMb;
    private double _peakPrivateMb;
    private double _peakCpuPercent;
    private double _lastWorkingSetMb;
    private double _lastPrivateMb;
    private double _lastCpuPercent;
    private int _lastThreads;
    private int _lastHandles;
    private int _lastProcessCount;
    private bool _lastForeground;
    private bool _targetAlive = true;
    private bool _processAccessWarning;

    private long _liveCacheTick;
    private double _liveCurrentFps;
    private double _liveLow1Fps;
    private double _liveLow01Fps;
    private double _liveP99Ms;

    private SessionResult? _result;
    private string _lastKnownTitle;
    private long _lastTitleCheckTick;
    private long _lastTitleLogTick;

    public BenchmarkRunner(
        WindowInfo window,
        SessionOptions options,
        SessionMetadata metadata,
        SystemInfo systemInfo,
        string? presentMonPath)
    {
        _window = window;
        _options = options.Clone();
        _metadata = metadata;
        _systemInfo = systemInfo;
        _presentMonPath = presentMonPath;
        _lastKnownTitle = window.Title;
    }

    public RunnerState State
    {
        get
        {
            lock (_gate)
            {
                return _state;
            }
        }
    }

    public string Status
    {
        get
        {
            lock (_gate)
            {
                return _status;
            }
        }
    }

    public string SourceLabel
    {
        get
        {
            lock (_gate)
            {
                return _sourceLabel;
            }
        }
    }

    public SessionResult? Result
    {
        get
        {
            lock (_gate)
            {
                return _result;
            }
        }
    }

    public void Start()
    {
        lock (_gate)
        {
            if (_state != RunnerState.Idle)
            {
                throw new InvalidOperationException("当前采集会话已经启动。");
            }

            _state = RunnerState.Starting;
            _status = "准备采集…";
            _startedAt = DateTime.Now;
            _clock.Restart();
            _swapChainCounts.Clear();
            _buckets.Clear();
            _frames.Clear();
            _resources.Clear();
            _recent.Clear();
            _validFrames = 0;
            _validSumMs = 0;
            _maxFrameTimeMs = 0;
            _minFrameTimeMs = double.MaxValue;
            _totalFrames = 0;
            _peakWorkingSetMb = 0;
            _peakPrivateMb = 0;
            _peakCpuPercent = 0;
            _lastWorkingSetMb = 0;
            _lastPrivateMb = 0;
            _lastCpuPercent = 0;
            _lastFrameTimeMs = 0;
            _primarySwapChain = null;
            _currentBucket = null;
            _currentBucketSecond = -1;
            _liveCacheTick = 0;
            _stopRequested = 0;
            _fallbackDone = false;
            _fallbackStarted = false;
            _maxFramesWarning = false;
            _multipleSwapChainWarning = false;
            _minimizeWarning = false;
            _titleWarning = false;
            _fallbackWarning = false;
            _targetAlive = true;
            _processAccessWarning = false;
            _lastKnownTitle = _window.Title;
            _lastTitleCheckTick = 0;
            _lastTitleLogTick = 0;
            _lastSwapSelectionTick = Environment.TickCount64;
            _lastResourceSampleAt = 0;

            _sampler = new ProcessTreeSampler(_window.ProcessId, _options.AggregateProcessTree);
            var prime = _sampler.Prime();
            prime.ElapsedMs = 0;
            AddResourceLocked(prime);
        }

        try
        {
            CreateAndStartSource();
        }
        catch (Exception ex)
        {
            FailStart(ex);
            return;
        }

        lock (_gate)
        {
            if (_state != RunnerState.Starting)
            {
                return;
            }

            _state = RunnerState.Running;
            _status = "采集中";
            _timer = new System.Threading.Timer(Tick, null, 250, 250);
        }

        AddLog($"开始采集：{WindowEnumerator.CompactTitle(_window.Title)}", LogLevel.Info);
        AddLog($"采集方式：{_captureModeLabel}；时长：{(_options.DurationSeconds > 0 ? $"{_options.DurationSeconds:0} 秒" : "手动停止")}；预热：{_options.WarmupSeconds:0.#} 秒。", LogLevel.Info);

        if (_window.IsBrowser && _sourceKind == FrameSourceKind.WindowCapture)
        {
            AddLog("浏览器/Electron 窗口使用窗口级捕获：只统计该窗口当前活动标签页的画面，不会混入同一浏览器的其它窗口。采集中请勿切换标签页或最小化窗口。", LogLevel.Info);
        }
        else if (_window.IsBrowser && _sourceKind == FrameSourceKind.PresentMon)
        {
            AddLog("浏览器窗口使用 PresentMon 只能按进程统计，可能混入其它标签页/窗口的帧。建议改用“窗口捕获（WGC）”。", LogLevel.Warning);
        }
    }

    private void CreateAndStartSource()
    {
        IFrameSource source;
        string modeLabel;
        FrameSourceKind kind;

        if (_options.Mode == CaptureMode.WindowCapture ||
            (_options.Mode == CaptureMode.Auto && _window.IsBrowser))
        {
            kind = FrameSourceKind.WindowCapture;
            modeLabel = _options.Mode == CaptureMode.Auto
                ? "自动 · 窗口捕获（当前标签页）"
                : "窗口捕获（WGC）";
            source = new WindowCaptureFrameSource(_window.Handle, _window.Title);
        }
        else if (_options.Mode == CaptureMode.PresentMon)
        {
            kind = FrameSourceKind.PresentMon;
            modeLabel = "PresentMon（进程级）";
            if (string.IsNullOrWhiteSpace(_presentMonPath))
            {
                throw new FileNotFoundException("找不到 PresentMon.exe。请检查 third_party\\PresentMon 目录。");
            }

            source = new PresentMonFrameSource(_presentMonPath, _window.ProcessId);
        }
        else
        {
            kind = FrameSourceKind.PresentMon;
            modeLabel = "自动 · PresentMon";
            if (string.IsNullOrWhiteSpace(_presentMonPath))
            {
                AddLog("未找到 PresentMon，自动改用窗口捕获（WGC）。", LogLevel.Warning);
                kind = FrameSourceKind.WindowCapture;
                modeLabel = "自动 · 窗口捕获（回退）";
                source = new WindowCaptureFrameSource(_window.Handle, _window.Title);
            }
            else
            {
                source = new PresentMonFrameSource(_presentMonPath, _window.ProcessId);
            }
        }

        source.Log += OnSourceLog;
        source.Faulted += OnSourceFaulted;
        source.FrameReceived += OnFrameReceived;

        lock (_gate)
        {
            _source = source;
            _sourceKind = kind;
            _sourceLabel = source.Label;
            _captureModeLabel = modeLabel;
        }

        try
        {
            source.Start();
        }
        catch
        {
            source.FrameReceived -= OnFrameReceived;
            source.Log -= OnSourceLog;
            source.Faulted -= OnSourceFaulted;
            source.Dispose();
            throw;
        }
    }

    private void FailStart(Exception ex)
    {
        AddLog("启动采集失败：" + ex.Message, LogLevel.Error);
        lock (_gate)
        {
            _state = RunnerState.Failed;
            _status = "启动失败：" + ex.Message;
            _endedAt = DateTime.Now;
            _source?.Dispose();
            _source = null;
            _timer?.Dispose();
            _timer = null;
        }
    }

    private void OnSourceLog(string message, LogLevel level) => AddLog(message, level);

    private void OnSourceFaulted(string reason)
    {
        AddLog("采集中断：" + reason, LogLevel.Error);
        StopInternal(reason, true);
    }

    private void OnFrameReceived(FrameSample sample)
    {
        lock (_gate)
        {
            if (_state != RunnerState.Running)
            {
                return;
            }

            if (_frames.Count >= MaxFrames)
            {
                if (!_maxFramesWarning)
                {
                    _maxFramesWarning = true;
                    AddLog($"原始帧数达到上限（{MaxFrames:N0}），后续帧只保留实时统计，不再写入原始数据。", LogLevel.Warning);
                }
            }
            else
            {
                _frames.Add(sample);
            }

            UpdateSwapChainLocked(sample);

            if (_primarySwapChain != null &&
                !string.IsNullOrWhiteSpace(sample.SwapChain) &&
                !string.Equals(sample.SwapChain, _primarySwapChain, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            _totalFrames++;
            _lastFrameTimeMs = sample.FrameTimeMs;
            _recent.Enqueue(sample);

            var cutoff = sample.SessionTimeMs - RecentWindowMs;
            while (_recent.Count > 0 && _recent.Peek().SessionTimeMs < cutoff)
            {
                _recent.Dequeue();
            }

            var usable = IsUsableInterval(sample);
            if (usable)
            {
                if (sample.SessionTimeMs >= _options.WarmupSeconds * 1000)
                {
                    _validFrames++;
                    _validSumMs += sample.FrameTimeMs;
                    _maxFrameTimeMs = Math.Max(_maxFrameTimeMs, sample.FrameTimeMs);
                    _minFrameTimeMs = Math.Min(_minFrameTimeMs, sample.FrameTimeMs);
                }

                UpdateBucketLocked(sample);
            }
            else
            {
                var second = (int)Math.Floor(sample.SessionTimeMs / 1000.0);
                GetOrCreateBucketLocked(second).Point.Frames++;
            }
        }
    }

    private void UpdateSwapChainLocked(FrameSample sample)
    {
        if (string.IsNullOrWhiteSpace(sample.SwapChain))
        {
            return;
        }

        _swapChainCounts.TryGetValue(sample.SwapChain, out var count);
        _swapChainCounts[sample.SwapChain] = count + 1;

        if (Environment.TickCount64 - _lastSwapSelectionTick < 2000)
        {
            return;
        }

        _lastSwapSelectionTick = Environment.TickCount64;
        var dominant = _swapChainCounts
            .OrderByDescending(kv => kv.Value)
            .ThenBy(kv => kv.Key, StringComparer.OrdinalIgnoreCase)
            .First();

        if (_swapChainCounts.Count > 1 && !_multipleSwapChainWarning)
        {
            _multipleSwapChainWarning = true;
            var detail = string.Join(", ", _swapChainCounts
                .OrderByDescending(kv => kv.Value)
                .Select(kv => $"{kv.Key}: {kv.Value} 帧"));
            AddLog($"检测到多个交换链，只使用最活跃的交换链做实时统计（{detail}）。", LogLevel.Warning);
        }

        if (string.Equals(_primarySwapChain, dominant.Key, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var previous = _primarySwapChain;
        _primarySwapChain = dominant.Key;
        if (previous != null)
        {
            AddLog($"统计用交换链已切换：{previous} → {_primarySwapChain}。", LogLevel.Info);
            ResetLiveFrameStatsLocked();
        }
        else
        {
            AddLog($"统计用交换链：{_primarySwapChain}", LogLevel.Info);
        }
    }

    private void ResetLiveFrameStatsLocked()
    {
        _recent.Clear();
        _validFrames = 0;
        _validSumMs = 0;
        _maxFrameTimeMs = 0;
        _minFrameTimeMs = double.MaxValue;
        _buckets.Clear();
        _currentBucket = null;
        _currentBucketSecond = -1;
    }

    private bool IsUsableInterval(FrameSample sample)
        => sample.FrameTimeMs > 0 &&
           (_options.MaxFrameTimeMs <= 0 || sample.FrameTimeMs <= _options.MaxFrameTimeMs);

    private LiveBucket GetOrCreateBucketLocked(int second)
    {
        if (_currentBucket != null && _currentBucketSecond != second)
        {
            FinalizeBucket(_currentBucket);
            _currentBucket = null;
        }

        if (_buckets.TryGetValue(second, out var existing))
        {
            _currentBucket = existing;
            _currentBucketSecond = second;
            return existing;
        }

        var bucket = new LiveBucket();
        bucket.Point.Second = second;
        bucket.Point.IsWarmup = second * 1000.0 < _options.WarmupSeconds * 1000;
        _buckets[second] = bucket;
        _currentBucket = bucket;
        _currentBucketSecond = second;
        return bucket;
    }

    private void UpdateBucketLocked(FrameSample sample)
    {
        var second = (int)Math.Floor(sample.SessionTimeMs / 1000.0);
        var bucket = GetOrCreateBucketLocked(second);
        bucket.Point.Frames++;

        var frameTime = sample.FrameTimeMs;
        if (frameTime <= 0)
        {
            return;
        }

        bucket.Intervals.Add(frameTime);
        bucket.Sum += frameTime;
        bucket.GpuBusySum += sample.GpuBusyMs ?? 0;

        if (bucket.Intervals.Count > 0)
        {
            var average = bucket.Sum / bucket.Intervals.Count;
            bucket.Point.AvgFrameTimeMs = average;
            bucket.Point.Fps = average > 0 ? 1000.0 / average : 0;
        }

        if (sample.GpuBusyMs.HasValue)
        {
            var elapsedInSecond = Math.Max(1, sample.SessionTimeMs - second * 1000.0);
            bucket.Point.GpuBusyPercent = Math.Clamp(
                bucket.GpuBusySum / Math.Min(1000.0, elapsedInSecond) * 100.0, 0, 100);
        }
    }

    private static void FinalizeBucket(LiveBucket bucket)
    {
        if (bucket.Intervals.Count == 0)
        {
            return;
        }

        bucket.Intervals.Sort();
        var average = bucket.Sum / bucket.Intervals.Count;
        bucket.Point.AvgFrameTimeMs = average;
        bucket.Point.Fps = average > 0 ? 1000.0 / average : 0;
        bucket.Point.P99FrameTimeMs = SessionAnalyzer.P99(bucket.Intervals);
        bucket.Intervals.Clear();
    }

    private void AddResourceLocked(ResourceSample sample)
    {
        _resources.Add(sample);
        _lastWorkingSetMb = sample.WorkingSetMB;
        _lastPrivateMb = sample.PrivateMB;
        _lastCpuPercent = sample.CpuPercent;
        _lastThreads = sample.ThreadCount;
        _lastHandles = sample.HandleCount;
        _lastProcessCount = sample.ProcessCount;
        _lastForeground = sample.Foreground;
        _targetAlive = sample.Alive;
        if (sample.ElapsedMs >= _options.WarmupSeconds * 1000)
        {
            _peakWorkingSetMb = Math.Max(_peakWorkingSetMb, sample.WorkingSetMB);
            _peakPrivateMb = Math.Max(_peakPrivateMb, sample.PrivateMB);
            _peakCpuPercent = Math.Max(_peakCpuPercent, sample.CpuPercent);
        }

        var second = (int)Math.Floor(sample.ElapsedMs / 1000.0);
        var bucket = GetOrCreateBucketLocked(second);
        bucket.Point.WorkingSetMB = sample.WorkingSetMB;
        bucket.Point.PrivateMB = sample.PrivateMB;
        bucket.Point.CpuPercent = sample.CpuPercent;
        bucket.Point.Foreground = sample.Foreground;
    }

    private void Tick(object? state)
    {
        if (_disposed)
        {
            return;
        }

        double elapsed;
        lock (_gate)
        {
            if (_state != RunnerState.Running)
            {
                return;
            }

            elapsed = _clock.Elapsed.TotalSeconds;
        }

        if (_options.DurationSeconds > 0 && elapsed >= _options.DurationSeconds)
        {
            AddLog($"已达到设定时长 {_options.DurationSeconds:0.#} 秒，自动停止。", LogLevel.Info);
            StopInternal("达到设定时长", false);
            return;
        }

        if (!NativeMethods.IsWindow(_window.Handle))
        {
            StopInternal("目标窗口已关闭", true);
            return;
        }

        if (NativeMethods.IsIconic(_window.Handle))
        {
            if (!_minimizeWarning)
            {
                _minimizeWarning = true;
                AddLog("目标窗口已最小化，窗口捕获将无法取帧；采集中请保持窗口可见。", LogLevel.Warning);
            }
        }

        var nowTick = Environment.TickCount64;
        if (nowTick - _lastTitleCheckTick >= 1000)
        {
            _lastTitleCheckTick = nowTick;
            var title = NativeMethods.GetWindowTitle(_window.Handle);
            if (!string.IsNullOrWhiteSpace(title) &&
                !string.Equals(title, _lastKnownTitle, StringComparison.Ordinal))
            {
                _lastKnownTitle = title;
                if (nowTick - _lastTitleLogTick >= 3000)
                {
                    _lastTitleLogTick = nowTick;
                    if (_window.IsBrowser)
                    {
                        AddLog($"窗口标题变化：{WindowEnumerator.CompactTitle(title, 100)}。浏览器可能切换了标签页，帧数据会混合多个标签页。", LogLevel.Warning);
                    }
                    else
                    {
                        AddLog($"窗口标题变化：{WindowEnumerator.CompactTitle(title, 100)}", LogLevel.Info);
                    }
                }

                if (_window.IsBrowser)
                {
                    _titleWarning = true;
                }
            }
        }

        ResourceSample? resource = null;
        double sampleElapsed = 0;
        lock (_gate)
        {
            if (_state != RunnerState.Running)
            {
                return;
            }

            if (_lastResourceSampleAt < 0 || elapsed - _lastResourceSampleAt >= 1.0)
            {
                _lastResourceSampleAt = elapsed;
                sampleElapsed = elapsed;
                resource = _sampler?.TakeSample();
            }
        }

        if (resource != null)
        {
            resource.ElapsedMs = sampleElapsed * 1000;
            if (_sourceKind == FrameSourceKind.WindowCapture)
            {
                // For a window capture, "foreground" should mean this exact window,
                // not merely another window in the same browser process tree.
                resource.Foreground = NativeMethods.IsWindowForeground(_window.Handle);
            }

            lock (_gate)
            {
                if (_state != RunnerState.Running)
                {
                    return;
                }

                AddResourceLocked(resource);
            }

            if (!resource.Alive && !_processAccessWarning)
            {
                _processAccessWarning = true;
                AddLog(
                    "无法读取目标进程的内存/CPU（可能权限不足，或进程受保护）。帧率采集不受影响；如需完整数据，请以管理员身份运行 AdoFrame。",
                    LogLevel.Warning);
            }
        }

        bool shouldFallback;
        lock (_gate)
        {
            shouldFallback = _state == RunnerState.Running &&
                             _options.Mode == CaptureMode.Auto &&
                             _sourceKind == FrameSourceKind.PresentMon &&
                             !_fallbackDone &&
                             !_fallbackStarted &&
                             _totalFrames == 0 &&
                             elapsed >= 6.0;
            if (shouldFallback)
            {
                _fallbackStarted = true;
            }
        }

        if (shouldFallback)
        {
            DoWindowCaptureFallback();
        }
    }

    private double _lastResourceSampleAt = -1;

    private void DoWindowCaptureFallback()
    {
        AddLog("PresentMon 在 6 秒内没有捕获到帧，自动切换为窗口捕获（WGC）。", LogLevel.Warning);
        IFrameSource? oldSource;
        lock (_gate)
        {
            oldSource = _source;
            _source = null;
        }

        try
        {
            oldSource?.Stop();
            oldSource?.Dispose();
        }
        catch
        {
        }

        WindowCaptureFrameSource? newSource = null;
        try
        {
            newSource = new WindowCaptureFrameSource(_window.Handle, _window.Title);
            newSource.Log += OnSourceLog;
            newSource.Faulted += OnSourceFaulted;
            newSource.FrameReceived += OnFrameReceived;

            lock (_gate)
            {
                if (_state != RunnerState.Running)
                {
                    newSource.Dispose();
                    return;
                }

                _clock.Restart();
                _startedAt = DateTime.Now;
                _frames.Clear();
                _resources.Clear();
                _recent.Clear();
                _swapChainCounts.Clear();
                _buckets.Clear();
                _currentBucket = null;
                _currentBucketSecond = -1;
                _primarySwapChain = null;
                _validFrames = 0;
                _validSumMs = 0;
                _maxFrameTimeMs = 0;
                _minFrameTimeMs = double.MaxValue;
                _totalFrames = 0;
                _lastFrameTimeMs = 0;
                _peakWorkingSetMb = 0;
                _peakPrivateMb = 0;
                _peakCpuPercent = 0;
                _lastWorkingSetMb = 0;
                _lastPrivateMb = 0;
                _lastCpuPercent = 0;
                _lastResourceSampleAt = 0;
                _processAccessWarning = false;
                _sampler = new ProcessTreeSampler(_window.ProcessId, _options.AggregateProcessTree);
                var prime = _sampler.Prime();
                prime.ElapsedMs = 0;
                AddResourceLocked(prime);

                _source = newSource;
                _sourceKind = FrameSourceKind.WindowCapture;
                _sourceLabel = newSource.Label;
                _captureModeLabel = "自动 · 窗口捕获（回退）";
                _fallbackDone = true;
                _fallbackWarning = true;
            }

            newSource.Start();
            AddLog("已切换到窗口捕获，重新开始计时。", LogLevel.Info);
        }
        catch (Exception ex)
        {
            try
            {
                newSource?.Dispose();
            }
            catch
            {
            }

            AddLog("自动切换窗口捕获失败：" + ex.Message, LogLevel.Error);
            StopInternal("自动切换窗口捕获失败", true);
        }
    }

    public void Stop() => StopInternal("手动停止", false);

    private void StopInternal(string reason, bool faulted)
    {
        lock (_stopGate)
        {
            if (Interlocked.Exchange(ref _stopRequested, 1) != 0)
            {
                return;
            }
        }

        IFrameSource? source;
        lock (_gate)
        {
            if (_state is RunnerState.Completed or RunnerState.Failed or RunnerState.Idle)
            {
                return;
            }

            _state = RunnerState.Stopping;
            _status = reason;
            _endedAt = DateTime.Now;
            _recordingSeconds = _clock.Elapsed.TotalSeconds;
            _clock.Stop();
            _timer?.Change(Timeout.Infinite, Timeout.Infinite);
            source = _source;
        }

        AddLog($"正在停止采集（{reason}）…", LogLevel.Info);
        try
        {
            source?.Stop();
        }
        catch (Exception ex)
        {
            AddLog("停止帧源时出错：" + ex.Message, LogLevel.Warning);
        }

        SessionResult result;
        lock (_gate)
        {
            if (_currentBucket != null)
            {
                FinalizeBucket(_currentBucket);
                _currentBucket = null;
            }

            var warnings = new List<string>();
            if (faulted)
            {
                warnings.Add(reason);
            }

            if (_frames.Count == 0)
            {
                warnings.Add("整个采集过程中没有收到任何帧。请确认目标窗口正在渲染，或切换采集方式后重试。");
            }
            else if (_validFrames == 0)
            {
                warnings.Add("没有有效的帧间隔数据（可能全部被预热或帧时间上限过滤）。");
            }

            if (_swapChainCounts.Count > 1)
            {
                var detail = string.Join(", ", _swapChainCounts
                    .OrderByDescending(kv => kv.Value)
                    .Select(kv => $"{kv.Key}: {kv.Value} 帧"));
                warnings.Add($"检测到多个交换链：{detail}。统计只使用最活跃的一个。");
            }

            if (_fallbackWarning)
            {
                warnings.Add("PresentMon 未捕获到帧，本次会话已自动回退为窗口捕获（WGC）。");
            }

            if (_titleWarning)
            {
                warnings.Add("采集期间浏览器窗口标题发生变化，可能切换过标签页。");
            }

            if (_options.WarmupSeconds >= _recordingSeconds && _frames.Count > 0)
            {
                warnings.Add("预热时间长于实际采集时长，汇总统计可能没有有效帧。");
            }

            if (_resources.Count == 0 || _resources.All(r => r.ProcessCount == 0))
            {
                warnings.Add("未能读取目标进程的内存/CPU（可能权限不足或进程受保护）。帧率数据仍有效。");
            }

            result = SessionAnalyzer.BuildResult(
                _metadata,
                _options,
                _window,
                _systemInfo,
                _sourceKind,
                _sourceLabel,
                _captureModeLabel,
                _startedAt,
                _endedAt,
                _recordingSeconds,
                _frames,
                _resources,
                reason,
                warnings);

            if (result.Resources.Count > 0 && result.Summary.ForegroundRatio < 0.8 && _frames.Count > 0)
            {
                result.Warnings.Add($"目标进程在前台的采样占比只有 {result.Summary.ForegroundRatio:P0}，后台时系统可能限制渲染，结果仅供参考。");
                result.Summary.Warnings = result.Warnings.ToArray();
            }

            _result = result;
            _state = RunnerState.Completed;
            _status = reason;
            _timer?.Dispose();
            _timer = null;
        }

        AddLog($"采集完成，共 {result.Summary.ValidFrames:N0} 个有效帧。", LogLevel.Info);
    }

    public LiveSnapshot GetSnapshot()
    {
        lock (_gate)
        {
            var nowMs = _state == RunnerState.Completed || _state == RunnerState.Stopping
                ? _recordingSeconds * 1000
                : _clock.Elapsed.TotalMilliseconds;

            if (Environment.TickCount64 - _liveCacheTick >= 350)
            {
                RecomputeLiveCacheLocked(nowMs);
                _liveCacheTick = Environment.TickCount64;
            }

            var elapsed = _state is RunnerState.Completed or RunnerState.Stopping
                ? _recordingSeconds
                : _clock.Elapsed.TotalSeconds;

            return new LiveSnapshot
            {
                State = _state,
                Status = _status,
                SourceLabel = _sourceLabel,
                TargetTitle = _window.Title,
                ElapsedSeconds = elapsed,
                TotalFrames = _totalFrames,
                ValidFrames = _validFrames,
                CurrentFps = _liveCurrentFps,
                AverageFps = _validFrames > 0 ? 1000.0 / (_validSumMs / _validFrames) : 0,
                OnePercentLowFps = _liveLow1Fps,
                PointOnePercentLowFps = _liveLow01Fps,
                LastFrameTimeMs = _lastFrameTimeMs,
                AverageFrameTimeMs = _validFrames > 0 ? _validSumMs / _validFrames : 0,
                P99FrameTimeMs = _liveP99Ms,
                MaxFrameTimeMs = _maxFrameTimeMs,
                WorkingSetMB = _lastWorkingSetMb,
                PrivateMB = _lastPrivateMb,
                PeakWorkingSetMB = _peakWorkingSetMb,
                CpuPercent = _lastCpuPercent,
                PeakCpuPercent = _peakCpuPercent,
                Threads = _lastThreads,
                Handles = _lastHandles,
                ProcessCount = _lastProcessCount,
                Foreground = _lastForeground,
                TargetAlive = _targetAlive && NativeMethods.IsWindow(_window.Handle),
                HasFrames = _totalFrames > 0,
            };
        }
    }

    private void RecomputeLiveCacheLocked(double nowMs)
    {
        var currentIntervals = new List<double>();
        var recentIntervals = new List<double>();
        foreach (var frame in _recent)
        {
            if (!IsUsableInterval(frame))
            {
                continue;
            }

            if (frame.SessionTimeMs >= nowMs - 1000)
            {
                currentIntervals.Add(frame.FrameTimeMs);
            }

            if (frame.SessionTimeMs >= nowMs - 30_000 &&
                frame.SessionTimeMs >= _options.WarmupSeconds * 1000)
            {
                recentIntervals.Add(frame.FrameTimeMs);
            }
        }

        _liveCurrentFps = currentIntervals.Count > 0
            ? 1000.0 / currentIntervals.Average()
            : 0;

        if (recentIntervals.Count == 0)
        {
            _liveLow1Fps = 0;
            _liveLow01Fps = 0;
            _liveP99Ms = 0;
            return;
        }

        recentIntervals.Sort();
        _liveP99Ms = SessionAnalyzer.P99(recentIntervals);
        _liveLow1Fps = WorstLow(recentIntervals, 0.01);
        _liveLow01Fps = WorstLow(recentIntervals, 0.001);
    }

    private static double WorstLow(IReadOnlyList<double> sortedAscending, double fraction)
    {
        if (sortedAscending.Count == 0)
        {
            return 0;
        }

        var count = Math.Max(1, (int)Math.Ceiling(sortedAscending.Count * fraction));
        count = Math.Min(count, sortedAscending.Count);
        double sum = 0;
        for (var i = sortedAscending.Count - count; i < sortedAscending.Count; i++)
        {
            sum += sortedAscending[i];
        }

        var average = sum / count;
        return average > 0 ? 1000.0 / average : 0;
    }

    public List<TimelinePoint> GetLiveTimeline(int maxSeconds = 180)
    {
        lock (_gate)
        {
            if (_buckets.Count == 0)
            {
                return new List<TimelinePoint>();
            }

            var keys = _buckets.Keys.OrderBy(k => k).ToList();
            var start = Math.Max(0, keys.Count - maxSeconds);
            var result = new List<TimelinePoint>(keys.Count - start);
            var lastWorkingSet = keys.Count > 0 ? _buckets[keys[0]].Point.WorkingSetMB : 0;
            var lastPrivate = keys.Count > 0 ? _buckets[keys[0]].Point.PrivateMB : 0;
            var lastCpu = keys.Count > 0 ? _buckets[keys[0]].Point.CpuPercent : 0;
            var lastForeground = keys.Count > 0 && _buckets[keys[0]].Point.Foreground;
            for (var i = start; i < keys.Count; i++)
            {
                var source = _buckets[keys[i]].Point;
                if (source.WorkingSetMB > 0)
                {
                    lastWorkingSet = source.WorkingSetMB;
                    lastPrivate = source.PrivateMB;
                    lastCpu = source.CpuPercent;
                    lastForeground = source.Foreground;
                }

                result.Add(new TimelinePoint
                {
                    Second = source.Second,
                    Frames = source.Frames,
                    Fps = source.Fps,
                    AvgFrameTimeMs = source.AvgFrameTimeMs,
                    P99FrameTimeMs = source.P99FrameTimeMs,
                    GpuBusyPercent = source.GpuBusyPercent,
                    WorkingSetMB = lastWorkingSet,
                    PrivateMB = lastPrivate,
                    CpuPercent = lastCpu,
                    Foreground = lastForeground,
                    IsWarmup = source.IsWarmup,
                });
            }

            return result;
        }
    }

    public List<LogEntry> DrainLogs()
    {
        var result = new List<LogEntry>();
        while (_logs.TryDequeue(out var entry))
        {
            result.Add(entry);
        }

        return result;
    }

    private void AddLog(string message, LogLevel level)
    {
        _logs.Enqueue(new LogEntry(DateTime.Now, message, level));
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        if (State is RunnerState.Running or RunnerState.Starting or RunnerState.Stopping)
        {
            StopInternal("程序关闭", true);
        }

        try
        {
            _timer?.Dispose();
        }
        catch
        {
        }

        try
        {
            _source?.Dispose();
        }
        catch
        {
        }
    }
}
