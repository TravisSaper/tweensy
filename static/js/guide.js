// The bottom navigation bar and the guide panel it controls.

import { $, esc } from "./util.js";
import { state, MOBILE } from "./state.js";
import { exportPicker } from "./export.js";
import { openBoard } from "./sketch.js";
import { autosize } from "./chat.js";

// Menus in the bottom bar. Guide menus fill the left panel; Chat and Videos are their own
// panels (always visible on wide screens, so those two buttons only show on small screens).
const ICON = {
  guide: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/>',
  examples: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
  animations: '<path d="M4 17c3-8 6-8 8 0s5 8 8 0"/><circle cx="4" cy="17" r="1.5"/><circle cx="20" cy="17" r="1.5"/>',
  styles: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.3"/><circle cx="12" cy="7.5" r="1.3"/><circle cx="16" cy="10" r="1.3"/><path d="M13 21a3 3 0 0 1 0-6h3"/>',
  export: '<path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14"/>',
  sketch: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  fix: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  videos: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5M16 4v5"/>',
};

// Each menu shows these guide sections (ids from tweensy/guide.py).
export const TABS = [
  { id: "guide", label: "Guide", sections: ["start", "setup", "first"], intro: "Start here: how it works, setup, and your first video." },
  { id: "examples", label: "Examples", sections: ["make", "polish"], intro: "Ready-made requests. Swap the [brackets] for your own." },
  { id: "animations", label: "Animations", sections: ["moves", "change"], intro: "Motion moves and quick changes. Click one, then finish the sentence." },
  { id: "styles", label: "Styles", sections: ["styles"], intro: "Pick an example first, then add a style underneath it." },
  { id: "sketch", label: "Sketch", sections: [], intro: "Storyboard your video scene by scene. Claude turns it into a finished animation." },
  { id: "export", label: "Export", sections: ["export"], intro: "Choose quality for this project, or export a special format." },
  { id: "fix", label: "Fix", sections: ["fix"], intro: "Something looks off? Click the problem." },
  { id: "chat", label: "Chat", mobile: true },
  { id: "videos", label: "Videos", mobile: true },
];

export function buildNav() {
  $("#nav").innerHTML = TABS.map((t) => `<button data-tab="${t.id}" class="${t.mobile ? "mobile-only" : ""}" aria-label="${t.label}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${ICON[t.id]}</svg>${t.label}</button>`).join("");
  $("#nav").querySelectorAll("button").forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
  MOBILE.addEventListener("change", () => showTab(MOBILE.matches ? "chat" : state.tab));
}

export function showTab(id) {
  const tab = TABS.find((t) => t.id === id) || TABS[0];
  const isGuide = !tab.mobile;
  if (isGuide) {
    state.tab = tab.id;
    try { localStorage.setItem("ms-tab", tab.id); } catch {}
    renderGuide();
  }
  const view = isGuide ? "guide" : tab.id;
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("on", p.dataset.view === view));
  document.querySelectorAll("#nav button").forEach((b) => {
    const on = MOBILE.matches ? b.dataset.tab === id : b.dataset.tab === state.tab;
    b.classList.toggle("on", on);
  });
}

// Put text in the chat box (or add it under what's there, for style blocks).
export function setInput(text, append = false) {
  const box = $("#input");
  box.value = append && box.value.trim() ? box.value.replace(/\s+$/, "") + "\n\n" + text : text;
  if (MOBILE.matches) showTab("chat");
  autosize();
  box.focus();
  box.setSelectionRange(box.value.length, box.value.length);
}

export function renderGuide() {
  const tab = TABS.find((t) => t.id === state.tab);
  $("#guideTitle").textContent = tab.label;
  const root = $("#guide");
  root.innerHTML = `<div class="tab-intro">${esc(tab.intro)}</div>`;
  if (tab.id === "export") root.appendChild(exportPicker());
  if (tab.id === "sketch") root.appendChild(sketchIntro());
  tab.sections.forEach((sid) => {
    const sec = state.guide.find((s) => s.id === sid);
    if (sec) root.appendChild(renderSection(sec));
  });
  root.scrollTop = 0;
}

function sketchIntro() {
  const el = document.createElement("div");
  el.className = "group";
  el.innerHTML = `<button class="btn primary sketch-start">Open the storyboard</button>
    <h3>How it works</h3>
    <p>Draw scene 1, press <b>+ Add scene</b> for the next one, and so on. Under each scene, optionally say
    the style and the transition into the next scene ("Neon Pop, whip-pan to the next scene").</p>
    <h3>How to draw a scene</h3>
    <ul class="legend">
      <li><span class="swatch" style="background:#1d1b2e"></span><b>Pen</b>: boxes, text and shapes where they sit on screen</li>
      <li><span class="swatch" style="background:#e11d48"></span><b>Arrow</b>: how something moves. Write 1, 2, 3 for the order</li>
      <li><span class="swatch" style="background:#2563eb"></span><b>Text</b>: labels like "Logo", "100" or "Title"</li>
    </ul>
    <p>Rough is fine. Claude keeps your layouts, motion and order and makes it look finished. If a scene is really unclear, Claude asks you a few short questions before building.</p>`;
  el.querySelector("button").onclick = openBoard;
  return el;
}

function renderSection(sec) {
  const el = document.createElement("div");
  el.className = "group";
  el.innerHTML = `<h3>${esc(sec.title)}</h3><p>${esc(sec.body)}</p>`;
  let chips = null;
  sec.items.forEach((it) => {
    if (it.kind === "tweak" || it.kind === "move") {
      if (!chips) { chips = document.createElement("div"); chips.className = "chips"; el.appendChild(chips); }
      const b = document.createElement("button");
      b.className = "chip"; b.textContent = it.label; b.title = it.text;
      b.onclick = () => setInput(it.text);
      chips.appendChild(b);
      return;
    }
    chips = null;
    el.appendChild(renderCard(it));
  });
  return el;
}

function renderCard(it) {
  const isStyle = it.kind === "style";
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<div class="lbl">${esc(it.label)}</div>
    ${it.note ? `<div class="note">${esc(it.note)}</div>` : ""}
    <div class="preview">${esc(it.text)}</div>
    <div class="row"></div>`;
  const use = document.createElement("button");
  use.className = "btn small primary";
  use.textContent = isStyle ? "Add under my prompt" : "Use this prompt";
  use.onclick = () => setInput(it.text, isStyle);
  const copy = document.createElement("button");
  copy.className = "btn small"; copy.textContent = "Copy";
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(it.text); copy.textContent = "Copied"; setTimeout(() => (copy.textContent = "Copy"), 1200); } catch {}
  };
  card.querySelector(".row").append(use, copy);
  return card;
}
