const fs = require('fs');

let code = fs.readFileSync('src/components/Reader.tsx', 'utf8');

// The review panel is inside the `{showSidebar && (...)}` block
const sidebarStartMarker = '{showSidebar && (';
const lines = code.split('\n');

let start = -1;
let end = -1;
let openBraces = 0;

for (let i = 0; i < lines.length; i++) {
  if (start === -1 && lines[i].includes(sidebarStartMarker)) {
    start = i;
  }
  
  if (start !== -1) {
    if (lines[i].includes('(')) {
      openBraces += (lines[i].match(/\(/g) || []).length;
    }
    if (lines[i].includes(')')) {
      openBraces -= (lines[i].match(/\)/g) || []).length;
      
      // If we've closed the outermost parenthesis of the conditional block
      if (openBraces === 0 && i >= start) {
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
