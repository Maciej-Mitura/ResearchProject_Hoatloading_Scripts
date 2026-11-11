import { act } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
export function editorView(element: HTMLElement): EditorView {
  const view = EditorView.findFromDOM(element);
  if (!view) throw new Error("Expected the mounted CodeMirror 6 editor");
  return view;
}
export function editSource(element: HTMLElement, source: string) {
  const view = editorView(element);
  act(() =>
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: source },
    })
  );
}
export function sourceValue(element: HTMLElement) {
  return editorView(element).state.doc.toString();
}
