import fs from 'fs';
import path from 'path';

const source = path.resolve('frontend', 'dist');
const dest = path.resolve('.');

if (fs.existsSync(source)) {
  const destStockfish = path.join(dest, 'stockfish');
  if (fs.existsSync(destStockfish)) {
    fs.rmSync(destStockfish, { recursive: true, force: true });
  }
  const items = fs.readdirSync(source);
  for (const item of items) {
    const srcPath = path.join(source, item);
    const destPath = path.join(dest, item);
    fs.cpSync(srcPath, destPath, { recursive: true, force: true });
  }
  console.log('[Sync] Production assets synced to root for Live Server / Go Live button.');
}
