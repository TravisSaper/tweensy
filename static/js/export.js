// Export settings for the open project: shape (16:9, 9:16, 1:1), 1080p or 4K, 24 or 60 fps.
// Shape, quality and frame rate live in the pop-up on the badge next to Send, with the special formats below.

import { $, postJson } from "./util.js";
import { state } from "./state.js";
import { setInput } from "./guide.js";

// Rough render times for a 6-second video (measured at 16:9 for 1080p/4K at 60 fps).
const ESTIMATE = {
  "1080p-24": "about 7 s", "1080p-60": "about 10 s", "4k-24": "about 20 s", "4k-60": "about 45 s",
};

const ROWS = [
  ["Shape", "aspect", [["16:9", "16:9", "Wide"], ["9:16", "9:16", "Phone"], ["1:1", "1:1", "Square"]]],
  ["Quality", "res", [["1080p", "1080p", "Faster"], ["4k", "4K", "Sharpest"]]],
  ["Frame rate", "fps", [[24, "24 fps", "Cinematic"], [60, "60 fps", "Extra smooth"]]],
];

export function exportLabel(e) {
  return `${e.aspect} · ${e.res === "4k" ? "4K" : "1080p"} · ${e.fps} fps`;
}

// Segmented rows for every setting; a click saves right away.
function pickerRows(compact) {
  const wrap = document.createElement("div");
  wrap.className = "picker" + (compact ? " compact" : "");
  wrap.innerHTML = ROWS.map(([name, key, opts]) => `<div><div class="field-label">${name}</div><div class="seg">` +
    opts.map(([val, title, sub]) => `<button data-key="${key}" data-val="${val}" class="${String(state.exp[key]) === String(val) ? "on" : ""}">${title}${compact ? "" : `<small>${sub}</small>`}</button>`).join("") +
    "</div></div>").join("");
  wrap.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => {
    const val = b.dataset.key === "fps" ? Number(b.dataset.val) : b.dataset.val;
    saveExport({ ...state.exp, [b.dataset.key]: val });
  }));
  return wrap;
}

// Save, then refresh everything that shows the setting.
export async function saveExport(next) {
  state.exp = next;
  refreshExport();
  if (state.project) state.exp = await postJson(`/api/projects/${encodeURIComponent(state.project)}/export`, next);
  refreshExport();
}

export function refreshExport() {
  $("#exportLabel").textContent = exportLabel(state.exp);
  const pop = $("#exportPop");
  if (!pop.hidden) pop.replaceChildren(popContent());
}

// Everything about how renders come out, in one place.
function popContent() {
  const wrap = document.createElement("div");
  wrap.appendChild(pickerRows(true));
  const est = ESTIMATE[`${state.exp.res}-${state.exp.fps}`];
  if (est) wrap.insertAdjacentHTML("beforeend", `<div class="pop-note hint">A 6-second video takes ${est} to render at this setting.</div>`);
  const formats = state.guide.find((s) => s.id === "export")?.items || [];
  if (formats.length) {
    wrap.insertAdjacentHTML("beforeend", `<div class="field-label pop-more">More formats</div><div class="chips"></div>`);
    formats.forEach((it) => {
      const b = document.createElement("button");
      b.className = "chip"; b.type = "button"; b.textContent = it.label; b.title = it.note || it.text;
      b.onclick = () => { setInput(it.text); togglePop(false); };
      wrap.querySelector(".chips").appendChild(b);
    });
  }
  return wrap;
}

function togglePop(open = $("#exportPop").hidden) {
  const pop = $("#exportPop");
  pop.hidden = !open;
  $("#exportBadge").setAttribute("aria-expanded", String(open));
  if (open) pop.replaceChildren(popContent());
}

export function initExport() {
  $("#exportBadge").onclick = (e) => { e.stopPropagation(); togglePop(); };
  // Clicks inside the pop-up rebuild it, so stop them here rather than testing the target later.
  $("#exportPop").addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => { if (!$("#exportPop").hidden) togglePop(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") togglePop(false); });
}
