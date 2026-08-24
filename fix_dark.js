const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');
for (let i = 249; i < 415; i++) {
  if (lines[i]) {
    lines[i] = lines[i].replace(/dark:[^\s"']+/g, '');
    // clean up double spaces
    lines[i] = lines[i].replace(/\s{2,}/g, ' ');
  }
}
fs.writeFileSync('src/App.tsx', lines.join('\n'));
