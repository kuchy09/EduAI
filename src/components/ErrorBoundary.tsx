import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { safeStorage, safeSessionStorage } from '../lib/safeStorage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    try {
      fetch('/api/client-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'react_error_boundary',
          error: error?.message || String(error),
          stack: error?.stack,
          componentStack: errorInfo?.componentStack
        })
      }).catch(function() {});
    } catch (_) {}
  }

  private handleReset = () => {
    try {
      safeSessionStorage.removeItem('edu_ai_current_view');
      safeSessionStorage.removeItem('edu_ai_active_book');
      safeStorage.removeItem('edu_ai_current_view');
      safeStorage.removeItem('edu_ai_active_book');
    } catch (_) {}
    this.setState({ hasError: false, error: null });
    try {
      window.location.reload();
    } catch (_) {}
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">
                Something didn't load smoothly
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                An unexpected display issue occurred. You can safely return to the home screen without losing your reading data.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-left overflow-x-auto text-[11px] font-mono text-slate-700 dark:text-slate-300 max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
              >
                <Home className="w-4 h-4" />
                Return to Home
              </button>
              <button
                onClick={() => {
                  try {
                    safeSessionStorage.removeItem('edu_ai_current_view');
                    safeSessionStorage.removeItem('edu_ai_active_book');
                    safeStorage.removeItem('edu_ai_current_view');
                    safeStorage.removeItem('edu_ai_active_book');
                  } catch (_) {}
                  try {
                    window.location.reload();
                  } catch (_) {}
                }}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
