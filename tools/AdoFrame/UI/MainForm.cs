using AdoFrame.Core;
using AdoFrame.Export;

namespace AdoFrame.UI;

public sealed partial class MainForm : Form
{
    private readonly AppSettings _settings;
    private readonly System.Windows.Forms.Timer _uiTimer = new() { Interval = 100 };
    private readonly System.Windows.Forms.Timer _countdownTimer = new() { Interval = 1000 };
    private readonly System.Windows.Forms.Timer _pickTimer = new() { Interval = 50 };

    private BenchmarkRunner? _runner;
    private SessionResult? _lastResult;
    private WindowInfo? _selectedWindow;
    private List<WindowInfo> _allWindows = new();
    private bool _suspendSelection;
    private bool _running;
    private bool _countdown;
    private bool _picking;
    private bool _pickMouseWasDown;
    private IntPtr _pendingPickHandle = IntPtr.Zero;
    private DateTime _pickDeadline;
    private int _countdownRemaining;
    private bool _stopInProgress;
    private bool _appNameDirty;
    private bool _suppressAppName;
    private long _lastChartTick;
    private string? _presentMonPath;
    private SystemInfo? _systemInfo;

    private StatusPill _statusPill = null!;
    private Label _headerInfo = null!;
    private DarkTextBox _searchBox = null!;
    private DataGridView _windowGrid = null!;
    private AccentButton _refreshButton = null!;
    private AccentButton _pickButton = null!;
    private Label _selectedTitleLabel = null!;
    private Label _selectedMetaLabel = null!;
    private DarkComboBox _modeCombo = null!;
    private Label _modeHint = null!;
    private DarkTextBox _durationBox = null!;
    private DarkTextBox _warmupBox = null!;
    private DarkTextBox _maxFrameBox = null!;
    private DarkTextBox _delayBox = null!;
    private DarkTextBox _outputBox = null!;
    private DarkTextBox _appBox = null!;
    private DarkTextBox _testerBox = null!;
    private DarkTextBox _sceneBox = null!;
    private DarkTextBox _notesBox = null!;
    private DarkCheckBox _autoExportCheck = null!;
    private DarkCheckBox _aggregateCheck = null!;
    private DarkComboBox _globalHotkeyCombo = null!;
    private Label _hotkeyHint = null!;
    private AccentButton _startButton = null!;
    private AccentButton _browseButton = null!;
    private Label _leftHint = null!;

    private Label _targetTitleLabel = null!;
    private Label _targetMetaLabel = null!;
    private Label _elapsedLabel = null!;
    private MetricCard _fpsCard = null!;
    private MetricCard _lowCard = null!;
    private MetricCard _memoryCard = null!;
    private MetricCard _cpuCard = null!;
    private TimelineChart _chart = null!;
    private Label _legendLabel = null!;
    private ChipButton[] _chips = Array.Empty<ChipButton>();
    private AccentButton _exportCsvButton = null!;
    private AccentButton _exportHtmlButton = null!;
    private AccentButton _openFolderButton = null!;
    private Label _outputPathLabel = null!;
    private RichTextBox _logBox = null!;
    private Label _statsNote = null!;
    private readonly Dictionary<string, Label> _statValues = new(StringComparer.Ordinal);

    public MainForm()
    {
        _settings = AppSettings.Load();
        _presentMonPath = AppPaths.FindPresentMon(_settings.PresentMonPath);

        Text = "AdoFrame · ADOFIA 二创性能采集";
        StartPosition = FormStartPosition.CenterScreen;
        Size = new Size(1400, 840);
        MinimumSize = new Size(1100, 700);
        BackColor = Theme.Bg;
        ForeColor = Theme.Text;
        Font = Theme.Font(9f);
        AutoScaleMode = AutoScaleMode.Dpi;
        DoubleBuffered = true;
        Icon = Theme.CreateAppIcon();
        KeyPreview = true;

        BuildUi();
        LoadSettingsIntoControls();
        UpdateHeaderInfo();
        RefreshWindows(initial: true);

        _uiTimer.Tick += (_, _) => UiTick();
        _countdownTimer.Tick += (_, _) => CountdownTick();
        _pickTimer.Tick += (_, _) => PickTick();
        _uiTimer.Start();

        Shown += (_, _) =>
        {
            ConstrainToWorkingArea();
            NativeMethods.TryEnableDarkTitleBar(Handle);
            UpdateGlobalHotkeyRegistration();
            AppendLog("已就绪。选择一个窗口，点击开始采集。浏览器/Electron 会自动使用窗口级捕获。", LogLevel.Info);
            if (string.IsNullOrWhiteSpace(_presentMonPath))
            {
                AppendLog("未找到 PresentMon.exe，自动模式下的原生游戏会回退到窗口捕获。", LogLevel.Warning);
            }
        };

        FormClosing += OnFormClosing;
        KeyDown += OnFormKeyDown;
    }

    private void BuildUi()
    {
        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 2,
            BackColor = Theme.Bg,
            Margin = Padding.Empty,
            Padding = Padding.Empty,
        };
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 88));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        root.Controls.Add(BuildHeader(), 0, 0);

        var content = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 1,
            BackColor = Theme.Bg,
            Padding = new Padding(24, 12, 24, 20),
            Margin = Padding.Empty,
        };
        content.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 400));
        content.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        content.Controls.Add(BuildLeftPanel(), 0, 0);
        content.Controls.Add(BuildRightPanel(), 1, 0);
        root.Controls.Add(content, 0, 1);
        Controls.Add(root);
    }

    private Panel BuildHeader()
    {
        var header = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Theme.Bg,
            Margin = Padding.Empty,
        };

        var logo = new LogoControl { Location = new Point(26, 20) };
        var title = new Label
        {
            Text = "AdoFrame",
            Font = Theme.Font(20f, FontStyle.Bold),
            ForeColor = Theme.Text,
            AutoSize = true,
            BackColor = Color.Transparent,
            Location = new Point(80, 15),
        };
        var subtitle = new Label
        {
            Text = "ADOFIA 二创性能采集 · 任意窗口 · 帧率 / 帧时间 / 1% Low / 内存 / CPU",
            Font = Theme.Font(8.8f),
            ForeColor = Theme.Muted,
            AutoSize = true,
            BackColor = Color.Transparent,
            Location = new Point(82, 47),
        };

        _statusPill = new StatusPill { Text = "待机", Tone = PillTone.Idle };
        _headerInfo = new Label
        {
            Text = "Windows 10 2004+ · PresentMon 2.6.0",
            Font = Theme.Font(8.2f),
            ForeColor = Theme.Faint,
            AutoSize = true,
            BackColor = Color.Transparent,
            TextAlign = ContentAlignment.MiddleRight,
        };

        header.Controls.Add(logo);
        header.Controls.Add(title);
        header.Controls.Add(subtitle);
        header.Controls.Add(_statusPill);
        header.Controls.Add(_headerInfo);

        var divider = new Panel { Dock = DockStyle.Bottom, Height = 1, BackColor = Theme.BorderSoft };
        header.Controls.Add(divider);

        void PositionHeaderItems()
        {
            _statusPill.Location = new Point(Math.Max(0, header.ClientSize.Width - _statusPill.Width - 28), 19);
            _headerInfo.Location = new Point(Math.Max(0, header.ClientSize.Width - _headerInfo.Width - 30), 54);
        }

        header.Resize += (_, _) => PositionHeaderItems();
        _statusPill.SizeChanged += (_, _) => PositionHeaderItems();
        _headerInfo.SizeChanged += (_, _) => PositionHeaderItems();
        PositionHeaderItems();
        return header;
    }

    private RoundedPanel BuildLeftPanel()
    {
        var card = new RoundedPanel
        {
            Dock = DockStyle.Fill,
            CornerRadius = 16,
            Padding = Padding.Empty,
            Margin = new Padding(0, 0, 14, 0),
        };

        var outer = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 2,
            BackColor = Theme.Surface,
            Margin = Padding.Empty,
            Padding = Padding.Empty,
        };
        outer.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        outer.RowStyles.Add(new RowStyle(SizeType.Absolute, 80));

        var scroll = new Panel
        {
            Dock = DockStyle.Fill,
            AutoScroll = true,
            BackColor = Theme.Surface,
            Padding = new Padding(16, 12, 8, 6),
        };

        var flow = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            Width = 332,
            AutoSize = true,
            AutoSizeMode = AutoSizeMode.GrowAndShrink,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            BackColor = Theme.Surface,
            Margin = Padding.Empty,
        };
        scroll.Controls.Add(flow);

        void AddFlow(Control control, int bottom = 8)
        {
            control.Margin = new Padding(0, 0, 0, bottom);
            if (control.Width <= 0)
            {
                control.Width = 332;
            }

            flow.Controls.Add(control);
        }

        AddFlow(MakeSection("01  目标窗口"), 4);
        _searchBox = new DarkTextBox
        {
            Width = 332,
            PlaceholderText = "搜索窗口标题或进程名…",
        };
        _searchBox.Inner.TextChanged += (_, _) => ApplyWindowFilter();
        _searchBox.Inner.KeyUp += (_, _) => ApplyWindowFilter();
        AddFlow(_searchBox, 8);

        _windowGrid = BuildWindowGrid();
        AddFlow(_windowGrid, 8);

        var buttonRow = new TableLayoutPanel
        {
            Width = 332,
            Height = 34,
            ColumnCount = 2,
            RowCount = 1,
            BackColor = Theme.Surface,
            Margin = Padding.Empty,
        };
        buttonRow.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        buttonRow.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        _refreshButton = new AccentButton
        {
            Text = "刷新列表 (F5)",
            Variant = ButtonVariant.Secondary,
            Dock = DockStyle.Fill,
            Height = 34,
            Margin = new Padding(0, 0, 5, 0),
        };
        _refreshButton.Click += (_, _) => RefreshWindows();
        _pickButton = new AccentButton
        {
            Text = "拾取窗口",
            Variant = ButtonVariant.Ghost,
            Dock = DockStyle.Fill,
            Height = 34,
            Margin = new Padding(5, 0, 0, 0),
        };
        _pickButton.Click += (_, _) => StartWindowPick();
        buttonRow.Controls.Add(_refreshButton, 0, 0);
        buttonRow.Controls.Add(_pickButton, 1, 0);
        AddFlow(buttonRow, 8);

        var selectedPanel = new RoundedPanel
        {
            Width = 332,
            Height = 56,
            CornerRadius = 9,
            FillColor = Theme.Surface2,
            BorderColor = Theme.BorderSoft,
            Padding = new Padding(10, 6, 10, 5),
            Margin = Padding.Empty,
        };
        _selectedTitleLabel = new Label
        {
            Dock = DockStyle.Top,
            Height = 21,
            Font = Theme.Font(9.2f, FontStyle.Bold),
            ForeColor = Theme.Text,
            AutoSize = false,
            AutoEllipsis = true,
            Text = "尚未选择窗口",
        };
        _selectedMetaLabel = new Label
        {
            Dock = DockStyle.Bottom,
            Height = 20,
            Font = Theme.Font(8.2f),
            ForeColor = Theme.Faint,
            AutoSize = false,
            AutoEllipsis = true,
            Text = "从列表选择，或点击“拾取窗口”",
        };
        selectedPanel.Controls.Add(_selectedTitleLabel);
        selectedPanel.Controls.Add(_selectedMetaLabel);
        AddFlow(selectedPanel, 10);

        AddFlow(MakeSection("02  采集设置"), 4);

        _modeCombo = new DarkComboBox { Width = 332, Height = 34 };
        _modeCombo.Items.AddRange(new object[]
        {
            "自动（推荐）",
            "窗口捕获 WGC（任意窗口）",
            "PresentMon（原生游戏）",
        });
        _modeCombo.SelectedIndexChanged += (_, _) => UpdateModeHint();
        AddFlow(BuildField("采集方式", _modeCombo), 2);

        _modeHint = new Label
        {
            Width = 332,
            Height = 42,
            AutoSize = false,
            Font = Theme.Font(8.1f),
            ForeColor = Theme.Faint,
            BackColor = Color.Transparent,
            Text = "",
        };
        AddFlow(_modeHint, 8);

        _durationBox = NewInput("60");
        _warmupBox = NewInput("3");
        _maxFrameBox = NewInput("1000");
        _delayBox = NewInput("3");
        AddFlow(BuildTwoFields(
            "采集时长（秒，0=手动）", _durationBox,
            "预热（秒）", _warmupBox), 8);
        AddFlow(BuildTwoFields(
            "帧时间上限（ms，0=不限）", _maxFrameBox,
            "开始前倒计时（秒）", _delayBox), 8);

        _autoExportCheck = new DarkCheckBox
        {
            Text = "采集结束后自动导出 CSV / HTML",
            Checked = true,
            Width = 332,
            Height = 28,
        };
        AddFlow(_autoExportCheck, 2);

        _aggregateCheck = new DarkCheckBox
        {
            Text = "内存/CPU 统计整个进程树（浏览器/Electron 推荐）",
            Checked = true,
            Width = 332,
            Height = 28,
        };
        AddFlow(_aggregateCheck, 8);

        _globalHotkeyCombo = new DarkComboBox
        {
            Width = 332,
            Height = 34,
        };
        _globalHotkeyCombo.Items.AddRange(new object[]
        {
            "关闭（仅窗口内 F9）",
            "Ctrl+Alt+F9",
            "Ctrl+Shift+F9",
            "Ctrl+Alt+F10",
            "Ctrl+Shift+F10",
        });
        _globalHotkeyCombo.SelectedIndexChanged += (_, _) =>
        {
            if (IsHandleCreated)
            {
                UpdateGlobalHotkeyRegistration();
            }
        };
        AddFlow(BuildField("全局停止热键（只停止，不开始）", _globalHotkeyCombo), 2);

        _hotkeyHint = new Label
        {
            Width = 332,
            Height = 32,
            AutoSize = false,
            Font = Theme.Font(8.1f),
            ForeColor = Theme.Faint,
            BackColor = Color.Transparent,
            Text = "默认关闭；需要时手动启用。\n只注册选中的组合，不拦截 F5/F12 等浏览器快捷键。",
        };
        AddFlow(_hotkeyHint, 8);

        _outputBox = NewInput();
        _browseButton = new AccentButton
        {
            Text = "选择",
            Variant = ButtonVariant.Ghost,
            Height = 34,
            Width = 64,
            Margin = Padding.Empty,
        };
        _browseButton.Click += (_, _) => BrowseOutputDirectory();
        AddFlow(BuildOutputField(), 10);

        AddFlow(MakeSection("03  报告信息"), 4);
        _appBox = NewInput();
        _appBox.TextChanged += (_, _) =>
        {
            if (!_suppressAppName)
            {
                _appNameDirty = true;
            }
        };
        _testerBox = NewInput();
        _sceneBox = NewInput();
        _notesBox = NewInput();
        AddFlow(BuildField("作品名称（留空则用进程名）", _appBox), 8);
        AddFlow(BuildField("测试人", _testerBox), 8);
        AddFlow(BuildField("场景 / 谱面", _sceneBox), 8);
        AddFlow(BuildField("备注", _notesBox), 12);

        outer.Controls.Add(scroll, 0, 0);

        var footer = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Theme.Surface,
            Padding = new Padding(16, 8, 16, 10),
        };
        var footerLayout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 2,
            BackColor = Theme.Surface,
            Margin = Padding.Empty,
            Padding = Padding.Empty,
        };
        footerLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 46));
        footerLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        _startButton = new AccentButton
        {
            Text = "开始采集 (F9)",
            Variant = ButtonVariant.Primary,
            Dock = DockStyle.Fill,
            Height = 46,
            Font = Theme.Font(10.5f, FontStyle.Bold),
            Margin = Padding.Empty,
        };
        _startButton.Click += (_, _) => ToggleSession();
        _leftHint = new Label
        {
            Dock = DockStyle.Fill,
            Text = "F9 开始 / 停止 · F5 刷新 · 浏览器请保持目标标签页活动",
            Font = Theme.Font(7.8f),
            ForeColor = Theme.Faint,
            TextAlign = ContentAlignment.MiddleCenter,
            BackColor = Theme.Surface,
            AutoSize = false,
        };
        footerLayout.Controls.Add(_startButton, 0, 0);
        footerLayout.Controls.Add(_leftHint, 0, 1);
        footer.Controls.Add(footerLayout);
        outer.Controls.Add(footer, 0, 1);
        card.Controls.Add(outer);
        return card;
    }

    private DataGridView BuildWindowGrid()
    {
        var grid = new DataGridView
        {
            Width = 332,
            Height = 150,
            BackgroundColor = Theme.Surface,
            BorderStyle = BorderStyle.None,
            GridColor = Theme.BorderSoft,
            EnableHeadersVisualStyles = false,
            RowHeadersVisible = false,
            AllowUserToAddRows = false,
            AllowUserToDeleteRows = false,
            AllowUserToResizeRows = false,
            AllowUserToResizeColumns = false,
            ReadOnly = true,
            MultiSelect = false,
            SelectionMode = DataGridViewSelectionMode.FullRowSelect,
            AutoGenerateColumns = false,
            AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
            ColumnHeadersHeight = 30,
            ColumnHeadersHeightSizeMode = DataGridViewColumnHeadersHeightSizeMode.DisableResizing,
            RowTemplate = { Height = 28 },
            ScrollBars = ScrollBars.Vertical,
            CellBorderStyle = DataGridViewCellBorderStyle.SingleHorizontal,
            Margin = Padding.Empty,
        };

        grid.ColumnHeadersDefaultCellStyle = new DataGridViewCellStyle
        {
            BackColor = Theme.Surface2,
            ForeColor = Theme.Muted,
            SelectionBackColor = Theme.Surface2,
            SelectionForeColor = Theme.Muted,
            Font = Theme.Font(8.3f, FontStyle.Bold),
            Alignment = DataGridViewContentAlignment.MiddleLeft,
            Padding = new Padding(7, 0, 0, 0),
            WrapMode = DataGridViewTriState.False,
        };
        grid.DefaultCellStyle = new DataGridViewCellStyle
        {
            BackColor = Theme.Surface,
            ForeColor = Theme.Text,
            SelectionBackColor = Color.FromArgb(25, 49, 65),
            SelectionForeColor = Theme.Text,
            Font = Theme.Font(8.7f),
            Padding = new Padding(7, 0, 4, 0),
            WrapMode = DataGridViewTriState.False,
        };
        grid.AlternatingRowsDefaultCellStyle = new DataGridViewCellStyle
        {
            BackColor = Color.FromArgb(13, 21, 30),
            ForeColor = Theme.Text,
            SelectionBackColor = Color.FromArgb(25, 49, 65),
            SelectionForeColor = Theme.Text,
        };

        var titleColumn = new DataGridViewTextBoxColumn
        {
            Name = "Title",
            HeaderText = "窗口标题",
            DataPropertyName = "Title",
            FillWeight = 64,
            MinimumWidth = 130,
            SortMode = DataGridViewColumnSortMode.NotSortable,
        };
        var processColumn = new DataGridViewTextBoxColumn
        {
            Name = "Process",
            HeaderText = "进程",
            DataPropertyName = "ProcessName",
            FillWeight = 23,
            MinimumWidth = 62,
            SortMode = DataGridViewColumnSortMode.NotSortable,
        };
        var kindColumn = new DataGridViewTextBoxColumn
        {
            Name = "Kind",
            HeaderText = "类型",
            DataPropertyName = "KindShortLabel",
            FillWeight = 16,
            MinimumWidth = 54,
            SortMode = DataGridViewColumnSortMode.NotSortable,
        };
        grid.Columns.Add(titleColumn);
        grid.Columns.Add(processColumn);
        grid.Columns.Add(kindColumn);

        grid.SelectionChanged += (_, _) =>
        {
            if (_suspendSelection || grid.SelectedRows.Count == 0)
            {
                return;
            }

            if (grid.SelectedRows[0].DataBoundItem is WindowInfo window)
            {
                SelectWindow(window);
            }
        };
        return grid;
    }

    private RoundedPanel BuildRightPanel()
    {
        var host = new RoundedPanel
        {
            Dock = DockStyle.Fill,
            CornerRadius = 0,
            FillColor = Theme.Bg,
            BorderColor = Theme.Bg,
            Padding = Padding.Empty,
            Margin = Padding.Empty,
        };

        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 5,
            BackColor = Theme.Bg,
            Padding = Padding.Empty,
            Margin = Padding.Empty,
        };
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 54));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 114));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 62));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 190));

        layout.Controls.Add(BuildSessionHeader(), 0, 0);
        layout.Controls.Add(BuildMetricsRow(), 0, 1);
        layout.Controls.Add(BuildChartCard(), 0, 2);
        layout.Controls.Add(BuildExportBar(), 0, 3);
        layout.Controls.Add(BuildBottomCards(), 0, 4);
        host.Controls.Add(layout);
        return host;
    }

    private Panel BuildSessionHeader()
    {
        var panel = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Theme.Bg,
            Margin = Padding.Empty,
            Padding = new Padding(2, 0, 2, 0),
        };
        _targetTitleLabel = new Label
        {
            Text = "尚未选择目标窗口",
            Font = Theme.Font(12.5f, FontStyle.Bold),
            ForeColor = Theme.Text,
            AutoSize = false,
            AutoEllipsis = true,
            Location = new Point(2, 2),
            Size = new Size(640, 25),
            BackColor = Color.Transparent,
        };
        _targetMetaLabel = new Label
        {
            Text = "从左侧列表选择一个窗口，或使用“拾取窗口”",
            Font = Theme.Font(8.4f),
            ForeColor = Theme.Muted,
            AutoSize = false,
            AutoEllipsis = true,
            Location = new Point(2, 29),
            Size = new Size(720, 19),
            BackColor = Color.Transparent,
        };
        _elapsedLabel = new Label
        {
            Text = "00:00.0",
            Font = Theme.MonoFont(12f, FontStyle.Bold),
            ForeColor = Theme.Text,
            TextAlign = ContentAlignment.MiddleRight,
            AutoSize = false,
            Size = new Size(104, 24),
            Anchor = AnchorStyles.Top | AnchorStyles.Right,
            BackColor = Color.Transparent,
        };
        panel.Controls.Add(_targetTitleLabel);
        panel.Controls.Add(_targetMetaLabel);
        panel.Controls.Add(_elapsedLabel);
        panel.Resize += (_, _) =>
        {
            _elapsedLabel.Location = new Point(panel.ClientSize.Width - _elapsedLabel.Width - 2, 4);
            _targetTitleLabel.Width = Math.Max(100, panel.ClientSize.Width - _elapsedLabel.Width - 24);
            _targetMetaLabel.Width = Math.Max(100, panel.ClientSize.Width - 8);
        };
        return panel;
    }

    private TableLayoutPanel BuildMetricsRow()
    {
        var row = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 4,
            RowCount = 1,
            BackColor = Theme.Bg,
            Margin = new Padding(0, 0, 0, 10),
            Padding = Padding.Empty,
        };
        for (var i = 0; i < 4; i++)
        {
            row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25));
        }

        _fpsCard = new MetricCard
        {
            Title = "实时 FPS",
            Unit = "FPS",
            Tone = Theme.Accent,
            Dock = DockStyle.Fill,
            Margin = new Padding(0, 0, 5, 0),
        };
        _lowCard = new MetricCard
        {
            Title = "1% Low",
            Unit = "FPS",
            Tone = Theme.Orange,
            Dock = DockStyle.Fill,
            Margin = new Padding(5, 0, 5, 0),
        };
        _memoryCard = new MetricCard
        {
            Title = "内存工作集",
            Unit = "MB",
            Tone = Theme.Violet,
            Dock = DockStyle.Fill,
            Margin = new Padding(5, 0, 5, 0),
        };
        _cpuCard = new MetricCard
        {
            Title = "CPU 占用",
            Unit = "%",
            Tone = Theme.Green,
            Dock = DockStyle.Fill,
            Margin = new Padding(5, 0, 0, 0),
        };

        row.Controls.Add(_fpsCard, 0, 0);
        row.Controls.Add(_lowCard, 1, 0);
        row.Controls.Add(_memoryCard, 2, 0);
        row.Controls.Add(_cpuCard, 3, 0);
        ResetMetricCards();
        return row;
    }

    private RoundedPanel BuildChartCard()
    {
        var card = new RoundedPanel
        {
            Dock = DockStyle.Fill,
            CornerRadius = 16,
            Padding = new Padding(14, 9, 14, 12),
            Margin = new Padding(0, 0, 0, 10),
        };

        var inner = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 2,
            BackColor = Theme.Surface,
            Margin = Padding.Empty,
            Padding = Padding.Empty,
        };
        inner.RowStyles.Add(new RowStyle(SizeType.Absolute, 38));
        inner.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        var header = new Panel { Dock = DockStyle.Fill, BackColor = Theme.Surface, Margin = Padding.Empty };
        var title = new Label
        {
            Text = "实时曲线",
            Font = Theme.Font(10.5f, FontStyle.Bold),
            ForeColor = Theme.Text,
            AutoSize = true,
            Location = new Point(0, 8),
            BackColor = Color.Transparent,
        };
        _legendLabel = new Label
        {
            Text = "平均帧时间 / P99",
            Font = Theme.Font(8.2f),
            ForeColor = Theme.Faint,
            AutoSize = true,
            TextAlign = ContentAlignment.MiddleRight,
            BackColor = Color.Transparent,
        };

        var chips = new FlowLayoutPanel
        {
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            AutoSize = true,
            AutoSizeMode = AutoSizeMode.GrowAndShrink,
            BackColor = Theme.Surface,
            Margin = Padding.Empty,
        };
        var labels = new[] { "帧率", "帧时间", "内存", "CPU" };
        var modes = new[] { ChartMode.Fps, ChartMode.FrameTime, ChartMode.Memory, ChartMode.Cpu };
        _chips = new ChipButton[labels.Length];
        for (var i = 0; i < labels.Length; i++)
        {
            var mode = modes[i];
            var chip = new ChipButton
            {
                Text = labels[i],
                Width = 58,
                Height = 30,
                Margin = new Padding(4, 0, 0, 0),
                Active = mode == ChartMode.FrameTime,
            };
            chip.Click += (_, _) => SetChartMode(mode);
            _chips[i] = chip;
            chips.Controls.Add(chip);
        }

        header.Controls.Add(title);
        header.Controls.Add(_legendLabel);
        header.Controls.Add(chips);
        header.Resize += (_, _) =>
        {
            chips.Location = new Point(Math.Max(0, header.ClientSize.Width - chips.Width), 3);
            _legendLabel.Location = new Point(
                Math.Max(110, header.ClientSize.Width - chips.Width - _legendLabel.Width - 16), 13);
        };

        _chart = new TimelineChart
        {
            Dock = DockStyle.Fill,
            Mode = ChartMode.FrameTime,
            Margin = Padding.Empty,
        };
        inner.Controls.Add(header, 0, 0);
        inner.Controls.Add(_chart, 0, 1);
        card.Controls.Add(inner);
        return card;
    }

    private RoundedPanel BuildExportBar()
    {
        var card = new RoundedPanel
        {
            Dock = DockStyle.Fill,
            CornerRadius = 12,
            Padding = new Padding(10, 5, 10, 5),
            Margin = new Padding(0, 0, 0, 8),
        };

        var row = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 4,
            RowCount = 1,
            BackColor = Theme.Surface,
            Margin = Padding.Empty,
            Padding = Padding.Empty,
        };
        row.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 96));
        row.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 104));
        row.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 116));
        row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));

        _exportCsvButton = new AccentButton
        {
            Text = "导出 CSV",
            Variant = ButtonVariant.Secondary,
            Height = 34,
            Dock = DockStyle.Fill,
            Enabled = false,
            Margin = new Padding(0, 0, 6, 0),
        };
        _exportCsvButton.Click += (_, _) => ExportCurrent(csv: true);
        _exportHtmlButton = new AccentButton
        {
            Text = "导出 HTML",
            Variant = ButtonVariant.Secondary,
            Height = 34,
            Dock = DockStyle.Fill,
            Enabled = false,
            Margin = new Padding(0, 0, 6, 0),
        };
        _exportHtmlButton.Click += (_, _) => ExportCurrent(csv: false);
        _openFolderButton = new AccentButton
        {
            Text = "打开文件夹",
            Variant = ButtonVariant.Ghost,
            Height = 34,
            Dock = DockStyle.Fill,
            Enabled = false,
            Margin = new Padding(0, 0, 8, 0),
        };
        _openFolderButton.Click += (_, _) => OpenOutputFolder();
        _outputPathLabel = new Label
        {
            Text = "采集结束后可导出汇总 / 每秒时间线 / 原始帧数据",
            Font = Theme.Font(8.2f),
            ForeColor = Theme.Faint,
            AutoSize = false,
            AutoEllipsis = true,
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft,
            BackColor = Color.Transparent,
        };

        row.Controls.Add(_exportCsvButton, 0, 0);
        row.Controls.Add(_exportHtmlButton, 1, 0);
        row.Controls.Add(_openFolderButton, 2, 0);
        row.Controls.Add(_outputPathLabel, 3, 0);
        card.Controls.Add(row);
        return card;
    }

    private TableLayoutPanel BuildBottomCards()
    {
        var row = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 1,
            BackColor = Theme.Bg,
            Margin = Padding.Empty,
            Padding = Padding.Empty,
        };
        row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 56));
        row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 44));

        row.Controls.Add(BuildStatsCard(), 0, 0);
        row.Controls.Add(BuildLogCard(), 1, 0);
        return row;
    }

    private RoundedPanel BuildStatsCard()
    {
        var card = new RoundedPanel
        {
            Dock = DockStyle.Fill,
            CornerRadius = 14,
            Padding = new Padding(14, 10, 14, 10),
            Margin = new Padding(0, 0, 5, 0),
        };
        var inner = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 2,
            BackColor = Theme.Surface,
            Margin = Padding.Empty,
            Padding = Padding.Empty,
        };
        inner.RowStyles.Add(new RowStyle(SizeType.Absolute, 28));
        inner.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        var header = new Panel { Dock = DockStyle.Fill, BackColor = Theme.Surface };
        var title = new Label
        {
            Text = "本次统计",
            Font = Theme.Font(10f, FontStyle.Bold),
            ForeColor = Theme.Text,
            AutoSize = true,
            Location = new Point(0, 5),
        };
        _statsNote = new Label
        {
            Text = "1% Low 完成后按全程计算",
            Font = Theme.Font(7.8f),
            ForeColor = Theme.Faint,
            AutoSize = true,
            TextAlign = ContentAlignment.MiddleRight,
        };
        header.Controls.Add(title);
        header.Controls.Add(_statsNote);
        header.Resize += (_, _) =>
        {
            _statsNote.Location = new Point(Math.Max(100, header.ClientSize.Width - _statsNote.Width), 7);
        };

        var table = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 4,
            RowCount = 7,
            BackColor = Theme.Surface,
            Margin = Padding.Empty,
            Padding = Padding.Empty,
        };
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 24));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 26));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 24));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 26));
        for (var i = 0; i < 7; i++)
        {
            table.RowStyles.Add(new RowStyle(SizeType.Percent, 100f / 7));
        }

        var definitions = new (string Label, string Key, string Default)[]
        {
            ("平均帧时间", "avgFrame", "--"),
            ("有效帧", "validFrames", "--"),
            ("P99 帧时间", "p99", "--"),
            ("最大帧时间", "maxFrame", "--"),
            ("1% Low", "low1", "--"),
            ("0.1% Low", "low01", "--"),
            ("内存峰值", "memPeak", "--"),
            ("内存增长", "memGrowth", "--"),
            ("CPU 平均 / 峰值", "cpu", "--"),
            ("线程 / 句柄", "threads", "--"),
            ("前台占比", "foreground", "--"),
            ("显示延迟", "latency", "--"),
            ("采集方式", "source", "--"),
            ("交换链 / 呈现", "swapchain", "--"),
        };

        for (var i = 0; i < definitions.Length; i++)
        {
            var col = (i % 2) * 2;
            var rowIndex = i / 2;
            var label = new Label
            {
                Text = definitions[i].Label,
                Font = Theme.Font(8.1f),
                ForeColor = Theme.Muted,
                BackColor = Color.Transparent,
                AutoSize = false,
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleLeft,
                Margin = new Padding(0, 0, 2, 0),
                AutoEllipsis = true,
            };
            var value = new Label
            {
                Text = definitions[i].Default,
                Font = Theme.MonoFont(8.2f, FontStyle.Bold),
                ForeColor = Theme.Text,
                BackColor = Color.Transparent,
                AutoSize = false,
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleRight,
                Margin = new Padding(0, 0, col == 0 ? 10 : 0, 0),
                AutoEllipsis = true,
            };
            table.Controls.Add(label, col, rowIndex);
            table.Controls.Add(value, col + 1, rowIndex);
            _statValues[definitions[i].Key] = value;
        }

        inner.Controls.Add(header, 0, 0);
        inner.Controls.Add(table, 0, 1);
        card.Controls.Add(inner);
        return card;
    }

    private RoundedPanel BuildLogCard()
    {
        var card = new RoundedPanel
        {
            Dock = DockStyle.Fill,
            CornerRadius = 14,
            Padding = new Padding(12, 8, 12, 10),
            Margin = new Padding(5, 0, 0, 0),
        };
        var inner = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 2,
            BackColor = Theme.Surface,
            Margin = Padding.Empty,
            Padding = Padding.Empty,
        };
        inner.RowStyles.Add(new RowStyle(SizeType.Absolute, 26));
        inner.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        var header = new Panel { Dock = DockStyle.Fill, BackColor = Theme.Surface };
        var title = new Label
        {
            Text = "运行日志",
            Font = Theme.Font(9.5f, FontStyle.Bold),
            ForeColor = Theme.Text,
            AutoSize = true,
            Location = new Point(0, 3),
        };
        var clear = new AccentButton
        {
            Text = "清空",
            Variant = ButtonVariant.Ghost,
            Font = Theme.Font(7.8f, FontStyle.Bold),
            Height = 24,
            Width = 48,
            Anchor = AnchorStyles.Top | AnchorStyles.Right,
            Location = new Point(0, 0),
        };
        clear.Click += (_, _) => _logBox.Clear();
        header.Controls.Add(title);
        header.Controls.Add(clear);
        header.Resize += (_, _) => clear.Location = new Point(header.ClientSize.Width - clear.Width, 0);

        var logHost = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Theme.Input,
            Padding = new Padding(7, 6, 4, 4),
            Margin = Padding.Empty,
        };

        _logBox = new RichTextBox
        {
            Dock = DockStyle.Fill,
            BorderStyle = BorderStyle.None,
            BackColor = Theme.Input,
            ForeColor = Theme.Muted,
            Font = Theme.MonoFont(8.1f),
            ReadOnly = true,
            DetectUrls = false,
            WordWrap = true,
            ScrollBars = RichTextBoxScrollBars.Vertical,
            HideSelection = false,
            Margin = Padding.Empty,
        };
        logHost.Controls.Add(_logBox);
        inner.Controls.Add(header, 0, 0);
        inner.Controls.Add(logHost, 0, 1);
        card.Controls.Add(inner);
        return card;
    }

    private Label MakeSection(string text) => new()
    {
        Text = text,
        Width = 332,
        Height = 28,
        Font = Theme.Font(9.5f, FontStyle.Bold),
        ForeColor = Theme.Text,
        BackColor = Color.Transparent,
        TextAlign = ContentAlignment.MiddleLeft,
        Margin = Padding.Empty,
    };

    private DarkTextBox NewInput(string text = "") => new()
    {
        Width = 332,
        Height = 36,
        Text = text,
    };

    private Panel BuildField(string label, Control input)
    {
        var panel = new Panel
        {
            Width = 332,
            Height = 60,
            BackColor = Theme.Surface,
            Margin = Padding.Empty,
        };
        var caption = new Label
        {
            Text = label,
            Font = Theme.Font(8.3f),
            ForeColor = Theme.Muted,
            AutoSize = false,
            Location = new Point(0, 0),
            Size = new Size(332, 18),
            TextAlign = ContentAlignment.MiddleLeft,
            BackColor = Color.Transparent,
        };
        input.Location = new Point(0, 21);
        input.Width = 332;
        input.Height = 36;
        panel.Controls.Add(caption);
        panel.Controls.Add(input);
        return panel;
    }

    private TableLayoutPanel BuildTwoFields(string leftLabel, Control leftInput, string rightLabel, Control rightInput)
    {
        var table = new TableLayoutPanel
        {
            Width = 332,
            Height = 62,
            ColumnCount = 2,
            RowCount = 2,
            BackColor = Theme.Surface,
            Margin = Padding.Empty,
            Padding = Padding.Empty,
        };
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        table.RowStyles.Add(new RowStyle(SizeType.Absolute, 19));
        table.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        var l1 = new Label
        {
            Text = leftLabel, Font = Theme.Font(8.2f), ForeColor = Theme.Muted, Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft, BackColor = Color.Transparent,
            Margin = new Padding(0, 0, 6, 0), AutoEllipsis = true,
        };
        var l2 = new Label
        {
            Text = rightLabel, Font = Theme.Font(8.2f), ForeColor = Theme.Muted, Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft, BackColor = Color.Transparent,
            Margin = new Padding(6, 0, 0, 0), AutoEllipsis = true,
        };
        leftInput.Dock = DockStyle.Fill;
        rightInput.Dock = DockStyle.Fill;
        leftInput.Height = 36;
        rightInput.Height = 36;
        leftInput.Margin = new Padding(0, 0, 6, 0);
        rightInput.Margin = new Padding(6, 0, 0, 0);
        table.Controls.Add(l1, 0, 0);
        table.Controls.Add(l2, 1, 0);
        table.Controls.Add(leftInput, 0, 1);
        table.Controls.Add(rightInput, 1, 1);
        table.RowStyles[1] = new RowStyle(SizeType.Absolute, 38);
        return table;
    }

    private Panel BuildOutputField()
    {
        var panel = new Panel
        {
            Width = 332,
            Height = 62,
            BackColor = Theme.Surface,
            Margin = Padding.Empty,
        };
        var caption = new Label
        {
            Text = "输出目录",
            Font = Theme.Font(8.3f),
            ForeColor = Theme.Muted,
            AutoSize = false,
            Location = new Point(0, 0),
            Size = new Size(332, 18),
            TextAlign = ContentAlignment.MiddleLeft,
            BackColor = Color.Transparent,
        };
        var row = new TableLayoutPanel
        {
            Location = new Point(0, 21),
            Size = new Size(332, 36),
            ColumnCount = 2,
            RowCount = 1,
            BackColor = Theme.Surface,
            Margin = Padding.Empty,
            Padding = Padding.Empty,
        };
        row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        row.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 70));
        _outputBox.Dock = DockStyle.Fill;
        _outputBox.Margin = new Padding(0, 0, 6, 0);
        _browseButton.Dock = DockStyle.Fill;
        _browseButton.Margin = new Padding(6, 0, 0, 0);
        row.Controls.Add(_outputBox, 0, 0);
        row.Controls.Add(_browseButton, 1, 0);
        panel.Controls.Add(caption);
        panel.Controls.Add(row);
        return panel;
    }

    private void LoadSettingsIntoControls()
    {
        _modeCombo.SelectedIndex = _settings.LastCaptureMode switch
        {
            CaptureMode.WindowCapture => 1,
            CaptureMode.PresentMon => 2,
            _ => 0,
        };
        _durationBox.Text = _settings.LastDurationSeconds.ToString("0.#");
        _warmupBox.Text = _settings.LastWarmupSeconds.ToString("0.#");
        _maxFrameBox.Text = _settings.LastMaxFrameTimeMs.ToString("0.#");
        _delayBox.Text = _settings.LastStartDelaySeconds.ToString("0");
        _autoExportCheck.Checked = _settings.AutoExport;
        _aggregateCheck.Checked = _settings.AggregateProcessTree;
        var hotkeyIndex = _globalHotkeyCombo.Items.IndexOf(_settings.GlobalStopHotkey);
        _globalHotkeyCombo.SelectedIndex = hotkeyIndex >= 0 ? hotkeyIndex : 0;
        _outputBox.Text = string.IsNullOrWhiteSpace(_settings.OutputDirectory)
            ? AppPaths.DefaultOutputDirectory
            : _settings.OutputDirectory;
        _testerBox.Text = _settings.LastTester;
        UpdateModeHint();
    }

    private void UpdateHeaderInfo()
    {
        _headerInfo.Text = string.IsNullOrWhiteSpace(_presentMonPath)
            ? "Windows 10 2004+ · PresentMon 未找到 · 窗口捕获可用"
            : "Windows 10 2004+ · PresentMon 2.6.0 已就绪";
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        NativeMethods.TryEnableDarkTitleBar(Handle);
        if (Visible && _globalHotkeyCombo != null)
        {
            UpdateGlobalHotkeyRegistration();
        }
    }

    private void ConstrainToWorkingArea()
    {
        try
        {
            var area = Screen.FromControl(this).WorkingArea;
            var maxWidth = Math.Max(900, area.Width - 24);
            var maxHeight = Math.Max(650, area.Height - 24);
            var newWidth = Math.Min(Width, maxWidth);
            var newHeight = Math.Min(Height, maxHeight);
            MinimumSize = new Size(Math.Min(MinimumSize.Width, maxWidth), Math.Min(MinimumSize.Height, maxHeight));
            if (newWidth != Width || newHeight != Height)
            {
                Size = new Size(newWidth, newHeight);
            }

            Location = new Point(
                area.Left + Math.Max(0, (area.Width - Width) / 2),
                area.Top + Math.Max(0, (area.Height - Height) / 2));
        }
        catch
        {
        }
    }
}
