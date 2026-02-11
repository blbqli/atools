/* global chrome */

chrome.runtime.onInstalled.addListener(() => {
  if (!chrome.sidePanel?.setPanelBehavior) return;
  try {
    const maybePromise = chrome.sidePanel.setPanelBehavior(
      { openPanelOnActionClick: true },
      () => void chrome.runtime.lastError,
    ) as unknown;
    if (maybePromise && typeof (maybePromise as { catch?: unknown }).catch === "function") {
      (maybePromise as Promise<void>).catch(() => undefined);
    }
  } catch {
    // Ignore.
  }
});
