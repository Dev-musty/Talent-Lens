import * as fs from 'fs';
import path from 'path/win32';

function walk(dir) {
  const entries = fs.readdirSync(dir);

  if (entries.length === 0) {
    fs.writeFileSync(path.join(dir, '.gitkeep'), '');
    console.log(`Added .gitkeep to ${dir}`);
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    if (entry === '.git' || entry === 'node_modules') continue;
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    }
  }
}

walk('.');
console.log('Done.');
