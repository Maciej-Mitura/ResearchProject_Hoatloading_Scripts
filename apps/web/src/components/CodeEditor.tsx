import { useEffect, useLayoutEffect, useRef } from "react";
import { Compartment, EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { json } from "@codemirror/lang-json";
import { javascript } from "@codemirror/lang-javascript";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from "@codemirror/search";
import { tags } from "@lezer/highlight";

function editorTheme() {
  const dark = document.documentElement.dataset.theme === "dark";
  return [
    EditorView.theme({
      "&": {
        backgroundColor: "var(--code)",
        color: "var(--code-text)",
        fontSize: "13px",
      },
      "&.cm-focused": {
        outline: "2px solid var(--accent)",
        outlineOffset: "-2px",
      },
      ".cm-scroller": {
        fontFamily: "var(--mono)",
        lineHeight: "1.65",
        overflow: "auto",
        height: "440px",
        maxHeight: "65vh",
      },
      ".cm-content": { padding: "16px 0", caretColor: "var(--text)" },
      ".cm-line": { padding: "0 16px 0 8px" },
      ".cm-gutters": {
        backgroundColor: "var(--surface-alt)",
        color: "var(--muted)",
        borderRight: "1px solid var(--border)",
      },
      ".cm-activeLine, .cm-activeLineGutter": {
        backgroundColor: "var(--accent-soft)",
      },
      ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
        backgroundColor: dark ? "#454678" : "#d7d6ff",
      },
      ".cm-cursor": { borderLeftColor: "var(--text)" },
      ".cm-matchingBracket": {
        backgroundColor: "var(--accent-soft)",
        outline: "1px solid var(--accent)",
      },
      ".cm-panels": {
        backgroundColor: "var(--surface)",
        color: "var(--text)",
        borderColor: "var(--border)",
      },
      ".cm-textfield, .cm-button": {
        background: "var(--surface-alt)",
        backgroundImage: "none",
        color: "var(--text)",
        border: "1px solid var(--control-border)",
        borderRadius: "4px",
      },
      ".cm-searchMatch": { backgroundColor: dark ? "#755728" : "#ffe49c" },
    }, { dark }),
    syntaxHighlighting(HighlightStyle.define([
      { tag: tags.keyword, color: dark ? "#c9a8ff" : "#7140a1" },
      {
        tag: [tags.string, tags.special(tags.string)],
        color: dark ? "#a8d7a9" : "#226637",
      },
      {
        tag: [tags.number, tags.bool, tags.null],
        color: dark ? "#f3c18d" : "#8b4b17",
      },
      {
        tag: [tags.typeName, tags.className],
        color: dark ? "#8bd4ed" : "#10627a",
      },
      {
        tag: tags.comment,
        color: dark ? "#9ba8bc" : "#64738a",
        fontStyle: "italic",
      },
      {
        tag: tags.function(tags.variableName),
        color: dark ? "#9cbfff" : "#28589c",
      },
    ])),
  ];
}

/** Real CodeMirror 6 view. No textarea compatibility or hidden source input. */
export function CodeEditor(
  { value, language, readOnly, onChange, documentKey = "single", location }: {
    documentKey?: string;
    location?: { line: number; column: number; serial: number } | null;
    value: string;
    language: string;
    readOnly: boolean;
    onChange: (source: string) => void;
  },
) {
  const states = useRef(
    new Map<
      string,
      { state: EditorState; scrollTop: number; scrollLeft: number }
    >(),
  );
  const parent = useRef<HTMLDivElement>(null),
    view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const compartments = useRef({
    language: new Compartment(),
    readOnly: new Compartment(),
    theme: new Compartment(),
  });
  useLayoutEffect(() => {
    const c = compartments.current;
    const editor = new EditorView({
      parent: parent.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          drawSelection(),
          history(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          search(),
          highlightSelectionMatches(),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            indentWithTab,
          ]),
          c.language.of(
            language === "json"
              ? json()
              : javascript({ typescript: language === "typescript" }),
          ),
          c.readOnly.of([
            EditorState.readOnly.of(readOnly),
            EditorView.editable.of(!readOnly),
            EditorView.contentAttributes.of({
              "aria-readonly": String(readOnly),
            }),
          ]),
          c.theme.of(editorTheme()),
          EditorView.contentAttributes.of({
            id: "source-editor",
            role: "textbox",
            "aria-label": "Script source",
            "aria-multiline": "true",
            "aria-describedby": "source-editor-help",
            spellcheck: "false",
            autocapitalize: "off",
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              change.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    const cached = states.current.get(documentKey);
    if (cached && cached.state.doc.toString() === value) {
      editor.setState(cached.state);
      editor.dispatch({ effects: c.theme.reconfigure(editorTheme()) });
      editor.scrollDOM.scrollTop = cached.scrollTop;
      editor.scrollDOM.scrollLeft = cached.scrollLeft;
    }
    view.current = editor;
    const observer = new MutationObserver(() =>
      editor.dispatch({ effects: c.theme.reconfigure(editorTheme()) })
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      states.current.set(documentKey, {
        state: editor.state,
        scrollTop: editor.scrollDOM.scrollTop,
        scrollLeft: editor.scrollDOM.scrollLeft,
      });
      observer.disconnect();
      view.current = null;
      editor.destroy();
    };
  }, [documentKey]);
  useEffect(() => {
    const editor = view.current;
    if (editor && value !== editor.state.doc.toString()) {
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: value },
        selection: {
          anchor: Math.min(editor.state.selection.main.head, value.length),
        },
      });
    }
  }, [value]);
  useEffect(() => {
    view.current?.dispatch({
      effects: compartments.current.language.reconfigure(
        language === "json"
          ? json()
          : javascript({ typescript: language === "typescript" }),
      ),
    });
  }, [language, documentKey]);
  useEffect(() => {
    view.current?.dispatch({
      effects: compartments.current.readOnly.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
        EditorView.contentAttributes.of({ "aria-readonly": String(readOnly) }),
      ]),
    });
  }, [readOnly, documentKey]);
  useEffect(() => {
    const e = view.current;
    if (e && location) {
      const line = e.state.doc.line(
        Math.max(1, Math.min(location.line, e.state.doc.lines)),
      );
      const anchor = Math.min(
        line.to,
        line.from + Math.max(0, location.column - 1),
      );
      e.dispatch({
        selection: { anchor },
        effects: EditorView.scrollIntoView(anchor, { y: "center" }),
      });
      e.focus();
    }
  }, [location, documentKey]);
  return (
    <div
      className="source-code-editor"
      data-editor="codemirror6"
      ref={parent}
    />
  );
}
