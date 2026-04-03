"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  onComplete: () => void;
};

const INTRO_DURATION_MS = 2100;
const EXIT_DURATION_MS  = 380;
const FAILSAFE_MS       = 4500;

const KEYFRAMES = `
@keyframes scin-logo {
  0%   { opacity: 0; transform: scale(0.62); filter: drop-shadow(0 0 0px rgba(109,74,255,0)); }
  26%  { opacity: 1; transform: scale(1.09);
         filter: drop-shadow(0 0 48px rgba(109,74,255,1))
                 drop-shadow(0 0 90px rgba(59,130,246,0.75))
                 drop-shadow(0 0 120px rgba(34,211,238,0.4)); }
  58%  { transform: scale(0.975);
         filter: drop-shadow(0 0 22px rgba(109,74,255,0.75))
                 drop-shadow(0 0 55px rgba(59,130,246,0.45)); }
  100% { opacity: 1; transform: scale(1);
         filter: drop-shadow(0 0 18px rgba(109,74,255,0.55))
                 drop-shadow(0 0 40px rgba(59,130,246,0.3)); }
}
@keyframes scin-ring1 {
  0%   { opacity: 0; transform: scale(0.55); }
  12%  { opacity: 0.55; }
  100% { opacity: 0; transform: scale(3.4); }
}
@keyframes scin-ring2 {
  0%   { opacity: 0; transform: scale(0.38); }
  18%  { opacity: 0.35; }
  100% { opacity: 0; transform: scale(2.8); }
}
@keyframes scin-amb {
  0%   { opacity: 0; }
  35%  { opacity: 1; }
  65%  { opacity: 0.85; }
  100% { opacity: 0.45; }
}
@keyframes scin-sweep {
  0%   { transform: translateX(-260%) skewX(-14deg); opacity: 0; }
  7%   { opacity: 1; }
  92%  { opacity: 0.65; }
  100% { transform: translateX(360%) skewX(-14deg); opacity: 0; }
}
@keyframes scin-wordmark {
  0%   { opacity: 0; transform: translateY(22px); letter-spacing: 0.35em; }
  100% { opacity: 1; transform: translateY(0);   letter-spacing: 0.08em; }
}
@keyframes scin-tag {
  0%   { opacity: 0; transform: translateY(10px); }
  100% { opacity: 0.42; transform: translateY(0); }
}
@keyframes scin-exit {
  0%   { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.94); }
}
@keyframes scin-scanline {
  0%   { background-position: 0 0; }
  100% { background-position: 0 100px; }
}
`;

export function SendoraBrandIntro({ onComplete }: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [exiting, setExiting]           = useState(false);
  const doneRef                         = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete();
  }, [onComplete]);

  const beginExit = useCallback(() => {
    if (doneRef.current) return;
    setExiting(true);
    window.setTimeout(finish, EXIT_DURATION_MS);
  }, [finish]);

  useEffect(() => {
    const mq   = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      const t = window.setTimeout(finish, 80);
      return () => window.clearTimeout(t);
    }

    const tNormal  = window.setTimeout(beginExit, INTRO_DURATION_MS);
    const tFailsafe = window.setTimeout(finish,  FAILSAFE_MS);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.clearTimeout(tNormal);
        window.clearTimeout(tFailsafe);
        finish();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(tNormal);
      window.clearTimeout(tFailsafe);
      window.removeEventListener("keydown", onKey);
    };
  }, [reduceMotion, beginExit, finish]);

  if (reduceMotion) {
    return (
      <div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black"
        role="status"
        aria-label="Welcome to Sendora"
      >
        <img
          src="/sendora-logo-4k.png"
          alt="Sendora"
          width={110}
          height={110}
          style={{ mixBlendMode: "screen" }}
          className="object-contain"
        />
        <p className="mt-5 text-xl font-semibold tracking-widest text-white">
          Welcome to Sendora
        </p>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      <div
        role="status"
        aria-label="Sendora welcome animation. Press Escape to skip."
        style={{
          animation: exiting
            ? `scin-exit ${EXIT_DURATION_MS}ms cubic-bezier(0.4,0,1,1) forwards`
            : undefined,
        }}
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-black"
      >

        {/* ── Subtle cinematic scanline texture ── */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 3px)",
            backgroundSize: "100% 3px",
            animation: "scin-scanline 2s linear infinite",
          }}
        />

        {/* ── Deep ambient background glow (blue-purple) ── */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(59,130,246,0.07) 0%, rgba(109,74,255,0.06) 35%, transparent 70%)",
            animation: `scin-amb 1.8s cubic-bezier(0.4,0,0.2,1) forwards`,
          }}
        />

        {/* ── Expanding glow rings ── */}
        <div
          className="pointer-events-none absolute"
          style={{
            width: 220,
            height: 220,
            borderRadius: "50%",
            border: "1.5px solid rgba(109,74,255,0.55)",
            boxShadow: "0 0 40px 8px rgba(109,74,255,0.2), inset 0 0 20px rgba(109,74,255,0.1)",
            animation: `scin-ring1 1.15s 0.12s cubic-bezier(0.16,1,0.3,1) forwards`,
            opacity: 0,
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            width: 200,
            height: 200,
            borderRadius: "50%",
            border: "1px solid rgba(59,130,246,0.45)",
            boxShadow: "0 0 30px 4px rgba(59,130,246,0.15)",
            animation: `scin-ring2 1.3s 0.28s cubic-bezier(0.16,1,0.3,1) forwards`,
            opacity: 0,
          }}
        />

        {/* ── Main content stack ── */}
        <div className="relative flex flex-col items-center">

          {/* Logo + sweep overlay */}
          <div className="relative" style={{ width: 140, height: 140 }}>

            {/* Actual logo — mix-blend-mode: screen makes the black bg transparent */}
            <img
              src="/sendora-logo-4k.png"
              alt="Sendora"
              width={140}
              height={140}
              style={{
                mixBlendMode: "screen",
                objectFit: "contain",
                width: "100%",
                height: "100%",
                animation: "scin-logo 0.9s cubic-bezier(0.16,1,0.3,1) forwards",
                opacity: 0,
              }}
            />

            {/* Light sweep — clipped to logo bounds */}
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden"
              style={{ borderRadius: 4 }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: "-20% 0",
                  width: "55%",
                  background:
                    "linear-gradient(to right, transparent 0%, rgba(255,255,255,0.45) 45%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.45) 55%, transparent 100%)",
                  animation: `scin-sweep 0.72s 0.68s cubic-bezier(0.4,0,0.2,1) forwards`,
                  opacity: 0,
                }}
              />
            </div>
          </div>

          {/* "Welcome to Sendora" */}
          <h1
            className="mt-9 text-center text-white font-light"
            style={{
              fontSize: "clamp(1.1rem, 4vw, 1.6rem)",
              letterSpacing: "0.08em",
              animation: `scin-wordmark 0.7s 0.85s cubic-bezier(0.16,1,0.3,1) forwards`,
              opacity: 0,
            }}
          >
            Welcome to <span style={{ fontWeight: 600 }}>Sendora</span>
          </h1>

          {/* Tagline */}
          <p
            className="mt-2 text-center text-white/40 text-xs sm:text-sm font-light"
            style={{
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              animation: `scin-tag 0.55s 1.2s ease-out forwards`,
              opacity: 0,
            }}
          >
            Your private inbox
          </p>
        </div>

        {/* ── Skip button ── */}
        <button
          type="button"
          onClick={finish}
          className="absolute bottom-7 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-xs font-medium text-white/40 backdrop-blur-sm transition-all hover:border-white/20 hover:text-white/70"
        >
          Skip
        </button>
      </div>
    </>
  );
}
