import { Code, Globe, Shield, Sparkles, Mail, Cpu, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

interface DeveloperProps {
  embedded?: boolean;
}

export function Developer({ embedded = false }: DeveloperProps) {
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard?.writeText('dicksonskello09@gmail.com');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  return (
    <div className={`${embedded ? 'space-y-6' : 'p-4 sm:p-8 max-w-4xl mx-auto space-y-10'}`}>
      {/* Top Banner section */}
      <div className={`flex flex-col items-center ${embedded ? 'pt-2' : 'mt-4'}`}>
        <div className="relative mb-5">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 border-indigo-200 dark:border-indigo-800/80 bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-indigo-500/20 dark:bg-slate-800 shadow-sm flex items-center justify-center overflow-hidden">
            <span className="text-slate-700 dark:text-slate-200 text-lg font-bold font-display">Wolter Kuch</span>
          </div>
          <div className="absolute bottom-0 right-0 w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center border-3 border-white dark:border-slate-900 shadow-sm">
            <Code className="w-5 h-5 text-white" />
          </div>
        </div>
        
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-1.5 font-display text-center">
          Wolter Kuch
        </h1>
        <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 font-medium mb-5 text-center">
          Lead Creator & System Architect
        </p>
        
        <div className="flex flex-wrap gap-2 sm:gap-2.5 justify-center max-w-xl">
          <span className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-full text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700">
            Software Developer
          </span>
          <span className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-full text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700">
            Offensive Security Researcher
          </span>
          <span className="px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-full text-xs sm:text-sm font-semibold border border-indigo-200/80 dark:border-indigo-800/60">
            AI Engineer
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {/* The Vision */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="text-xl font-bold text-slate-900 dark:text-white font-display">The Vision</h3>
          </div>
          <div className="space-y-4 text-slate-600 dark:text-slate-300 leading-relaxed text-[15px]">
            <p>
              Wolter Kuch is a South Sudanese college student with a profound mission: to
              dismantle the barriers that prevent quality education from reaching every
              corner of the globe. Growing up with an awareness of educational
              disparities in different regions, Wolter envisioned a world where location,
              economic status, or infrastructure would no longer dictate a student's potential.
            </p>
            <p>
              <strong className="text-slate-900 dark:text-white">EduAI</strong> is the manifestation of that vision—a platform engineered from the ground up to provide world-class tutoring, offline-first reading tools, and contextual intelligence to anyone with a browser.
            </p>
          </div>
        </div>

        {/* Core Architectural Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          <div className="bg-blue-50/70 dark:bg-blue-950/30 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/40">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center mb-3">
              <Globe className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-blue-950 dark:text-blue-200 mb-2 text-base font-display">Global Accessibility</h4>
            <p className="text-blue-800/80 dark:text-blue-300/80 leading-relaxed text-sm">
              Engineered with an ultra-lightweight client footprint that works across low-bandwidth environments to ensure students in remote areas are never left behind.
            </p>
          </div>
          
          <div className="bg-purple-50/70 dark:bg-purple-950/30 p-6 rounded-2xl border border-purple-100 dark:border-purple-900/40">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center mb-3">
              <Cpu className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-purple-950 dark:text-purple-200 mb-2 text-base font-display">AI for Equity</h4>
            <p className="text-purple-800/80 dark:text-purple-300/80 leading-relaxed text-sm">
              Leveraging advanced models to provide personalized, high-quality tutoring and contextual deep dives that were previously only accessible to a few.
            </p>
          </div>

          <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mb-3">
              <Shield className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-emerald-950 dark:text-emerald-200 mb-2 text-base font-display">Offline & Privacy First</h4>
            <p className="text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed text-sm">
              Powered by IndexedDB v2 for full offline textbook caching, 0ms latency page flips, zero third-party ad telemetry, and secure local annotation sync.
            </p>
          </div>

          <div className="bg-amber-50/70 dark:bg-amber-950/30 p-6 rounded-2xl border border-amber-100 dark:border-amber-900/40">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-amber-950 dark:text-amber-200 mb-2 text-base font-display">Ergonomic Reader UI</h4>
            <p className="text-amber-800/80 dark:text-amber-300/80 leading-relaxed text-sm">
              Custom-built multi-theme rendering (Sepia, Charcoal Obsidian, AMOLED Black) and bottom floating capsule dock designed to reduce visual fatigue.
            </p>
          </div>
        </div>

        {/* Contact & Inquiries */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <div className="text-sm font-bold text-slate-900 dark:text-white">Get in touch with Wolter</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Inquiries regarding curriculum partnerships, research collaboration, or platform architecture.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyEmail}
              className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              {copiedEmail ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5 text-indigo-500" />
                  Copy Email
                </>
              )}
            </button>
            <a
              href="mailto:dicksonskello09@gmail.com"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              Send Message
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
