using System.Diagnostics;
using System.Runtime.InteropServices;
using Windows.Graphics.Capture;
using Windows.Graphics.DirectX;
using Windows.Graphics.DirectX.Direct3D11;
using Vortice.Direct3D;
using Vortice.Direct3D11;
using Vortice.DXGI;
using WinRT;

namespace AdoFrame.Core.Capture;

/// <summary>
/// Window-level frame capture through Windows Graphics Capture.
/// Works with any visible top-level window and captures only that window's composed output.
/// For a browser this means the currently visible tab, not the whole browser process.
/// </summary>
public sealed class WindowCaptureFrameSource : IFrameSource
{
    [DllImport("d3d11.dll", ExactSpelling = true)]
    private static extern int CreateDirect3D11DeviceFromDXGIDevice(IntPtr dxgiDevice, out IntPtr graphicsDevice);

    private readonly IntPtr _hwnd;
    private readonly string _windowTitle;
    private readonly object _gate = new();
    private readonly Stopwatch _clock = new();
    private readonly System.Threading.Timer _watchdog;

    private ID3D11Device? _d3dDevice;
    private IDXGIDevice? _dxgiDevice;
    private IDirect3DDevice? _winrtDevice;
    private GraphicsCaptureItem? _item;
    private Direct3D11CaptureFramePool? _framePool;
    private GraphicsCaptureSession? _session;
    private TimeSpan? _firstTimestamp;
    private TimeSpan? _lastTimestamp;
    private Windows.Graphics.SizeInt32 _lastSize;
    private bool _started;
    private bool _stopping;
    private bool _reportedMinimized;
    private long _lastStallLogTick;

    public WindowCaptureFrameSource(IntPtr hwnd, string windowTitle)
    {
        _hwnd = hwnd;
        _windowTitle = windowTitle;
        _watchdog = new System.Threading.Timer(WatchdogTick, null, Timeout.Infinite, Timeout.Infinite);
    }

    public FrameSourceKind Kind => FrameSourceKind.WindowCapture;

    public string Label => "窗口捕获（WGC）";

    public string? PrimarySwapChain => null;

    public event Action<FrameSample>? FrameReceived;
    public event Action<string, LogLevel>? Log;
    public event Action<string>? Faulted;

    public void Start()
    {
        if (!OperatingSystem.IsWindowsVersionAtLeast(10, 0, 19041))
        {
            throw new PlatformNotSupportedException("窗口捕获需要 Windows 10 2004（19041）或更高版本。");
        }

        if (!NativeMethods.IsWindow(_hwnd))
        {
            throw new InvalidOperationException("目标窗口已不存在。");
        }

        if (NativeMethods.IsIconic(_hwnd))
        {
            throw new InvalidOperationException("目标窗口处于最小化状态，窗口捕获无法取帧。请先还原窗口。");
        }

        _clock.Restart();

        try
        {
            _d3dDevice = D3D11.D3D11CreateDevice(
                DriverType.Hardware,
                DeviceCreationFlags.BgraSupport,
                FeatureLevel.Level_11_1,
                FeatureLevel.Level_11_0);

            if (_d3dDevice == null)
            {
                throw new InvalidOperationException("无法创建 Direct3D 11 设备。");
            }

            _dxgiDevice = _d3dDevice.QueryInterface<IDXGIDevice>();
            var hr = CreateDirect3D11DeviceFromDXGIDevice(_dxgiDevice.NativePointer, out var inspectable);
            Marshal.ThrowExceptionForHR(hr);
            try
            {
                _winrtDevice = MarshalInterface<IDirect3DDevice>.FromAbi(inspectable);
            }
            finally
            {
                Marshal.Release(inspectable);
            }

            _item = GraphicsCaptureItem.TryCreateFromWindowId(
                new Windows.UI.WindowId((ulong)_hwnd.ToInt64()));
            if (_item == null)
            {
                throw new InvalidOperationException("无法为这个窗口创建捕获项（窗口受保护、已关闭，或不是普通桌面窗口）。");
            }

            if (_item.Size.Width <= 0 || _item.Size.Height <= 0)
            {
                throw new InvalidOperationException("目标窗口尺寸为 0，无法捕获。请还原窗口后重试。");
            }

            _lastSize = _item.Size;
            _framePool = Direct3D11CaptureFramePool.CreateFreeThreaded(
                _winrtDevice,
                DirectXPixelFormat.B8G8R8A8UIntNormalized,
                2,
                _item.Size);
            _framePool.FrameArrived += OnFrameArrived;

            _session = _framePool.CreateCaptureSession(_item);
            _item.Closed += OnItemClosed;
            _session.IsCursorCaptureEnabled = false;

            if (OperatingSystem.IsWindowsVersionAtLeast(10, 0, 22621))
            {
                try
                {
                    _session.IsBorderRequired = false;
                }
                catch
                {
                    // Borderless capture may require user consent on some configurations.
                }
            }

            _session.StartCapture();
            _started = true;
            _watchdog.Change(600, 600);
            LogMessage("窗口捕获已开始。", LogLevel.Info);
        }
        catch
        {
            Stop();
            throw;
        }
    }

    private void OnFrameArrived(Direct3D11CaptureFramePool sender, object args)
    {
        FrameSample? sample = null;
        string? message = null;
        LogLevel messageLevel = LogLevel.Warning;

        lock (_gate)
        {
            if (_stopping || !_started || _framePool == null)
            {
                return;
            }

            try
            {
                using var frame = _framePool.TryGetNextFrame();
                if (frame == null)
                {
                    return;
                }

                if (frame.ContentSize.Width != _lastSize.Width || frame.ContentSize.Height != _lastSize.Height)
                {
                    _lastSize = frame.ContentSize;
                    _framePool.Recreate(
                        _winrtDevice,
                        DirectXPixelFormat.B8G8R8A8UIntNormalized,
                        2,
                        _lastSize);
                    _firstTimestamp = null;
                    _lastTimestamp = null;
                    message = "窗口尺寸变化，已重建捕获池并重置帧间隔。";
                    messageLevel = LogLevel.Info;
                    return;
                }

                var timestamp = frame.SystemRelativeTime;
                if (_firstTimestamp == null)
                {
                    _firstTimestamp = timestamp;
                    _lastTimestamp = timestamp;
                    return;
                }

                var intervalMs = (timestamp - _lastTimestamp!.Value).TotalMilliseconds;
                _lastTimestamp = timestamp;

                if (intervalMs <= 0.01)
                {
                    return;
                }

                if (intervalMs > 2000)
                {
                    if (Environment.TickCount64 - _lastStallLogTick > 5000)
                    {
                        _lastStallLogTick = Environment.TickCount64;
                        message = $"窗口超过 {intervalMs / 1000:0.0} 秒没有呈现新帧，已重置间隔（窗口可能被遮挡、最小化或页面被节流）。";
                        messageLevel = LogLevel.Warning;
                    }

                    return;
                }

                sample = new FrameSample(
                    SessionTimeMs: _clock.Elapsed.TotalMilliseconds,
                    FrameTimeMs: intervalMs,
                    CpuBusyMs: null,
                    GpuBusyMs: null,
                    DisplayLatencyMs: null,
                    DisplayedTimeMs: null,
                    PresentMode: "WGC / DWM",
                    SwapChain: null,
                    Displayed: true,
                    SourceTimestampMs: timestamp.TotalMilliseconds);
            }
            catch (Exception ex)
            {
                message = "窗口捕获取帧失败：" + ex.Message;
                messageLevel = LogLevel.Error;
            }
        }

        if (message != null)
        {
            LogMessage(message, messageLevel);
        }

        if (sample.HasValue)
        {
            try
            {
                FrameReceived?.Invoke(sample.Value);
            }
            catch (Exception ex)
            {
                LogMessage("处理窗口帧数据时出错：" + ex.Message, LogLevel.Error);
            }
        }
    }

    private void OnItemClosed(GraphicsCaptureItem sender, object args)
    {
        if (_stopping)
        {
            return;
        }

        Faulted?.Invoke("目标窗口已关闭，或窗口捕获会话已结束。");
    }

    private void WatchdogTick(object? state)
    {
        if (_stopping)
        {
            return;
        }

        try
        {
            if (!NativeMethods.IsWindow(_hwnd))
            {
                Faulted?.Invoke("目标窗口已关闭。");
                return;
            }

            if (NativeMethods.IsIconic(_hwnd))
            {
                if (!_reportedMinimized)
                {
                    _reportedMinimized = true;
                    Faulted?.Invoke("目标窗口已最小化。窗口捕获无法取帧，本次采集已停止。");
                }

                return;
            }

            _reportedMinimized = false;
        }
        catch
        {
        }
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

    public void Stop()
    {
        lock (_gate)
        {
            if (_stopping)
            {
                return;
            }

            _stopping = true;
            _started = false;
        }

        _watchdog.Change(Timeout.Infinite, Timeout.Infinite);

        try
        {
            if (_item != null)
            {
                _item.Closed -= OnItemClosed;
            }

            if (_session != null)
            {
                _session.Dispose();
                _session = null;
            }
        }
        catch
        {
        }

        try
        {
            if (_framePool != null)
            {
                _framePool.FrameArrived -= OnFrameArrived;
                _framePool.Dispose();
                _framePool = null;
            }
        }
        catch
        {
        }

        try
        {
            _winrtDevice?.Dispose();
        }
        catch
        {
        }

        _winrtDevice = null;

        try
        {
            _dxgiDevice?.Dispose();
        }
        catch
        {
        }

        _dxgiDevice = null;

        try
        {
            _d3dDevice?.Dispose();
        }
        catch
        {
        }

        _d3dDevice = null;
        _item = null;
        _clock.Stop();
    }

    public void Dispose()
    {
        Stop();
        _watchdog.Dispose();
    }
}
