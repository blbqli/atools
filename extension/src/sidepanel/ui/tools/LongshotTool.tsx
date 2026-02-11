import React, { useMemo, useRef, useState } from "react";
import { captureLongScreenshot } from "../../utils/longshot";
import PrimaryButton from "../components/PrimaryButton";

export default function LongshotTool() {
  const [delayMs, setDelayMs] = useState<number>(300);
  const [cropToScroller, setCropToScroller] = useState<boolean>(true);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const canCancel = useMemo(() => busy && abortRef.current && !abortRef.current.signal.aborted, [busy]);

  const start = async () => {
    if (busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setStatus("");
    try {
      await captureLongScreenshot({
        delayMs,
        cropToScroller,
        onStatus: setStatus,
        signal: controller.signal,
      });
    } catch (err) {
      setStatus(`失败：${String((err as Error)?.message || err)}`);
    } finally {
      setBusy(false);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setStatus("正在结束（将导出已截图部分）…");
  };

  return (
    <div className="mx-auto grid max-w-md gap-3 p-3">
      <section className="panel p-3">
        <div className="text-sm font-extrabold">长截图（当前标签页）</div>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-xs muted" htmlFor="delayMs">
            滚动等待
          </label>
          <input
            id="delayMs"
            className="input w-28"
            type="number"
            min={0}
            step={50}
            value={delayMs}
            disabled={busy}
            onChange={(e) => setDelayMs(Number.parseInt(e.target.value || "0", 10) || 0)}
          />
          <span className="text-xs muted2">ms</span>
        </div>
        <label className="mt-3 inline-flex items-center gap-2 text-xs muted">
          <input
            type="checkbox"
            className="h-4 w-4 accent-sky-500 dark:accent-sky-300"
            checked={cropToScroller}
            disabled={busy}
            onChange={(e) => setCropToScroller(e.target.checked)}
          />
          只拼接滚动区域（不保留四周）
        </label>
        <div className="mt-3 flex gap-2">
          <PrimaryButton
            type="button"
            className="flex-1"
            onClick={start}
            disabled={busy}
          >
            开始长截图
          </PrimaryButton>
          <button
            type="button"
            className="btn"
            onClick={stop}
            disabled={!canCancel}
          >
            结束
          </button>
        </div>
        {status ? <div className="mt-3 text-xs muted">{status}</div> : null}
      </section>
    </div>
  );
}
