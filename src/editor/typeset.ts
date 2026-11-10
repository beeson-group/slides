// formulas typeset in the chrome of the editor, e.g. in the outline view and in the inspector, as
// the running heads of the deck are typeset by refreshChrome of src/chrome.ts. the TeX of a text is
// kept in its data-tex, since the text of a typeset formula is not its source. a text with the
// focus is not typeset, since its TeX is edited there

export const hasTex = (s: string): boolean => /\\\(|\\\[/.test(s);

// one typesetting at a time, as MathJax asks of a page
let queue: Promise<unknown> = Promise.resolve();

export function typeset(nodes: Element[]): Promise<unknown> {
  const mj = window.MathJax;
  if (!nodes.length || !mj?.typesetPromise) return Promise.resolve();
  queue = queue
    .then(() => mj.startup?.promise)
    .then(() => {
      const live = nodes.filter((n) => n.isConnected && !n.contains(document.activeElement));
      return live.length ? mj.typesetPromise(live) : null;
    })
    .catch(() => null);
  return queue;
}

// the formulas of nodes taken out of the list of MathJax, before the nodes are dropped
export function untypeset(nodes: Element[]): void {
  const typeset = nodes.filter((n) => n.querySelector('mjx-container'));
  if (typeset.length) window.MathJax?.typesetClear?.(typeset);
}

// el set to the plain text, typeset where it has TeX
export function showText(el: HTMLElement, text: string): void {
  if (el.dataset.tex === text && (el.textContent === text || el.querySelector('mjx-container'))) return;
  untypeset([el]);
  el.textContent = text;
  if (hasTex(text)) {
    el.dataset.tex = text;
    void typeset([el]);
  } else delete el.dataset.tex;
}
