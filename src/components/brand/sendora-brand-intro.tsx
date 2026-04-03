"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  onComplete: () => void;
};

/**
 * Timing map (all ms):
 *  0        – black; golden atmosphere begins to build
 *  200      – logo emerges from darkness
 *  1300     – light sweep passes across the logo
 *  2200     – "Welcome to Sendora" rises in
 *  2900     – tagline appears
 *  4200     – exit fade begins
 *  ~4700    – onComplete fires → navigate to inbox
 */
const INTRO_DURATION_MS = 4200;
const EXIT_DURATION_MS  = 500;
const FAILSAFE_MS       = 7000;

const KEYFRAMES = `
@keyframes scin-logo {
  0%   { opacity:0; transform:scale(0.52);
         filter: drop-shadow(0 0 0px rgba(212,160,23,0))
                 drop-shadow(0 0 0px rgba(109,74,255,0)); }
  22%  { opacity:0.9; transform:scale(1.1);
         filter: drop-shadow(0 0 60px rgba(212,160,23,0.8))
                 drop-shadow(0 0 35px rgba(109,74,255,0.6))
                 drop-shadow(0 0 110px rgba(212,160,23,0.35)); }
  52%  { transform:scale(0.982);
         filter: drop-shadow(0 0 30px rgba(212,160,23,0.58))
                 drop-shadow(0 0 20px rgba(109,74,255,0.42)); }
  100% { opacity:1; transform:scale(1);
         filter: drop-shadow(0 0 24px rgba(212,160,23,0.48))
                 drop-shadow(0 0 16px rgba(109,74,255,0.36)); }
}
@keyframes scin-amb {
  0%   { opacity:0; }
  30%  { opacity:1; }
  70%  { opacity:0.9; }
  100% { opacity:0.7; }
}
@keyframes scin-ring1 {
  0%   { opacity:0; transform:scale(0.5); }
  12%  { opacity:0.5; }
  100% { opacity:0; transform:scale(3.6); }
}
@keyframes scin-ring2 {
  0%   { opacity:0; transform:scale(0.35); }
  18%  { opacity:0.32; }
  100% { opacity:0; transform:scale(3); }
}
@keyframes scin-sweep {
  0%   { transform:translateX(-280%) skewX(-14deg); opacity:0; }
  7%   { opacity:1; }
  92%  { opacity:0.75; }
  100% { transform:translateX(380%) skewX(-14deg); opacity:0; }
}
@keyframes scin-wordmark {
  0%   { opacity:0; transform:translateY(24px); letter-spacing:0.38em; }
  100% { opacity:1; transform:translateY(0);    letter-spacing:0.1em; }
}
@keyframes scin-tag {
  0%   { opacity:0; transform:translateY(10px); }
  100% { opacity:0.44; transform:translateY(0); }
}
@keyframes scin-exit {
  0%   { opacity:1; transform:scale(1);    }
  100% { opacity:0; transform:scale(0.93); }
}
@keyframes scin-scanline {
  0%   { background-position:0 0; }
  100% { background-position:0 100px; }
}
@keyframes scin-golden-pulse {
  0%,100% { opacity:0.55; }
  50%      { opacity:0.75; }
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      const t = window.setTimeout(finish, 100);
      return () => window.clearTimeout(t);
    }

    const tNormal   = window.setTimeout(beginExit, INTRO_DURATION_MS);
    const tFailsafe = window.setTimeout(finish,    FAILSAFE_MS);

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
          width={120}
          height={120}
          style={{ mixBlendMode: "screen" }}
          className="object-contain"
        />
        <p className="mt-6 text-xl font-light tracking-[0.12em] text-white">
          Welcome to <span className="font-semibold">Sendora</span>
        </p>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* ── Root overlay — exit animates the whole thing ── */}
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

        {/* ── Subtle film-grain scanlines ── */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.022]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,rgba(255,255,255,0.14) 0px,rgba(255,255,255,0.14) 1px,transparent 1px,transparent 3px)",
            backgroundSize: "100% 3px",
            animation: "scin-scanline 2.4s linear infinite",
          }}
        />

        {/* ── Golden atmospheric glow (primary layer) ── */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 72% 62% at 50% 50%," +
              "rgba(212,160,23,0.13) 0%," +
              "rgba(184,134,11,0.08) 25%," +
              "rgba(120,85,5,0.04) 50%," +
              "transparent 70%)",
            animation: "scin-amb 0.9s 0.05s cubic-bezier(0.4,0,0.2,1) forwards",
            opacity: 0,
          }}
        />

        {/* ── Secondary brand-blue/purple support glow (edges) ── */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 120% 100% at 50% 50%," +
              "transparent 50%," +
              "rgba(109,74,255,0.055) 75%," +
              "rgba(59,130,246,0.04) 100%)",
          }}
        />

        {/* ── Deep vignette for cinematic edges ── */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 100% 100% at 50% 50%," +
              "transparent 38%," +
              "rgba(0,0,0,0.55) 75%," +
              "rgba(0,0,0,0.82) 100%)",
          }}
        />

        {/* ── Glow ring 1 (golden) ── */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            width: 230,
            height: 230,
            borderRadius: "50%",
            border: "1.5px solid rgba(212,160,23,0.42)",
            boxShadow:
              "0 0 45px 10px rgba(212,160,23,0.14)," +
              "inset 0 0 20px rgba(212,160,23,0.06)",
            animation: "scin-ring1 1.4s 0.35s cubic-bezier(0.16,1,0.3,1) forwards",
            opacity: 0,
          }}
        />

        {/* ── Glow ring 2 (subtler warm) ── */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            width: 210,
            height: 210,
            borderRadius: "50%",
            border: "1px solid rgba(251,191,36,0.28)",
            animation: "scin-ring2 1.7s 0.55s cubic-bezier(0.16,1,0.3,1) forwards",
            opacity: 0,
          }}
        />

        {/* ── Main content ── */}
        <div className="relative flex flex-col items-center">

          {/* Logo + sweep */}
          <div
            style={{
              width: "clamp(130px, 22vw, 170px)",
              height: "clamp(130px, 22vw, 170px)",
              position: "relative",
            }}
          >
            <img
              src="/sendora-logo-4k.png"
              alt="Sendora"
              style={{
                mixBlendMode: "screen",
                objectFit: "contain",
                width: "100%",
                height: "100%",
                display: "block",
                animation: "scin-logo 1.25s 0.18s cubic-bezier(0.16,1,0.3,1) forwards",
                opacity: 0,
              }}
            />

            {/* Light sweep — clipped to logo container */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: "-25% 0",
                overflow: "hidden",
                borderRadius: 6,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  width: "60%",
                  background:
                    "linear-gradient(to right," +
                    "transparent 0%," +
                    "rgba(255,235,150,0.36) 40%," +
                    "rgba(255,255,220,0.55) 50%," +
                    "rgba(255,235,150,0.36) 60%," +
                    "transparent 100%)",
                  animation: "scin-sweep 0.82s 1.28s cubic-bezier(0.4,0,0.2,1) forwards",
                  opacity: 0,
                }}
              />
            </div>

            {/* Steady golden ambient halo behind the logo */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: "-30%",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle," +
                  "rgba(212,160,23,0.18) 0%," +
                  "rgba(184,134,11,0.08) 45%," +
                  "transparent 70%)",
                animation: "scin-golden-pulse 2.5s 1.3s ease-in-out infinite",
                opacity: 0,
                pointerEvents: "none",
              }}
            />
          </div>

          {/* "Welcome to Sendora" */}
          <h1
            style={{
              marginTop: "clamp(28px, 5vw, 40px)",
              color: "#ffffff",
              fontWeight: 300,
              fontSize: "clamp(1.15rem, 3.5vw, 1.65rem)",
              textAlign: "center",
              letterSpacing: "0.1em",
              animation: "scin-wordmark 0.9s 2.2s cubic-bezier(0.16,1,0.3,1) forwards",
              opacity: 0,
            }}
          >
            Welcome to{" "}
            <span style={{ fontWeight: 600 }}>Sendora</span>
          </h1>

          {/* Tagline */}
          <p
            style={{
              marginTop: 10,
              color: "#ffffff",
              fontSize: "clamp(0.65rem, 1.6vw, 0.78rem)",
              textAlign: "center",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              animation: "scin-tag 0.65s 2.9s ease-out forwards",
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
          style={{
            position: "absolute",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            borderRadius: 999,
            padding: "8px 22px",
            fontSize: "0.72rem",
            fontWeight: 500,
            color: "rgba(255,255,255,0.38)",
            cursor: "pointer",
            letterSpacing: "0.06em",
            transition: "color 0.2s, border-color 0.2s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.72)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.22)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.38)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.10)";
          }}
        >
          Skip
        </button>
      </div>
    </>
  );
}
