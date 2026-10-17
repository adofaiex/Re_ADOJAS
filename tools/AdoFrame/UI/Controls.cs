using System.Drawing.Drawing2D;
using AdoFrame.Core;

namespace AdoFrame.UI;

public enum ButtonVariant
{
    Primary,
    Secondary,
    Ghost,
    Danger,
    Success,
}

public class AccentButton : Button
{
    private bool _hover;
    private bool _pressed;

    public ButtonVariant Variant { get; set; } = ButtonVariant.Secondary;
    public int CornerRadius { get; set; } = 9;
    public bool Active { get; set; }

    public AccentButton()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw |
                 ControlStyles.SupportsTransparentBackColor, true);
        FlatStyle = FlatStyle.Flat;
        FlatAppearance.BorderSize = 0;
        BackColor = Color.Transparent;
        ForeColor = Theme.Text;
        Font = Theme.Font(9.5f, FontStyle.Bold);
        Cursor = Cursors.Hand;
        Height = 38;
        TabStop = true;
        UseVisualStyleBackColor = false;
    }

    protected override void OnMouseEnter(EventArgs e)
    {
        _hover = true;
        Invalidate();
        base.OnMouseEnter(e);
    }

    protected override void OnMouseLeave(EventArgs e)
    {
        _hover = false;
        _pressed = false;
        Invalidate();
        base.OnMouseLeave(e);
    }

    protected override void OnMouseDown(MouseEventArgs mevent)
    {
        if (mevent.Button == MouseButtons.Left)
        {
            _pressed = true;
            Invalidate();
        }

        base.OnMouseDown(mevent);
    }

    protected override void OnMouseUp(MouseEventArgs mevent)
    {
        _pressed = false;
        Invalidate();
        base.OnMouseUp(mevent);
    }

    protected override void OnEnabledChanged(EventArgs e)
    {
        Invalidate();
        base.OnEnabledChanged(e);
    }

    protected override void OnPaint(PaintEventArgs pevent)
    {
        var g = pevent.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var rect = new RectangleF(0.5f, 0.5f, Math.Max(1, Width - 1), Math.Max(1, Height - 1));

        Color fill;
        Color text;
        Color? border = null;

        if (!Enabled)
        {
            fill = Theme.Surface2;
            text = Theme.Faint;
        }
        else
        {
            switch (Variant)
            {
                case ButtonVariant.Primary:
                    fill = _pressed ? Theme.AccentDark : (_hover ? Color.FromArgb(106, 227, 255) : Theme.Accent);
                    text = Theme.Ink;
                    break;
                case ButtonVariant.Danger:
                    fill = _pressed ? Color.FromArgb(195, 55, 77) : (_hover ? Color.FromArgb(255, 133, 153) : Theme.Red);
                    text = Color.FromArgb(35, 6, 12);
                    break;
                case ButtonVariant.Success:
                    fill = _pressed ? Color.FromArgb(45, 160, 120) : (_hover ? Color.FromArgb(118, 240, 188) : Theme.Green);
                    text = Color.FromArgb(4, 30, 20);
                    break;
                case ButtonVariant.Ghost:
                    fill = _hover || Active ? Theme.Surface2 : Parent?.BackColor ?? Theme.Surface;
                    text = Active ? Theme.Accent : (_hover ? Theme.Text : Theme.Muted);
                    border = Active ? Theme.Alpha(Theme.Accent, 90) : null;
                    break;
                default:
                    fill = _pressed ? Theme.Surface : (_hover ? Theme.Surface2 : Color.FromArgb(17, 26, 37));
                    text = _hover ? Theme.Text : Color.FromArgb(210, 224, 238);
                    border = _hover ? Theme.Alpha(Theme.Accent, 80) : Theme.Border;
                    break;
            }
        }

        Theme.FillRoundRect(g, rect, CornerRadius, fill);
        if (border.HasValue)
        {
            Theme.DrawRoundRect(g, rect, CornerRadius, border.Value);
        }

        var flags = TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter |
                    TextFormatFlags.SingleLine | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix;
        TextRenderer.DrawText(g, Text, Font, new Rectangle(6, 0, Width - 12, Height), text, flags);

        if (Focused && Enabled)
        {
            using var pen = new Pen(Theme.Alpha(Theme.Accent, 120)) { DashStyle = DashStyle.Dot };
            g.DrawRectangle(pen, 4, 4, Width - 9, Height - 9);
        }
    }
}

public sealed class ChipButton : AccentButton
{
    public ChipButton()
    {
        Variant = ButtonVariant.Ghost;
        Font = Theme.Font(9f, FontStyle.Bold);
        Height = 30;
        CornerRadius = 7;
        Active = false;
    }
}

public sealed class StatusPill : Control
{
    private PillTone _tone = PillTone.Idle;

    public PillTone Tone
    {
        get => _tone;
        set
        {
            _tone = value;
            Invalidate();
        }
    }

    public StatusPill()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw |
                 ControlStyles.SupportsTransparentBackColor, true);
        Font = Theme.Font(8.8f, FontStyle.Bold);
        Height = 28;
        Width = 96;
        BackColor = Color.Transparent;
        ForeColor = Theme.Muted;
    }

    protected override void OnTextChanged(EventArgs e)
    {
        var width = TextRenderer.MeasureText(Text, Font).Width + 34;
        Width = Math.Max(80, width);
        Invalidate();
        base.OnTextChanged(e);
    }

    protected override void OnPaint(PaintEventArgs pevent)
    {
        var g = pevent.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var (fg, bg) = _tone switch
        {
            PillTone.Running => (Theme.Accent, Theme.Alpha(Theme.Accent, 24)),
            PillTone.Success => (Theme.Green, Theme.Alpha(Theme.Green, 22)),
            PillTone.Warning => (Theme.Orange, Theme.Alpha(Theme.Orange, 22)),
            PillTone.Error => (Theme.Red, Theme.Alpha(Theme.Red, 22)),
            _ => (Theme.Muted, Theme.Alpha(Theme.Muted, 16)),
        };

        var rect = new RectangleF(0.5f, 0.5f, Width - 1, Height - 1);
        Theme.FillRoundRect(g, rect, Height / 2f, bg);
        Theme.DrawRoundRect(g, rect, Height / 2f, Theme.Alpha(fg, 80));

        using var dot = new SolidBrush(fg);
        g.FillEllipse(dot, 12, Height / 2 - 3, 6, 6);
        TextRenderer.DrawText(g, Text, Font, new Rectangle(24, 0, Width - 30, Height), fg,
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine |
            TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
    }
}

public enum PillTone
{
    Idle,
    Running,
    Success,
    Warning,
    Error,
}

public sealed class MetricCard : Control
{
    private string _title = "";
    private string _value = "--";
    private string _unit = "";
    private string _subText = "";
    private Color _tone = Theme.Accent;

    public string Title
    {
        get => _title;
        set { _title = value; Invalidate(); }
    }

    public string Value
    {
        get => _value;
        set { _value = value; Invalidate(); }
    }

    public string Unit
    {
        get => _unit;
        set { _unit = value; Invalidate(); }
    }

    public string SubText
    {
        get => _subText;
        set { _subText = value; Invalidate(); }
    }

    public Color Tone
    {
        get => _tone;
        set { _tone = value; Invalidate(); }
    }

    public MetricCard()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw |
                 ControlStyles.SupportsTransparentBackColor, true);
        BackColor = Color.Transparent;
        Font = Theme.Font(9f);
        MinimumSize = new Size(120, 96);
    }

    protected override void OnPaint(PaintEventArgs pevent)
    {
        var g = pevent.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var s = DeviceDpi / 96f;
        var rect = new RectangleF(0.5f, 0.5f, Math.Max(1, Width - 1), Math.Max(1, Height - 1));
        Theme.FillRoundRect(g, rect, 13 * s, Theme.Surface);
        Theme.DrawRoundRect(g, rect, 13 * s, Theme.Border);

        using var accentBrush = new LinearGradientBrush(
            new RectangleF(Width - 4 * s, 16 * s, 3 * s, 34 * s),
            _tone, Theme.Alpha(_tone, 20), LinearGradientMode.Vertical);
        g.FillRectangle(accentBrush, Width - 4 * s, 16 * s, 3 * s, 34 * s);

        TextRenderer.DrawText(g, _title, Theme.Font(9f), new Rectangle((int)(16 * s), (int)(12 * s), Width - 30, 20),
            Theme.Muted, TextFormatFlags.Left | TextFormatFlags.SingleLine | TextFormatFlags.NoPrefix);

        var valueRect = new Rectangle((int)(16 * s), (int)(34 * s), Width - 30, (int)(38 * s));
        TextRenderer.DrawText(g, _value, Theme.Font(23f, FontStyle.Bold), valueRect, _tone,
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine |
            TextFormatFlags.NoPrefix);

        if (!string.IsNullOrWhiteSpace(_unit))
        {
            var valueWidth = TextRenderer.MeasureText(_value, Theme.Font(23f, FontStyle.Bold)).Width;
            var unitRect = new Rectangle((int)(16 * s) + valueWidth + 5, (int)(45 * s), Width - valueWidth - 36, 20);
            TextRenderer.DrawText(g, _unit, Theme.Font(8.8f, FontStyle.Bold), unitRect, Theme.Alpha(_tone, 210),
                TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine |
                TextFormatFlags.NoPrefix);
        }

        TextRenderer.DrawText(g, _subText, Theme.Font(8.4f),
            new Rectangle((int)(16 * s), Height - (int)(28 * s), Width - 28, 20), Theme.Faint,
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine |
            TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
    }
}

public sealed class RoundedPanel : Panel
{
    private int _cornerRadius = 15;
    private Color _borderColor = Theme.Border;
    private Color _fillColor = Theme.Surface;

    public int CornerRadius
    {
        get => _cornerRadius;
        set { _cornerRadius = value; UpdateRegion(); Invalidate(); }
    }

    public Color BorderColor
    {
        get => _borderColor;
        set { _borderColor = value; Invalidate(); }
    }

    public Color FillColor
    {
        get => _fillColor;
        set
        {
            _fillColor = value;
            BackColor = value;
            Invalidate();
        }
    }

    public RoundedPanel()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        BackColor = Theme.Surface;
        Padding = new Padding(18);
    }

    protected override void OnResize(EventArgs eventargs)
    {
        base.OnResize(eventargs);
        UpdateRegion();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        var rect = new RectangleF(0.5f, 0.5f, Math.Max(1, Width - 1), Math.Max(1, Height - 1));
        Theme.DrawRoundRect(e.Graphics, rect, _cornerRadius, _borderColor);
    }

    private void UpdateRegion()
    {
        if (Width <= 0 || Height <= 0)
        {
            return;
        }

        using var path = Theme.RoundRect(new RectangleF(0, 0, Width, Height), _cornerRadius);
        var region = new Region(path);
        var old = Region;
        Region = region;
        old?.Dispose();
    }
}

public sealed class LogoControl : Control
{
    public LogoControl()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw |
                 ControlStyles.SupportsTransparentBackColor, true);
        Size = new Size(42, 42);
        BackColor = Color.Transparent;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        using var brush = new LinearGradientBrush(ClientRectangle, Color.FromArgb(70, 220, 255),
            Color.FromArgb(38, 100, 255), 130f);
        using var path = Theme.RoundRect(new RectangleF(0, 0, Width - 1, Height - 1), 11);
        g.FillPath(brush, path);
        using var pen = new Pen(Theme.Ink, 3.3f)
        {
            StartCap = LineCap.Round,
            EndCap = LineCap.Round,
            LineJoin = LineJoin.Round,
        };
        var pts = new[]
        {
            new PointF(Width * 0.19f, Height * 0.53f),
            new PointF(Width * 0.36f, Height * 0.53f),
            new PointF(Width * 0.46f, Height * 0.28f),
            new PointF(Width * 0.57f, Height * 0.73f),
            new PointF(Width * 0.67f, Height * 0.44f),
            new PointF(Width * 0.81f, Height * 0.44f),
        };
        g.DrawLines(pen, pts);
    }
}

public sealed class DarkTextBox : Control
{
    private readonly TextBox _inner;
    private bool _focused;

    [System.Diagnostics.CodeAnalysis.AllowNull]
    public override string Text
    {
        get => _inner.Text;
        set
        {
            value ??= "";
            if (_inner.Text != value)
            {
                _inner.Text = value;
            }
        }
    }

    public string PlaceholderText
    {
        get => _inner.PlaceholderText;
        set => _inner.PlaceholderText = value;
    }

    public bool ReadOnly
    {
        get => _inner.ReadOnly;
        set
        {
            _inner.ReadOnly = value;
            _inner.BackColor = value ? Theme.Surface2 : Theme.Input;
        }
    }

    public TextBox Inner => _inner;

    public DarkTextBox()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        BackColor = Theme.Input;
        _inner = new TextBox
        {
            BorderStyle = BorderStyle.None,
            BackColor = Theme.Input,
            ForeColor = Theme.Text,
            Font = Theme.Font(9.5f),
            PlaceholderText = "",
        };
        Padding = new Padding(10, 0, 8, 0);
        Height = 36;
        _inner.TextChanged += (_, _) =>
        {
            if (base.Text != _inner.Text)
            {
                base.Text = _inner.Text;
            }
        };
        _inner.GotFocus += (_, _) => { _focused = true; Invalidate(); };
        _inner.LostFocus += (_, _) => { _focused = false; Invalidate(); };
        Controls.Add(_inner);
        Click += (_, _) => _inner.Focus();
        Cursor = Cursors.IBeam;
    }

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        if (_inner == null || _inner.IsDisposed)
        {
            return;
        }

        _inner.SetBounds(Padding.Left, Math.Max(0, (Height - _inner.Height) / 2),
            Math.Max(10, Width - Padding.Left - Padding.Right), _inner.Height);
        if (Width > 0 && Height > 0)
        {
            using var path = Theme.RoundRect(new RectangleF(0, 0, Width, Height), 7);
            var old = Region;
            Region = new Region(path);
            old?.Dispose();
        }
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        using var brush = new SolidBrush(ReadOnly ? Theme.Surface2 : Theme.Input);
        e.Graphics.FillRectangle(brush, ClientRectangle);
        var border = _focused ? Theme.Accent : Theme.Border;
        Theme.DrawRoundRect(e.Graphics, new RectangleF(0.5f, 0.5f, Width - 1, Height - 1), 7, border);
    }
}

public sealed class DarkComboBox : ComboBox
{
    public DarkComboBox()
    {
        DrawMode = DrawMode.OwnerDrawFixed;
        DropDownStyle = ComboBoxStyle.DropDownList;
        FlatStyle = FlatStyle.Flat;
        BackColor = Theme.Input;
        ForeColor = Theme.Text;
        Font = Theme.Font(9.5f);
        ItemHeight = 26;
        IntegralHeight = false;
        DropDownHeight = 240;
        SetStyle(ControlStyles.OptimizedDoubleBuffer, true);
    }

    protected override void OnDrawItem(DrawItemEventArgs e)
    {
        if (e.Index < 0)
        {
            return;
        }

        var selected = (e.State & DrawItemState.Selected) == DrawItemState.Selected;
        using var bg = new SolidBrush(selected ? Theme.Surface2 : Theme.Input);
        e.Graphics.FillRectangle(bg, e.Bounds);
        var text = GetItemText(Items[e.Index]);
        TextRenderer.DrawText(e.Graphics, text, Font, new Rectangle(e.Bounds.X + 8, e.Bounds.Y, e.Bounds.Width - 12, e.Bounds.Height),
            selected ? Theme.Accent : Theme.Text,
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine |
            TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
    }
}

public sealed class DarkCheckBox : CheckBox
{
    public DarkCheckBox()
    {
        SetStyle(ControlStyles.SupportsTransparentBackColor, true);
        FlatStyle = FlatStyle.Flat;
        BackColor = Color.Transparent;
        ForeColor = Theme.Muted;
        Font = Theme.Font(9.2f);
        AutoSize = true;
        Cursor = Cursors.Hand;
    }
}

public enum ChartMode
{
    Fps,
    FrameTime,
    Memory,
    Cpu,
}

public sealed class TimelineChart : Control
{
    private List<TimelinePoint> _points = new();
    private int _refreshHz;
    private int _hoverIndex = -1;

    public ChartMode Mode { get; set; } = ChartMode.FrameTime;
    public string OverlayText { get; set; } = "";
    public string OverlaySubtext { get; set; } = "";

    public TimelineChart()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        BackColor = Theme.Surface;
        Font = Theme.Font(8.5f);
        Cursor = Cursors.Cross;
    }

    public void SetData(IReadOnlyList<TimelinePoint> points, int refreshHz)
    {
        _points = points.ToList();
        _refreshHz = refreshHz;
        _hoverIndex = -1;
        Invalidate();
    }

    public void Clear()
    {
        _points.Clear();
        _hoverIndex = -1;
        Invalidate();
    }

    protected override void OnMouseMove(MouseEventArgs e)
    {
        base.OnMouseMove(e);
        if (_points.Count == 0 || !string.IsNullOrEmpty(OverlayText))
        {
            return;
        }

        var (padL, padR, _, _, w) = Metrics();
        var plotWidth = Math.Max(1, w - padL - padR);
        if (e.X < padL || e.X > w - padR)
        {
            if (_hoverIndex != -1)
            {
                _hoverIndex = -1;
                Invalidate();
            }

            return;
        }

        var index = (int)Math.Round((e.X - padL) / (double)plotWidth * (_points.Count - 1));
        index = Math.Clamp(index, 0, _points.Count - 1);
        if (index != _hoverIndex)
        {
            _hoverIndex = index;
            Invalidate();
        }
    }

    protected override void OnMouseLeave(EventArgs e)
    {
        base.OnMouseLeave(e);
        if (_hoverIndex != -1)
        {
            _hoverIndex = -1;
            Invalidate();
        }
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Theme.Surface);

        if (!string.IsNullOrEmpty(OverlayText))
        {
            DrawOverlay(g);
            return;
        }

        if (_points.Count == 0)
        {
            TextRenderer.DrawText(g, "选择窗口并开始采集后，这里会显示实时曲线", Theme.Font(10f),
                ClientRectangle, Theme.Faint,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
            return;
        }

        DrawChart(g);
    }

    private void DrawOverlay(Graphics g)
    {
        var card = new RectangleF(Width / 2f - 150, Height / 2f - 52, 300, 104);
        Theme.FillRoundRect(g, card, 16, Theme.Surface2);
        Theme.DrawRoundRect(g, card, 16, Theme.Alpha(Theme.Accent, 60));
        TextRenderer.DrawText(g, OverlayText, Theme.Font(30f, FontStyle.Bold),
            new Rectangle((int)card.X, (int)card.Y + 10, (int)card.Width, 52), Theme.Accent,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
        if (!string.IsNullOrWhiteSpace(OverlaySubtext))
        {
            TextRenderer.DrawText(g, OverlaySubtext, Theme.Font(9f),
                new Rectangle((int)card.X + 12, (int)card.Y + 62, (int)card.Width - 24, 28), Theme.Muted,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine |
                TextFormatFlags.EndEllipsis);
        }
    }

    private (int PadL, int PadR, int PadT, int PadB, int Width) Metrics()
    {
        var s = DeviceDpi / 96f;
        return ((int)(48 * s), (int)(14 * s), (int)(14 * s), (int)(28 * s), Width);
    }

    private void DrawChart(Graphics g)
    {
        var s = DeviceDpi / 96f;
        var (padL, padR, padT, padB, width) = Metrics();
        var height = Height;
        var plotW = Math.Max(10, width - padL - padR);
        var plotH = Math.Max(10, height - padT - padB);
        var n = _points.Count;

        var values = BuildSeries(out var series, out var axisMax, out var threshold, out var thresholdLabel, out var unit);
        if (series.Count == 0)
        {
            return;
        }

        float X(int index) => padL + (n <= 1 ? plotW / 2f : index / (float)(n - 1) * plotW);
        float Y(double value) => padT + plotH - (float)Math.Clamp(value / Math.Max(0.0001, axisMax), 0, 1) * plotH;

        using var gridPen = new Pen(Theme.BorderSoft, 1f);
        for (var i = 0; i <= 4; i++)
        {
            var y = padT + plotH * i / 4f;
            g.DrawLine(gridPen, padL, y, width - padR, y);
            var label = (axisMax * (4 - i) / 4.0).ToString(axisMax >= 100 ? "0" : "0.#");
            TextRenderer.DrawText(g, label, Theme.Font(8f), new Rectangle(0, (int)y - 8, padL - 8, 16),
                Theme.Faint, TextFormatFlags.Right | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
        }

        var labels = Math.Min(7, n);
        for (var i = 0; i < labels; i++)
        {
            var index = labels <= 1 ? 0 : (int)Math.Round(i * (n - 1) / (double)(labels - 1));
            var x = X(index);
            var text = _points[index].Second + "s";
            TextRenderer.DrawText(g, text, Theme.Font(8f), new Rectangle((int)x - 28, height - padB + 5, 56, 16),
                Theme.Faint, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
        }

        var warmupEnd = _points.FindIndex(p => !p.IsWarmup);
        if (warmupEnd > 0)
        {
            var x = X(warmupEnd);
            using var warmBrush = new SolidBrush(Theme.Alpha(Theme.Orange, 12));
            g.FillRectangle(warmBrush, padL, padT, Math.Max(0, x - padL), plotH);
            using var warmPen = new Pen(Theme.Alpha(Theme.Orange, 70)) { DashStyle = DashStyle.Dash };
            g.DrawLine(warmPen, x, padT, x, padT + plotH);
            TextRenderer.DrawText(g, "预热", Theme.Font(8f), new Rectangle((int)x + 6, padT + 4, 50, 16),
                Theme.Orange, TextFormatFlags.Left | TextFormatFlags.SingleLine);
        }

        if (threshold.HasValue && threshold.Value > 0 && threshold.Value < axisMax)
        {
            var y = Y(threshold.Value);
            using var thresholdPen = new Pen(Theme.Alpha(Theme.Green, 100)) { DashStyle = DashStyle.Dash };
            g.DrawLine(thresholdPen, padL, y, width - padR, y);
            if (!string.IsNullOrWhiteSpace(thresholdLabel))
            {
                var size = TextRenderer.MeasureText(thresholdLabel, Theme.Font(8f));
                TextRenderer.DrawText(g, thresholdLabel, Theme.Font(8f),
                    new Rectangle(width - padR - size.Width - 8, (int)y - 17, size.Width + 4, 15),
                    Theme.Alpha(Theme.Green, 180),
                    TextFormatFlags.Right | TextFormatFlags.SingleLine | TextFormatFlags.NoPrefix);
            }
        }

        foreach (var item in series)
        {
            DrawSeries(g, item, X, Y, padL, width - padR, padT + plotH, n);
        }

        if (_hoverIndex >= 0 && _hoverIndex < _points.Count)
        {
            DrawHover(g, X(_hoverIndex), padT, plotH, width, padR, unit);
        }
    }

    private (double[] Values, List<Series> Series, double AxisMax, double? Threshold, string ThresholdLabel, string Unit) BuildSeries(
        out List<Series> series, out double axisMax, out double? threshold, out string thresholdLabel, out string unit)
    {
        var n = _points.Count;
        series = new List<Series>();
        var targetFrameMs = _refreshHz > 0 ? 1000.0 / _refreshHz : 16.6667;
        double maxValue = 0;
        unit = "";

        switch (Mode)
        {
            case ChartMode.Fps:
                unit = "FPS";
                series.Add(new Series("FPS", Theme.Accent, true,
                    _points.Select(p => p.Fps > 0 ? p.Fps : (double?)null).ToArray()));
                maxValue = _points.Max(p => p.Fps);
                maxValue = Math.Max(maxValue, Math.Max(60, _refreshHz));
                axisMax = NiceCeil(maxValue * 1.12, 30);
                threshold = _refreshHz > 0 ? _refreshHz : null;
                thresholdLabel = _refreshHz > 0 ? $"{_refreshHz} Hz" : "";
                break;
            case ChartMode.FrameTime:
                unit = "ms";
                series.Add(new Series("平均", Theme.Accent, true,
                    _points.Select(p => p.AvgFrameTimeMs > 0 ? p.AvgFrameTimeMs : (double?)null).ToArray()));
                series.Add(new Series("P99", Theme.Red, false,
                    _points.Select(p => p.P99FrameTimeMs > 0 ? p.P99FrameTimeMs : (double?)null).ToArray()));
                maxValue = _points.Max(p => Math.Max(p.AvgFrameTimeMs, p.P99FrameTimeMs));
                maxValue = Math.Max(maxValue, targetFrameMs * 2.2);
                axisMax = NiceCeil(maxValue * 1.1, 10);
                threshold = targetFrameMs;
                thresholdLabel = $"{targetFrameMs:0.0} ms";
                break;
            case ChartMode.Memory:
                unit = "MB";
                series.Add(new Series("工作集", Theme.Violet, true,
                    _points.Select(p => p.WorkingSetMB > 0 ? p.WorkingSetMB : (double?)null).ToArray()));
                series.Add(new Series("私有", Theme.Blue, false,
                    _points.Select(p => p.PrivateMB > 0 ? p.PrivateMB : (double?)null).ToArray()));
                maxValue = _points.Max(p => Math.Max(p.WorkingSetMB, p.PrivateMB));
                axisMax = NiceCeil(maxValue * 1.1, maxValue < 128 ? 32 : 128);
                threshold = null;
                thresholdLabel = "";
                break;
            default:
                unit = "%";
                series.Add(new Series("CPU", Theme.Orange, true,
                    _points.Select(p => p.CpuPercent >= 0 ? p.CpuPercent : (double?)null).ToArray()));
                axisMax = 100;
                threshold = null;
                thresholdLabel = "";
                break;
        }

        if (axisMax <= 0 || double.IsNaN(axisMax) || double.IsInfinity(axisMax))
        {
            axisMax = 100;
        }

        return (Array.Empty<double>(), series, axisMax, threshold, thresholdLabel, unit);
    }

    private void DrawSeries(Graphics g, Series item, Func<int, float> xAt, Func<double, float> yAt,
        int left, int right, int bottom, int n)
    {
        var points = item.Values;
        using var linePen = new Pen(item.Color, item.Fill ? 2.2f : 1.4f)
        {
            LineJoin = LineJoin.Round,
            StartCap = LineCap.Round,
            EndCap = LineCap.Round,
        };

        var path = new GraphicsPath();
        var fillPath = new GraphicsPath();
        var started = false;
        var segmentStartX = 0f;
        var segmentLastX = 0f;
        var segmentValues = new List<(float X, float Y)>();

        void FlushSegment()
        {
            if (!started)
            {
                return;
            }

            if (item.Fill && segmentValues.Count > 1)
            {
                fillPath.AddLine(segmentValues[^1].X, segmentValues[^1].Y, segmentValues[^1].X, bottom);
                fillPath.AddLine(segmentValues[^1].X, bottom, segmentValues[0].X, bottom);
                fillPath.CloseFigure();
            }

            started = false;
            segmentValues.Clear();
        }

        for (var i = 0; i < n; i++)
        {
            var value = points[i];
            if (!value.HasValue)
            {
                FlushSegment();
                continue;
            }

            var x = xAt(i);
            var y = yAt(value.Value);
            if (!started)
            {
                path.StartFigure();
                started = true;
                segmentStartX = x;
            }
            else
            {
                path.AddLine(segmentLastX, segmentValues[^1].Y, x, y);
            }

            segmentValues.Add((x, y));
            segmentLastX = x;
        }

        FlushSegment();
        g.DrawPath(linePen, path);

        if (item.Fill)
        {
            using var fillBrush = new LinearGradientBrush(
                new Rectangle(left, 0, Math.Max(1, right - left), Math.Max(1, bottom)),
                Theme.Alpha(item.Color, 42), Theme.Alpha(item.Color, 2), LinearGradientMode.Vertical);
            g.FillPath(fillBrush, fillPath);
        }

        path.Dispose();
        fillPath.Dispose();
    }

    private void DrawHover(Graphics g, float x, int top, int height, int width, int padR, string unit)
    {
        var point = _points[_hoverIndex];
        using var pen = new Pen(Theme.Alpha(Theme.Text, 40)) { DashStyle = DashStyle.Dot };
        g.DrawLine(pen, x, top, x, top + height);

        var lines = Mode switch
        {
            ChartMode.Fps => new[] { $"{point.Second}s", $"FPS  {point.Fps:0.0}", $"帧时间  {point.AvgFrameTimeMs:0.00} ms" },
            ChartMode.FrameTime => new[] { $"{point.Second}s", $"平均  {point.AvgFrameTimeMs:0.00} ms", $"P99  {point.P99FrameTimeMs:0.00} ms" },
            ChartMode.Memory => new[] { $"{point.Second}s", $"工作集  {point.WorkingSetMB:0} MB", $"私有  {point.PrivateMB:0} MB" },
            _ => new[] { $"{point.Second}s", $"CPU  {point.CpuPercent:0.0} %", $"帧数  {point.Frames}" },
        };

        var boxW = 166;
        var boxH = 68;
        var boxX = x + 12 + boxW > width - padR ? (int)x - boxW - 12 : (int)x + 12;
        boxX = Math.Max(8, boxX);
        var boxY = top + 8;
        var box = new Rectangle(boxX, boxY, boxW, boxH);
        Theme.FillRoundRect(g, box, 8, Theme.Surface2);
        Theme.DrawRoundRect(g, box, 8, Theme.Border);
        for (var i = 0; i < lines.Length; i++)
        {
            TextRenderer.DrawText(g, lines[i], i == 0 ? Theme.Font(8.3f, FontStyle.Bold) : Theme.Font(8.3f),
                new Rectangle(box.X + 10, box.Y + 6 + i * 19, box.Width - 20, 17),
                i == 0 ? Theme.Accent : Theme.Muted,
                TextFormatFlags.Left | TextFormatFlags.SingleLine | TextFormatFlags.NoPrefix);
        }
    }

    private static double NiceCeil(double value, double step)
    {
        if (value <= 0 || double.IsNaN(value) || double.IsInfinity(value))
        {
            return step;
        }

        return Math.Ceiling(value / step) * step;
    }

    private sealed record Series(string Name, Color Color, bool Fill, double?[] Values);
}
