// The Settings menu: light/dark mode and the port Tweensy runs on.

import { $, api, postJson } from "./util.js";

const THEMES = [["system", "System"], ["light", "Light"], ["dark", "Dark"]];
const DARK = matchMedia("(prefers-color-scheme: dark)");

function savedTheme() {
  try { return localStorage.getItem("ms-theme") || "system"; } catch { return "system"; }
}

function applyTheme() {
  const t = savedTheme();
  document.documentElement.dataset.theme = t === "system" ? (DARK.matches ? "dark" : "light") : t;
}
DARK.addEventListener("change", applyTheme);

export function settingsPanel() {
  const el = document.createElement("div");
  el.innerHTML = `<div class="group">
      <h3>Appearance</h3>
      <div class="seg theme-seg">${THEMES.map(([v, label]) =>
        `<button data-theme="${v}" class="${savedTheme() === v ? "on" : ""}">${label}</button>`).join("")}</div>
    </div>
    <div class="group">
      <h3>Port</h3>
      <p class="hint">Tweensy opens at localhost and this number. Change it if another app already uses it.</p>
      <div class="port-field">
        <input id="portInput" type="text" inputmode="numeric" autocomplete="off" aria-label="Port" />
        <button class="btn" id="portSave">Save</button>
      </div>
      <p class="hint" id="portNote"></p>
    </div>`;
  el.querySelectorAll(".theme-seg button").forEach((b) => (b.onclick = () => {
    try { localStorage.setItem("ms-theme", b.dataset.theme); } catch {}
    applyTheme();
    el.querySelectorAll(".theme-seg button").forEach((x) => x.classList.toggle("on", x === b));
  }));
  const input = el.querySelector("#portInput");
  api("/api/settings").then((s) => { if (!input.value) input.value = s.saved_port || s.port; });
  el.querySelector("#portSave").onclick = savePort;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") savePort(); });
  return el;
}

async function savePort() {
  const raw = $("#portInput").value.trim();
  const d = await postJson("/api/port", { port: /^\d+$/.test(raw) ? Number(raw) : null });
  $("#portNote").textContent = d.error ||
    (d.port === Number(location.port) ? "Saved." : `Saved. Close Tweensy, open it again, then go to localhost:${d.port}`);
}
