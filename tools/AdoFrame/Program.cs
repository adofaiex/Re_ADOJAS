using System.Text;
using AdoFrame.Core;
using AdoFrame.UI;

namespace AdoFrame;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        using var mutex = new Mutex(true, @"Local\AdoFrame.SingleInstance", out var createdNew);
        if (!createdNew)
        {
            MessageBox.Show("AdoFrame 已经在运行。", "AdoFrame", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        ApplicationConfiguration.Initialize();
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += (_, e) => HandleException(e.Exception);
        AppDomain.CurrentDomain.UnhandledException += (_, e) =>
        {
            if (e.ExceptionObject is Exception exception)
            {
                HandleException(exception, terminating: true);
            }
        };

        try
        {
            Application.Run(new MainForm());
        }
        catch (Exception ex)
        {
            HandleException(ex, terminating: true);
        }
        finally
        {
            try
            {
                mutex.ReleaseMutex();
            }
            catch
            {
            }
        }
    }

    private static void HandleException(Exception exception, bool terminating = false)
    {
        try
        {
            Directory.CreateDirectory(AppPaths.SettingsDirectory);
            var log = new StringBuilder()
                .AppendLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {(terminating ? "Fatal" : "Unhandled")} exception")
                .AppendLine(exception.ToString())
                .AppendLine();
            File.AppendAllText(Path.Combine(AppPaths.SettingsDirectory, "crash.log"), log.ToString());
        }
        catch
        {
        }

        MessageBox.Show(
            "AdoFrame 遇到未处理的错误：\n\n" + exception.Message +
            "\n\n详细信息已写入：\n" + Path.Combine(AppPaths.SettingsDirectory, "crash.log"),
            "AdoFrame", MessageBoxButtons.OK, MessageBoxIcon.Error);
    }
}
