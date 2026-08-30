"use client";

import { useEffect } from "react";

/** Registers the small offline shell without coupling App Router to a PWA plugin. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  return null;
}
