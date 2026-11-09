/*! editor.js 0.9.0-beta.1, the in-place editor of the beeson theme. MIT license. */
"use strict";
(() => {
  // src/editor/tokens.ts
  var RAW_TEXT = /* @__PURE__ */ new Set(["script", "style", "xmp", "iframe", "noembed", "noframes"]);
  var RCDATA = /* @__PURE__ */ new Set(["textarea", "title"]);
  var isLetter = (c) => /^[A-Za-z]$/.test(c);
  var isSpace = (c) => c === " " || c === "	" || c === "\n" || c === "\r" || c === "\f";
  var opensMarkup = (c) => /^[A-Za-z!/?]$/.test(c);
  function tokenize(html) {
    const out = [];
    const lower = html.toLowerCase();
    const n = html.length;
    let i = 0;
    let rawFor = null;
    const textUntilMarkup = (from) => {
      let j = from;
      while (j < n && !(html[j] === "<" && j + 1 < n && opensMarkup(html[j + 1]))) j++;
      return j;
    };
    while (i < n) {
      if (rawFor) {
        let end = n;
        for (let k = lower.indexOf(`</${rawFor.name}`, i); k >= 0; k = lower.indexOf(`</${rawFor.name}`, k + 1)) {
          const after = html[k + 2 + rawFor.name.length] ?? ">";
          if (isSpace(after) || after === "/" || after === ">") {
            end = k;
            break;
          }
        }
        if (end > i) out.push({ type: "text", raw: rawFor.raw, start: i, end });
        rawFor = null;
        i = end;
        continue;
      }
      const next = html[i + 1] ?? "";
      if (html[i] !== "<" || !opensMarkup(next)) {
        const end = textUntilMarkup(i + 1);
        out.push({ type: "text", raw: false, start: i, end });
        i = end;
        continue;
      }
      if (html.startsWith("<!--", i)) {
        let end;
        if (html.startsWith(">", i + 4)) end = i + 5;
        else if (html.startsWith("->", i + 4)) end = i + 6;
        else {
          const k = html.indexOf("-->", i + 4);
          end = k < 0 ? n : k + 3;
        }
        out.push({ type: "comment", start: i, end });
        i = end;
      } else if (next === "!" || next === "?" || next === "/" && !isLetter(html[i + 2] ?? "")) {
        const k = html.indexOf(">", i);
        const end = k < 0 ? n : k + 1;
        out.push({ type: "other", start: i, end });
        i = end;
      } else if (next === "/") {
        let j = i + 2;
        while (j < n && !isSpace(html[j]) && html[j] !== ">" && html[j] !== "/") j++;
        const name = lower.slice(i + 2, j);
        const k = html.indexOf(">", j);
        const end = k < 0 ? n : k + 1;
        out.push({ type: "end", name, start: i, end });
        i = end;
      } else {
        let j = i + 1;
        while (j < n && !isSpace(html[j]) && html[j] !== ">" && html[j] !== "/") j++;
        const name = lower.slice(i + 1, j);
        const attrs = [];
        let selfClosing = false;
        for (; ; ) {
          while (j < n && (isSpace(html[j]) || html[j] === "/")) {
            selfClosing = html[j] === "/" && html[j + 1] === ">";
            j++;
          }
          if (j >= n || html[j] === ">") break;
          const nameStart = j;
          while (j < n && !isSpace(html[j]) && html[j] !== ">" && html[j] !== "/" && html[j] !== "=") j++;
          if (j === nameStart) {
            j++;
            continue;
          }
          const attrName = lower.slice(nameStart, j);
          let k = j;
          while (k < n && isSpace(html[k])) k++;
          if (html[k] !== "=") {
            attrs.push({ name: attrName, value: null, start: nameStart, end: j });
            continue;
          }
          k++;
          while (k < n && isSpace(html[k])) k++;
          const quote2 = html[k];
          if (quote2 === '"' || quote2 === "'") {
            const e = html.indexOf(quote2, k + 1);
            const valueEnd = e < 0 ? n : e;
            attrs.push({ name: attrName, value: html.slice(k + 1, valueEnd), start: nameStart, end: Math.min(valueEnd + 1, n) });
            j = Math.min(valueEnd + 1, n);
          } else {
            let e = k;
            while (e < n && !isSpace(html[e]) && html[e] !== ">") e++;
            attrs.push({ name: attrName, value: html.slice(k, e), start: nameStart, end: e });
            j = e;
          }
        }
        const end = Math.min(j + 1, n);
        out.push({ type: "start", name, attrs, selfClosing, start: i, end });
        i = end;
        if (RAW_TEXT.has(name)) rawFor = { name, raw: true };
        else if (RCDATA.has(name)) rawFor = { name, raw: false };
      }
    }
    return out;
  }
  function classesOf(token) {
    if (token.type !== "start") return [];
    const value = token.attrs.find((a) => a.name === "class")?.value ?? "";
    return value.split(/\s+/).filter(Boolean);
  }

  // src/editor/source.ts
  var VOID = /* @__PURE__ */ new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  var PRE_LIKE = /* @__PURE__ */ new Set(["pre", "textarea", "listing"]);
  var box = null;
  function decode(raw) {
    box ?? (box = document.createElement("textarea"));
    box.innerHTML = `.${raw}`;
    return box.value.slice(1);
  }
  var short = (s) => (s.length > 40 ? `${s.slice(0, 40)}\u2026` : s).replace(/\n/g, "\\n");
  function parseSource(text) {
    const tokens = tokenize(text);
    const doc = new DOMParser().parseFromString(text, "text/html");
    const slides2 = doc.querySelector(".reveal .slides") ?? doc.querySelector(".slides");
    if (!slides2) throw new Error("the file does not have a div.slides element");
    const index = [...doc.querySelectorAll(`${slides2.localName}.slides`)].indexOf(slides2);
    let seen = -1, at = -1;
    tokens.forEach((t, i) => {
      if (t.type === "start" && t.name === slides2.localName && classesOf(t).includes("slides")) {
        seen += 1;
        if (seen === index) at = i;
      }
    });
    if (at < 0) throw new Error("the start tag of div.slides was not found in the file");
    const root = { kind: "element", node: slides2, tag: slides2.localName, open: tokens[at], attrs: [], close: null, children: [] };
    const cursor = { i: at + 1 };
    walkChildren(slides2, root, cursor, tokens, text);
    const end = tokens[cursor.i];
    if (end?.type === "end" && end.name === root.tag) root.close = end;
    return { text, crlf: text.includes("\r\n"), doc, slides: root };
  }
  function fail(text, at, what) {
    const line = text.slice(0, at).split("\n").length;
    throw new Error(`the file could not be matched to the page at line ${line}: ${what}`);
  }
  function walkChildren(el, out, cursor, tokens, text) {
    const raw = RAW_TEXT.has(el.localName);
    for (const child of el.childNodes) {
      while (tokens[cursor.i]?.type === "other" && child.nodeType !== Node.COMMENT_NODE) cursor.i += 1;
      const token = tokens[cursor.i];
      if (child.nodeType === Node.ELEMENT_NODE) {
        const e = child;
        const tag = e.localName;
        let open2 = null;
        let attrs = [];
        if (token?.type === "start" && token.name === tag.toLowerCase()) {
          open2 = token;
          attrs = token.attrs;
          cursor.i += 1;
        }
        const node = { kind: "element", node: e, tag, open: open2, attrs, close: null, children: [] };
        out.children.push(node);
        walkChildren(e, node, cursor, tokens, text);
        const after = tokens[cursor.i];
        if (after?.type === "end" && after.name === tag.toLowerCase()) {
          node.close = after;
          cursor.i += 1;
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        const data = child.data;
        if (token?.type !== "text") fail(text, token?.start ?? text.length, `the text "${short(data)}" is not in the file`);
        const rawText = text.slice(token.start, token.end);
        const decoded = raw || token.raw ? rawText.replace(/\r\n?/g, "\n") : decode(rawText);
        let lead = 0;
        if (decoded !== data) {
          const stripped = PRE_LIKE.has(el.localName) && decoded.startsWith("\n") && decoded.slice(1) === data;
          if (!stripped) fail(text, token.start, `the text "${short(data)}" reads "${short(decoded)}" in the file`);
          lead = rawText.startsWith("\r\n") ? 2 : 1;
        }
        cursor.i += 1;
        const start = token.start + lead;
        out.children.push({
          kind: "text",
          node: child,
          range: { start: token.start, end: token.end },
          lead,
          decoded: data,
          segments: segmentsOf(text.slice(start, token.end), start, raw || token.raw, data),
          pieces: null
        });
      } else if (child.nodeType === Node.COMMENT_NODE) {
        if (token?.type !== "comment" && token?.type !== "other") fail(text, token?.start ?? text.length, "a comment is not in the file");
        cursor.i += 1;
        out.children.push({ kind: "comment", node: child, range: token });
      }
    }
  }
  var REFERENCE = /&(?:#[xX][0-9a-fA-F]+;?|#[0-9]+;?|[A-Za-z][A-Za-z0-9]*;?)/y;
  function segmentsOf(raw, base, isRaw, decoded) {
    const out = [];
    const whole = [{ raw: { start: base, end: base + raw.length }, dec: { start: 0, end: decoded.length }, literal: false }];
    let i = 0, d = 0, literalStart = -1;
    const parts = [];
    const flush = (to) => {
      if (literalStart >= 0 && to > literalStart) {
        out.push({ raw: { start: base + literalStart, end: base + to }, dec: { start: d, end: d + to - literalStart }, literal: true });
        parts.push(raw.slice(literalStart, to));
        d += to - literalStart;
      }
      literalStart = -1;
    };
    while (i < raw.length) {
      const c = raw[i];
      if (c === "\r") {
        flush(i);
        const length = raw[i + 1] === "\n" ? 2 : 1;
        out.push({ raw: { start: base + i, end: base + i + length }, dec: { start: d, end: d + 1 }, literal: false });
        parts.push("\n");
        d += 1;
        i += length;
        continue;
      }
      if (c === "&" && !isRaw) {
        REFERENCE.lastIndex = i;
        const m = REFERENCE.exec(raw);
        const value = m ? decode(m[0]) : null;
        if (m && value !== null && value !== m[0]) {
          flush(i);
          out.push({ raw: { start: base + i, end: base + i + m[0].length }, dec: { start: d, end: d + value.length }, literal: false });
          parts.push(value);
          d += value.length;
          i += m[0].length;
          continue;
        }
      }
      if (literalStart < 0) literalStart = i;
      i += 1;
    }
    flush(i);
    return parts.join("") === decoded ? out : whole;
  }
  function rawRange(s, dec) {
    const at = (pos, isEnd) => {
      for (const seg of s.segments) {
        if (pos < seg.dec.start || pos > seg.dec.end) continue;
        if (seg.literal) return seg.raw.start + (pos - seg.dec.start);
        if (pos === seg.dec.start) return seg.raw.start;
        if (pos === seg.dec.end) return seg.raw.end;
        return isEnd ? seg.raw.end : seg.raw.start;
      }
      return pos <= 0 ? s.range.start + s.lead : s.range.end;
    };
    return { start: at(dec.start, false), end: at(dec.end, true) };
  }

  // src/editor/tags.ts
  var isSpace2 = (c) => c === " " || c === "	" || c === "\n" || c === "\r" || c === "\f";
  var quote = (value) => `"${value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`;
  var decode2 = (value) => (value ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  var attr = (attrs, name) => attrs.find((a) => a.name === name) ?? null;
  var px = (n) => `${Math.round(n)}px`;
  var classesIn = (attrs) => decode2(attr(attrs, "class")?.value ?? null).split(/\s+/).filter(Boolean);
  function stepIn(attrs) {
    const value = attr(attrs, "data-fragment-index")?.value;
    const index = value === void 0 || value === null || !/^\s*-?\d+\s*$/.test(value) ? null : Number(value);
    return { fragment: classesIn(attrs).includes("fragment"), index };
  }
  function translateIn(style) {
    const m = (style ?? "").match(/(?:^|;)\s*translate\s*:\s*(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?\s*(?:;|$)/);
    return m ? { x: Number(m[1]), y: Number(m[2] ?? 0) } : null;
  }
  function values(attrs, edit) {
    const out = /* @__PURE__ */ new Map();
    if (edit.fragment !== void 0) {
      const classes = classesIn(attrs);
      const has = classes.includes("fragment");
      if (edit.fragment && !has) out.set("class", [...classes, "fragment"].join(" "));
      if (!edit.fragment && has) {
        const rest = classes.filter((c) => c !== "fragment");
        out.set("class", rest.length ? rest.join(" ") : null);
      }
    }
    if (edit.index !== void 0) {
      const current2 = stepIn(attrs).index;
      if (edit.index !== current2) out.set("data-fragment-index", edit.index === null ? null : String(edit.index));
    }
    if (edit.translate !== void 0) {
      const style = decode2(attr(attrs, "style")?.value ?? null);
      const current2 = translateIn(style);
      const same = current2 === edit.translate || !!current2 && !!edit.translate && px(current2.x) === px(edit.translate.x) && px(current2.y) === px(edit.translate.y);
      if (!same) {
        const rest = style.split(";").map((d) => d.trim()).filter((d) => d && !/^translate\s*:/.test(d));
        if (edit.translate) rest.push(`translate: ${px(edit.translate.x)} ${px(edit.translate.y)}`);
        out.set("style", rest.length ? rest.join("; ") : null);
      }
    }
    return out;
  }
  function renderTag(text, range, attrs, edit) {
    const changes = values(attrs, edit);
    if (!changes.size) return null;
    const ops = [];
    const added = [];
    for (const [name, value] of changes) {
      const a = attr(attrs, name);
      if (a && value === null) {
        let start = a.start;
        while (start > range.start && isSpace2(text[start - 1])) start--;
        ops.push({ start, end: a.end, text: "" });
      } else if (a) {
        ops.push({ start: a.start, end: a.end, text: `${name}=${quote(value)}` });
      } else if (value !== null) added.push(` ${name}=${quote(value)}`);
    }
    if (added.length) {
      let at = range.end - 1;
      if (text[at - 1] === "/") at--;
      while (at > range.start && isSpace2(text[at - 1])) at--;
      ops.push({ start: at, end: at, text: added.join("") });
    }
    ops.sort((a, b) => b.start - a.start);
    let tag = text.slice(range.start, range.end);
    for (const op of ops) tag = tag.slice(0, op.start - range.start) + op.text + tag.slice(op.end - range.start);
    return tag === text.slice(range.start, range.end) ? null : tag;
  }

  // src/editor/render.ts
  function virtualChildren(el, math) {
    const items = [];
    let pending = null;
    const flush = () => {
      if (!pending) return;
      const text = pending.map((p) => p.kind === "text" ? p.text : p.open + p.tex + p.close).join("");
      if (text !== "") items.push({ kind: "text", text, pieces: pending });
      pending = null;
    };
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        (pending ?? (pending = [])).push({ kind: "text", text: node.data, node });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const e = node;
        const info = e.localName === "mjx-container" ? math(e) : null;
        if (info) (pending ?? (pending = [])).push({ kind: "math", node: e, ...info });
        else {
          flush();
          items.push({ kind: "element", el: e });
        }
      } else if (node.nodeType === Node.COMMENT_NODE) {
        flush();
        items.push({ kind: "comment", node });
      }
    }
    flush();
    return items;
  }
  var BLOCK_TAGS = /* @__PURE__ */ new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "td", "th", "dt", "dd", "figcaption", "caption", "blockquote", "pre", "aside", "summary", "label"]);
  var INLINE_TAGS = /* @__PURE__ */ new Set(["a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "dfn", "em", "i", "img", "kbd", "mark", "q", "s", "samp", "small", "span", "strong", "sub", "sup", "time", "u", "var", "wbr"]);
  function isBlock(s) {
    if (BLOCK_TAGS.has(s.tag)) return true;
    if (s.tag !== "div" && s.tag !== "span") return false;
    const own = s.children.some((c) => c.kind === "text" && /\S/.test(c.decoded));
    return own && s.children.every((c) => c.kind !== "element" || INLINE_TAGS.has(c.tag));
  }
  var sameTag = (el, s) => el.localName.toLowerCase() === s.tag.toLowerCase();
  var shown = (live, src) => src.includes("\xA0") ? live : live.replace(/\u00a0/g, " ");
  var short2 = (s) => (s.length > 40 ? `${s.slice(0, 40)}\u2026` : s).replace(/\n/g, "\\n");
  function pair(source2, liveSlides, math) {
    const out = { blocks: [], byLive: /* @__PURE__ */ new Map(), elements: /* @__PURE__ */ new Map(), sections: [], problems: [] };
    pairChildren(source2.slides, liveSlides, null, math, out);
    return out;
  }
  function blocksWithin(s) {
    if (isBlock(s)) return [s];
    return s.children.flatMap((c) => c.kind === "element" ? blocksWithin(c) : []);
  }
  function pairChildren(src, live, slide, math, out) {
    const items = virtualChildren(live, math);
    let j = 0;
    for (const s of src.children) {
      if (s.kind !== "element") continue;
      let k = j;
      while (k < items.length && !(items[k].kind === "element" && sameTag(items[k].el, s))) k++;
      if (k === items.length) {
        for (const b of blocksWithin(s)) out.problems.push({ slide, tag: b.tag, reason: "it is not on the page" });
        continue;
      }
      const el = items[k].el;
      j = k + 1;
      out.elements.set(el, s);
      const here = s.tag === "section" ? el : slide;
      if (s.tag === "section") out.sections.push({ src: s, live: el });
      if (isBlock(s)) {
        const reason = verify(s, el, math);
        if (reason) out.problems.push({ slide: here, tag: s.tag, reason });
        else {
          const block = { src: s, live: el, slide: here };
          out.blocks.push(block);
          out.byLive.set(el, block);
        }
      } else pairChildren(s, el, here, math, out);
    }
  }
  function verify(s, el, math) {
    const items = virtualChildren(el, math);
    const kids = s.children;
    if (items.length !== kids.length) return `the ${s.tag} has ${kids.length} parts in the file and ${items.length} on the page`;
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i], it = items[i];
      if (k.kind === "element") {
        if (it.kind !== "element" || !sameTag(it.el, k)) return `a ${k.tag} of the file is not on the page`;
        const reason = verify(k, it.el, math);
        if (reason) return reason;
      } else if (k.kind === "text") {
        if (it.kind !== "text") return `the text "${short2(k.decoded)}" is not on the page`;
        if (shown(it.text, k.decoded) !== k.decoded) return `the text "${short2(k.decoded)}" reads "${short2(it.text)}" on the page`;
        k.pieces = piecesOf(it.pieces);
      } else if (it.kind !== "comment") return "a comment of the file is not on the page";
    }
    return null;
  }
  function piecesOf(live) {
    let d = 0;
    return live.map((p) => {
      if (p.kind === "text") {
        const piece2 = { kind: "text", dec: { start: d, end: d + p.text.length } };
        d += p.text.length;
        return piece2;
      }
      const length = p.open.length + p.tex.length + p.close.length;
      const piece = { kind: "math", dec: { start: d, end: d + length }, inner: { start: d + p.open.length, end: d + p.open.length + p.tex.length } };
      d += length;
      return piece;
    });
  }
  function lastEnd(s) {
    const last = s.children[s.children.length - 1];
    if (!last) return s.open?.end ?? -1;
    if (last.kind === "element") return last.close ? last.close.end : lastEnd(last);
    return last.range.end;
  }
  function innerRange(s) {
    if (!s.open) return null;
    const start = s.open.end;
    const end = s.close ? s.close.start : Math.max(start, lastEnd(s));
    return { start, end };
  }
  function escape(source2, text, keepNbsp) {
    let s = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    s = keepNbsp ? s.replace(/ /g, "&nbsp;") : s.replace(/ /g, " ");
    return source2.crlf ? s.replace(/\n/g, "\r\n") : s;
  }
  function serializeNew(source2, el, math) {
    const tag = el.localName;
    const attrs = [...el.attributes].map((a) => a.value === "" ? ` ${a.name}` : ` ${a.name}="${a.value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`).join("");
    if (VOID.has(tag)) return `<${tag}${attrs}>`;
    return `<${tag}${attrs}>${serializeNewChildren(source2, el, math)}</${tag}>`;
  }
  function serializeNewChildren(source2, el, math) {
    return virtualChildren(el, math).map((it) => it.kind === "text" ? escape(source2, it.text, false) : it.kind === "element" ? serializeNew(source2, it.el, math) : `<!--${it.node.data}-->`).join("");
  }
  function serializeText(source2, s, it) {
    const text = source2.text;
    if (shown(it.text, s.decoded) === s.decoded) return text.slice(s.range.start, s.range.end);
    const keepNbsp = s.decoded.includes("\xA0");
    const lead = text.slice(s.range.start, s.range.start + s.lead);
    const live = it.pieces;
    if (s.pieces && s.pieces.length === live.length && s.pieces.every((p, i) => p.kind === live[i].kind)) {
      const parts = s.pieces.map((p, i) => {
        const lp = live[i];
        const r = rawRange(s, p.dec);
        if (p.kind === "text" || lp.kind !== "math") {
          const old2 = s.decoded.slice(p.dec.start, p.dec.end);
          const now = lp.kind === "text" ? lp.text : lp.open + lp.tex + lp.close;
          return shown(now, old2) === old2 ? text.slice(r.start, r.end) : escape(source2, now, keepNbsp);
        }
        const inner = rawRange(s, p.inner);
        const old = s.decoded.slice(p.inner.start, p.inner.end);
        const tex = shown(lp.tex, old) === old ? text.slice(inner.start, inner.end) : escape(source2, lp.tex, keepNbsp);
        return text.slice(r.start, inner.start) + tex + text.slice(inner.end, r.end);
      });
      return lead + parts.join("");
    }
    return lead + escape(source2, it.text, keepNbsp);
  }
  function serializeChildren(source2, s, el, math) {
    const text = source2.text;
    const items = virtualChildren(el, math);
    const kids = s.children;
    let c = 0;
    const parts = [];
    for (const it of items) {
      if (it.kind === "element") {
        let k2 = c;
        while (k2 < kids.length && !(kids[k2].kind === "element" && sameTag(it.el, kids[k2]))) k2++;
        if (k2 < kids.length) {
          c = k2 + 1;
          parts.push(serializeElement(source2, kids[k2], it.el, math));
        } else parts.push(serializeNew(source2, it.el, math));
        continue;
      }
      let k = c;
      while (k < kids.length && kids[k].kind !== it.kind && kids[k].kind !== "element") k++;
      const hit = k < kids.length && kids[k].kind === it.kind ? kids[k] : null;
      if (hit) c = k + 1;
      if (it.kind === "text") parts.push(hit ? serializeText(source2, hit, it) : escape(source2, it.text, false));
      else parts.push(hit ? text.slice(hit.range.start, hit.range.end) : `<!--${it.node.data}-->`);
    }
    return parts.join("");
  }
  function serializeElement(source2, s, el, math) {
    const text = source2.text;
    const open2 = s.open ? text.slice(s.open.start, s.open.end) : "";
    const close = s.close ? text.slice(s.close.start, s.close.end) : "";
    if (VOID.has(s.tag)) return open2;
    if (RAW_TEXT.has(s.tag)) {
      const inner = innerRange(s);
      return open2 + (inner ? text.slice(inner.start, inner.end) : "") + close;
    }
    return open2 + serializeChildren(source2, s, el, math) + close;
  }
  function renderBlock(source2, block, math) {
    return serializeChildren(source2, block.src, block.live, math);
  }
  function deletionRange(text, s) {
    if (!s.open) return null;
    let start = s.open.start;
    let end = s.close ? s.close.end : lastEnd(s);
    let a = start;
    while (a > 0 && (text[a - 1] === " " || text[a - 1] === "	")) a--;
    let b = end;
    while (b < text.length && (text[b] === " " || text[b] === "	")) b++;
    const lineStart = a === 0 || text[a - 1] === "\n";
    const lineEnd = b === text.length || text[b] === "\n" || text.startsWith("\r\n", b);
    if (lineStart && lineEnd) {
      start = a;
      end = b === text.length ? b : text[b] === "\n" ? b + 1 : b + 2;
    }
    return { start, end };
  }
  function renderDeck(source2, pairing2, math, tags = /* @__PURE__ */ new Map()) {
    const edits = [];
    const changed = [];
    const warnings = [];
    for (const [el, edit] of tags) {
      const s = pairing2.elements.get(el);
      if (!s?.open || !el.isConnected) continue;
      const tag = renderTag(source2.text, s.open, s.attrs, edit);
      if (tag !== null) edits.push({ start: s.open.start, end: s.open.end, text: tag });
    }
    for (const b of pairing2.blocks) {
      const range = innerRange(b.src);
      if (!range) continue;
      if (!b.live.isConnected) {
        const d = deletionRange(source2.text, b.src);
        if (d) {
          edits.push({ ...d, text: "" });
          changed.push(b);
        }
        continue;
      }
      const inner = renderBlock(source2, b, math);
      if (inner !== source2.text.slice(range.start, range.end)) {
        edits.push({ start: range.start, end: range.end, text: inner });
        changed.push(b);
      }
    }
    for (const { src, live } of pairing2.sections) {
      for (const aside of live.querySelectorAll(":scope > aside.notes")) {
        if (pairing2.byLive.has(aside)) continue;
        const inner = serializeNewChildren(source2, aside, math);
        if (!inner.trim()) continue;
        if (!src.close) {
          warnings.push("the notes of a slide without an end tag are not saved");
          continue;
        }
        const eol = source2.crlf ? "\r\n" : "\n";
        edits.push({ start: src.close.start, end: src.close.start, text: `  <aside class="notes">${inner}</aside>${eol}` });
      }
    }
    edits.sort((a, b) => b.start - a.start || b.end - a.end);
    for (let i = 1; i < edits.length; i++) {
      if (edits[i].end > edits[i - 1].start) throw new Error("two edits overlap in the file");
    }
    let text = source2.text;
    for (const e of edits) text = text.slice(0, e.start) + e.text + text.slice(e.end);
    return { text, edits, changed, warnings };
  }

  // src/editor/math.ts
  var mathjax = () => window.MathJax?.startup?.document ? window.MathJax : null;
  function mathLookup() {
    const map = /* @__PURE__ */ new Map();
    const mj = mathjax();
    if (mj) {
      for (const item of mj.startup.document.getMathItemsWithin([document.body])) {
        if (!item.typesetRoot) continue;
        map.set(item.typesetRoot, { tex: item.math, display: item.display, open: item.start.delim ?? "", close: item.end.delim ?? "" });
      }
    }
    return (el) => map.get(el) ?? null;
  }
  async function previewTex(tex, display) {
    if (!tex.trim()) return { node: null, error: "The formula is empty" };
    const mj = mathjax();
    if (!mj?.tex2svgPromise) return { node: null, error: null };
    const node = await mj.tex2svgPromise(tex, { display });
    const merror = node.querySelector("[data-mjx-error], mjx-merror");
    const error = merror ? merror.getAttribute("data-mjx-error") ?? merror.textContent ?? "TeX error" : null;
    return { node, error };
  }
  async function retypeset(host, container, tex) {
    const mj = mathjax();
    if (!mj) return false;
    const lookup = mathLookup();
    const former = lookup(container);
    const count2 = host.querySelectorAll("mjx-container").length;
    const typeset = async (replacement) => {
      for (const c of [...host.querySelectorAll("mjx-container")]) {
        const info = lookup(c);
        if (!info) continue;
        c.replaceWith(document.createTextNode(info.open + (c === container ? replacement : info.tex) + info.close));
      }
      host.normalize();
      mj.typesetClear([host]);
      await mj.typesetPromise([host]);
      return host.querySelectorAll("mjx-container").length === count2;
    };
    if (await typeset(tex)) return true;
    if (former) {
      const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
      const source2 = former.open + tex + former.close;
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        if (!text.nodeValue?.includes(source2)) continue;
        text.nodeValue = text.nodeValue.replace(source2, former.open + former.tex + former.close);
        break;
      }
      mj.typesetClear([host]);
      await mj.typesetPromise([host]);
    }
    return false;
  }
  var mathReady = () => window.MathJax?.startup?.promise ?? Promise.resolve();
  function contentWithTex(host) {
    const copy = host.cloneNode(true);
    const lookup = mathLookup();
    const live = [...host.querySelectorAll("mjx-container")];
    const copies = [...copy.querySelectorAll("mjx-container")];
    copies.forEach((c, i) => {
      const info = lookup(live[i]);
      c.replaceWith(document.createTextNode(info ? info.open + info.tex + info.close : c.textContent ?? ""));
    });
    copy.normalize();
    return copy.innerHTML;
  }
  async function setContentWithTex(host, content) {
    const mj = mathjax();
    if (mj) mj.typesetClear([host]);
    host.innerHTML = content;
    if (mj) await mj.typesetPromise([host]);
  }

  // src/editor/history.ts
  var PAUSE = 1e3;
  var History = class {
    constructor(options) {
      this.done = [];
      this.undone = [];
      // the typing in progress: the block, its content before and after, and the time of the last key
      this.typing = null;
      this.busy = false;
      // the content of each block as it was last seen, for an input that is not announced before it
      // happens, e.g. a replacement from the spelling menu or a script
      this.known = /* @__PURE__ */ new WeakMap();
      this.snapshot = options.snapshot;
      this.restore = options.restore;
      this.onChange = options.onChange;
    }
    get canUndo() {
      return this.done.length > 0;
    }
    get canRedo() {
      return this.undone.length > 0;
    }
    // a change other than typing, already applied
    push(entry) {
      this.typing = null;
      this.done.push(entry);
      this.undone = [];
      this.onChange();
    }
    // called when host is focused or put back, so that its content before the next input is known
    track(host) {
      this.known.set(host, this.snapshot(host));
    }
    // called before an input into host, with the content that the input changes
    beforeTyping(host) {
      if (this.busy) return;
      const now = performance.now();
      if (this.typing && this.typing.host === host && now - this.typing.at < PAUSE) return;
      this.start(host, this.snapshot(host), now);
    }
    start(host, before, at) {
      const state2 = { before, after: before };
      const entry = {
        label: "typing",
        undo: () => this.put(host, state2.before),
        redo: () => this.put(host, state2.after)
      };
      this.typing = { host, state: state2, entry, at };
      this.known.set(host, before);
    }
    async put(host, content) {
      await this.restore(host, content);
      this.known.set(host, content);
    }
    // called after an input into host. the entry is put into the history at the first input, and
    // an input without a call before it starts from the content last seen
    afterTyping(host) {
      if (this.busy) return;
      const now = performance.now();
      if (!this.typing || this.typing.host !== host || now - this.typing.at >= PAUSE) {
        const before = this.known.get(host);
        if (before === void 0) {
          this.known.set(host, this.snapshot(host));
          return;
        }
        this.start(host, before, now);
      }
      const typing = this.typing;
      typing.state.after = this.snapshot(host);
      typing.at = now;
      this.known.set(host, typing.state.after);
      if (typing.state.after === typing.state.before && !this.done.includes(typing.entry)) return;
      if (!this.done.includes(typing.entry)) {
        this.done.push(typing.entry);
        this.undone = [];
      }
      this.onChange();
    }
    // the typing that follows is a new entry, e.g. after the block was left
    break() {
      this.typing = null;
    }
    async undo() {
      const entry = this.done.pop();
      if (!entry || this.busy) return;
      this.typing = null;
      this.busy = true;
      try {
        await entry.undo();
      } finally {
        this.busy = false;
      }
      this.undone.push(entry);
      this.onChange();
    }
    async redo() {
      const entry = this.undone.pop();
      if (!entry || this.busy) return;
      this.typing = null;
      this.busy = true;
      try {
        await entry.redo();
      } finally {
        this.busy = false;
      }
      this.done.push(entry);
      this.onChange();
    }
    clear() {
      this.done = [];
      this.undone = [];
      this.typing = null;
      this.onChange();
    }
  };

  // src/editor/layers.ts
  var OUT = ".fade-out";
  var ONLY = ".current-visible, .fade-in-then-out";
  var OFF = "beeson-off";
  function fragmentsOf(slide) {
    const els = [...slide.querySelectorAll(".fragment")].filter((el) => !el.closest("aside.notes"));
    const given = els.map((el) => parseInt(el.getAttribute("data-fragment-index") ?? "", 10));
    let next = Math.max(0, ...given.filter((i) => !Number.isNaN(i))) + 1;
    const index = given.map((i) => Number.isNaN(i) ? next++ : i);
    const order = [...new Set(index)].sort((a, b) => a - b);
    return els.map((el, i) => ({ el, step: order.indexOf(index[i]) + 1, kind: el.matches(OUT) ? "out" : el.matches(ONLY) ? "only" : "in" }));
  }
  function layersOf(slide) {
    const fragments = fragmentsOf(slide);
    const last = Math.max(0, ...fragments.map((f) => f.step));
    const cuts = /* @__PURE__ */ new Set();
    for (const f of fragments) {
      const at = f.kind === "out" ? f.step : f.kind === "only" ? f.step + 1 : 0;
      if (at > 0 && at <= last) cuts.add(at);
    }
    const starts = [0, ...[...cuts].sort((a, b) => a - b)];
    return starts.map((from, i) => ({ from, to: i + 1 < starts.length ? starts[i + 1] - 1 : last }));
  }
  var shownAt = (f, step) => f.kind === "in" ? f.step <= step : f.kind === "out" ? step < f.step : step === f.step;
  function showLayer(slide, layer) {
    for (const f of fragmentsOf(slide)) {
      const up = f.el.parentElement?.closest(".fragment");
      f.el.classList.toggle(OFF, !!layer && (!shownAt(f, layer.to) || !!up && up.classList.contains(OFF)));
    }
  }
  function label(layer, last) {
    if (layer.from === 0) return layer.to === 0 ? "Before step 1" : `Up to step ${layer.to}`;
    if (last) return `From step ${layer.from}`;
    return layer.from === layer.to ? `Step ${layer.from}` : `Steps ${layer.from}\u2013${layer.to}`;
  }
  var Layers = class {
    constructor(slide, onChange) {
      this.box = document.createElement("span");
      // the layer chosen on each slide, kept while the editor is open
      this.chosen = /* @__PURE__ */ new WeakMap();
      this.key = "";
      this.slide = slide;
      this.onChange = onChange;
      this.box.className = "beeson-layers";
      this.box.setAttribute("role", "group");
      this.box.setAttribute("aria-label", "Layer of the slide");
      this.box.hidden = true;
    }
    // the marks and the switch follow the current slide and its steps
    refresh() {
      const slide = this.slide();
      const layers2 = slide ? layersOf(slide) : [];
      if (!slide || layers2.length < 2) {
        if (slide) showLayer(slide, null);
        this.box.hidden = true;
        this.box.replaceChildren();
        this.key = "";
        return;
      }
      const at = Math.min(this.chosen.get(slide) ?? 0, layers2.length - 1);
      showLayer(slide, layers2[at]);
      const labels = layers2.map((l, i) => label(l, i === layers2.length - 1));
      const key = `${labels.join("|")}#${at}`;
      this.box.hidden = false;
      if (key === this.key) return;
      this.key = key;
      const head = document.createElement("span");
      head.textContent = "Shows";
      this.box.replaceChildren(head, ...labels.map((text, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = text;
        b.title = `Show the slide as it is at step ${layers2[i].to}, without the elements hidden by then and those shown after it`;
        b.setAttribute("aria-pressed", String(i === at));
        b.classList.toggle("on", i === at);
        b.addEventListener("click", (ev) => {
          if (ev.detail > 0) b.blur();
          this.choose(slide, i);
        });
        return b;
      }));
    }
    choose(slide, i) {
      this.chosen.set(slide, i);
      this.refresh();
      this.onChange();
    }
    // the layer in which el is shown is chosen, e.g. for an undo of a change to a hidden element
    reveal(el) {
      const slide = this.slide();
      if (!slide || !slide.contains(el) || !el.closest(`.${OFF}`)) return;
      const layers2 = layersOf(slide);
      for (let i = 0; i < layers2.length; i++) {
        showLayer(slide, layers2[i]);
        if (!el.closest(`.${OFF}`)) {
          this.choose(slide, i);
          return;
        }
      }
      this.refresh();
    }
  };

  // src/editor/nav.ts
  var KEY = "beeson-nav";
  var LAYOUTS = ["title", "section", "closing", "figure", "split"];
  var PEEK_WIDTH = 320;
  var PEEK_DELAY = 300;
  function describe(slide) {
    const heading = [...slide.querySelectorAll("h1, h2, h3, p, .caption")].find((h) => !h.closest("aside.notes, .backdrop") && (h.textContent ?? "").trim());
    const title = (heading?.textContent ?? "").replace(/\s+/g, " ").trim() || "Untitled slide";
    const kind = LAYOUTS.find((c) => slide.classList.contains(c)) ?? "content";
    return { title, kind };
  }
  var Nav = class {
    constructor(ctx) {
      this.pane = document.createElement("div");
      this.button = document.createElement("button");
      this.list = document.createElement("div");
      this.peek = document.createElement("div");
      this.on = true;
      this.key = "";
      this.timer = 0;
      this.ctx = ctx;
      this.pane.className = "beeson-edit-nav";
      this.pane.setAttribute("aria-label", "Slides");
      this.button.textContent = "Slides";
      this.button.title = "Show the list of the slides at the left";
      const head = document.createElement("div");
      head.className = "head";
      head.textContent = "Slides";
      this.list.className = "rows";
      this.list.setAttribute("role", "listbox");
      this.list.setAttribute("aria-label", "Slides");
      this.peek.className = "beeson-edit-peek";
      this.peek.hidden = true;
      this.peek.setAttribute("aria-hidden", "true");
      this.peek.setAttribute("inert", "");
      this.pane.append(head, this.list, this.peek);
      this.button.addEventListener("click", () => this.toggle());
      this.list.addEventListener("keydown", (ev) => this.onKey(ev));
      try {
        this.on = localStorage.getItem(KEY) !== "0";
      } catch {
        this.on = true;
      }
      this.show(this.on);
    }
    get shown() {
      return this.on;
    }
    toggle() {
      this.show(!this.on);
      try {
        localStorage.setItem(KEY, this.on ? "1" : "0");
      } catch {
      }
      this.ctx.layout();
      this.refresh();
    }
    show(on) {
      this.on = on;
      if (!on) this.hidePeek();
      document.documentElement.classList.toggle("beeson-nav", on);
      this.button.classList.toggle("on", on);
      this.button.setAttribute("aria-pressed", String(on));
    }
    // the rows are built again when a title changes, and the current row is marked and kept in view
    refresh() {
      if (!this.on) return;
      const slides2 = this.ctx.slides();
      const rows = slides2.map((s) => describe(s));
      const key = rows.map((r) => `${r.kind}|${r.title}`).join("\n");
      if (key !== this.key) {
        this.key = key;
        this.hidePeek();
        this.list.replaceChildren(...slides2.map((slide, i) => {
          const row = document.createElement("button");
          row.className = "row";
          row.type = "button";
          row.setAttribute("role", "option");
          const num = document.createElement("span");
          num.className = "num";
          num.textContent = String(i + 1);
          const title = document.createElement("span");
          title.className = "title";
          title.textContent = rows[i].title;
          const kind = document.createElement("span");
          kind.className = "kind";
          kind.textContent = rows[i].kind;
          row.append(num, title, kind);
          row.title = `Slide ${i + 1}: ${rows[i].title}`;
          row.addEventListener("click", () => {
            this.hidePeek();
            this.ctx.go(slide);
          });
          row.addEventListener("pointerenter", () => {
            this.hidePeek();
            this.timer = window.setTimeout(() => this.showPeek(slide, row), PEEK_DELAY);
          });
          row.addEventListener("pointerleave", () => this.hidePeek());
          return row;
        }));
      }
      const current2 = this.ctx.current();
      const at = slides2.indexOf(current2);
      [...this.list.children].forEach((row, i) => {
        const here = i === at;
        row.setAttribute("aria-current", here ? "true" : "false");
        row.setAttribute("aria-selected", here ? "true" : "false");
        row.setAttribute("tabindex", here || at < 0 && i === 0 ? "0" : "-1");
        if (here) row.scrollIntoView({ block: "nearest" });
      });
    }
    hidePeek() {
      clearTimeout(this.timer);
      this.peek.hidden = true;
      this.peek.replaceChildren();
    }
    // a clone of the slide, scaled into the preview from its upper left, with every step shown. the
    // canvases of a backdrop are painted from the originals, since a cloned canvas is blank, and a
    // tycho viewer is left out, since its clone would start a second renderer
    showPeek(slide, row) {
      const stage = slide.parentElement;
      const width = stage.offsetWidth || 1920;
      const height = stage.offsetHeight || 1080;
      const clone = slide.cloneNode(true);
      const from = slide.querySelectorAll("canvas");
      clone.querySelectorAll("canvas").forEach((canvas, i) => {
        try {
          canvas.getContext("2d")?.drawImage(from[i], 0, 0);
        } catch {
        }
      });
      clone.querySelectorAll("aside.notes").forEach((n) => n.remove());
      clone.querySelectorAll(".backdrop .lab").forEach((l) => {
        if (!l.style.left) l.remove();
      });
      clone.querySelectorAll("tycho-viewer").forEach((v) => {
        const box2 = document.createElement("div");
        box2.className = v.className;
        box2.setAttribute("style", v.getAttribute("style") ?? "");
        v.replaceWith(box2);
      });
      clone.querySelectorAll("video").forEach((v) => {
        v.removeAttribute("autoplay");
        v.preload = "none";
      });
      for (const el of [clone, ...clone.querySelectorAll("*")]) {
        for (const name of ["id", "contenteditable", "tabindex", "hidden", "aria-hidden"]) el.removeAttribute(name);
        el.classList.remove("beeson-hover", "beeson-overflow", "current-fragment", "past", "future");
        if (el.classList.contains("fragment")) el.classList.add("visible");
      }
      const layers2 = layersOf(clone);
      showLayer(clone, layers2.length > 1 ? layers2[0] : null);
      clone.classList.add("present");
      clone.style.display = "block";
      const deck2 = document.createElement("div");
      deck2.className = "reveal beeson-peek";
      const slides2 = document.createElement("div");
      slides2.className = "slides";
      slides2.style.cssText = `inset: 0 auto auto 0; margin: 0; width: ${width}px; height: ${height}px; transform: scale(${PEEK_WIDTH / width}); transform-origin: 0 0;`;
      slides2.append(clone);
      deck2.append(slides2);
      const peekHeight = PEEK_WIDTH * height / width;
      const top2 = Math.max(52, Math.min(row.getBoundingClientRect().top, innerHeight - 44 - peekHeight));
      this.peek.style.top = `${top2}px`;
      this.peek.style.height = `${peekHeight}px`;
      this.peek.replaceChildren(deck2);
      this.peek.hidden = false;
    }
    // the arrows move to the previous or next slide while a row has the focus, and Home and End to
    // the first and the last
    onKey(ev) {
      const slides2 = this.ctx.slides();
      const at = slides2.indexOf(this.ctx.current());
      const to = { ArrowUp: at - 1, ArrowDown: at + 1, Home: 0, End: slides2.length - 1 };
      const i = to[ev.key];
      if (i === void 0 || i < 0 || i >= slides2.length) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.ctx.go(slides2[i]);
      this.refresh();
      this.list.children[i]?.focus({ preventScroll: true });
    }
  };

  // src/editor/steps.ts
  var CANDIDATES = "h1, h2, h3, p, li, table, pre, blockquote, div.math, figure, .zone, .plate, .qr, tycho-viewer, .caption, .foot, img, video";
  var WITH_SLIDE = "h1, h2, h3, .foot";
  var OUTSIDE = "aside.notes, .backdrop";
  function candidates(slide, pairing2) {
    return [...slide.querySelectorAll(CANDIDATES)].filter((el) => {
      if (!pairing2.elements.get(el)?.open) return false;
      const up = el.parentElement?.closest(`${CANDIDATES}, ${OUTSIDE}, section`);
      return !up || up === slide;
    });
  }
  function stepOf(el, pairing2, edits) {
    const base = stepIn(pairing2.elements.get(el)?.attrs ?? []);
    const e = edits.get(el);
    return { fragment: e?.fragment ?? base.fragment, index: e?.index !== void 0 ? e.index : base.index };
  }
  function groupsOf(els, pairing2, edits) {
    const steps2 = els.map((el) => ({ el, ...stepOf(el, pairing2, edits) })).filter((s) => s.fragment);
    const groups = [];
    let last = null;
    for (const s of steps2.filter((s2) => s2.index !== null).sort((a, b) => a.index - b.index)) {
      if (s.index !== last) {
        groups.push([]);
        last = s.index;
      }
      groups[groups.length - 1].push(s.el);
    }
    for (const s of steps2) if (s.index === null) groups.push([s.el]);
    return groups;
  }
  var KINDS = [["h1, h2, h3", "Heading"], [".foot", "Footnote"], ["li", "Item"], ["p", "Paragraph"], ["div.math", "Formula"], ["table", "Table"], ["pre", "Code"], ["blockquote", "Quotation"], ["video", "Video"], ["tycho-viewer", "Scene"], [".qr", "QR code"], [".caption", "Caption"], ["img, figure, .zone, .plate", "Figure"]];
  function textOf(el, tex) {
    let out = "";
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) out += child.nodeValue ?? "";
      else if (child instanceof Element) out += child.localName === "mjx-container" ? tex(child) ?? "" : textOf(child, tex);
    }
    return out;
  }
  function describe2(el, tex) {
    const kind = KINDS.find(([selector]) => el.matches(selector))?.[1] ?? el.localName;
    const media = el.matches("img, video") ? el : el.querySelector("img, video");
    let text = textOf(el, tex).replace(/\s+/g, " ").trim();
    if (!text && media) text = media.getAttribute("alt") || (media.getAttribute("src") ?? media.querySelector("source")?.getAttribute("src") ?? "").split("/").pop() || "";
    if (!text && el.matches("tycho-viewer")) text = el.getAttribute("src")?.split("/").pop() ?? "";
    return { kind, text: text.length > 60 ? `${text.slice(0, 60)}\u2026` : text };
  }
  var Steps = class {
    constructor(ctx) {
      this.pane = document.createElement("div");
      this.badges = document.createElement("div");
      this.button = document.createElement("button");
      this.list = document.createElement("div");
      this.on = false;
      // what the rows show, so that they are built again only when it changes, since a select that
      // is being opened would be lost
      this.key = "";
      this.ctx = ctx;
      this.pane.className = "beeson-edit-side";
      this.badges.className = "beeson-badges";
      this.button.textContent = "Steps";
      this.button.title = "Show the order in which the elements of the slide appear";
      this.button.setAttribute("aria-pressed", "false");
      const head = document.createElement("div");
      head.className = "head";
      const title = document.createElement("span");
      title.textContent = "Steps";
      const each = document.createElement("button");
      each.textContent = "One by one";
      each.title = "Show every element of the slide in a step of its own, in reading order";
      const none = document.createElement("button");
      none.textContent = "All at once";
      none.title = "Show every element with the slide";
      each.addEventListener("click", () => this.setAll(true));
      none.addEventListener("click", () => this.setAll(false));
      head.append(title, each, none);
      this.list.className = "rows";
      const foot = document.createElement("p");
      foot.className = "foot";
      foot.textContent = "Elements with the same step appear together. A step is a reveal.js fragment in the file.";
      this.pane.append(head, this.list, foot);
      this.button.addEventListener("click", () => this.toggle());
    }
    toggle() {
      this.on = document.documentElement.classList.toggle("beeson-steps");
      this.button.classList.toggle("on", this.on);
      this.button.setAttribute("aria-pressed", String(this.on));
      this.ctx.layout();
      this.refresh();
    }
    get shown() {
      return this.on;
    }
    // the numbers on the slide follow its layout, and the rows are built again when the slide or
    // its steps change
    refresh() {
      this.badges.replaceChildren();
      const pairing2 = this.ctx.pairing();
      const slide = this.ctx.slide();
      if (!this.on || !pairing2 || !slide) {
        this.key = "";
        this.list.replaceChildren();
        return;
      }
      const els = candidates(slide, pairing2);
      const groups = groupsOf(els, pairing2, this.ctx.edits);
      const stepOf2 = (el) => groups.findIndex((g) => g.includes(el));
      for (const el of els) {
        const at = stepOf2(el);
        if (at < 0 || el.closest(`.${OFF}`)) continue;
        const rect = el.getBoundingClientRect();
        const badge = document.createElement("span");
        badge.className = "beeson-badge";
        badge.textContent = String(at + 1);
        badge.style.left = `${rect.left}px`;
        badge.style.top = `${rect.top}px`;
        this.badges.append(badge);
      }
      const described = els.map((el) => describe2(el, this.ctx.tex));
      const rows = els.map((el, i) => `${stepOf2(el)}|${described[i].kind}|${described[i].text}`);
      const key = [pairing2.sections.findIndex((s) => s.live === slide), groups.length, ...rows].join("\n");
      if (key === this.key) return;
      this.key = key;
      this.list.replaceChildren();
      if (!els.length) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "This slide has no element that can be a step.";
        this.list.append(empty);
        return;
      }
      els.forEach((el, i) => {
        const at = stepOf2(el);
        const { kind, text } = described[i];
        const row = document.createElement("div");
        row.className = "row";
        const select = document.createElement("select");
        select.title = "The step at which this element appears";
        select.setAttribute("aria-label", `Step of the ${kind.toLowerCase()}${text ? `: ${text}` : ""}`);
        const option = (value, text2) => {
          const o = document.createElement("option");
          o.value = value;
          o.textContent = text2;
          select.append(o);
        };
        option("", "With slide");
        if (groups.length) option("before", "Step 1, new, before the others");
        groups.forEach((_, g) => option(String(g), `Step ${g + 1}`));
        option(String(groups.length), `Step ${groups.length + 1}, new`);
        select.value = at < 0 ? "" : String(at);
        select.addEventListener("change", () => this.setStep(el, select.value === "" ? null : select.value === "before" ? "before" : Number(select.value)));
        const kindEl = document.createElement("span");
        kindEl.className = "kind";
        kindEl.textContent = kind;
        const textEl = document.createElement("span");
        textEl.className = "text";
        textEl.textContent = text;
        row.append(select, kindEl, textEl);
        row.addEventListener("pointerenter", () => el.classList.add("beeson-hover"));
        row.addEventListener("pointerleave", () => el.classList.remove("beeson-hover"));
        this.list.append(row);
      });
    }
    // moves el to the group at position to, to a new last group with to at the count of the
    // groups, to a new first group with 'before', which shifts the others by one, or out of the
    // steps with null
    setStep(el, to) {
      const pairing2 = this.ctx.pairing();
      const slide = this.ctx.slide();
      if (!pairing2 || !slide) return;
      const els = candidates(slide, pairing2);
      let groups = groupsOf(els, pairing2, this.ctx.edits);
      const target = to === null || to === "before" ? to : to >= groups.length ? "new" : groups[to];
      for (const g of groups) {
        const i = g.indexOf(el);
        if (i >= 0) g.splice(i, 1);
      }
      groups = groups.filter((g) => g.length);
      if (target === "before") groups.unshift([el]);
      else if (target === "new") groups.push([el]);
      else if (target && groups.includes(target)) target.push(el);
      else if (target) groups.push([el]);
      this.write(els, groups, pairing2);
    }
    setAll(each) {
      const pairing2 = this.ctx.pairing();
      const slide = this.ctx.slide();
      if (!pairing2 || !slide) return;
      const els = candidates(slide, pairing2);
      this.write(els, each ? els.filter((el) => !el.matches(WITH_SLIDE)).map((el) => [el]) : [], pairing2);
    }
    // the indices of the slide, numbered from the lowest index in the file, or from 1, are written
    // into the edits and onto the page. an element that is not in a group is shown with the slide,
    // and the change is one entry of the history
    write(els, groups, pairing2) {
      const given = els.map((el) => stepIn(pairing2.elements.get(el)?.attrs ?? []).index).filter((i) => i !== null);
      const base = given.length ? Math.min(1, ...given) : 1;
      const before = els.map((el) => ({ el, step: stepOf(el, pairing2, this.ctx.edits) }));
      const after = els.map((el) => {
        const at = groups.findIndex((g) => g.includes(el));
        return { el, step: at < 0 ? { fragment: false, index: null } : { fragment: true, index: base + at } };
      });
      if (before.every((b, i) => b.step.fragment === after[i].step.fragment && b.step.index === after[i].step.index)) return;
      this.apply(after);
      this.ctx.record({ label: "steps", undo: () => this.apply(before), redo: () => this.apply(after) });
    }
    apply(states) {
      if (states.length) this.ctx.show(states[0].el);
      for (const { el, step } of states) {
        this.ctx.edits.set(el, { ...this.ctx.edits.get(el), ...step });
        el.classList.toggle("fragment", step.fragment);
        el.classList.toggle("visible", step.fragment);
        el.classList.remove("current-fragment");
        if (step.index === null) el.removeAttribute("data-fragment-index");
        else el.setAttribute("data-fragment-index", String(step.index));
      }
      this.ctx.markDirty();
      this.ctx.changed();
    }
  };

  // src/editor/move.ts
  var MOVABLE = "h1, h2, h3, p, ul, ol, dl, table, pre, blockquote, div.math, .caption, .foot, img, video, figure, .zone, .plate, .qr, tycho-viewer";
  var BY_ITSELF = "img, video, figure, .zone, .plate, .qr";
  var OUTSIDE2 = "aside.notes, .backdrop";
  var CLICK = 3;
  var SNAP = 8;
  var PAUSE2 = 1e3;
  var translateOf = (el) => {
    const parts = (el.style.translate ?? "").split(/\s+/).map((p) => parseFloat(p));
    return { x: Number.isFinite(parts[0]) ? parts[0] : 0, y: Number.isFinite(parts[1]) ? parts[1] : 0 };
  };
  var Move = class {
    constructor(ctx) {
      // the dashed frame and the handle of the element under the pointer or being edited, and the
      // solid frame of the selected element
      this.frame = document.createElement("div");
      this.handle = document.createElement("div");
      this.selectedFrame = document.createElement("div");
      // the guide lines at the edges that a dragged element snaps to
      this.guideV = document.createElement("div");
      this.guideH = document.createElement("div");
      // the offset of the element being dragged or nudged, at the lower right of its frame
      this.offset = document.createElement("div");
      this.hover = null;
      this.selected = null;
      this.drag = null;
      // the element whose offset is shown
      this.moving = null;
      // the run of nudges in progress: its element, the time of its last nudge, and the offset after it
      this.run = null;
      this.ctx = ctx;
      this.frame.className = "beeson-frame";
      this.selectedFrame.className = "beeson-frame selected";
      this.handle.className = "beeson-handle";
      this.handle.textContent = "\u283F";
      this.handle.title = "Drag to move, double-click to put back, arrow keys nudge";
      this.handle.tabIndex = 0;
      this.handle.setAttribute("role", "button");
      this.handle.setAttribute("aria-label", "Move the block: the arrow keys nudge it, Enter puts it back");
      this.guideV.className = "beeson-guide v";
      this.guideH.className = "beeson-guide h";
      this.offset.className = "beeson-offset";
      this.frame.hidden = this.selectedFrame.hidden = this.handle.hidden = this.guideV.hidden = this.guideH.hidden = this.offset.hidden = true;
      this.handle.addEventListener("focus", () => {
        const el = this.current();
        if (el) this.select(el);
      });
      this.handle.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter") return;
        ev.preventDefault();
        this.reset();
      });
      document.addEventListener("focusin", (ev) => {
        if (ev.target instanceof Element && ev.target.classList.contains("beeson-movable")) this.select(ev.target);
      });
      document.addEventListener("pointermove", (ev) => this.onMove(ev));
      document.addEventListener("pointerdown", (ev) => this.onDown(ev), true);
      document.addEventListener("pointerup", (ev) => this.onUp(ev), true);
      document.addEventListener("pointercancel", () => this.onUp(null), true);
      this.handle.addEventListener("dblclick", () => this.reset());
      document.addEventListener("dragstart", (ev) => {
        if (ev.target instanceof Element && this.movableOf(ev.target)) ev.preventDefault();
      });
    }
    // the element that a drag at target would move, or null
    movableOf(target) {
      const slide = this.ctx.slide();
      const pairing2 = this.ctx.pairing();
      if (!target || !slide || !pairing2 || !slide.contains(target) || target.closest(OUTSIDE2)) return null;
      let el = target.closest(MOVABLE);
      while (el) {
        const up = el.parentElement?.closest(MOVABLE) ?? null;
        if (!up || !slide.contains(up)) break;
        el = up;
      }
      return el && slide.contains(el) && pairing2.elements.get(el)?.open ? el : null;
    }
    // the element that the handle is shown at: the one dragged, under the pointer, or being edited,
    // else the selected one
    current() {
      const active = document.activeElement instanceof Element ? document.activeElement : null;
      const editing = active?.closest('[contenteditable="true"]') ?? null;
      return this.drag?.el ?? this.hover ?? this.movableOf(editing) ?? this.selected;
    }
    refresh() {
      if (this.selected && !this.selected.isConnected) this.selected = null;
      if (this.hover && !this.hover.isConnected) this.hover = null;
      if (this.moving && !this.moving.isConnected) this.moving = null;
      const place = (box2, el) => {
        const rect2 = el.getBoundingClientRect();
        Object.assign(box2.style, { left: `${rect2.left - 6}px`, top: `${rect2.top - 6}px`, width: `${rect2.width + 12}px`, height: `${rect2.height + 12}px` });
      };
      const selected = this.selected;
      this.selectedFrame.hidden = !selected;
      if (selected) place(this.selectedFrame, selected);
      this.offset.hidden = !this.moving;
      if (this.moving) {
        const rect2 = this.moving.getBoundingClientRect();
        const { x, y } = translateOf(this.moving);
        this.offset.textContent = `${x}, ${y}`;
        Object.assign(this.offset.style, { left: `${rect2.right + 6}px`, top: `${rect2.bottom + 10}px` });
      }
      const hot = this.current();
      this.frame.hidden = !hot || hot === selected;
      this.handle.hidden = !hot;
      if (!hot) return;
      place(this.frame, hot);
      const rect = hot.getBoundingClientRect();
      Object.assign(this.handle.style, { left: `${rect.left - 24}px`, top: `${rect.top - 24}px` });
    }
    select(el) {
      if (el !== this.selected) this.moving = this.run = null;
      this.selected = el;
      this.refresh();
    }
    onMove(ev) {
      if (this.drag) {
        const scale = this.ctx.scale() || 1;
        let dx = (ev.clientX - this.drag.x) / scale;
        let dy = (ev.clientY - this.drag.y) / scale;
        const lock = ev.shiftKey ? Math.abs(dx) >= Math.abs(dy) ? "y" : "x" : null;
        if (lock === "y") dy = 0;
        if (lock === "x") dx = 0;
        let x = this.drag.from.x + dx;
        let y = this.drag.from.y + dy;
        if (Math.hypot(ev.clientX - this.drag.x, ev.clientY - this.drag.y) >= CLICK) this.drag.moved = true;
        if (this.drag.moved) {
          const snapped = ev.altKey ? null : this.snap(this.drag.el, this.drag.base, x, y, scale);
          if (snapped && lock !== "x") x = snapped.x;
          if (snapped && lock !== "y") y = snapped.y;
          this.guides(lock === "x" ? null : snapped?.gx ?? null, lock === "y" ? null : snapped?.gy ?? null);
          this.drag.el.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
          this.moving = this.drag.el;
        }
        this.refresh();
        this.ctx.onChange();
        return;
      }
      const target = ev.target instanceof Element ? ev.target : null;
      if (target === this.handle || target === this.frame) return;
      const el = this.movableOf(target);
      if (el) {
        if (el !== this.hover) {
          this.hover = el;
          this.refresh();
        }
      } else if (this.hover && !this.near(this.hover, ev)) {
        this.hover = null;
        this.refresh();
      }
    }
    // whether the pointer is over el or over the room for its handle, so that the handle is reached
    near(el, ev) {
      const r = el.getBoundingClientRect();
      return ev.clientX >= r.left - 28 && ev.clientX <= r.right + 4 && ev.clientY >= r.top - 28 && ev.clientY <= r.bottom + 4;
    }
    onDown(ev) {
      if (ev.button !== 0) return;
      const target = ev.target instanceof Element ? ev.target : null;
      if (!target) return;
      let el = null;
      if (target === this.handle) el = this.current();
      else if (target.closest(BY_ITSELF) && !target.closest('[contenteditable="true"]')) el = this.movableOf(target);
      if (!el) {
        this.select(null);
        return;
      }
      ev.preventDefault();
      this.run = null;
      const from = translateOf(el);
      const scale = this.ctx.scale() || 1;
      const r = el.getBoundingClientRect();
      this.drag = { el, x: ev.clientX, y: ev.clientY, from, moved: false, base: { left: r.left - from.x * scale, top: r.top - from.y * scale, width: r.width, height: r.height } };
      document.documentElement.classList.add("beeson-dragging");
    }
    onUp(ev) {
      const drag = this.drag;
      if (!drag) return;
      this.drag = null;
      this.moving = null;
      document.documentElement.classList.remove("beeson-dragging");
      this.guides(null, null);
      if (ev && drag.moved) this.commit(drag.el, drag.from);
      this.select(drag.el);
    }
    // the offset x, y moved to the nearest edge or center of another element of the slide, of the
    // slide, or of the place of el in the file, within SNAP screen pixels of an edge or the center of
    // el, as the alignment guides of Keynote and PowerPoint. gx and gy are the screen coordinates
    // of the lines snapped to
    snap(el, base, x, y, scale) {
      const slide = this.ctx.slide();
      const pairing2 = this.ctx.pairing();
      if (!slide || !pairing2) return null;
      const box2 = slide.getBoundingClientRect();
      const xs = [box2.left, box2.left + box2.width / 2, box2.right, base.left];
      const ys = [box2.top, box2.top + box2.height / 2, box2.bottom, base.top];
      for (const other of slide.querySelectorAll(MOVABLE)) {
        if (other === el || other.contains(el) || el.contains(other) || other.closest(OUTSIDE2) || !pairing2.elements.get(other)?.open) continue;
        const up = other.parentElement?.closest(MOVABLE);
        if (up && slide.contains(up)) continue;
        const r = other.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        xs.push(r.left, r.left + r.width / 2, r.right);
        ys.push(r.top, r.top + r.height / 2, r.bottom);
      }
      const nearest = (edges, targets) => {
        let best = null;
        for (const edge of edges) {
          for (const to of targets) {
            const d = Math.abs(to - edge);
            if (d <= SNAP && (!best || d < best.d)) best = { d, shift: to - edge, to };
          }
        }
        return best;
      };
      const left = base.left + x * scale, top2 = base.top + y * scale;
      const bx = nearest([left, left + base.width / 2, left + base.width], xs);
      const by = nearest([top2, top2 + base.height / 2, top2 + base.height], ys);
      return { x: bx ? x + bx.shift / scale : x, y: by ? y + by.shift / scale : y, gx: bx?.to ?? null, gy: by?.to ?? null };
    }
    // the guide lines across the slide at the screen coordinates snapped to, or none
    guides(gx, gy) {
      const box2 = this.ctx.slide()?.getBoundingClientRect();
      this.guideV.hidden = gx === null || !box2;
      this.guideH.hidden = gy === null || !box2;
      if (!box2) return;
      if (gx !== null) Object.assign(this.guideV.style, { left: `${gx}px`, top: `${box2.top}px`, height: `${box2.height}px` });
      if (gy !== null) Object.assign(this.guideH.style, { top: `${gy}px`, left: `${box2.left}px`, width: `${box2.width}px` });
    }
    // a figure, which has no text to click into, is put into the tab order, so that it is selected
    // with Tab and moved with the arrow keys
    mark(pairing2) {
      for (const el of document.querySelectorAll(".beeson-movable")) {
        el.classList.remove("beeson-movable");
        el.removeAttribute("tabindex");
      }
      if (!pairing2) return;
      for (const [el, src] of pairing2.elements) {
        if (!src.open || !el.matches(BY_ITSELF) || el.closest(OUTSIDE2)) continue;
        const up = el.parentElement?.closest(MOVABLE);
        if (up && el.closest("section")?.contains(up)) continue;
        el.classList.add("beeson-movable");
        el.setAttribute("tabindex", "0");
        if (!el.hasAttribute("aria-label") && !el.hasAttribute("alt")) el.setAttribute("aria-label", "Figure: the arrow keys move it, Esc deselects it");
      }
    }
    // the offset on the page is written into the edits, and the move from the former offset is one
    // entry of the history
    commit(el, from) {
      const to = translateOf(el);
      this.set(el, to);
      if (from.x === to.x && from.y === to.y) return;
      this.ctx.record({ label: "move", undo: () => this.apply(el, from), redo: () => this.apply(el, to) });
    }
    apply(el, t) {
      this.run = null;
      this.ctx.show(el);
      el.style.translate = t.x === 0 && t.y === 0 ? "" : `${t.x}px ${t.y}px`;
      this.set(el, t);
      this.select(el);
    }
    set(el, { x, y }) {
      this.ctx.edits.set(el, { ...this.ctx.edits.get(el), translate: x === 0 && y === 0 ? null : { x, y } });
      this.ctx.markDirty();
      this.refresh();
      this.ctx.onChange();
    }
    // the selected element is nudged by one slide pixel, or ten with Shift, while no text or field
    // is typed into and no list has the focus. a run of nudges is one entry of the history, whose
    // destination each nudge moves, until a pause, a drag, Escape, or another selection ends it
    onKey(ev) {
      const el = this.selected;
      const active = document.activeElement;
      if (!el || active?.closest('[contenteditable="true"], input, select, textarea, .beeson-edit-nav, .beeson-edit-side, .beeson-math')) return false;
      if (ev.key === "Escape") {
        if (active instanceof HTMLElement && (active === el || active === this.handle)) active.blur();
        this.select(null);
        return true;
      }
      const step = ev.shiftKey ? 10 : 1;
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const d = delta[ev.key];
      if (!d || ev.metaKey || ev.ctrlKey || ev.altKey) return false;
      const from = translateOf(el);
      const to = { x: from.x + d[0], y: from.y + d[1] };
      el.style.translate = `${to.x}px ${to.y}px`;
      this.moving = el;
      const now = performance.now();
      if (this.run && this.run.el === el && now - this.run.at < PAUSE2) {
        Object.assign(this.run, { at: now, to });
        this.set(el, to);
        return true;
      }
      const run = { el, at: now, to };
      this.set(el, to);
      this.ctx.record({ label: "move", undo: () => this.apply(el, from), redo: () => this.apply(el, run.to) });
      this.run = run;
      return true;
    }
    reset() {
      const el = this.current();
      if (!el) return;
      this.run = null;
      const from = translateOf(el);
      el.style.translate = "";
      this.commit(el, from);
    }
  };

  // src/editor/styles.ts
  var CSS = `
.beeson-edit-top, .beeson-edit-bottom { position: fixed; left: 0; right: 0; z-index: 60; display: flex; align-items: center; gap: 12px; box-sizing: border-box; padding: 0 16px; background: var(--bg, #000); color: var(--text, #eee); font: 14px/1.4 system-ui, sans-serif; }
.beeson-edit-top { top: 0; height: 44px; border-bottom: 1px solid var(--line, #555); }
.beeson-edit-bottom { bottom: 0; height: 36px; font-size: 13px; color: var(--subtle, #bbb); border-top: 1px solid var(--line, #555); }
.beeson-edit-top .file { font-weight: 600; white-space: nowrap; }
.beeson-edit-top .state { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--subtle, #bbb); }
.beeson-edit-top .state.warn { color: var(--accent, #f80); }
.beeson-edit-top button, .beeson-edit-bottom button, .beeson-edit-card button, .beeson-math button { font: inherit; padding: 4px 12px; border: 1px solid var(--line, #555); border-radius: 6px; background: transparent; color: var(--text, #eee); cursor: pointer; white-space: nowrap; }
.beeson-edit-top button:hover, .beeson-edit-bottom button:hover, .beeson-math button:hover { border-color: var(--subtle, #bbb); }
.beeson-edit-top button:disabled { opacity: 0.4; cursor: default; }
.beeson-edit-top button.on { border-color: var(--accent, #f80); color: var(--accent, #f80); }
.beeson-edit-bottom button { padding: 2px 10px; font-size: 13px; }
.beeson-edit-bottom button.on { border-color: var(--violet, #96f); color: var(--text, #eee); }
.beeson-edit-bottom .count { white-space: nowrap; min-width: 9ch; text-align: center; }
.beeson-edit-bottom .beeson-layers { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.beeson-edit-bottom .beeson-layers[hidden] { display: none; }
.beeson-edit-bottom .beeson-layers > span { margin-right: 4px; }
.beeson-edit-bottom .hint { flex: 1; min-width: 0; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.beeson-edit-card { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 65; box-sizing: border-box; width: min(600px, calc(100vw - 32px)); padding: 24px 28px; border: 1px solid var(--line, #555); border-radius: 10px; background: var(--bg, #000); color: var(--text, #eee); font: 15px/1.5 system-ui, sans-serif; box-shadow: 0 12px 48px rgba(0, 0, 0, 0.45); }
.beeson-edit-card[hidden] { display: none; }
.beeson-edit-card h3 { margin: 0 0 8px; font: 600 18px/1.3 system-ui, sans-serif; }
.beeson-edit-card p { margin: 0 0 16px; color: var(--subtle, #bbb); }
.beeson-edit-card code { font: 13px/1.5 ui-monospace, Menlo, Consolas, monospace; color: var(--text, #eee); word-break: break-all; }
.beeson-edit-card button { padding: 8px 16px; border-color: var(--violet, #96f); }
.beeson-edit-card .row { display: flex; flex-wrap: wrap; gap: 8px; }
.beeson-edit-card .row button:not(:first-child) { border-color: var(--line, #555); }
.beeson-edit-card.recover { z-index: 66; }
.beeson-edit-pane { position: fixed; left: 0; right: 0; bottom: 36px; z-index: 0; height: var(--beeson-pane, 200px); box-sizing: border-box; display: none; background: var(--bg, #000); border-top: 1px solid var(--line, #555); color: var(--subtle, #bbb); font: 12px/1.4 system-ui, sans-serif; padding: 8px 16px; }
html.beeson-notes .beeson-edit-pane { display: block; }
html.beeson-nav .beeson-edit-pane, html.beeson-nav .beeson-edit-resize { left: 240px; }
html.beeson-steps .beeson-edit-pane, html.beeson-steps .beeson-edit-resize { right: 320px; }
.beeson-edit-resize { position: fixed; left: 0; right: 0; bottom: calc(36px + var(--beeson-pane, 200px) - 4px); height: 8px; z-index: 56; display: none; cursor: ns-resize; }
html.beeson-notes .beeson-edit-resize { display: block; }
.beeson-edit-resize:hover { background: color-mix(in srgb, var(--violet, #96f) 45%, transparent); }
html.beeson-editor { --beeson-left: 6px; --beeson-right: 6px; }
html.beeson-editor.beeson-nav { --beeson-left: 246px; }
html.beeson-editor.beeson-steps { --beeson-right: 326px; }
html.beeson-editor .reveal:not(.beeson-peek) { position: relative; z-index: 1; height: calc(100% - 80px) !important; margin-top: 44px; margin-left: var(--beeson-left); width: calc(100% - var(--beeson-left) - var(--beeson-right)) !important; overflow: visible; }
html.beeson-editor.beeson-notes .reveal:not(.beeson-peek) { height: calc(100% - 80px - var(--beeson-pane, 200px)) !important; }
.beeson-edit-nav { position: fixed; left: 0; top: 44px; bottom: 36px; z-index: 50; width: 240px; box-sizing: border-box; display: none; flex-direction: column; background: var(--bg, #000); border-right: 1px solid var(--line, #555); color: var(--text, #eee); font: 13px/1.4 system-ui, sans-serif; }
html.beeson-nav .beeson-edit-nav { display: flex; }
.beeson-edit-nav .head { padding: 10px 12px; font-weight: 600; border-bottom: 1px solid var(--line, #555); }
.beeson-edit-nav .rows { flex: 1; overflow: auto; padding: 6px 0; }
.beeson-edit-nav .row { display: grid; grid-template-columns: 3ch 1fr; column-gap: 10px; width: 100%; box-sizing: border-box; padding: 6px 12px 6px 9px; border: 0; border-left: 3px solid transparent; border-radius: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.beeson-edit-nav .row:hover { background: color-mix(in srgb, var(--violet, #96f) 18%, transparent); }
.beeson-edit-nav .row:focus-visible { outline: 2px solid var(--violet, #96f); outline-offset: -2px; }
.beeson-edit-nav .row[aria-current="true"] { border-left-color: var(--accent, #f80); background: color-mix(in srgb, var(--violet, #96f) 28%, transparent); }
.beeson-edit-nav .row .num { color: var(--subtle, #bbb); text-align: right; }
.beeson-edit-nav .row .title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beeson-edit-nav .row .kind { grid-column: 2; color: var(--subtle, #bbb); font-size: 11px; }
.beeson-edit-peek { position: fixed; left: 248px; z-index: 57; width: 320px; overflow: hidden; border-radius: 6px; outline: 1px solid var(--line, #555); background: var(--bg, #000); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); pointer-events: none; }
.beeson-edit-peek[hidden] { display: none; }
.beeson-edit-peek .reveal { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; overflow: hidden; }
.beeson-edit-peek .fragment { visibility: visible !important; opacity: 1 !important; transition: none !important; }
.beeson-edit-peek .fragment.beeson-off { visibility: hidden !important; }
.beeson-edit-side { position: fixed; right: 0; top: 44px; bottom: 36px; z-index: 50; width: 320px; box-sizing: border-box; display: none; flex-direction: column; background: var(--bg, #000); border-left: 1px solid var(--line, #555); color: var(--text, #eee); font: 13px/1.4 system-ui, sans-serif; }
html.beeson-steps .beeson-edit-side { display: flex; }
.beeson-edit-side .head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--line, #555); }
.beeson-edit-side .head span { flex: 1; font-weight: 600; }
.beeson-edit-side .head button, .beeson-edit-side select { font: inherit; font-size: 12px; padding: 2px 8px; border: 1px solid var(--line, #555); border-radius: 6px; background: var(--bg, #000); color: var(--text, #eee); cursor: pointer; }
.beeson-edit-side .head button:hover { border-color: var(--subtle, #bbb); }
.beeson-edit-side .rows { flex: 1; overflow: auto; padding: 6px 0; }
.beeson-edit-side .row { display: grid; grid-template-columns: auto auto 1fr; align-items: center; gap: 8px; padding: 5px 12px; cursor: default; }
.beeson-edit-side .row:hover { background: color-mix(in srgb, var(--violet, #96f) 18%, transparent); }
.beeson-edit-side .row .kind { color: var(--subtle, #bbb); white-space: nowrap; }
.beeson-edit-side .row .text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beeson-edit-side .empty, .beeson-edit-side .foot { margin: 0; padding: 10px 12px; color: var(--subtle, #bbb); font-size: 12px; }
.beeson-edit-side .foot { border-top: 1px solid var(--line, #555); }
.beeson-badges { position: fixed; inset: 0; z-index: 52; pointer-events: none; }
.beeson-badge { position: absolute; transform: translate(-50%, -50%); min-width: 22px; height: 22px; padding: 0 5px; box-sizing: border-box; border-radius: 11px; background: var(--accent, #f80); color: #000; font: 600 13px/22px system-ui, sans-serif; text-align: center; }
html.beeson-editing .reveal .beeson-hover { outline: 2px solid var(--accent, #f80) !important; outline-offset: 6px; }
html.beeson-editing .reveal .beeson-overflow { outline: 2px dashed var(--accent, #f80) !important; outline-offset: 6px; }
.beeson-frame { position: fixed; z-index: 51; pointer-events: none; box-sizing: border-box; border: 1px dashed var(--subtle, #bbb); }
.beeson-frame.selected { border: 2px solid var(--violet, #96f); }
.beeson-frame[hidden], .beeson-handle[hidden] { display: none; }
.beeson-handle { position: fixed; z-index: 53; width: 22px; height: 22px; border-radius: 6px; border: 1px solid var(--line, #555); background: var(--bg, #000); color: var(--text, #eee); font: 14px/20px system-ui, sans-serif; text-align: center; cursor: move; user-select: none; }
.beeson-handle:hover, .beeson-handle:focus-visible { border-color: var(--violet, #96f); outline: none; }
.beeson-guide { position: fixed; z-index: 52; pointer-events: none; background: var(--accent, #f80); opacity: 0.8; }
.beeson-guide.v { width: 1px; }
.beeson-guide.h { height: 1px; }
.beeson-guide[hidden] { display: none; }
.beeson-offset { position: fixed; z-index: 53; transform: translateX(-100%); height: 22px; padding: 0 7px; box-sizing: border-box; border-radius: 11px; background: var(--accent, #f80); color: #000; font: 600 13px/22px system-ui, sans-serif; font-variant-numeric: tabular-nums; white-space: nowrap; pointer-events: none; }
.beeson-offset[hidden] { display: none; }
html.beeson-editing .reveal .beeson-movable:focus-visible { outline: 2px solid var(--violet, #96f); outline-offset: 6px; }
.beeson-edit-resize:focus-visible { outline: none; background: color-mix(in srgb, var(--violet, #96f) 45%, transparent); }
html.beeson-dragging, html.beeson-dragging * { cursor: move !important; user-select: none !important; }
html.beeson-editing .reveal .slides section img, html.beeson-editing .reveal .slides section video, html.beeson-editing .reveal .slides section .zone, html.beeson-editing .reveal .slides section .plate, html.beeson-editing .reveal .slides section .qr { cursor: move; }
html.beeson-editor .reveal .progress, html.beeson-editor .reveal .slide-number { display: none !important; }
html.beeson-editing .reveal .slides section .fragment { visibility: visible !important; opacity: 1 !important; transition: none !important; }
html.beeson-editing .reveal .slides section .fragment.beeson-off { visibility: hidden !important; }
html.beeson-editing .reveal [contenteditable="true"] { cursor: text; outline: 1px dashed transparent; outline-offset: 6px; border-radius: 2px; }
html.beeson-editing .reveal [contenteditable="true"]:hover { outline-color: var(--subtle, #bbb); }
html.beeson-editing .reveal [contenteditable="true"]:focus { outline: 2px solid var(--violet, #96f); }
html.beeson-editing .reveal [contenteditable="true"] mjx-container { cursor: pointer; border-radius: 2px; }
html.beeson-editing .reveal [contenteditable="true"] mjx-container:hover, html.beeson-editing .reveal [contenteditable="true"] mjx-container:focus-visible { outline: 1px dashed var(--accent, #f80); outline-offset: 4px; }
html.beeson-editor.beeson-notes .reveal .slides section.present { overflow: visible; clip-path: inset(0 calc(-1 * var(--beeson-side, 0px)) calc(-1 * (var(--beeson-pane, 200px) / var(--beeson-scale, 1) + var(--beeson-gap, 0px))) calc(-1 * var(--beeson-side, 0px))); }
html.beeson-editor.beeson-notes .reveal .slides section.present > aside.notes { display: block; position: absolute; left: calc(-1 * var(--beeson-side, 0px)); right: calc(-1 * var(--beeson-side, 0px)); top: calc(100% + var(--beeson-gap, 0px)); z-index: 5; box-sizing: border-box; height: calc(var(--beeson-pane, 200px) / var(--beeson-scale, 1)); margin: 0; padding: calc(30px / var(--beeson-scale, 1)) calc(16px / var(--beeson-scale, 1)) calc(12px / var(--beeson-scale, 1)); font-size: calc(15px / var(--beeson-scale, 1)); line-height: 1.5; text-align: left; color: var(--text, #eee); background: transparent; overflow: auto; outline: 1px solid transparent; outline-offset: -1px; }
html.beeson-editor.beeson-notes .reveal .slides section.present > aside.notes:focus { outline-color: var(--violet, #96f); }
html.beeson-editor.beeson-notes .reveal .slides section.present > aside.notes:empty::before { content: 'Click to add notes'; color: var(--subtle, #bbb); }
.beeson-math { position: fixed; z-index: 70; display: flex; flex-direction: column; gap: 6px; width: min(640px, calc(100vw - 32px)); box-sizing: border-box; padding: 10px; border: 1px solid var(--line, #555); border-radius: 6px; background: var(--bg, #000); color: var(--text, #eee); font: 14px/1.4 system-ui, sans-serif; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); }
.beeson-math textarea { font: 14px/1.4 ui-monospace, Menlo, Consolas, monospace; min-height: 5em; padding: 6px; border: 1px solid var(--line, #555); border-radius: 4px; background: transparent; color: inherit; resize: vertical; }
.beeson-math .row { display: flex; gap: 8px; align-items: center; }
.beeson-math .hint { margin-left: auto; color: var(--subtle, #bbb); }
.beeson-math .error { color: var(--accent, #f80); }
.beeson-math .error:empty { display: none; }
.beeson-math .preview { padding: 8px 12px; border: 1px solid var(--line, #444); background: var(--bg, #000); color: var(--text, #fff); font-size: 32px; max-height: 240px; overflow: auto; }
.beeson-math .preview mjx-container { margin: 0 !important; }
.beeson-math .preview:empty { display: none; }
.beeson-math button:disabled { opacity: 0.5; cursor: default; }
`;

  // src/editor/main.ts
  var FILE_TYPES = [{ description: "HTML", accept: { "text/html": [".html", ".htm"] } }];
  var HOST = '[contenteditable="true"]';
  var DRAFT_KEY = `beeson-draft:${location.href.split(/[?#]/)[0]}`;
  var AUTOSAVE_KEY = "beeson-autosave";
  var PANE_KEY = "beeson-pane";
  var DRAFT_DELAY = 1e3;
  var AUTOSAVE_DELAY = 1500;
  var pickers = window;
  var canPick = () => typeof pickers.showOpenFilePicker === "function";
  var canWrite = () => typeof pickers.showSaveFilePicker === "function";
  var source = null;
  var pairing = null;
  var handle = null;
  var dirty = false;
  var state = "starting";
  var hosts = [];
  var note = null;
  var tagEdits = /* @__PURE__ */ new Map();
  var autosave = false;
  var saving = false;
  var again = false;
  var draftTimer = 0;
  var autosaveTimer = 0;
  var overflowing = 0;
  var paneHeight = 200;
  var slides = () => document.querySelector(".reveal .slides") ?? document.body;
  var deck = () => window.Reveal;
  var fileName = () => decodeURIComponent(location.pathname.split("/").pop() || "") || "index.html";
  var folder = () => decodeURIComponent(location.pathname).replace(/[^/]*$/, "");
  var REPLACE = () => `Replace ${fileName()} in ${folder()} with it, or set the browser to ask where to save each download`;
  var plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  var clock = () => (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  function stored(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function store(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
    }
  }
  function make(tag, className = "", text = "") {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }
  function button(text, title = "", label2 = "") {
    const el = make("button", "", text);
    el.title = title;
    if (label2) el.setAttribute("aria-label", label2);
    return el;
  }
  var top = make("div", "beeson-edit-top");
  var fileEl = make("span", "file");
  var stateEl = make("span", "state");
  stateEl.setAttribute("aria-live", "polite");
  var undoButton = button("Undo", "Undo the last change, \u2318Z or Ctrl+Z");
  var redoButton = button("Redo", "Redo the change undone, \u2318\u21E7Z or Ctrl+Y");
  var openButton = button("Open\u2026", "Choose the file of this deck");
  var saveButton = button("Save", "Save the edits into the file, \u2318S or Ctrl+S");
  var saveAsButton = button("Save as\u2026", "Save the deck into another file, \u2318\u21E7S or Ctrl+Shift+S");
  var autosaveButton = button("Autosave", "Save the edits into the file after each change");
  var presentButton = button("Present", "Show the saved deck in a new tab");
  var whichButton = button("Which?", "List the texts that cannot be edited");
  whichButton.hidden = true;
  undoButton.disabled = redoButton.disabled = true;
  top.append(fileEl, stateEl, whichButton, undoButton, redoButton, openButton, saveButton, saveAsButton, autosaveButton, presentButton);
  var bottom = make("div", "beeson-edit-bottom");
  var prevButton = button("\u2039", "Previous slide", "Previous slide");
  var countEl = make("span", "count");
  var nextButton = button("\u203A", "Next slide", "Next slide");
  var hintEl = make("span", "hint", "Click a text or a formula to edit it, drag a figure or the \u283F handle of a block to move it, press G to jump to a slide, and Esc to leave a text and select its block");
  var notesButton = button("Notes", "Show the speaker notes under the slide");
  notesButton.setAttribute("aria-pressed", "false");
  var current = () => deck()?.getCurrentSlide() ?? null;
  function showSlide(el) {
    const d = deck();
    const section = el.closest("section");
    if (d && section && section !== d.getCurrentSlide()) {
      const { h, v } = d.getIndices(section);
      d.slide(h, v);
    }
    layers.reveal(el);
  }
  var history = new History({
    snapshot: contentWithTex,
    restore: restoreHost,
    onChange: () => {
      undoButton.disabled = !history.canUndo;
      redoButton.disabled = !history.canRedo;
      if (dirty) cleanIfSaved();
    }
  });
  var relayout = () => {
    deck()?.layout();
    layout();
  };
  var nav = new Nav({ slides: () => [...slides().querySelectorAll(":scope > section")], current, go: showSlide, layout: relayout });
  var steps = new Steps({ pairing: () => pairing, slide: current, edits: tagEdits, markDirty, layout: relayout, show: showSlide, record: (e) => history.push(e), tex: (el) => mathLookup()(el)?.tex ?? null, changed: () => follow() });
  var move = new Move({ pairing: () => pairing, slide: current, scale: () => deck()?.getScale() ?? 1, edits: tagEdits, markDirty, onChange: () => steps.refresh(), show: showSlide, record: (e) => history.push(e) });
  var layers = new Layers(current, () => {
    move.select(null);
    follow();
  });
  bottom.append(prevButton, countEl, nextButton, layers.box, hintEl, nav.button, steps.button, notesButton);
  function follow() {
    layers.refresh();
    steps.refresh();
    move.refresh();
    nav.refresh();
    checkOverflow();
  }
  var pane = make("div", "beeson-edit-pane", "Notes");
  var resizer = make("div", "beeson-edit-resize");
  resizer.title = "Drag to change the height of the notes, or focus it and press the up and down arrows";
  resizer.tabIndex = 0;
  resizer.setAttribute("role", "separator");
  resizer.setAttribute("aria-orientation", "horizontal");
  resizer.setAttribute("aria-label", "Height of the notes");
  resizer.setAttribute("aria-valuemin", "120");
  resizer.setAttribute("aria-valuemax", "600");
  var card = make("div", "beeson-edit-card");
  var cardText = make("p");
  var cardButton = button(`Choose ${fileName()}\u2026`);
  card.append(make("h3", "", "Choose the file of this deck"), cardText, cardButton);
  card.hidden = true;
  var recover = make("div", "beeson-edit-card recover");
  var recoverText = make("p");
  var restoreButton = button("Restore and save", "Write the edits into the file and show the page again");
  var copyButton = button("Download a copy", "Put a copy of the file with the edits into your downloads");
  var discardButton = button("Discard", "Forget the edits");
  var recoverRow = make("div", "row");
  recoverRow.append(restoreButton, copyButton, discardButton);
  recover.append(make("h3", "", "Edits that were not saved were found"), recoverText, recoverRow);
  recover.hidden = true;
  var ask = make("div", "beeson-edit-card ask");
  var askText = make("p");
  var askSave = button("");
  var askDiscard = button("");
  var askCancel = button("Cancel", "Go on editing");
  var askRow = make("div", "row");
  askRow.append(askSave, askDiscard, askCancel);
  ask.append(make("h3", "", "The deck has unsaved changes"), askText, askRow);
  ask.hidden = true;
  var asking = null;
  var ASK = {
    open: {
      text: "Save them into the file first, open a file without them, or go on editing.",
      save: ["Save and open\u2026", "Save the edits into the file, then choose a file"],
      discard: ["Open without saving", "Put the slides back as saved, then choose a file"]
    },
    present: {
      text: "Save them into the file first, present the saved file without them, or go on editing.",
      save: ["Save and present", "Save the edits into the file, then show the deck in a new tab"],
      discard: ["Present the saved file", "Show the deck as saved in a new tab, and keep the edits here"]
    }
  };
  function askFirst(action) {
    const words = ASK[action];
    askText.textContent = words.text;
    [askSave.textContent, askSave.title] = words.save;
    [askDiscard.textContent, askDiscard.title] = words.discard;
    return new Promise((done) => {
      asking = done;
      ask.hidden = false;
      askCancel.focus();
    });
  }
  function answer(choice) {
    ask.hidden = true;
    asking?.(choice);
    asking = null;
  }
  var problemsCard = make("div", "beeson-edit-card problems");
  var problemsList = make("ul");
  problemsList.style.cssText = "margin: 0 0 16px; padding-left: 20px; max-height: 50vh; overflow-y: auto; color: var(--subtle, #bbb);";
  var problemsClose = button("Close");
  var problemsRow = make("div", "row");
  problemsRow.append(problemsClose);
  problemsCard.append(make("h3", "", "Texts that cannot be edited"), problemsList, problemsRow);
  problemsCard.hidden = true;
  var problemText = (p) => `slide ${slideNumber(p.slide) ?? "?"}, ${p.tag}: ${p.reason}`;
  function showProblems() {
    problemsList.replaceChildren(...(pairing?.problems ?? []).map((p) => make("li", "", problemText(p))));
    problemsCard.hidden = false;
    problemsClose.focus();
  }
  function closeProblems() {
    problemsCard.hidden = true;
    if (!whichButton.hidden) whichButton.focus();
  }
  function setState(text, warn = false, title = "") {
    stateEl.textContent = text;
    stateEl.title = title;
    stateEl.classList.toggle("warn", warn);
  }
  function slideNumber(slide) {
    if (!slide) return null;
    const d = deck();
    return d ? d.getIndices(slide).h + 1 : null;
  }
  function report() {
    fileEl.textContent = handle?.name ?? fileName();
    saveButton.classList.toggle("on", dirty);
    autosaveButton.classList.toggle("on", autosave);
    autosaveButton.setAttribute("aria-pressed", String(autosave));
    card.hidden = state !== "waiting";
    whichButton.hidden = !pairing?.problems.length;
    if (state === "waiting") {
      const where = `${fileName()} in ${folder()}, i.e. the file that is open here`;
      cardText.textContent = canWrite() ? `A browser writes only to a file that you have chosen. Choose ${where}, and your edits are saved into it.` : `This browser does not write to a file by itself. Choose ${where}. A save is then a download of a copy with your edits. Set the browser to ask where to save each download, and you choose ${fileName()} in its folder and replace it.`;
      setState("Choose the file of this deck to start editing");
      return;
    }
    if (!pairing) {
      setState(note?.text ?? "Loading", note?.warn ?? false);
      return;
    }
    if (!pairing.blocks.length) {
      setState("This file is not the deck on the page", true);
      return;
    }
    const problems = pairing.problems;
    const list = problems.map(problemText).join("\n");
    const parts = [dirty ? "Unsaved changes" : note?.text ?? "No unsaved changes"];
    if (problems.length) parts.push(`${plural(problems.length, "text")} cannot be edited`);
    if (overflowing) parts.push(`${plural(overflowing, "text")} run${overflowing === 1 ? "s" : ""} past the slide or into its footnote`);
    if (autosave && !handle && canWrite()) parts.push("autosave starts after the first save");
    setState(parts.join(". "), (note?.warn ?? false) || problems.length > 0 || overflowing > 0, list);
  }
  function fail2(e) {
    note = { text: e instanceof Error ? e.message : String(e), warn: true };
    report();
  }
  function count() {
    const d = deck();
    if (d) countEl.textContent = `Slide ${d.getSlidePastCount() + 1} of ${d.getTotalSlides()}`;
  }
  function layout() {
    const d = deck();
    if (!d) return;
    const scale = d.getScale();
    const reveal = document.querySelector(".reveal")?.getBoundingClientRect();
    const box2 = slides().getBoundingClientRect();
    const gap = reveal ? Math.max(0, reveal.bottom - box2.bottom) / scale : 0;
    document.documentElement.style.setProperty("--beeson-scale", String(scale));
    document.documentElement.style.setProperty("--beeson-gap", `${gap}px`);
    const side = reveal ? Math.max(0, (reveal.width - box2.width) / 2) / scale : 0;
    document.documentElement.style.setProperty("--beeson-side", `${side}px`);
  }
  function setPane(height) {
    paneHeight = Math.max(120, Math.min(600, Math.round(height)));
    document.documentElement.style.setProperty("--beeson-pane", `${paneHeight}px`);
    resizer.setAttribute("aria-valuenow", String(paneHeight));
    relayout();
    follow();
  }
  function markMath(root) {
    for (const c of root.querySelectorAll("mjx-container")) {
      c.setAttribute("contenteditable", "false");
      if (!hostOf(c)) continue;
      c.setAttribute("tabindex", "0");
      c.setAttribute("role", "button");
      c.setAttribute("aria-label", "Formula, Enter opens its TeX");
    }
  }
  function attach() {
    const next = pairing ? pairing.blocks.map((b) => b.live) : [];
    for (const h of hosts) if (!next.includes(h)) h.removeAttribute("contenteditable");
    for (const h of next) if (h.getAttribute("contenteditable") !== "true") h.setAttribute("contenteditable", "true");
    hosts = next;
    for (const h of next) if (h.matches("aside.notes")) h.setAttribute("aria-label", "Speaker notes");
    move.mark(pairing);
    markMath(slides());
    document.documentElement.classList.toggle("beeson-editing", hosts.length > 0);
    ensureNotes();
  }
  function status() {
    return {
      state,
      // true where the file is written in place, false where a save is a download
      supported: canWrite(),
      dirty,
      file: handle?.name ?? null,
      blocks: pairing?.blocks.length ?? 0,
      sections: pairing?.sections.length ?? 0,
      // the elements whose step or place was changed since the last save
      tags: tagEdits.size,
      problems: (pairing?.problems ?? []).map((p) => ({ slide: slideNumber(p.slide), tag: p.tag, reason: p.reason })),
      message: stateEl.textContent ?? "",
      undo: history.canUndo,
      redo: history.canRedo,
      autosave,
      overflow: overflowing,
      draft: readDraft() !== null,
      recover: !recover.hidden,
      pane: paneHeight
    };
  }
  function open(text, fresh = true) {
    tagEdits.clear();
    if (fresh) {
      history.clear();
      move.select(null);
    }
    try {
      source = parseSource(text);
      pairing = pair(source, slides(), mathLookup());
      state = "loaded";
      dirty = false;
      if (!pairing.blocks.length) pairing.problems.push({ slide: null, tag: "slides", reason: "nothing on the page was found in the file" });
    } catch (error) {
      source = null;
      pairing = null;
      state = "error";
      note = { text: error instanceof Error ? error.message : String(error), warn: true };
    }
    attach();
    report();
    follow();
    if (fresh) offerDraft();
    return status();
  }
  function render() {
    if (!source || !pairing) throw new Error("no file is open");
    return renderDeck(source, pairing, mathLookup(), tagEdits).text;
  }
  function pickFile() {
    return new Promise((done) => {
      const input = make("input");
      input.type = "file";
      input.style.display = "none";
      const finish = (file) => {
        input.remove();
        done(file);
      };
      input.addEventListener("change", () => finish(input.files?.[0] ?? null));
      input.addEventListener("cancel", () => finish(null));
      document.body.append(input);
      input.click();
    });
  }
  async function discardEdits() {
    while (history.canUndo) await history.undo();
    history.clear();
    move.select(null);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.clearTimeout(autosaveTimer);
    dropDraft();
    dirty = false;
    report();
  }
  async function openFile() {
    note = null;
    if (dirty) {
      const choice = await askFirst("open");
      if (!choice) return;
      if (choice === "save") {
        await save();
        if (dirty) return;
      } else await discardEdits();
    }
    if (canPick() && pickers.showOpenFilePicker) {
      let picked;
      try {
        picked = await pickers.showOpenFilePicker({ multiple: false });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        throw error;
      }
      const text = await (await picked[0].getFile()).text();
      handle = picked[0];
      open(text);
      return;
    }
    const file = await pickFile();
    if (!file) return;
    handle = null;
    open(await file.text());
  }
  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/html" }));
    const a = make("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  async function write(to, text) {
    const writable = await to.createWritable();
    await writable.write(text);
    await writable.close();
  }
  async function pickTarget() {
    if (!pickers.showSaveFilePicker) return false;
    try {
      handle = await pickers.showSaveFilePicker({ suggestedName: handle?.name ?? fileName(), types: FILE_TYPES });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      throw error;
    }
  }
  async function save() {
    if (saving) {
      again = true;
      return;
    }
    saving = true;
    try {
      await doSave();
    } finally {
      saving = false;
    }
    if (again) {
      again = false;
      if (dirty) await save();
    }
  }
  async function doSave() {
    if (!source || !pairing) {
      note = { text: "Choose the file of this deck first", warn: true };
      report();
      return;
    }
    const rendered = renderDeck(source, pairing, mathLookup(), tagEdits);
    if (!handle && canWrite() && !await pickTarget()) return;
    const n = rendered.edits.length;
    const edits = plural(n, "edit");
    let text;
    if (handle) {
      await write(handle, rendered.text);
      text = n ? `Saved ${edits} to ${handle.name} at ${clock()}` : `Saved ${handle.name} at ${clock()}`;
    } else {
      download(fileName(), rendered.text);
      text = `${n ? `Saved a copy with ${edits}` : `Saved a copy of ${fileName()}`}. ${REPLACE()}`;
    }
    const warnings = rendered.warnings.length ? `, ${rendered.warnings.join(", ")}` : "";
    note = { text: `${text}${warnings}`, warn: rendered.warnings.length > 0 };
    if (render() === rendered.text) {
      open(rendered.text, false);
      dropDraft();
    } else {
      report();
      scheduleAutosave();
    }
  }
  async function saveAs() {
    if (!source || !pairing) {
      note = { text: "Choose the file of this deck first", warn: true };
      report();
      return;
    }
    if (canWrite() && !await pickTarget()) return;
    await save();
  }
  function markDirty() {
    if (!dirty) {
      dirty = true;
      note = null;
      report();
    }
    window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(keepDraft, DRAFT_DELAY);
    scheduleAutosave();
  }
  function cleanIfSaved() {
    if (!source || !pairing) return;
    try {
      if (render() !== source.text) return;
    } catch {
      return;
    }
    dirty = false;
    window.clearTimeout(autosaveTimer);
    dropDraft();
    report();
  }
  function keepDraft() {
    if (!dirty || !source || !pairing) return;
    const draft = { at: Date.now(), text: render() };
    store(DRAFT_KEY, JSON.stringify(draft));
  }
  function dropDraft() {
    window.clearTimeout(draftTimer);
    store(DRAFT_KEY, null);
  }
  function readDraft() {
    const raw = stored(DRAFT_KEY);
    if (!raw) return null;
    try {
      const draft = JSON.parse(raw);
      return typeof draft.text === "string" && typeof draft.at === "number" ? { at: draft.at, text: draft.text } : null;
    } catch {
      return null;
    }
  }
  function offerDraft() {
    const draft = readDraft();
    if (!draft || !source || draft.text === source.text) {
      if (draft) dropDraft();
      recover.hidden = true;
      return;
    }
    const when = new Date(draft.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    recoverText.textContent = `Edits of ${fileName()} from ${when} were kept in this browser and not saved. Restore writes the file with them and shows it again, a copy goes to your downloads, and Discard forgets them.`;
    copyButton.hidden = false;
    recover.hidden = false;
  }
  async function restoreDraft() {
    const draft = readDraft();
    if (!draft) {
      recover.hidden = true;
      return;
    }
    if (!handle && canWrite() && !await pickTarget()) return;
    if (handle) {
      await write(handle, draft.text);
      dropDraft();
      location.reload();
      return;
    }
    copyDraft();
  }
  function copyDraft() {
    const draft = readDraft();
    if (draft) download(fileName(), draft.text);
    dropDraft();
    recover.hidden = true;
    note = { text: `A copy of ${fileName()} with the edits is in your downloads. Replace ${fileName()} in ${folder()} with it and open it again`, warn: false };
    report();
  }
  function discardDraft() {
    dropDraft();
    recover.hidden = true;
    report();
  }
  function scheduleAutosave() {
    window.clearTimeout(autosaveTimer);
    if (!autosave || !handle) return;
    autosaveTimer = window.setTimeout(() => {
      if (dirty && !saving) void save().catch(fail2);
    }, AUTOSAVE_DELAY);
  }
  function toggleAutosave() {
    autosave = !autosave;
    store(AUTOSAVE_KEY, autosave ? "1" : "0");
    if (dirty) scheduleAutosave();
    report();
  }
  async function present() {
    if (dirty) {
      const choice = await askFirst("present");
      if (!choice) return;
      if (choice === "save") {
        await save();
        if (dirty) return;
      }
    }
    const params = new URLSearchParams(location.search);
    params.delete("edit");
    const query = params.toString().replace(/=(?=&|$)/g, "");
    window.open(`${location.href.split(/[?#]/)[0]}${query ? `?${query}` : ""}${location.hash}`, "_blank");
  }
  function toggleNotes() {
    const on = document.documentElement.classList.toggle("beeson-notes");
    notesButton.classList.toggle("on", on);
    notesButton.setAttribute("aria-pressed", String(on));
    relayout();
    follow();
    if (on) ensureNotes()?.focus({ preventScroll: true });
  }
  function ensureNotes() {
    const slide = current();
    if (!slide || !pairing?.blocks.length || !document.documentElement.classList.contains("beeson-notes")) return null;
    let aside = slide.querySelector(":scope > aside.notes");
    if (!aside) {
      aside = make("aside", "notes");
      aside.setAttribute("contenteditable", "true");
      aside.setAttribute("aria-label", "Speaker notes");
      slide.append(aside);
    }
    return aside;
  }
  var popover = null;
  var popoverFor = null;
  function closeMath(back = true) {
    popover?.remove();
    popover = null;
    const el = popoverFor;
    popoverFor = null;
    if (back && el?.isConnected) el.focus({ preventScroll: true });
  }
  async function setMath(container, tex) {
    const host = container.closest(HOST);
    if (!host) throw new Error("the formula is not in an editable block");
    const info = mathLookup()(container);
    const { error } = await previewTex(tex, info?.display ?? false);
    if (error) throw new Error(error);
    const before = contentWithTex(host);
    if (!await retypeset(host, container, tex)) throw new Error("MathJax does not find the formula with this TeX, and the slide is kept as it was");
    markMath(host);
    const after = contentWithTex(host);
    if (after !== before) history.push({ label: "formula", undo: () => restoreHost(host, before), redo: () => restoreHost(host, after) });
    markDirty();
  }
  function openMath(container) {
    const info = mathLookup()(container);
    if (!info) return;
    closeMath();
    const box2 = make("div", "beeson-math");
    box2.setAttribute("role", "dialog");
    box2.setAttribute("aria-modal", "true");
    box2.setAttribute("aria-label", "The TeX of the formula");
    popoverFor = container;
    const host = container.closest(HOST);
    const at = host ? [...host.querySelectorAll("mjx-container")].indexOf(container) : -1;
    const field = make("textarea");
    field.setAttribute("aria-label", "TeX of the formula");
    field.value = info.tex;
    field.rows = Math.min(12, Math.max(3, info.tex.split("\n").length + 1));
    const row = make("div", "row");
    const apply = make("button", "", "Apply");
    const cancel = make("button", "", "Cancel");
    const hint = make("span", "hint", `${info.open} \u2026 ${info.close}, \u2318 or Ctrl+Enter applies, Esc cancels`);
    const preview = make("div", "preview");
    const error = make("div", "error");
    error.setAttribute("role", "alert");
    row.append(apply, cancel, hint);
    box2.append(field, preview, row, error);
    const rect = container.getBoundingClientRect();
    box2.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - 656))}px`;
    box2.style.top = `${Math.max(52, Math.min(rect.bottom + 8, window.innerHeight - 420))}px`;
    let shown2 = 0;
    let timer = 0;
    const show = async () => {
      const seq = ++shown2;
      const result = await previewTex(field.value, info.display).catch((e) => ({ node: null, error: e instanceof Error ? e.message : String(e) }));
      if (seq !== shown2) return;
      preview.replaceChildren(...result.node ? [result.node] : []);
      error.textContent = result.error ?? "";
      apply.disabled = !!result.error;
    };
    void show();
    field.addEventListener("input", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(show, 150);
    });
    apply.addEventListener("click", async () => {
      try {
        await setMath(container, field.value);
        popoverFor = host?.querySelectorAll("mjx-container")[at] ?? null;
        closeMath();
      } catch (e) {
        error.textContent = e instanceof Error ? e.message : String(e);
      }
    });
    cancel.addEventListener("click", () => closeMath());
    field.addEventListener("keydown", (ev) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") {
        ev.preventDefault();
        apply.click();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        closeMath();
      }
    });
    box2.addEventListener("keydown", (ev) => {
      if (ev.key !== "Tab") return;
      ev.preventDefault();
      const stops = [field, apply, cancel].filter((el) => !el.disabled);
      const at2 = stops.indexOf(document.activeElement);
      stops[(at2 + (ev.shiftKey ? -1 : 1) + stops.length) % stops.length].focus();
    });
    document.body.append(box2);
    popover = box2;
    field.focus();
    field.select();
  }
  async function restoreHost(host, content) {
    showSlide(host);
    if (host.matches("aside.notes") && !document.documentElement.classList.contains("beeson-notes")) toggleNotes();
    const before = host.textContent ?? "";
    await setContentWithTex(host, content);
    markMath(host);
    history.track(host);
    markDirty();
    placeCaret(host, changeEnd(before, host.textContent ?? ""));
    follow();
  }
  function changeEnd(before, after) {
    if (before === after) return null;
    let head = 0;
    while (head < before.length && head < after.length && before[head] === after[head]) head++;
    let tail = 0;
    while (tail < before.length - head && tail < after.length - head && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
    return after.length - tail;
  }
  function placeCaret(host, offset = null) {
    if (!(host instanceof HTMLElement)) return;
    host.focus({ preventScroll: true });
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(host);
    range.collapse(false);
    if (offset !== null) {
      const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
      let left = offset;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (left <= node.length) {
          const math = node.parentElement?.closest("mjx-container");
          if (math && host.contains(math)) range.setStartAfter(math);
          else range.setStart(node, left);
          range.collapse(true);
          break;
        }
        left -= node.length;
      }
    }
    selection.removeAllRanges();
    selection.addRange(range);
  }
  function toggleFormat(host, tag) {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed || !host.contains(range.commonAncestorContainer)) return;
    const alias = tag === "strong" ? "b" : "i";
    const same = (el) => el.localName === tag || el.localName === alias;
    const formatOf = (node) => {
      for (let el = node instanceof Element ? node : node.parentElement; el && el !== host; el = el.parentElement) if (same(el)) return el;
      return null;
    };
    const unwrap = (root) => {
      for (const el of [...root.querySelectorAll(`${tag}, ${alias}`)]) el.replaceWith(...el.childNodes);
    };
    const common = range.commonAncestorContainer;
    const texts = [];
    if (common instanceof Text) texts.push(common);
    else {
      const walker = document.createTreeWalker(common, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const empty = node === range.startContainer && range.startOffset === node.length || node === range.endContainer && range.endOffset === 0;
        if (range.intersectsNode(node) && !empty && node.data.trim()) texts.push(node);
      }
    }
    const off = texts.length > 0 && texts.every((node) => formatOf(node));
    const outer = off ? formatOf(common) : null;
    let nodes;
    if (outer) {
      const start = [range.startContainer, range.startOffset];
      const tail = document.createRange();
      tail.setStart(range.endContainer, range.endOffset);
      tail.setEnd(outer, outer.childNodes.length);
      const after = outer.cloneNode(false);
      after.append(tail.extractContents());
      const head = document.createRange();
      head.setStart(outer, 0);
      head.setEnd(...start);
      const before = outer.cloneNode(false);
      before.append(head.extractContents());
      unwrap(outer);
      nodes = [...outer.childNodes];
      outer.before(before);
      outer.after(after);
      outer.replaceWith(...nodes);
    } else {
      const fragment = range.extractContents();
      unwrap(fragment);
      if (off) {
        nodes = [...fragment.childNodes];
        range.insertNode(fragment);
      } else {
        const el = document.createElement(tag);
        el.append(fragment);
        range.insertNode(el);
        nodes = [el];
      }
    }
    for (const el of [...host.querySelectorAll("strong, em, b, i")]) {
      if (!el.textContent && !el.querySelector("br, img, mjx-container")) el.remove();
    }
    if (nodes.length) {
      const selected = document.createRange();
      selected.setStartBefore(nodes[0]);
      selected.setEndAfter(nodes[nodes.length - 1]);
      selection.removeAllRanges();
      selection.addRange(selected);
    }
    host.normalize();
  }
  var hostOf = (target) => {
    const host = target instanceof Element ? target.closest(HOST) : null;
    return host && slides().contains(host) ? host : null;
  };
  function insertPlain(host, text) {
    if (host.closest("pre")) {
      document.execCommand("insertText", false, text);
      return;
    }
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (line) document.execCommand("insertText", false, line);
      if (i < lines.length - 1) document.execCommand("insertLineBreak");
    });
  }
  function onBeforeInput(ev) {
    const host = hostOf(ev.target);
    if (!host) return;
    const type = ev.inputType;
    if (type === "historyUndo" || type === "historyRedo") {
      ev.preventDefault();
      void (type === "historyUndo" ? history.undo() : history.redo()).catch(fail2);
      return;
    }
    if (type === "formatBold" || type === "formatItalic") {
      ev.preventDefault();
      history.break();
      history.beforeTyping(host);
      toggleFormat(host, type === "formatBold" ? "strong" : "em");
      history.afterTyping(host);
      history.break();
      markDirty();
      follow();
      return;
    }
    if (type === "insertParagraph" || type === "insertLineBreak") history.break();
    history.beforeTyping(host);
    if (type === "insertParagraph" || type === "insertLineBreak") {
      ev.preventDefault();
      insertPlain(host, "\n");
    } else if (type === "insertFromPaste") {
      ev.preventDefault();
      insertPlain(host, ev.dataTransfer?.getData("text/plain") ?? "");
    } else if (type === "insertFromDrop" || type.startsWith("format") || type.startsWith("insertOrdered") || type.startsWith("insertUnordered") || type === "insertHorizontalRule" || type === "insertLink") {
      ev.preventDefault();
    }
  }
  function onKeyDown(ev) {
    const mod = ev.metaKey || ev.ctrlKey;
    const key = ev.key.toLowerCase();
    const target = ev.target instanceof Element ? ev.target : null;
    const inField = !!target?.closest(".beeson-math, input, textarea, select");
    const active = document.activeElement;
    if (mod && !ev.altKey && key === "s") {
      ev.preventDefault();
      void (ev.shiftKey ? saveAs() : save()).catch(fail2);
    } else if (mod && !ev.altKey && !inField && (key === "z" || key === "y" && !ev.shiftKey)) {
      ev.preventDefault();
      ev.stopPropagation();
      void (key === "y" || ev.shiftKey ? history.redo() : history.undo()).catch(fail2);
    } else if ((ev.key === "Enter" || ev.key === " ") && !popover && active instanceof Element && active.matches("mjx-container") && hostOf(active)) {
      ev.preventDefault();
      ev.stopPropagation();
      openMath(active);
    } else if (ev.key === "Escape" && !problemsCard.hidden) {
      closeProblems();
      ev.stopPropagation();
    } else if (ev.key === "Escape" && !ask.hidden) {
      answer(null);
      ev.stopPropagation();
    } else if (!popover && move.onKey(ev)) {
      ev.preventDefault();
      ev.stopPropagation();
    } else if (ev.key === "Escape") {
      const host = hostOf(active);
      if (popover) {
        closeMath();
        ev.stopPropagation();
      } else if (host) {
        host.blur();
        move.select(move.movableOf(host));
        ev.stopPropagation();
      }
    }
  }
  function onClick(ev) {
    const target = ev.target instanceof Element ? ev.target : null;
    const container = target?.closest("mjx-container");
    if (container && hostOf(container)) {
      ev.preventDefault();
      openMath(container);
    } else if (popover && target && !popover.contains(target)) closeMath(false);
  }
  function checkOverflow() {
    const slide = current();
    const box2 = slides().getBoundingClientRect();
    let n = 0;
    if (slide && box2.width > 0) {
      const foot = slide.querySelector(":scope > .foot");
      const f = foot?.getBoundingClientRect();
      const past = (r) => r.right > box2.right + 1 || r.bottom > box2.bottom + 1 || r.left < box2.left - 1 || r.top < box2.top - 1;
      const intoFoot = (r) => !!f && f.height > 0 && r.bottom > f.top + 1 && r.top < f.bottom - 1 && r.right > f.left + 1 && r.left < f.right - 1;
      for (const el of slide.querySelectorAll(HOST)) {
        if (el.closest("aside.notes, .backdrop")) continue;
        const r = el.getBoundingClientRect();
        const out = r.width > 0 && r.height > 0 && (past(r) || el !== foot && !foot?.contains(el) && intoFoot(r));
        el.classList.toggle("beeson-overflow", out);
        if (out) n += 1;
      }
    }
    if (n !== overflowing) {
      overflowing = n;
      report();
    }
  }
  var revealReady = () => new Promise((done) => {
    const tick = () => deck()?.isReady() ? done() : setTimeout(tick, 50);
    tick();
  });
  async function fetchSource() {
    if (location.protocol === "file:") return false;
    try {
      const response = await fetch(location.href.split(/[?#]/)[0], { cache: "no-store" });
      if (!response.ok) return false;
      open(await response.text());
      return true;
    } catch {
      return false;
    }
  }
  async function init() {
    const style = make("style");
    style.id = "beeson-editor";
    style.textContent = CSS;
    document.head.append(style);
    document.body.append(top, bottom, pane, resizer, nav.pane, steps.pane, steps.badges, move.frame, move.selectedFrame, move.handle, move.guideV, move.guideH, move.offset, card, recover, ask, problemsCard);
    document.documentElement.classList.add("beeson-editor");
    autosave = canWrite() && stored(AUTOSAVE_KEY) === "1";
    if (!canWrite()) {
      autosaveButton.disabled = true;
      autosaveButton.title = "Autosave needs a browser that writes the file in place, i.e. Chrome or Edge";
    }
    setPane(Number(stored(PANE_KEY)) || 200);
    const wire = (el, action) => el.addEventListener("click", (ev) => {
      if (ev.detail > 0) el.blur();
      Promise.resolve().then(action).catch(fail2);
    });
    wire(openButton, openFile);
    wire(cardButton, openFile);
    wire(saveButton, save);
    wire(saveAsButton, saveAs);
    wire(autosaveButton, toggleAutosave);
    wire(presentButton, present);
    wire(undoButton, () => history.undo());
    wire(redoButton, () => history.redo());
    wire(prevButton, () => deck()?.left());
    wire(nextButton, () => deck()?.right());
    wire(notesButton, toggleNotes);
    wire(restoreButton, restoreDraft);
    wire(copyButton, copyDraft);
    wire(discardButton, discardDraft);
    wire(askSave, () => answer("save"));
    wire(askDiscard, () => answer("discard"));
    wire(askCancel, () => answer(null));
    wire(whichButton, showProblems);
    wire(problemsClose, closeProblems);
    resizer.addEventListener("keydown", (ev) => {
      const step = ev.key === "ArrowUp" ? 20 : ev.key === "ArrowDown" ? -20 : 0;
      if (!step) return;
      ev.preventDefault();
      ev.stopPropagation();
      setPane(paneHeight + step);
      store(PANE_KEY, String(paneHeight));
    });
    resizer.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      const startY = ev.clientY;
      const startHeight = paneHeight;
      const onMove = (e) => setPane(startHeight + startY - e.clientY);
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        store(PANE_KEY, String(paneHeight));
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
    document.addEventListener("beforeinput", onBeforeInput);
    document.addEventListener("input", (ev) => {
      const host = hostOf(ev.target);
      if (!host) return;
      history.afterTyping(host);
      markDirty();
      follow();
    });
    document.addEventListener("focusin", (ev) => {
      const host = hostOf(ev.target);
      if (host) history.track(host);
      follow();
    });
    document.addEventListener("focusout", () => setTimeout(follow, 0));
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("click", onClick);
    window.addEventListener("beforeunload", (ev) => {
      if (dirty) ev.preventDefault();
    });
    report();
    await revealReady();
    const d = deck();
    if (d) {
      d.configure({ transition: "none", backgroundTransition: "none", fragments: false, keyboard: { 27: null, 79: null, 66: null, 86: null, 190: null, 70: null, 191: null, 83: null } });
      d.layout();
      d.on("slidechanged", () => {
        count();
        closeMath(false);
        move.select(null);
        ensureNotes();
        follow();
      });
      d.on("resize", () => {
        layout();
        follow();
      });
      count();
      layout();
    }
    await mathReady();
    if (!await fetchSource()) {
      state = "waiting";
      report();
    }
  }
  var BeesonEditor = {
    ready: init(),
    open,
    render,
    status,
    save,
    saveAs,
    setMath,
    undo: () => history.undo(),
    redo: () => history.redo(),
    toggleAutosave,
    restoreDraft,
    setPane,
    // the file written by save, for a test with a handle of the origin private file system
    attach: (h) => {
      handle = h;
    },
    version: "0.9.0-beta.1"
  };
  window.BeesonEditor = BeesonEditor;
})();
