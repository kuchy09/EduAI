import { Map, CheckCircle2, Circle, Sparkles, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface LearningStep {
  title: string;
  status: string;
  duration: string;
}

interface LearningPathProps {
  user: any;
}

export function LearningPath({ user }: LearningPathProps) {
  const [steps, setSteps] = useState<LearningStep[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const fieldOfStudy = user?.user_metadata?.field_of_study || 'General Studies';
  const subjects = user?.user_metadata?.subjects || 'core concepts';

  useEffect(() => {
    // Generate an initial default path based on the user's field
    setSteps([
      { title: `Foundations of ${fieldOfStudy}`, status: 'completed', duration: '2 weeks' },
      { title: `Advanced Topics in ${subjects}`, status: 'current', duration: '3 weeks' },
      { title: `Practical Applications & Projects`, status: 'upcoming', duration: '4 weeks' },
    ]);
  }, [fieldOfStudy, subjects]);

  const generatePersonalizedPath = async () => {
    setIsGenerating(true);
    setError('');
    try {
      const allowDataCollection = JSON.parse(localStorage.getItem('privacy_data') ?? 'true');
      
      const requestBody = allowDataCollection 
        ? {
            userStyle: "Visual learner, needs hands-on exercises",
            readingHabits: `Reads late night, studying ${fieldOfStudy} and ${subjects}`,
            currentProgress: `Finished Foundations of ${fieldOfStudy} recently.`
          }
        : {
             userStyle: "Standard",
             readingHabits: "Standard",
             currentProgress: "Standard"
          };

      const response = await fetch('/api/learning-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate learning path');
      }

      const data = await response.json();
      if (data.steps) {
        setSteps(data.steps);
      }
    } catch (err: any) {
      setError(err.message || 'Could not generate personalized path. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight mb-2">Learning Path</h2>
          <p className="text-slate-500">Your AI-generated curriculum based on reading habits.</p>
        </div>
        <button 
          onClick={generatePersonalizedPath}
          disabled={isGenerating}
          className="bg-brand-600 hover:bg-brand-700 text-white rounded-full px-5 py-2.5 flex items-center justify-center gap-2 font-medium text-sm transition-colors shadow-sm shrink-0 disabled:opacity-75 disabled:hover:bg-brand-600"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>{isGenerating ? 'Analyzing Style...' : 'Personalize Path'}</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <div className="space-y-8">
          {steps.map((step, idx) => (
            <div key={idx} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-8">
                  {step.status === 'completed' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 bg-white" />
                  ) : step.status === 'current' ? (
                    <div className="w-5 h-5 rounded-full border-[5px] border-brand-500 bg-white" />
                  ) : (
                    <Circle className="w-6 h-6 text-slate-300 bg-white" />
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div className={`w-0.5 h-full mt-2 -mb-2 ${step.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                )}
              </div>
              <div className={`pb-8 ${idx === steps.length - 1 ? 'pb-0' : ''}`}>
                <h3 className={`text-lg font-semibold ${step.status === 'upcoming' ? 'text-slate-500' : 'text-slate-900'}`}>{step.title}</h3>
                <p className="text-sm text-slate-500 mt-1">Estimated duration: {step.duration}</p>
                {step.status === 'current' && (
                  <button className="mt-4 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">
                    Continue Learning
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
