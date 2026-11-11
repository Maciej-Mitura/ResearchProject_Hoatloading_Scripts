# Deployed CodeMirror verification
Active Workbench editor: CodeMirror 6

Workbench -> ScriptEditor -> CodeEditor -> EditorView/EditorState. Active deployed bundle /assets/index-AgzVD9CN.js. Production web container rebuilt/recreated. editor-after.json records one .cm-editor, DIV.cm-content#source-editor, zero source textareas, one line gutter and distinct TypeScript keyword/type/number colors. The old source textarea path was removed. editor-packages.json records the official pinned dependencies.

Actual browser keyboard checks: Ctrl+F opened editor search and found two matches; Ctrl+Z undid and Ctrl+Y restored source; Enter indented two spaces; two matching bracket decorations appeared. Current-line highlighting and gutters are visible in codemirror-search.png. Search layout is a compact 69.25px panel. Light/dark backgrounds measured rgb(238,242,248) and rgb(17,27,43). No reload was required for theme change.

long-source-browser.json records 806 lines, scrollHeight 17311px, clientHeight 440px, scrollTop 16857px and final line visible. Switching scripts and back preserved the dirty draft and disabled Run. The synthetic long draft was then restored to the saved source without saving it. A was created in the real editor, edited, saved as version 2 and run under No permissions. Existing integration tests cover Assistant insertion, Save and version/script switching using actual EditorView transactions.

Mac Cmd bindings use CodeMirror's platform keymaps; physical macOS input was not tested. This is syntax highlighting, not an LSP/type-error service. Drafts persist across in-app navigation, not browser reload.
