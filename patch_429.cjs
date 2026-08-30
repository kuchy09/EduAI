const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Patch chat endpoint error handler
code = code.replace(
  /if \(error\?\.status === 503 \|\| errorString\.includes\('503'\) \|\| errorString\.includes\('UNAVAILABLE'\) \|\| errorString\.includes\('high demand'\)\) \{/g,
  `if (error?.status === 429 || errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('prepayment credits are depleted')) {
        errorMessage = "Your Gemini API credits are depleted. Please check your billing settings in Google AI Studio to add credits.";
      } else if (error?.status === 503 || errorString.includes('503') || errorString.includes('UNAVAILABLE') || errorString.includes('high demand')) {`
);

// Patch learning path error handler
code = code.replace(
  /if \(error\?\.status === 503 \|\| error\?\.message\?\.includes\('503'\) \|\| error\?\.message\?\.includes\('UNAVAILABLE'\) \|\| error\?\.message\?\.includes\('high demand'\)\) \{/g,
  `if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('prepayment credits are depleted')) {
        errorMessage = "Your Gemini API credits are depleted. Please check your billing settings in Google AI Studio to add credits.";
      } else if (error?.status === 503 || error?.message?.includes('503') || error?.message?.includes('UNAVAILABLE') || error?.message?.includes('high demand')) {`
);

fs.writeFileSync('server.ts', code);
console.log("Patched 429 errors");
