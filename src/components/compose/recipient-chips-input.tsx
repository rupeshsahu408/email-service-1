"use client";

import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

function splitCandidates(raw: string): string[] {
  return raw
    .split(/[,;\n\r\t ]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function emailInitial(email: string): string {
  const t = email.trim();
  const ch = t[0] || "?";
  return ch.toUpperCase();
}

function isProbablyEmail(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  // Lightweight check; server enforces strict validation.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function RecipientChipsInput({
  label,
  value,
  onChange,
  placeholder = "recipient@example.com",
  required,
  rightSlot,
  disabled,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  required?: boolean;
  rightSlot?: React.ReactNode;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const hasInvalid = useMemo(() => value.some((v) => !isProbablyEmail(v)), [value]);

  function commitCandidates(raw: string) {
    const candidates = splitCandidates(raw);
    if (candidates.length === 0) return;
    const normalized = candidates.map((c) => c.trim()).filter(Boolean);
    const next = [...value];
    for (const c of normalized) {
      const lower = c.toLowerCase();
      const already = next.some((x) => x.toLowerCase() === lower);
      if (!already) next.push(c);
    }
    onChange(next);
  }

  function commitDraft() {
    if (!draft.trim()) return;
    commitCandidates(draft);
    setDraft("");
  }

  return (
    <div className="flex items-start gap-3 px-4 py-2 border-b border-neutral-200">
      <div className="w-10 shrink-0 pt-1 text-xs font-medium text-neutral-500">
        {label}
      </div>

      <div
        className="flex-1 min-w-0"
        onMouseDown={(e) => {
          // Keep focus behavior Gmail-like.
          if (e.target === e.currentTarget) inputRef.current?.focus();
        }}
      >
        <div className="flex flex-wrap items-center gap-1.5 py-0.5">
          {value.map((email) => {
            const invalid = !isProbablyEmail(email);
            return (
              <span
                key={email}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[12.5px] leading-none",
                  invalid
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-neutral-200 bg-neutral-50 text-neutral-800",
                ].join(" ")}
              >
                <span className="w-5 h-5 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-[11px] text-neutral-600">
                  {emailInitial(email)}
                </span>
                <span className="max-w-[260px] truncate">{email}</span>
                {!disabled && (
                  <button
                    type="button"
                    className="ml-0.5 inline-flex items-center justify-center rounded-full w-5 h-5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/60 transition-colors"
                    onClick={() => onChange(value.filter((v) => v !== email))}
                    aria-label={`Remove ${email}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            );
          })}

          <input
            ref={inputRef}
            value={draft}
            disabled={disabled}
            onChange={(e) => {
              const next = e.target.value;
              setDraft(next);
              // As the user types separators, commit immediately.
              if (/[,\s;]\s*$/.test(next)) {
                commitCandidates(next);
                setDraft("");
              }
            }}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === "Enter" || e.key === "," || e.key === ";") {
                e.preventDefault();
                commitDraft();
                return;
              }
              if (e.key === "Backspace" && !draft) {
                const last = value[value.length - 1];
                if (!last) return;
                onChange(value.slice(0, -1));
              }
            }}
            onPaste={(e) => {
              if (disabled) return;
              const text = e.clipboardData.getData("text");
              const parts = splitCandidates(text);
              if (parts.length <= 1) return;
              e.preventDefault();
              commitCandidates(text);
              setDraft("");
            }}
            onBlur={() => commitDraft()}
            required={required && value.length === 0}
            placeholder={value.length === 0 ? placeholder : ""}
            className={[
              "min-w-[120px] flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 py-1",
              hasInvalid ? "caret-red-600" : "",
            ].join(" ")}
            aria-invalid={hasInvalid || undefined}
          />
        </div>
        {hasInvalid && (
          <div className="text-[11px] text-red-600 mt-0.5">
            One or more emails look invalid.
          </div>
        )}
      </div>

      {rightSlot ? <div className="shrink-0 pt-1">{rightSlot}</div> : null}
    </div>
  );
}

