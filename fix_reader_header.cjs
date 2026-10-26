const fs = require('fs');

let code = fs.readFileSync('src/components/Reader.tsx', 'utf8');

// Remove the highlights button
const hButtonStart = `          <button 
            onClick={() => {
              setSidebarTab('highlights');
              setShowSidebar(!showSidebar);
            }}
            className={\`p-2 rounded-full transition-colors flex items-center gap-1 \${showSidebar && sidebarTab === 'highlights' ? 'text-indigo-500 bg-indigo-500/10' : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}\`}
            title="Highlights & Notes"
          >
            <Highlighter className="w-4 h-4" />
          </button>`;
          
// Remove the chapters button          
const cButtonStart = `          <button 
            onClick={() => {
              setSidebarTab('chapters');
              setShowSidebar(!showSidebar);
            }}
            className={\`p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors \${showSidebar && sidebarTab === 'chapters' ? 'text-brand-600 bg-brand-50' : ''}\`}
            title="Chapters Table"
          >
            <List className="w-4 h-4" />
          </button>`;

// Remove the settings button
const sButtonStart = `          <button 
            onClick={() => {
              setSidebarTab('settings');
              setShowSidebar(!showSidebar);
            }}
            className={\`p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors \${showSidebar && sidebarTab === 'settings' ? 'text-brand-600 bg-brand-50' : ''}\`}
            title="Font & Themes Settings"
          >
            <Settings className="w-4 h-4" />
          </button>`;

code = code.replace(hButtonStart, '');
code = code.replace(cButtonStart, '');
code = code.replace(sButtonStart, '');

fs.writeFileSync('src/components/Reader.tsx', code);
