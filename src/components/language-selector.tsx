"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { LANGUAGES, type Language } from "@/lib/languages";
import { useLanguage } from "@/components/language-context";

interface LanguageSelectorProps {
  variant?: "navbar" | "mobile";
}

export function LanguageSelector({ variant = "navbar" }: LanguageSelectorProps) {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.native.toLowerCase().includes(search.toLowerCase()) ||
      l.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpen = useCallback(() => {
    setOpen(true);
    setSearch("");
    setTimeout(() => searchRef.current?.focus(), 60);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  const handleSelect = useCallback(
    (lang: Language) => {
      setLanguage(lang);
      handleClose();
    },
    [setLanguage, handleClose]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    const onPointer = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, handleClose]);

  if (variant === "mobile") {
    return (
      <div className="pt-3 border-t border-[#f0edfb]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9896b4] px-1 mb-2">
          Language
        </p>
        <div className="relative" ref={containerRef}>
          <button
            type="button"
            onClick={open ? handleClose : handleOpen}
            className="w-full flex items-center justify-between gap-2 rounded-xl border border-[#e8e4f8] bg-white px-3 py-2.5 text-sm font-medium text-[#1c1b33] hover:border-[#6d4aff]/40 hover:bg-[#f8f5ff] transition-all duration-200"
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className="flex items-center gap-2">
              <span className="text-base leading-none">{language.flag}</span>
              <span className="text-[13px]">{language.native}</span>
            </span>
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className={`w-3.5 h-3.5 text-[#9896b4] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>

          {open && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-[#e8e4f8] bg-white shadow-xl shadow-[#6d4aff]/8 overflow-hidden">
              <div className="p-2 border-b border-[#f0edfb]">
                <div className="relative">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9896b4]">
                    <circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 2.5 2.5" strokeLinecap="round" />
                  </svg>
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t.languageSearch}
                    className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-[#f8f5ff] border border-[#e8e4f8] rounded-lg focus:outline-none focus:border-[#6d4aff]/50 text-[#1c1b33] placeholder:text-[#9896b4]"
                  />
                </div>
              </div>
              <div ref={listRef} className="max-h-44 overflow-y-auto overscroll-contain">
                {filtered.length === 0 ? (
                  <p className="py-4 text-center text-[12px] text-[#9896b4]">No languages found</p>
                ) : (
                  filtered.map((lang) => (
                    <MobileLanguageOption
                      key={lang.code}
                      lang={lang}
                      selected={lang.code === language.code}
                      onSelect={handleSelect}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={open ? handleClose : handleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.languageSelect}
        className={`
          group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium
          border transition-all duration-200 select-none
          ${open
            ? "border-[#6d4aff]/50 bg-[#f3f0fd] text-[#6d4aff]"
            : "border-[#e8e4f8] bg-white text-[#65637e] hover:border-[#6d4aff]/40 hover:bg-[#f8f5ff] hover:text-[#6d4aff]"
          }
        `}
      >
        <span className="text-[14px] leading-none">{language.flag}</span>
        <span className="hidden sm:inline">{language.native}</span>
        <svg
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className={`w-2.5 h-2.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={handleClose}
            aria-hidden="true"
          />
          <div
            className="
              absolute right-0 top-full mt-2 z-50 w-72
              rounded-2xl border border-[#e8e4f8] bg-white
              shadow-2xl shadow-[#6d4aff]/10
              overflow-hidden
              animate-in
            "
            style={{
              animation: "langDropIn 0.18s cubic-bezier(0.16,1,0.3,1) both",
            }}
            role="listbox"
            aria-label={t.languageSelect}
          >
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9896b4] pointer-events-none"
                >
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="m10.5 10.5 2.5 2.5" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.languageSearch}
                  className="
                    w-full pl-9 pr-3 py-2 text-[13px]
                    bg-[#f8f5ff] border border-[#e8e4f8] rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-[#6d4aff]/25 focus:border-[#6d4aff]/50
                    text-[#1c1b33] placeholder:text-[#9896b4]
                    transition-all duration-150
                  "
                />
              </div>
            </div>

            <div
              ref={listRef}
              className="max-h-72 overflow-y-auto overscroll-contain pb-2"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#e8e4f8 transparent" }}
            >
              {filtered.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-[12px] text-[#9896b4]">No languages found</p>
                </div>
              ) : (
                <div className="px-2">
                  {filtered.map((lang) => (
                    <DropdownLanguageOption
                      key={lang.code}
                      lang={lang}
                      selected={lang.code === language.code}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-[#f0edfb] flex items-center gap-1.5">
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-3 h-3 text-[#9896b4]">
                <circle cx="7" cy="7" r="5.5" />
                <path d="M7 1.5c-1.5 2-2 3.5-2 5.5s.5 3.5 2 5.5M7 1.5c1.5 2 2 3.5 2 5.5s-.5 3.5-2 5.5M1.5 7h11" strokeLinecap="round" />
              </svg>
              <span className="text-[10px] text-[#9896b4]">{filtered.length} languages available</span>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes langDropIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

function DropdownLanguageOption({
  lang,
  selected,
  onSelect,
}: {
  lang: Language;
  selected: boolean;
  onSelect: (lang: Language) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => onSelect(lang)}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left
        transition-all duration-150 group
        ${selected
          ? "bg-[#f3f0fd] text-[#6d4aff]"
          : "text-[#1c1b33] hover:bg-[#f8f5ff] hover:text-[#6d4aff]"
        }
      `}
    >
      <span className="text-[18px] leading-none shrink-0 w-7 text-center">{lang.flag}</span>
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] font-medium leading-tight truncate ${selected ? "text-[#6d4aff]" : "text-[#1c1b33] group-hover:text-[#6d4aff]"}`}>
          {lang.native}
        </div>
        <div className="text-[11px] text-[#9896b4] leading-tight truncate">{lang.name}</div>
      </div>
      {selected && (
        <div className="shrink-0 w-4 h-4 rounded-full bg-[#6d4aff] flex items-center justify-center">
          <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
            <polyline points="2 5 4.5 7.5 8 3" />
          </svg>
        </div>
      )}
    </button>
  );
}

function MobileLanguageOption({
  lang,
  selected,
  onSelect,
}: {
  lang: Language;
  selected: boolean;
  onSelect: (lang: Language) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(lang)}
      className={`
        w-full flex items-center gap-2.5 px-3 py-2.5 text-left
        transition-colors duration-150
        ${selected ? "bg-[#f3f0fd] text-[#6d4aff]" : "text-[#1c1b33] hover:bg-[#f8f5ff]"}
      `}
    >
      <span className="text-[16px] leading-none shrink-0">{lang.flag}</span>
      <span className="text-[13px] font-medium">{lang.native}</span>
      <span className="text-[11px] text-[#9896b4]">({lang.name})</span>
      {selected && (
        <div className="ml-auto w-3.5 h-3.5 rounded-full bg-[#6d4aff] flex items-center justify-center">
          <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="w-2 h-2">
            <polyline points="2 5 4.5 7.5 8 3" />
          </svg>
        </div>
      )}
    </button>
  );
}
