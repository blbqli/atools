import { isLocale } from "../i18n/locales";

export type ClarityConsentState = "granted" | "denied";

export const CLARITY_CONSENT_STORAGE_KEY = "atools_clarity_consent";

const CLARITY_SCRIPT_SRC_PREFIX = "https://www.clarity.ms/tag/";

export function getClarityProjectId() {
  return String(process.env.NEXT_PUBLIC_CLARITY_ID || "").trim();
}

export function isClarityEnabled() {
  return getClarityProjectId().length > 0;
}

export function getClarityEffectiveConsent(consent: ClarityConsentState | null | undefined): ClarityConsentState {
  return consent === "granted" ? "granted" : "denied";
}

export function buildClarityBootstrapScript(projectId: string) {
  const serializedProjectId = JSON.stringify(projectId);
  const serializedStorageKey = JSON.stringify(CLARITY_CONSENT_STORAGE_KEY);

  return `
    (function () {
      var projectId = ${serializedProjectId};
      var storageKey = ${serializedStorageKey};
      if (!projectId) return;

      var consent = "denied";
      try {
        var stored = window.localStorage.getItem(storageKey);
        if (stored === "granted" || stored === "denied") consent = stored;
      } catch (e) {}

      window.clarity = window.clarity || function () {
        (window.clarity.q = window.clarity.q || []).push(arguments);
      };
      window.__atoolsClarityLoaded = true;
      window.clarity("consentv2", {
        ad_Storage: "denied",
        analytics_Storage: consent
      });

      var script = document.createElement("script");
      script.async = true;
      script.src = "https://www.clarity.ms/tag/" + projectId;
      var firstScript = document.getElementsByTagName("script")[0];
      if (firstScript && firstScript.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript);
        return;
      }

      document.head.appendChild(script);
    })();
  `;
}

export function readClarityConsent(): ClarityConsentState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(CLARITY_CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function writeClarityConsent(value: ClarityConsentState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(CLARITY_CONSENT_STORAGE_KEY, value);
  } catch {
    // Ignore storage failures and keep the in-memory state for the current page.
  }
}

export function ensureClarityLoaded(projectId: string) {
  if (typeof window === "undefined" || typeof document === "undefined" || !projectId) {
    return;
  }

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[src="${CLARITY_SCRIPT_SRC_PREFIX}${projectId}"]`,
  );
  if (existingScript) {
    window.__atoolsClarityLoaded = true;
    return;
  }

  if (!window.clarity) {
    const clarity: NonNullable<Window["clarity"]> = (...args: unknown[]) => {
      clarity.q = clarity.q || [];
      clarity.q.push(args);
    };
    window.clarity = clarity;
  }

  if (window.__atoolsClarityLoaded) {
    return;
  }

  window.__atoolsClarityLoaded = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `${CLARITY_SCRIPT_SRC_PREFIX}${projectId}`;
  document.head.appendChild(script);
}

export function applyClarityConsent(value: ClarityConsentState) {
  if (typeof window === "undefined" || !window.clarity) {
    return;
  }

  window.clarity("consentv2", {
    ad_Storage: "denied",
    analytics_Storage: value,
  });
}

export function setClarityTag(key: string, value: string) {
  if (typeof window === "undefined" || !window.clarity) {
    return;
  }

  window.clarity("set", key, value);
}

export function getClarityVisitedTags(pathname: string) {
  const cleanPath = pathname.split("?")[0] || "/";
  const segments = cleanPath.split("/").filter(Boolean);
  const maybeLocale = segments[0];

  if (!maybeLocale || !isLocale(maybeLocale)) {
    return null;
  }

  const tags: Record<string, string> = {
    visited_locale: maybeLocale,
  };

  if (segments.length === 1) {
    tags.visited_page_type = "home";
    return tags;
  }

  if (segments[1] === "tools" && segments[2]) {
    tags.visited_page_type = "tool";
    tags.visited_tool_slug = segments[2];
    return tags;
  }

  if (segments[1] === "privacy-policy") {
    tags.visited_page_type = "privacy-policy";
    return tags;
  }

  tags.visited_page_type = "other";
  return tags;
}
