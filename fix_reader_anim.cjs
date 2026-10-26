const fs = require('fs');

let code = fs.readFileSync('src/components/Reader.tsx', 'utf8');
const lines = code.split('\n');

// 1. Add scroll to pageTurnStyle type
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("useState<'slide' | 'fade' | 'flip'>")) {
    lines[i] = lines[i].replace("'slide' | 'fade' | 'flip'", "'slide' | 'scroll' | 'fade' | 'flip'");
    // Also inject pageDirection right after
    lines.splice(i + 1, 0, "  const [pageDirection, setPageDirection] = useState(1);");
    break;
  }
}

// 2. Update pageTurnStyle buttons
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("['slide', 'fade', 'flip'] as const")) {
    lines[i] = lines[i].replace("['slide', 'fade', 'flip']", "['slide', 'scroll', 'fade', 'flip']");
    break;
  }
}

// 3. Update AnimatePresence
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
  const newAnim = `                <AnimatePresence mode="wait">
                  <motion.div
                    key={pageNumber}
                    initial={
                      pageTurnStyle === 'slide' ? { opacity: 0, x: pageDirection * 20 } :
                      pageTurnStyle === 'scroll' ? { opacity: 0, y: pageDirection * 30 } :
                      pageTurnStyle === 'fade' ? { opacity: 0 } :
                      pageTurnStyle === 'flip' ? { opacity: 0, rotateY: pageDirection * 90 } : {}
                    }
                    animate={
                      pageTurnStyle === 'slide' ? { opacity: 1, x: 0 } :
                      pageTurnStyle === 'scroll' ? { opacity: 1, y: 0 } :
                      pageTurnStyle === 'fade' ? { opacity: 1 } :
                      pageTurnStyle === 'flip' ? { opacity: 1, rotateY: 0 } : {}
                    }
                    exit={
                      pageTurnStyle === 'slide' ? { opacity: 0, x: -pageDirection * 20 } :
                      pageTurnStyle === 'scroll' ? { opacity: 0, y: -pageDirection * 30 } :
                      pageTurnStyle === 'fade' ? { opacity: 0 } :
                      pageTurnStyle === 'flip' ? { opacity: 0, rotateY: -pageDirection * 90 } : {}
                    }
                    transition={{ duration: 0.2 }}`;
  lines.splice(animateStart, animateEnd - animateStart, newAnim);
}

// 4. Update pagination buttons to set direction
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}")) {
    lines[i] = `                    onClick={() => { setPageDirection(-1); setPageNumber(prev => Math.max(prev - 1, 1)); }}`;
  }
  if (lines[i].includes("onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}")) {
    lines[i] = `                    onClick={() => { setPageDirection(1); setPageNumber(prev => Math.min(prev + 1, numPages)); }}`;
  }
}

fs.writeFileSync('src/components/Reader.tsx', lines.join('\n'));
