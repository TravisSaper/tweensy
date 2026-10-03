// Picking, creating and opening projects.

import { $, esc, api, postJson } from "./util.js";
import { state } from "./state.js";
import { renderGuide } from "./guide.js";
import { exportLabel } from "./export.js";
import { renderHistory, setBusy, watchBusyProject } from "./chat.js";
import { loadVideos } from "./videos.js";

export async function loadProjects(select) {
  let list = await api("/api/projects");
  if (!list.length) {
    await postJson("/api/projects", { name: "my-first-project" });
    list = await api("/api/projects");
  }
  let saved = null;
  try { saved = localStorage.getItem("ms-project"); } catch {}
  const want = select || state.project || saved;
  const sel = $("#project");
  sel.innerHTML = list.map((p) => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join("");
  sel.value = list.some((p) => p.name === want) ? want : list[0].name;
  await openProject(sel.value);
}

async function openProject(name) {
  state.project = name;
  state.selected = null;
  try { localStorage.setItem("ms-project", name); } catch {}
  const data = await api(`/api/projects/${encodeURIComponent(name)}/history`);
  renderHistory(data.history || []);
  $("#folder").textContent = "Project folder: " + (data.path || "");
  state.exp = data.export || { res: "4k", fps: 60 };
  $("#exportLabel").textContent = exportLabel(state.exp);
  if (state.tab === "export") renderGuide();
  setBusy(!!data.busy);
  await loadVideos();
  if (data.busy) watchBusyProject(name, data.progress);
}

export function initProjects() {
  $("#project").onchange = (e) => openProject(e.target.value);
  $("#newProject").onclick = async () => {
    const name = prompt("Name your new project (for example: product-promo)");
    if (!name || !name.trim()) return;
    const res = await postJson("/api/projects", { name });
    await loadProjects(res.name);
  };
}
