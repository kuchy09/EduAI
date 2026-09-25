const fs = require('fs');

function safeReplace(file) {
  let code = fs.readFileSync(file, 'utf8');
  // Replace localStorage.getItem with a safe wrapper
  code = code.replace(/localStorage\.getItem\((.*?)\)/g, "((() => { try { return localStorage.getItem($1); } catch (e) { return null; } })())");
  // Replace localStorage.setItem with a safe wrapper
  code = code.replace(/localStorage\.setItem\((.*?),\s*(.*?)\)/g, "(() => { try { localStorage.setItem($1, $2); } catch (e) {} })()");
  fs.writeFileSync(file, code);
}

safeReplace('src/main.tsx');
safeReplace('src/components/Settings.tsx');
safeReplace('src/components/Sidebar.tsx');
safeReplace('src/components/Header.tsx');
safeReplace('src/App.tsx');
console.log("Patched localStorage");
