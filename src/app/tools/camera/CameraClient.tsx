"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ToolPageLayout from "../../../components/ToolPageLayout";
import defaultToolConfig from "./tool.json";

type CameraState = "idle" | "starting" | "running" | "stopped" | "error";

type CameraUi = {
  controls: string;
  camera: string;
  rear: string;
  front: string;
  start: string;
  stop: string;
  capture: string;
  photo: string;
  capturedAlt: string;
  downloadPng: string;
  noPhoto: string;
  errorPrefix: string;
  unsupported: string;
  videoNotReady: string;
  unableStart: string;
  permissionDenied: string;
  noCameraFound: string;
  cameraBusy: string;
  constraintFallback: string;
  insecureContext: string;
  statusStarting: string;
  statusRunning: string;
  statusError: string;
  statusStopped: string;
  statusIdle: string;
};

const DEFAULT_UI = defaultToolConfig.ui as CameraUi;

function stopMediaTracks(stream: MediaStream | null) {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
}

function getErrorName(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const maybeName = (error as { name?: unknown }).name;
  return typeof maybeName === "string" ? maybeName : null;
}

function shouldRetryWithFallback(error: unknown): boolean {
  const name = getErrorName(error);
  return name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError" || name === "NotFoundError";
}

function formatCameraError(error: unknown, ui: CameraUi): string {
  const name = getErrorName(error);
  if (name === "NotAllowedError" || name === "SecurityError") return ui.permissionDenied;
  if (name === "NotFoundError") return ui.noCameraFound;
  if (name === "NotReadableError" || name === "TrackStartError") return ui.cameraBusy;
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError" || name === "TypeError")
    return ui.constraintFallback;
  if (name === "NotSupportedError") return ui.insecureContext;
  return ui.unableStart;
}

async function requestCameraStream(facingMode: "environment" | "user") {
  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: { exact: facingMode } }, audio: false },
    { video: { facingMode }, audio: false },
    { video: true, audio: false },
  ];

  let lastError: unknown = null;
  for (let index = 0; index < attempts.length; index += 1) {
    try {
      return await navigator.mediaDevices.getUserMedia(attempts[index]);
    } catch (error) {
      lastError = error;
      if (!shouldRetryWithFallback(error) || index === attempts.length - 1) throw error;
    }
  }
  throw (lastError ?? new Error("camera_start_failed"));
}

function CameraInner({ ui }: { ui: CameraUi }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTokenRef = useRef(0);
  const photoUrlRef = useRef<string | null>(null);

  const [state, setState] = useState<CameraState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("photo.png");

  const supported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  const stopStream = () => {
    const stream = streamRef.current;
    stopMediaTracks(stream);
    streamRef.current = null;

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  };

  const stop = () => {
    startTokenRef.current += 1;
    stopStream();
    setState((prev) => (prev === "error" ? "error" : "stopped"));
  };

  useEffect(
    () => () => {
      startTokenRef.current += 1;
      stopStream();
      if (photoUrlRef.current) {
        URL.revokeObjectURL(photoUrlRef.current);
        photoUrlRef.current = null;
      }
    },
    [],
  );

  const start = async () => {
    if (!supported) {
      setError(ui.unsupported);
      setState("error");
      return;
    }

    const startToken = startTokenRef.current + 1;
    startTokenRef.current = startToken;

    stopStream();
    setError(null);
    setState("starting");

    try {
      const stream = await requestCameraStream(facingMode);

      if (startToken !== startTokenRef.current) {
        stopMediaTracks(stream);
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopMediaTracks(stream);
        setError(ui.videoNotReady);
        setState("error");
        streamRef.current = null;
        return;
      }

      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.srcObject = stream;
      await video.play();

      if (startToken !== startTokenRef.current) {
        stopStream();
        return;
      }

      setState("running");
    } catch (cameraError) {
      if (startToken !== startTokenRef.current) return;
      stopStream();
      setError(formatCameraError(cameraError, ui));
      setState("error");
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png", 1),
    );
    if (!blob) return;

    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    const url = URL.createObjectURL(blob);
    photoUrlRef.current = url;
    setPhotoUrl(url);
    setPhotoName(`photo-${new Date().toISOString().replace(/[:.]/g, "-")}.png`);
  };

  const canCapture = state === "running";

  const status = useMemo(() => {
    if (state === "starting")
      return { text: ui.statusStarting, color: "bg-amber-50 text-amber-800 ring-amber-200" };
    if (state === "running")
      return { text: ui.statusRunning, color: "bg-emerald-50 text-emerald-800 ring-emerald-200" };
    if (state === "error") return { text: ui.statusError, color: "bg-rose-50 text-rose-800 ring-rose-200" };
    if (state === "stopped")
      return { text: ui.statusStopped, color: "bg-slate-100 text-slate-700 ring-slate-200" };
    return { text: ui.statusIdle, color: "bg-slate-100 text-slate-700 ring-slate-200" };
  }, [state, ui]);

  return (
    <div className="mt-8 glass-card rounded-3xl p-6 shadow-2xl ring-1 ring-black/5">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl bg-black ring-1 ring-slate-200">
            <video ref={videoRef} className="h-auto w-full" playsInline muted />
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">{ui.controls}</div>
              <div className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${status.color}`}>{status.text}</div>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="block text-sm text-slate-700">
                {ui.camera}
                <select
                  value={facingMode}
                  onChange={(e) => setFacingMode(e.target.value as "environment" | "user")}
                  disabled={state === "running" || state === "starting"}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 disabled:opacity-60"
                >
                  <option value="environment">{ui.rear}</option>
                  <option value="user">{ui.front}</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void start()}
                disabled={state === "running" || state === "starting" || !supported}
                className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {ui.start}
              </button>
              <button
                type="button"
                onClick={stop}
                disabled={state !== "running" && state !== "starting"}
                className="rounded-2xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
              >
                {ui.stop}
              </button>
              <button
                type="button"
                onClick={() => void capture()}
                disabled={!canCapture}
                className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {ui.capture}
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
            <div className="text-sm font-semibold text-slate-900">{ui.photo}</div>
            {photoUrl ? (
              <div className="mt-3 space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt={ui.capturedAlt} className="w-full rounded-2xl ring-1 ring-slate-200" />
                <a
                  href={photoUrl}
                  download={photoName}
                  className="inline-flex rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {ui.downloadPng}
                </a>
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-500">{ui.noPhoto}</div>
            )}
            {error && <div className="mt-3 text-sm text-rose-600">{ui.errorPrefix}{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CameraClient() {
  return (
    <ToolPageLayout toolSlug="camera">
      {({ config }) => <CameraInner ui={{ ...DEFAULT_UI, ...((config.ui as Partial<CameraUi> | undefined) ?? {}) }} />}
    </ToolPageLayout>
  );
}
