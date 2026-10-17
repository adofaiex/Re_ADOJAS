using System.Net;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using AdoFrame.Core;

namespace AdoFrame.Export;

public static class SessionExporter
{
    private static readonly UTF8Encoding Utf8Bom = new(true);
    private static readonly UTF8Encoding Utf8NoBom = new(false);

    public static string EnsureSessionDirectory(SessionResult result)
    {
        if (!string.IsNullOrWhiteSpace(result.OutputDirectory))
        {
            Directory.CreateDirectory(result.OutputDirectory);
            return result.OutputDirectory;
        }

        var root = string.IsNullOrWhiteSpace(result.Options.OutputDirectory)
            ? AppPaths.DefaultOutputDirectory
            : result.Options.OutputDirectory;
        Directory.CreateDirectory(root);

        var app = SanitizeFileName(result.AppLabel, 48);
        var source = result.SourceKind == FrameSourceKind.WindowCapture ? "WGC" : "PM";
        var baseName = $"{result.StartedAt:yyyyMMdd_HHmmss}_{app}_{source}";
        var candidate = Path.Combine(root, baseName);
        var suffix = 2;
        while (Directory.Exists(candidate))
        {
            candidate = Path.Combine(root, $"{baseName}_{suffix++}");
        }

        Directory.CreateDirectory(candidate);
        result.OutputDirectory = candidate;
        return candidate;
    }

    public static string ExportCsv(SessionResult result)
    {
        var dir = EnsureSessionDirectory(result);
        WriteSummaryCsv(Path.Combine(dir, "summary.csv"), result);
        WriteTimelineCsv(Path.Combine(dir, "timeline.csv"), result);
        WriteFramesCsv(Path.Combine(dir, "frames.csv"), result);
        WriteSessionJson(Path.Combine(dir, "session.json"), result);
        AppendComparisonRow(result, dir);
        return dir;
    }

    public static string ExportHtml(SessionResult result)
    {
        var dir = EnsureSessionDirectory(result);
        var path = Path.Combine(dir, "report.html");
        File.WriteAllText(path, BuildHtml(result), Utf8NoBom);
        return path;
    }

    public static string ExportAll(SessionResult result)
    {
        var dir = ExportCsv(result);
        ExportHtml(result);
        return dir;
    }

    private static void WriteSummaryCsv(string path, SessionResult result)
    {
        var s = result.Summary;
        using var writer = new StreamWriter(path, false, Utf8Bom);
        writer.WriteLine("字段,值");
        WritePair(writer, "报告版本", "AdoFrame 1.0");
        WritePair(writer, "采集开始", result.StartedAt.ToString("yyyy-MM-dd HH:mm:ss"));
        WritePair(writer, "采集结束", result.EndedAt.ToString("yyyy-MM-dd HH:mm:ss"));
        WritePair(writer, "作品名称", result.Metadata.AppName);
        WritePair(writer, "测试人", result.Metadata.Tester);
        WritePair(writer, "场景/谱面", result.Metadata.Scene);
        WritePair(writer, "备注", result.Metadata.Notes);
        WritePair(writer, "采集方式", s.SourceLabel);
        WritePair(writer, "模式", s.CaptureModeLabel);
        WritePair(writer, "目标窗口", s.WindowTitle);
        WritePair(writer, "窗口类名", s.WindowClass);
        WritePair(writer, "进程", s.ProcessName);
        WritePair(writer, "进程 PID", s.ProcessId.ToString());
        WritePair(writer, "进程路径", s.ProcessPath);
        WritePair(writer, "操作系统的版本", $"{result.SystemInfo.OsName} {result.SystemInfo.OsVersion} (build {result.SystemInfo.OsBuild})");
        WritePair(writer, "CPU", result.SystemInfo.CpuSummary);
        WritePair(writer, "GPU", result.SystemInfo.GpuName);
        WritePair(writer, "内存", result.SystemInfo.MemorySummary);
        WritePair(writer, "显示器", result.SystemInfo.MonitorSummary);
        WritePair(writer, "显示器名称", result.SystemInfo.MonitorName);
        WritePair(writer, "窗口尺寸", $"{result.SystemInfo.WindowWidth}×{result.SystemInfo.WindowHeight} @ {result.SystemInfo.Dpi} DPI");
        WritePair(writer, "采集时长(秒)", CsvUtil.Number(s.RecordingSeconds, "0.###"));
        WritePair(writer, "分析时长(秒)", CsvUtil.Number(s.AnalysisSeconds, "0.###"));
        WritePair(writer, "预热(秒)", CsvUtil.Number(s.WarmupSeconds, "0.###"));
        WritePair(writer, "帧时间上限(ms)", CsvUtil.Number(s.MaxFrameTimeFilterMs, "0.###"));
        WritePair(writer, "原始帧数", s.TotalFrames.ToString());
        WritePair(writer, "有效帧数", s.ValidFrames.ToString());
        WritePair(writer, "交换链数量", s.SwapChainCount.ToString());
        WritePair(writer, "主交换链", s.PrimarySwapChain);
        WritePair(writer, "平均 FPS", CsvUtil.Number(s.AvgFps, "0.00"));
        WritePair(writer, "1% Low FPS", CsvUtil.Number(s.OnePercentLowFps, "0.00"));
        WritePair(writer, "0.1% Low FPS", CsvUtil.Number(s.PointOnePercentLowFps, "0.00"));
        WritePair(writer, "最低 FPS", CsvUtil.Number(s.MinFps, "0.00"));
        WritePair(writer, "最高 FPS", CsvUtil.Number(s.MaxFps, "0.00"));
        WritePair(writer, "平均帧时间(ms)", CsvUtil.Number(s.AvgFrameTimeMs, "0.000"));
        WritePair(writer, "中位帧时间(ms)", CsvUtil.Number(s.MedianFrameTimeMs, "0.000"));
        WritePair(writer, "P95 帧时间(ms)", CsvUtil.Number(s.P95FrameTimeMs, "0.000"));
        WritePair(writer, "P99 帧时间(ms)", CsvUtil.Number(s.P99FrameTimeMs, "0.000"));
        WritePair(writer, "最小帧时间(ms)", CsvUtil.Number(s.MinFrameTimeMs, "0.000"));
        WritePair(writer, "最大帧时间(ms)", CsvUtil.Number(s.MaxFrameTimeMs, "0.000"));
        WritePair(writer, "CPU 平均占用(%)", CsvUtil.Number(s.CpuAvgPercent, "0.00"));
        WritePair(writer, "CPU 峰值占用(%)", CsvUtil.Number(s.CpuPeakPercent, "0.00"));
        WritePair(writer, "工作集开始(MB)", CsvUtil.Number(s.WorkingSetStartMB, "0.00"));
        WritePair(writer, "工作集结束(MB)", CsvUtil.Number(s.WorkingSetEndMB, "0.00"));
        WritePair(writer, "工作集平均(MB)", CsvUtil.Number(s.WorkingSetAvgMB, "0.00"));
        WritePair(writer, "工作集峰值(MB)", CsvUtil.Number(s.WorkingSetPeakMB, "0.00"));
        WritePair(writer, "私有内存开始(MB)", CsvUtil.Number(s.PrivateStartMB, "0.00"));
        WritePair(writer, "私有内存结束(MB)", CsvUtil.Number(s.PrivateEndMB, "0.00"));
        WritePair(writer, "私有内存峰值(MB)", CsvUtil.Number(s.PrivatePeakMB, "0.00"));
        WritePair(writer, "峰值线程数", s.PeakThreads.ToString());
        WritePair(writer, "峰值句柄数", s.PeakHandles.ToString());
        WritePair(writer, "峰值进程数", s.PeakProcessCount.ToString());
        WritePair(writer, "前台采样占比", CsvUtil.Number(s.ForegroundRatio * 100, "0.00"));
        WritePair(writer, "GPU 忙碌平均(%)", CsvUtil.NullableNumber(s.GpuBusyAvgPercent, "0.00"));
        WritePair(writer, "显示延迟平均(ms)", CsvUtil.NullableNumber(s.DisplayLatencyAvgMs, "0.000"));
        WritePair(writer, "显示延迟 P95(ms)", CsvUtil.NullableNumber(s.DisplayLatencyP95Ms, "0.000"));
        WritePair(writer, "主要呈现模式", s.DominantPresentMode);
        WritePair(writer, "停止原因", s.StopReason);
        WritePair(writer, "警告", string.Join(" | ", s.Warnings));
        WritePair(writer, "统计口径", "汇总指标只统计预热结束后的数据；原始帧和时间线保留预热用于追溯");
        WritePair(writer, "1% Low 算法", "最慢 1% 帧的帧时间平均值，再换算为 FPS");
        WritePair(writer, "0.1% Low 算法", "最慢 0.1% 帧的帧时间平均值，再换算为 FPS");
    }

    private static void WritePair(StreamWriter writer, string key, string? value)
        => writer.WriteLine($"{CsvUtil.Escape(key)},{CsvUtil.Escape(value)}");

    private static void WriteTimelineCsv(string path, SessionResult result)
    {
        using var writer = new StreamWriter(path, false, Utf8Bom);
        writer.WriteLine("second,elapsed_s,fps,avg_frame_time_ms,p99_frame_time_ms,gpu_busy_percent,working_set_mb,private_mb,cpu_percent,foreground,frames,warmup");
        foreach (var p in result.Timeline)
        {
            writer.WriteLine(string.Join(',',
                p.Second.ToString(),
                CsvUtil.Number(p.Second, "0"),
                CsvUtil.Number(p.Fps, "0.000"),
                CsvUtil.Number(p.AvgFrameTimeMs, "0.000"),
                CsvUtil.Number(p.P99FrameTimeMs, "0.000"),
                CsvUtil.NullableNumber(p.GpuBusyPercent, "0.000"),
                CsvUtil.Number(p.WorkingSetMB, "0.000"),
                CsvUtil.Number(p.PrivateMB, "0.000"),
                CsvUtil.Number(p.CpuPercent, "0.000"),
                p.Foreground ? "1" : "0",
                p.Frames.ToString(),
                p.IsWarmup ? "1" : "0"));
        }
    }

    private static void WriteFramesCsv(string path, SessionResult result)
    {
        using var writer = new StreamWriter(path, false, Utf8Bom);
        writer.WriteLine("index,session_time_s,frame_time_ms,instant_fps,cpu_busy_ms,gpu_busy_ms,display_latency_ms,displayed_time_ms,present_mode,swapchain,displayed,source");
        for (var i = 0; i < result.Frames.Count; i++)
        {
            var f = result.Frames[i];
            writer.WriteLine(string.Join(',',
                i.ToString(),
                CsvUtil.Number(f.SessionTimeMs / 1000.0, "0.000000"),
                CsvUtil.Number(f.FrameTimeMs, "0.000000"),
                CsvUtil.Number(f.FrameTimeMs > 0 ? 1000.0 / f.FrameTimeMs : 0, "0.000"),
                CsvUtil.NullableNumber(f.CpuBusyMs, "0.000000"),
                CsvUtil.NullableNumber(f.GpuBusyMs, "0.000000"),
                CsvUtil.NullableNumber(f.DisplayLatencyMs, "0.000000"),
                CsvUtil.NullableNumber(f.DisplayedTimeMs, "0.000000"),
                CsvUtil.Escape(f.PresentMode),
                CsvUtil.Escape(f.SwapChain),
                f.Displayed.HasValue ? (f.Displayed.Value ? "1" : "0") : "",
                CsvUtil.Escape(result.SourceLabel)));
        }
    }

    private static void WriteSessionJson(string path, SessionResult result)
    {
        var dto = new
        {
            createdAt = result.StartedAt,
            endedAt = result.EndedAt,
            metadata = result.Metadata,
            options = result.Options,
            window = new
            {
                handle = "0x" + result.Window.Handle.ToInt64().ToString("X"),
                result.Window.ProcessId,
                result.Window.Title,
                result.Window.ProcessName,
                result.Window.ExecutablePath,
                result.Window.ClassName,
                result.Window.IsBrowser,
            },
            system = result.SystemInfo,
            source = new { kind = result.SourceKind.ToString(), label = result.SourceLabel },
            summary = result.Summary,
            timeline = result.Timeline,
            warnings = result.Warnings,
        };

        var json = JsonSerializer.Serialize(dto, new JsonSerializerOptions
        {
            WriteIndented = true,
            Encoder = JavaScriptEncoder.Default,
        });
        File.WriteAllText(path, json, Utf8NoBom);
    }

    private static void AppendComparisonRow(SessionResult result, string dir)
    {
        try
        {
            var s = result.Summary;
            var root = Path.GetDirectoryName(dir) ?? dir;
            var path = Path.Combine(root, "汇总.csv");
            var isNew = !File.Exists(path);
            using var writer = new StreamWriter(path, true, Utf8Bom);
            if (isNew)
            {
                writer.WriteLine("采集时间,作品,测试人,场景/谱面,采集方式,目标进程,窗口,平均FPS,1%Low,0.1%Low,P99帧时间(ms),最大帧时间(ms),CPU平均(%),CPU峰值(%),内存峰值(MB),内存增长(MB),采集秒数,备注,报告目录");
            }

            var values = new[]
            {
                result.StartedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                result.Metadata.AppName,
                result.Metadata.Tester,
                result.Metadata.Scene,
                s.SourceLabel,
                s.ProcessName,
                s.WindowTitle,
                CsvUtil.Number(s.AvgFps, "0.00"),
                CsvUtil.Number(s.OnePercentLowFps, "0.00"),
                CsvUtil.Number(s.PointOnePercentLowFps, "0.00"),
                CsvUtil.Number(s.P99FrameTimeMs, "0.000"),
                CsvUtil.Number(s.MaxFrameTimeMs, "0.000"),
                CsvUtil.Number(s.CpuAvgPercent, "0.00"),
                CsvUtil.Number(s.CpuPeakPercent, "0.00"),
                CsvUtil.Number(s.WorkingSetPeakMB, "0.00"),
                CsvUtil.Number(s.WorkingSetEndMB - s.WorkingSetStartMB, "0.00"),
                CsvUtil.Number(s.RecordingSeconds, "0.0"),
                result.Metadata.Notes,
                dir,
            };

            writer.WriteLine(string.Join(',', values.Select(CsvUtil.Escape)));
        }
        catch
        {
            // A locked summary.csv should not invalidate the rest of the export.
        }
    }

    private static string BuildHtml(SessionResult result)
    {
        var s = result.Summary;
        var data = new
        {
            timeline = result.Timeline.Select(p => new
            {
                second = p.Second,
                fps = Round(p.Fps, 3),
                avgFrameTime = Round(p.AvgFrameTimeMs, 3),
                p99FrameTime = Round(p.P99FrameTimeMs, 3),
                workingSet = Round(p.WorkingSetMB, 2),
                privateMemory = Round(p.PrivateMB, 2),
                cpu = Round(p.CpuPercent, 2),
                gpu = p.GpuBusyPercent.HasValue ? Round(p.GpuBusyPercent.Value, 2) : (double?)null,
                foreground = p.Foreground,
                warmup = p.IsWarmup,
            }),
            refreshHz = result.SystemInfo.MonitorRefreshHz,
        };

        var dataJson = JsonSerializer.Serialize(data, new JsonSerializerOptions
        {
            Encoder = JavaScriptEncoder.Default,
        });

        var cards = new StringBuilder();
        cards.Append(Card("平均 FPS", s.AvgFps.ToString("0.0"), "帧间隔均值", "accent"));
        cards.Append(Card("1% Low", s.OnePercentLowFps.ToString("0.0"), "最慢 1% 帧", "warn"));
        cards.Append(Card("0.1% Low", s.PointOnePercentLowFps.ToString("0.0"), "最慢 0.1% 帧", "danger"));
        cards.Append(Card("P99 帧时间", s.P99FrameTimeMs.ToString("0.00") + " ms", "99 百分位", "info"));
        cards.Append(Card("内存峰值", s.WorkingSetPeakMB.ToString("0") + " MB", "工作集", "ok"));
        cards.Append(Card("CPU 峰值", s.CpuPeakPercent.ToString("0.0") + " %", "整机占用", "violet"));

        var metaRows = new StringBuilder();
        Meta(metaRows, "作品", result.AppLabel);
        Meta(metaRows, "测试人", result.Metadata.Tester);
        Meta(metaRows, "场景 / 谱面", result.Metadata.Scene);
        var modeText = string.Equals(s.CaptureModeLabel, s.SourceLabel, StringComparison.Ordinal)
            ? s.SourceLabel
            : s.CaptureModeLabel + " · " + s.SourceLabel;
        Meta(metaRows, "采集方式", modeText);
        Meta(metaRows, "目标窗口", s.WindowTitle);
        Meta(metaRows, "进程", $"{s.ProcessName} (PID {s.ProcessId})");
        Meta(metaRows, "采集时间", result.StartedAt.ToString("yyyy-MM-dd HH:mm:ss"));
        Meta(metaRows, "采集时长", $"{s.RecordingSeconds:0.0} s（预热 {s.WarmupSeconds:0.#} s）");
        Meta(metaRows, "有效帧 / 原始帧", $"{s.ValidFrames:N0} / {s.TotalFrames:N0}");
        Meta(metaRows, "系统", $"{result.SystemInfo.OsName} {result.SystemInfo.OsVersion} · {result.SystemInfo.CpuSummary}");
        Meta(metaRows, "GPU / 内存", $"{result.SystemInfo.GpuName} · {result.SystemInfo.MemorySummary}");
        Meta(metaRows, "显示器", result.SystemInfo.MonitorSummary);
        Meta(metaRows, "备注", result.Metadata.Notes);

        var metricRows = new StringBuilder();
        Metric(metricRows, "平均帧时间", $"{s.AvgFrameTimeMs:0.000} ms");
        Metric(metricRows, "中位帧时间 / P95", $"{s.MedianFrameTimeMs:0.000} ms / {s.P95FrameTimeMs:0.000} ms");
        Metric(metricRows, "P99 / 最大帧时间", $"{s.P99FrameTimeMs:0.000} ms / {s.MaxFrameTimeMs:0.000} ms");
        Metric(metricRows, "最低 / 最高瞬时 FPS", $"{s.MinFps:0.0} / {s.MaxFps:0.0}");
        Metric(metricRows, "CPU 平均 / 峰值", $"{s.CpuAvgPercent:0.00}% / {s.CpuPeakPercent:0.00}%");
        Metric(metricRows, "工作集 开始 / 结束 / 峰值", $"{s.WorkingSetStartMB:0.0} / {s.WorkingSetEndMB:0.0} / {s.WorkingSetPeakMB:0.0} MB");
        Metric(metricRows, "私有内存 开始 / 结束 / 峰值", $"{s.PrivateStartMB:0.0} / {s.PrivateEndMB:0.0} / {s.PrivatePeakMB:0.0} MB");
        Metric(metricRows, "峰值线程 / 句柄 / 进程", $"{s.PeakThreads} / {s.PeakHandles} / {s.PeakProcessCount}");
        Metric(metricRows, "前台采样占比", $"{s.ForegroundRatio:P0}");
        Metric(metricRows, "GPU 忙碌平均", s.GpuBusyAvgPercent.HasValue ? $"{s.GpuBusyAvgPercent:0.0}%" : "N/A");
        Metric(metricRows, "显示延迟平均 / P95", s.DisplayLatencyAvgMs.HasValue ? $"{s.DisplayLatencyAvgMs:0.000} / {s.DisplayLatencyP95Ms:0.000} ms" : "N/A");
        Metric(metricRows, "主要呈现模式 / 交换链", string.IsNullOrWhiteSpace(s.DominantPresentMode) ? (s.PrimarySwapChain.Length > 0 ? s.PrimarySwapChain : "WGC") : s.DominantPresentMode);

        var warnings = new StringBuilder();
        if (result.Warnings.Count == 0)
        {
            warnings.Append("<div class=\"empty\">没有警告。</div>");
        }
        else
        {
            warnings.Append("<ul>");
            foreach (var warning in result.Warnings)
            {
                warnings.Append("<li>").Append(WebUtility.HtmlEncode(warning)).Append("</li>");
            }

            warnings.Append("</ul>");
        }

        var worstRows = new StringBuilder();
        var worst = result.Frames
            .Where(f => f.FrameTimeMs > 0)
            .OrderByDescending(f => f.FrameTimeMs)
            .Take(20)
            .ToList();
        if (worst.Count == 0)
        {
            worstRows.Append("<tr><td colspan=\"4\" class=\"muted\">没有帧数据</td></tr>");
        }
        else
        {
            foreach (var f in worst)
            {
                worstRows.Append("<tr>")
                    .Append("<td>").Append((f.SessionTimeMs / 1000.0).ToString("0.000")).Append("</td>")
                    .Append("<td>").Append(f.FrameTimeMs.ToString("0.000")).Append(" ms</td>")
                    .Append("<td>").Append((1000.0 / f.FrameTimeMs).ToString("0.0")).Append("</td>")
                    .Append("<td>").Append(WebUtility.HtmlEncode(f.PresentMode ?? "WGC / DWM")).Append("</td>")
                    .Append("</tr>");
            }
        }

        var template = """
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__</title>
<style>
:root{--bg:#0a0f15;--panel:#111923;--panel2:#0d141d;--line:#213043;--text:#e8f0fa;--muted:#8fa2b8;--accent:#45d6ff;--ok:#5ee0aa;--warn:#ffc266;--danger:#ff738a;--violet:#b79cff}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% -10%,#15304a 0,transparent 36%),var(--bg);color:var(--text);font-family:"Microsoft YaHei UI","Segoe UI",sans-serif;line-height:1.55}
.wrap{max-width:1180px;margin:0 auto;padding:42px 28px 64px}
header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:24px}
.brand{display:flex;gap:14px;align-items:center}
.logo{width:44px;height:44px;border-radius:13px;background:linear-gradient(145deg,#45d6ff,#2c73ff);display:grid;place-items:center;color:#04121d;font-weight:900;font-size:19px;box-shadow:0 0 32px #45d6ff33}
h1{font-size:24px;margin:0;letter-spacing:.3px}h2{font-size:16px;margin:0 0 16px;color:#cfe2f5}
.sub{color:var(--muted);font-size:13px;margin-top:3px}.date{text-align:right;color:var(--muted);font-size:13px}
.badge{display:inline-block;border:1px solid #24506a;color:var(--accent);background:#0d2634;border-radius:999px;padding:5px 10px;font-size:12px;margin-top:8px}
.cards{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin:26px 0}
.card{background:linear-gradient(180deg,#131e2a,#0f1721);border:1px solid var(--line);border-radius:14px;padding:16px;min-height:108px;position:relative;overflow:hidden}
.card:after{content:"";position:absolute;inset:auto -20px -40px auto;width:90px;height:90px;border-radius:50%;background:var(--tone);opacity:.09;filter:blur(4px)}
.card .k{font-size:12px;color:var(--muted)}.card .v{font-size:27px;font-weight:800;letter-spacing:-.5px;margin-top:8px;color:var(--tone)}.card .n{font-size:11px;color:#6f8298;margin-top:4px}
.accent{--tone:var(--accent)}.warn{--tone:var(--warn)}.danger{--tone:var(--danger)}.info{--tone:#7db8ff}.ok{--tone:var(--ok)}.violet{--tone:var(--violet)}
.grid{display:grid;grid-template-columns:1fr;gap:16px;margin-top:16px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:20px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:0 22px}.meta .row{display:flex;justify-content:space-between;gap:18px;border-bottom:1px solid #1a2736;padding:8px 0;font-size:13px}.meta .row span:first-child{color:var(--muted);white-space:nowrap}.meta .row span:last-child{text-align:right;word-break:break-word}
.charts{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.chart{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 16px 10px}.chart h3{font-size:13px;color:#bcd2e8;margin:0 0 10px;font-weight:600}.chart .legend{font-size:11px;color:var(--muted);display:flex;gap:14px;margin-bottom:6px}.dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:1px}
canvas{width:100%;height:190px;display:block}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:9px 8px;border-bottom:1px solid #1b2939;text-align:left}th{color:var(--muted);font-weight:500;font-size:12px}td:last-child,th:last-child{text-align:right}.muted{color:var(--muted)}.mono{font-variant-numeric:tabular-nums}
.warnbox{background:#2a1d0d;border:1px solid #5a3d17;color:#ffd48b;border-radius:12px;padding:14px 16px;font-size:13px;margin-top:16px}.warnbox ul{margin:0;padding-left:19px}.warnbox li+li{margin-top:6px}
.notes{color:var(--muted);font-size:12px;margin-top:22px;border-top:1px solid var(--line);padding-top:16px}.notes b{color:#b9cce0}
footer{color:#63768c;font-size:11px;margin-top:18px;display:flex;justify-content:space-between}
@media(max-width:900px){.cards{grid-template-columns:repeat(2,1fr)}.grid,.charts{grid-template-columns:1fr}.meta{grid-template-columns:1fr}header{flex-direction:column}.date{text-align:left}}
</style>
</head>
<body>
<div class="wrap">
<header>
  <div>
    <div class="brand"><div class="logo">AF</div><div><h1>AdoFrame 性能报告</h1><div class="sub">__APP__ · __SOURCE__</div></div></div>
    <div class="badge">__MODE__</div>
  </div>
  <div class="date">__DATE__<br>AdoFrame 1.0</div>
</header>
<div class="cards">__CARDS__</div>
<div class="grid">
  <section class="panel"><h2>采集信息</h2><div class="meta">__META__</div></section>
  <section class="panel"><h2>关键指标</h2><div class="meta">__METRICS__</div></section>
</div>
<div class="charts">
  <section class="chart"><h3>帧率</h3><div class="legend"><span><i class="dot" style="background:#45d6ff"></i>每秒 FPS</span><span><i class="dot" style="background:#5ee0aa"></i>刷新率</span></div><canvas id="fps"></canvas></section>
  <section class="chart"><h3>帧时间</h3><div class="legend"><span><i class="dot" style="background:#45d6ff"></i>平均 ms</span><span><i class="dot" style="background:#ff738a"></i>P99 ms</span></div><canvas id="frametime"></canvas></section>
  <section class="chart"><h3>内存</h3><div class="legend"><span><i class="dot" style="background:#b79cff"></i>工作集 MB</span><span><i class="dot" style="background:#7db8ff"></i>私有内存 MB</span></div><canvas id="memory"></canvas></section>
  <section class="chart"><h3>CPU</h3><div class="legend"><span><i class="dot" style="background:#ffc266"></i>整机占用 %</span></div><canvas id="cpu"></canvas></section>
</div>
<div class="grid">
  <section class="panel"><h2>最慢的 20 帧（原始数据，含预热）</h2><table><thead><tr><th>时间(s)</th><th>帧时间</th><th>瞬时 FPS</th><th>呈现模式</th></tr></thead><tbody>__WORST__</tbody></table></section>
  <section class="panel"><h2>警告与说明</h2><div class="warnbox">__WARNINGS__</div></section>
</div>
<div class="notes">
<b>统计口径：</b>平均 FPS = 1000 / 有效帧的平均帧时间；1% Low / 0.1% Low = 最慢 1% / 0.1% 帧的帧时间平均值换算为 FPS；P99 为帧时间第 99 百分位。预热区间和超过“帧时间上限”的帧不参与任何汇总指标（包括内存峰值）；图表里的黄色阴影仅为预热区间标识。原始帧表保留预热数据用于追溯。窗口捕获（WGC）统计的是该窗口的 DWM 呈现节奏，受显示器刷新率上限约束；PresentMon 统计的是进程的 Present 帧，可高于刷新率。浏览器窗口使用 WGC 时，帧率/帧时间只统计当前窗口的活动标签页，不包含同一浏览器的其它窗口；内存/CPU 仍按该窗口所属进程树统计，因此浏览器的内存会包含同一实例的其它标签页与辅助进程。请不要在采集中最小化窗口或切换浏览器标签页。
<br><br>导出时间：__EXPORTED__ · 数据目录：__DIR__
</div>
<footer><span>AdoFrame · ADOFIA 二创性能采集</span><span>把每一帧都讲清楚</span></footer>
</div>
<script>
const DATA = __DATA__;
const timeline = DATA.timeline || [];
const refresh = DATA.refreshHz || 0;

function fmt(v, d=1){ if(v===null||v===undefined||Number.isNaN(v)) return '-'; return Number(v).toFixed(d); }
function setup(canvas){
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(320, Math.floor(rect.width * dpr));
  canvas.height = Math.max(120, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return {ctx, w: rect.width, h: rect.height};
}
function drawChart(id, series, opts){
  const canvas = document.getElementById(id);
  if(!canvas) return;
  const {ctx,w,h} = setup(canvas);
  const padL = 46, padR = 10, padT = 10, padB = 24;
  const cw = Math.max(10, w-padL-padR), ch = Math.max(10, h-padT-padB);
  ctx.clearRect(0,0,w,h);
  const n = timeline.length;
  if(n === 0){ ctx.fillStyle='#6f8298'; ctx.font='12px sans-serif'; ctx.fillText('没有时间线数据',padL,padT+20); return; }
  let maxY = opts.minMax || 1;
  for(const s of series){ for(const p of s.data){ if(p.v!==null && p.v>maxY) maxY=p.v; } }
  maxY = Math.ceil(maxY / (opts.step || 10)) * (opts.step || 10);
  if(opts.threshold) maxY = Math.max(maxY, opts.threshold * 1.15);
  const xAt = i => padL + (n<=1 ? cw/2 : i/(n-1)*cw);
  const yAt = v => padT + ch - Math.max(0, Math.min(1, v/maxY))*ch;
  ctx.strokeStyle='#1d2b3c'; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=padT+ch*i/4; ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(w-padR,y); ctx.stroke();
    ctx.fillStyle='#6f8298'; ctx.font='10px sans-serif'; ctx.textAlign='right';
    ctx.fillText(fmt(maxY*(4-i)/4, opts.axisDecimals ?? 0), padL-8, y+3);
  }
  const labels = Math.min(6, n);
  for(let i=0;i<labels;i++){
    const idx = Math.round(i*(n-1)/Math.max(1,labels-1));
    const x = xAt(idx); ctx.fillStyle='#6f8298'; ctx.textAlign='center';
    ctx.fillText(timeline[idx].second + 's', x, h-7);
  }
  const warmupEnd = timeline.findIndex(p => !p.warmup);
  if(warmupEnd > 0){
    const x = xAt(warmupEnd);
    ctx.fillStyle = '#ffc26614';
    ctx.fillRect(padL, padT, Math.max(0, x-padL), ch);
    ctx.setLineDash([4,4]);
    ctx.strokeStyle = '#ffc26666';
    ctx.beginPath(); ctx.moveTo(x,padT); ctx.lineTo(x,padT+ch); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffc266aa';
    ctx.textAlign = 'left';
    ctx.fillText('预热', x + 5, padT + 12);
  }
  if(opts.threshold){
    const y=yAt(opts.threshold); ctx.setLineDash([4,4]); ctx.strokeStyle='#5ee0aa88';
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(w-padR,y); ctx.stroke(); ctx.setLineDash([]);
  }
  for(const s of series){
    ctx.beginPath(); let started=false;
    for(let i=0;i<n;i++){
      const v=s.data[i]?.v; if(v===null||v===undefined) {started=false; continue;}
      const x=xAt(i), y=yAt(v);
      if(!started){ctx.moveTo(x,y);started=true;} else ctx.lineTo(x,y);
    }
    ctx.strokeStyle=s.color; ctx.lineWidth=s.width||2; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.stroke();
    if(s.fill){
      ctx.lineTo(xAt(n-1), padT+ch); ctx.lineTo(xAt(0), padT+ch); ctx.closePath();
      const g=ctx.createLinearGradient(0,padT,0,padT+ch); g.addColorStop(0,s.color+'33'); g.addColorStop(1,s.color+'05');
      ctx.fillStyle=g; ctx.fill();
    }
  }
}
function render(){
  drawChart('fps',[
    {data:timeline.map(p=>({v:p.fps>0?p.fps:null})),color:'#45d6ff',fill:true}
  ],{minMax:refresh||60,step:30,threshold:refresh||null});
  drawChart('frametime',[
    {data:timeline.map(p=>({v:p.avgFrameTime>0?p.avgFrameTime:null})),color:'#45d6ff'},
    {data:timeline.map(p=>({v:p.p99FrameTime>0?p.p99FrameTime:null})),color:'#ff738a',width:1.5}
  ],{minMax:(refresh?1000/refresh:16.7)*2,step:10,threshold:refresh?1000/refresh:null,axisDecimals:0});
  drawChart('memory',[
    {data:timeline.map(p=>({v:p.workingSet>0?p.workingSet:null})),color:'#b79cff',fill:true},
    {data:timeline.map(p=>({v:p.privateMemory>0?p.privateMemory:null})),color:'#7db8ff',width:1.5}
  ],{minMax:100,step:100,axisDecimals:0});
  drawChart('cpu',[
    {data:timeline.map(p=>({v:p.cpu>0?p.cpu:null})),color:'#ffc266',fill:true}
  ],{minMax:10,step:10,axisDecimals:0});
}
window.addEventListener('resize', render);
render();
</script>
</body>
</html>
""";

        return template
            .Replace("__TITLE__", WebUtility.HtmlEncode($"AdoFrame · {result.AppLabel}"))
            .Replace("__APP__", WebUtility.HtmlEncode(result.AppLabel))
            .Replace("__SOURCE__", WebUtility.HtmlEncode(s.SourceLabel))
            .Replace("__MODE__", WebUtility.HtmlEncode(s.CaptureModeLabel))
            .Replace("__DATE__", result.StartedAt.ToString("yyyy-MM-dd HH:mm:ss"))
            .Replace("__CARDS__", cards.ToString())
            .Replace("__META__", metaRows.ToString())
            .Replace("__METRICS__", metricRows.ToString())
            .Replace("__WORST__", worstRows.ToString())
            .Replace("__WARNINGS__", warnings.ToString())
            .Replace("__DATA__", dataJson)
            .Replace("__EXPORTED__", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"))
            .Replace("__DIR__", WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(result.OutputDirectory)
                ? "尚未导出"
                : result.OutputDirectory));
    }

    private static string Card(string key, string value, string note, string tone)
        => $"<div class=\"card {tone}\"><div class=\"k\">{WebUtility.HtmlEncode(key)}</div><div class=\"v\">{WebUtility.HtmlEncode(value)}</div><div class=\"n\">{WebUtility.HtmlEncode(note)}</div></div>";

    private static void Meta(StringBuilder sb, string key, string? value)
        => sb.Append("<div class=\"row\"><span>").Append(WebUtility.HtmlEncode(key)).Append("</span><span>").Append(WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(value) ? "—" : value)).Append("</span></div>");

    private static void Metric(StringBuilder sb, string key, string value)
        => sb.Append("<div class=\"row\"><span>").Append(WebUtility.HtmlEncode(key)).Append("</span><span class=\"mono\">").Append(WebUtility.HtmlEncode(value)).Append("</span></div>");

    private static double Round(double value, int digits) => Math.Round(value, digits, MidpointRounding.AwayFromZero);

    public static string SanitizeFileName(string value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "session";
        }

        var invalid = Path.GetInvalidFileNameChars();
        var sb = new StringBuilder();
        foreach (var c in value.Trim())
        {
            sb.Append(invalid.Contains(c) || c is '\r' or '\n' or '\t' ? '_' : c);
            if (sb.Length >= maxLength)
            {
                break;
            }
        }

        var result = sb.ToString().Trim(' ', '.', '_');
        return string.IsNullOrWhiteSpace(result) ? "session" : result;
    }
}
