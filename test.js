const fs = require('fs');
const html = fs.readFileSync('dist/index.html', 'utf8');
// This won't work because it's a React app, DOM is generated at runtime.
