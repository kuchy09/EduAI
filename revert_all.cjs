const fs = require('fs');

function revertFile(path) {
  let code = fs.readFileSync(path, 'utf8');
  code = code.replace(/\(\(\) => \{ try \{ sessionStorage\.setItem\((.*?),\s*(.*?)\); \} catch \(e\) \{\} \}\)\(\)/g, "sessionStorage.setItem($1, $2)");
  code = code.replace(/\(\(\) => \{ try \{ localStorage\.setItem\((.*?),\s*(.*?)\); \} catch \(e\) \{\} \}\)\(\)/g, "localStorage.setItem($1, $2)");
  code = code.replace(/\(\(\(\) => \{ try \{ sessionStorage\.getItem\((.*?)\); \} catch \(e\) \{ return null; \} \}\)\(\)\)/g, "sessionStorage.getItem($1)");
  code = code.replace(/\(\(\(\) => \{ try \{ localStorage\.getItem\((.*?)\); \} catch \(e\) \{ return null; \} \}\)\(\)\)/g, "localStorage.getItem($1)");
  code = code.replace(/\(\(\) => \{ try \{ sessionStorage\.removeItem\((.*?)\); \} catch \(e\) \{\} \}\)\(\)/g, "sessionStorage.removeItem($1)");
  code = code.replace(/\(\(\) => \{ try \{ localStorage\.removeItem\((.*?)\); \} catch \(e\) \{\} \}\)\(\)/g, "localStorage.removeItem($1)");
  // Also clean up any trailing parentheses from the bad regex replacement
  code = code.replace(/JSON\.stringify\((.*?)\); \} catch \(e\) \{\} \}\)\(\)\);/g, "JSON.stringify($1));");
  fs.writeFileSync(path, code);
}

revertFile('src/main.tsx');
revertFile('src/components/Settings.tsx');
revertFile('src/components/Sidebar.tsx');
revertFile('src/components/Header.tsx');
revertFile('src/App.tsx');
