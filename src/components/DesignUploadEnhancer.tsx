"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { isLocale } from "../i18n/locales";
import { toolPageFeatures, type ToolSlug } from "../app/tools/tool-registry";

type ToolRoute = {
  slug: string;
};

const getToolRouteFromPathname = (pathname: string): ToolRoute | null => {
  const parts = pathname.split("/").filter(Boolean);
  const hasLocalePrefix = parts[0] ? isLocale(parts[0]) : false;
  const toolsIndex = hasLocalePrefix ? 1 : 0;
  if (parts[toolsIndex] !== "tools") return null;
  const slug = parts[toolsIndex + 1];
  if (!slug) return null;
  return { slug };
};

const isFileDragEvent = (event: DragEvent): boolean => {
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) return true;
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
};

const pickPrimaryFileInput = (): HTMLInputElement | null => {
  const input = document.querySelector<HTMLInputElement>("input[type='file']:not(:disabled)");
  return input ?? null;
};

const applyFilesToInput = (input: HTMLInputElement, files: FileList): boolean => {
  if (typeof DataTransfer === "undefined") return false;
  const transfer = new DataTransfer();
  if (input.multiple) {
    for (const file of files) transfer.items.add(file);
  } else if (files[0]) {
    transfer.items.add(files[0]);
  }
  if (transfer.files.length === 0) return false;
  try {
    input.files = transfer.files;
  } catch {
    return false;
  }
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
};

export default function DesignUploadEnhancer() {
  const pathname = usePathname();
  const [isDragging, setIsDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const toolRoute = useMemo(() => getToolRouteFromPathname(pathname), [pathname]);
  const pageFeatures =
    toolRoute && toolRoute.slug in toolPageFeatures ? toolPageFeatures[toolRoute.slug as ToolSlug] : null;
  const floatingUploadAction = pageFeatures?.floatingUploadAction === true;
  const globalDropZone = pageFeatures?.globalDropZone === true;

  useEffect(() => {
    if (!globalDropZone) return;

    let dragDepth = 0;
    const showNotice = (text: string) => {
      setNotice(text);
      window.setTimeout(() => setNotice(null), 1800);
    };

    const onDragEnter = (event: DragEvent) => {
      if (event.defaultPrevented || !isFileDragEvent(event)) return;
      dragDepth += 1;
      setIsDragging(true);
      event.preventDefault();
    };

    const onDragOver = (event: DragEvent) => {
      if (event.defaultPrevented || !isFileDragEvent(event)) return;
      setIsDragging(true);
      event.preventDefault();
    };

    const onDragLeave = (event: DragEvent) => {
      if (event.defaultPrevented || !isFileDragEvent(event)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) setIsDragging(false);
      event.preventDefault();
    };

    const onDrop = (event: DragEvent) => {
      if (event.defaultPrevented || !isFileDragEvent(event)) return;
      event.preventDefault();
      dragDepth = 0;
      setIsDragging(false);

      const input = pickPrimaryFileInput();
      const files = event.dataTransfer?.files;
      if (!input || !files || files.length === 0) {
        showNotice("当前页面未找到可用上传入口");
        return;
      }

      if (!applyFilesToInput(input, files)) {
        showNotice("拖拽文件失败，请改用点击上传");
      }
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [globalDropZone]);

  if (!floatingUploadAction && !globalDropZone) return null;

  return (
    <>
      {globalDropZone && isDragging && (
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 backdrop-blur-sm">
          <div className="rounded-2xl border border-white/30 bg-white/95 px-6 py-4 text-center shadow-2xl">
            <div className="text-sm font-semibold text-slate-900">松开即可上传或替换文件</div>
            <div className="mt-1 text-xs text-slate-600">统一上传增强模式已生效</div>
          </div>
        </div>
      )}
      {(floatingUploadAction || notice) && (
        <div className="fixed bottom-5 right-5 z-[71] flex flex-col items-end gap-2">
          {notice && (
            <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-lg">
              {notice}
            </div>
          )}
          {floatingUploadAction && (
            <button
              type="button"
              onClick={() => {
                const input = pickPrimaryFileInput();
                if (!input) {
                  setNotice("当前页面未找到可用上传入口");
                  return;
                }
                input.value = "";
                input.click();
              }}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-slate-800 active:scale-95"
            >
              点击上传/替换
            </button>
          )}
        </div>
      )}
    </>
  );
}
