"use client";

import type { FC } from "react";
import { useEffect, useState } from "react";
import { useOptionalI18n } from "../i18n/I18nProvider";
import { getMessages } from "../i18n/messages";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const PwaActionsBar: FC = () => {
  const i18n = useOptionalI18n();
  const messages = i18n?.messages ?? getMessages("zh-cn");
  const [canShare, setCanShare] = useState(false);
  const [shareInProgress, setShareInProgress] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAtPageTop, setIsAtPageTop] = useState(true);
  const [title, setTitle] = useState<string>(messages.siteName);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
    setTitle(document.title || messages.siteName);

    const displayModeStandalone =
      window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches;
    const navigatorStandalone =
      typeof navigator !== "undefined" &&
      Boolean((navigator as unknown as { standalone?: boolean }).standalone);
    setIsStandalone(displayModeStandalone || navigatorStandalone);

    const userAgent = window.navigator.userAgent || "";
    setIsIos(/iphone|ipad|ipod/i.test(userAgent));

    const updateTopState = () => {
      setIsAtPageTop(window.scrollY < 24);
    };
    updateTopState();

    const handleBeforeInstallPrompt = (
      event: Event,
    ): void | BeforeInstallPromptEvent => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
      return undefined;
    };

    window.addEventListener("scroll", updateTopState, { passive: true });
    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt as EventListener,
    );

    return () => {
      window.removeEventListener("scroll", updateTopState);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt as EventListener,
      );
    };
  }, [messages.siteName]);

  const handleShare = async () => {
    if (typeof navigator === "undefined") return;
    try {
      setShareInProgress(true);
      const url =
        typeof window !== "undefined" ? window.location.href : undefined;
      if (canShare) {
        await navigator.share({
          title,
          text: title,
          url,
        });
        return;
      }

      if (url && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // 用户取消或不支持时静默失败
    } finally {
      setShareInProgress(false);
    }
  };

  const handleInstall = async () => {
    if (isStandalone) return;

    if (installPromptEvent) {
      try {
        await installPromptEvent.prompt();
        void installPromptEvent.userChoice;
      } finally {
        setInstallPromptEvent(null);
      }
      return;
    }

    if (isIos && typeof window !== "undefined") {
      // iOS 不会触发 beforeinstallprompt，提示用户手动添加到桌面
      window.alert(
        messages.iosInstallHint,
      );
    }
  };

  const showInstallButton = !isStandalone;
  const showShareButton = true;

  if (!showInstallButton && !showShareButton) {
    return null;
  }

  return (
    <>
      <div
        className={`mb-6 flex justify-end gap-2 text-xs text-slate-500 transition-all duration-200 ${
          isAtPageTop ? "opacity-100" : "pointer-events-none -mb-2 h-0 overflow-hidden opacity-0 sm:-mb-2"
        }`}
      >
        {showShareButton && (
          <button
            type="button"
            onClick={handleShare}
            disabled={shareInProgress}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 py-1 font-medium shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.97]"
          >
            <svg
              className="h-3.5 w-3.5 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 9.75L12 6m0 0l3.75 3.75M12 6v12"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12a7.5 7.5 0 0115 0v4.5a2.25 2.25 0 01-2.25 2.25h-10.5A2.25 2.25 0 014.5 16.5V12z"
              />
            </svg>
            <span>{shareInProgress ? messages.sharing : messages.shareCurrentPage}</span>
          </button>
        )}
        {showInstallButton && (
          <button
            type="button"
            onClick={handleInstall}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-900 px-3 py-1 font-medium text-white shadow-sm backdrop-blur-sm transition hover:bg-slate-800 active:scale-[0.97]"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 5v10m0 0l-3.5-3.5M12 15l3.5-3.5M6 19h12"
              />
            </svg>
            <span>{messages.installAsApp}</span>
          </button>
        )}
      </div>

      <div
        className={`fixed bottom-5 right-5 z-50 flex flex-col gap-2 text-xs text-slate-500 transition-all duration-200 sm:bottom-6 sm:right-6 ${
          isAtPageTop ? "pointer-events-none translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        {showShareButton && (
          <button
            type="button"
            onClick={handleShare}
            disabled={shareInProgress}
            title={shareInProgress ? messages.sharing : messages.shareCurrentPage}
            aria-label={shareInProgress ? messages.sharing : messages.shareCurrentPage}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/90 font-medium shadow-lg shadow-slate-900/10 backdrop-blur-sm transition hover:border-slate-300 hover:bg-white active:scale-[0.97]"
          >
            <svg
              className="h-4 w-4 text-slate-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 9.75L12 6m0 0l3.75 3.75M12 6v12"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12a7.5 7.5 0 0115 0v4.5a2.25 2.25 0 01-2.25 2.25h-10.5A2.25 2.25 0 014.5 16.5V12z"
              />
            </svg>
          </button>
        )}
        {showInstallButton && (
          <button
            type="button"
            onClick={handleInstall}
            title={messages.installAsApp}
            aria-label={messages.installAsApp}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-900 bg-slate-900 font-medium text-white shadow-lg shadow-slate-900/20 backdrop-blur-sm transition hover:bg-slate-800 active:scale-[0.97]"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 5v10m0 0l-3.5-3.5M12 15l3.5-3.5M6 19h12"
              />
            </svg>
          </button>
        )}
      </div>
    </>
  );
};

export { PwaActionsBar };
