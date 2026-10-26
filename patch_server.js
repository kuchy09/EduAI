const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace `async function startServer() {` and `const app = express();`
code = code.replace(/async function startServer\(\) \{\n\s*const app = express\(\);\n\s*const PORT = 3000;/m, `const app = express();
const PORT = process.env.PORT || 3000;`);

// Find the bottom part
const bottomPart = `  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
}

startServer();`;

const newBottomPart = `
async function startDevServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(\`Server running on port \${PORT}\`);
  });
}

// Only start the server if this file is run directly (not imported as a module by Vercel)
if (process.env.VERCEL !== "1" && import.meta.url === \`file://\${process.argv[1]}\`) {
  // ESM check for direct execution
  startDevServer();
} else if (process.env.VERCEL !== "1" && require.main === module) {
  // CJS check for direct execution
  startDevServer();
}

export default app;
`;

code = code.replace(bottomPart, newBottomPart);
fs.writeFileSync('server.ts', code);
console.log("Patched server.ts");
