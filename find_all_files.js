import fs from 'fs';
import path from 'path';

function findFiles(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.next' || file === '.npm-cache' || file === '.npm') {
        continue;
      }
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(findFiles(fullPath));
        } else {
          results.push({
            path: fullPath,
            size: stat.size,
            mtime: stat.mtime
          });
        }
      } catch (err) {}
    }
  } catch (err) {}
  return results;
}

console.log("Listing absolutely ALL files in /app/applet...");
const allFiles = findFiles('/app/applet');
allFiles.forEach(f => {
  console.log(`- ${f.path} (${f.size} bytes) - Modified: ${f.mtime}`);
});
