import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const urls = [
  'https://assets.mixkit.co/music/preview/mixkit-tender-gaze-500.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
];

async function download() {
  const assetsDir = path.join(__dirname, 'src', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
    console.log('Created assets directory:', assetsDir);
  }

  const destPath = path.join(assetsDir, 'bgm.mp3');

  for (const url of urls) {
    try {
      console.log(`Attempting to download from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(destPath, Buffer.from(buffer));
      const stats = fs.statSync(destPath);
      console.log(`Successfully downloaded! Saved to: ${destPath} (Size: ${stats.size} bytes)`);
      if (stats.size > 10000) {
        return;
      } else {
        console.log('File is too small, might be invalid. Trying next fallback...');
      }
    } catch (e) {
      console.error(`Failed to download from ${url}:`, e.message);
    }
  }

  console.error('All download attempts failed!');
  process.exit(1);
}

download();
