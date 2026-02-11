import { captureVisibleTab, downloadsDownload, scriptingExecuteScript, tabsQuery } from "./chromeApi";

const MAX_CANVAS_HEIGHT = 30_000;
const MAX_CAPTURE_STEPS = 240;

const HEADER_SAMPLE_WIDTH = 80;
const HEADER_SAMPLE_HEIGHT = 240;
const HEADER_ROW_DIFF_THRESHOLD = 10;
const MIN_HEADER_TRIM_CSS_PX = 8;
const FOOTER_ROW_DIFF_THRESHOLD = 10;
const MIN_FOOTER_TRIM_CSS_PX = 8;

type Rect = { left: number; top: number; width: number; height: number };

type PageInfo = {
  title: string;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  cropRect: Rect;
  viewportRect: Rect;
};

type Capture = {
  dataUrl: string;
  yCss: number;
  scrollHeightCss: number;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundRect(rect: Rect): Rect {
  return {
    left: Math.max(0, Math.round(rect.left || 0)),
    top: Math.max(0, Math.round(rect.top || 0)),
    width: Math.max(0, Math.round(rect.width || 0)),
    height: Math.max(0, Math.round(rect.height || 0)),
  };
}

function sanitizeFilename(name: string) {
  return (
    String(name || "screenshot")
      .replaceAll(/[\\/:*?"<>|]/g, "_")
      .replaceAll(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "screenshot"
  );
}

async function getActiveTab() {
  const tabs = await tabsQuery({ active: true, lastFocusedWindow: true });
  return tabs[0] ?? null;
}

async function executeInTab<Args extends unknown[], Result>(
  tabId: number,
  func: (...args: Args) => Result,
  args?: Args,
): Promise<Result> {
  const details = args
    ? ({ target: { tabId }, func, args } satisfies chrome.scripting.ScriptInjection<Args, Result>)
    : ({ target: { tabId }, func } satisfies chrome.scripting.ScriptInjection<Args, Result>);

  const results = await scriptingExecuteScript<Args, Result>(details);
  return results?.[0]?.result as Result;
}

async function dataUrlToBitmap(dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob();
  return createImageBitmap(blob);
}

function computeCroppedHashFromBitmap(bitmap: ImageBitmap, cropRectCss: Rect, scale: number) {
  const cropLeftPx = Math.round(cropRectCss.left * scale);
  const cropTopPx = Math.round(cropRectCss.top * scale);
  const cropWidthPx = Math.round(cropRectCss.width * scale);
  const cropHeightPx = Math.round(cropRectCss.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("无法创建 Canvas 上下文。");
  ctx.drawImage(bitmap, cropLeftPx, cropTopPx, cropWidthPx, cropHeightPx, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  let hash = 2166136261;
  for (let index = 0; index < pixels.length; index += 1) {
    hash ^= pixels[index]!;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function extractHeaderSampleFromBitmap(bitmap: ImageBitmap, cropRectCss: Rect, scale: number, headerHeightPx: number) {
  const cropLeftPx = Math.round(cropRectCss.left * scale);
  const cropTopPx = Math.round(cropRectCss.top * scale);
  const cropWidthPx = Math.round(cropRectCss.width * scale);
  const cropHeightPx = Math.round(cropRectCss.height * scale);

  const headerPx = clampNumber(Math.round(headerHeightPx), 1, cropHeightPx);
  const sampleWidth = clampNumber(HEADER_SAMPLE_WIDTH, 8, cropWidthPx);
  const sampleHeight = clampNumber(HEADER_SAMPLE_HEIGHT, 8, headerPx);

  const canvas = document.createElement("canvas");
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("无法创建 Canvas 上下文。");
  ctx.drawImage(bitmap, cropLeftPx, cropTopPx, cropWidthPx, headerPx, 0, 0, sampleWidth, sampleHeight);
  const data = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
  return { data, width: sampleWidth, height: sampleHeight, headerPx };
}

function extractFooterSampleFromBitmap(bitmap: ImageBitmap, cropRectCss: Rect, scale: number, footerHeightPx: number) {
  const cropLeftPx = Math.round(cropRectCss.left * scale);
  const cropTopPx = Math.round(cropRectCss.top * scale);
  const cropWidthPx = Math.round(cropRectCss.width * scale);
  const cropHeightPx = Math.round(cropRectCss.height * scale);

  const footerPx = clampNumber(Math.round(footerHeightPx), 1, cropHeightPx);
  const sampleWidth = clampNumber(HEADER_SAMPLE_WIDTH, 8, cropWidthPx);
  const sampleHeight = clampNumber(HEADER_SAMPLE_HEIGHT, 8, footerPx);

  const canvas = document.createElement("canvas");
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("无法创建 Canvas 上下文。");
  ctx.drawImage(
    bitmap,
    cropLeftPx,
    cropTopPx + cropHeightPx - footerPx,
    cropWidthPx,
    footerPx,
    0,
    0,
    sampleWidth,
    sampleHeight,
  );
  const data = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
  return { data, width: sampleWidth, height: sampleHeight, footerPx };
}

function detectStickyHeaderTrimPx(
  referenceSample: { data: Uint8ClampedArray; width: number; height: number; headerPx: number },
  currentSample: { data: Uint8ClampedArray; width: number; height: number; headerPx: number },
) {
  if (
    referenceSample.width !== currentSample.width ||
    referenceSample.height !== currentSample.height ||
    referenceSample.headerPx !== currentSample.headerPx
  ) {
    return 0;
  }

  const width = referenceSample.width;
  const height = referenceSample.height;
  const rowPixels = width * 4;

  let matchedRows = 0;
  for (let y = 0; y < height; y += 1) {
    let rowDiff = 0;
    const rowStart = y * rowPixels;
    for (let x = 0; x < width; x += 1) {
      const offset = rowStart + x * 4;
      rowDiff += Math.abs(referenceSample.data[offset]! - currentSample.data[offset]!);
      rowDiff += Math.abs(referenceSample.data[offset + 1]! - currentSample.data[offset + 1]!);
      rowDiff += Math.abs(referenceSample.data[offset + 2]! - currentSample.data[offset + 2]!);
    }
    const avgDiff = rowDiff / (width * 3);
    if (avgDiff <= HEADER_ROW_DIFF_THRESHOLD) matchedRows += 1;
    else break;
  }

  const trimPx = Math.round((matchedRows * referenceSample.headerPx) / height);
  return clampNumber(trimPx, 0, referenceSample.headerPx);
}

function detectStickyFooterTrimPx(
  referenceSample: { data: Uint8ClampedArray; width: number; height: number; footerPx: number },
  currentSample: { data: Uint8ClampedArray; width: number; height: number; footerPx: number },
) {
  if (
    referenceSample.width !== currentSample.width ||
    referenceSample.height !== currentSample.height ||
    referenceSample.footerPx !== currentSample.footerPx
  ) {
    return 0;
  }

  const width = referenceSample.width;
  const height = referenceSample.height;
  const rowPixels = width * 4;

  let matchedRows = 0;
  for (let y = height - 1; y >= 0; y -= 1) {
    let rowDiff = 0;
    const rowStart = y * rowPixels;
    for (let x = 0; x < width; x += 1) {
      const offset = rowStart + x * 4;
      rowDiff += Math.abs(referenceSample.data[offset]! - currentSample.data[offset]!);
      rowDiff += Math.abs(referenceSample.data[offset + 1]! - currentSample.data[offset + 1]!);
      rowDiff += Math.abs(referenceSample.data[offset + 2]! - currentSample.data[offset + 2]!);
    }
    const avgDiff = rowDiff / (width * 3);
    if (avgDiff <= FOOTER_ROW_DIFF_THRESHOLD) matchedRows += 1;
    else break;
  }

  const trimPx = Math.round((matchedRows * referenceSample.footerPx) / height);
  return clampNumber(trimPx, 0, referenceSample.footerPx);
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("导出失败"));
      else resolve(blob);
    }, "image/png");
  });
}

async function downloadBlob(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob);
  try {
    await downloadsDownload({ url: blobUrl, filename, saveAs: true });
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
  }
}

export async function captureLongScreenshot(options: {
  delayMs: number;
  cropToScroller: boolean;
  onStatus: (text: string) => void;
  signal: AbortSignal;
}) {
  const { delayMs, cropToScroller, onStatus, signal } = options;

  const tab = await getActiveTab();
  if (!tab?.id || tab.windowId == null) throw new Error("未找到可用的当前标签页。");
  if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
    throw new Error("该页面不支持截图（例如 chrome:// 或扩展页面）。");
  }

  const tabId = tab.id;

  const getInfo = () =>
    executeInTab<[], PageInfo>(tabId, () => {
      const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
      const centerElement = document.elementFromPoint(viewportWidth / 2, viewportHeight / 2);

      const isScrollable = (element: Element | null) => {
        if (!element || element === document.body || element === document.documentElement) return false;
        const style = window.getComputedStyle(element);
        const overflowY = style.overflowY;
        if (overflowY !== "auto" && overflowY !== "scroll" && overflowY !== "overlay") return false;
        const html = element as HTMLElement;
        return html.scrollHeight - html.clientHeight > 20;
      };

      const findScrollContainer = (start: Element | null) => {
        let current = start as HTMLElement | null;
        while (current) {
          if (isScrollable(current)) return current;
          current = current.parentElement;
        }
        return (document.scrollingElement || document.documentElement) as HTMLElement;
      };

      const scroller = findScrollContainer(centerElement);
      const isDocumentScroller =
        scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body;

      let cropRect: Rect;
      if (isDocumentScroller) {
        cropRect = { left: 0, top: 0, width: viewportWidth, height: viewportHeight };
      } else {
        const raw = scroller.getBoundingClientRect();
        const left = Math.max(0, raw.left);
        const top = Math.max(0, raw.top);
        const width = Math.max(0, Math.min(viewportWidth - left, raw.width));
        const height = Math.max(0, Math.min(viewportHeight - top, raw.height));
        cropRect = { left, top, width, height };
      }

      return {
        title: document.title || "",
        viewportWidth,
        viewportHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        scrollTop: scroller.scrollTop || 0,
        scrollHeight: scroller.scrollHeight || 0,
        clientHeight: scroller.clientHeight || viewportHeight,
        cropRect,
        viewportRect: { left: 0, top: 0, width: viewportWidth, height: viewportHeight },
      };
    });

  const setScrollTopAndGetInfo = (scrollTop: number) =>
    executeInTab<[number], PageInfo>(tabId, (scrollTopArg: number) => {
      const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
      const centerElement = document.elementFromPoint(viewportWidth / 2, viewportHeight / 2);

      const isScrollable = (element: Element | null) => {
        if (!element || element === document.body || element === document.documentElement) return false;
        const style = window.getComputedStyle(element);
        const overflowY = style.overflowY;
        if (overflowY !== "auto" && overflowY !== "scroll" && overflowY !== "overlay") return false;
        const html = element as HTMLElement;
        return html.scrollHeight - html.clientHeight > 20;
      };

      const findScrollContainer = (start: Element | null) => {
        let current = start as HTMLElement | null;
        while (current) {
          if (isScrollable(current)) return current;
          current = current.parentElement;
        }
        return (document.scrollingElement || document.documentElement) as HTMLElement;
      };

      const scroller = findScrollContainer(centerElement);
      const isDocumentScroller =
        scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body;

      scroller.scrollTop = scrollTopArg;

      let cropRect: Rect;
      if (isDocumentScroller) {
        cropRect = { left: 0, top: 0, width: viewportWidth, height: viewportHeight };
      } else {
        const raw = scroller.getBoundingClientRect();
        const left = Math.max(0, raw.left);
        const top = Math.max(0, raw.top);
        const width = Math.max(0, Math.min(viewportWidth - left, raw.width));
        const height = Math.max(0, Math.min(viewportHeight - top, raw.height));
        cropRect = { left, top, width, height };
      }

      return {
        title: document.title || "",
        viewportWidth,
        viewportHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        scrollTop: scroller.scrollTop || 0,
        scrollHeight: scroller.scrollHeight || 0,
        clientHeight: scroller.clientHeight || viewportHeight,
        cropRect,
        viewportRect: { left: 0, top: 0, width: viewportWidth, height: viewportHeight },
      };
    }, [scrollTop]);

  const pageInfo = await getInfo();
  if (!pageInfo.viewportHeight || !pageInfo.scrollHeight || !pageInfo.clientHeight) throw new Error("无法读取页面尺寸信息。");

  const normalizeCropRect = (rect: Rect, viewportWidth: number, viewportHeight: number): Rect => {
    const safe = roundRect(rect);
    const left = clampNumber(safe.left, 0, Math.max(0, viewportWidth - 1));
    const top = clampNumber(safe.top, 0, Math.max(0, viewportHeight - 1));
    const width = clampNumber(safe.width, 1, Math.max(1, viewportWidth - left));
    const height = clampNumber(safe.height, 1, Math.max(1, viewportHeight - top));
    return { left, top, width, height };
  };

  const allowTrim = Boolean(cropToScroller);
  const cropRectForStitch = allowTrim ? pageInfo.cropRect : pageInfo.viewportRect;
  const fixedCropRectCss = normalizeCropRect(cropRectForStitch, pageInfo.viewportWidth, pageInfo.viewportHeight);

  const originalScrollTop = pageInfo.scrollTop;
  const baselineScrollTop = pageInfo.scrollTop;

  const captures: Capture[] = [];
  onStatus("准备截图…");

  let scale = 0;
  let lastHash: number | null = null;
  let headerTrimCss = 0;
  let footerTrimCss = 0;
  let referenceHeaderSample: ReturnType<typeof extractHeaderSampleFromBitmap> | null = null;
  let referenceFooterSample: ReturnType<typeof extractFooterSampleFromBitmap> | null = null;

  for (let step = 0; step < MAX_CAPTURE_STEPS; step += 1) {
    if (signal.aborted) break;

    const info = step === 0 ? pageInfo : await getInfo();
    let nextInfo = info;

    let dataUrl = await captureVisibleTab(tab.windowId, { format: "png" });

    let hash: number | null = null;

    const bitmap = await dataUrlToBitmap(dataUrl);
    try {
      if (!scale) {
        scale = bitmap.width / Math.max(1, nextInfo.viewportWidth) || nextInfo.devicePixelRatio || 1;
        if (allowTrim) {
          const headerPx = Math.max(1, Math.round(fixedCropRectCss.height * scale));
          referenceHeaderSample = extractHeaderSampleFromBitmap(bitmap, fixedCropRectCss, scale, headerPx);
          referenceFooterSample = extractFooterSampleFromBitmap(bitmap, fixedCropRectCss, scale, headerPx);
        }
      }

      let justDetectedHeaderTrim = false;
      if (allowTrim && step > 0 && !headerTrimCss && referenceHeaderSample) {
        const currentSample = extractHeaderSampleFromBitmap(bitmap, fixedCropRectCss, scale, referenceHeaderSample.headerPx);
        const trimPxCandidate = detectStickyHeaderTrimPx(referenceHeaderSample, currentSample);
        const trimCssCandidate = Math.round(trimPxCandidate / scale);
        if (trimCssCandidate >= MIN_HEADER_TRIM_CSS_PX) {
          headerTrimCss = clampNumber(trimCssCandidate, 0, Math.max(0, Math.round(fixedCropRectCss.height - 1)));
          justDetectedHeaderTrim = true;
        }
      }

      if (allowTrim && step > 0 && !footerTrimCss && referenceFooterSample) {
        const currentSample = extractFooterSampleFromBitmap(bitmap, fixedCropRectCss, scale, referenceFooterSample.footerPx);
        const trimPxCandidate = detectStickyFooterTrimPx(referenceFooterSample, currentSample);
        const trimCssCandidate = Math.round(trimPxCandidate / scale);
        if (trimCssCandidate >= MIN_FOOTER_TRIM_CSS_PX) {
          footerTrimCss = clampNumber(trimCssCandidate, 0, Math.max(0, Math.round(fixedCropRectCss.height - 1)));
        }
      }

      const hashRectCss: Rect = {
        left: fixedCropRectCss.left,
        top: fixedCropRectCss.top + headerTrimCss,
        width: fixedCropRectCss.width,
        height: Math.max(1, fixedCropRectCss.height - headerTrimCss - footerTrimCss),
      };
      hash = computeCroppedHashFromBitmap(bitmap, hashRectCss, scale);

      if (justDetectedHeaderTrim) {
        const correctedScrollTop = Math.max(baselineScrollTop, nextInfo.scrollTop - headerTrimCss);
        if (correctedScrollTop !== nextInfo.scrollTop) {
          nextInfo = await setScrollTopAndGetInfo(correctedScrollTop);
          await sleep(Math.max(0, delayMs));
          dataUrl = await captureVisibleTab(tab.windowId, { format: "png" });
          const correctedBitmap = await dataUrlToBitmap(dataUrl);
          try {
            const correctedHashRectCss: Rect = {
              left: fixedCropRectCss.left,
              top: fixedCropRectCss.top + headerTrimCss,
              width: fixedCropRectCss.width,
              height: Math.max(1, fixedCropRectCss.height - headerTrimCss - footerTrimCss),
            };
            hash = computeCroppedHashFromBitmap(correctedBitmap, correctedHashRectCss, scale);
          } finally {
            correctedBitmap.close?.();
          }
        }
      }
    } finally {
      bitmap.close?.();
    }

    if (hash != null && lastHash != null && hash === lastHash) {
      onStatus("检测到画面不再变化，结束截图…");
      break;
    }

    captures.push({ dataUrl, yCss: nextInfo.scrollTop - baselineScrollTop, scrollHeightCss: nextInfo.scrollHeight });
    onStatus(`截图中：第 ${captures.length} 屏…`);
    lastHash = hash;

    const maxScrollTop = Math.max(0, nextInfo.scrollHeight - nextInfo.clientHeight);
    if (nextInfo.scrollTop >= maxScrollTop) break;

    const stepBaseHeightCss = allowTrim
      ? Math.min(nextInfo.clientHeight || 0, fixedCropRectCss.height || 0) || (nextInfo.clientHeight || fixedCropRectCss.height)
      : nextInfo.clientHeight;
    const scrollStep = Math.max(1, stepBaseHeightCss - headerTrimCss - footerTrimCss);
    const next = Math.min(nextInfo.scrollTop + scrollStep, maxScrollTop);
    if (next === nextInfo.scrollTop) break;

    await setScrollTopAndGetInfo(next);
    await sleep(Math.max(0, delayMs));
  }

  await setScrollTopAndGetInfo(originalScrollTop);

  if (captures.length === 0) {
    if (signal.aborted) throw new Error("已结束。");
    throw new Error("未捕获到有效截图。");
  }

  const stitchedHeightCss = (() => {
    let maxBottom = 0;
    for (let index = 0; index < captures.length; index += 1) {
      const item = captures[index]!;
      const topCss = item.yCss + (index === 0 ? 0 : headerTrimCss);
      const heightCss =
        index === 0 ? fixedCropRectCss.height : Math.max(1, fixedCropRectCss.height - headerTrimCss - footerTrimCss);
      maxBottom = Math.max(maxBottom, topCss + Math.max(1, heightCss));
    }
    return Math.max(1, maxBottom);
  })();

  const widthPx = Math.round(fixedCropRectCss.width * scale);
  const totalHeightPx = Math.round(stitchedHeightCss * scale);
  if (!widthPx || !totalHeightPx) throw new Error("无法生成图片尺寸。");

  onStatus("拼接图片中…");

  const parts = Math.max(1, Math.ceil(totalHeightPx / MAX_CANVAS_HEIGHT));
  const canvases = Array.from({ length: parts }, (_, partIndex) => {
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    const start = partIndex * MAX_CANVAS_HEIGHT;
    canvas.height = Math.min(MAX_CANVAS_HEIGHT, totalHeightPx - start);
    return canvas;
  });

  const contexts = canvases.map((canvas) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建 Canvas 上下文。");
    return ctx;
  });

  const cropLeftPx = Math.round(fixedCropRectCss.left * scale);
  const cropTopPx = Math.round(fixedCropRectCss.top * scale);
  const cropWidthPx = Math.round(fixedCropRectCss.width * scale);
  const cropHeightPx = Math.round(fixedCropRectCss.height * scale);
  const headerTrimPx = Math.round(headerTrimCss * scale);
  const footerTrimPx = Math.round(footerTrimCss * scale);

  for (let captureIndex = 0; captureIndex < captures.length; captureIndex += 1) {
    const item = captures[captureIndex]!;
    const bitmap = await dataUrlToBitmap(item.dataUrl);
    try {
      const topTrimPx = captureIndex === 0 ? 0 : headerTrimPx;
      const topTrimCss = captureIndex === 0 ? 0 : headerTrimCss;
      const bottomTrimPx = captureIndex === 0 ? 0 : footerTrimPx;
      const effectiveCropHeightPx = Math.max(1, cropHeightPx - topTrimPx - bottomTrimPx);

      const yPx = Math.round((item.yCss + topTrimCss) * scale);
      const imgTop = yPx;
      const imgBottom = yPx + effectiveCropHeightPx;

      for (let partIndex = 0; partIndex < parts; partIndex += 1) {
        const partTop = partIndex * MAX_CANVAS_HEIGHT;
        const partBottom = partTop + canvases[partIndex]!.height;
        const drawTop = Math.max(imgTop, partTop);
        const drawBottom = Math.min(imgBottom, partBottom);
        const drawHeight = drawBottom - drawTop;
        if (drawHeight <= 0) continue;

        const srcY = cropTopPx + topTrimPx + (drawTop - imgTop);
        const destY = drawTop - partTop;
        contexts[partIndex]!.drawImage(
          bitmap,
          cropLeftPx,
          srcY,
          cropWidthPx,
          drawHeight,
          0,
          destY,
          cropWidthPx,
          drawHeight,
        );
      }
    } finally {
      bitmap.close?.();
    }
  }

  const base = sanitizeFilename(pageInfo.title || tab.title || "long-screenshot");
  for (let partIndex = 0; partIndex < parts; partIndex += 1) {
    const filename = parts === 1 ? `${base}.png` : `${base}.part${partIndex + 1}.png`;
    onStatus(parts === 1 ? "导出图片…" : `导出图片（${partIndex + 1}/${parts}）…`);
    const blob = await canvasToBlob(canvases[partIndex]!);
    await downloadBlob(blob, filename);
  }

  onStatus(signal.aborted ? "已结束并导出。" : "完成。");
}
