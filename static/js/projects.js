// Picking, creating and opening projects.

import { $, esc, api, postJson } from "./util.js";
import { state } from "./state.js";
import { renderGuide } from "./guide.js";
import { refreshExport } from "./export.js";
import { renderHistory, setBusy, watchBusyProject } from "./chat.js";
import { loadVideos } from "./videos.js";
import { askText } from "./dialog.js";

// Same rules as the server (tweensy/projects.py), so the preview matches the folder it makes.
function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "project";
}

function folderName(name) {
  const taken = new Set([...$("#project").options].map((o) => o.value));
  const base = slugify(name);
  let slug = base, n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;
  return { slug, renamed: slug !== base };
}

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
  state.exp = data.export || { aspect: "16:9", res: "4k", fps: 60 };
  refreshExport();
  setBusy(!!data.busy);
  await loadVideos();
  if (data.busy) watchBusyProject(name, data.progress);
}

export function initProjects() {
  $("#project").onchange = (e) => openProject(e.target.value);
  $("#newProject").onclick = async () => {
    const name = await askText({
      title: "New project",
      text: "Each video gets its own project, with its own chat, files and settings.",
      placeholder: "For example: Product promo",
      okText: "Create",
      hint: (value) => {
        if (!value.trim()) return "";
        const { slug, renamed } = folderName(value);
        return `Saved as <code>${esc(slug)}</code>${renamed ? " (that name is already taken)" : ""}`;
      },
    });
    if (!name) return;
    const res = await postJson("/api/projects", { name });
    await loadProjects(res.name);
  };
}
