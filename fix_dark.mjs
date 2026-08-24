import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');
for (let i = 249; i < 415; i++) {
  if (lines[i]) {
    // We only want to remove dark:[...] classes.
    // They are separated by space, or they might be followed by ' or "
    // Example: dark:bg-slate-900/95
    lines[i] = lines[i].replace(/dark:[a-zA-Z0-9_\-\/\[\]]+/g, '');
    lines[i] = lines[i].replace(/ +/g, ' ');
  }
}
fs.writeFileSync('src/App.tsx', lines.join('\n'));
