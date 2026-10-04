// "Your styles": styles people make themselves, by typing the rules or designing them with Claude.
// They live in styles.json (tweensy/styles.py) and show under the built-in styles in every project.

import { $, api, postJson } from "./util.js";
import { compactRow, renderCard, renderGuide, setInput } from "./guide.js";
import { state, MOBILE } from "./state.js";
import { confirmBox } from "./dialog.js";

const TEMPLATE = `- Font:
- Colours:
- Motion:
- Layout: `;

const DESIGN_PROMPT = `Help me design my own Tweensy style. Don't build or render a video yet.
The look I'm after: [describe the mood, colours, fonts, or a brand or film you like]
Ask me up to 3 short questions if you need to. Then write the finished style in exactly this format, so I can save it:

STYLE: <a short name>
- Font: (from Google Fonts, with weights)
- Colours: (hex codes and what each is for)
- Motion: (how things enter, move and leave, with timings and easing)
- Layout: (spacing, alignment, what sits where)`;

let mine = [];
let editing = null; // id of the style being edited, or null for a new one

export function yourStyles() {
  const el = document.createElement("div");
  el.className = "group your-styles";
  el.innerHTML = `<h3>Your styles</h3><p>Styles you make show up here in every project.</p><div class="mine"></div>
    <button class="btn add-style">+ Add your own style</button>`;
  el.querySelector(".add-style").onclick = () => openEditor();
  fill(el.querySelector(".mine"));
  return el;
}

async function fill(box) {
  mine = await api("/api/styles");
  box.innerHTML = mine.length ? "" : `<div class="hint mine-empty">None yet.</div>`;
  mine.forEach((s) => {
    const item = { kind: "style", label: s.label, note: s.note, text: s.text };
    if (MOBILE.matches) { box.appendChild(myCard(s, item)); return; }
    const row = compactRow(item, () => myCard(s, item), "mine");
    const colours = coloursOf(s.text);
    if (colours) row.querySelector(".crow-mark").style.background = `linear-gradient(135deg, ${colours[0]} 50%, ${colours[1]} 50%)`;
    box.appendChild(row);
  });
}

// The full card: the built-in card plus Edit and Delete, painted in the style's own colours.
function myCard(s, item) {
  const card = renderCard(item);
  card.dataset.style = "mine";
  const colours = coloursOf(s.text);
  if (colours) {
    card.querySelector(".style-swatch").style.background = colours[0];
    card.querySelector(".style-swatch span").style.color = colours[1];
  }
  const edit = document.createElement("button");
  edit.className = "btn small"; edit.textContent = "Edit";
  edit.onclick = () => openEditor(s);
  const del = document.createElement("button");
  del.className = "btn small"; del.textContent = "Delete";
  del.onclick = async () => {
    if (!(await confirmBox({ title: `Delete “${s.label}”?`, text: "Videos you already made with it stay as they are.", okText: "Delete" }))) return;
    await postJson("/api/styles/delete", { id: s.id });
    refresh();
  };
  card.querySelector(".row").append(edit, del);
  return card;
}

// [background, text] from the hex codes named in a style's rules: darkest and lightest, if they read well.
function coloursOf(text) {
  const hexes = [...new Set((text.match(/#[0-9a-f]{6}\b/gi) || []).map((h) => h.toLowerCase()))];
  if (hexes.length < 2) return null;
  const lum = (h) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const sorted = hexes.sort((a, b) => lum(a) - lum(b));
  const [bg, fg] = [sorted[0], sorted[sorted.length - 1]];
  return (lum(fg) + 0.05) / (lum(bg) + 0.05) < 3 ? null : [bg, fg];
}

function refresh() {
  if (state.tab === "styles") renderGuide();
}

// ---------- editor: pick how, then type it in (or hand over to the chat) ----------
function openEditor(style) {
  editing = style?.id || null;
  $("#styleEditorTitle").textContent = style ? `Edit “${style.label}”` : "Add your own style";
  $("#styleChoice").hidden = !!style;
  $("#styleForm").hidden = !style;
  $("#styleBack").hidden = !!style;
  $("#styleName").value = style?.label || "";
  $("#styleNote").value = style?.note || "";
  $("#styleText").value = style ? style.text.replace(/^STYLE:[^\n]*\n?/, "") : TEMPLATE;
  $("#styleFormNote").textContent = "";
  $("#styleEditor").hidden = false;
  if (style) $("#styleName").focus();
}

const closeEditor = () => { $("#styleEditor").hidden = true; };

function showForm() {
  $("#styleChoice").hidden = true;
  $("#styleForm").hidden = false;
  $("#styleName").focus();
}

async function saveForm(e) {
  e.preventDefault();
  const r = await postJson("/api/styles", { id: editing, label: $("#styleName").value, note: $("#styleNote").value, text: $("#styleText").value });
  if (r.error) { $("#styleFormNote").textContent = r.error; return; }
  closeEditor();
  refresh();
}

// ---------- styles Claude writes in the chat ----------
// Finds "STYLE: Name" followed by "- Font: …" lines in a reply (bold or code fences are fine).
export function findStyle(text) {
  const clean = (text || "").replace(/```[a-z]*\n?/gi, "").replace(/\*\*/g, "").replace(/`/g, "");
  const m = clean.match(/^\s*STYLE:\s*(.+)\n((?:[ \t]*[-•*].*(?:\n|$))+)/m);
  if (!m) return null;
  const label = m[1].trim().slice(0, 40);
  return { label, text: `STYLE: ${label}\n${m[2].trimEnd()}` };
}

export function styleSaveButton(text) {
  const found = findStyle(text);
  if (!found) return null;
  const b = document.createElement("button");
  b.className = "btn primary save-style";
  const done = () => { b.disabled = true; b.textContent = "Saved to Your styles ✓"; };
  b.textContent = `Save “${found.label}” to Your styles`;
  b.onclick = async () => {
    const r = await postJson("/api/styles", found);
    if (r.error) { b.textContent = r.error; return; }
    mine.push(r);
    done();
    refresh();
  };
  if (mine.some((s) => s.text === found.text)) done();
  return b;
}

export function initMyStyles() {
  $("#styleEditorClose").onclick = closeEditor;
  $("#styleEditor").addEventListener("click", (e) => { if (e.target.id === "styleEditor") closeEditor(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#styleEditor").hidden) closeEditor(); });
  $("#styleTypeIt").onclick = showForm;
  $("#styleBack").onclick = () => { $("#styleForm").hidden = true; $("#styleChoice").hidden = false; };
  $("#styleAskClaude").onclick = () => { closeEditor(); setInput(DESIGN_PROMPT); selectPlaceholder(); };
  $("#styleForm").onsubmit = saveForm;
  api("/api/styles").then((list) => { mine = list; });
}

// Select the [describe …] placeholder so typing replaces it.
function selectPlaceholder() {
  const box = $("#input"), i = box.value.lastIndexOf("[describe");
  if (i >= 0) box.setSelectionRange(i, box.value.indexOf("]", i) + 1);
}
