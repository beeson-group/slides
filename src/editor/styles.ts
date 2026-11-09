// the styles of the editor, added to the page by main.ts. the colors are the custom properties of
// theme/beeson.css, with a fallback for a deck on another theme. the layout follows the normal view
// of PowerPoint: a toolbar at the top, the slide in the middle, the notes in a pane under it, and
// a status bar at the bottom. --beeson-scale is the scale of the slide, --beeson-gap the room under
// the slide in the viewport of reveal.js, and --beeson-side the room beside it on each side, in
// slide pixels, all set by main.ts

export const CSS = `
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
