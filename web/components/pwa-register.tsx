'use client';

import { useEffect } from 'react';

/** Registers the service worker that makes TUGON installable and shows an offline page. */
export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);
  return null;
}
