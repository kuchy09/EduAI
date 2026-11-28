import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Smartphone,
  CheckCircle2,
  X,
  Copy,
  Check,
  ExternalLink,
  Share,
  MoreVertical,
  Wrench,
} from 'lucide-react';
import { usePWAInstall } from '../lib/usePWAInstall';
import { triggerCapsuleFeedback } from '../lib/feedback';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'card' | 'button';
  onOpenAndroidSettings?: () => void;
  onActionDone?: () => void;
}

interface AndroidManifestInfo {
  apkAvailable?: boolean;
  apkDownloadUrl?: string | null;
  appId?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  onOpenAndroidSettings,
  onActionDone,
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInIframe, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [androidInfo, setAndroidInfo] = useState<AndroidManifestInfo | null>(null);

  useEffect(() => {
    if (!showGuideModal) return;
    fetch('/api/android/manifest')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setAndroidInfo(data);
      })
      .catch(() => {});
  }, [showGuideModal]);

  const directAppUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/` : 'https://myeduai.vercel.app/';

  const handleInstallClick = async () => {
    triggerCapsuleFeedback({ pitch: 640, volume: 0.16, hapticDuration: 12 });
    if (isInstallable) {
      setInstalling(true);
      try {
        const accepted = await install();
        if (accepted) {
          onActionDone?.();
          return;
        }
      } finally {
        setInstalling(false);
      }
    }
    setShowGuideModal(true);
  };

  const handleCopyUrl = () => {
    navigator.clipboard?.writeText(directAppUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2200);
  };

  // Hide compact triggers when already installed as standalone/native Android app
  if (isInstalled && variant !== 'card') {
    return null;
  }

  const modalNode =
    showGuideModal && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#171E24] border border-[#E2DDD3] dark:border-[#26313A] shadow-2xl p-6 space-y-5 text-slate-900 dark:text-[#EDF2F4]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold leading-tight">
                      Install Edu AI on Your Phone
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Offline textbooks, full-screen study mode &amp; home screen launch
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  aria-label="Close install guide"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isInstallable && (
                <button
                  type="button"
                  disabled={installing}
                  onClick={handleInstallClick}
                  className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {installing ? 'Opening Android Installer...' : 'Install Edu AI Now'}
                </button>
              )}

              {!isIOS ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-[#F7F5F0] dark:bg-[#11161A] border border-[#E2DDD3] dark:border-[#26313A] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-400">
                        Android Installation (Chrome / Edge)
                      </span>
                      {isAndroid && (
                        <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                          Android Detected
                        </span>
                      )}
                    </div>

                    {isInIframe && (
                      <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                        You are viewing Edu AI inside a preview frame. Open the direct app URL in{' '}
                        <strong>Chrome on your Android phone</strong> to see the one-tap{' '}
                        <strong>Install app</strong> prompt.
                      </div>
                    )}

                    <ol className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                          1
                        </span>
                        <span>
                          Open this URL directly in <strong>Google Chrome</strong> on your Android
                          phone.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                          2
                        </span>
                        <span className="flex flex-wrap items-center gap-1">
                          Tap the Chrome menu <MoreVertical className="w-3.5 h-3.5 inline" /> and
                          choose <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
                        </span>
                      </li>
                    </ol>

                    <div className="pt-1 flex items-center gap-2">
                      <div className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#171E24] border border-[#E2DDD3] dark:border-[#26313A] text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate">
                        {directAppUrl}
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyUrl}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-brand-600 text-white text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer hover:opacity-90"
                      >
                        {copiedUrl ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy URL
                          </>
                        )}
                      </button>
                      {isInIframe && (
                        <a
                          href={directAppUrl}
                          target="_top"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg border border-brand-600 text-brand-700 dark:text-brand-300 text-xs font-semibold flex items-center gap-1 shrink-0 hover:bg-brand-50 dark:hover:bg-brand-950/30"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open
                        </a>
                      )}
                    </div>
                  </div>

                  {androidInfo?.apkAvailable && androidInfo?.apkDownloadUrl && (
                    <a
                      href={androidInfo.apkDownloadUrl}
                      download="eduai-android.apk"
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download Android APK ({androidInfo.appId || 'io.supabase.eduai'})
                    </a>
                  )}
                  <a
                    href="/api/android/studio-bundle.zip"
                    download="eduai-android-studio.zip"
                    className="w-full py-2 px-4 rounded-xl border border-[#E2DDD3] dark:border-[#26313A] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Android Studio Project (.zip)
                  </a>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#F7F5F0] dark:bg-[#11161A] border border-[#E2DDD3] dark:border-[#26313A] space-y-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-400">
                    iPhone / iPad (Safari Web App)
                  </div>
                  <ol className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                        1
                      </span>
                      <span>
                        Tap the <Share className="w-3.5 h-3.5 inline mx-0.5" />{' '}
                        <strong>Share</strong> button in Safari&apos;s toolbar.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                        2
                      </span>
                      <span>
                        Scroll down and tap <strong>Add to Home Screen</strong>.
                      </span>
                    </li>
                  </ol>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#E2DDD3] dark:border-[#26313A]">
                {onOpenAndroidSettings ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowGuideModal(false);
                      onActionDone?.();
                      onOpenAndroidSettings();
                    }}
                    className="text-xs font-semibold text-brand-700 dark:text-brand-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Android Studio &amp; APK Tools
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Android-first · iOS web app ready
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="px-4 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-xs font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  if (variant === 'card') {
    return (
      <>
        {isInstalled ? (
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            Installed as Standalone App
          </div>
        ) : (
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4" />
            {isInstallable ? 'Install App to Phone' : 'Install on Android / Phone'}
          </button>
        )}
        {modalNode}
      </>
    );
  }

  if (variant === 'sidebar') {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition-all cursor-pointer text-xs font-semibold shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 shrink-0" />
            <span>{isInstallable ? 'Install Android App' : 'Install on Phone'}</span>
          </div>
          <Download className="w-3.5 h-3.5 shrink-0 opacity-90" />
        </button>
        {modalNode}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className={`pointer-events-auto relative h-10 sm:h-11 px-3 sm:px-3.5 rounded-full liquid-glass-dock hover:scale-[1.03] active:scale-95 flex items-center gap-1.5 transition-all duration-200 cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
          isInstallable
            ? 'text-brand-700 dark:text-brand-300 ring-1 ring-brand-500/40'
            : 'text-slate-700 dark:text-slate-200'
        }`}
        title={isInstallable ? 'Install Edu AI on your device' : 'Install Edu AI on Android / Phone'}
        aria-label="Install Edu AI App"
      >
        <Download className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
        <span className="hidden sm:inline text-xs font-semibold whitespace-nowrap">
          Install App
        </span>
      </button>
      {modalNode}
    </>
  );
};
