using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using AdoFrame.Core;
using AdoFrame.Export;

namespace AdoFrame.UI;

public sealed partial class MainForm
{
    private void RefreshWindows(bool initial = false)
    {
        if (_running)
        {
            return;
        }

        var keep = _selectedWindow?.Handle ?? IntPtr.Zero;
        _allWindows = WindowEnumerator.GetWindows();
        ApplyWindowFilter(keep);
        UpdateHeaderInfo();

        if (!initial)
        {
            AppendLog($"窗口列表已刷新，共 {_allWindows.Count} 个可捕获窗口。", LogLevel.Info);
        }
    }

    private void ApplyWindowFilter(IntPtr keepHandle = default)
    {
        var query = _searchBox.Text.Trim();
        var filtered = string.IsNullOrWhiteSpace(query)
            ? _allWindows.ToList()
            : _allWindows.Where(w =>
                    w.Title.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                    w.ProcessName.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                    w.KindLabel.Contains(query, StringComparison.OrdinalIgnoreCase))
                .ToList();

        _suspendSelection = true;
        _windowGrid.DataSource = null;
        _windowGrid.DataSource = new BindingList<WindowInfo>(filtered);
        _windowGrid.ClearSelection();
        _windowGrid.CurrentCell = null;

        if (keepHandle != IntPtr.Zero)
        {
            foreach (DataGridViewRow row in _windowGrid.Rows)
            {
                if (row.DataBoundItem is WindowInfo window && window.Handle == keepHandle)
                {
                    row.Selected = true;
                    _windowGrid.CurrentCell = row.Cells[0];
                    break;
                }
            }
        }

        _suspendSelection = false;

        if (_selectedWindow != null)
        {
            UpdateSelectedWindowLabels(_selectedWindow);
        }
    }

    private void SelectWindow(WindowInfo window)
    {
        if (_running)
        {
            return;
        }

        _selectedWindow = window;
        MaybeSetAutomaticAppName(window);
        UpdateSelectedWindowLabels(window);
        UpdateModeHint();
        AppendLog($"已选择窗口：{WindowEnumerator.CompactTitle(window.Title, 80)}（{window.ProcessName} / PID {window.ProcessId}）", LogLevel.Info);
    }

    private void MaybeSetAutomaticAppName(WindowInfo window)
    {
        if (!_appNameDirty || string.IsNullOrWhiteSpace(_appBox.Text))
        {
            _suppressAppName = true;
            _appBox.Text = window.ProcessName;
            _suppressAppName = false;
        }
    }

    private void UpdateSelectedWindowLabels(WindowInfo window)
    {
        _selectedTitleLabel.Text = WindowEnumerator.CompactTitle(window.Title, 60);
        _selectedMetaLabel.Text = $"{window.ProcessName} · PID {window.ProcessId} · {window.KindLabel}" +
                                  (window.IsMinimized ? " · 已最小化" : "");
        _targetTitleLabel.Text = WindowEnumerator.CompactTitle(window.Title, 120);
        _targetMetaLabel.Text = $"{window.ProcessName} · PID {window.ProcessId} · {window.KindLabel} · {window.ClassName}";
        _targetMetaLabel.ForeColor = Theme.Muted;
    }

    private void UpdateModeHint()
    {
        if (_modeHint == null)
        {
            return;
        }

        switch (_modeCombo.SelectedIndex)
        {
            case 1:
                _modeHint.Text = "任意可见窗口；浏览器只统计当前活动标签页。\n内存在浏览器下为整个进程树（含其它标签页）。";
                break;
            case 2:
                _modeHint.Text = "按进程统计，适合原生游戏 / 无边框全屏。\n浏览器使用此模式可能混入其它标签页。";
                break;
            default:
                _modeHint.Text = _selectedWindow?.IsBrowser == true
                    ? "浏览器/Electron：自动窗口捕获（当前标签页）。\n内存/CPU 为整个浏览器进程树。"
                    : "原生游戏使用 PresentMon；浏览器/Electron\n自动改用窗口捕获（当前标签页）。";
                break;
        }

        if (_selectedWindow != null && _modeCombo.SelectedIndex == 2 && _selectedWindow.IsBrowser)
        {
            _modeHint.ForeColor = Theme.Orange;
        }
        else
        {
            _modeHint.ForeColor = Theme.Faint;
        }
    }

    private void ToggleSession()
    {
        if (_countdown)
        {
            CancelCountdown();
            return;
        }

        if (_runner != null)
        {
            RequestStop();
            return;
        }

        StartSession();
    }

    private void StartSession()
    {
        if (_selectedWindow == null)
        {
            MessageBox.Show(this, "请先选择一个目标窗口。", "AdoFrame", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        if (!NativeMethods.IsWindow(_selectedWindow.Handle) || NativeMethods.IsIconic(_selectedWindow.Handle))
        {
            MessageBox.Show(this, "目标窗口不存在或已最小化。请还原窗口后重试。", "AdoFrame", MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
            RefreshWindows();
            return;
        }

        if (!TryReadOptions(out var options, out var metadata))
        {
            return;
        }

        _presentMonPath = AppPaths.FindPresentMon(_settings.PresentMonPath);
        if (options.Mode == CaptureMode.PresentMon && string.IsNullOrWhiteSpace(_presentMonPath))
        {
            MessageBox.Show(this,
                "找不到 PresentMon.exe。\n\n请确认 third_party\\PresentMon\\PresentMon.exe 与程序一起发布，或改用窗口捕获模式。",
                "PresentMon 不可用", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        SaveSettings();

        _lastResult = null;
        _stopInProgress = false;
        _lastChartTick = 0;
        _chart.Clear();
        _chart.OverlayText = "";
        _chart.OverlaySubtext = "";
        _chart.Mode = ChartMode.FrameTime;
        SetChartMode(ChartMode.FrameTime);
        ResetMetricCards();
        ResetStats();
        _exportCsvButton.Enabled = false;
        _exportHtmlButton.Enabled = false;
        _openFolderButton.Enabled = false;
        _outputPathLabel.Text = "采集中…";

        _logBox.Clear();
        AppendLog($"准备采集：{_selectedWindow.ProcessName} · {WindowEnumerator.CompactTitle(_selectedWindow.Title, 70)}", LogLevel.Info);
        AppendLog($"模式：{GetModeLabel(options.Mode)}；时长：{(options.DurationSeconds > 0 ? options.DurationSeconds.ToString("0.#") + " 秒" : "手动停止")}；预热：{options.WarmupSeconds:0.#} 秒。", LogLevel.Info);

        SetInputsEnabled(false);
        _running = true;

        if (options.StartDelaySeconds > 0)
        {
            _countdownRemaining = options.StartDelaySeconds;
            _countdown = true;
            _statusPill.Text = "倒计时";
            _statusPill.Tone = PillTone.Warning;
            _startButton.Text = "取消等待";
            _startButton.Variant = ButtonVariant.Secondary;
            _startButton.Enabled = true;
            _chart.OverlayText = _countdownRemaining.ToString();
            _chart.OverlaySubtext = "切换到目标窗口，采集即将开始";
            AppendLog($"{_countdownRemaining} 秒后开始采集。请切换到目标窗口。", LogLevel.Info);
            _countdownTimer.Start();
        }
        else
        {
            _ = BeginCaptureAsync(options, metadata);
        }
    }

    private async Task BeginCaptureAsync(SessionOptions options, SessionMetadata metadata)
    {
        _countdown = false;
        _chart.OverlayText = "";
        _chart.OverlaySubtext = "";
        _statusPill.Text = "准备中";
        _statusPill.Tone = PillTone.Running;
        _startButton.Text = "启动中…";
        _startButton.Enabled = false;

        try
        {
            await Task.Yield();
            _systemInfo = SystemInfoProvider.Collect(_selectedWindow!.Handle);
            var runner = new BenchmarkRunner(_selectedWindow, options, metadata, _systemInfo, _presentMonPath);
            _runner = runner;
            runner.Start();

            if (runner.State == RunnerState.Failed)
            {
                HandleFailure(runner);
                return;
            }

            _running = true;
            _startButton.Enabled = true;
            _startButton.Text = "停止采集 (F9)";
            _startButton.Variant = ButtonVariant.Danger;
            _statusPill.Text = options.WarmupSeconds > 0 ? "预热中" : "采集中";
            _statusPill.Tone = PillTone.Running;
            _targetMetaLabel.Text = $"{_selectedWindow.ProcessName} · PID {_selectedWindow.ProcessId} · {runner.SourceLabel}";
            AppendLog($"采集已开始（{runner.SourceLabel}）。", LogLevel.Info);
        }
        catch (Exception ex)
        {
            _running = false;
            _startButton.Enabled = true;
            _startButton.Text = "开始采集 (F9)";
            _startButton.Variant = ButtonVariant.Primary;
            SetInputsEnabled(true);
            _statusPill.Text = "启动失败";
            _statusPill.Tone = PillTone.Error;
            AppendLog("启动采集失败：" + ex.Message, LogLevel.Error);
            MessageBox.Show(this, "启动采集失败：\n\n" + ex.Message, "AdoFrame", MessageBoxButtons.OK, MessageBoxIcon.Error);
            _runner?.Dispose();
            _runner = null;
        }
    }

    private void CountdownTick()
    {
        if (!_countdown)
        {
            _countdownTimer.Stop();
            return;
        }

        _countdownRemaining--;
        if (_countdownRemaining > 0)
        {
            _chart.OverlayText = _countdownRemaining.ToString();
            AppendLog($"倒计时 {_countdownRemaining} 秒…", LogLevel.Info);
            return;
        }

        _countdownTimer.Stop();
        _countdown = false;
        _ = BeginCaptureAsync(CurrentOptions!, CurrentMetadata!);
    }

    private SessionOptions? CurrentOptions { get; set; }
    private SessionMetadata? CurrentMetadata { get; set; }

    private void CancelCountdown()
    {
        _countdown = false;
        _countdownTimer.Stop();
        _chart.OverlayText = "";
        _chart.OverlaySubtext = "";
        _running = false;
        _startButton.Text = "开始采集 (F9)";
        _startButton.Variant = ButtonVariant.Primary;
        _startButton.Enabled = true;
        _statusPill.Text = "待机";
        _statusPill.Tone = PillTone.Idle;
        SetInputsEnabled(true);
        AppendLog("已取消本次采集倒计时。", LogLevel.Info);
    }

    private void RequestStop()
    {
        if (_runner == null || _stopInProgress)
        {
            return;
        }

        _stopInProgress = true;
        _startButton.Enabled = false;
        _startButton.Text = "正在停止…";
        _statusPill.Text = "整理数据";
        _statusPill.Tone = PillTone.Warning;

        var runner = _runner;
        Task.Run(() =>
        {
            try
            {
                runner.Stop();
            }
            catch (Exception ex)
            {
                AddLogThreadSafe("停止采集时出错：" + ex.Message, LogLevel.Error);
            }
        });
    }

    private void UiTick()
    {
        var runner = _runner;
        if (runner != null)
        {
            foreach (var log in runner.DrainLogs())
            {
                AppendLog(log.Message, log.Level, log.Time);
            }

            var state = runner.State;
            if (state == RunnerState.Completed)
            {
                if (_lastResult == null)
                {
                    var result = runner.Result;
                    if (result != null)
                    {
                        HandleCompletion(result);
                    }
                }

                return;
            }

            if (state == RunnerState.Failed)
            {
                HandleFailure(runner);
                return;
            }

            var snapshot = runner.GetSnapshot();
            UpdateLiveUi(snapshot, runner);

            if (Environment.TickCount64 - _lastChartTick >= 500)
            {
                _lastChartTick = Environment.TickCount64;
                _chart.SetData(runner.GetLiveTimeline(180), _systemInfo?.MonitorRefreshHz ?? 0);
            }
        }
    }

    private void UpdateLiveUi(LiveSnapshot snapshot, BenchmarkRunner runner)
    {
        var warmup = CurrentOptions?.WarmupSeconds ?? 0;
        switch (snapshot.State)
        {
            case RunnerState.Starting:
                _statusPill.Text = "准备中";
                _statusPill.Tone = PillTone.Warning;
                break;
            case RunnerState.Stopping:
                _statusPill.Text = "整理数据";
                _statusPill.Tone = PillTone.Warning;
                break;
            default:
                if (snapshot.ElapsedSeconds < warmup)
                {
                    _statusPill.Text = "预热中";
                    _statusPill.Tone = PillTone.Warning;
                }
                else
                {
                    _statusPill.Text = "采集中";
                    _statusPill.Tone = PillTone.Running;
                }

                break;
        }

        _elapsedLabel.Text = FormatElapsed(snapshot.ElapsedSeconds);
        _fpsCard.Value = snapshot.CurrentFps.ToString("0.0");
        _fpsCard.SubText = $"平均 {snapshot.AverageFps:0.0} · 帧时间 {snapshot.LastFrameTimeMs:0.00} ms";
        _lowCard.Value = snapshot.OnePercentLowFps.ToString("0.0");
        _lowCard.SubText = $"最近 30 秒 · 0.1% Low {snapshot.PointOnePercentLowFps:0.0}";
        _memoryCard.Value = snapshot.WorkingSetMB.ToString("0");
        _memoryCard.SubText = $"私有 {snapshot.PrivateMB:0} MB · 峰值 {snapshot.PeakWorkingSetMB:0} MB";
        _cpuCard.Value = snapshot.CpuPercent.ToString("0.0");
        _cpuCard.SubText = $"峰值 {snapshot.PeakCpuPercent:0.0}% · {snapshot.ProcessCount} 进程 / {snapshot.Threads} 线程";

        var source = string.IsNullOrWhiteSpace(snapshot.SourceLabel) ? runner.SourceLabel : snapshot.SourceLabel;
        var focus = snapshot.Foreground ? "前台" : "后台";
        var browserNote = _selectedWindow?.IsBrowser == true ? " · 当前标签页" : "";
        _targetMetaLabel.Text = $"{_selectedWindow?.ProcessName} · PID {_selectedWindow?.ProcessId} · {source}{browserNote} · {focus}";
        _targetMetaLabel.ForeColor = snapshot.Foreground ? Theme.Muted : Theme.Orange;

        SetStat("avgFrame", snapshot.AverageFrameTimeMs > 0 ? $"{snapshot.AverageFrameTimeMs:0.000} ms" : "--");
        SetStat("validFrames", snapshot.ValidFrames.ToString("N0"));
        SetStat("p99", snapshot.P99FrameTimeMs > 0 ? $"{snapshot.P99FrameTimeMs:0.000} ms" : "--");
        SetStat("maxFrame", snapshot.MaxFrameTimeMs > 0 ? $"{snapshot.MaxFrameTimeMs:0.000} ms" : "--");
        SetStat("low1", snapshot.OnePercentLowFps > 0 ? $"{snapshot.OnePercentLowFps:0.0}" : "--");
        SetStat("low01", snapshot.PointOnePercentLowFps > 0 ? $"{snapshot.PointOnePercentLowFps:0.0}" : "--");
        SetStat("memPeak", snapshot.PeakWorkingSetMB > 0 ? $"{snapshot.PeakWorkingSetMB:0} MB" : "--");
        SetStat("memGrowth", "--");
        SetStat("cpu", $"{snapshot.CpuPercent:0.0}% / {snapshot.PeakCpuPercent:0.0}%");
        SetStat("threads", $"{snapshot.Threads} / {snapshot.Handles}");
        SetStat("foreground", snapshot.Foreground ? "前台" : "后台");
        SetStat("latency", "--");
        SetStat("source", source);
        SetStat("swapchain", _selectedWindow?.IsBrowser == true ? "活动标签页" : "--");
        _statsNote.Text = "实时 · 1% Low 取最近 30s";
    }

    private void HandleCompletion(SessionResult result)
    {
        _running = false;
        _stopInProgress = false;
        _countdown = false;
        _lastResult = result;
        _countdownTimer.Stop();

        foreach (var log in _runner?.DrainLogs() ?? new List<LogEntry>())
        {
            AppendLog(log.Message, log.Level, log.Time);
        }

        _runner?.Dispose();
        _runner = null;

        _startButton.Enabled = true;
        _startButton.Text = "开始采集 (F9)";
        _startButton.Variant = ButtonVariant.Primary;
        SetInputsEnabled(true);

        _statusPill.Text = result.HasFrames ? "已完成" : "无帧数据";
        _statusPill.Tone = result.HasFrames ? PillTone.Success : PillTone.Warning;
        _elapsedLabel.Text = FormatElapsed(result.Summary.RecordingSeconds);
        _targetTitleLabel.Text = WindowEnumerator.CompactTitle(result.Summary.WindowTitle, 120);
        _targetMetaLabel.Text = $"{result.Summary.ProcessName} · PID {result.Summary.ProcessId} · {result.SourceLabel}";
        _targetMetaLabel.ForeColor = Theme.Muted;

        UpdateFinalUi(result);

        _exportCsvButton.Enabled = true;
        _exportHtmlButton.Enabled = true;
        _openFolderButton.Enabled = true;

        if (result.Options.AutoExport)
        {
            try
            {
                var dir = SessionExporter.ExportAll(result);
                _outputPathLabel.Text = dir;
                AppendLog($"已自动导出 CSV / HTML：{dir}", LogLevel.Info);
            }
            catch (Exception ex)
            {
                _outputPathLabel.Text = "自动导出失败，请手动重试";
                AppendLog("自动导出失败：" + ex.Message, LogLevel.Error);
            }
        }
        else
        {
            _outputPathLabel.Text = "已完成。点击左侧按钮导出数据。";
        }

        AppendLog(
            $"采集完成：平均 {result.Summary.AvgFps:0.0} FPS · 1% Low {result.Summary.OnePercentLowFps:0.0} · 0.1% Low {result.Summary.PointOnePercentLowFps:0.0} · 有效帧 {result.Summary.ValidFrames:N0}",
            LogLevel.Info);

        foreach (var warning in result.Warnings)
        {
            AppendLog("提示：" + warning, LogLevel.Warning);
        }

        if (!result.HasFrames)
        {
            MessageBox.Show(this,
                "本次采集没有收到任何帧。\n\n建议：\n" +
                "• 浏览器 / Electron 使用“窗口捕获”并保持标签页活动；\n" +
                "• 原生游戏使用 PresentMon；\n" +
                "• 不要把窗口最小化；\n" +
                "• 确认目标窗口正在渲染画面。",
                "没有帧数据", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }

        SaveSettings();
    }

    private void UpdateFinalUi(SessionResult result)
    {
        var s = result.Summary;
        _fpsCard.Value = s.AvgFps.ToString("0.0");
        _fpsCard.SubText = $"平均帧时间 {s.AvgFrameTimeMs:0.00} ms · P99 {s.P99FrameTimeMs:0.00} ms";
        _lowCard.Value = s.OnePercentLowFps.ToString("0.0");
        _lowCard.SubText = $"0.1% Low {s.PointOnePercentLowFps:0.0} · 全程";
        _memoryCard.Value = s.WorkingSetPeakMB.ToString("0");
        _memoryCard.SubText = $"峰值 · 结束 {s.WorkingSetEndMB:0} MB · 私有峰值 {s.PrivatePeakMB:0} MB";
        _cpuCard.Value = s.CpuAvgPercent.ToString("0.0");
        _cpuCard.SubText = $"平均 · 峰值 {s.CpuPeakPercent:0.0}% · {s.PeakProcessCount} 进程 / {s.PeakThreads} 线程";

        SetStat("avgFrame", $"{s.AvgFrameTimeMs:0.000} ms");
        SetStat("validFrames", s.ValidFrames.ToString("N0"));
        SetStat("p99", $"{s.P99FrameTimeMs:0.000} ms");
        SetStat("maxFrame", $"{s.MaxFrameTimeMs:0.000} ms");
        SetStat("low1", $"{s.OnePercentLowFps:0.0}");
        SetStat("low01", $"{s.PointOnePercentLowFps:0.0}");
        SetStat("memPeak", $"{s.WorkingSetPeakMB:0} MB");
        SetStat("memGrowth", $"{s.WorkingSetEndMB - s.WorkingSetStartMB:+0;-0;0} MB");
        SetStat("cpu", $"{s.CpuAvgPercent:0.0}% / {s.CpuPeakPercent:0.0}%");
        SetStat("threads", $"{s.PeakThreads} / {s.PeakHandles}");
        SetStat("foreground", $"{s.ForegroundRatio:P0}");
        SetStat("latency", s.DisplayLatencyAvgMs.HasValue ? $"{s.DisplayLatencyAvgMs:0.00} ms" : "N/A");
        SetStat("source", s.SourceLabel);
        SetStat("swapchain", !string.IsNullOrWhiteSpace(s.DominantPresentMode)
            ? s.DominantPresentMode
            : (!string.IsNullOrWhiteSpace(s.PrimarySwapChain) ? s.PrimarySwapChain : "活动标签页"));
        _statsNote.Text = "全程 · 已排除预热/超限帧";

        _chart.Mode = ChartMode.FrameTime;
        SetChartMode(ChartMode.FrameTime);
        _chart.SetData(result.Timeline.TakeLast(180).ToList(), _systemInfo?.MonitorRefreshHz ?? 0);
    }

    private void HandleFailure(BenchmarkRunner runner)
    {
        var message = runner.Status;
        foreach (var log in runner.DrainLogs())
        {
            AppendLog(log.Message, log.Level, log.Time);
        }

        _runner?.Dispose();
        _runner = null;
        _running = false;
        _stopInProgress = false;
        _countdown = false;
        _startButton.Enabled = true;
        _startButton.Text = "开始采集 (F9)";
        _startButton.Variant = ButtonVariant.Primary;
        SetInputsEnabled(true);
        _statusPill.Text = "启动失败";
        _statusPill.Tone = PillTone.Error;
        _chart.OverlayText = "";
        AppendLog("采集失败：" + message, LogLevel.Error);
        MessageBox.Show(this, "采集失败：\n\n" + message, "AdoFrame", MessageBoxButtons.OK, MessageBoxIcon.Error);
    }

    private void ResetMetricCards()
    {
        _fpsCard.Value = "--";
        _fpsCard.SubText = "等待采集";
        _lowCard.Value = "--";
        _lowCard.SubText = "最近 30 秒";
        _memoryCard.Value = "--";
        _memoryCard.SubText = "工作集 / 私有内存";
        _cpuCard.Value = "--";
        _cpuCard.SubText = "整机占用";
    }

    private void ResetStats()
    {
        foreach (var label in _statValues.Values)
        {
            label.Text = "--";
        }

        _statsNote.Text = "1% Low 完成后按全程计算";
        _elapsedLabel.Text = "00:00.0";
    }

    private void SetStat(string key, string value)
    {
        if (_statValues.TryGetValue(key, out var label))
        {
            label.Text = value;
        }
    }

    private void SetChartMode(ChartMode mode)
    {
        _chart.Mode = mode;
        _chart.Invalidate();
        var modes = new[] { ChartMode.Fps, ChartMode.FrameTime, ChartMode.Memory, ChartMode.Cpu };
        for (var i = 0; i < _chips.Length; i++)
        {
            _chips[i].Active = modes[i] == mode;
            _chips[i].Invalidate();
        }

        _legendLabel.Text = mode switch
        {
            ChartMode.Fps => "每秒 FPS",
            ChartMode.FrameTime => "平均帧时间 / P99",
            ChartMode.Memory => "工作集 / 私有内存",
            _ => "CPU 整机占用",
        };
    }

    private void ExportCurrent(bool csv)
    {
        if (_lastResult == null)
        {
            return;
        }

        try
        {
            if (csv)
            {
                var dir = SessionExporter.ExportCsv(_lastResult);
                _outputPathLabel.Text = dir;
                _openFolderButton.Enabled = true;
                AppendLog($"CSV 已导出：{dir}", LogLevel.Info);
            }
            else
            {
                var path = SessionExporter.ExportHtml(_lastResult);
                _outputPathLabel.Text = Path.GetDirectoryName(path) ?? path;
                _openFolderButton.Enabled = true;
                AppendLog($"HTML 报告已导出：{path}", LogLevel.Info);
            }
        }
        catch (Exception ex)
        {
            AppendLog("导出失败：" + ex.Message, LogLevel.Error);
            MessageBox.Show(this, "导出失败：\n\n" + ex.Message, "AdoFrame", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void OpenOutputFolder()
    {
        var dir = _lastResult?.OutputDirectory;
        if (string.IsNullOrWhiteSpace(dir) || !Directory.Exists(dir))
        {
            return;
        }

        try
        {
            Process.Start(new ProcessStartInfo("explorer.exe", $"\"{dir}\"") { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            AppendLog("无法打开输出目录：" + ex.Message, LogLevel.Warning);
        }
    }

    private void BrowseOutputDirectory()
    {
        using var dialog = new FolderBrowserDialog
        {
            Description = "选择 AdoFrame 输出目录",
            UseDescriptionForTitle = true,
            ShowNewFolderButton = true,
            SelectedPath = Directory.Exists(_outputBox.Text) ? _outputBox.Text : AppPaths.DefaultOutputDirectory,
        };
        if (dialog.ShowDialog(this) == DialogResult.OK)
        {
            _outputBox.Text = dialog.SelectedPath;
        }
    }

    private bool TryReadOptions(out SessionOptions options, out SessionMetadata metadata)
    {
        options = new SessionOptions();
        metadata = new SessionMetadata();

        if (!TryParseNumber(_durationBox.Text, out var duration) || duration < 0 ||
            !TryParseNumber(_warmupBox.Text, out var warmup) || warmup < 0 ||
            !TryParseNumber(_maxFrameBox.Text, out var maxFrame) || maxFrame < 0 ||
            !int.TryParse(_delayBox.Text.Trim(), out var delay) || delay < 0 || delay > 60)
        {
            MessageBox.Show(this,
                "采集参数不合法。\n\n时长、预热、帧时间上限必须是大于等于 0 的数字；倒计时为 0–60 秒。",
                "参数错误", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return false;
        }

        var output = _outputBox.Text.Trim();
        if (string.IsNullOrWhiteSpace(output))
        {
            output = AppPaths.DefaultOutputDirectory;
        }

        try
        {
            output = Path.GetFullPath(output);
            Directory.CreateDirectory(output);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "输出目录不可用：\n\n" + ex.Message, "参数错误", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return false;
        }

        options = new SessionOptions
        {
            Mode = _modeCombo.SelectedIndex switch
            {
                1 => CaptureMode.WindowCapture,
                2 => CaptureMode.PresentMon,
                _ => CaptureMode.Auto,
            },
            DurationSeconds = duration,
            WarmupSeconds = warmup,
            MaxFrameTimeMs = maxFrame,
            StartDelaySeconds = delay,
            AutoExport = _autoExportCheck.Checked,
            OutputDirectory = output,
            PresentMonPath = _presentMonPath ?? "",
            AggregateProcessTree = _aggregateCheck.Checked,
        };

        metadata = new SessionMetadata
        {
            AppName = string.IsNullOrWhiteSpace(_appBox.Text) ? _selectedWindow?.ProcessName ?? "" : _appBox.Text.Trim(),
            Tester = _testerBox.Text.Trim(),
            Scene = _sceneBox.Text.Trim(),
            Notes = _notesBox.Text.Trim(),
        };

        CurrentOptions = options;
        CurrentMetadata = metadata;
        return true;
    }

    private static bool TryParseNumber(string text, out double value)
    {
        text = text.Trim();
        return double.TryParse(text, NumberStyles.Float, CultureInfo.CurrentCulture, out value) ||
               double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out value);
    }

    private void SaveSettings()
    {
        _settings.OutputDirectory = _outputBox.Text.Trim();
        _settings.LastTester = _testerBox.Text.Trim();
        _settings.LastCaptureMode = _modeCombo.SelectedIndex switch
        {
            1 => CaptureMode.WindowCapture,
            2 => CaptureMode.PresentMon,
            _ => CaptureMode.Auto,
        };
        if (TryParseNumber(_durationBox.Text, out var duration))
        {
            _settings.LastDurationSeconds = duration;
        }

        if (TryParseNumber(_warmupBox.Text, out var warmup))
        {
            _settings.LastWarmupSeconds = warmup;
        }

        if (TryParseNumber(_maxFrameBox.Text, out var maxFrame))
        {
            _settings.LastMaxFrameTimeMs = maxFrame;
        }

        if (int.TryParse(_delayBox.Text.Trim(), out var delay))
        {
            _settings.LastStartDelaySeconds = delay;
        }

        _settings.AutoExport = _autoExportCheck.Checked;
        _settings.AggregateProcessTree = _aggregateCheck.Checked;
        _settings.GlobalStopHotkey = _globalHotkeyCombo.SelectedItem?.ToString() ?? "关闭（仅窗口内 F9）";
        _settings.Save();
    }

    private void SetInputsEnabled(bool enabled)
    {
        _searchBox.Enabled = enabled;
        _windowGrid.Enabled = enabled;
        _refreshButton.Enabled = enabled;
        _pickButton.Enabled = enabled;
        _modeCombo.Enabled = enabled;
        _durationBox.Enabled = enabled;
        _warmupBox.Enabled = enabled;
        _maxFrameBox.Enabled = enabled;
        _delayBox.Enabled = enabled;
        _outputBox.Enabled = enabled;
        _browseButton.Enabled = enabled;
        _appBox.Enabled = enabled;
        _testerBox.Enabled = enabled;
        _sceneBox.Enabled = enabled;
        _notesBox.Enabled = enabled;
        _autoExportCheck.Enabled = enabled;
        _aggregateCheck.Enabled = enabled;
        _globalHotkeyCombo.Enabled = enabled;
    }

    private void StartWindowPick()
    {
        if (_running || _picking)
        {
            return;
        }

        _picking = true;
        _pendingPickHandle = IntPtr.Zero;
        _pickMouseWasDown = (NativeMethods.GetAsyncKeyState(NativeMethods.VkLButton) & 0x8000) != 0;
        _pickDeadline = DateTime.UtcNow.AddSeconds(12);
        _statusPill.Text = "拾取窗口";
        _statusPill.Tone = PillTone.Warning;
        AppendLog("请点击目标窗口（12 秒内）。点击鼠标左键完成选择。", LogLevel.Info);
        WindowState = FormWindowState.Minimized;
        _pickTimer.Start();
    }

    private void PickTick()
    {
        if (!_picking)
        {
            _pickTimer.Stop();
            return;
        }

        if (DateTime.UtcNow > _pickDeadline ||
            (NativeMethods.GetAsyncKeyState(0x1B) & 0x8000) != 0)
        {
            EndWindowPick(false);
            return;
        }

        var isDown = (NativeMethods.GetAsyncKeyState(NativeMethods.VkLButton) & 0x8000) != 0;
        if (isDown && !_pickMouseWasDown)
        {
            var hwnd = NativeMethods.GetWindowUnderCursor();
            var window = WindowEnumerator.DescribeWindow(hwnd);
            if (window != null)
            {
                // Wait for the mouse-up before restoring AdoFrame, so the release
                // cannot accidentally click a control in our own window.
                _pendingPickHandle = window.Handle;
            }
        }

        if (!isDown && _pendingPickHandle != IntPtr.Zero)
        {
            var handle = _pendingPickHandle;
            _pendingPickHandle = IntPtr.Zero;
            EndWindowPick(true);
            RefreshWindows();
            SelectWindowByHandle(handle);
            return;
        }

        _pickMouseWasDown = isDown;
    }

    private void SelectWindowByHandle(IntPtr handle)
    {
        var window = _allWindows.FirstOrDefault(w => w.Handle == handle) ??
                     WindowEnumerator.DescribeWindow(handle);
        if (window == null)
        {
            return;
        }

        _selectedWindow = window;
        MaybeSetAutomaticAppName(window);
        UpdateSelectedWindowLabels(window);
        UpdateModeHint();

        foreach (DataGridViewRow row in _windowGrid.Rows)
        {
            if (row.DataBoundItem is WindowInfo w && w.Handle == handle)
            {
                _suspendSelection = true;
                row.Selected = true;
                _windowGrid.CurrentCell = row.Cells[0];
                _suspendSelection = false;
                break;
            }
        }

        AppendLog($"已拾取窗口：{WindowEnumerator.CompactTitle(window.Title, 80)}（{window.ProcessName} / PID {window.ProcessId}）", LogLevel.Info);
    }

    private void EndWindowPick(bool selected)
    {
        _pickTimer.Stop();
        _picking = false;
        _pendingPickHandle = IntPtr.Zero;
        WindowState = FormWindowState.Normal;
        Activate();
        if (!selected)
        {
            _statusPill.Text = "待机";
            _statusPill.Tone = PillTone.Idle;
            AppendLog("已取消窗口拾取。", LogLevel.Info);
        }
        else
        {
            _statusPill.Text = "待机";
            _statusPill.Tone = PillTone.Idle;
        }
    }

    private void AppendLog(string message, LogLevel level, DateTime? time = null)
    {
        if (_logBox == null || _logBox.IsDisposed)
        {
            return;
        }

        var color = level switch
        {
            LogLevel.Warning => Theme.Orange,
            LogLevel.Error => Theme.Red,
            _ => Theme.Muted,
        };

        if (_logBox.TextLength > 120_000)
        {
            _logBox.Clear();
            _logBox.SelectionColor = Theme.Faint;
            _logBox.AppendText("[日志过长，已清理旧内容]\n");
        }

        _logBox.SelectionStart = _logBox.TextLength;
        _logBox.SelectionLength = 0;
        _logBox.SelectionColor = color;
        _logBox.AppendText($"[{(time ?? DateTime.Now):HH:mm:ss}] {message}\n");
        _logBox.SelectionColor = Theme.Muted;
        _logBox.SelectionStart = _logBox.TextLength;
        _logBox.ScrollToCaret();
    }

    private void AddLogThreadSafe(string message, LogLevel level)
    {
        if (IsDisposed || !IsHandleCreated)
        {
            return;
        }

        try
        {
            BeginInvoke(new Action(() => AppendLog(message, level)));
        }
        catch
        {
        }
    }

    private static string FormatElapsed(double seconds)
    {
        if (seconds < 0)
        {
            seconds = 0;
        }

        var ts = TimeSpan.FromSeconds(seconds);
        return ts.TotalHours >= 1
            ? $"{(int)ts.TotalHours:00}:{ts.Minutes:00}:{ts.Seconds:00}.{ts.Milliseconds / 100}"
            : $"{ts.Minutes:00}:{ts.Seconds:00}.{ts.Milliseconds / 100}";
    }

    private static string GetModeLabel(CaptureMode mode) => mode switch
    {
        CaptureMode.WindowCapture => "窗口捕获（WGC）",
        CaptureMode.PresentMon => "PresentMon",
        _ => "自动",
    };

    private void OnFormKeyDown(object? sender, KeyEventArgs e)
    {
        if (e.KeyCode == Keys.F5 && !_running)
        {
            RefreshWindows();
            e.Handled = true;
        }
        else if (e.KeyCode == Keys.F9)
        {
            ToggleSession();
            e.Handled = true;
        }
        else if (e.KeyCode == Keys.Escape)
        {
            if (_picking)
            {
                EndWindowPick(false);
            }
            else if (_countdown)
            {
                CancelCountdown();
            }
        }
    }

    private void OnFormClosing(object? sender, FormClosingEventArgs e)
    {
        if (_picking)
        {
            EndWindowPick(false);
        }

        if (_countdown)
        {
            CancelCountdown();
        }

        if (_runner != null)
        {
            var result = MessageBox.Show(this,
                "正在采集，是否停止并退出？\n\n数据会在停止后按设置自动导出。",
                "AdoFrame", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
            if (result != DialogResult.Yes)
            {
                e.Cancel = true;
                return;
            }

            try
            {
                _runner.Stop();
                var session = _runner.Result;
                if (session != null && session.Options.AutoExport)
                {
                    try
                    {
                        SessionExporter.ExportAll(session);
                    }
                    catch
                    {
                    }
                }
            }
            catch
            {
            }

            _runner.Dispose();
            _runner = null;
        }

        UnregisterGlobalHotkey();
        SaveSettings();
        _countdownTimer.Stop();
        _pickTimer.Stop();
        _uiTimer.Stop();
    }
}
