/**
 * Extract the embedded base64 PNG from the DLC event SVGs (src/assets/dlc/*.svg)
 * and write sibling .json files containing only the dataURL string
 * (same format as src/assets/events/*.json, which Vite imports as a string).
 *
 * Run: npx tsx scripts/gen-dlc-svg-dataurl.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DLC_DIR = path.resolve(__dirname, '../src/assets/dlc');

// SVG 文件名 → 输出 JSON 名（避免空格/方括号导入）
const NAME_MAP: Record<string, string> = {
    'hold short.svg': 'hold_short.json',
    'hold long.svg': 'hold_long.json',
    'release_short.svg': 'release_short.json',
    'release_long.svg': 'release_long.json',
    '2 [PLANETS].svg': 'planets_2.json',
    '3 [PLANETS] a.svg': 'planets_3a.json',
    '3 [PLANETS] b.svg': 'planets_3b.json',
};

function main() {
    const files = fs.readdirSync(DLC_DIR).filter(f => f.toLowerCase().endsWith('.svg'));
    let count = 0;
    for (const file of files) {
        const full = path.join(DLC_DIR, file);
        const svg = fs.readFileSync(full, 'utf-8');
        const m = svg.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
        if (!m) {
            console.warn(`  SKIP (no embedded png): ${file}`);
            continue;
        }
        const dataUrl = `data:image/png;base64,${m[1]}`;
        const outName = NAME_MAP[file] ?? file.replace(/\.svg$/i, '.json');
        fs.writeFileSync(path.join(DLC_DIR, outName), JSON.stringify(dataUrl), 'utf-8');
        console.log(`  ${file} -> ${outName} (${m[1].length} b64 chars)`);
        count++;
    }
    console.log(`\nDone: ${count} json files generated`);
}

main();
