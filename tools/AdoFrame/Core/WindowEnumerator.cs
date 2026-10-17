using System.Diagnostics;
using System.Text;

namespace AdoFrame.Core;

public static class WindowEnumerator
{
    private static readonly HashSet<string> BrowserProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        "chrome", "msedge", "brave", "opera", "opera_gx", "vivaldi", "thorium",
        "firefox", "librewolf", "waterfox", "floorp", "zen",
        "electron", "webviewhost", "msedgewebview2",
    };

    private static readonly HashSet<string> IgnoredClasses = new(StringComparer.OrdinalIgnoreCase)
    {
        "Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd",
        "Windows.UI.Core.CoreWindow", "ForegroundStaging",
        "MultitaskingViewFrame", "XamlExplorerHostIslandWindow",
        "ApplicationManager_DesktopShellWindow", "SysShadow",
    };

    public static List<WindowInfo> GetWindows()
    {
        var list = new List<WindowInfo>(64);
        var ownPid = (uint)Environment.ProcessId;

        NativeMethods.EnumWindows((hwnd, lParam) =>
        {
            try
            {
                if (!NativeMethods.IsWindowVisible(hwnd) || NativeMethods.IsCloaked(hwnd))
                {
                    return true;
                }

                _ = NativeMethods.GetWindowRect(hwnd, out var rect);
                if (rect.Width < 80 || rect.Height < 60)
                {
                    return true;
                }

                var exStyle = NativeMethods.GetWindowLongPtrW(hwnd, NativeMethods.GwlExStyle).ToInt64();
                if ((exStyle & NativeMethods.WsExToolWindow) != 0 &&
                    (exStyle & 0x00040000L) == 0) // WS_EX_APPWINDOW
                {
                    return true;
                }

                if ((exStyle & NativeMethods.WsExNoActivate) != 0)
                {
                    return true;
                }

                var pid = NativeMethods.GetWindowProcessId(hwnd);
                if (pid == 0 || pid == ownPid || pid == 4)
                {
                    return true;
                }

                var className = NativeMethods.GetWindowClass(hwnd);
                if (IgnoredClasses.Contains(className))
                {
                    return true;
                }

                var title = NativeMethods.GetWindowTitle(hwnd);
                var processName = "";
                var path = "";

                try
                {
                    using var process = Process.GetProcessById((int)pid);
                    processName = process.ProcessName;
                    try
                    {
                        path = process.MainModule?.FileName ?? "";
                    }
                    catch
                    {
                        // Access can be denied for elevated / protected processes.
                    }
                }
                catch
                {
                    return true;
                }

                if (string.IsNullOrWhiteSpace(processName) && string.IsNullOrWhiteSpace(title))
                {
                    return true;
                }

                // Explorer's desktop / shell surfaces are not useful benchmark targets.
                if (processName.Equals("explorer", StringComparison.OrdinalIgnoreCase) &&
                    string.IsNullOrWhiteSpace(title))
                {
                    return true;
                }

                var isBrowser = IsBrowserWindow(className, processName);
                if (isBrowser && string.IsNullOrWhiteSpace(title))
                {
                    // Chromium keeps hidden helper windows around; they are not useful capture targets.
                    return true;
                }

                var displayTitle = string.IsNullOrWhiteSpace(title)
                    ? "(无标题) " + processName
                    : title;

                list.Add(new WindowInfo
                {
                    Handle = hwnd,
                    ProcessId = pid,
                    Title = displayTitle,
                    ProcessName = processName,
                    ExecutablePath = path,
                    ClassName = className,
                    IsBrowser = isBrowser,
                    IsMinimized = NativeMethods.IsIconic(hwnd),
                });
            }
            catch
            {
                // A window can disappear while enumerating; ignore it.
            }

            return true;
        }, IntPtr.Zero);

        return list
            .OrderByDescending(w => w.IsBrowser)
            .ThenBy(w => w.ProcessName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(w => w.Title, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public static WindowInfo? DescribeWindow(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero || !NativeMethods.IsWindow(hwnd))
        {
            return null;
        }

        hwnd = NativeMethods.GetRootWindow(hwnd);
        var pid = NativeMethods.GetWindowProcessId(hwnd);
        if (pid == 0 || pid == (uint)Environment.ProcessId)
        {
            return null;
        }

        try
        {
            using var process = Process.GetProcessById((int)pid);
            var path = "";
            try
            {
                path = process.MainModule?.FileName ?? "";
            }
            catch
            {
            }

            var className = NativeMethods.GetWindowClass(hwnd);
            _ = NativeMethods.GetWindowRect(hwnd, out var rect);
            if (rect.Width < 80 || rect.Height < 60)
            {
                return null;
            }

            return new WindowInfo
            {
                Handle = hwnd,
                ProcessId = pid,
                Title = NativeMethods.GetWindowTitle(hwnd),
                ProcessName = process.ProcessName,
                ExecutablePath = path,
                ClassName = className,
                IsBrowser = IsBrowserWindow(className, process.ProcessName),
                IsMinimized = NativeMethods.IsIconic(hwnd),
            };
        }
        catch
        {
            return null;
        }
    }

    public static bool IsBrowserWindow(string className, string processName)
    {
        if (className.Contains("Chrome_WidgetWin", StringComparison.OrdinalIgnoreCase) ||
            className.Contains("MozillaWindowClass", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var name = processName.Trim();
        if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
        {
            name = name[..^4];
        }

        return BrowserProcesses.Contains(name);
    }

    public static string GetCurrentTitle(IntPtr hwnd)
        => NativeMethods.IsWindow(hwnd) ? NativeMethods.GetWindowTitle(hwnd) : "";

    public static string CompactTitle(string title, int maxLength = 90)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return "(无标题窗口)";
        }

        title = title.Replace("\r", " ").Replace("\n", " ").Trim();
        if (title.Length <= maxLength)
        {
            return title;
        }

        return title[..Math.Max(1, maxLength - 1)] + "…";
    }

    public static string BuildWindowSignature(WindowInfo window)
    {
        var sb = new StringBuilder();
        sb.Append(window.Handle).Append('|')
          .Append(window.ProcessId).Append('|')
          .Append(window.ClassName);
        return sb.ToString();
    }
}
