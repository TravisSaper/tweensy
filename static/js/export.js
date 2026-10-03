// The Export menu's quality picker (1080p or 4K, 30 or 60 fps), saved per project.

import { $, esc, postJson } from "./util.js";
import { state } from "./state.js";
import { renderGuide, showTab } from "./guide.js";

// Measured for the first-video example on a 20-core laptop.
const ESTIMATE = {
  "1080p-30": "about 8 s", "1080p-60": "about 10 s", "4k-30": "about 25 s", "4k-60": "about 45 s",
};

export function exportLabel(e) {
  return `${e.res === "4k" ? "4K" : "1080p"} · ${e.fps} fps`;
}

export function exportPicker() {
  const wrap = document.createElement("div");
  wrap.className = "group picker";
  const e = state.exp;
  const seg = (name, opts) => `<div><div class="field-label">${name}</div><div class="seg">` +
    opts.map(([key, val, title, sub]) => `<button data-${key}="${val}" class="${String(e[key]) === String(val) ? "on" : ""}">${title}<small>${sub}</small></button>`).join("") + "</div></div>";
  wrap.innerHTML = `<h3>Quality for ${esc(state.project || "this project")}</h3>` +
    seg("Resolution", [["res", "1080p", "1080p", "Full HD · faster"], ["res", "4k", "4K", "Ultra HD · sharpest"]]) +
    seg("Frame rate", [["fps", 30, "30 fps", "Standard"], ["fps", 60, "60 fps", "Extra smooth"]]) +
    `<div class="estimate">Every render uses the highest quality setting. A 6-second video at <b>${exportLabel(e)}</b> takes ${ESTIMATE[`${e.res}-${e.fps}`]} to render. Longer videos take longer.</div>`;
  wrap.querySelectorAll(".seg button").forEach((b) => (b.onclick = async () => {
    const next = { ...state.exp };
    if (b.dataset.res) next.res = b.dataset.res;
    if (b.dataset.fps) next.fps = Number(b.dataset.fps);
    await saveExport(next);
    renderGuide();
  }));
  return wrap;
}

async function saveExport(next) {
  state.exp = next;
  $("#exportLabel").textContent = exportLabel(next);
  if (state.project) state.exp = await postJson(`/api/projects/${encodeURIComponent(state.project)}/export`, next);
  $("#exportLabel").textContent = exportLabel(state.exp);
}

export function initExport() {
  $("#exportBadge").onclick = () => showTab("export");
}
