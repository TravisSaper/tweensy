// The left sidebar's pages: Dashboard (the chat workspace), Projects, and the Video library with
// its player that grows out of the clicked video into the middle of the screen.

import { $, esc, api } from "./util.js";
import { state } from "./state.js";
import { loadProjects } from "./projects.js";
import { fmtSize, fmtTime } from "./videos.js";

const TITLES = { dashboard: "Dashboard", projects: "Projects", library: "Video library" };
const PAGES = { projects: "#projectsPage", library: "#libraryPage" };
const ICON_FOLDER = '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
const expanded = new Set(); // projects opened in the library
const count = (n) => `${n} video${n === 1 ? "" : "s"}`;

export function showView(view) {
  if (!TITLES[view]) view = "dashboard";
  try { localStorage.setItem("ms-view", view); } catch {}
  $("#pageTitle").textContent = TITLES[view];
  document.querySelectorAll("#appnav [data-view]").forEach((b) => b.classList.toggle("on", b.dataset.view === view));
  const dash = view === "dashboard";
  for (const sel of ["main", "#nav", "#projPicker", "#sidebarToggle"]) $(sel).hidden = !dash;
  $("#pageTitle").hidden = dash; // on the Dashboard the project name (its picker) is the title
  Object.entries(PAGES).forEach(([v, sel]) => ($(sel).hidden = v !== view));
  if (view === "projects") renderProjects();
  if (view === "library") renderLibrary();
}

// ---------- Projects ----------
async function renderProjects() {
  const list = await api("/api/projects");
  $("#projectCount").textContent = `${list.length} project${list.length === 1 ? "" : "s"}`;
  $("#projectRows").innerHTML = list.map((p) => `<button class="row" data-name="${esc(p.name)}">
      <span class="row-icon">${ICON_FOLDER}</span><span class="row-name">${esc(p.name)}</span><span class="spacer"></span>
      <span class="hint">${count(p.videos)}</span>
      ${p.busy ? '<span class="pill">working</span>' : ""}
      ${p.name === state.project ? '<span class="pill quiet">open</span>' : ""}</button>`).join("");
  $("#projectRows").querySelectorAll(".row").forEach((r) => (r.onclick = async () => {
    await loadProjects(r.dataset.name);
    showView("dashboard");
  }));
}

// ---------- Video library ----------
async function renderLibrary() {
  const list = await api("/api/projects");
  const root = $("#libraryRows");
  root.innerHTML = "";
  for (const p of list) {
    const group = document.createElement("div");
    group.className = "lib-group";
    group.innerHTML = `<button class="row" aria-expanded="false">
        <svg class="chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>
        <span class="row-icon">${ICON_FOLDER}</span><span class="row-name">${esc(p.name)}</span>
        <span class="spacer"></span><span class="hint">${count(p.videos)}</span></button>
      <div class="lib-videos" hidden></div>`;
    group.querySelector(".row").onclick = () => toggleGroup(p.name, group);
    root.appendChild(group);
    if (expanded.has(p.name)) toggleGroup(p.name, group, true);
  }
}

async function toggleGroup(name, group, force) {
  const head = group.querySelector(".row"), box = group.querySelector(".lib-videos");
  const show = force ?? box.hidden;
  head.setAttribute("aria-expanded", String(show));
  box.hidden = !show;
  show ? expanded.add(name) : expanded.delete(name);
  if (!show) return;
  const videos = await api(`/api/projects/${encodeURIComponent(name)}/videos`); // newest first
  box.innerHTML = videos.length ? "" : `<div class="hint lib-empty">No videos in this project yet.</div>`;
  videos.forEach((v) => {
    const url = `/files/${encodeURIComponent(name)}/` + v.path.split("/").map(encodeURIComponent).join("/") + `?v=${v.mtime}`;
    const b = document.createElement("button");
    b.className = "lib-video";
    b.innerHTML = `<video class="thumb" muted preload="metadata" src="${esc(url)}#t=1"></video>
      <span class="lib-text"><span class="row-name"></span><span class="lib-prompt"></span></span>
      <span class="hint">${fmtSize(v.size)} · ${fmtTime(v.mtime)}</span>`;
    b.querySelector(".row-name").textContent = v.path;
    b.querySelector(".lib-prompt").textContent = v.prompt;
    b.onclick = () => openTheater(name, v, url, b.querySelector(".thumb"));
    box.appendChild(b);
  });
}

// ---------- the player: grows from the thumbnail to the middle, then plays ----------
let fromThumb = null;

function openTheater(project, v, url, thumb) {
  const card = $("#theaterCard");
  card.querySelector("video")?.remove();
  $("#theaterName").textContent = v.path;
  $("#theaterMeta").textContent = `${project} · ${fmtTime(v.mtime)}`;
  const prompt = $("#theaterPrompt");
  prompt.textContent = v.prompt || "No prompt saved for this video.";
  prompt.classList.add("clamped");
  const video = document.createElement("video");
  video.className = "theater-video";
  Object.assign(video, { src: url, controls: true, playsInline: true, muted: true, loop: true });
  card.appendChild(video);
  $("#theater").hidden = false;
  // Show more only when the prompt runs past three lines.
  $("#theaterMore").hidden = prompt.scrollHeight <= prompt.clientHeight + 1;
  $("#theaterMore").textContent = "Show more";
  fromThumb = thumb;
  animate(video, thumb, false).then(() => video.play().catch(() => {}));
}

// FLIP: measure where the video ends up, start it over the thumbnail, then let it slide into place.
function animate(video, thumb, closing) {
  const run = (el, frames, opts) => {
    el.getAnimations().forEach((a) => a.cancel());
    return el.animate(closing ? [...frames].reverse() : frames, { fill: "both", easing: "cubic-bezier(.2,.8,.2,1)", ...opts });
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ms = reduce ? 0 : 420;
  run($("#theater"), [{ opacity: 0 }, { opacity: 1 }], { duration: ms });
  [...$("#theaterCard").children].filter((el) => el !== video)
    .forEach((el) => run(el, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
      { duration: reduce ? 0 : 260, delay: closing || reduce ? 0 : 220 }));
  if (reduce || !thumb?.isConnected) return Promise.resolve();
  const a = thumb.getBoundingClientRect(), b = video.getBoundingClientRect();
  video.style.transformOrigin = "0 0";
  return run(video, [
    { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})` },
    { transform: "none" },
  ], { duration: ms }).finished;
}

async function closeTheater() {
  if ($("#theater").hidden) return;
  const video = $("#theaterCard video");
  video.pause();
  await animate(video, fromThumb, true);
  $("#theater").hidden = true;
  video.remove();
}

export function initLibrary() {
  document.querySelectorAll("#appnav [data-view]").forEach((b) => (b.onclick = () => showView(b.dataset.view)));
  $("#addProject").onclick = () => $("#newProject").click();
  $("#theaterClose").onclick = closeTheater;
  $("#theater").addEventListener("click", (e) => { if (e.target.id === "theater") closeTheater(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeTheater(); });
  $("#theaterMore").onclick = () => {
    const clamped = $("#theaterPrompt").classList.toggle("clamped");
    $("#theaterMore").textContent = clamped ? "Show more" : "Show less";
  };
  let view = "dashboard";
  try { view = localStorage.getItem("ms-view") || "dashboard"; } catch {}
  showView(view);
}
