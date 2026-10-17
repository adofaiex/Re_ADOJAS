using System.Runtime.InteropServices;

namespace AdoFrame.UI;

public sealed partial class MainForm
{
    private const int WmHotkey = 0x0312;
    private const int GlobalStopHotkeyId = 0xA0F9;
    private const uint ModAlt = 0x0001;
    private const uint ModControl = 0x0002;
    private const uint ModShift = 0x0004;
    private const uint ModNoRepeat = 0x4000;
    private const uint VkF9 = 0x78;
    private const uint VkF10 = 0x79;

    private bool _globalHotkeyRegistered;
    private string _registeredHotkeyText = "";

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    private void UpdateGlobalHotkeyRegistration()
    {
        if (!IsHandleCreated || _globalHotkeyCombo == null)
        {
            return;
        }

        UnregisterGlobalHotkey();

        var text = _globalHotkeyCombo.SelectedItem?.ToString() ?? "关闭（仅窗口内 F9）";
        if (!TryParseHotkey(text, out var modifiers, out var virtualKey))
        {
            SetHotkeyHint(
                "全局停止热键已关闭。\n只保留 AdoFrame 窗口内 F9；不会拦截浏览器快捷键。",
                Theme.Faint);
            return;
        }

        if (RegisterHotKey(Handle, GlobalStopHotkeyId, modifiers | ModNoRepeat, virtualKey))
        {
            _globalHotkeyRegistered = true;
            _registeredHotkeyText = text;
            SetHotkeyHint(
                $"已启用全局停止热键：{text}。\n只注册这个组合，不拦截 F5/F12 等浏览器快捷键。",
                Theme.Faint);
            AppendLog($"全局停止热键已启用：{text}（仅停止，不会开始采集）。", Core.LogLevel.Info);
        }
        else
        {
            var error = Marshal.GetLastWin32Error();
            _globalHotkeyRegistered = false;
            _registeredHotkeyText = "";
            SetHotkeyHint(
                $"全局热键 {text} 注册失败（可能被其它程序占用）。\n窗口内 F9 仍然有效；请换一个组合或选择关闭。",
                Theme.Orange);
            AppendLog($"全局停止热键 {text} 注册失败（Win32 错误 {error}）。窗口内 F9 仍然有效。", Core.LogLevel.Warning);
        }
    }

    private void UnregisterGlobalHotkey()
    {
        if (!_globalHotkeyRegistered || !IsHandleCreated)
        {
            return;
        }

        try
        {
            _ = UnregisterHotKey(Handle, GlobalStopHotkeyId);
        }
        catch
        {
        }

        _globalHotkeyRegistered = false;
        _registeredHotkeyText = "";
    }

    private void SetHotkeyHint(string text, Color color)
    {
        if (_hotkeyHint == null)
        {
            return;
        }

        _hotkeyHint.Text = text;
        _hotkeyHint.ForeColor = color;
    }

    private static bool TryParseHotkey(string text, out uint modifiers, out uint virtualKey)
    {
        modifiers = 0;
        virtualKey = 0;
        switch (text)
        {
            case "Ctrl+Alt+F9":
                modifiers = ModControl | ModAlt;
                virtualKey = VkF9;
                return true;
            case "Ctrl+Shift+F9":
                modifiers = ModControl | ModShift;
                virtualKey = VkF9;
                return true;
            case "Ctrl+Alt+F10":
                modifiers = ModControl | ModAlt;
                virtualKey = VkF10;
                return true;
            case "Ctrl+Shift+F10":
                modifiers = ModControl | ModShift;
                virtualKey = VkF10;
                return true;
            default:
                return false;
        }
    }

    private void HandleGlobalStopHotkey()
    {
        if (_picking)
        {
            EndWindowPick(false);
            return;
        }

        if (_countdown)
        {
            CancelCountdown();
            return;
        }

        if (_runner != null && !_stopInProgress)
        {
            AppendLog($"收到全局停止热键 {_registeredHotkeyText}。", Core.LogLevel.Info);
            RequestStop();
        }
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WmHotkey && m.WParam.ToInt32() == GlobalStopHotkeyId)
        {
            HandleGlobalStopHotkey();
            return;
        }

        base.WndProc(ref m);
    }
}
