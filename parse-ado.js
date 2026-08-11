const fs = require('fs');
const ADOFAI = require('adofai');
const { Parsers } = require('adofai');

const parser = new Parsers.StringParser();

function main() {
  const data = JSON.parse(fs.readFileSync('I:\\Downloads\\CE-TX\\main.adofai', 'utf8'));
  const level = new ADOFAI.Level(data, parser);
  level.on('load', loadedLevel => {
    loadedLevel.calculateTilePosition();
    console.log('=== tiles[0..25] ===');
    for (let i = 0; i < 26 && i < loadedLevel.tiles.length; i++) {
      const t = loadedLevel.tiles[i];
      console.log(i, 'angle=', t.angle, 'direction=', t.direction, 'pos=', JSON.stringify(t.position));
    }
    console.log('totalTiles=', loadedLevel.tiles.length);
    const ts = loadedLevel.tiles;
    // 统计 angle 值分布（前 50）
    const counts = {};
    for (let i = 0; i < Math.min(60, ts.length); i++) {
      const a = ts[i].angle;
      counts[a] = (counts[a] || 0) + 1;
    }
    console.log('angle 分布(前60):', JSON.stringify(counts));
  });
  level.load().catch(e => console.error('ERR', e));
}
main();
