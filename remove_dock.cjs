const fs = require('fs');

let code = fs.readFileSync('src/components/Reader.tsx', 'utf8');

// Find start and end of the Floating Bottom Control Dock
const dockStartMarker = '{/* Floating Bottom Control Dock */}';
const lines = code.split('\n');

let start = -1;
let end = -1;
let openDivs = 0;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(dockStartMarker)) {
    start = i;
  }
  
  if (start !== -1) {
    if (lines[i].includes('<div')) {
      openDivs += (lines[i].match(/<div/g) || []).length;
    }
    if (lines[i].includes('</div')) {
      openDivs -= (lines[i].match(/<\/div/g) || []).length;
      
      // If we've closed the outermost div of the dock
      if (openDivs === 0 && i > start) {
        end = i;
        break;
      }
    }
  }
}

if (start !== -1 && end !== -1) {
  lines.splice(start, end - start + 1);
  fs.writeFileSync('src/components/Reader.tsx', lines.join('\n'));
}
