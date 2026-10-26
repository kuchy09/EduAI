const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace("JSON.stringify(activeBook); } catch (e) {} })());", "JSON.stringify(activeBook)); } catch (e) {} })();");
fs.writeFileSync('src/App.tsx', code);
