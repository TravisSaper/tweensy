// A tiny Markdown renderer for Claude's replies: paragraphs, lists, headings, code, bold,
// italics and links. Input is escaped first, so replies can't inject HTML.

import { esc } from "./util.js";

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,)!?]|$)/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

export function md(src) {
  const out = [];
  const parts = esc(src).split(/```[a-zA-Z0-9]*\n?/);
  parts.forEach((part, i) => {
    if (i % 2 === 1) { out.push("<pre><code>" + part.replace(/\n$/, "") + "</code></pre>"); return; }
    let list = null, para = [];
    const flushL = () => { if (list) { out.push(`<${list.tag}>` + list.items.map((x) => `<li>${inline(x)}</li>`).join("") + `</${list.tag}>`); list = null; } };
    const flushP = () => { if (para.length) { out.push("<p>" + inline(para.join("<br>")) + "</p>"); para = []; } };
    for (const line of part.split("\n")) {
      const ul = line.match(/^\s*[-*•]\s+(.*)/), ol = line.match(/^\s*\d+[.)]\s+(.*)/), h = line.match(/^#{1,4}\s+(.*)/);
      if (ul || ol) {
        flushP();
        const tag = ul ? "ul" : "ol";
        if (!list || list.tag !== tag) { flushL(); list = { tag, items: [] }; }
        list.items.push((ul || ol)[1]);
      } else if (h) { flushP(); flushL(); out.push("<h4>" + inline(h[1]) + "</h4>"); }
      else if (!line.trim()) { flushP(); flushL(); }
      else { flushL(); para.push(line); }
    }
    flushP(); flushL();
  });
  return out.join("");
}
