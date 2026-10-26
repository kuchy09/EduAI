const fs = require('fs');

function safeReplace(file) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/sessionStorage\.getItem\((.*?)\)/g, "((() => { try { return sessionStorage.getItem($1); } catch (e) { return null; } })())");
  code = code.replace(/sessionStorage\.setItem\((.*?),\s*(.*?)\)/g, "(() => { try { sessionStorage.setItem($1, $2); } catch (e) {} })()");
  code = code.replace(/sessionStorage\.removeItem\((.*?)\)/g, "(() => { try { sessionStorage.removeItem($1); } catch (e) {} })()");
  fs.writeFileSync(file, code);
}

safeReplace('src/App.tsx');
console.log("Patched sessionStorage");
