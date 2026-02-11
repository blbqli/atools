import React, { useEffect, useRef } from "react";

type PrimaryButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  className?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function PrimaryButton({ className, onPointerMove, onPointerLeave, ...props }: PrimaryButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<{ px: number; py: number }>({ px: 50, py: 50 });

  const flush = () => {
    frameRef.current = null;
    const el = buttonRef.current;
    if (!el) return;
    el.style.setProperty("--px", `${pendingRef.current.px}%`);
    el.style.setProperty("--py", `${pendingRef.current.py}%`);
  };

  const scheduleFlush = () => {
    if (frameRef.current != null) return;
    frameRef.current = window.requestAnimationFrame(flush);
  };

  useEffect(() => {
    const el = buttonRef.current;
    if (!el) return;
    el.style.setProperty("--px", "50%");
    el.style.setProperty("--py", "50%");
    return () => {
      if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <button
      {...props}
      ref={buttonRef}
      className={["btn", "btn-primary-liquid", className].filter(Boolean).join(" ")}
      onPointerMove={(event) => {
        const el = buttonRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const localX = clamp(event.clientX - rect.left, 0, rect.width);
          const localY = clamp(event.clientY - rect.top, 0, rect.height);
          pendingRef.current.px = rect.width ? (localX / rect.width) * 100 : 50;
          pendingRef.current.py = rect.height ? (localY / rect.height) * 100 : 50;
          scheduleFlush();
        }
        onPointerMove?.(event);
      }}
      onPointerLeave={(event) => {
        pendingRef.current.px = 50;
        pendingRef.current.py = 50;
        scheduleFlush();
        onPointerLeave?.(event);
      }}
    />
  );
}

