const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace UPLOADS_DIR assignment
code = code.replace(
  /const UPLOADS_DIR = path\.join\(process\.cwd\(\), "uploads"\);/g,
  `const UPLOADS_DIR = process.env.VERCEL ? path.join("/tmp", "uploads") : path.join(process.cwd(), "uploads");`
);

fs.writeFileSync('server.ts', code);
console.log("Patched UPLOADS_DIR");
