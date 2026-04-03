"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import {
  ComposeInlineGhost,
  appendComposeGhostClearMeta,
  appendComposeSuggestionMeta,
  composeIdleSkipMetaKey,
} from "@/components/compose/compose-inline-ghost-extension";

type EditorValue = {
  html: string;
  text: string;
  isEmpty: boolean;
};

const SMART_COMPOSE_IDLE_MS = 750;
const SMART_COMPOSE_MIN_BEFORE = 12;

function normalizeHtml(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t === "<p></p>" || t === "<p><br></p>" || t === "<br>") return "";
  return raw;
}

export function getInlineContextFromEditor(editor: Editor): {
  before: string;
  after: string;
} | null {
  const { state } = editor;
  const sel = state.selection;
  if (!sel.empty) return null;
  const doc = state.doc;
  const from = sel.from;
  const end = doc.content.size;
  const beforeRaw = doc.textBetween(0, from, "\n").replace(/\u00A0/g, " ");
  const afterRaw = doc.textBetween(from, end, "\n").replace(/\u00A0/g, " ");
  const before = beforeRaw.length > 2000 ? beforeRaw.slice(-2000) : beforeRaw;
  const after = afterRaw.length > 200 ? afterRaw.slice(0, 200) : afterRaw;
  return { before, after };
}

export type ComposerEditorHandle = {
  focus: () => void;
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  toggleBulletList: () => void;
  toggleOrderedList: () => void;
  toggleBlockquote: () => void;
  align: (dir: "left" | "center" | "right") => void;
  setLink: (href: string) => void;
  unsetLink: () => void;
  getActiveLink: () => string | null;
  /** Plain text in the current selection (empty string if cursor only). */
  getSelectedText: () => string;
  /**
   * Apply a link: wraps current selection, or inserts linked text if selection is empty.
   * If selection is non-empty and `displayText` differs from selected text, selection is replaced.
   */
  applyLinkWithDisplayText: (href: string, displayText: string) => void;
  insertText: (text: string) => void;
  getInlineContext: () => { before: string; after: string } | null;
};

export const TiptapComposerEditor = forwardRef(function TiptapComposerEditor(
  {
    valueHtml,
    onChange,
    composeFontClass,
    insertImage,
    onInsertImageConsumed,
    smartComposeEnabled,
    requestInlineSuggestion,
  }: {
    valueHtml: string;
    onChange: (next: EditorValue) => void;
    composeFontClass: string;
    insertImage?: { key: string; src: string; alt?: string } | null;
    onInsertImageConsumed?: () => void;
    smartComposeEnabled?: boolean;
    requestInlineSuggestion?: (
      ctx: { before: string; after: string },
      signal: AbortSignal
    ) => Promise<string | null>;
  },
  ref: React.ForwardedRef<ComposerEditorHandle>
) {
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const smartComposeEnabledRef = useRef(!!smartComposeEnabled);
  const requestInlineSuggestionRef = useRef(requestInlineSuggestion);
  useEffect(() => {
    requestInlineSuggestionRef.current = requestInlineSuggestion;
  }, [requestInlineSuggestion]);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const abortPendingFetch = useCallback(() => {
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Image.configure({
        inline: true,
        allowBase64: false,
        HTMLAttributes: {
          class: "inline-block max-w-full rounded-lg",
        },
      }),
      ComposeInlineGhost,
    ],
    immediatelyRender: false,
    content: valueHtml || "",
    onUpdate: ({ editor, transaction }) => {
      const html = normalizeHtml(editor.getHTML());
      const text = editor.getText().replace(/\u00A0/g, " ").trim();
      onChange({ html, text, isEmpty: !html && !text });

      // Only schedule smart-compose on actual typing/content changes.
      // TipTap's onUpdate is already working (draft + state sync), so it's
      // the safest place to attach pause detection.
      if (!smartComposeEnabledRef.current || !requestInlineSuggestionRef.current) return;
      if (transaction?.getMeta?.(composeIdleSkipMetaKey)) return;
      if (!transaction?.docChanged) return;

      const sel = editor.state.selection;
      if (!sel.empty) return;
      const fromPos = sel.from;
      const ctx = getInlineContextFromEditor(editor);
      if (!ctx || ctx.before.trim().length < SMART_COMPOSE_MIN_BEFORE) return;

      // User kept typing: abort in-flight request and debounce the next one.
      abortPendingFetch();
      clearIdleTimer();
      idleTimerRef.current = setTimeout(() => {
        idleTimerRef.current = null;

        const fn = requestInlineSuggestionRef.current;
        if (!fn) return;
        if (!editor.isFocused) return;

        const latestSel = editor.state.selection;
        if (!latestSel.empty || latestSel.from !== fromPos) return;

        const latestCtx = getInlineContextFromEditor(editor);
        if (!latestCtx || latestCtx.before.trim().length < SMART_COMPOSE_MIN_BEFORE) return;

        const ac = new AbortController();
        fetchAbortRef.current = ac;

        void (async () => {
          let suggestion: string | null = null;
          try {
            suggestion = await fn(latestCtx, ac.signal);
          } catch {
            return;
          }
          if (ac.signal.aborted) return;
          if (!editor.isFocused) return;
          if (!editor.state.selection.empty || editor.state.selection.from !== fromPos) return;
          if (!suggestion?.trim()) return;

          editor.view.dispatch(
            appendComposeSuggestionMeta(editor.state.tr, suggestion.trim())
          );
        })();
      }, SMART_COMPOSE_IDLE_MS);
    },
  });

  // Keep refs in sync and clear visible ghost when the feature is disabled.
  useEffect(() => {
    smartComposeEnabledRef.current = !!smartComposeEnabled;
    if (!editor) return;

    if (!smartComposeEnabled || !requestInlineSuggestion) {
      clearIdleTimer();
      abortPendingFetch();
      editor.view.dispatch(appendComposeGhostClearMeta(editor.state.tr));
    }
  }, [editor, smartComposeEnabled, requestInlineSuggestion, clearIdleTimer, abortPendingFetch]);
  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.commands.focus(),
      toggleBold: () => editor?.chain().focus().toggleBold().run(),
      toggleItalic: () => editor?.chain().focus().toggleItalic().run(),
      toggleUnderline: () => editor?.chain().focus().toggleUnderline().run(),
      toggleBulletList: () => editor?.chain().focus().toggleBulletList().run(),
      toggleOrderedList: () => editor?.chain().focus().toggleOrderedList().run(),
      toggleBlockquote: () => editor?.chain().focus().toggleBlockquote().run(),
      align: (dir) => editor?.chain().focus().setTextAlign(dir).run(),
      setLink: (href) =>
        editor?.chain().focus().extendMarkRange("link").setLink({ href }).run(),
      unsetLink: () => editor?.chain().focus().extendMarkRange("link").unsetLink().run(),
      getActiveLink: () => {
        const href = editor?.getAttributes("link")?.href as string | undefined;
        return href?.trim() ? href : null;
      },
      getSelectedText: () => {
        if (!editor) return "";
        const { from, to } = editor.state.selection;
        if (from === to) return "";
        return editor.state.doc
          .textBetween(from, to, "\n")
          .replace(/\u00A0/g, " ");
      },
      applyLinkWithDisplayText: (href, displayText) => {
        if (!editor) return;
        const rawHref = href.trim();
        if (!rawHref) return;
        const chain = editor.chain().focus();
        const { empty, from, to } = editor.state.selection;
        const normalizedHref =
          /^mailto:/i.test(rawHref) || /^[a-z][a-z0-9+.-]*:/i.test(rawHref)
            ? rawHref
            : `https://${rawHref.replace(/^\/\//, "")}`;

        const fallbackLabel = normalizedHref;
        const label = (displayText.trim() || fallbackLabel).trim();

        if (!empty) {
          const selected = editor.state.doc
            .textBetween(from, to, "\n")
            .replace(/\u00A0/g, " ");
          if (selected.trim() === label.trim()) {
            chain.setLink({ href: normalizedHref }).run();
          } else {
            chain
              .deleteSelection()
              .insertContent({
                type: "text",
                text: label,
                marks: [{ type: "link", attrs: { href: normalizedHref } }],
              })
              .run();
          }
          return;
        }

        chain
          .insertContent({
            type: "text",
            text: label,
            marks: [{ type: "link", attrs: { href: normalizedHref } }],
          })
          .run();
      },
      insertText: (text) => editor?.chain().focus().insertContent(text).run(),
      getInlineContext: () => (editor ? getInlineContextFromEditor(editor) : null),
    }),
    [editor]
  );

  useEffect(() => {
    if (!editor) return;
    const onBlur = () => {
      clearIdleTimer();
      abortPendingFetch();
      editor.view.dispatch(appendComposeGhostClearMeta(editor.state.tr));
    };

    editor.on("blur", onBlur);
    return () => {
      editor.off("blur", onBlur);
    };
  }, [editor, abortPendingFetch, clearIdleTimer]);

  // External updates (draft load / reply seed).
  useEffect(() => {
    if (!editor) return;
    const desired = normalizeHtml(valueHtml || "");
    const current = normalizeHtml(editor.getHTML());
    if (desired === current) return;
    editor.view.dispatch(appendComposeGhostClearMeta(editor.state.tr));
    editor.commands.setContent(desired || "");
  }, [editor, valueHtml]);

  // Insert images after upload.
  useEffect(() => {
    if (!editor) return;
    if (!insertImage) return;
    editor.chain().focus().setImage({ src: insertImage.src, alt: insertImage.alt ?? "" }).run();
    onInsertImageConsumed?.();
  }, [editor, insertImage?.key, insertImage?.src, insertImage?.alt, onInsertImageConsumed]);

  if (!editor) {
    return (
      <div
        className={`min-h-[140px] max-h-[260px] overflow-y-auto px-4 py-3 ${composeFontClass}`}
      >
        Loading editor…
      </div>
    );
  }

  return (
    <EditorContent
      editor={editor}
      className={`min-h-[140px] max-h-[260px] overflow-y-auto px-4 py-3 text-[14.5px] text-neutral-900 outline-none ${composeFontClass}`}
      style={{ lineHeight: 1.65 }}
    />
  );
});
