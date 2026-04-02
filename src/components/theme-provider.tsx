"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function applyMailTheme(theme: string, accentHex: string) {
  const root = document.documentElement;
  const hex = accentHex?.match(/^#[0-9a-fA-F]{6}$/) ? accentHex : "#5b4dff";
  root.style.setProperty("--accent", hex);
  root.style.setProperty("--accent-soft", `${hex}22`);
  let resolved: "light" | "dark" = "light";
  if (theme === "system") {
    resolved = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } else if (theme === "dark") {
    resolved = "dark";
  }
  root.classList.toggle("dark", resolved === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeRef = useRef("system");
  const accentRef = useRef("#5b4dff");
  const pathname = usePathname();

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/settings", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        settings: { theme: string; accentHex: string };
      };
      themeRef.current = data.settings.theme;
      accentRef.current = data.settings.accentHex || "#5b4dff";
      applyMailTheme(themeRef.current, accentRef.current);
    })();
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      if (themeRef.current === "system") {
        applyMailTheme("system", accentRef.current);
      }
    };
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return children;
}
