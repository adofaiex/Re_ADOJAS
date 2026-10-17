namespace AdoFrame.Core.Capture;

public interface IFrameSource : IDisposable
{
    FrameSourceKind Kind { get; }
    string Label { get; }
    string? PrimarySwapChain { get; }

    event Action<FrameSample>? FrameReceived;
    event Action<string, LogLevel>? Log;
    event Action<string>? Faulted;

    void Start();
    void Stop();
}
