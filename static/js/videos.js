// The Videos panel: list of renders in the project and the player.

import { $, esc, api, postJson } from "./util.js";
import { confirmBox, notice } from "./dialog.js";
import { state } from "./state.js";

export function fmtSize(n) {
  return n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB";
}

export function fmtTime(t) {
  return new Date(t * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Versions come first (friendly labels, Current badge, Restore, Compare); older renders follow.
export async function loadVideos() {
  if (!state.project) return;
  const name = state.project, q = encodeURIComponent(name);
  const [videos, got] = await Promise.all([api(`/api/projects/${q}/videos`), api(`/api/projects/${q}/versions`)]);
  const vs = { versions: got.versions || [], current: got.current ?? null, others: got.others || videos };
  if (name !== state.project) return;
  state.videos = videos;
  state.versions = vs.versions;
  state.current = vs.current;
  state.compare = (state.compare || []).filter((f) => vs.versions.some((v) => v.file === f));
  const list = $("#videos");
  list.innerHTML = "";
  if (!videos.length) list.innerHTML = `<div class="hint" style="padding:8px 10px">Your renders will show up here.</div>`;
  if (state.compare.length === 2) {
    const [a, b] = state.compare.map(versionOf);
    const c = document.createElement("button");
    c.className = "btn primary compare-go";
    c.textContent = `Compare v${a.n} and v${b.n}`;
    c.onclick = () => openCompare(a, b);
    list.appendChild(c);
  }
  vs.versions.forEach((v) => list.appendChild(item(v.file, `v${v.n} · ${v.label}`, versionMeta(v), v)));
  if (vs.others.length) {
    if (vs.versions.length) list.insertAdjacentHTML("beforeend", `<div class="vgroup">Earlier renders</div>`);
    vs.others.forEach((o) => list.appendChild(item(o.path, o.path, `${fmtSize(o.size)} · ${fmtTime(o.mtime)}`)));
  }
  loadUsage();
  if (state.selected && !videos.some((v) => v.path === state.selected)) state.selected = null;
  const cur = versionByN(state.current);
  if (!state.selected && videos.length) selectVideo(cur ? cur.file : videos[0].path);
  else if (!videos.length) renderPlayer();
}

const versionOf = (file) => (state.versions || []).find((v) => v.file === file);
const versionByN = (n) => (state.versions || []).find((v) => v.n === n);

function versionMeta(v) {
  const bits = [v.duration ? `${v.duration.toFixed(1)}s` : "", v.width ? `${v.width}×${v.height}` : "", v.fps ? `${v.fps} fps` : "", fmtTime(v.t)];
  return bits.filter(Boolean).join(" · ");
}

function item(path, title, meta, v) {
  const b = document.createElement("div");
  b.className = "vitem" + (path === state.selected ? " active" : "");
  b.dataset.path = path;
  b.tabIndex = 0;
  b.setAttribute("role", "button");
  const current = v && v.n === state.current;
  b.innerHTML = `<video class="vthumb" muted preload="metadata" src="${esc(fileUrl(path))}#t=1"></video>
    <span class="vname"></span><span class="meta">${current ? '<span class="latest">Current</span> ' : ""}${esc(meta)}</span>`;
  b.querySelector(".vname").textContent = title;
  b.title = v ? v.prompt : path;
  if (v) {
    const acts = document.createElement("span");
    acts.className = "vactions";
    acts.innerHTML = `${current ? "" : '<button class="btn small restore">Restore</button>'}
      <label class="cmp"><input type="checkbox" ${state.compare.includes(path) ? "checked" : ""}> Compare</label>`;
    acts.querySelector(".restore")?.addEventListener("click", (e) => { e.stopPropagation(); restoreVersion(v); });
    acts.querySelector("label").addEventListener("click", (e) => e.stopPropagation());
    acts.querySelector("input").onchange = (e) => {
      state.compare = state.compare.filter((f) => f !== path);
      if (e.target.checked) state.compare = [...state.compare, path].slice(-2);
      loadVideos();
    };
    b.appendChild(acts);
  }
  b.onclick = () => selectVideo(path);
  b.onkeydown = (e) => { if (e.key === "Enter") selectVideo(path); };
  return b;
}

async function restoreVersion(v) {
  if (!(await confirmBox({ title: `Restore v${v.n}?`, text: `The project goes back to “${v.label}”. Your next message builds on it. Nothing is deleted: newer versions stay in the list.`, okText: "Restore" }))) return;
  const r = await postJson(`/api/projects/${encodeURIComponent(state.project)}/restore`, { n: v.n });
  if (r.error) return notice(r.error, "Couldn't restore");
  state.selected = v.file;
  loadVideos();
}

// Two versions side by side, started together so the timing lines up.
function openCompare(a, b) {
  const box = $("#compare");
  box.querySelector(".compare-grid").innerHTML = [a, b].map((v) => `<figure>
      <video muted loop playsinline src="${esc(fileUrl(v.file))}"></video>
      <figcaption><span><b>v${v.n}</b> · ${esc(v.label)}</span><span class="hint">${esc(versionMeta(v))}</span></figcaption></figure>`).join("");
  box.hidden = false;
  playBoth();
}

function playBoth() {
  const vids = [...$("#compare").querySelectorAll("video")];
  vids.forEach((v) => { v.currentTime = 0; v.play().catch(() => {}); });
}

function fileUrl(path) {
  const v = state.videos.find((x) => x.path === path);
  return `/files/${encodeURIComponent(state.project)}/` + path.split("/").map(encodeURIComponent).join("/") + `?v=${v ? v.mtime : 0}`;
}

export function selectVideo(path) {
  state.selected = path;
  document.querySelectorAll("#videos .vitem").forEach((b) => b.classList.toggle("active", b.dataset.path === path));
  renderPlayer();
}

function renderPlayer() {
  const p = $("#player");
  if (!state.selected) {
    p.innerHTML = `<div class="empty">No video yet.<br>Ask Claude for one and it appears here.</div>`;
    return;
  }
  const url = fileUrl(state.selected);
  p.innerHTML = `<video controls autoplay muted loop playsinline src="${esc(url)}"></video>
    <div class="cap"><span><span class="name"></span> <span class="meta"></span></span><a class="btn small" href="${esc(url)}" download>Download</a></div>`;
  const v = versionOf(state.selected);
  p.querySelector(".cap .name").textContent = v ? `v${v.n} · ${v.label}` : state.selected;
  const video = p.querySelector("video");
  video.addEventListener("loadedmetadata", () => {
    p.querySelector(".cap .meta").textContent = `· ${video.videoWidth}×${video.videoHeight}`;
  });
}

export function initVideos() {
  $("#refresh").onclick = loadVideos;
  $("#compareClose").onclick = () => { $("#compare").hidden = true; $("#compare").querySelectorAll("video").forEach((v) => v.pause()); };
  $("#compareReplay").onclick = playBoth;
  $("#compare").addEventListener("click", (e) => { if (e.target.id === "compare") $("#compareClose").click(); });
}

// ---------- plan usage: what Claude Code reported with the last reply (no extra requests) ----------
const WINDOW_NAMES = { five_hour: "Current session", seven_day: "This week", seven_day_opus: "This week · Opus", seven_day_sonnet: "This week · Sonnet" };

function resetText(t) {
  if (!t) return "";
  const d = new Date(t * 1000), now = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `Resets ${d.toDateString() === now.toDateString() ? time : `${d.toLocaleDateString([], { weekday: "short" })} ${time}`}`;
}

async function loadUsage() {
  const info = await api("/api/usage");
  const box = $("#usageCard");
  const windows = {};
  if (info.rateLimitType) windows[info.rateLimitType] = { utilization: info.utilization, resetsAt: info.resetsAt, status: info.status };
  for (const [k, w] of Object.entries(info.unifiedWindows || {})) windows[k] = { ...windows[k], ...w };
  const order = Object.keys(windows).sort((a, b) => (a === "five_hour" ? -1 : b === "five_hour" ? 1 : a.localeCompare(b)));
  if (!order.length) { box.innerHTML = `<div class="usage-title">Plan usage</div><div class="hint">Shows after your next message.</div>`; return; }
  box.innerHTML = `<div class="usage-title">Plan usage</div>` + order.map((k) => {
    const w = windows[k], pct = w.utilization != null ? Math.round(w.utilization * 100) : null;
    const state = w.status === "rejected" ? "Limit reached" : pct == null ? "Available" : `${pct}% used`;
    return `<div class="usage-row${pct >= 90 || w.status === "rejected" ? " high" : ""}">
      <div class="usage-top"><span>${esc(WINDOW_NAMES[k] || k.replace(/_/g, " "))}</span><b>${esc(state)}</b></div>
      ${pct != null ? `<div class="usage-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.min(pct, 100)}%"></span></div>` : ""}
      <div class="hint">${esc(resetText(w.resetsAt))}</div></div>`;
  }).join("") + `<div class="hint usage-seen">Updated with each reply${info.seen ? ` · ${esc(new Date(info.seen * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))}` : ""}</div>`;
}
