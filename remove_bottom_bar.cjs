const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');

let start = -1;
let end = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{/* Global Bottom Navigation Bar */}')) {
    start = i;
  }
  // The bottom bar block ends right before </main>
  if (start !== -1 && lines[i].includes('</main>')) {
    end = i;
    break;
  }
}

if (start !== -1 && end !== -1) {
  lines.splice(start, end - start);
  fs.writeFileSync('src/App.tsx', lines.join('\n'));
}
