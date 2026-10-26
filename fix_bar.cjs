const fs = require('fs');

const originalBottomBar = `        {/* Global Bottom Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#ffffff] backdrop-blur-3xl rounded-t-[20px] shadow-[0_-8px_30px_rgba(0,0,0,0.06)] flex items-center px-0.5 sm:px-4 pt-1 pb-1 justify-between select-none border-t border-slate-200">
          <motion.button 
            onClick={() => setCurrentView('dashboard')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="flex flex-col items-center justify-center py-1 px-0.5 transition-all flex-1 group focus:outline-none"
          >
            <div className={\`flex flex-col items-center justify-center w-[58px] h-[58px] sm:w-[68px] sm:h-[68px] rounded-full transition-all duration-200 \${
              currentView === 'dashboard' 
                ? 'bg-transparent' 
                : 'bg-transparent group-hover:bg-[#EAF1F9]/50'
            }\`}>
              <AppleBooksHome 
                filled={currentView === 'dashboard'}
                className={\`w-[25px] h-[25px] sm:w-[27px] sm:h-[27px] mb-0.5 transition-all duration-200 \${
                  currentView === 'dashboard' 
                    ? 'text-black scale-105 opacity-100' 
                    : 'text-[#8E8E93] opacity-70 group-hover:opacity-100 group-hover:scale-105'
                }\`} 
              />
              <span className={\`text-[9px] sm:text-[10px] font-medium tracking-wide whitespace-nowrap transition-colors duration-200 \${
                currentView === 'dashboard' ? 'text-black font-semibold' : 'text-[#8E8E93] group-hover:text-black'
              }\`}>
                Home
              </span>
            </div>
          </motion.button>
          
          <motion.button 
            onClick={() => setCurrentView('library')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="flex flex-col items-center justify-center py-1 px-0.5 transition-all flex-1 group focus:outline-none"
          >
            <div className={\`flex flex-col items-center justify-center w-[58px] h-[58px] sm:w-[68px] sm:h-[68px] rounded-full transition-all duration-200 \${
              currentView === 'library' 
                ? 'bg-[#DDEBF7] shadow-inner' 
                : 'bg-transparent group-hover:bg-[#EAF1F9]'
            }\`}>
               <AppleBooksLibrary 
                 filled={currentView === 'library'}
                 className={\`w-[25px] h-[25px] sm:w-[27px] sm:h-[27px] mb-0.5 transition-all duration-200 \${
                   currentView === 'library' 
                     ? 'text-black scale-105 opacity-100' 
                     : 'text-[#8E8E93] opacity-70 group-hover:opacity-100 group-hover:scale-105'
                 }\`} 
               />
               <span className={\`text-[9px] sm:text-[10px] font-medium tracking-wide whitespace-nowrap transition-colors duration-200 \${
                 currentView === 'library' 
                   ? 'text-[#405C8A] font-semibold' 
                   : 'text-[#8E8E93] group-hover:text-black'
               }\`}>
                 Library
               </span>
            </div>
          </motion.button>
          
          <motion.button 
            onClick={() => setCurrentView('ai-tutor')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="flex flex-col items-center justify-center py-1 px-0.5 transition-all flex-1 group focus:outline-none"
          >
             <div className={\`flex flex-col items-center justify-center w-[58px] h-[58px] sm:w-[68px] sm:h-[68px] rounded-full transition-all duration-200 \${
               currentView === 'ai-tutor' 
                 ? 'bg-[#F2EBF9] shadow-inner' 
                 : 'bg-transparent group-hover:bg-[#F2EBF9]/50'
             }\`}>
               <AppleBooksGeminiAI 
                 filled={currentView === 'ai-tutor'}
                 className={\`w-[25px] h-[25px] sm:w-[27px] sm:h-[27px] mb-0.5 transition-all duration-300 \${
                   currentView === 'ai-tutor' 
                     ? 'text-[#69527D] scale-105 opacity-100' 
                     : 'text-[#8E8E93] opacity-75 group-hover:opacity-100 group-hover:scale-105'
                 }\`} 
               />
              <span className={\`text-[9px] sm:text-[10px] font-medium tracking-wide whitespace-nowrap transition-colors duration-200 \${
                currentView === 'ai-tutor' 
                  ? 'text-[#69527D] font-semibold' 
                  : 'text-[#8E8E93] group-hover:text-[#69527D]'
              }\`}>
                Sage
              </span>
             </div>
          </motion.button>
          
          <motion.button 
            onClick={() => setCurrentView('book-store')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="flex flex-col items-center justify-center py-1 px-0.5 transition-all flex-1 group focus:outline-none"
          >
            <div className={\`flex flex-col items-center justify-center w-[58px] h-[58px] sm:w-[68px] sm:h-[68px] rounded-full transition-all duration-200 \${
              currentView === 'book-store' 
                ? 'bg-transparent' 
                : 'bg-transparent group-hover:bg-[#EAF1F9]/50'
            }\`}>
              <AppleBooksBookStore 
                filled={currentView === 'book-store'}
                className={\`w-[25px] h-[25px] sm:w-[27px] sm:h-[27px] mb-0.5 transition-all duration-200 \${
                  currentView === 'book-store' 
                    ? 'text-black scale-105 opacity-100' 
                    : 'text-[#8E8E93] opacity-70 group-hover:opacity-100 group-hover:scale-105'
                }\`} 
              />
              <span className={\`text-[9px] sm:text-[10px] font-medium tracking-wide whitespace-nowrap transition-colors duration-200 \${
                currentView === 'book-store' ? 'text-black font-semibold' : 'text-[#8E8E93] group-hover:text-black'
              }\`}>
                Book Store
              </span>
            </div>
          </motion.button>
          
          <motion.button 
            onClick={() => setCurrentView('audiobooks')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="flex flex-col items-center justify-center py-1 px-0.5 transition-all flex-1 group focus:outline-none"
          >
            <div className={\`flex flex-col items-center justify-center w-[58px] h-[58px] sm:w-[68px] sm:h-[68px] rounded-full transition-all duration-200 \${
              currentView === 'audiobooks' 
                ? 'bg-[#EAF1F9] shadow-inner' 
                : 'bg-transparent group-hover:bg-[#EAF1F9]/50'
            }\`}>
              <AppleBooksAudiobooks 
                filled={currentView === 'audiobooks'}
                className={\`w-[25px] h-[25px] sm:w-[27px] sm:h-[27px] mb-0.5 transition-all duration-200 \${
                  currentView === 'audiobooks' 
                    ? 'text-[#405C8A] scale-105 opacity-100' 
                    : 'text-[#8E8E93] opacity-70 group-hover:opacity-100 group-hover:scale-105'
                }\`} 
              />
              <span className={\`text-[9px] sm:text-[10px] font-medium tracking-wide whitespace-nowrap transition-colors duration-200 \${
                currentView === 'audiobooks' ? 'text-[#405C8A] font-semibold' : 'text-[#8E8E93] group-hover:text-black'
              }\`}>
                Audiobooks
              </span>
            </div>
          </motion.button>
        </div>`;

let code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');

// Find start and end of the block
let start = -1;
let end = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{/* Global Bottom Navigation Bar */}')) {
    start = i;
  }
  if (start !== -1 && lines[i].includes('</main>')) {
    end = i;
    break;
  }
}

if (start !== -1 && end !== -1) {
  lines.splice(start, end - start, originalBottomBar);
  fs.writeFileSync('src/App.tsx', lines.join('\n'));
}
