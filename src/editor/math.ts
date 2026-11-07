// the formulas of the page, read from MathJax: the TeX of each mjx-container with its delimiters,
// and the typesetting of a host again after a formula in it was changed

export type MathInfo = { tex: string; open: string; close: string; display: boolean };
export type MathLookup = (el: Element) => MathInfo | null;

type MathItem = { math: string; display: boolean; start: { delim?: string }; end: { delim?: string }; typesetRoot?: Element };
type MathJaxApi = {
  startup: { promise: Promise<unknown>; document: { getMathItemsWithin(nodes: Element[]): MathItem[] } };
  typesetClear(nodes: Element[]): void;
  typesetPromise(nodes: Element[]): Promise<unknown>;
  tex2svgPromise?(tex: string, options?: { display?: boolean }): Promise<Element>;
};

declare global {
  interface Window {
    MathJax?: MathJaxApi;
  }
}

const mathjax = (): MathJaxApi | null => (window.MathJax?.startup?.document ? window.MathJax : null);

// the lookup is built when it is needed, since the items of a host are replaced when it is typeset
// again
export function mathLookup(): MathLookup {
  const map = new Map<Element, MathInfo>();
  const mj = mathjax();
  if (mj) {
    for (const item of mj.startup.document.getMathItemsWithin([document.body])) {
      if (!item.typesetRoot) continue;
      map.set(item.typesetRoot, { tex: item.math, display: item.display, open: item.start.delim ?? '', close: item.end.delim ?? '' });
    }
  }
  return (el) => map.get(el) ?? null;
}

// typesets tex on its own, and gives the rendering and the error of MathJax, e.g. a missing brace.
// the rendering is empty where MathJax is not loaded, and the error is then empty as well. a blank
// tex is an error, since it would leave a formula without a width on the slide
export async function previewTex(tex: string, display: boolean): Promise<{ node: Element | null; error: string | null }> {
  if (!tex.trim()) return { node: null, error: 'The formula is empty' };
  const mj = mathjax();
  if (!mj?.tex2svgPromise) return { node: null, error: null };
  const node = await mj.tex2svgPromise(tex, { display });
  // the error is an attribute of a group of the SVG, and an mjx-merror element in the CHTML output
  const merror = node.querySelector('[data-mjx-error], mjx-merror');
  const error = merror ? (merror.getAttribute('data-mjx-error') ?? merror.textContent ?? 'TeX error') : null;
  return { node, error };
}

// writes each formula of host back as text, with the TeX of container replaced by tex, and
// typesets host again. the result is false when MathJax does not find the formula again, e.g. with
// a brace left open in tex, since the closing delimiter is then inside the brace. the former TeX
// is then put back and typeset, so that the slide is kept as it was
export async function retypeset(host: Element, container: Element, tex: string): Promise<boolean> {
  const mj = mathjax();
  if (!mj) return false;
  const lookup = mathLookup();
  const former = lookup(container);
  const count = host.querySelectorAll('mjx-container').length;
  const typeset = async (replacement: string) => {
    for (const c of [...host.querySelectorAll('mjx-container')]) {
      const info = lookup(c);
      if (!info) continue;
      c.replaceWith(document.createTextNode(info.open + (c === container ? replacement : info.tex) + info.close));
    }
    // adjacent text nodes are merged, so that a formula is found in one node
    host.normalize();
    mj.typesetClear([host]);
    await mj.typesetPromise([host]);
    return host.querySelectorAll('mjx-container').length === count;
  };
  if (await typeset(tex)) return true;
  if (former) {
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    const source = former.open + tex + former.close;
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.nodeValue?.includes(source)) continue;
      text.nodeValue = text.nodeValue.replace(source, former.open + former.tex + former.close);
      break;
    }
    mj.typesetClear([host]);
    await mj.typesetPromise([host]);
  }
  return false;
}

export const mathReady = (): Promise<unknown> => window.MathJax?.startup?.promise ?? Promise.resolve();

// the content of host as HTML with each formula as its TeX between its delimiters, i.e. as the
// file has it, and host set to such a content and typeset again. the pair is used by the history
// to put a block back, since the formulas of a block cannot be restored from its HTML
export function contentWithTex(host: Element): string {
  const copy = host.cloneNode(true) as Element;
  const lookup = mathLookup();
  const live = [...host.querySelectorAll('mjx-container')];
  const copies = [...copy.querySelectorAll('mjx-container')];
  copies.forEach((c, i) => {
    const info = lookup(live[i]);
    c.replaceWith(document.createTextNode(info ? info.open + info.tex + info.close : c.textContent ?? ''));
  });
  copy.normalize();
  return copy.innerHTML;
}

export async function setContentWithTex(host: Element, content: string): Promise<void> {
  const mj = mathjax();
  if (mj) mj.typesetClear([host]);
  host.innerHTML = content;
  if (mj) await mj.typesetPromise([host]);
}
