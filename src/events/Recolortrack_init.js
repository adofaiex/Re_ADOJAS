/**
 * 解析轨道颜色类型
 * @param {string} Type - 对应 rct.trackStyle
 * @param {string} inputColor - 对应 rct.trackColor
 * @param {string} inputBgColor - 对应 rct.secondaryTrackColor
 */
function parseColorTrackType(Type, inputColor, inputBgColor) {
    // 确保颜色包含 '#' 前缀
    let trackColorX = inputColor.includes('#') ? inputColor : '#' + inputColor;
    let trackbgColorX = inputBgColor.includes('#') ? inputBgColor : '#' + inputBgColor;

    let intValue = { color: trackColorX, bgcolor: trackbgColorX };

    if (Type === "Standard") {
        intValue.color = trackColorX;
        intValue.bgcolor = processHexColor(trackColorX)[1]; // 对应积木第2项
    } 
    else if (Type === "Neon") {
        intValue.color = "#000000";
        intValue.bgcolor = trackColorX;
    } 
    else if (Type === "NeonLight") {
        intValue.color = processHexColor(trackColorX)[0]; // 对应积木第1项
        intValue.bgcolor = trackColorX;
    } 
    else if (Type === "Gems") {
        intValue.color = trackColorX;
        intValue.bgcolor = processHexColor(trackColorX)[1];
    } 
    else if (Type === "Basic") {
        intValue.color = trackColorX;
        intValue.bgcolor = "#000000";
    } 
    else if (Type === "Minimal") {
        intValue.color = trackColorX;
        intValue.bgcolor = trackColorX;
    }

    return intValue;
}

/**
 * 位置相对转换函数
 * @param {Array|string} input - 包含关键字的位置数据
 * @param {number} thisid - 当前瓦片 ID
 */
function PosRelativeTo(input, thisid) {
    const angleTestCount = tile.angleTest.length; // 对应 tile::angleTest 的项目数

    const replaceKeywords = (val) => {
        if (typeof val === 'string') {
            return val
                .replace(/Start/g, "0") // 修正为 0-based: Start 为 0
                .replace(/ThisTile/g, String(thisid + 0)) // 修正为 thisid + 0
                .replace(/End/g, String(angleTestCount));
        }
        return val;
    };

    let let_id_a = Array.isArray(input) ? input.map(replaceKeywords) : replaceKeywords(input);

    // 返回数组第1项(索引0)与第2项(索引1)之和
    return Number(let_id_a[0]) + Number(let_id_a[1]);
}

// --- 变量对应关系与执行上下文 ---

// 从线程变量 rct 中解构出需要的属性
const { 
    duration, 
    startTile: rctStartTile, 
    endTile: rctEndTile, 
    trackStyle, 
    trackColor, 
    secondaryTrackColor 
} = rct;

// 对应图1000095102.jpg 中的赋值逻辑
let rctForTime = convert(duration, "TileBPM", eventTile, "time");
let startTile = PosRelativeTo(rctStartTile, eventTileorg);
let endTile   = PosRelativeTo(rctEndTile, eventTileorg);

// 调用颜色解析函数，传入解构后的变量
let distColor = parseColorTrackType(trackStyle, trackColor, secondaryTrackColor);
