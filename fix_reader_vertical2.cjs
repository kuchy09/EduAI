const fs = require('fs');

let code = fs.readFileSync('src/components/Reader.tsx', 'utf8');

const newAnim = `                <AnimatePresence mode="wait">
                  <motion.div
                    key={pageNumber}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -30 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >`;
                  
const originalAnim = `                <AnimatePresence mode="wait">
                  <motion.div
                    key={pageNumber}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >`;                  

code = code.replace(newAnim, originalAnim);
fs.writeFileSync('src/components/Reader.tsx', code);
