"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TiptapComposerEditor,
  type ComposerEditorHandle,
} from "@/components/compose/tiptap-composer-editor";
import { RecipientChipsInput } from "@/components/compose/recipient-chips-input";
import {
  STORAGE_ERROR_CODE,
  STORAGE_MESSAGE_FULL,
} from "@/lib/storage-quota";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  FileText,
  Image as IconImage,
  Italic,
  Link2,
  Lock,
  List,
  ListOrdered,
  MoreVertical,
  Paperclip,
  Sparkles,
  Quote,
  Smile,
  Underline,
  X,
} from "lucide-react";

const ANON_EMAIL_DOMAIN_SAMPLE =
  process.env.NEXT_PUBLIC_EMAIL_DOMAIN ?? "your Sendora domain";

export type ComposeReplySeed = { to: string; subject: string; initialBodyText?: string };

type OutboundMailbox = {
  id: string;
  emailAddress: string;
  isDefaultSender: boolean;
};

type ComposeClientProps = {
  open: boolean;
  replySeed: ComposeReplySeed | null;
  onClose: () => void;
  onSent: () => void;

  isBusiness: boolean;
  outboundMailboxes: OutboundMailbox[];
  goldenTickEligible: boolean;
  composePreviewFrom: string;

  draftAutoSaveOn: boolean;
  composeFontClass: string;

  /** From `/api/identity` — storage warnings for compose (Phase 2). */
  storageUsageLevel?: "ok" | "warning80" | "warning95" | "full";
  storageUsageMessage?: string | null;
};

type WindowMode = "floating" | "minimized" | "maximized" | "fullscreen";

type ConfidentialExpiryPreset = "1d" | "1w" | "1m" | "custom";
type ConfidentialPasscodeMode = "none" | "email_otp" | "sms_otp";
type ConfidentialSettings = {
  enabled: boolean;
  expiryPreset: ConfidentialExpiryPreset;
  customExpiresAt: string; // yyyy-mm-dd
  passcodeMode: ConfidentialPasscodeMode;
};

function confidentialPayloadFrom(confidential: ConfidentialSettings) {
  return confidential.enabled
    ? {
        enabled: true,
        passcodeMode: confidential.passcodeMode,
        expiresAt:
          confidential.expiryPreset === "custom" && confidential.customExpiresAt
            ? new Date(`${confidential.customExpiresAt}T00:00:00.000Z`).toISOString()
            : confidential.expiryPreset === "1d"
              ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
              : confidential.expiryPreset === "1m"
                ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }
    : { enabled: false };
}

function IconClose() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}

function IconMinimize() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M4 10a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

function IconMaximize() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M3.5 5A1.5 1.5 0 0 1 5 3.5h10A1.5 1.5 0 0 1 16.5 5v10A1.5 1.5 0 0 1 15 16.5H5A1.5 1.5 0 0 1 3.5 15V5Zm2 0a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-9Z" />
    </svg>
  );
}

function IconFullscreen() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M3.5 7A3.5 3.5 0 0 1 7 3.5h1a.75.75 0 0 1 0 1.5H7A2 2 0 0 0 5 7v1a.75.75 0 0 1-1.5 0V7Z" />
      <path d="M13 3.5a.75.75 0 0 0 0 1.5h1a2 2 0 0 1 2 2v1a.75.75 0 0 0 1.5 0V7a3.5 3.5 0 0 0-3.5-3.5h-1Z" />
      <path d="M3.5 13a.75.75 0 0 1 .75-.75H5A2 2 0 0 0 7 14.25h1a.75.75 0 0 1 0 1.5H7a3.5 3.5 0 0 1-3.5-3.5v-1Z" />
      <path d="M14.25 13a.75.75 0 0 1 .75.75v1A3.5 3.5 0 0 1 11.5 18H10.5a.75.75 0 0 1 0-1.5h1a2 2 0 0 0 2-2v-1a.75.75 0 0 1 .75-.5Z" />
    </svg>
  );
}

export function ComposeClient({
  open,
  replySeed,
  onClose,
  onSent,
  isBusiness,
  outboundMailboxes,
  goldenTickEligible,
  composePreviewFrom,
  draftAutoSaveOn,
  composeFontClass,
  storageUsageLevel = "ok",
  storageUsageMessage = null,
}: ComposeClientProps) {
  const [mode, setMode] = useState<WindowMode>("floating");
  const [mailboxId, setMailboxId] = useState<string>("");

  const [toList, setToList] = useState<string[]>([]);
  const [ccList, setCcList] = useState<string[]>([]);
  const [bccList, setBccList] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [editorHtml, setEditorHtml] = useState("");
  const [editorText, setEditorText] = useState("");
  const [sendError, setSendError] = useState("");
  const [storageFullDialog, setStorageFullDialog] = useState<string | null>(
    null
  );
  const editorHandleRef = useRef<ComposerEditorHandle | null>(null);
  const aiRequestIdRef = useRef<string | null>(null);
  const inlineSuggestReqSeqRef = useRef(0);
  const [attachInputEl, setAttachInputEl] = useState<HTMLInputElement | null>(null);
  const [imageInputEl, setImageInputEl] = useState<HTMLInputElement | null>(null);

  const [emojiOpen, setEmojiOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [linkText, setLinkText] = useState("");

  const UNDO_WINDOW_MS = 5000;

  const [undoJobId, setUndoJobId] = useState<string | null>(null);
  const [undoEndsAt, setUndoEndsAt] = useState<number | null>(null);
  const [undoNow, setUndoNow] = useState<number>(() => Date.now());
  const undoCountdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const undoFinalizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<string>("");

  const [draftAttachments, setDraftAttachments] = useState<
    {
      id: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      contentId: string | null;
    }[]
  >([]);
  const [uploadItems, setUploadItems] = useState<
    {
      tempKey: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      progress: number; // 0..100
      status: "uploading" | "done" | "error";
      attachmentId?: string;
      previewUrl?: string;
    }[]
  >([]);
  const [dragActive, setDragActive] = useState(false);
  const [insertImage, setInsertImage] = useState<{
    key: string;
    src: string;
    alt?: string;
  } | null>(null);

  const [confidential, setConfidential] = useState<ConfidentialSettings>({
    enabled: false,
    expiryPreset: "1w",
    customExpiresAt: "",
    passcodeMode: "none",
  });
  const [confidentialModalOpen, setConfidentialModalOpen] = useState(false);
  const [confidentialDraft, setConfidentialDraft] = useState<ConfidentialSettings | null>(
    null
  );
  const [sendAnonymously, setSendAnonymously] = useState(false);

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiTone, setAiTone] = useState<"auto" | "formal" | "casual">("auto");
  const [aiLength, setAiLength] = useState<"auto" | "short" | "detailed">("auto");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiHasOutput, setAiHasOutput] = useState(false);
  const [aiLastInputs, setAiLastInputs] = useState<{
    instruction: string;
    tone?: "formal" | "casual";
    length?: "short" | "detailed";
  } | null>(null);

  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const undoSecondsLeft = undoEndsAt
    ? Math.max(0, Math.ceil((undoEndsAt - undoNow) / 1000))
    : 0;

  function clearUndoTimers() {
    if (undoCountdownTimer.current) clearInterval(undoCountdownTimer.current);
    if (undoFinalizeTimer.current) clearTimeout(undoFinalizeTimer.current);
    undoCountdownTimer.current = null;
    undoFinalizeTimer.current = null;
  }

  function toDateTimeLocalValue(d: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }

  function splitRecipients(raw: string): string[] {
    return raw
      .split(/[,;\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  function isProbablyEmail(value: string): boolean {
    const v = value.trim();
    if (!v) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function firstInvalid(list: string[]): string | null {
    for (const v of list) {
      if (!isProbablyEmail(v)) return v;
    }
    return null;
  }

  const openLinkDialog = useCallback(() => {
    const prev = editorHandleRef.current?.getActiveLink() ?? "";
    const selText = editorHandleRef.current?.getSelectedText() ?? "";
    setLinkHref(prev);
    setLinkText(selText);
    setLinkOpen(true);
    setEmojiOpen(false);
  }, []);

  // Load draft on open; if replySeed is present, seed compose instead.
  useEffect(() => {
    if (!open) return;
    setMode("floating");
    setSendError("");
    clearUndoTimers();
    setUndoJobId(null);
    setUndoEndsAt(null);
    setUndoNow(Date.now());
    setScheduleOpen(false);
    setMoreOpen(false);
    setScheduleAt("");
    setDraftAttachments([]);
    setUploadItems([]);
    setDragActive(false);
    setInsertImage(null);
    setShowCc(false);
    setShowBcc(false);
    setEmojiOpen(false);
    setLinkOpen(false);
    setLinkHref("");
    setLinkText("");
    setSendAnonymously(false);
    setAiModalOpen(false);
    setAiLoading(false);
    setAiError("");
    setAiHasOutput(false);
    setAiLastInputs(null);

    if (isBusiness) {
      const def =
        outboundMailboxes.find((m) => m.isDefaultSender) ?? outboundMailboxes[0];
      setMailboxId(def?.id ?? "");
    } else {
      setMailboxId("");
    }

    if (replySeed) {
      setToList(splitRecipients(replySeed.to ?? ""));
      setCcList([]);
      setBccList([]);
      setSubject(replySeed.subject ?? "");
      const body = (replySeed.initialBodyText ?? "").trim();
      if (body) {
        const safe = body
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
        setEditorText(body);
        setEditorHtml(`<div>${safe.replace(/\n/g, "<br/>")}</div>`);
      } else {
        setEditorHtml("");
        setEditorText("");
      }
      return;
    }

    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/mail/drafts", { credentials: "include" });
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as {
        draft: {
          toAddr: string;
          ccAddr: string;
          bccAddr: string;
          subject: string;
          bodyText: string;
          bodyHtml: string;
        };
      };
      if (cancelled) return;
      setToList(splitRecipients(data.draft.toAddr ?? ""));
      setCcList(splitRecipients(data.draft.ccAddr ?? ""));
      setBccList(splitRecipients(data.draft.bccAddr ?? ""));
      setSubject(data.draft.subject ?? "");
      const bt = data.draft.bodyText ?? "";
      const bh = data.draft.bodyHtml ?? "";
      setEditorText(bt);
      setEditorHtml(bh ?? "");

      // Rehydrate draft attachments so the compose footer can show previews.
      try {
        const aRes = await fetch("/api/mail/draft-attachments", {
          credentials: "include",
        });
        if (aRes.ok) {
          const aData = (await aRes.json()) as {
            attachments?: {
              id: string;
              filename: string;
              mimeType: string;
              sizeBytes: number;
              contentId: string | null;
            }[];
          };
          if (!cancelled) setDraftAttachments(aData.attachments ?? []);
        }
      } catch {
        // Ignore; draft content still loads.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    replySeed,
    isBusiness,
    outboundMailboxes,
  ]);

  // Avoid dangling timers after the compose window closes/unmounts.
  useEffect(() => {
    return () => clearUndoTimers();
  }, []);

  const saveDraft = useCallback(() => {
    const html = editorHtml;
    const text = editorText;
    void fetch("/api/mail/drafts", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        toAddr: toList.join(", "),
        ccAddr: ccList.join(", "),
        bccAddr: bccList.join(", "),
        subject,
        bodyText: text,
        bodyHtml: html || undefined,
      }),
    }).then(async (res) => {
      if (res.status !== 403) return;
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      if (j.code === STORAGE_ERROR_CODE) {
        setStorageFullDialog(j.error ?? STORAGE_MESSAGE_FULL);
      }
    });
  }, [bccList, ccList, editorHtml, editorText, subject, toList]);

  useEffect(() => {
    if (!open || !draftAutoSaveOn) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(saveDraft, 900);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [open, draftAutoSaveOn, toList, ccList, bccList, subject, editorText, saveDraft]);

  const discardDraft = useCallback(async () => {
    // If the user discards while an undoable send is in-flight, cancel it first.
    if (undoJobId) {
      try {
        await fetch("/api/mail/scheduled/cancel", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: undoJobId }),
        });
      } catch {
        // Ignore; still reset UI.
      }
    }

    try {
      await fetch("/api/mail/drafts", {
        method: "DELETE",
        credentials: "include",
      });
    } catch {
      // Ignore; still reset UI.
    }
    if (draftTimer.current) clearTimeout(draftTimer.current);
    clearUndoTimers();
    setUndoJobId(null);
    setUndoEndsAt(null);
    setUndoNow(Date.now());
    setScheduleOpen(false);
    setMoreOpen(false);
    setScheduleAt("");
    setToList([]);
    setCcList([]);
    setBccList([]);
    setShowCc(false);
    setShowBcc(false);
    setSubject("");
    setEditorHtml("");
    setEditorText("");
    setSendError("");
    setDraftAttachments([]);
    setUploadItems([]);
    setInsertImage(null);
    onClose();
  }, [onClose, undoJobId]);

  async function sendMail(e: React.FormEvent) {
    e.preventDefault();
    setSendError("");

    if (uploadItems.length > 0) {
      setSendError("Please wait until uploads finish.");
      return;
    }

    if (undoJobId) {
      setSendError("A send is already pending undo.");
      return;
    }

    if (toList.length === 0) {
      setSendError("Add at least one recipient.");
      return;
    }

    const badTo = firstInvalid(toList);
    if (badTo) {
      setSendError(`Invalid To: ${badTo}`);
      return;
    }
    const badCc = firstInvalid(ccList);
    if (badCc) {
      setSendError(`Invalid Cc: ${badCc}`);
      return;
    }
    const badBcc = firstInvalid(bccList);
    if (badBcc) {
      setSendError(`Invalid Bcc: ${badBcc}`);
      return;
    }

    if (!editorText && !editorHtml) {
      setSendError("Message body cannot be empty.");
      return;
    }

    const draftAttachmentIds = draftAttachments.map((a) => a.id);

    const sendAtMs = Date.now() + UNDO_WINDOW_MS;

    const confidentialPayload = confidentialPayloadFrom(confidential);

    const res = await fetch("/api/mail/scheduled/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        to: toList.join(", "),
        cc: ccList.join(", "),
        bcc: bccList.join(", "),
        subject,
        text: editorText,
        html: editorHtml || undefined,
        draftAttachmentIds,
        sendAt: sendAtMs,
        ...(mailboxId ? { mailboxId } : {}),
        confidential: confidentialPayload,
        sendAnonymously,
      }),
    });
    const raw = await res.text();
    const ct = res.headers.get("content-type") ?? "";
    let data: { error?: string; id?: string; code?: string } = {};
    try {
      data = (raw ? (JSON.parse(raw) as unknown) : {}) as {
        error?: string;
        id?: string;
        code?: string;
      };
    } catch {
      // Non-JSON response will be handled via fallback text below.
    }
    if (!res.ok) {
      if (res.status === 403 && data.code === STORAGE_ERROR_CODE) {
        setStorageFullDialog(data.error ?? STORAGE_MESSAGE_FULL);
        return;
      }
      const base =
        data.error ??
        (raw ? "Send failed" : "Send failed (empty response)");
      setSendError(`${base} — HTTP ${res.status}${ct ? ` (${ct})` : ""}`);
      return;
    }

    clearUndoTimers();

    if (!data.id) {
      setSendError("Send scheduled, but no job id was returned.");
      return;
    }

    setUndoJobId(data.id);
    setUndoEndsAt(sendAtMs);
    setUndoNow(Date.now());
    undoCountdownTimer.current = setInterval(() => setUndoNow(Date.now()), 200);

    undoFinalizeTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const runRes = await fetch("/api/mail/scheduled/run", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
          });
          const runRaw = await runRes.text();
          let runData: { error?: string } = {};
          try {
            runData = (runRaw ? (JSON.parse(runRaw) as unknown) : {}) as {
              error?: string;
            };
          } catch {
            // Keep fallback error message below.
          }
          if (!runRes.ok) {
            throw new Error(runData.error ?? `Dispatch failed (HTTP ${runRes.status})`);
          }
          clearUndoTimers();
          setUndoJobId(null);
          setUndoEndsAt(null);
          setScheduleOpen(false);
          onSent();
          onClose();
        } catch (e) {
          clearUndoTimers();
          setUndoJobId(null);
          setUndoEndsAt(null);
          setScheduleOpen(false);
          setSendError(
            e instanceof Error
              ? `Send queued but delivery trigger failed: ${e.message}`
              : "Send queued but delivery trigger failed."
          );
        }
      })();
    }, UNDO_WINDOW_MS + 100);
  }

  async function undoScheduledSend() {
    if (!undoJobId) return;
    setSendError("");

    const jobId = undoJobId;

    const res = await fetch("/api/mail/scheduled/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: jobId }),
    });
    const raw = await res.text();
    const ct = res.headers.get("content-type") ?? "";
    let data: { error?: string } = {};
    try {
      data = (raw ? (JSON.parse(raw) as unknown) : {}) as { error?: string };
    } catch {
      // Non-JSON response will be handled via fallback text below.
    }
    if (!res.ok) {
      const base =
        data.error ??
        (raw ? "Undo failed" : "Undo failed (empty response)");
      setSendError(`${base} — HTTP ${res.status}${ct ? ` (${ct})` : ""}`);
      return;
    }

    clearUndoTimers();
    setUndoJobId(null);
    setUndoEndsAt(null);
    setUndoNow(Date.now());
  }

  async function scheduleSend() {
    setSendError("");
    setScheduleOpen(false);

    const parsed = scheduleAt ? new Date(scheduleAt) : null;
    const sendAtMs = parsed ? parsed.getTime() : NaN;
    if (!Number.isFinite(sendAtMs)) {
      setSendError("Please select a valid date/time.");
      setScheduleOpen(true);
      return;
    }
    if (sendAtMs <= Date.now() + 1000) {
      setSendError("Schedule time must be in the future.");
      setScheduleOpen(true);
      return;
    }

    if (toList.length === 0) {
      setSendError("Add at least one recipient.");
      setScheduleOpen(true);
      return;
    }

    const badTo = firstInvalid(toList);
    if (badTo) {
      setSendError(`Invalid To: ${badTo}`);
      setScheduleOpen(true);
      return;
    }
    const badCc = firstInvalid(ccList);
    if (badCc) {
      setSendError(`Invalid Cc: ${badCc}`);
      setScheduleOpen(true);
      return;
    }
    const badBcc = firstInvalid(bccList);
    if (badBcc) {
      setSendError(`Invalid Bcc: ${badBcc}`);
      setScheduleOpen(true);
      return;
    }

    if (!editorText && !editorHtml) {
      setSendError("Message body cannot be empty.");
      return;
    }
    if (uploadItems.length > 0) {
      setSendError("Please wait until uploads finish.");
      setScheduleOpen(true);
      return;
    }

    const draftAttachmentIds = draftAttachments.map((a) => a.id);
    const confidentialPayload = confidentialPayloadFrom(confidential);

    const res = await fetch("/api/mail/scheduled/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        to: toList.join(", "),
        cc: ccList.join(", "),
        bcc: bccList.join(", "),
        subject,
        text: editorText,
        html: editorHtml || undefined,
        draftAttachmentIds,
        sendAt: Math.floor(sendAtMs),
        ...(mailboxId ? { mailboxId } : {}),
        confidential: confidentialPayload,
        sendAnonymously,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      id?: string;
      code?: string;
    };
    if (!res.ok) {
      if (res.status === 403 && data.code === STORAGE_ERROR_CODE) {
        setStorageFullDialog(data.error ?? STORAGE_MESSAGE_FULL);
        setScheduleOpen(true);
        return;
      }
      setSendError(data.error ?? "Schedule failed");
      setScheduleOpen(true);
      return;
    }

    // Scheduling “commits” the current draft.
    await discardDraft();
    onSent();
  }

  function escapeRegExp(raw: string) {
    return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function plainTextToEmailHtml(bodyText: string): string {
    // Keep this intentionally small/safe: no markup, just line breaks.
    const safe = bodyText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    return `<div>${safe.replace(/\n/g, "<br/>")}</div>`;
  }

  function htmlToPlainText(html: string): string {
    return html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const requestInlineSuggestion = useCallback(
    async (
      ctx: { before: string; after: string },
      signal: AbortSignal
    ): Promise<string | null> => {
      const seq = ++inlineSuggestReqSeqRef.current;
      try {
        const res = await fetch("/api/ai/compose-inline", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          signal,
          body: JSON.stringify({
            subject: subject ?? "",
            textBeforeCursor: ctx.before,
            textAfterCursor: ctx.after,
          }),
        });
        if (seq !== inlineSuggestReqSeqRef.current) return null;
        const json = (await res.json().catch(() => ({}))) as {
          suggestion?: string;
          error?: string;
        };
        if (!res.ok) return null;
        const s = typeof json.suggestion === "string" ? json.suggestion.trim() : "";
        return s || null;
      } catch {
        return null;
      }
    },
    [subject]
  );

  async function generateAiEmail(): Promise<void> {
    if (aiLoading) return;

    const instruction = aiInstruction.trim();
    if (!instruction) {
      setAiError("Please describe what you want to write.");
      return;
    }

    const tone = aiTone === "auto" ? undefined : aiTone;
    const length = aiLength === "auto" ? undefined : aiLength;

    const payload = {
      instruction,
      tone,
      length,
      existingSubject: subject ?? "",
      toHint: toList[0] ?? "",
    };

    const requestId = crypto.randomUUID();
    aiRequestIdRef.current = requestId;

    setAiLoading(true);
    setAiError("");

    try {
      const res = await fetch("/api/ai/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => ({}))) as { error?: string };

      if (aiRequestIdRef.current !== requestId) return; // stale response

      if (!res.ok) {
        setAiError(json.error ?? "AI generation failed. Please try again.");
        return;
      }

      const data = json as unknown as {
        subject?: string;
        bodyText?: string;
        bodyHtml?: string;
      };

      const nextSubject = typeof data.subject === "string" ? data.subject : "";
      const nextBodyText = typeof data.bodyText === "string" ? data.bodyText : "";
      const nextBodyHtml =
        typeof data.bodyHtml === "string" && data.bodyHtml.trim()
          ? data.bodyHtml
          : plainTextToEmailHtml(nextBodyText);

      setSubject(nextSubject);
      setEditorHtml(nextBodyHtml);
      setEditorText(nextBodyText || htmlToPlainText(nextBodyHtml));
      setAiHasOutput(true);
      setAiLastInputs({ instruction, tone: tone ?? "formal", length: length ?? "detailed" });
      setAiError("");

      // Keep editing flow uninterrupted.
      editorHandleRef.current?.focus();
    } catch (e) {
      if (aiRequestIdRef.current !== requestId) return; // stale response
      setAiError(e instanceof Error ? e.message : "AI generation failed.");
    } finally {
      if (aiRequestIdRef.current === requestId) setAiLoading(false);
    }
  }

  async function uploadFile(file: File) {
    const tempKey = crypto.randomUUID();
    const isImage = (file.type || "").toLowerCase().startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(file) : undefined;

    setUploadItems((prev) => [
      ...prev,
      {
        tempKey,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        progress: 0,
        status: "uploading",
        previewUrl,
      },
    ]);

    type DraftAttachmentUpload = {
      id: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      contentId: string | null;
    };

    const res = await new Promise<{
      attachments?: DraftAttachmentUpload[];
    }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/mail/draft-attachments", true);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable) return;
        const pct = Math.max(0, Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
        setUploadItems((prev) =>
          prev.map((p) => (p.tempKey === tempKey ? { ...p, progress: pct } : p))
        );
      };

      xhr.onload = () => {
        try {
          if (xhr.status === 403) {
            const err = JSON.parse(xhr.responseText || "{}") as {
              error?: string;
              code?: string;
            };
            if (err.code === STORAGE_ERROR_CODE) {
              setStorageFullDialog(err.error ?? STORAGE_MESSAGE_FULL);
              reject(new Error("__STORAGE_FULL__"));
              return;
            }
          }
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(`Upload failed (${xhr.status})`));
            return;
          }
          const parsed = JSON.parse(xhr.responseText || "{}") as {
            attachments?: DraftAttachmentUpload[];
          };
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      };
      xhr.onerror = () => reject(new Error("Network error"));

      const fd = new FormData();
      fd.append("attachments", file);
      xhr.send(fd);
    });

    setUploadItems((prev) => prev.filter((p) => p.tempKey !== tempKey));
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    const first = res.attachments?.[0];
    if (!first?.id) {
      throw new Error("Upload response missing attachment id");
    }

    const uploaded = {
      id: String(first.id),
      filename: String(first.filename),
      mimeType: String(first.mimeType),
      sizeBytes: Number(first.sizeBytes),
      contentId: first.contentId ? String(first.contentId) : null,
    };

    return uploaded;
  }

  async function handleFiles(files: File[]) {
    const safe = files.filter((f) => f.size > 0);
    if (safe.length === 0) return;

    // Sequential uploads keep insertion ordering more predictable.
    for (const f of safe) {
      try {
        const uploaded = await uploadFile(f);
        setDraftAttachments((prev) => [uploaded, ...prev]);

        if ((uploaded.mimeType || "").toLowerCase().startsWith("image/")) {
          setInsertImage({
            key: uploaded.id,
            src: `/api/mail/draft-attachments/${uploaded.id}`,
            alt: uploaded.filename,
          });
        }
      } catch (e) {
        if (e instanceof Error && e.message === "__STORAGE_FULL__") continue;
        setSendError(
          e instanceof Error ? e.message : "Failed to upload attachment"
        );
      }
    }
  }

  async function removeDraftAttachment(id: string) {
    const att = draftAttachments.find((a) => a.id === id) ?? null;

    const res = await fetch(`/api/mail/draft-attachments/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) return;

    setDraftAttachments((prev) => prev.filter((a) => a.id !== id));

    if (!att?.mimeType?.toLowerCase().startsWith("image/")) return;

    const src = `/api/mail/draft-attachments/${id}`;
    const srcEscaped = escapeRegExp(src);
    const pattern = new RegExp(
      `<img[^>]*src=["']${srcEscaped}["'][^>]*\\/?>`,
      "g"
    );

    setEditorHtml((prev) => {
      const nextHtml = prev.replace(pattern, "");
      const nextText = nextHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      setEditorText(nextText);
      return nextHtml;
    });
  }

  const windowStyle = useMemo(() => {
    if (mode === "floating") {
      return {
        width: "min(520px, calc(100vw - 24px))",
        boxShadow:
          "0 -4px 40px rgba(109,74,255,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
      };
    }
    if (mode === "maximized") {
      return {
        width: "min(820px, calc(100vw - 24px))",
        height: "min(86vh, 720px)",
        top: 40,
        left: "50%",
        transform: "translateX(-50%)",
        boxShadow:
          "0 24px 70px rgba(20,16,60,0.35), 0 0 0 1px rgba(0,0,0,0.06)",
      } as React.CSSProperties;
    }
    if (mode === "fullscreen") {
      return {
        inset: 0,
      };
    }
    return {};
  }, [mode]);

  if (!open) return null;

  if (mode === "minimized") {
    return (
      <div className="fixed bottom-4 right-5 z-50">
        <button
          type="button"
          onClick={() => setMode("floating")}
          className="rounded-full bg-[#6d4aff] px-5 py-3 text-sm font-semibold text-white shadow hover:bg-[#5b3dff] transition-colors"
          style={{ boxShadow: "0 16px 40px rgba(109,74,255,0.25)" }}
        >
          New message
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed z-50 rounded-t-xl shadow-2xl overflow-hidden bg-white border ${
        mode === "floating" ? "" : "border-[#e8e4f8] rounded-2xl"
      }`}
      style={
        mode === "fullscreen"
          ? {
              background: "rgba(0,0,0,0.35)",
              border: "none",
            }
          : mode === "maximized"
            ? {
                ...windowStyle,
                position: "fixed",
                borderRadius: 16,
              }
            : windowStyle
      }
    >
      {mode === "fullscreen" && (
        <div
          className="absolute inset-0"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={() => setMode("floating")}
        />
      )}

      <div
        className="relative"
        style={mode === "fullscreen" ? { width: "100%", height: "100%" } : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50 border-b border-neutral-200">
          <span className="text-sm font-medium text-neutral-800">New message</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMode("minimized")}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/70 transition-colors"
              title="Minimize"
            >
              <IconMinimize />
            </button>

            <button
              type="button"
              onClick={() =>
                setMode((m) => (m === "maximized" ? "floating" : "maximized"))
              }
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/70 transition-colors"
              title="Maximize"
            >
              <IconMaximize />
            </button>

            <button
              type="button"
              onClick={() =>
                setMode((m) => (m === "fullscreen" ? "floating" : "fullscreen"))
              }
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/70 transition-colors"
              title="Full-screen"
            >
              <IconFullscreen />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/70 transition-colors"
              title="Close"
            >
              <IconClose />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={sendMail} className="bg-white">
          {storageUsageMessage && storageUsageLevel !== "ok" && (
            <div
              className={`px-4 py-2.5 text-xs border-b border-neutral-200 ${
                storageUsageLevel === "full"
                  ? "bg-red-50 text-red-900"
                  : storageUsageLevel === "warning95"
                    ? "bg-amber-50 text-amber-950"
                    : "bg-[#fff8e6] text-[#6b5a1e]"
              }`}
              role="status"
            >
              {storageUsageMessage}
            </div>
          )}
          {isBusiness && outboundMailboxes.length > 0 && (
            <div className="border-b border-neutral-200 px-4 py-2 flex items-center gap-3">
              <span className="w-10 shrink-0 text-xs font-medium text-neutral-500">
                From
              </span>
              <select
                className="flex-1 bg-transparent text-sm text-neutral-900 outline-none"
                value={mailboxId}
                onChange={(e) => setMailboxId(e.target.value)}
              >
                <option value="">Default</option>
                {outboundMailboxes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.emailAddress}
                    {m.isDefaultSender ? " — default" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isBusiness && goldenTickEligible && composePreviewFrom && (
            <div className="border-b border-neutral-200 px-4 py-2 bg-[#fffbeb]">
              <p className="text-[10px] font-semibold text-amber-800/80 mb-1">
                How you appear in Sendora
              </p>
              <div className="flex items-center gap-1.5 text-xs text-[#1c1b33] min-w-0">
                <span className="truncate">{composePreviewFrom}</span>
              </div>
            </div>
          )}

          <div className="border-b border-[#e8e4f8] px-4 py-3 bg-[#f8f6fd]">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendAnonymously}
                onChange={(e) => setSendAnonymously(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[#d9d3f3] accent-[#6d4aff] shrink-0"
              />
              <span className="min-w-0">
                <span className="text-sm font-semibold text-[#1c1b33]">Send anonymously</span>
                <p className="text-xs text-[#65637e] mt-1 leading-relaxed">
                  Your real email will be hidden from the recipient. Sendora sends from a unique address on your domain (for example{" "}
                  <span className="whitespace-nowrap font-mono text-[11px] text-[#44435a]">
                    anon-…@{ANON_EMAIL_DOMAIN_SAMPLE}
                  </span>
                  ) so replies can reach your inbox while your personal address stays private. Your account is still associated with this send
                  for safety and moderation.
                </p>
                {sendAnonymously && isBusiness && outboundMailboxes.length > 0 ? (
                  <p className="text-[11px] text-[#5b3dff] mt-1.5 font-medium">
                    The selected “From” mailbox is not used for anonymous delivery.
                  </p>
                ) : null}
              </span>
            </label>
          </div>

          <RecipientChipsInput
            label="To"
            value={toList}
            onChange={(next) => setToList(next)}
            required
            rightSlot={
              <div className="flex items-center gap-2">
                {!showCc && ccList.length === 0 && (
                  <button
                    type="button"
                    className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                    onClick={() => setShowCc(true)}
                  >
                    Cc
                  </button>
                )}
                {!showBcc && bccList.length === 0 && (
                  <button
                    type="button"
                    className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                    onClick={() => setShowBcc(true)}
                  >
                    Bcc
                  </button>
                )}
              </div>
            }
          />

          {(showCc || ccList.length > 0) && (
            <RecipientChipsInput label="Cc" value={ccList} onChange={(next) => setCcList(next)} />
          )}

          {(showBcc || bccList.length > 0) && (
            <RecipientChipsInput
              label="Bcc"
              value={bccList}
              onChange={(next) => setBccList(next)}
            />
          )}

          <div className="border-b border-neutral-200 px-4 py-2 flex items-center gap-3">
            <span className="w-10 shrink-0 text-xs font-medium text-neutral-500">Subj</span>
            <input
              className="flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 py-1"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div
            className={[
              "relative bg-white",
              dragActive ? "ring-2 ring-[#6d4aff] ring-offset-0" : "",
            ].join(" ")}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              void handleFiles(Array.from(e.dataTransfer.files ?? []));
            }}
          >
            {dragActive && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow border border-neutral-200">
                  Drop files to attach
                </div>
              </div>
            )}
            <TiptapComposerEditor
              ref={(r) => {
                editorHandleRef.current = r;
              }}
              valueHtml={editorHtml}
              onChange={({ html, text }) => {
                setEditorHtml(html);
                setEditorText(text);
              }}
              composeFontClass={composeFontClass}
              insertImage={insertImage}
              onInsertImageConsumed={() => setInsertImage(null)}
              smartComposeEnabled={open}
              requestInlineSuggestion={requestInlineSuggestion}
            />
          </div>

          {/* Attachments strip */}
          {(uploadItems.length > 0 || draftAttachments.length > 0) && (
            <div className="px-4 py-2 border-t border-neutral-200 bg-white">
              <div className="flex flex-wrap gap-2">
                {uploadItems.map((u) => (
                  <div
                    key={u.tempKey}
                    className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2"
                  >
                    {u.mimeType.startsWith("image/") ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-neutral-200 bg-white shrink-0">
                        <img
                          src={u.previewUrl ?? ""}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg border border-neutral-200 bg-white shrink-0 flex items-center justify-center text-neutral-500">
                        <FileText className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-neutral-900 truncate max-w-[220px]">
                        {u.fileName}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        Uploading… {u.progress}%
                      </div>
                      <div className="h-1.5 mt-1 bg-neutral-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-neutral-900"
                          style={{ width: `${u.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {draftAttachments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2"
                  >
                    {a.mimeType.startsWith("image/") ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-neutral-200 bg-white shrink-0">
                        <img
                          src={`/api/mail/draft-attachments/${a.id}`}
                          alt={a.filename}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg border border-neutral-200 bg-neutral-50 shrink-0 flex items-center justify-center text-neutral-500">
                        <FileText className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-neutral-900 truncate max-w-[220px]">
                        {a.filename}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {(a.sizeBytes / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeDraftAttachment(a.id)}
                      className="ml-1 inline-flex items-center justify-center rounded-full w-8 h-8 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                      title="Remove"
                      disabled={uploadItems.length > 0}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-3 border-t border-neutral-200 bg-neutral-50">
            <div className="flex items-center justify-between gap-3 pb-2">
              <div className="flex items-center gap-1">
                {(
                  [
                    {
                      key: "attach",
                      icon: Paperclip,
                      label: "Attach files",
                      onClick: () => attachInputEl?.click(),
                    },
                    {
                      key: "sepA",
                    },
                    {
                      key: "confidential",
                      icon: Lock,
                      label: confidential.enabled ? "Confidential mode (on)" : "Confidential mode",
                      onClick: () => {
                        if (confidential.enabled) {
                          setConfidential((c) => ({ ...c, enabled: false }));
                          return;
                        }
                        const today = new Date();
                        const yyyy = today.getUTCFullYear();
                        const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
                        const dd = String(today.getUTCDate()).padStart(2, "0");
                        const defaultDate = `${yyyy}-${mm}-${dd}`;
                        setConfidentialDraft({
                          ...confidential,
                          enabled: true,
                          expiryPreset: confidential.expiryPreset ?? "1w",
                          customExpiresAt: confidential.customExpiresAt || defaultDate,
                        });
                        setConfidentialModalOpen(true);
                        setEmojiOpen(false);
                        setLinkOpen(false);
                        setMoreOpen(false);
                        setScheduleOpen(false);
                      },
                      className: confidential.enabled
                        ? "text-[#6d4aff] bg-[#6d4aff]/10 hover:bg-[#6d4aff]/15"
                        : undefined,
                    },
                    { key: "sepConf" },
                    {
                      key: "bold",
                      icon: Bold,
                      label: "Bold",
                      onClick: () => {
                        // eslint-disable-next-line react-hooks/refs
                        editorHandleRef.current?.toggleBold();
                      },
                    },
                    {
                      key: "italic",
                      icon: Italic,
                      label: "Italic",
                      onClick: () => {
                        // eslint-disable-next-line react-hooks/refs
                        editorHandleRef.current?.toggleItalic();
                      },
                    },
                    {
                      key: "underline",
                      icon: Underline,
                      label: "Underline",
                      onClick: () => {
                        // eslint-disable-next-line react-hooks/refs
                        editorHandleRef.current?.toggleUnderline();
                      },
                    },
                    { key: "sep1" },
                    {
                      key: "alignLeft",
                      icon: AlignLeft,
                      label: "Align left",
                      onClick: () => {
                        // eslint-disable-next-line react-hooks/refs
                        editorHandleRef.current?.align("left");
                      },
                    },
                    {
                      key: "alignCenter",
                      icon: AlignCenter,
                      label: "Align center",
                      onClick: () => {
                        // eslint-disable-next-line react-hooks/refs
                        editorHandleRef.current?.align("center");
                      },
                    },
                    {
                      key: "alignRight",
                      icon: AlignRight,
                      label: "Align right",
                      onClick: () => {
                        // eslint-disable-next-line react-hooks/refs
                        editorHandleRef.current?.align("right");
                      },
                    },
                    { key: "sep2" },
                    {
                      key: "bullet",
                      icon: List,
                      label: "Bulleted list",
                      onClick: () => {
                        // eslint-disable-next-line react-hooks/refs
                        editorHandleRef.current?.toggleBulletList();
                      },
                    },
                    {
                      key: "ordered",
                      icon: ListOrdered,
                      label: "Numbered list",
                      onClick: () => {
                        // eslint-disable-next-line react-hooks/refs
                        editorHandleRef.current?.toggleOrderedList();
                      },
                    },
                    {
                      key: "quote",
                      icon: Quote,
                      label: "Quote",
                      onClick: () => {
                        // eslint-disable-next-line react-hooks/refs
                        editorHandleRef.current?.toggleBlockquote();
                      },
                    },
                    { key: "sep3" },
                    {
                      key: "link",
                      icon: Link2,
                      label: "Insert link",
                      onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => {
                        e.preventDefault();
                      },
                      onClick: () => {
                        openLinkDialog();
                      },
                    },
                    {
                      key: "emoji",
                      icon: Smile,
                      label: "Emoji",
                      onClick: () => {
                        setEmojiOpen((v) => !v);
                        setLinkOpen(false);
                      },
                    },
                    {
                      key: "image",
                      icon: IconImage,
                      label: "Insert image",
                      onClick: () => {
                        imageInputEl?.click();
                      },
                    },
                  ] as const
                ).map((b) => {
                  if ("icon" in b) {
                    const I = b.icon;
                    const onMouseDown = (b as { onMouseDown?: (e: React.MouseEvent<HTMLButtonElement>) => void })
                      .onMouseDown;
                    return (
                      <button
                        key={b.key}
                        type="button"
                        className={[
                          "inline-flex items-center justify-center w-9 h-9 rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/70 transition-colors disabled:opacity-40 disabled:hover:bg-transparent",
                          (b as { className?: string }).className ?? "",
                        ].join(" ")}
                        aria-label={b.label}
                        onMouseDown={onMouseDown}
                        onClick={(b as { onClick?: () => void }).onClick}
                        disabled={Boolean((b as { disabled?: boolean }).disabled)}
                      >
                        <I className="w-4 h-4" />
                      </button>
                    );
                  }
                  return <div key={b.key} className="w-px h-5 bg-neutral-300 mx-1" />;
                })}

                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/70 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                  aria-label="Write with AI"
                  title="Write with AI"
                  onClick={() => {
                    setEmojiOpen(false);
                    setLinkOpen(false);
                    setMoreOpen(false);
                    setScheduleOpen(false);
                    setAiError("");
                    setAiHasOutput(false);
                    setAiLastInputs(null);
                    setAiModalOpen(true);
                  }}
                  disabled={uploadItems.length > 0 || aiLoading}
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-semibold whitespace-nowrap">✨ Write with AI</span>
                </button>

                <button
                  type="button"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/70 transition-colors"
                  aria-label="More"
                  onClick={() => {
                    setEmojiOpen(false);
                    setLinkOpen(false);
                    setMoreOpen((v) => !v);
                    setScheduleOpen(false);
                  }}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              {/* Popovers */}
              <div className="relative">
                <input
                  ref={setAttachInputEl}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleFiles(Array.from(e.target.files ?? []))}
                />
                <input
                  ref={setImageInputEl}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleFiles(Array.from(e.target.files ?? []))}
                />
                {emojiOpen && (
                  <div className="absolute right-0 top-10 z-30 w-[280px] rounded-xl border border-neutral-200 bg-white shadow-lg p-2">
                    <div className="grid grid-cols-10 gap-1 max-h-[180px] overflow-y-auto">
                      {[
                        "😀",
                        "😁",
                        "😂",
                        "🤣",
                        "😊",
                        "😍",
                        "😘",
                        "😎",
                        "😇",
                        "🙂",
                        "😉",
                        "😴",
                        "🤔",
                        "😅",
                        "😭",
                        "😤",
                        "👍",
                        "👎",
                        "👏",
                        "🔥",
                        "✨",
                        "🎉",
                        "❤️",
                        "💡",
                        "✅",
                        "❌",
                        "💯",
                        "🌟",
                        "☕",
                        "🚀",
                      ].map((e) => (
                        <button
                          key={e}
                          type="button"
                          className="h-7 w-7 rounded hover:bg-neutral-100 text-lg leading-none"
                          onClick={() => {
                            // eslint-disable-next-line react-hooks/refs
                            editorHandleRef.current?.insertText(e);
                            setEmojiOpen(false);
                          }}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {moreOpen && (
                  <div className="absolute right-0 top-10 z-30 w-[220px] rounded-xl border border-neutral-200 bg-white shadow-lg p-1">
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-neutral-100"
                      onClick={() => {
                        setMoreOpen(false);
                        setEmojiOpen(false);
                        setLinkOpen(false);
                        setScheduleAt(
                          toDateTimeLocalValue(new Date(Date.now() + 15 * 60 * 1000))
                        );
                        setScheduleOpen(true);
                      }}
                      disabled={uploadItems.length > 0 || undoJobId !== null}
                    >
                      Schedule send
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-neutral-100"
                      onClick={() => {
                        saveDraft();
                        setMoreOpen(false);
                      }}
                    >
                      Save draft
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
                      onClick={() => void discardDraft()}
                      disabled={undoJobId !== null}
                    >
                      Discard draft
                    </button>
                  </div>
                )}

                {scheduleOpen && !undoJobId && (
                  <div className="absolute right-0 top-10 z-30 w-[340px] rounded-xl border border-neutral-200 bg-white shadow-lg p-3">
                    <div className="text-xs font-medium text-neutral-700 mb-2">
                      Schedule send
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        value={scheduleAt}
                        onChange={(e) => setScheduleAt(e.target.value)}
                        className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
                      />
                      <button
                        type="button"
                        onClick={() => void scheduleSend()}
                        disabled={uploadItems.length > 0}
                        className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors disabled:opacity-60"
                      >
                        Set
                      </button>
                    </div>
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setScheduleOpen(false);
                          setScheduleAt("");
                        }}
                        className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="min-w-0">
                {sendError && <div className="text-xs text-red-600">{sendError}</div>}
              </div>

              <div className="flex items-center gap-2">
                {undoJobId ? (
                  <button
                    type="button"
                    onClick={() => void undoScheduledSend()}
                    disabled={uploadItems.length > 0}
                    className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors disabled:opacity-60"
                    title="Cancel the send job before it fires"
                  >
                    Undo ({undoSecondsLeft}s)
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={uploadItems.length > 0}
                    className="rounded-full bg-[#6d4aff] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#5b3dff] transition-colors disabled:opacity-60 disabled:hover:bg-[#6d4aff]"
                  >
                    Send
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      <AiEmailWriterModal
        open={aiModalOpen}
        instruction={aiInstruction}
        tone={aiTone}
        length={aiLength}
        loading={aiLoading}
        error={aiError}
        hasOutput={aiHasOutput}
        onCancel={() => {
          setAiModalOpen(false);
          setAiLoading(false);
          setAiError("");
        }}
        onInstructionChange={(next) => setAiInstruction(next)}
        onToneChange={(next) => setAiTone(next)}
        onLengthChange={(next) => setAiLength(next)}
        onGenerate={() => void generateAiEmail()}
      />

      <ConfidentialSettingsModal
        open={confidentialModalOpen}
        draft={confidentialDraft}
        onCancel={() => {
          setConfidentialModalOpen(false);
          setConfidentialDraft(null);
        }}
        onChangeDraft={(next) => setConfidentialDraft(next)}
        onSaveFinal={() => {
          if (!confidentialDraft) return;
          setConfidential(confidentialDraft);
          setConfidentialModalOpen(false);
          setConfidentialDraft(null);
        }}
      />

      {storageFullDialog && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 px-4"
          role="presentation"
          onClick={() => setStorageFullDialog(null)}
        >
          <div
            role="alertdialog"
            aria-labelledby="storage-full-title"
            className="w-full max-w-md rounded-2xl border border-[#e8e4f8] bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="storage-full-title"
              className="text-base font-semibold text-[#1c1b33]"
            >
              Storage full
            </h3>
            <p className="mt-2 text-sm text-[#65637e]">{storageFullDialog}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="rounded-xl bg-[#6d4aff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5b3dff]"
                onClick={() => setStorageFullDialog(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {linkOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4"
          role="presentation"
          onClick={() => setLinkOpen(false)}
        >
          <div
            role="dialog"
            aria-labelledby="compose-link-dialog-title"
            className="w-full max-w-md rounded-2xl border border-[#e8e4f8] bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="compose-link-dialog-title" className="text-base font-semibold text-[#1c1b33]">
              Edit link
            </h3>
            <p className="mt-1 text-xs text-[#65637e]">
              Text to show in the message, and where the link goes.
            </p>
            <label className="mt-4 block">
              <span className="text-xs font-medium text-[#44435a]">Text to display</span>
              <input
                autoFocus
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="e.g. here"
                className="mt-1 w-full rounded-xl border border-[#e8e4f8] px-3 py-2 text-sm text-[#1c1b33] outline-none focus:border-[#6d4aff]"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-[#44435a]">Web address (URL)</span>
              <input
                value={linkHref}
                onChange={(e) => setLinkHref(e.target.value)}
                placeholder="https://example.com"
                className="mt-1 w-full rounded-xl border border-[#e8e4f8] px-3 py-2 text-sm text-[#1c1b33] outline-none focus:border-[#6d4aff]"
              />
            </label>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                className="text-sm font-medium text-[#65637e] hover:text-[#1c1b33]"
                onClick={() => {
                  editorHandleRef.current?.unsetLink();
                  setLinkOpen(false);
                }}
              >
                Remove link
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-[#ddd6fe] px-3.5 py-2 text-sm font-medium text-[#5b3dff] hover:bg-[#f7f4ff]"
                  onClick={() => setLinkOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-[#6d4aff] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#5b3dff]"
                  onClick={() => {
                    const v = linkHref.trim();
                    if (!v) return;
                    editorHandleRef.current?.applyLinkWithDisplayText(v, linkText);
                    setLinkOpen(false);
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AiEmailWriterModal({
  open,
  instruction,
  tone,
  length,
  loading,
  error,
  hasOutput,
  onCancel,
  onInstructionChange,
  onToneChange,
  onLengthChange,
  onGenerate,
}: {
  open: boolean;
  instruction: string;
  tone: "auto" | "formal" | "casual";
  length: "auto" | "short" | "detailed";
  loading: boolean;
  error: string;
  hasOutput: boolean;
  onCancel: () => void;
  onInstructionChange: (next: string) => void;
  onToneChange: (next: "auto" | "formal" | "casual") => void;
  onLengthChange: (next: "auto" | "short" | "detailed") => void;
  onGenerate: () => void;
}) {
  if (!open) return null;

  const primaryLabel = loading ? "Generating..." : hasOutput ? "Regenerate" : "Generate";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#6d4aff]" />
              Write with AI
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              Describe what you want, and we&apos;ll generate a complete email.
            </div>
          </div>
          {hasOutput && !loading && (
            <div className="text-[10px] font-semibold text-[#6d4aff] bg-[#6d4aff]/10 rounded-full px-2 py-1 whitespace-nowrap">
              Inserted into editor
            </div>
          )}
        </div>

        <div className="px-5 py-5 space-y-4">
          <div>
            <div className="text-xs font-semibold text-neutral-700 mb-2">Instruction</div>
            <textarea
              value={instruction}
              onChange={(e) => onInstructionChange(e.target.value)}
              placeholder='e.g. "client follow-up" or "leave request for 2 days"'
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[#6d4aff]"
              rows={4}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-neutral-700 mb-2">Tone</div>
              <select
                value={tone}
                onChange={(e) => onToneChange(e.target.value as "auto" | "formal" | "casual")}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#6d4aff]"
                disabled={loading}
              >
                <option value="auto">Auto</option>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-neutral-700 mb-2">Length</div>
              <select
                value={length}
                onChange={(e) =>
                  onLengthChange(e.target.value as "auto" | "short" | "detailed")
                }
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#6d4aff]"
                disabled={loading}
              >
                <option value="auto">Auto</option>
                <option value="short">Short</option>
                <option value="detailed">Detailed</option>
              </select>
            </div>
          </div>

          {error && <div className="text-xs text-red-600">{error}</div>}

          {!error && hasOutput && !loading && (
            <div className="text-xs text-neutral-500">
              Edit freely in the compose editor. Subject and body were filled automatically.
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-[#6d4aff] disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Cancel" : "Close"}
          </button>
          <button
            type="button"
            onClick={() => onGenerate()}
            disabled={loading || !instruction.trim()}
            className="rounded-xl bg-[#6d4aff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5b3dff] disabled:opacity-60"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfidentialSettingsModal({
  open,
  draft,
  onCancel,
  onChangeDraft,
  onSaveFinal,
}: {
  open: boolean;
  draft: ConfidentialSettings | null;
  onCancel: () => void;
  onChangeDraft: (next: ConfidentialSettings) => void;
  onSaveFinal: () => void;
}) {
  if (!open || !draft) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200">
          <div className="text-sm font-semibold text-neutral-900">Confidential mode</div>
          <div className="text-xs text-neutral-500 mt-1">
            Sends a secure link instead of the full email body.
          </div>
        </div>

        <div className="px-5 py-5 space-y-5">
          <div>
            <div className="text-xs font-semibold text-neutral-700 mb-2">Expiration</div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["1d", "1 day"],
                  ["1w", "1 week"],
                  ["1m", "1 month"],
                  ["custom", "Custom"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={[
                    "rounded-xl border px-3 py-2 text-sm font-medium text-left transition-colors",
                    draft.expiryPreset === key
                      ? "border-[#6d4aff] text-[#1c1b33] bg-[#6d4aff]/10"
                      : "border-neutral-200 text-neutral-700 hover:border-[#6d4aff]",
                  ].join(" ")}
                  onClick={() =>
                    onChangeDraft({ ...draft, expiryPreset: key })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            {draft.expiryPreset === "custom" && (
              <div className="mt-3">
                <input
                  type="date"
                  value={draft.customExpiresAt}
                  onChange={(e) =>
                    onChangeDraft({ ...draft, customExpiresAt: e.target.value })
                  }
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[#6d4aff]"
                />
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-neutral-700 mb-2">Passcode</div>
            <div className="space-y-2">
              {(
                [
                  ["none", "No passcode"],
                  ["email_otp", "Email OTP"],
                  ["sms_otp", "SMS OTP (later)"],
                ] as const
              ).map(([mode, label]) => (
                <label
                  key={mode}
                  className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2.5 cursor-pointer hover:border-[#6d4aff]"
                >
                  <input
                    type="radio"
                    name="conf-passcode"
                    checked={draft.passcodeMode === mode}
                    onChange={() =>
                      onChangeDraft({
                        ...draft,
                        passcodeMode: mode as ConfidentialPasscodeMode,
                      })
                    }
                    className="accent-[#6d4aff]"
                  />
                  <span className="text-sm text-neutral-800">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-[#6d4aff]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSaveFinal}
            className="rounded-xl bg-[#6d4aff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5b3dff]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

