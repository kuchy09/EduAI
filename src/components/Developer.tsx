import { Code } from 'lucide-react';

export function Developer() {
  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-12">
      {/* Top Banner section */}
      <div className="flex flex-col items-center mt-8">
        <div className="relative mb-6">
          <div className="w-32 h-32 rounded-full border border-purple-100 bg-white shadow-sm flex items-center justify-center overflow-hidden">
            <span className="text-slate-400 text-lg">Wolter Kuch</span>
          </div>
          <div className="absolute bottom-0 right-0 w-10 h-10 bg-[#8b3dff] rounded-full flex items-center justify-center border-4 border-white shadow-sm">
            <Code className="w-5 h-5 text-white" />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-2 font-display">Wolter Kuch</h1>
        <p className="text-lg text-slate-500 font-medium mb-8">Lead Creator & Architect</p>
        
        <div className="flex flex-wrap gap-3 justify-center">
          <span className="px-5 py-2.5 bg-slate-100 text-slate-800 rounded-full text-sm font-bold">Software Developer</span>
          <span className="px-5 py-2.5 bg-slate-100 text-slate-800 rounded-full text-sm font-bold">Offensive Security Researcher</span>
          <span className="px-5 py-2.5 bg-slate-100 text-slate-800 rounded-full text-sm font-bold">AI Engineer</span>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-2xl font-bold text-slate-900 mb-6 font-display">The Vision</h3>
          <div className="space-y-6 text-slate-600 leading-relaxed text-[15px]">
            <p>
              Wolter Kuch is a South Sudanese college student with a profound mission: to
              dismantle the barriers that prevent quality education from reaching every
              corner of the globe. Growing up with an awareness of the educational
              disparities in different regions, Wolter envisioned a world where location,
              economic status, or infrastructure would no longer dictate a student's potential.
            </p>
            <p>
              EduAI is the manifestation of that vision—a platform designed to provide world-class tutoring and resources to anyone with an internet connection.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50/50 p-8 rounded-3xl border border-blue-100/50">
            <h4 className="font-bold text-[#1e3a8a] mb-3 text-lg font-display">Global Accessibility</h4>
            <p className="text-blue-700/80 leading-relaxed text-[15px]">
              Building tools that work across low-bandwidth environments to ensure
              students in remote areas are never left behind.
            </p>
          </div>
          
          <div className="bg-purple-50/50 p-8 rounded-3xl border border-purple-100/50">
            <h4 className="font-bold text-[#4c1d95] mb-3 text-lg font-display">AI for Equity</h4>
            <p className="text-purple-700/80 leading-relaxed text-[15px]">
              Leveraging advanced AI to provide personalized, high-quality tutoring that
              was previously only accessible to a few.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
