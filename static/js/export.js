// Export settings for the open project: shape (16:9, 9:16, 1:1), 1080p or 4K, 24 or 60 fps.
// The same picker shows in the Export menu and in the quick pop-up on the badge next to Send.

import { $, esc, postJson } from "./util.js";
import { state } from "./state.js";
import { renderGuide } from "./guide.js";

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

export function exportPicker() {
  const wrap = document.createElement("div");
  wrap.className = "group";
  wrap.innerHTML = `<h3>Export for ${esc(state.project || "this project")}</h3>`;
  wrap.appendChild(pickerRows(false));
  const note = document.createElement("div");
  note.className = "estimate";
  note.innerHTML = `Every render uses the highest quality setting. A 6-second video at <b>${esc(exportLabel(state.exp))}</b> takes ${ESTIMATE[`${state.exp.res}-${state.exp.fps}`]} to render. Longer videos take longer.`;
  wrap.appendChild(note);
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
  if (!pop.hidden) { pop.innerHTML = ""; pop.appendChild(pickerRows(true)); }
  if (state.tab === "export") renderGuide();
}

function togglePop(open = $("#exportPop").hidden) {
  const pop = $("#exportPop");
  pop.hidden = !open;
  $("#exportBadge").setAttribute("aria-expanded", String(open));
  if (open) { pop.innerHTML = ""; pop.appendChild(pickerRows(true)); }
}

export function initExport() {
  $("#exportBadge").onclick = (e) => { e.stopPropagation(); togglePop(); };
  // Clicks inside the pop-up rebuild it, so stop them here rather than testing the target later.
  $("#exportPop").addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => { if (!$("#exportPop").hidden) togglePop(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") togglePop(false); });
}
