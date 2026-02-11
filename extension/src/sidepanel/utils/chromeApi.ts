/* global chrome */

export function tabsQuery(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve) => chrome.tabs.query(queryInfo, resolve));
}

export function tabsCreate(createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> {
  return new Promise((resolve) => chrome.tabs.create(createProperties, resolve));
}

export function downloadsDownload(
  options: chrome.downloads.DownloadOptions,
): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(options, (downloadId) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(downloadId);
    });
  });
}

export function scriptingExecuteScript<Args extends unknown[], Result>(
  details: chrome.scripting.ScriptInjection<Args, Result>,
): Promise<chrome.scripting.InjectionResult<Result>[]> {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(details, (results) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(results as chrome.scripting.InjectionResult<Result>[]);
    });
  });
}

export function captureVisibleTab(
  windowId: number,
  options: chrome.tabs.CaptureVisibleTabOptions,
): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(windowId, options, (dataUrl) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(dataUrl);
    });
  });
}
