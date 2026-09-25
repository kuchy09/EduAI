const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Undo the setItem wrapped thing
code = code.replace(/\(\(\) => \{ try \{ sessionStorage\.setItem\((.*?),\s*(.*?)\); \} catch \(e\) \{\} \}\)\(\)/g, "sessionStorage.setItem($1, $2)");
code = code.replace(/\(\(\) => \{ try \{ localStorage\.setItem\((.*?),\s*(.*?)\); \} catch \(e\) \{\} \}\)\(\)/g, "localStorage.setItem($1, $2)");
code = code.replace(/\(\(\(\) => \{ try \{ sessionStorage\.getItem\((.*?)\); \} catch \(e\) \{ return null; \} \}\)\(\)\)/g, "sessionStorage.getItem($1)");
code = code.replace(/\(\(\(\) => \{ try \{ localStorage\.getItem\((.*?)\); \} catch \(e\) \{ return null; \} \}\)\(\)\)/g, "localStorage.getItem($1)");
code = code.replace(/\(\(\) => \{ try \{ sessionStorage\.removeItem\((.*?)\); \} catch \(e\) \{\} \}\)\(\)/g, "sessionStorage.removeItem($1)");
code = code.replace(/\(\(\) => \{ try \{ localStorage\.removeItem\((.*?)\); \} catch \(e\) \{\} \}\)\(\)/g, "localStorage.removeItem($1)");

fs.writeFileSync('src/App.tsx', code);
