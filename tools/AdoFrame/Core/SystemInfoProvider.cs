using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace AdoFrame.Core;

public static class SystemInfoProvider
{
    public static SystemInfo Collect(IntPtr windowHandle)
    {
        var info = new SystemInfo
        {
            LogicalProcessors = Environment.ProcessorCount,
            TotalMemoryMB = NativeMethods.GetSystemMemoryMB(),
            MachineName = Environment.MachineName,
            UserName = Environment.UserName,
        };

        info.CpuName = ReadCpuName();
        ReadOsVersion(info);
        info.GpuName = ReadGpuName();
        ReadMonitor(info, windowHandle);
        return info;
    }

    private static string ReadCpuName()
    {
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\CentralProcessor\0");
            var value = key?.GetValue("ProcessorNameString") as string;
            if (!string.IsNullOrWhiteSpace(value))
            {
                return string.Join(' ', value.Split(' ', StringSplitOptions.RemoveEmptyEntries));
            }
        }
        catch
        {
        }

        var identifier = Environment.GetEnvironmentVariable("PROCESSOR_IDENTIFIER");
        return string.IsNullOrWhiteSpace(identifier) ? "未知 CPU" : identifier;
    }

    private static void ReadOsVersion(SystemInfo info)
    {
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion");
            var product = key?.GetValue("ProductName") as string ?? "Windows";
            var display = key?.GetValue("DisplayVersion") as string ??
                          key?.GetValue("ReleaseId") as string ?? "";
            var build = key?.GetValue("CurrentBuildNumber") as string ?? Environment.OSVersion.Version.Build.ToString();
            var ubr = key?.GetValue("UBR");
            var buildNumber = int.TryParse(build, out var parsedBuild) ? parsedBuild : 0;

            if (buildNumber >= 22000 && product.Contains("Windows 10", StringComparison.OrdinalIgnoreCase))
            {
                product = product.Replace("Windows 10", "Windows 11", StringComparison.OrdinalIgnoreCase);
            }

            info.OsName = product;
            info.OsVersion = display;
            info.OsBuild = ubr != null ? $"{build}.{ubr}" : build;
        }
        catch
        {
            info.OsName = "Windows";
            info.OsVersion = Environment.OSVersion.Version.ToString();
            info.OsBuild = Environment.OSVersion.Version.Build.ToString();
        }
    }

    private static string ReadGpuName()
    {
        var names = new List<string>();
        try
        {
            for (uint i = 0; i < 16; i++)
            {
                var device = new NativeMethods.DisplayDevice
                {
                    cb = Marshal.SizeOf<NativeMethods.DisplayDevice>(),
                    DeviceName = "",
                    DeviceString = "",
                    DeviceID = "",
                    DeviceKey = "",
                };

                if (!NativeMethods.EnumDisplayDevicesW(null, i, ref device, 0))
                {
                    break;
                }

                var name = device.DeviceString?.Trim() ?? "";
                if (string.IsNullOrWhiteSpace(name) ||
                    name.Equals("Microsoft Basic Display Adapter", StringComparison.OrdinalIgnoreCase) ||
                    name.Equals("Microsoft Basic Render Driver", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (!names.Contains(name, StringComparer.OrdinalIgnoreCase))
                {
                    names.Add(name);
                }
            }
        }
        catch
        {
        }

        return names.Count == 0 ? "未知 GPU" : string.Join(" / ", names.Take(3));
    }

    private static void ReadMonitor(SystemInfo info, IntPtr hwnd)
    {
        try
        {
            _ = NativeMethods.GetWindowRect(hwnd, out var windowRect);
            info.WindowWidth = Math.Max(0, windowRect.Width);
            info.WindowHeight = Math.Max(0, windowRect.Height);
            info.Dpi = (int)Math.Round((double)NativeMethods.GetDpiForWindow(hwnd));

            var monitor = NativeMethods.MonitorFromWindow(hwnd, NativeMethods.MonitorDefaultToNearest);
            if (monitor == IntPtr.Zero)
            {
                return;
            }

            var monitorInfo = new NativeMethods.MonitorInfoEx
            {
                cbSize = Marshal.SizeOf<NativeMethods.MonitorInfoEx>(),
                szDevice = "",
            };

            if (!NativeMethods.GetMonitorInfoW(monitor, ref monitorInfo))
            {
                return;
            }

            info.MonitorName = monitorInfo.szDevice;
            try
            {
                var monitorDevice = new NativeMethods.DisplayDevice
                {
                    cb = Marshal.SizeOf<NativeMethods.DisplayDevice>(),
                    DeviceName = "",
                    DeviceString = "",
                    DeviceID = "",
                    DeviceKey = "",
                };
                if (NativeMethods.EnumDisplayDevicesW(monitorInfo.szDevice, 0, ref monitorDevice, 0) &&
                    !string.IsNullOrWhiteSpace(monitorDevice.DeviceString))
                {
                    info.MonitorName = monitorDevice.DeviceString.Trim();
                }
            }
            catch
            {
            }

            var devMode = new NativeMethods.DevMode
            {
                dmDeviceName = "",
                dmFormName = "",
            };
            if (NativeMethods.EnumDisplaySettingsW(monitorInfo.szDevice, -1, ref devMode))
            {
                info.MonitorWidth = (int)devMode.dmPelsWidth;
                info.MonitorHeight = (int)devMode.dmPelsHeight;
                info.MonitorRefreshHz = (int)devMode.dmDisplayFrequency;
            }
            else
            {
                info.MonitorWidth = monitorInfo.rcMonitor.Width;
                info.MonitorHeight = monitorInfo.rcMonitor.Height;
            }
        }
        catch
        {
            // Monitor metadata is informative only.
        }
    }
}
