import { useEffect, useState } from 'react';

const DISMISS_KEY = 'roofcalc_pwa_install_dismissed_v1';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // Re-allow subtle prompt after 7 days

export function isRunningStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator?.standalone === true
  );
}

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isDismissedRecently() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export function dismissPwaBanner() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Shared React hook for Installable PWA state across Android Chrome, Edge, Desktop & iOS Safari.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => isRunningStandalone());
  const [bannerDismissed, setBannerDismissed] = useState(() => isDismissedRecently());
  const [iosGuideOpen, setIosGuideOpen] = useState(false);

  const isIos = isIosDevice();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIosGuideOpen(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const canInstall = !isInstalled && (Boolean(deferredPrompt) || isIos);
  const showBanner = canInstall && !bannerDismissed;

  const triggerInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
        return true;
      } catch {
        return false;
      }
    }
    if (isIos && !isInstalled) {
      setIosGuideOpen(true);
      return true;
    }
    return false;
  };

  const dismissBanner = () => {
    dismissPwaBanner();
    setBannerDismissed(true);
  };

  return {
    isInstalled,
    isIos,
    canInstall,
    showBanner,
    iosGuideOpen,
    setIosGuideOpen,
    triggerInstall,
    dismissBanner,
  };
}
