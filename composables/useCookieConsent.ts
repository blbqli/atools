import type { ClarityFunction, CookieConsentChoice } from "~/types/cookie-consent";
import {
  ADSENSE_CLIENT_ID,
  CLARITY_PROJECT_ID,
  COOKIE_CONSENT_STORAGE_KEY,
  MONETAG_MULTITAG_ZONE_ID,
  MONETAG_ONCLICK_ZONE_ID,
  OPTIONAL_SCRIPT_IDS,
} from "~/utils/cookie-consent";

const appendScript = (
  id: string,
  src: string,
  attributes: Record<string, string> = {},
) => {
  if (document.getElementById(id)) {
    return;
  }

  const script = document.createElement("script");
  script.id = id;
  script.src = src;
  script.async = true;

  Object.entries(attributes).forEach(([name, value]) => {
    script.setAttribute(name, value);
  });

  document.body.appendChild(script);
};

export const useCookieConsent = () => {
  const choice = useState<CookieConsentChoice>("cookie-consent-choice", () => null);
  const isOpen = useState<boolean>("cookie-consent-open", () => false);
  const isInitialized = useState<boolean>("cookie-consent-initialized", () => false);

  const loadOptionalScripts = () => {
    if (!import.meta.client || import.meta.dev) {
      return;
    }

    appendScript(
      OPTIONAL_SCRIPT_IDS.monetagMultitag,
      `https://5gvci.com/act/files/tag.min.js?z=${MONETAG_MULTITAG_ZONE_ID}`,
      { "data-cfasync": "false" },
    );
    appendScript(OPTIONAL_SCRIPT_IDS.monetagOnclick, "https://nap5k.com/tag.min.js", {
      "data-zone": MONETAG_ONCLICK_ZONE_ID,
    });
    appendScript(
      OPTIONAL_SCRIPT_IDS.adsense,
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`,
      { crossorigin: "anonymous" },
    );

    const clarityWindow = window as Window & { clarity?: ClarityFunction };
    if (!clarityWindow.clarity) {
      const clarity: ClarityFunction = (...args: unknown[]) => {
        clarity.q ||= [];
        clarity.q.push(args);
      };
      clarityWindow.clarity = clarity;
    }
    appendScript(
      OPTIONAL_SCRIPT_IDS.clarity,
      `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`,
    );
  };

  const initialize = () => {
    if (!import.meta.client || isInitialized.value) {
      return;
    }

    const storedChoice = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    choice.value =
      storedChoice === "accepted" || storedChoice === "rejected" ? storedChoice : null;
    isOpen.value = choice.value === null;
    isInitialized.value = true;

    if (choice.value === "accepted") {
      loadOptionalScripts();
    }
  };

  const accept = () => {
    if (!import.meta.client) {
      return;
    }

    choice.value = "accepted";
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice.value);
    isOpen.value = false;
    loadOptionalScripts();
  };

  const reject = () => {
    if (!import.meta.client) {
      return;
    }

    const optionalScriptsWereLoaded = choice.value === "accepted";
    choice.value = "rejected";
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice.value);
    isOpen.value = false;

    if (optionalScriptsWereLoaded) {
      window.location.reload();
    }
  };

  const openPreferences = () => {
    isOpen.value = true;
  };

  const closePreferences = () => {
    if (choice.value !== null) {
      isOpen.value = false;
    }
  };

  return {
    accept,
    choice: readonly(choice),
    closePreferences,
    initialize,
    isOpen: readonly(isOpen),
    openPreferences,
    reject,
  };
};
