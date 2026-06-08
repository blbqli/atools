"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Locale } from "../i18n/locales";
import type { Messages } from "../i18n/messages";
import {
  applyClarityConsent,
  ensureClarityLoaded,
  getClarityEffectiveConsent,
  getClarityProjectId,
  getClarityVisitedTags,
  isClarityEnabled,
  readClarityConsent,
  setClarityTag,
  writeClarityConsent,
  type ClarityConsentState,
} from "../lib/clarity";

const clarityProjectId = getClarityProjectId();
const clarityEnabled = isClarityEnabled();

function createEmptySentTagMap() {
  return {
    visited_locale: new Set<string>(),
    visited_page_type: new Set<string>(),
    visited_tool_slug: new Set<string>(),
  };
}

function subscribeToNothing() {
  return () => {};
}

export default function ClarityConsentManager({
  locale,
  messages,
}: Readonly<{
  locale: Locale;
  messages: Messages;
}>) {
  const pathname = usePathname();
  const [localConsent, setLocalConsent] = useState<ClarityConsentState | null | undefined>(undefined);
  const [bannerOpen, setBannerOpen] = useState(false);
  const sentTagsRef = useRef(createEmptySentTagMap());
  const storedConsent = useSyncExternalStore(
    subscribeToNothing,
    () => (clarityEnabled ? readClarityConsent() : null),
    () => null,
  );
  const hydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const consent = localConsent === undefined ? storedConsent : localConsent;
  const effectiveConsent = getClarityEffectiveConsent(consent);
  const hasStoredChoice = consent !== null;

  useEffect(() => {
    if (!clarityEnabled || !hydrated) {
      return;
    }

    ensureClarityLoaded(clarityProjectId);
    applyClarityConsent(effectiveConsent);

    const tags = getClarityVisitedTags(pathname);
    if (!tags) {
      return;
    }

    for (const [key, value] of Object.entries(tags)) {
      if (!value) {
        continue;
      }

      const sentValues = sentTagsRef.current[key as keyof typeof sentTagsRef.current];
      if (sentValues?.has(value)) {
        continue;
      }

      sentValues?.add(value);
      setClarityTag(key, value);
    }
  }, [effectiveConsent, hydrated, pathname]);

  if (!clarityEnabled) {
    return null;
  }

  const persistConsent = (value: ClarityConsentState) => {
    writeClarityConsent(value);
    setLocalConsent(value);
    setBannerOpen(false);

    ensureClarityLoaded(clarityProjectId);
    applyClarityConsent(value);

    if (value === "denied") {
      sentTagsRef.current = createEmptySentTagMap();
    }
  };

  const showBanner = hydrated && (bannerOpen || consent === null);

  return (
    <>
      <button
        type="button"
        onClick={() => setBannerOpen(true)}
        className="transition-colors hover:text-slate-700"
      >
        {messages.navAnalyticsSettings}
      </button>

      {showBanner ? (
        <div className="fixed inset-x-4 bottom-4 z-[60] mx-auto w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/95 p-5 text-left shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{messages.clarityConsentTitle}</h2>
              <p className="mt-2 text-xs leading-6 text-slate-600">
                {messages.clarityConsentDescription}{" "}
                <Link
                  href={`/${locale}/privacy-policy`}
                  className="text-blue-600 underline underline-offset-4 hover:text-blue-700"
                >
                  {messages.navPrivacy}
                </Link>
              </p>
            </div>
            {hasStoredChoice ? (
              <button
                type="button"
                onClick={() => setBannerOpen(false)}
                className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
                aria-label={messages.clarityConsentClose}
              >
                {messages.clarityConsentClose}
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => persistConsent("granted")}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800"
            >
              {messages.clarityConsentAllow}
            </button>
            <button
              type="button"
              onClick={() => persistConsent("denied")}
              className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
            >
              {messages.clarityConsentDeny}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
