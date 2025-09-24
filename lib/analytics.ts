declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, unknown>) => void;
    };
  }
}

export function trackEvent(event: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  if (typeof window.umami?.track === 'function') {
    try {
      window.umami.track(event, data);
    } catch (error) {
      console.warn('umami trackEvent failed', error);
    }
  }
}

export {}; // ensure this file is treated as a module
