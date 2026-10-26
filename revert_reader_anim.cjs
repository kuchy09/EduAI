const fs = require('fs');

let code = fs.readFileSync('src/components/Reader.tsx', 'utf8');

// 1. Remove scroll from pageTurnStyle type
code = code.replace("useState<'slide' | 'scroll' | 'fade' | 'flip'>", "useState<'slide' | 'fade' | 'flip'>");
code = code.replace("  const [pageDirection, setPageDirection] = useState(1);\n", "");

// 2. Remove scroll from pageTurnStyle buttons
code = code.replace("['slide', 'scroll', 'fade', 'flip'] as const", "['slide', 'fade', 'flip'] as const");

// 3. Revert AnimatePresence block
const originalAnim = `                <AnimatePresence mode="wait">
                  <motion.div
                    key={pageNumber}
                    initial={
                      pageTurnStyle === 'slide' ? { opacity: 0, x: 20 } :
                      pageTurnStyle === 'fade' ? { opacity: 0 } :
                      pageTurnStyle === 'flip' ? { opacity: 0, rotateY: 90 } : {}
                    }
                    animate={
                      pageTurnStyle === 'slide' ? { opacity: 1, x: 0 } :
                      pageTurnStyle === 'fade' ? { opacity: 1 } :
                      pageTurnStyle === 'flip' ? { opacity: 1, rotateY: 0 } : {}
                    }
                    exit={
                      pageTurnStyle === 'slide' ? { opacity: 0, x: -20 } :
                      pageTurnStyle === 'fade' ? { opacity: 0 } :
                      pageTurnStyle === 'flip' ? { opacity: 0, rotateY: -90 } : {}
                    }
                    transition={{ duration: 0.2 }}`;

let lines = code.split('\n');
let animateStart = -1;
let animateEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<AnimatePresence mode="wait">')) {
    animateStart = i;
  }
  if (animateStart !== -1 && lines[i].includes('transition={{ duration: 0.2 }}')) {
    animateEnd = i + 1;
    break;
  }
}

if (animateStart !== -1 && animateEnd !== -1) {
  lines.splice(animateStart, animateEnd - animateStart, originalAnim);
}
code = lines.join('\n');

// 4. Update pagination buttons back to original
code = code.replace(/setPageDirection\(-1\); /g, "");
code = code.replace(/setPageDirection\(1\); /g, "");
code = code.replace(/\{ setPageNumber/g, "setPageNumber");
code = code.replace(/, 1\)\); \}/g, ", 1))");
code = code.replace(/numPages\)\); \}/g, "numPages))");

fs.writeFileSync('src/components/Reader.tsx', code);
