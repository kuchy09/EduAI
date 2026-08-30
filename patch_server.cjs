const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace `async function startServer() {` and `const app = express();`
code = code.replace(/async function startServer\(\) \{\n\s*const app = express\(\);\n\s*const PORT = 3000;/m, `const app = express();\nconst PORT = process.env.PORT || 3000;`);

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

// Check if file is run directly (ESM or CJS)
const isMain = process.argv[1] && (import.meta.url === \`file://\${process.argv[1]}\` || require.main === module);
if (process.env.VERCEL !== "1" && !process.env.VERCEL_ENV) {
  startDevServer();
}

export default app;
`;

// Just find the `  if (process.env.NODE_ENV !== "production") {` and replace everything down to `startServer();`
code = code.replace(/  if \(process\.env\.NODE_ENV !== "production"\) {[\s\S]*startServer\(\);/m, newBottomPart);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts");
