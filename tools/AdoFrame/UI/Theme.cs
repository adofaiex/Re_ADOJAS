using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Runtime.InteropServices;

namespace AdoFrame.UI;

public static class Theme
{
    public static readonly Color Bg = Color.FromArgb(8, 13, 19);
    public static readonly Color Surface = Color.FromArgb(15, 23, 33);
    public static readonly Color Surface2 = Color.FromArgb(20, 30, 42);
    public static readonly Color Input = Color.FromArgb(10, 17, 25);
    public static readonly Color Border = Color.FromArgb(34, 51, 69);
    public static readonly Color BorderSoft = Color.FromArgb(26, 40, 56);
    public static readonly Color Text = Color.FromArgb(232, 240, 250);
    public static readonly Color Muted = Color.FromArgb(141, 160, 181);
    public static readonly Color Faint = Color.FromArgb(96, 116, 137);
    public static readonly Color Accent = Color.FromArgb(69, 214, 255);
    public static readonly Color AccentDark = Color.FromArgb(24, 132, 164);
    public static readonly Color Green = Color.FromArgb(94, 224, 170);
    public static readonly Color Orange = Color.FromArgb(255, 194, 102);
    public static readonly Color Red = Color.FromArgb(255, 115, 138);
    public static readonly Color Violet = Color.FromArgb(183, 156, 255);
    public static readonly Color Blue = Color.FromArgb(125, 184, 255);
    public static readonly Color Ink = Color.FromArgb(4, 18, 29);

    private static readonly Dictionary<(float, FontStyle), Font> FontCache = new();
    private static readonly Dictionary<(string, float, FontStyle), Font> FamilyFontCache = new();

    public static Font Font(float size, FontStyle style = FontStyle.Regular)
    {
        var key = (size, style);
        if (!FontCache.TryGetValue(key, out var font))
        {
            font = new Font("Microsoft YaHei UI", size, style, GraphicsUnit.Point);
            FontCache[key] = font;
        }

        return font;
    }

    public static Font MonoFont(float size, FontStyle style = FontStyle.Regular)
    {
        var key = ("Consolas", size, style);
        if (!FamilyFontCache.TryGetValue(key, out var font))
        {
            font = new Font("Consolas", size, style, GraphicsUnit.Point);
            FamilyFontCache[key] = font;
        }

        return font;
    }

    public static Color Alpha(Color color, int alpha)
        => Color.FromArgb(Math.Clamp(alpha, 0, 255), color);

    public static GraphicsPath RoundRect(RectangleF rect, float radius)
    {
        var path = new GraphicsPath();
        var d = Math.Min(radius * 2f, Math.Min(rect.Width, rect.Height));
        if (d <= 1)
        {
            path.AddRectangle(rect);
            path.CloseFigure();
            return path;
        }

        path.AddArc(rect.X, rect.Y, d, d, 180, 90);
        path.AddArc(rect.Right - d, rect.Y, d, d, 270, 90);
        path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0, 90);
        path.AddArc(rect.X, rect.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }

    public static void FillRoundRect(Graphics g, RectangleF rect, float radius, Color color)
    {
        using var path = RoundRect(rect, radius);
        using var brush = new SolidBrush(color);
        g.FillPath(brush, path);
    }

    public static void DrawRoundRect(Graphics g, RectangleF rect, float radius, Color color, float width = 1f)
    {
        using var path = RoundRect(rect, radius);
        using var pen = new Pen(color, width);
        g.DrawPath(pen, path);
    }

    public static void DrawText(Graphics g, string text, Font font, Color color, Rectangle rect,
        TextFormatFlags flags = TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine |
                                TextFormatFlags.EndEllipsis)
    {
        TextRenderer.DrawText(g, text, font, rect, color, flags | TextFormatFlags.NoPrefix);
    }

    public static Icon CreateAppIcon()
    {
        using var bmp = new Bitmap(64, 64);
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
            using var bg = new LinearGradientBrush(new Rectangle(0, 0, 64, 64), Color.FromArgb(70, 220, 255),
                Color.FromArgb(38, 100, 255), 130f);
            FillRoundRect(g, new RectangleF(2, 2, 60, 60), 15, Color.Transparent);
            using var path = RoundRect(new RectangleF(2, 2, 60, 60), 15);
            g.FillPath(bg, path);
            using var pen = new Pen(Color.FromArgb(4, 18, 29), 4.5f)
            {
                StartCap = LineCap.Round,
                EndCap = LineCap.Round,
                LineJoin = LineJoin.Round,
            };
            g.DrawLines(pen, new[]
            {
                new PointF(12, 34), new PointF(23, 34), new PointF(29, 18),
                new PointF(36, 47), new PointF(42, 28), new PointF(52, 28),
            });
        }

        var handle = bmp.GetHicon();
        try
        {
            using var icon = Icon.FromHandle(handle);
            return (Icon)icon.Clone();
        }
        finally
        {
            DestroyIcon(handle);
        }
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool DestroyIcon(IntPtr hIcon);
}
