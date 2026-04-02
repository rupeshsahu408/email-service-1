"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComposeClient, type ComposeReplySeed } from "@/components/compose/compose-client";

type Folder = "inbox" | "sent" | "spam" | "trash" | "archive";

type Nav =
  | { kind: "folder"; folder: Folder | "starred" | "scheduled" }
  | { kind: "label"; labelId: string };

type ScheduledJobRow = {
  id: string;
  toAddr: string;
  ccAddr: string;
  bccAddr: string;
  subject: string;
  sendAt: string;
  status: string;
  createdAt: string;
};

type SenderIdentity = {
  email: string;
  displayName: string;
  goldenTick: boolean;
  businessName: string | null;
  logoUrl: string | null;
  brandColor: string | null;
};

type Row = {
  id: string;
  subject: string;
  snippet: string;
  fromAddr: string;
  toAddr: string;
  ccAddr: string;
  readAt: string | null;
  createdAt: string;
  starred: boolean;
  pinned: boolean;
  threadId: string;
  hasAttachment: boolean;
  labelIds: string[];
  senderIdentity?: SenderIdentity | null;
  sentAnonymously?: boolean;
  spamScore?: number;
};

type AttachmentMeta = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  messageId?: string;
};

type DetailMessage = {
  id: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  fromAddr: string;
  toAddr: string;
  ccAddr: string;
  bccAddr: string;
  folder: Folder;
  readAt: string | null;
  createdAt: string;
  starred: boolean;
  pinned: boolean;
  threadId: string;
  mailedBy: string | null;
  signedBy: string | null;
  senderIdentity?: SenderIdentity | null;
  sentAnonymously?: boolean;
};

type DetailState = {
  messages: DetailMessage[];
  attachments: AttachmentMeta[];
  labelIds: string[];
};

type SmartReplyState = {
  loading: boolean;
  error: string;
  suggestions: string[];
};

type SummaryState = {
  loading: boolean;
  error: string;
  bullets: string[];
  generatedAt: number | null;
};

type LabelRow = { id: string; name: string; color?: string | null };

type MailPrefs = {
  conversationView: boolean;
  unreadFirst: boolean;
  inboxDensity: "compact" | "comfortable";
  draftAutoSave: boolean;
  composeFont: string;
};

function formatDate(dateStr: string): string {
  // Deterministic formatting to avoid SSR/client locale/timezone drift.
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function senderInitial(addr: string): string {
  const name = addr.split("<")[0].trim() || addr;
  return (name.charAt(0) || "?").toUpperCase();
}

function senderName(addr: string): string {
  const m = addr.match(/^([^<]+)</);
  if (m) return m[1].trim();
  return addr.replace(/@.*/, "");
}

function parseEmailFromAddr(addr: string): string {
  const m = addr.match(/<([^>]+)>/);
  return (m ? m[1] : addr).trim();
}

function GoldenTickIcon({
  className = "w-3.5 h-3.5",
  title = "Verified Business",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <img
      src="/golden-tick.jpg"
      alt=""
      title={title}
      className={`shrink-0 object-contain inline-block align-middle ${className}`}
    />
  );
}

function flatThreadMap(rows: Row[]): Map<string, Row[]> {
  const m = new Map<string, Row[]>();
  for (const row of rows) { m.set(row.id, [row]); }
  return m;
}

function buildListQuery(nav: Nav, q: string): string {
  const params = new URLSearchParams();
  if (nav.kind === "label") {
    params.set("folder", "inbox");
    params.set("labelId", nav.labelId);
  } else if (nav.folder === "starred") {
    params.set("folder", "starred");
  } else {
    params.set("folder", nav.folder);
  }
  const term = q.trim();
  if (term) params.set("q", term);
  return params.toString();
}

function groupThreads(rows: Row[]): Map<string, Row[]> {
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = map.get(r.threadId) ?? [];
    arr.push(r);
    map.set(r.threadId, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }
  return map;
}

function sortThreadIds(map: Map<string, Row[]>): string[] {
  const ids = [...map.keys()];
  ids.sort((ta, tb) => {
    const a = map.get(ta)!;
    const b = map.get(tb)!;
    const pinA = a.some((m) => m.pinned) ? 1 : 0;
    const pinB = b.some((m) => m.pinned) ? 1 : 0;
    if (pinB !== pinA) return pinB - pinA;
    const tAm = Math.max(...a.map((m) => +new Date(m.createdAt)));
    const tBm = Math.max(...b.map((m) => +new Date(m.createdAt)));
    return tBm - tAm;
  });
  return ids;
}

function navKey(n: Nav): string {
  if (n.kind === "folder") return `f:${n.folder}`;
  return `l:${n.labelId}`;
}

function folderDisplayName(nav: Nav, labels: LabelRow[]): string {
  if (nav.kind === "label") {
    return labels.find((l) => l.id === nav.labelId)?.name ?? "Label";
  }
  if (nav.folder === "starred") return "Starred";
  if (nav.folder === "scheduled") return "Scheduled";
  if (nav.folder === "spam") return "Spam";
  return nav.folder.charAt(0).toUpperCase() + nav.folder.slice(1);
}

function formatScheduledSendAt(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

// ── SVG Icons ─────────────────────────────────────────────────────
function IconInbox() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M2.5 3A1.5 1.5 0 0 0 1 4.5v11A1.5 1.5 0 0 0 2.5 17h15a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 17.5 3h-15Zm14.5 9.5H13a3 3 0 1 1-6 0H3V5h14v7.5Z" clipRule="evenodd" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
      <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
    </svg>
  );
}
function IconSend() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M3.105 2.289a.75.75 0 0 0-.826.95l1.414 4.925A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.896 28.896 0 0 0 15.293-7.154.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.289Z" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .27.144.518.378.652l3 1.8a.75.75 0 1 0 .774-1.29l-2.652-1.59V5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
function IconStar() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clipRule="evenodd" />
    </svg>
  );
}
function IconAnalytics() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M3 14.5v2A1.5 1.5 0 0 0 4.5 18h2a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 6.5 8h-2A1.5 1.5 0 0 0 3 9.5v5Z" />
      <path d="M12.5 4h-2A1.5 1.5 0 0 0 9 5.5v11A1.5 1.5 0 0 0 10.5 18h2a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 12.5 4Z" />
      <path d="M16.5 11h-2a1.5 1.5 0 0 0-1.5 1.5v4A1.5 1.5 0 0 0 14.5 18h2a1.5 1.5 0 0 0 1.5-1.5v-4A1.5 1.5 0 0 0 16.5 11Z" />
    </svg>
  );
}
function IconSpam() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.24-12.53a.75.75 0 0 1 0 1.06L11.06 10l2.18 2.18a.75.75 0 1 1-1.06 1.06L10 11.06 7.82 13.24a.75.75 0 0 1-1.06-1.06L8.94 10 6.76 7.82a.75.75 0 0 1 1.06-1.06L10 8.94l2.18-2.18a.75.75 0 0 1 1.06 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
function IconArchive() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M2 3a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2Z" />
      <path fillRule="evenodd" d="M2 7.5h16l-.811 7.71a2 2 0 0 1-1.99 1.79H4.802a2 2 0 0 1-1.99-1.79L2 7.5ZM7 11a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z" clipRule="evenodd" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 3.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#9896b4]">
      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
    </svg>
  );
}
function IconTag({ color }: { color?: string | null }) {
  return (
    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color ?? "#6d4aff" }} />
  );
}
function IconPaperclip() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
      <path fillRule="evenodd" d="M14.78 4.47a.75.75 0 0 1 0 1.06l-7 7a5.75 5.75 0 0 1-8.13-8.13l7-7a4.25 4.25 0 0 1 6.01 6.01L5.5 10.57a2.75 2.75 0 0 1-3.89-3.89L8.22 0l1.06 1.06-6.6 6.68a1.25 1.25 0 0 0 1.77 1.77l7.16-7.19a2.75 2.75 0 0 0-3.89-3.89l-7 7a4.25 4.25 0 0 0 6.01 6.01l7-7a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}
function IconReply() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M7.793 2.232a.75.75 0 0 1-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 0 1 0 10.75H10.75a.75.75 0 0 1 0-1.5h2.875a3.875 3.875 0 0 0 0-7.75H3.622l4.146 3.957a.75.75 0 0 1-1.036 1.085l-5.5-5.25a.75.75 0 0 1 0-1.085l5.5-5.25a.75.75 0 0 1 1.061.025Z" clipRule="evenodd" />
    </svg>
  );
}
function IconMenu() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path
        fillRule="evenodd"
        d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
function IconArrowLeft() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
    </svg>
  );
}
function IconChevron({ open = false }: { open?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.12l3.71-3.89a.75.75 0 1 1 1.08 1.04l-4.25 4.46a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
function IconLock() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path
        fillRule="evenodd"
        d="M10 1.5A4.25 4.25 0 0 0 5.75 5.75V7H5a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-.75V5.75A4.25 4.25 0 0 0 10 1.5Zm2.75 5.5V5.75a2.75 2.75 0 1 0-5.5 0V7h5.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path
        fillRule="evenodd"
        d="M15.31 2.86a.75.75 0 0 1 1.06 0A8.25 8.25 0 1 1 2.6 11.8a.75.75 0 1 1 1.46-.33 6.75 6.75 0 1 0 11.25-6.9L13.53 6.3a.75.75 0 0 1-1.28-.53V2.75a.75.75 0 0 1 1.5 0v1.2l1.56-1.09Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ── Sidebar nav item ───────────────────────────────────────────────
function SidebarItem({
  icon, label, active, onClick, badge, collapsed = false,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  collapsed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
        active
          ? "bg-[#6d4aff]/25 text-white"
          : "text-[#c5c3d8] hover:bg-white/[0.06] hover:text-white"
      } ${collapsed ? "justify-center" : ""}`}
      title={collapsed ? label : undefined}
    >
      <span className={active ? "text-[#a78bfa]" : "text-[#8b87a8]"}>{icon}</span>
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge != null && badge > 0 && (
        <span className="text-[10px] font-bold bg-[#6d4aff] text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────
export function InboxClient({
  email,
  avatarUrl = null,
  plan = "free",
  planExpiresAt = null,
  professionalActive = false,
  professionalExpiresAt = null,
  tempInboxActive = false,
}: {
  email: string;
  avatarUrl?: string | null;
  plan?: string;
  planExpiresAt?: string | null;
  professionalActive?: boolean;
  professionalExpiresAt?: string | null;
  tempInboxActive?: boolean;
}) {
  const isBusiness = plan === "business";
  // Professional is intentionally disabled; keep existing props for compatibility.
  const showProfessional = false;
  const router = useRouter();
  const [nav, setNav] = useState<Nav>({ kind: "folder", folder: "inbox" });
  const [rows, setRows] = useState<Row[]>([]);
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJobRow[]>([]);
  const [selectedScheduledId, setSelectedScheduledId] = useState<string | null>(null);
  const [scheduledCancelConfirmId, setScheduledCancelConfirmId] = useState<string | null>(null);
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeReplySeed, setComposeReplySeed] = useState<ComposeReplySeed | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  type ListFilter = "all" | "read" | "unread" | "starred" | "unstarred";
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [listRefreshing, setListRefreshing] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(() => new Set());
  const [prefs, setPrefs] = useState<MailPrefs | null>(null);
  const [persistedInboxCount, setPersistedInboxCount] = useState(0);
  const [spamFolderCount, setSpamFolderCount] = useState(0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [goldenTickEligible, setGoldenTickEligible] = useState(false);
  const [storageNotice, setStorageNotice] = useState<{
    usageLevel: "ok" | "warning80" | "warning95" | "full";
    message: string | null;
  }>({ usageLevel: "ok", message: null });
  const [outboundMailboxes, setOutboundMailboxes] = useState<
    { id: string; emailAddress: string; isDefaultSender: boolean }[]
  >([]);
  const [composePreviewFrom, setComposePreviewFrom] = useState("");
  const [smartReplyByMessageId, setSmartReplyByMessageId] = useState<Record<string, SmartReplyState>>({});
  const masterCheckboxRef = useRef<HTMLInputElement>(null);
  const smartReplyAbortRef = useRef<AbortController | null>(null);
  const smartReplyRequestIdRef = useRef<string | null>(null);
  const [summaryByMessageId, setSummaryByMessageId] = useState<Record<string, SummaryState>>({});
  const [overflowMenuMessageId, setOverflowMenuMessageId] = useState<string | null>(null);
  const [detailsExpandedMessageId, setDetailsExpandedMessageId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState("");
  const [spamBlockPrompt, setSpamBlockPrompt] = useState<{
    open: boolean;
    senderEmail: string;
    messageId: string;
  }>({ open: false, senderEmail: "", messageId: "" });

  const conversationOn = prefs?.conversationView !== false;
  const isScheduledNav = nav.kind === "folder" && nav.folder === "scheduled";
  const selectionEnabled =
    nav.kind === "folder" &&
    ["inbox", "sent", "spam", "trash", "archive"].includes(nav.folder);
  const selectedCount = selectedIds.size;

  const unreadFirst = prefs?.unreadFirst === true;
  const densityComfortable = prefs?.inboxDensity !== "compact";
  const draftAutoSaveOn = prefs?.draftAutoSave !== false;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("sendora.sidebar.collapsed");
      if (raw === "1") setSidebarCollapsed(true);
    } catch {
      // ignore localStorage failures
    }
  }, []);

  // Allow deep-linking into inbox folders (used by Settings → Storage actions).
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const folder = sp.get("folder");
      if (
        folder === "trash" ||
        folder === "inbox" ||
        folder === "sent" ||
        folder === "spam" ||
        folder === "archive"
      ) {
        setNav({ kind: "folder", folder });
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "sendora.sidebar.collapsed",
        sidebarCollapsed ? "1" : "0"
      );
    } catch {
      // ignore localStorage failures
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/settings", { credentials: "include" });
      if (!res.ok || cancelled) return;
      const pack = (await res.json()) as { settings: MailPrefs };
      if (!cancelled && pack.settings) setPrefs(pack.settings);
    })();
    return () => { cancelled = true; };
  }, []);

  const refetchIdentity = useCallback(async () => {
    const res = await fetch("/api/identity", { credentials: "include" });
    if (!res.ok) return;
    const j = (await res.json()) as {
      goldenTickEligible?: boolean;
      storage?: {
        usageLevel: string;
        usageRatio: number;
        message: string | null;
      };
    };
    setGoldenTickEligible(Boolean(j.goldenTickEligible));
    const lvl = j.storage?.usageLevel;
    const msg = j.storage?.message ?? null;
    if (
      lvl === "warning80" ||
      lvl === "warning95" ||
      lvl === "full" ||
      lvl === "ok"
    ) {
      setStorageNotice({
        usageLevel: lvl,
        message: msg,
      });
    }
  }, []);

  useEffect(() => {
    void refetchIdentity();
  }, [refetchIdentity]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refetchIdentity();
    };
    window.addEventListener("focus", refetchIdentity);
    document.addEventListener("visibilitychange", onVis);
    const interval = setInterval(refetchIdentity, 120_000);
    return () => {
      window.removeEventListener("focus", refetchIdentity);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(interval);
    };
  }, [refetchIdentity]);

  useEffect(() => {
    if (!composeOpen) return;
    if (!isBusiness) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/mail/outbound-from`, {
        credentials: "include",
      });
      if (!res.ok || cancelled) return;
      const j = (await res.json()) as {
        mailboxes: { id: string; emailAddress: string; isDefaultSender: boolean }[];
        previewFrom?: string;
        defaultFrom?: string;
      };
      if (cancelled) return;
      setOutboundMailboxes(j.mailboxes ?? []);
      setComposePreviewFrom(
        (j.previewFrom ?? j.defaultFrom ?? "").trim()
      );
    })();
    return () => { cancelled = true; };
  }, [composeOpen, isBusiness]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchQ), 320);
    return () => clearTimeout(t);
  }, [searchQ]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/mail/labels", { credentials: "include" });
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { labels: LabelRow[] };
      if (!cancelled) setLabels(data.labels);
    })();
    return () => { cancelled = true; };
  }, []);

  const refreshFolderCounts = useCallback(async () => {
    const res = await fetch("/api/mail/folder-counts", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return;
    const d = (await res.json()) as {
      inboxUnread?: number;
      spam?: number;
    };
    setPersistedInboxCount(Number(d.inboxUnread ?? 0));
    setSpamFolderCount(Number(d.spam ?? 0));
  }, []);

  useEffect(() => {
    void refreshFolderCounts();
  }, [nav, refreshFolderCounts]);

  useEffect(() => {
    setListFilter("all");
  }, [nav]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setSelectedId(null);
      setSelectedIds(new Set());
      setDetail(null);
      setSelectedScheduledId(null);

      if (nav.kind === "folder" && nav.folder === "scheduled") {
        const res = await fetch("/api/mail/scheduled", {
          credentials: "include",
          cache: "no-store",
        });
        if (!cancelled) {
          if (res.ok) {
            const data = (await res.json()) as { jobs: ScheduledJobRow[] };
            setScheduledJobs(data.jobs ?? []);
          } else {
            setScheduledJobs([]);
          }
          setRows([]);
          setLoading(false);
        }
        return;
      }

      setScheduledJobs([]);
      const qs = buildListQuery(nav, searchDebounced);
      const res = await fetch(`/api/mail/messages?${qs}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        if (!cancelled) setLoading(false);
        return;
      }
      const data = (await res.json()) as { messages: Row[] };
      if (!cancelled) {
        setRows(data.messages);
        setSelectedIds((prev) => {
          const valid = new Set(data.messages.map((m) => m.id));
          return new Set([...prev].filter((id) => valid.has(id)));
        });
        void refreshFolderCounts();
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nav, searchDebounced, refreshFolderCounts]);

  // Draft load/save and editor state are handled inside `ComposeClient`.

  const filteredScheduledJobs = useMemo(() => {
    const q = searchDebounced.trim().toLowerCase();
    if (!q) return scheduledJobs;
    return scheduledJobs.filter(
      (j) =>
        j.subject.toLowerCase().includes(q) ||
        j.toAddr.toLowerCase().includes(q) ||
        j.ccAddr.toLowerCase().includes(q) ||
        j.bccAddr.toLowerCase().includes(q)
    );
  }, [scheduledJobs, searchDebounced]);

  const selectedScheduledJob = useMemo(
    () => scheduledJobs.find((j) => j.id === selectedScheduledId) ?? null,
    [scheduledJobs, selectedScheduledId]
  );

  const displayRows = useMemo(() => {
    const r = [...rows];
    if (unreadFirst && nav.kind === "folder" && nav.folder === "inbox" && !searchDebounced.trim()) {
      r.sort((a, b) => {
        const ua = a.readAt ? 1 : 0;
        const ub = b.readAt ? 1 : 0;
        if (ua !== ub) return ua - ub;
        return +new Date(b.createdAt) - +new Date(a.createdAt);
      });
    }
    return r;
  }, [rows, unreadFirst, nav, searchDebounced]);

  const filteredRows = useMemo(() => {
    if (listFilter === "all") return displayRows;
    return displayRows.filter((m) => {
      if (listFilter === "read") return m.readAt !== null;
      if (listFilter === "unread") return m.readAt === null;
      if (listFilter === "starred") return m.starred;
      return !m.starred;
    });
  }, [displayRows, listFilter]);

  const threadMap = useMemo(() => {
    if (!conversationOn) return flatThreadMap(filteredRows);
    return groupThreads(filteredRows);
  }, [filteredRows, conversationOn]);

  const threadIdsSorted = useMemo(() => sortThreadIds(threadMap), [threadMap]);

  const visibleSelectableIds = useMemo(() => {
    if (!selectionEnabled) return [];
    const ids: string[] = [];
    for (const tid of threadIdsSorted) {
      const rep = threadMap.get(tid)?.[0];
      if (rep) ids.push(rep.id);
    }
    return ids;
  }, [selectionEnabled, threadIdsSorted, threadMap]);

  const allVisibleSelected = useMemo(
    () =>
      visibleSelectableIds.length > 0 &&
      visibleSelectableIds.every((id) => selectedIds.has(id)),
    [visibleSelectableIds, selectedIds]
  );

  const someVisibleSelected = useMemo(
    () =>
      visibleSelectableIds.some((id) => selectedIds.has(id)) && !allVisibleSelected,
    [visibleSelectableIds, selectedIds, allVisibleSelected]
  );

  useEffect(() => {
    const el = masterCheckboxRef.current;
    if (!el) return;
    el.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const toggleMasterSelection = useCallback(
    (checked: boolean) => {
      if (!selectionEnabled || visibleSelectableIds.length === 0) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (checked) {
          for (const id of visibleSelectableIds) next.add(id);
        } else {
          for (const id of visibleSelectableIds) next.delete(id);
        }
        return next;
      });
    },
    [selectionEnabled, visibleSelectableIds]
  );

  async function refreshRowsOnly() {
    if (nav.kind === "folder" && nav.folder === "scheduled") {
      const res = await fetch("/api/mail/scheduled", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { jobs: ScheduledJobRow[] };
      setScheduledJobs(data.jobs ?? []);
      return;
    }
    const qs = buildListQuery(nav, searchDebounced);
    const res = await fetch(`/api/mail/messages?${qs}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { messages: Row[] };
    setRows(data.messages);
    setSelectedIds((prev) => {
      const valid = new Set(data.messages.map((m) => m.id));
      return new Set([...prev].filter((id) => valid.has(id)));
    });
    void refreshFolderCounts();
  }

  async function cancelScheduledJob(id: string) {
    const res = await fetch("/api/mail/scheduled/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      showActionNotice("Could not cancel this scheduled message.");
      return;
    }
    setScheduledCancelConfirmId(null);
    if (selectedScheduledId === id) {
      setSelectedScheduledId(null);
    }
    await refreshRowsOnly();
    showActionNotice("Scheduled send cancelled.");
  }

  async function handleRefreshList() {
    if (listRefreshing) return;
    setListRefreshing(true);
    try {
      await refreshRowsOnly();
    } finally {
      setListRefreshing(false);
    }
  }

  async function openMessage(id: string) {
    setSelectedId(id);
    const row = rows.find((r) => r.id === id);
    const tid = row?.threadId;
    if (!tid) {
      const single = await fetch(`/api/mail/messages/${id}`, { credentials: "include" });
      if (!single.ok) return;
      const pack = (await single.json()) as {
        message: DetailMessage;
        attachments: AttachmentMeta[];
        labelIds: string[];
        senderIdentity?: SenderIdentity | null;
      };
      setDetail({
        messages: [{ ...pack.message, senderIdentity: pack.senderIdentity ?? null }],
        attachments: pack.attachments,
        labelIds: pack.labelIds,
      });
      if (!pack.message.readAt && pack.message.folder === "inbox") {
        await fetch(`/api/mail/messages/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ read: true }) });
        await refreshRowsOnly();
        setDetail((d) => d ? { ...d, messages: d.messages.map((m) => m.id === id ? { ...m, readAt: new Date().toISOString() } : m) } : d);
      }
      return;
    }
    const res = await fetch(`/api/mail/thread/${tid}?focus=${encodeURIComponent(id)}`, { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as {
      messages: DetailMessage[];
      attachments: AttachmentMeta[];
      labelIds: string[];
      focusId: string;
    };
    setDetail({ messages: data.messages, attachments: data.attachments, labelIds: data.labelIds });
    const focus = data.messages.find((m) => m.id === data.focusId);
    if (focus && !focus.readAt && focus.folder === "inbox") {
      await fetch(`/api/mail/messages/${data.focusId}`, { method: "PATCH", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ read: true }) });
      await refreshRowsOnly();
      setDetail((d) => d ? { ...d, messages: d.messages.map((m) => m.id === data.focusId ? { ...m, readAt: new Date().toISOString() } : m) } : d);
    }
  }

  async function removeMessage() {
    if (!selectedId) return;
    await fetch(`/api/mail/messages/${selectedId}`, { method: "DELETE", credentials: "include" });
    setSelectedId(null); setDetail(null);
    await refreshRowsOnly();
  }

  async function deleteSelectedMessages() {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    const res = await fetch("/api/mail/messages", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      showActionNotice("Could not delete selected messages.");
      return;
    }
    setBulkDeleteConfirmOpen(false);
    if (selectedId && ids.includes(selectedId)) {
      setSelectedId(null);
      setDetail(null);
    }
    setSelectedIds(new Set());
    await refreshRowsOnly();
    showActionNotice(ids.length === 1 ? "Message deleted." : "Selected messages deleted.");
  }

  async function archiveMessage() {
    if (!selectedId) return;
    await fetch(`/api/mail/messages/${selectedId}`, { method: "PATCH", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ folder: "archive" }) });
    setSelectedId(null); setDetail(null);
    await refreshRowsOnly();
  }

  async function restoreMessage() {
    if (!selectedId) return;
    await fetch(`/api/mail/messages/${selectedId}`, { method: "PATCH", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ folder: "inbox" }) });
    setSelectedId(null); setDetail(null);
    await refreshRowsOnly();
  }

  async function toggleStar(id: string, next: boolean) {
    await fetch(`/api/mail/messages/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ starred: next }) });
    await refreshRowsOnly();
    setDetail((d) => d ? { ...d, messages: d.messages.map((m) => m.id === id ? { ...m, starred: next } : m) } : d);
  }

  async function togglePin(id: string, next: boolean) {
    await fetch(`/api/mail/messages/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ pinned: next }) });
    await refreshRowsOnly();
    setDetail((d) => d ? { ...d, messages: d.messages.map((m) => m.id === id ? { ...m, pinned: next } : m) } : d);
  }

  async function updateLabels(ids: string[]) {
    if (!selectedId) return;
    await fetch(`/api/mail/messages/${selectedId}`, { method: "PATCH", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ labelIds: ids }) });
    await refreshRowsOnly();
    setDetail((d) => (d ? { ...d, labelIds: ids } : d));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/");
    router.refresh();
  }

  async function addLabel() {
    const name = window.prompt("Label name");
    if (!name?.trim()) return;
    const res = await fetch("/api/mail/labels", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ name: name.trim() }) });
    if (!res.ok) return;
    const data = (await res.json()) as { label: LabelRow };
    setLabels((prev) => [data.label, ...prev]);
  }

  function toggleThread(tid: string) {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(tid)) next.delete(tid); else next.add(tid);
      return next;
    });
  }

  const focusMsg = useMemo(() => {
    if (!detail?.messages.length) return null;
    return detail.messages.find((m) => m.id === selectedId) ?? detail.messages[detail.messages.length - 1] ?? null;
  }, [detail, selectedId]);

  /** Latest *incoming* message in the thread — used for smart reply even when focus is on a sent message. */
  const smartReplyAnchorMessage = useMemo(() => {
    if (!detail?.messages.length) return null;
    const incoming = detail.messages.filter(
      (m) =>
        m.folder === "inbox" || m.folder === "archive" || m.folder === "spam"
    );
    return incoming.length ? incoming[incoming.length - 1]! : null;
  }, [detail]);
  const inTrash = focusMsg?.folder === "trash" || (nav.kind === "folder" && nav.folder === "trash");

  const composeFontClass = useMemo(() => {
    switch (prefs?.composeFont) {
      case "serif": return "font-serif";
      case "mono": return "font-mono";
      case "sans": return "font-sans";
      default: return "";
    }
  }, [prefs?.composeFont]);

  const rowPad = densityComfortable ? "py-3" : "py-2";
  const isSentNav = nav.kind === "folder" && nav.folder === "sent";
  const sidebarWidth = sidebarCollapsed ? 72 : 220;

  const currentNavKey = navKey(nav);

  function toggleSidebar() {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setMobileSidebarOpen((v) => !v);
      return;
    }
    setSidebarCollapsed((v) => !v);
  }

  function showActionNotice(message: string) {
    setActionNotice(message);
    window.setTimeout(() => setActionNotice(""), 2600);
  }

  function toggleMessageSelection(messageId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(messageId);
      else next.delete(messageId);
      return next;
    });
  }

  async function markMessageUnread(id: string) {
    await fetch(`/api/mail/messages/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ read: false }),
    });
    await refreshRowsOnly();
    setDetail((d) =>
      d
        ? {
            ...d,
            messages: d.messages.map((m) =>
              m.id === id ? { ...m, readAt: null } : m
            ),
          }
        : d
    );
    showActionNotice("Marked as unread.");
  }

  async function blockSenderFromMessage(dm: DetailMessage) {
    const senderEmail = dm.senderIdentity?.email ?? parseEmailFromAddr(dm.fromAddr);
    const res = await fetch("/api/settings/blocked", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: senderEmail }),
    });
    if (res.ok || res.status === 409) {
      showActionNotice("Sender blocked. You can manage blocked senders in Settings.");
      return;
    }
    showActionNotice("Could not block sender.");
  }

  async function reportSpamFromMessage(dm: DetailMessage) {
    const senderEmail = dm.senderIdentity?.email ?? parseEmailFromAddr(dm.fromAddr);
    const res = await fetch("/api/mail/report-spam", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        messageId: dm.id,
        from: senderEmail,
        subject: dm.subject ?? "",
        snippet: dm.bodyText?.slice(0, 500) ?? "",
      }),
    });
    if (!res.ok) {
      showActionNotice("Could not report spam right now.");
      return;
    }
    setSpamBlockPrompt({ open: true, senderEmail, messageId: dm.id });
  }

  async function markMessageAsSpam(dm: DetailMessage) {
    const res = await fetch(`/api/mail/messages/${dm.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ folder: "spam" }),
    });
    if (!res.ok) {
      showActionNotice("Could not move to Spam.");
      return;
    }
    await refreshRowsOnly();
    await refreshFolderCounts();
    setDetail((d) =>
      d
        ? {
            ...d,
            messages: d.messages.map((m) =>
              m.id === dm.id ? { ...m, folder: "spam" as Folder } : m
            ),
          }
        : d
    );
    showActionNotice("Moved to Spam. Future mail from this sender will go to Spam.");
  }

  async function markMessageNotSpam(dm: DetailMessage) {
    const res = await fetch(`/api/mail/messages/${dm.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ folder: "inbox" }),
    });
    if (!res.ok) {
      showActionNotice("Could not move to Inbox.");
      return;
    }
    await refreshRowsOnly();
    await refreshFolderCounts();
    setDetail((d) =>
      d
        ? {
            ...d,
            messages: d.messages.map((m) =>
              m.id === dm.id ? { ...m, folder: "inbox" as Folder } : m
            ),
          }
        : d
    );
    showActionNotice("Moved to Inbox. This sender is marked as trusted.");
  }

  function forwardMessage(dm: DetailMessage) {
    const summary = (dm.bodyText ?? "").trim();
    const forwardedBody = [
      "",
      "---------- Forwarded message ---------",
      `From: ${dm.fromAddr}`,
      `Date: ${new Date(dm.createdAt).toUTCString()}`,
      `Subject: ${dm.subject || "(no subject)"}`,
      `To: ${dm.toAddr}`,
      dm.ccAddr ? `Cc: ${dm.ccAddr}` : "",
      "",
      summary,
    ]
      .filter(Boolean)
      .join("\n");
    setComposeReplySeed({
      to: "",
      subject: `Fwd: ${dm.subject || "(no subject)"}`,
      initialBodyText: forwardedBody,
    });
    setComposeOpen(true);
  }

  function downloadMessage(dm: DetailMessage) {
    const eml = [
      `From: ${dm.fromAddr}`,
      `To: ${dm.toAddr}`,
      dm.ccAddr ? `Cc: ${dm.ccAddr}` : "",
      `Date: ${new Date(dm.createdAt).toUTCString()}`,
      `Subject: ${dm.subject || "(no subject)"}`,
      "",
      dm.bodyText || "",
    ]
      .filter(Boolean)
      .join("\r\n");
    const blob = new Blob([eml], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(dm.subject || "message").replace(/[^\w.-]+/g, "_")}.eml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function startReply(dm: DetailMessage, initialBodyText?: string) {
    setComposeReplySeed({
      to: dm.fromAddr,
      subject: `Re: ${dm.subject}`,
      initialBodyText: initialBodyText?.trim() || undefined,
    });
    setComposeOpen(true);
  }

  async function summarizeMessage(dm: DetailMessage) {
    setSummaryByMessageId((prev) => ({
      ...prev,
      [dm.id]: {
        loading: true,
        error: "",
        bullets: prev[dm.id]?.bullets ?? [],
        generatedAt: prev[dm.id]?.generatedAt ?? null,
      },
    }));

    try {
      const res = await fetch("/api/ai/email-summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subject: dm.subject ?? "",
          bodyText: dm.bodyText ?? "",
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        bullets?: string[];
      };

      if (!res.ok) {
        setSummaryByMessageId((prev) => ({
          ...prev,
          [dm.id]: {
            loading: false,
            error: data.error ?? "Could not generate summary.",
            bullets: prev[dm.id]?.bullets ?? [],
            generatedAt: prev[dm.id]?.generatedAt ?? null,
          },
        }));
        return;
      }

      const bullets = Array.isArray(data.bullets)
        ? data.bullets.filter((b): b is string => typeof b === "string" && b.trim().length > 0)
        : [];

      setSummaryByMessageId((prev) => ({
        ...prev,
        [dm.id]: {
          loading: false,
          error: "",
          bullets: bullets.slice(0, 4),
          generatedAt: Date.now(),
        },
      }));
    } catch {
      setSummaryByMessageId((prev) => ({
        ...prev,
        [dm.id]: {
          loading: false,
          error: "Could not generate summary.",
          bullets: prev[dm.id]?.bullets ?? [],
          generatedAt: prev[dm.id]?.generatedAt ?? null,
        },
      }));
    }
  }

  useEffect(() => {
    if (!smartReplyAnchorMessage) return;
    if (inTrash) return;

    const dm = smartReplyAnchorMessage;
    const existing = summaryByMessageId[dm.id];
    if (existing?.bullets?.length) return;
    if (existing?.loading) return;

    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      // Avoid React Compiler warning about setState inside effects.
      await Promise.resolve();
      if (cancelled) return;

      setSummaryByMessageId((prev) => ({
        ...prev,
        [dm.id]: {
          loading: true,
          error: "",
          bullets: prev[dm.id]?.bullets ?? [],
          generatedAt: prev[dm.id]?.generatedAt ?? null,
        },
      }));

      try {
        const res = await fetch("/api/ai/email-summary", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            subject: dm.subject ?? "",
            bodyText: dm.bodyText ?? "",
          }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          bullets?: string[];
        };

        if (cancelled) return;

        if (!res.ok) {
          setSummaryByMessageId((prev) => ({
            ...prev,
            [dm.id]: {
              loading: false,
              error: data.error ?? "Could not generate summary.",
              bullets: prev[dm.id]?.bullets ?? [],
              generatedAt: prev[dm.id]?.generatedAt ?? null,
            },
          }));
          return;
        }

        const bullets = Array.isArray(data.bullets)
          ? data.bullets.filter(
              (b): b is string => typeof b === "string" && b.trim().length > 0
            )
          : [];

        setSummaryByMessageId((prev) => ({
          ...prev,
          [dm.id]: {
            loading: false,
            error: "",
            bullets: bullets.slice(0, 4),
            generatedAt: Date.now(),
          },
        }));
      } catch {
        if (cancelled) return;
        setSummaryByMessageId((prev) => ({
          ...prev,
          [dm.id]: {
            loading: false,
            error: controller.signal.aborted ? "" : "Could not generate summary.",
            bullets: prev[dm.id]?.bullets ?? [],
            generatedAt: prev[dm.id]?.generatedAt ?? null,
          },
        }));
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- anchor id only
  }, [smartReplyAnchorMessage?.id, inTrash]);

  useEffect(() => {
    const dm =
      smartReplyAnchorMessage ??
      (focusMsg && focusMsg.folder === "inbox" ? focusMsg : null);
    if (!dm) return;
    if (inTrash) return;
    const existing = smartReplyByMessageId[dm.id];
    if (existing?.suggestions?.length) return;
    if (existing?.loading) return;

    smartReplyAbortRef.current?.abort();
    const controller = new AbortController();
    smartReplyAbortRef.current = controller;

    const requestId = crypto.randomUUID();
    smartReplyRequestIdRef.current = requestId;

    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setSmartReplyByMessageId((prev) => ({
        ...prev,
        [dm.id]: { loading: true, error: "", suggestions: [] },
      }));

      try {
        const res = await fetch("/api/ai/smart-reply", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            subject: dm.subject ?? "",
            bodyText: dm.bodyText ?? "",
            fromAddr: dm.fromAddr ?? "",
          }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          suggestions?: string[];
        };

        if (smartReplyRequestIdRef.current !== requestId) return;

        if (!res.ok) {
          setSmartReplyByMessageId((prev) => ({
            ...prev,
            [dm.id]: {
              loading: false,
              error: data.error ?? "Could not generate reply suggestions.",
              suggestions: [],
            },
          }));
          return;
        }

        const next = Array.isArray(data.suggestions)
          ? data.suggestions.filter(
              (s): s is string => typeof s === "string" && s.trim().length > 0
            )
          : [];

        setSmartReplyByMessageId((prev) => ({
          ...prev,
          [dm.id]: {
            loading: false,
            error: "",
            suggestions: next.slice(0, 3),
          },
        }));
      } catch {
        // If we were aborted because the user switched messages, clear loading.
        if (smartReplyRequestIdRef.current !== requestId) return;
        setSmartReplyByMessageId((prev) => ({
          ...prev,
          [dm.id]: {
            loading: false,
            error: controller.signal.aborted ? "" : "Could not generate reply suggestions.",
            suggestions: [],
          },
        }));
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- anchor id only; including smartReplyByMessageId would refetch in a loop
  }, [smartReplyAnchorMessage?.id, focusMsg?.id, focusMsg?.folder, inTrash]);

  useEffect(() => {
    if (!overflowMenuMessageId) return;
    const close = () => setOverflowMenuMessageId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [overflowMenuMessageId]);

  // ── RENDER ──────────────────────────────────────────────────────
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#f3f0fd]">

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        className={`fixed md:relative z-50 md:z-auto h-full flex flex-col shrink-0 transition-[width,transform] duration-200 ease-out md:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ width: sidebarWidth, background: "#1c1b33" }}
      >
        <a
          href="https://sendora.me/inbox"
          className={`flex items-center gap-2.5 pt-5 pb-4 ${sidebarCollapsed ? "px-5 justify-center" : "px-5"}`}
        >
          <img src="/sendora-logo.png" alt="Sendora" className="w-7 h-7 object-contain shrink-0" />
          {!sidebarCollapsed && (
            <span className="text-white font-bold text-[14px] tracking-tight">Sendora</span>
          )}
        </a>

        <div className="px-3 pb-4">
          <button
            onClick={() => { setComposeReplySeed(null); setComposeOpen(true); setMobileSidebarOpen(false); }}
            className={`w-full rounded-full py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 ${sidebarCollapsed ? "px-0" : ""}`}
            style={{ background: "linear-gradient(135deg, #7d5fff 0%, #5b3dff 100%)" }}
            title={sidebarCollapsed ? "New message" : undefined}
          >
            {sidebarCollapsed ? "+" : "+ New message"}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-4">
          {[
            { icon: <IconInbox />, label: "Inbox", n: { kind: "folder", folder: "inbox" } as Nav, badge: persistedInboxCount },
            { icon: <IconSpam />, label: "Spam", n: { kind: "folder", folder: "spam" } as Nav, badge: spamFolderCount },
            { icon: <IconEdit />, label: "Drafts", n: null as Nav | null },
            { icon: <IconSend />, label: "Sent", n: { kind: "folder", folder: "sent" } as Nav },
            { icon: <IconClock />, label: "Scheduled", n: { kind: "folder", folder: "scheduled" } as Nav },
            { icon: <IconStar />, label: "Starred", n: { kind: "folder", folder: "starred" } as Nav },
            { icon: <IconTrash />, label: "Trash", n: { kind: "folder", folder: "trash" } as Nav },
          ].map(({ icon, label, n, badge }) => (
            <SidebarItem
              key={label}
              icon={icon}
              label={label}
              active={n ? navKey(n) === currentNavKey : false}
              onClick={() => {
                if (n) { setNav(n); } else { setComposeReplySeed(null); setComposeOpen(true); }
                setMobileSidebarOpen(false);
              }}
              badge={badge}
              collapsed={sidebarCollapsed}
            />
          ))}

          <div className="my-2 mx-2" style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

          <div className="mt-2 px-1">
            {sidebarCollapsed ? (
              <SidebarItem
                icon={<IconTag color="#6d4aff" />}
                label="Labels"
                active={nav.kind === "label"}
                onClick={() => setSidebarCollapsed(false)}
                collapsed
              />
            ) : (
              <>
                <div className="flex items-center justify-between px-2 mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Labels
                  </span>
                  <button
                    onClick={addLabel}
                    className="text-sm leading-none transition-colors hover:text-white"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                    title="Add label"
                  >
                    +
                  </button>
                </div>
                {labels.map((l) => (
                  <SidebarItem
                    key={l.id}
                    icon={<IconTag color={l.color} />}
                    label={l.name}
                    active={nav.kind === "label" && nav.labelId === l.id}
                    onClick={() => { setNav({ kind: "label", labelId: l.id }); setMobileSidebarOpen(false); }}
                  />
                ))}
                {labels.length === 0 && (
                  <p className="px-3 text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>No labels yet</p>
                )}
              </>
            )}
          </div>

          <div className="my-2 mx-2" style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

          {[
            { icon: <IconStar />, label: "Plans", href: "/upgrade" },
            { icon: <IconAnalytics />, label: "Analytics", href: "/analytics" },
            { icon: <IconInbox />, label: "Temporary Inbox", href: "/temp-inbox" },
            { icon: <IconEdit />, label: "Settings", href: "/settings" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              className={`relative overflow-hidden w-full flex items-center rounded-lg text-sm font-medium transition-all ${
                item.label === "Plans"
                  ? "text-[#3b2a05] shadow-[0_0_0_1px_rgba(255,214,102,0.55)] hover:brightness-105"
                  : "text-[#c5c3d8] hover:bg-white/[0.06] hover:text-white"
              } ${sidebarCollapsed ? "justify-center px-3 py-2" : "gap-3 px-3 py-2"}`}
              style={
                item.label === "Plans"
                  ? {
                      background:
                        "linear-gradient(135deg, rgba(255,230,150,0.98) 0%, rgba(255,205,96,0.98) 48%, rgba(244,176,54,0.98) 100%)",
                      animation: "sendora-plans-pulse 2.8s ease-in-out infinite",
                    }
                  : undefined
              }
              onClick={() => setMobileSidebarOpen(false)}
            >
              {item.label === "Plans" && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3"
                  style={{
                    background:
                      "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.42) 50%, transparent 100%)",
                    animation: "sendora-plans-shimmer 3.6s ease-in-out infinite",
                  }}
                />
              )}
              <span className={item.label === "Plans" ? "text-[#5c3d00]" : "text-[#8b87a8]"}>{item.icon}</span>
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          ))}
          {!sidebarCollapsed && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 overflow-hidden rounded-full bg-[#6d4aff]/40 text-xs font-semibold text-white">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      {(email[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                </div>
                <p className="min-w-0 truncate text-xs text-[#c5c3d8]">{email}</p>
              </div>
            </div>
          )}
        </nav>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex flex-1 min-w-0">

        {/* ── MESSAGE LIST ── */}
        <div
          className="w-full md:w-[320px] lg:w-[360px] shrink-0 flex flex-col bg-white border-r border-[#e8e4f8]"
          style={{
            display:
              (detail || (isScheduledNav && selectedScheduledJob)) &&
              typeof window !== "undefined" &&
              window.innerWidth < 768
                ? "none"
                : undefined,
          }}
        >
          {/* Top bar */}
          <div className="flex items-center gap-2 px-3 py-3 border-b border-[#f0edfb]">
            <button
              className="p-1.5 rounded-lg hover:bg-[#f3f0fd] text-[#65637e]"
              onClick={toggleSidebar}
            >
              <IconMenu />
            </button>
            <div className="flex flex-1 items-center gap-2 bg-[#f3f0fd] rounded-xl px-3 py-2">
              <IconSearch />
              <input
                className="flex-1 min-w-0 bg-transparent text-sm outline-none text-[#1c1b33] placeholder:text-[#9896b4]"
                placeholder={isScheduledNav ? "Search scheduled" : "Search messages"}
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />
              {searchQ && (
                <button onClick={() => setSearchQ("")} className="text-[#9896b4] hover:text-[#6d4aff] transition-colors">
                  <IconClose />
                </button>
              )}
            </div>
          </div>

          {storageNotice.message && (
            <div
              className={`px-3 py-2 text-xs border-b border-[#f0edfb] ${
                storageNotice.usageLevel === "full"
                  ? "bg-red-50 text-red-900"
                  : storageNotice.usageLevel === "warning95"
                    ? "bg-amber-50 text-amber-950"
                    : "bg-[#fff8e6] text-[#6b5a1e]"
              }`}
              role="status"
            >
              {storageNotice.message}
            </div>
          )}

          {/* Folder header */}
          <div className="px-4 py-2.5 border-b border-[#f0edfb] space-y-2.5">
            <h2 className="text-[13px] font-semibold text-[#1c1b33]">
              {folderDisplayName(nav, labels)}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {!isScheduledNav && selectionEnabled && (
                <input
                  ref={masterCheckboxRef}
                  type="checkbox"
                  aria-label="Select all visible messages"
                  checked={allVisibleSelected}
                  onChange={(e) => toggleMasterSelection(e.target.checked)}
                  disabled={loading || visibleSelectableIds.length === 0}
                  className="h-4 w-4 rounded border-[#d9d3f3] accent-[#6d4aff] disabled:opacity-50 shrink-0"
                />
              )}
              {!isScheduledNav && (
              <select
                aria-label="Filter messages"
                value={listFilter}
                onChange={(e) => setListFilter(e.target.value as ListFilter)}
                className="min-w-0 flex-1 rounded-lg border border-[#e8e4f8] bg-white px-2 py-1.5 text-xs text-[#44435a] outline-none focus:border-[#6d4aff] sm:flex-none sm:min-w-[8.5rem]"
                disabled={loading}
              >
                <option value="all">All</option>
                <option value="read">Read</option>
                <option value="unread">Unread</option>
                <option value="starred">Starred</option>
                <option value="unstarred">Unstarred</option>
              </select>
              )}
              <button
                type="button"
                onClick={() => void handleRefreshList()}
                disabled={loading || listRefreshing}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#e8e4f8] bg-white px-2.5 py-1.5 text-xs font-medium text-[#65637e] hover:border-[#6d4aff] hover:text-[#6d4aff] transition-colors disabled:opacity-60 active:scale-[0.98] active:bg-[#f3f0fd]"
                title={isScheduledNav ? "Refresh scheduled" : "Refresh messages"}
                aria-busy={listRefreshing}
              >
                <span
                  className={`inline-flex ${listRefreshing ? "animate-spin" : ""}`}
                  aria-hidden
                >
                  <IconRefresh />
                </span>
                {listRefreshing ? "Refreshing…" : "Refresh"}
              </button>
              {selectionEnabled && selectedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setBulkDeleteConfirmOpen(true)}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors active:scale-[0.98]"
                >
                  <IconTrash /> Delete ({selectedCount})
                </button>
              )}
            </div>
          </div>

          {/* Message rows */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-[#9896b4]">
                <svg className="animate-spin w-5 h-5 text-[#6d4aff]" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span className="text-xs">Loading…</span>
              </div>
            ) : isScheduledNav ? (
              filteredScheduledJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <div className="w-14 h-14 rounded-full bg-[#f3f0fd] flex items-center justify-center text-[#6d4aff]">
                    <IconClock />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-[#65637e]">No scheduled messages</p>
                    <p className="text-xs text-[#9896b4] mt-0.5">
                      {searchQ ? "Try a different search" : "Schedule a send from compose"}
                    </p>
                  </div>
                </div>
              ) : (
                filteredScheduledJobs.map((job) => {
                  const rowSelected = selectedScheduledId === job.id;
                  return (
                    <div
                      key={job.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Scheduled: ${job.subject || "No subject"}`}
                      onClick={() => setSelectedScheduledId(job.id)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedScheduledId(job.id);
                        }
                      }}
                      className={`w-full text-left border-b border-[#f7f5fd] transition-colors ${rowPad} px-4 cursor-pointer ${
                        rowSelected ? "bg-[#ede8ff] border-l-2 border-l-[#6d4aff]" : "hover:bg-[#f8f6fd] border-l-2 border-l-transparent"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-[#6d4aff] uppercase tracking-wide">
                            Scheduled
                          </p>
                          <p className={`text-[13px] mt-0.5 truncate ${rowSelected ? "text-[#1c1b33] font-semibold" : "text-[#1c1b33]"}`}>
                            {job.subject || "(no subject)"}
                          </p>
                          <p className="text-[12px] text-[#65637e] mt-0.5 truncate">
                            To: {job.toAddr || "—"}
                            {job.ccAddr ? ` · Cc: ${job.ccAddr}` : ""}
                          </p>
                          <p className="text-[11px] text-[#9896b4] mt-1">
                            {formatScheduledSendAt(job.sendAt)}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#f0edfb] text-[#5b3dff]">
                          {job.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )
            ) : threadIdsSorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <div className="w-14 h-14 rounded-full bg-[#f3f0fd] flex items-center justify-center">
                  <span className="text-3xl opacity-30">📭</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[#65637e]">No messages found</p>
                  <p className="text-xs text-[#9896b4] mt-0.5">
                    {searchQ
                      ? "Try a different search"
                      : listFilter !== "all"
                        ? "No messages match this filter"
                        : "You're all caught up"}
                  </p>
                </div>
              </div>
            ) : (
              threadIdsSorted.map((tid) => {
                const msgs = threadMap.get(tid)!;
                const rep = msgs[0];
                const isRead = rep.readAt !== null;
                const isSelected = selectedId === rep.id || (conversationOn && msgs.some((m) => m.id === selectedId));

                return (
                  <div
                    key={tid}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open message${rep.subject ? `: ${rep.subject}` : ""}`}
                    onClick={() => openMessage(rep.id)}
                    onKeyDown={(e) => {
                      // Prevent the row handler from firing when a nested control is focused.
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openMessage(rep.id);
                      }
                    }}
                    className={`w-full text-left border-b border-[#f7f5fd] transition-colors ${rowPad} px-4 ${
                      isSelected ? "bg-[#ede8ff] border-l-2 border-l-[#6d4aff]" : "hover:bg-[#f8f6fd] border-l-2 border-l-transparent"
                    } cursor-pointer`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Selection checkbox */}
                      {selectionEnabled && (
                        <div className="shrink-0 mt-1">
                          <input
                            type="checkbox"
                            aria-label="Select message"
                            checked={selectedIds.has(rep.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleMessageSelection(rep.id, e.target.checked);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-[#d9d3f3] accent-[#6d4aff]"
                          />
                        </div>
                      )}

                      {/* Avatar / unread dot */}
                      <div className="shrink-0 mt-0.5">
                        {!isRead ? (
                          <div className="w-7 h-7 rounded-full bg-[#6d4aff] flex items-center justify-center text-white text-[10px] font-bold">
                            {senderInitial(isSentNav ? rep.toAddr : rep.fromAddr)}
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#f3f0fd] flex items-center justify-center text-[#9896b4] text-[10px] font-bold">
                            {senderInitial(isSentNav ? rep.toAddr : rep.fromAddr)}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className={`min-w-0 flex-1 ${!isRead ? "font-semibold text-[#1c1b33]" : "text-[#44435a]"}`}>
                            {isSentNav ? (
                              <span className="text-[13px] truncate block">
                                To: {senderName(rep.toAddr)}
                              </span>
                            ) : (
                              <>
                                <span className="text-[13px] truncate flex items-center gap-1">
                                  <span className="truncate">
                                    {rep.senderIdentity?.displayName ?? senderName(rep.fromAddr)}
                                  </span>
                                  {rep.senderIdentity?.goldenTick && (
                                    <GoldenTickIcon className="w-3.5 h-3.5" />
                                  )}
                                </span>
                                <a
                                  href={`mailto:${rep.senderIdentity?.email ?? parseEmailFromAddr(rep.fromAddr)}`}
                                  className="text-[11px] text-[#6d4aff] hover:underline truncate block mt-0.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {rep.senderIdentity?.email ?? parseEmailFromAddr(rep.fromAddr)}
                                </a>
                              </>
                            )}
                          </div>
                          <span className="text-[10px] text-[#9896b4] shrink-0">{formatDate(rep.createdAt)}</span>
                        </div>
                        <div className={`text-xs mt-0.5 truncate flex items-center gap-2 min-w-0 ${!isRead ? "font-medium text-[#1c1b33]" : "text-[#65637e]"}`}>
                          <span className="truncate">{rep.subject || "(no subject)"}</span>
                          {isSentNav && rep.sentAnonymously ? (
                            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[#5b3dff] bg-[#ede8ff] rounded px-1.5 py-0.5">
                              Anonymous
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-[#9896b4] truncate flex-1">{rep.snippet}</span>
                          {nav.kind === "folder" &&
                            nav.folder === "spam" &&
                            typeof rep.spamScore === "number" &&
                            rep.spamScore > 0 && (
                              <span className="shrink-0 text-[10px] font-medium text-[#b45309] bg-amber-50 rounded px-1 py-0.5">
                                score {rep.spamScore}
                              </span>
                            )}
                          {rep.hasAttachment && <span className="text-[#9896b4] shrink-0"><IconPaperclip /></span>}
                          {conversationOn && msgs.length > 1 && (
                            <span className="text-[10px] text-[#9896b4] shrink-0 bg-[#f0edfb] rounded px-1 py-0.5">
                              {msgs.length}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Star */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void toggleStar(rep.id, !rep.starred); }}
                        className={`shrink-0 transition-colors mt-0.5 ${rep.starred ? "text-amber-400" : "text-[#e2dff5] hover:text-amber-400"}`}
                      >
                        <IconStar />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── MESSAGE DETAIL ── */}
        <div
          className={`flex-1 flex flex-col min-w-0 ${
            detail || (isScheduledNav && selectedScheduledJob) ? "" : ""
          }`}
        >
          {isScheduledNav && selectedScheduledJob ? (
            <>
              <div className="bg-white border-b border-[#e8e4f8] px-5 py-4 shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedScheduledId(null)}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-[#f3f0fd] text-[#65637e] transition-colors"
                      title="Back"
                    >
                      <IconArrowLeft />
                    </button>
                    <h2 className="text-base font-semibold text-[#1c1b33] leading-tight truncate">
                      {selectedScheduledJob.subject || "(no subject)"}
                    </h2>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#ede8ff] text-[#5b3dff]">
                    {selectedScheduledJob.status}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <div className="max-w-xl rounded-2xl border border-[#e8e4f8] bg-white p-5 shadow-sm space-y-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9896b4]">
                      Recipients
                    </div>
                    <p className="text-sm text-[#1c1b33] mt-1">
                      <span className="text-[#65637e]">To:</span> {selectedScheduledJob.toAddr || "—"}
                    </p>
                    {selectedScheduledJob.ccAddr?.trim() ? (
                      <p className="text-sm text-[#1c1b33] mt-1">
                        <span className="text-[#65637e]">Cc:</span> {selectedScheduledJob.ccAddr}
                      </p>
                    ) : null}
                    {selectedScheduledJob.bccAddr?.trim() ? (
                      <p className="text-sm text-[#1c1b33] mt-1">
                        <span className="text-[#65637e]">Bcc:</span> {selectedScheduledJob.bccAddr}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9896b4]">
                      Scheduled send
                    </div>
                    <p className="text-sm font-medium text-[#1c1b33] mt-1">
                      {formatScheduledSendAt(selectedScheduledJob.sendAt)}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-[#f0edfb]">
                    <button
                      type="button"
                      onClick={() => setScheduledCancelConfirmId(selectedScheduledJob.id)}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors"
                    >
                      <IconTrash /> Cancel scheduled send
                    </button>
                    <p className="text-xs text-[#9896b4] mt-2">
                      This removes the scheduled message before it is sent. It cannot be undone from here after cancel.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : detail && focusMsg ? (
            <>
              {/* Detail top bar */}
              <div className="bg-white border-b border-[#e8e4f8] px-5 py-4 shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => { setSelectedId(null); setDetail(null); }}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-[#f3f0fd] text-[#65637e] transition-colors"
                      title="Back"
                    >
                      <IconArrowLeft />
                    </button>
                    <h2 className="text-base font-semibold text-[#1c1b33] leading-tight truncate">
                      {focusMsg.subject || "(no subject)"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!inTrash ? (
                      <>
                        {focusMsg.folder === "sent" && focusMsg.sentAnonymously ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#5b3dff] bg-[#ede8ff] rounded-full px-2 py-1 shrink-0">
                            Anonymous send
                          </span>
                        ) : null}
                        <button
                          onClick={archiveMessage}
                          className="flex items-center gap-1.5 rounded-lg border border-[#e8e4f8] px-2.5 py-1.5 text-xs font-medium text-[#65637e] hover:border-[#6d4aff] hover:text-[#6d4aff] transition-all"
                        >
                          <IconArchive /> Archive
                        </button>
                        <button
                          onClick={removeMessage}
                          className="flex items-center gap-1.5 rounded-lg border border-[#e8e4f8] px-2.5 py-1.5 text-xs font-medium text-[#65637e] hover:border-red-400 hover:text-red-500 transition-all"
                        >
                          <IconTrash /> Trash
                        </button>
                        <button
                          onClick={() => void toggleStar(focusMsg.id, !focusMsg.starred)}
                          className={`p-1.5 rounded-lg border transition-all ${
                            focusMsg.starred
                              ? "border-amber-300 text-amber-400 bg-amber-50"
                              : "border-[#e8e4f8] text-[#9896b4] hover:border-amber-300 hover:text-amber-400"
                          }`}
                          title={focusMsg.starred ? "Unstar" : "Star"}
                        >
                          <IconStar />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={restoreMessage}
                        className="flex items-center gap-1.5 rounded-lg border border-[#e8e4f8] px-2.5 py-1.5 text-xs font-medium text-[#65637e] hover:border-[#6d4aff] hover:text-[#6d4aff] transition-all"
                      >
                        Restore to inbox
                      </button>
                    )}
                  </div>
                </div>

                {/* Label badges */}
                {detail.labelIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5 ml-9">
                    {detail.labelIds.map((lid) => {
                      const lbl = labels.find((l) => l.id === lid);
                      return lbl ? (
                        <span
                          key={lid}
                          className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5"
                          style={{ background: `${lbl.color ?? "#6d4aff"}18`, color: lbl.color ?? "#6d4aff" }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: lbl.color ?? "#6d4aff" }} />
                          {lbl.name}
                        </span>
                      ) : null;
                    })}
                    <button
                      onClick={() => {
                        const current = detail.labelIds;
                        const all = labels;
                        const picked = window.prompt(
                          `Labels (comma-separated IDs):\n${all.map((l) => `${l.id} = ${l.name}`).join("\n")}`,
                          current.join(", ")
                        );
                        if (picked !== null) void updateLabels(picked.split(",").map((s) => s.trim()).filter(Boolean));
                      }}
                      className="text-[11px] text-[#9896b4] hover:text-[#6d4aff] transition-colors"
                    >
                      + label
                    </button>
                  </div>
                )}
              </div>

              {/* Attachments bar */}
              {detail.attachments.length > 0 && (
                <div className="bg-[#f8f5ff] border-b border-[#e8e4f8] px-5 py-2.5 shrink-0">
                  <div className="flex flex-wrap gap-2">
                    {detail.attachments.map((a) => (
                      <a
                        key={a.id}
                        href={`/api/mail/attachments/${a.id}`}
                        className="flex items-center gap-1.5 text-xs font-medium text-[#6d4aff] bg-white rounded-lg border border-[#e8e4f8] px-2.5 py-1.5 hover:border-[#6d4aff] hover:bg-[#f3f0fd] transition-all"
                      >
                        <IconPaperclip />
                        {a.filename}
                        <span className="text-[#9896b4]">({(a.sizeBytes / 1024).toFixed(1)} KB)</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                {detail.messages.map((dm) => (
                  <article key={dm.id} className="bg-white rounded-2xl border border-[#e8e4f8] shadow-sm overflow-hidden">
                    {/* Message header */}
                    <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-[#f7f5fd]">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#6d4aff] flex items-center justify-center text-white text-sm font-semibold shrink-0 overflow-hidden">
                          {dm.senderIdentity?.logoUrl ? (
                            <img src={dm.senderIdentity.logoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            senderInitial(dm.fromAddr)
                          )}
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-[#1c1b33] flex items-center gap-1.5 flex-wrap">
                            <span>{dm.senderIdentity?.displayName ?? senderName(dm.fromAddr)}</span>
                            {dm.senderIdentity?.goldenTick && (
                              <GoldenTickIcon className="w-4 h-4" />
                            )}
                            {dm.senderIdentity?.businessName && (
                              <span className="text-[11px] font-normal text-[#9896b4]">
                                ({dm.senderIdentity.businessName})
                              </span>
                            )}
                          </div>
                          {dm.senderIdentity?.goldenTick && (
                            <div className="text-[10px] font-medium text-amber-600/90 mt-0.5">
                              Verified Business
                            </div>
                          )}
                          <div className="text-[11px] text-[#65637e] mt-0.5">
                            <a
                              className="hover:underline"
                              href={`mailto:${dm.senderIdentity?.email ?? parseEmailFromAddr(dm.fromAddr)}`}
                            >
                              {dm.senderIdentity?.email ?? parseEmailFromAddr(dm.fromAddr)}
                            </a>
                          </div>
                          <div className="text-[11px] text-[#9896b4] mt-0.5">
                            To: {dm.toAddr}
                            {dm.ccAddr ? ` · Cc: ${dm.ccAddr}` : ""}
                          </div>
                          {dm.folder === "sent" && dm.sentAnonymously ? (
                            <p className="text-[11px] text-[#5b3dff] mt-1.5 font-medium">
                              Recipients saw this from your Sendora anonymous address, not your personal email.
                            </p>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              setDetailsExpandedMessageId((prev) =>
                                prev === dm.id ? null : dm.id
                              )
                            }
                            className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#ddd6fe] bg-[#f6f3ff] px-2.5 py-1 text-[11px] font-medium text-[#5b3dff] hover:border-[#c4b5fd] hover:bg-[#efe9ff] transition-colors"
                          >
                            <IconChevron open={detailsExpandedMessageId === dm.id} />
                            {detailsExpandedMessageId === dm.id
                              ? "Hide details"
                              : "Show details"}
                          </button>
                        </div>
                      </div>
                      <div className="relative flex items-center gap-2 text-[11px] text-[#9896b4] shrink-0">
                        <span>
                          {new Date(dm.createdAt).toLocaleString("en-US", {
                            timeZone: "UTC",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <button
                          type="button"
                          className="rounded-md px-1.5 py-1 text-[#65637e] hover:bg-[#f3f0fd]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOverflowMenuMessageId((prev) =>
                              prev === dm.id ? null : dm.id
                            );
                          }}
                          title="More actions"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path d="M10 4.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5ZM10 8.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5ZM8.75 15a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0Z" />
                          </svg>
                        </button>
                        {overflowMenuMessageId === dm.id && (
                          <div
                            className="absolute right-0 top-7 z-20 w-48 rounded-2xl border border-[#e8e4f8] bg-white shadow-xl py-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                forwardMessage(dm);
                                setOverflowMenuMessageId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs font-medium text-[#1c1b33] hover:bg-[#f8f6fd]"
                            >
                              Forward
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void blockSenderFromMessage(dm);
                                setOverflowMenuMessageId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs font-medium text-[#1c1b33] hover:bg-[#f8f6fd]"
                            >
                              Block sender
                            </button>
                            {(dm.folder === "inbox" || dm.folder === "archive") && (
                              <button
                                type="button"
                                onClick={() => {
                                  void markMessageAsSpam(dm);
                                  setOverflowMenuMessageId(null);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs font-medium text-[#1c1b33] hover:bg-[#f8f6fd]"
                              >
                                Mark as spam
                              </button>
                            )}
                            {dm.folder === "spam" && (
                              <button
                                type="button"
                                onClick={() => {
                                  void markMessageNotSpam(dm);
                                  setOverflowMenuMessageId(null);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs font-medium text-[#1c1b33] hover:bg-[#f8f6fd]"
                              >
                                Not spam
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                void reportSpamFromMessage(dm);
                                setOverflowMenuMessageId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs font-medium text-[#1c1b33] hover:bg-[#f8f6fd]"
                            >
                              Report spam
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                downloadMessage(dm);
                                setOverflowMenuMessageId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs font-medium text-[#1c1b33] hover:bg-[#f8f6fd]"
                            >
                              Download message
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void markMessageUnread(dm.id);
                                setOverflowMenuMessageId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs font-medium text-[#1c1b33] hover:bg-[#f8f6fd]"
                            >
                              Mark as unread
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {detailsExpandedMessageId === dm.id && (
                      <div className="px-5 py-3 border-b border-[#f3f0fd] bg-[#fcfbff]">
                        <dl className="grid gap-2 text-[12px] text-[#44435a] sm:grid-cols-2">
                          <div><dt className="text-[#9896b4]">From</dt><dd>{dm.fromAddr}</dd></div>
                          <div><dt className="text-[#9896b4]">To</dt><dd>{dm.toAddr}</dd></div>
                          <div><dt className="text-[#9896b4]">Date</dt><dd>{new Date(dm.createdAt).toUTCString()}</dd></div>
                          <div><dt className="text-[#9896b4]">Subject</dt><dd>{dm.subject || "(no subject)"}</dd></div>
                          <div><dt className="text-[#9896b4]">Mailed-by</dt><dd>{dm.mailedBy || "Unavailable"}</dd></div>
                          <div><dt className="text-[#9896b4]">Signed-by</dt><dd>{dm.signedBy || "Unavailable"}</dd></div>
                        </dl>
                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#ddd6fe] bg-gradient-to-r from-[#f7f4ff] to-[#eef2ff] px-3 py-2 text-[11px] font-medium text-[#4c1d95]">
                          <span className="text-[#5b3dff]"><IconLock /></span>
                          <span>Protected message</span>
                          <span className="text-[#a78bfa]">•</span>
                          <a
                            href="#"
                            className="text-[#5b3dff] underline decoration-[#c4b5fd] underline-offset-2 hover:text-[#4c1d95]"
                          >
                            Learn more
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Message body */}
                    <div className={`px-5 py-5 text-sm text-[#1c1b33] leading-relaxed ${composeFontClass}`}>
                      {dm.bodyHtml ? (
                        <div
                          dangerouslySetInnerHTML={{ __html: dm.bodyHtml }}
                          className="prose prose-sm max-w-none"
                        />
                      ) : (
                        <pre className="whitespace-pre-wrap font-sans text-sm">{dm.bodyText}</pre>
                      )}
                    </div>

                    {/* Smart replies + lower actions */}
                    <div className="px-5 pb-4 pt-3 border-t border-[#f7f5fd] space-y-3">
                      {smartReplyAnchorMessage?.id === dm.id && (
                        (summaryByMessageId[dm.id]?.loading ||
                          summaryByMessageId[dm.id]?.error ||
                          (summaryByMessageId[dm.id]?.bullets?.length ?? 0) > 0) && (
                          <div className="rounded-xl border border-[#e8e4f8] bg-[#faf9ff] px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="text-[11px] font-semibold text-[#5c577f]">AI Summary</div>
                              {summaryByMessageId[dm.id]?.generatedAt && !summaryByMessageId[dm.id]?.loading && (
                                <div className="text-[10px] text-[#9896b4]">
                                  Updated {new Date(summaryByMessageId[dm.id].generatedAt ?? 0).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              )}
                            </div>
                            {summaryByMessageId[dm.id]?.loading ? (
                              <div className="text-[11px] text-[#7f7d99]">Generating summary...</div>
                            ) : summaryByMessageId[dm.id]?.error ? (
                              <div className="text-[11px] text-[#7f7d99]">{summaryByMessageId[dm.id]?.error}</div>
                            ) : (
                              <ul className="list-disc pl-4 space-y-1">
                                {(summaryByMessageId[dm.id]?.bullets ?? []).map((point, idx) => (
                                  <li key={`${dm.id}-sum-${idx}`} className="text-[12px] text-[#3e3a5f]">
                                    {point}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )
                      )}
                      {smartReplyAnchorMessage?.id === dm.id && (
                        <div>
                          <div className="text-[11px] font-medium text-[#7f7d99] mb-1.5">
                            Smart replies
                          </div>
                          {smartReplyByMessageId[dm.id]?.loading ? (
                            <div className="text-[11px] text-[#9896b4]">Generating suggestions...</div>
                          ) : smartReplyByMessageId[dm.id]?.suggestions?.length ? (
                            <div className="flex flex-wrap gap-1.5">
                              {smartReplyByMessageId[dm.id].suggestions.slice(0, 3).map((s, idx) => (
                                <button
                                  key={`${dm.id}-sr-${idx}`}
                                  onClick={() => startReply(dm, s)}
                                  className="text-xs font-medium text-[#4f46e5] rounded-full border border-[#d9d3ff] bg-[#f8f5ff] px-3.5 py-1.5 hover:bg-[#f0e9ff] transition-all text-left"
                                  title={s}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          ) : smartReplyByMessageId[dm.id]?.error ? (
                            <div className="text-[11px] text-[#9896b4]">Suggestions unavailable right now.</div>
                          ) : null}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => startReply(dm)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-white rounded-lg px-3.5 py-2 transition-all hover:brightness-95"
                          style={{ background: "linear-gradient(135deg, #7d5fff 0%, #5b3dff 100%)" }}
                        >
                          <IconReply /> Reply
                        </button>
                        <button
                          onClick={() => void summarizeMessage(dm)}
                          className="text-xs font-semibold text-white rounded-lg px-3.5 py-2 transition-all hover:brightness-95"
                          style={{ background: "linear-gradient(135deg, #8b7bff 0%, #6d4aff 100%)" }}
                          disabled={summaryByMessageId[dm.id]?.loading}
                        >
                          {summaryByMessageId[dm.id]?.loading ? "Summarizing..." : "Summarize"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : isScheduledNav ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-sm border border-[#e8e4f8]">
                <IconClock />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[#65637e]">Select a scheduled message</p>
                <p className="text-xs text-[#9896b4] mt-1">Review details or cancel before send</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setComposeReplySeed(null);
                  setComposeOpen(true);
                }}
                className="rounded-full bg-[#6d4aff] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5b3dff] transition-colors"
              >
                + New message
              </button>
            </div>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-sm border border-[#e8e4f8]">
                <svg viewBox="0 0 24 24" fill="none" stroke="#c5c3d8" strokeWidth={1.5} className="w-10 h-10">
                  <rect x="2" y="4" width="20" height="16" rx="3" /><path d="m2 7 10 7 10-7" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[#65637e]">Select a message to read</p>
                <p className="text-xs text-[#9896b4] mt-1">Or compose a new message</p>
              </div>
              <button
                onClick={() => { setComposeReplySeed(null); setComposeOpen(true); }}
                className="rounded-full bg-[#6d4aff] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5b3dff] transition-colors"
              >
                + New message
              </button>
            </div>
          )}
        </div>
      </div>

      <ComposeClient
        open={composeOpen}
        replySeed={composeReplySeed}
        onClose={() => {
          setComposeOpen(false);
          setComposeReplySeed(null);
        }}
        onSent={() => {
          setNav({ kind: "folder", folder: "sent" });
          void refetchIdentity();
          router.refresh();
        }}
        isBusiness={isBusiness}
        outboundMailboxes={outboundMailboxes}
        goldenTickEligible={goldenTickEligible}
        composePreviewFrom={composePreviewFrom}
        draftAutoSaveOn={draftAutoSaveOn}
        composeFontClass={composeFontClass}
        storageUsageLevel={storageNotice.usageLevel}
        storageUsageMessage={storageNotice.message}
      />
      {scheduledCancelConfirmId && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#e8e4f8] bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-[#1c1b33]">Cancel scheduled send?</h3>
            <p className="mt-2 text-sm text-[#65637e]">
              This message will not be sent. You can schedule again from compose if needed.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setScheduledCancelConfirmId(null)}
                className="rounded-lg border border-[#ddd6fe] px-3.5 py-2 text-sm font-medium text-[#5b3dff] hover:bg-[#f7f4ff]"
              >
                Keep scheduled
              </button>
              <button
                type="button"
                onClick={() => void cancelScheduledJob(scheduledCancelConfirmId)}
                className="rounded-lg border border-red-300 bg-red-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Cancel send
              </button>
            </div>
          </div>
        </div>
      )}
      {bulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#e8e4f8] bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-[#1c1b33]">
              Confirm delete
            </h3>
            <p className="mt-2 text-sm text-[#65637e]">
              {selectedCount === 1
                ? "Are you sure you want to delete this message?"
                : "Are you sure you want to delete selected messages?"}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkDeleteConfirmOpen(false)}
                className="rounded-lg border border-[#ddd6fe] px-3.5 py-2 text-sm font-medium text-[#5b3dff] hover:bg-[#f7f4ff]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteSelectedMessages()}
                className="rounded-lg border border-red-300 bg-red-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {spamBlockPrompt.open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#e8e4f8] bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-[#1c1b33]">
              Spam reported. Also block sender?
            </h3>
            <p className="mt-2 text-sm text-[#65637e]">
              Message reported as spam. Do you also want to block {spamBlockPrompt.senderEmail}?
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSpamBlockPrompt({ open: false, senderEmail: "", messageId: "" });
                  showActionNotice("Spam report submitted.");
                }}
                className="rounded-lg border border-[#ddd6fe] px-3.5 py-2 text-sm font-medium text-[#5b3dff] hover:bg-[#f7f4ff]"
              >
                No
              </button>
              <button
                type="button"
                onClick={async () => {
                  const msg = detail?.messages.find((m) => m.id === spamBlockPrompt.messageId);
                  if (msg) {
                    await blockSenderFromMessage(msg);
                  }
                  setSpamBlockPrompt({ open: false, senderEmail: "", messageId: "" });
                  showActionNotice("Spam report submitted.");
                }}
                className="rounded-lg px-3.5 py-2 text-sm font-semibold text-white hover:brightness-95"
                style={{ background: "linear-gradient(135deg, #7d5fff 0%, #5b3dff 100%)" }}
              >
                Yes, block
              </button>
            </div>
          </div>
        </div>
      )}
      {actionNotice && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[120] rounded-full bg-[#1c1b33] text-white text-xs px-4 py-2 shadow-lg">
          {actionNotice}
        </div>
      )}
    </div>
  );
}
