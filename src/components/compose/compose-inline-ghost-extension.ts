import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** Do not reset smart-compose idle timer (e.g. when applying a fetched suggestion). */
export const composeIdleSkipMetaKey = "composeIdleSkip";

type GhostPluginState = { ghost: string | null };

export const composeGhostPluginKey = new PluginKey<GhostPluginState>("composeGhost");

export function appendComposeSuggestionMeta(tr: Transaction, text: string): Transaction {
  return tr
    .setMeta(composeIdleSkipMetaKey, true)
    .setMeta(composeGhostPluginKey, { action: "set", text });
}

export function appendComposeGhostClearMeta(tr: Transaction): Transaction {
  return tr.setMeta(composeGhostPluginKey, { action: "clear" });
}

export const ComposeInlineGhost = Extension.create({
  name: "composeInlineGhost",

  addProseMirrorPlugins() {
    return [
      new Plugin<GhostPluginState>({
        key: composeGhostPluginKey,
        state: {
          init: (): GhostPluginState => ({ ghost: null }),
          apply(tr, value): GhostPluginState {
            const meta = tr.getMeta(composeGhostPluginKey) as
              | { action: "set"; text: string }
              | { action: "clear" }
              | undefined;
            if (meta?.action === "set" && typeof meta.text === "string") {
              return { ghost: meta.text };
            }
            if (meta?.action === "clear") {
              return { ghost: null };
            }
            if (tr.docChanged) {
              return { ghost: null };
            }
            if (tr.selectionSet) {
              return { ghost: null };
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            const ghost = composeGhostPluginKey.getState(state)?.ghost;
            if (!ghost) return DecorationSet.empty;
            const sel = state.selection;
            if (!sel.empty) return DecorationSet.empty;
            const pos = sel.from;
            const dec = Decoration.widget(
              pos,
              () => {
                const el = document.createElement("span");
                el.className =
                  "compose-inline-suggestion text-neutral-400/90 select-none pointer-events-none align-baseline whitespace-pre-wrap break-words";
                el.textContent = ghost;
                el.setAttribute("aria-hidden", "true");
                return el;
              },
              // Key includes the position so the decoration remounts correctly as the caret moves.
              { side: 1, ignoreSelection: true, key: `compose-inline-suggestion-${pos}` }
            );
            return DecorationSet.create(state.doc, [dec]);
          },
          handleKeyDown(view, event) {
            if (event.key !== "Tab" || event.shiftKey) return false;
            const ghost = composeGhostPluginKey.getState(view.state)?.ghost;
            if (!ghost) return false;
            event.preventDefault();
            view.dispatch(view.state.tr.insertText(ghost));
            return true;
          },
        },
      }),
    ];
  },
});
