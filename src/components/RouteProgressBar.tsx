"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

function isInternalNavigationAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  const el = target instanceof Element ? target : null;
  const anchor = el?.closest("a[href]") as HTMLAnchorElement | null;
  if (!anchor) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;

  const href = anchor.getAttribute("href") || "";
  if (!href) return null;
  if (href.startsWith("#")) return null;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return null;

  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
    return anchor;
  } catch {
    return null;
  }
}

export default function RouteProgressBar() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastPathRef = useRef(pathname);
  const intervalRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const failsafeTimeoutRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (failsafeTimeoutRef.current) {
      window.clearTimeout(failsafeTimeoutRef.current);
      failsafeTimeoutRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    clearTimers();
    setProgress(1);
    hideTimeoutRef.current = window.setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 220);
  }, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    setActive(true);
    setProgress((prev) => (prev > 0.15 ? prev : 0.15));

    intervalRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 0.92) return prev;
        const next = prev + (1 - prev) * 0.08;
        return Math.min(0.92, next);
      });
    }, 120);

    // If navigation never completes (error/offline), don't leave it stuck.
    failsafeTimeoutRef.current = window.setTimeout(() => {
      finish();
    }, 12000);
  }, [clearTimers, finish]);

  useEffect(() => {
    if (lastPathRef.current !== pathname) {
      lastPathRef.current = pathname;
      if (active) {
        const id = window.setTimeout(() => finish(), 0);
        return () => window.clearTimeout(id);
      }
    }
  }, [active, finish, pathname]);

  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = isInternalNavigationAnchor(e.target);
      if (!anchor) return;
      start();
    };

    const onPopState = () => start();

    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
  }, [clearTimers, start]);

  return (
    <div
      className={`fixed left-0 top-0 z-[100] h-[3px] w-full transition-opacity duration-200 ${
        active ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden="true"
    >
      <div
        className="h-full w-full origin-left bg-blue-600"
        style={{
          transform: `scaleX(${Math.max(0, Math.min(1, progress))})`,
          transition: active ? "transform 120ms linear" : "none",
        }}
      />
    </div>
  );
}
