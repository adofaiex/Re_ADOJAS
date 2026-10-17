using System.Diagnostics;

namespace AdoFrame.Core;

public sealed class ProcessTreeSampler
{
    private readonly uint _rootPid;
    private readonly bool _aggregate;
    private readonly int _logicalProcessors;
    private double _lastCpuSeconds;
    private long _lastTick;
    private bool _initialized;

    public ProcessTreeSampler(uint rootPid, bool aggregate = true)
    {
        _rootPid = rootPid;
        _aggregate = aggregate;
        _logicalProcessors = Math.Max(1, Environment.ProcessorCount);
    }

    public uint RootPid => _rootPid;

    public ResourceSample Prime() => TakeSample();

    public ResourceSample TakeSample()
    {
        var processes = GetProcessTree();
        double workingSet = 0;
        double privateBytes = 0;
        double cpuSeconds = 0;
        var processCount = 0;
        var threadCount = 0;
        var handleCount = 0;
        var rootAlive = false;

        foreach (var pid in processes)
        {
            try
            {
                using var process = Process.GetProcessById((int)pid);
                if (process.HasExited)
                {
                    continue;
                }

                if (pid == _rootPid)
                {
                    rootAlive = true;
                }

                try
                {
                    workingSet += process.WorkingSet64;
                }
                catch
                {
                }

                try
                {
                    privateBytes += process.PrivateMemorySize64;
                }
                catch
                {
                }

                try
                {
                    cpuSeconds += process.TotalProcessorTime.TotalSeconds;
                }
                catch
                {
                }

                try
                {
                    threadCount += process.Threads.Count;
                }
                catch
                {
                }

                try
                {
                    handleCount += process.HandleCount;
                }
                catch
                {
                }

                processCount++;
            }
            catch
            {
                // Process exited between snapshot and opening; ignore it.
            }
        }

        var now = Environment.TickCount64;
        var cpuPercent = 0.0;
        if (_initialized)
        {
            var wallSeconds = (now - _lastTick) / 1000.0;
            if (wallSeconds > 0.001)
            {
                var delta = Math.Max(0, cpuSeconds - _lastCpuSeconds);
                cpuPercent = Math.Clamp(delta / wallSeconds / _logicalProcessors * 100.0, 0, 100);
            }
        }

        _lastCpuSeconds = cpuSeconds;
        _lastTick = now;
        _initialized = true;

        var pidSet = processes.ToHashSet();
        var foreground = NativeMethods.IsForegroundWindowInProcess(IntPtr.Zero, _rootPid, pidSet);

        return new ResourceSample
        {
            ElapsedMs = 0,
            WorkingSetMB = workingSet / (1024.0 * 1024.0),
            PrivateMB = privateBytes / (1024.0 * 1024.0),
            CpuPercent = cpuPercent,
            ProcessCount = processCount,
            ThreadCount = threadCount,
            HandleCount = handleCount,
            Foreground = foreground,
            Alive = rootAlive,
        };
    }

    public HashSet<uint> GetProcessTree()
    {
        var entries = NativeMethods.SnapshotProcesses();
        if (entries.Length == 0)
        {
            return new HashSet<uint>();
        }

        var byParent = new Dictionary<uint, List<uint>>();
        var all = new HashSet<uint>();
        foreach (var entry in entries)
        {
            all.Add(entry.th32ProcessID);
            if (!byParent.TryGetValue(entry.th32ParentProcessID, out var children))
            {
                children = new List<uint>();
                byParent[entry.th32ParentProcessID] = children;
            }

            children.Add(entry.th32ProcessID);
        }

        if (!all.Contains(_rootPid))
        {
            return new HashSet<uint>();
        }

        var result = new HashSet<uint>();
        var queue = new Queue<uint>();
        result.Add(_rootPid);
        queue.Enqueue(_rootPid);

        while (queue.Count > 0)
        {
            var parent = queue.Dequeue();
            if (!byParent.TryGetValue(parent, out var children))
            {
                continue;
            }

            foreach (var child in children)
            {
                if (result.Add(child))
                {
                    queue.Enqueue(child);
                }
            }
        }

        if (!_aggregate)
        {
            return new HashSet<uint> { _rootPid };
        }

        return result;
    }

    public static bool IsProcessAlive(uint pid)
    {
        if (pid == 0)
        {
            return false;
        }

        try
        {
            using var process = Process.GetProcessById((int)pid);
            return !process.HasExited;
        }
        catch
        {
            return false;
        }
    }
}
