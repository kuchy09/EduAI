import { LifeBuoy, Mail, MessageSquare } from 'lucide-react';

export function Support() {
  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6 sm:space-y-8">
      <div className="text-center pb-6 md:pb-8 border-b border-slate-200">
        <LifeBuoy className="w-12 h-12 text-brand-500 mx-auto mb-4" />
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight mb-2">How can we help?</h2>
        <p className="text-slate-500 max-w-lg mx-auto">Get help with your account, reading tools, or the AI tutor.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col items-center text-center space-y-4">
          <MessageSquare className="w-8 h-8 text-slate-700" />
          <h3 className="text-lg font-bold text-slate-900">Live Chat</h3>
          <p className="text-sm text-slate-500">Chat with our support team in real-time for quick answers.</p>
          <button className="mt-auto w-full bg-brand-50 text-brand-700 hover:bg-brand-100 py-2.5 rounded-xl font-medium transition-colors">
            Start Chat
          </button>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col items-center text-center space-y-4">
          <Mail className="w-8 h-8 text-slate-700" />
          <h3 className="text-lg font-bold text-slate-900">Email Support</h3>
          <p className="text-sm text-slate-500">Send us a detailed message and we'll reply within 24 hours.</p>
          <button className="mt-auto w-full bg-slate-100 text-slate-700 hover:bg-slate-200 py-2.5 rounded-xl font-medium transition-colors">
            Send Email
          </button>
        </div>
      </div>
    </div>
  );
}
