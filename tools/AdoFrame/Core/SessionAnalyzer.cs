using System.Globalization;

namespace AdoFrame.Core;

public static class SessionAnalyzer
{
    public static SessionResult BuildResult(
        SessionMetadata metadata,
        SessionOptions options,
        WindowInfo window,
        SystemInfo systemInfo,
        FrameSourceKind sourceKind,
        string sourceLabel,
        string captureModeLabel,
        DateTime startedAt,
        DateTime endedAt,
        double recordingSeconds,
        List<FrameSample> frames,
        List<ResourceSample> resources,
        string stopReason,
        IReadOnlyList<string> warnings)
    {
        var result = new SessionResult
        {
            StartedAt = startedAt,
            EndedAt = endedAt,
            Metadata = metadata,
            Options = options,
            Window = window,
            SystemInfo = systemInfo,
            SourceKind = sourceKind,
            SourceLabel = sourceLabel,
            StopReason = stopReason,
            Warnings = warnings.ToList(),
        };

        var summary = new SessionSummary
        {
            WindowTitle = window.Title,
            WindowClass = window.ClassName,
            ProcessName = window.ProcessName,
            ProcessPath = window.ExecutablePath,
            ProcessId = window.ProcessId,
            SourceLabel = sourceLabel,
            CaptureModeLabel = captureModeLabel,
            RecordingSeconds = Math.Max(0, recordingSeconds),
            TotalFrames = frames.Count,
            WarmupSeconds = options.WarmupSeconds,
            MaxFrameTimeFilterMs = options.MaxFrameTimeMs,
            StopReason = stopReason,
        };

        var swapChainGroups = frames
            .Where(f => !string.IsNullOrWhiteSpace(f.SwapChain))
            .GroupBy(f => f.SwapChain!, StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(g => g.Count())
            .ToList();

        summary.SwapChainCount = swapChainGroups.Count;
        if (swapChainGroups.Count > 0)
        {
            summary.PrimarySwapChain = swapChainGroups[0].Key;
            if (swapChainGroups.Count > 1)
            {
                var detail = string.Join(", ", swapChainGroups.Select(g => $"{g.Key}: {g.Count()} 帧"));
                AddWarning(result, $"检测到多个交换链，统计仅使用最活跃的 {summary.PrimarySwapChain}（{detail}）。");
            }
        }

        var primarySwapChain = swapChainGroups.Count > 1 ? summary.PrimarySwapChain : null;
        var warmupMs = Math.Max(0, options.WarmupSeconds * 1000);
        var maxFrameTime = options.MaxFrameTimeMs;

        var filteredFrames = frames
            .Where(f => primarySwapChain == null ||
                        string.IsNullOrWhiteSpace(f.SwapChain) ||
                        string.Equals(f.SwapChain, primarySwapChain, StringComparison.OrdinalIgnoreCase))
            .Where(f => f.FrameTimeMs > 0 &&
                        f.SessionTimeMs >= warmupMs &&
                        (maxFrameTime <= 0 || f.FrameTimeMs <= maxFrameTime))
            .ToList();

        var intervals = filteredFrames.Select(f => f.FrameTimeMs).ToList();
        summary.ValidFrames = intervals.Count;

        if (intervals.Count > 0)
        {
            intervals.Sort();
            var sum = intervals.Sum();
            var average = sum / intervals.Count;
            summary.AnalysisSeconds = sum / 1000.0;
            summary.AvgFrameTimeMs = average;
            summary.AvgFps = 1000.0 / average;
            summary.MedianFrameTimeMs = PercentileSorted(intervals, 0.50);
            summary.P95FrameTimeMs = PercentileSorted(intervals, 0.95);
            summary.P99FrameTimeMs = PercentileSorted(intervals, 0.99);
            summary.MinFrameTimeMs = intervals[0];
            summary.MaxFrameTimeMs = intervals[^1];
            summary.MaxFps = 1000.0 / Math.Max(0.0001, summary.MinFrameTimeMs);
            summary.MinFps = 1000.0 / Math.Max(0.0001, summary.MaxFrameTimeMs);
            summary.OnePercentLowFps = WorstLowFps(intervals, 0.01);
            summary.PointOnePercentLowFps = WorstLowFps(intervals, 0.001);
        }

        var statsFrames = filteredFrames
            .Where(f => f.GpuBusyMs.HasValue)
            .ToList();
        if (statsFrames.Count > 0 && summary.AnalysisSeconds > 0)
        {
            var gpuSum = statsFrames.Sum(f => f.GpuBusyMs!.Value);
            summary.GpuBusyAvgPercent = Math.Clamp(gpuSum / (summary.AnalysisSeconds * 1000.0) * 100.0, 0, 100);
        }

        var latency = filteredFrames
            .Where(f => f.DisplayLatencyMs.HasValue)
            .Select(f => f.DisplayLatencyMs!.Value)
            .ToList();
        if (latency.Count > 0)
        {
            latency.Sort();
            summary.DisplayLatencyAvgMs = latency.Average();
            summary.DisplayLatencyP95Ms = PercentileSorted(latency, 0.95);
        }

        var presentModes = filteredFrames
            .Where(f => !string.IsNullOrWhiteSpace(f.PresentMode))
            .GroupBy(f => f.PresentMode!, StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(g => g.Count())
            .ToList();
        if (presentModes.Count > 0)
        {
            summary.DominantPresentMode = presentModes[0].Key;
        }

        var filteredResources = resources.Where(r => r.ElapsedMs >= warmupMs).ToList();
        if (filteredResources.Count == 0)
        {
            filteredResources = resources.ToList();
        }

        if (filteredResources.Count > 0)
        {
            summary.WorkingSetStartMB = filteredResources[0].WorkingSetMB;
            summary.WorkingSetEndMB = filteredResources[^1].WorkingSetMB;
            summary.WorkingSetAvgMB = filteredResources.Average(r => r.WorkingSetMB);
            summary.WorkingSetPeakMB = filteredResources.Max(r => r.WorkingSetMB);
            summary.PrivateStartMB = filteredResources[0].PrivateMB;
            summary.PrivateEndMB = filteredResources[^1].PrivateMB;
            summary.PrivatePeakMB = filteredResources.Max(r => r.PrivateMB);
            summary.CpuAvgPercent = filteredResources.Average(r => r.CpuPercent);
            summary.CpuPeakPercent = filteredResources.Max(r => r.CpuPercent);
            summary.PeakThreads = filteredResources.Max(r => r.ThreadCount);
            summary.PeakHandles = filteredResources.Max(r => r.HandleCount);
            summary.PeakProcessCount = filteredResources.Max(r => r.ProcessCount);
            summary.ForegroundRatio = filteredResources.Count(r => r.Foreground)
                                      / (double)filteredResources.Count;
        }

        summary.Warnings = result.Warnings.ToArray();
        result.Summary = summary;
        result.Frames = frames.ToList();
        result.Resources = resources.ToList();
        result.Timeline = BuildTimeline(frames, resources, primarySwapChain, maxFrameTime, warmupMs, recordingSeconds);
        return result;
    }

    public static List<TimelinePoint> BuildTimeline(
        IReadOnlyList<FrameSample> frames,
        IReadOnlyList<ResourceSample> resources,
        string? primarySwapChain,
        double maxFrameTimeMs,
        double warmupMs,
        double recordingSeconds)
    {
        var selected = frames
            .Where(f => primarySwapChain == null ||
                        string.IsNullOrWhiteSpace(f.SwapChain) ||
                        string.Equals(f.SwapChain, primarySwapChain, StringComparison.OrdinalIgnoreCase))
            .ToList();

        var frameGroups = selected
            .GroupBy(f => (int)Math.Floor(f.SessionTimeMs / 1000.0))
            .ToDictionary(g => g.Key, g => g.ToList());

        var resourceGroups = resources
            .GroupBy(r => (int)Math.Floor(r.ElapsedMs / 1000.0))
            .ToDictionary(g => g.Key, g => g.OrderBy(r => r.ElapsedMs).Last());

        var lastSecond = Math.Max(
            recordingSeconds > 0 ? (int)Math.Floor(recordingSeconds) : 0,
            Math.Max(
                frameGroups.Count > 0 ? frameGroups.Keys.Max() : 0,
                resourceGroups.Count > 0 ? resourceGroups.Keys.Max() : 0));

        var result = new List<TimelinePoint>(lastSecond + 1);
        ResourceSample? lastResource = resourceGroups.Count > 0
            ? resourceGroups.OrderBy(kv => kv.Key).First().Value
            : null;

        for (var second = 0; second <= lastSecond; second++)
        {
            var point = new TimelinePoint
            {
                Second = second,
                IsWarmup = second * 1000.0 < warmupMs,
            };

            if (frameGroups.TryGetValue(second, out var secondFrames))
            {
                point.Frames = secondFrames.Count;
                var valid = secondFrames
                    .Where(f => f.FrameTimeMs > 0 &&
                                (maxFrameTimeMs <= 0 || f.FrameTimeMs <= maxFrameTimeMs))
                    .Select(f => f.FrameTimeMs)
                    .OrderBy(v => v)
                    .ToList();
                if (valid.Count > 0)
                {
                    var avg = valid.Average();
                    point.AvgFrameTimeMs = avg;
                    point.Fps = 1000.0 / avg;
                    point.P99FrameTimeMs = PercentileSorted(valid, 0.99);
                }

                var gpu = secondFrames.Where(f => f.GpuBusyMs.HasValue).Sum(f => f.GpuBusyMs!.Value);
                if (secondFrames.Any(f => f.GpuBusyMs.HasValue))
                {
                    point.GpuBusyPercent = Math.Clamp(gpu / 1000.0 * 100.0, 0, 100);
                }
            }

            if (resourceGroups.TryGetValue(second, out var resource))
            {
                lastResource = resource;
            }

            if (lastResource != null)
            {
                // Timer jitter can leave a one-second hole; carrying the previous sample
                // gives a much more readable timeline than a false zero.
                point.WorkingSetMB = lastResource.WorkingSetMB;
                point.PrivateMB = lastResource.PrivateMB;
                point.CpuPercent = lastResource.CpuPercent;
                point.Foreground = lastResource.Foreground;
            }

            result.Add(point);
        }

        return result;
    }

    private static double PercentileSorted(IReadOnlyList<double> sortedAscending, double percentile)
    {
        if (sortedAscending.Count == 0)
        {
            return 0;
        }

        if (sortedAscending.Count == 1)
        {
            return sortedAscending[0];
        }

        var rank = Math.Clamp(percentile, 0, 1) * (sortedAscending.Count - 1);
        var low = (int)Math.Floor(rank);
        var high = (int)Math.Ceiling(rank);
        if (low == high)
        {
            return sortedAscending[low];
        }

        return sortedAscending[low] + (sortedAscending[high] - sortedAscending[low]) * (rank - low);
    }

    public static double P99(IReadOnlyList<double> sortedAscending)
        => PercentileSorted(sortedAscending, 0.99);

    private static double WorstLowFps(IReadOnlyList<double> sortedAscending, double fraction)
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

    private static void AddWarning(SessionResult result, string warning)
    {
        if (!result.Warnings.Contains(warning, StringComparer.Ordinal))
        {
            result.Warnings.Add(warning);
        }
    }

    public static string FormatNumber(double value, int decimals = 1)
        => value.ToString("0." + new string('#', Math.Max(0, decimals)), CultureInfo.InvariantCulture);
}
