"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

type Props = {
  /** Called after the sequence (or immediately if reduced motion / skip / fail-safe). */
  onComplete: () => void;
};

const FAILSAFE_MS = 3500;
const COMPLETE_NORMAL_MS = 2350;

/**
 * Full-screen premium brand moment after successful auth.
 * SVG ribbon strokes + wordmark — CSS-driven, no animation libraries.
 */
export function SendoraBrandIntro({ onComplete }: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [exit, setExit] = useState(false);
  const [ready, setReady] = useState(false);
  const completeRef = useRef(false);
  const path1Ref = useRef<SVGPathElement>(null);
  const path2Ref = useRef<SVGPathElement>(null);
  const path3Ref = useRef<SVGPathElement>(null);

  const finish = useCallback(() => {
    if (completeRef.current) return;
    completeRef.current = true;
    onComplete();
  }, [onComplete]);

  const scheduleFinish = useCallback(() => {
    if (completeRef.current) return;
    setExit(true);
    window.setTimeout(finish, 280);
  }, [finish]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useLayoutEffect(() => {
    if (reduceMotion) return;
    const refs = [path1Ref, path2Ref, path3Ref];
    for (const r of refs) {
      const el = r.current;
      if (!el) continue;
      const len = el.getTotalLength();
      el.style.setProperty("--sendora-len", String(len));
    }
    setReady(true);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      const t = window.setTimeout(finish, 120);
      return () => window.clearTimeout(t);
    }

    const tComplete = window.setTimeout(scheduleFinish, COMPLETE_NORMAL_MS);
    const tSafe = window.setTimeout(finish, FAILSAFE_MS);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.clearTimeout(tComplete);
        window.clearTimeout(tSafe);
        finish();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(tComplete);
      window.clearTimeout(tSafe);
      window.removeEventListener("keydown", onKey);
    };
  }, [reduceMotion, finish, scheduleFinish]);

  if (reduceMotion) {
    return (
      <div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--background)] px-6"
        role="status"
        aria-label="Welcome to Sendora"
      >
        <img
          src="/sendora-logo.png"
          alt=""
          width={72}
          height={72}
          className="h-[72px] w-[72px] object-contain"
        />
        <p className="mt-4 text-lg font-semibold tracking-tight text-[var(--foreground)]">
          Sendora
        </p>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_120%_90%_at_50%_38%,#faf8ff_0%,#f2ecff_42%,#e8e0fc_100%)] px-6 transition-opacity duration-300 ease-out dark:bg-[radial-gradient(ellipse_120%_90%_at_50%_38%,#1e1b2e_0%,#17151f_50%,#13111f_100%)] ${exit ? "opacity-0" : "opacity-100"}`}
      role="status"
      aria-label="Sendora welcome animation. Press Escape to skip."
    >
      <button
        type="button"
        className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full border border-[var(--border)] bg-[var(--card)]/90 px-4 py-2 text-xs font-medium text-[var(--muted)] shadow-sm backdrop-blur-sm transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
        onClick={finish}
      >
        Skip
      </button>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(109,74,255,0.16)_0%,transparent_55%)] dark:bg-[radial-gradient(circle_at_50%_42%,rgba(109,74,255,0.22)_0%,transparent_55%)]" />

      <div
        className={`relative flex w-full max-w-[220px] flex-col items-center ${ready ? "sendora-brand-intro--ready" : "opacity-0"}`}
      >
        <svg
          viewBox="0 0 120 120"
          className="h-[100px] w-[100px] shrink-0 sm:h-[120px] sm:w-[120px]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <linearGradient
              id="sendoraIntroGrad"
              x1="0"
              y1="120"
              x2="120"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#2563eb">
                <animate
                  attributeName="stop-color"
                  values="#1d4ed8;#5b21b6;#0891b2;#1d4ed8"
                  dur="2.4s"
                  repeatCount="1"
                  fill="freeze"
                />
              </stop>
              <stop offset="52%" stopColor="#6d4aff">
                <animate
                  attributeName="stop-color"
                  values="#7c3aed;#6366f1;#a78bfa;#7c3aed"
                  dur="2.4s"
                  repeatCount="1"
                  fill="freeze"
                />
              </stop>
              <stop offset="100%" stopColor="#22d3ee">
                <animate
                  attributeName="stop-color"
                  values="#06b6d4;#6d4aff;#3b82f6;#06b6d4"
                  dur="2.4s"
                  repeatCount="1"
                  fill="freeze"
                />
              </stop>
            </linearGradient>
            <filter
              id="sendoraIntroSoftGlow"
              x="-35%"
              y="-35%"
              width="170%"
              height="170%"
            >
              <feGaussianBlur stdDeviation="1.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path
            ref={path1Ref}
            d="M 14 76 C 14 38, 40 18, 60 32 C 76 44, 92 36, 100 24"
            className="sendora-brand-intro__path sendora-brand-intro__path--1"
            stroke="url(#sendoraIntroGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#sendoraIntroSoftGlow)"
          />

          <path
            ref={path2Ref}
            d="M 24 94 C 42 110, 66 104, 82 80 C 94 62, 104 52, 108 42"
            className="sendora-brand-intro__path sendora-brand-intro__path--2"
            stroke="url(#sendoraIntroGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#sendoraIntroSoftGlow)"
          />

          <path
            ref={path3Ref}
            d="M 52 46 L 60 56 L 68 46"
            className="sendora-brand-intro__path sendora-brand-intro__path--3"
            stroke="url(#sendoraIntroGrad)"
            strokeWidth="3.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <h1 className="sendora-brand-intro__wordmark mt-7 text-center text-[1.35rem] font-semibold tracking-tight text-[var(--foreground)] sm:text-[1.5rem]">
          Sendora
        </h1>
        <p className="sendora-brand-intro__tag mt-1.5 text-center text-xs font-medium text-[var(--muted)]">
          Your private inbox
        </p>
      </div>
    </div>
  );
}
