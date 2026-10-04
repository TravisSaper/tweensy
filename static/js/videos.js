// The Videos panel: list of renders in the project and the player.

import { $, esc, api } from "./util.js";
import { state } from "./state.js";

export function fmtSize(n) {
  return n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB";
}

export function fmtTime(t) {
  return new Date(t * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export async function loadVideos() {
  if (!state.project) return;
  state.videos = await api(`/api/projects/${encodeURIComponent(state.project)}/videos`);
  const list = $("#videos");
  if (!state.videos.length) {
    list.innerHTML = `<div class="hint" style="padding:8px 10px">Your renders will show up here.</div>`;
  } else {
    list.innerHTML = "";
    state.videos.forEach((v, i) => {
      const b = document.createElement("button");
      b.className = "vitem" + (v.path === state.selected ? " active" : "");
      b.dataset.path = v.path;
      b.innerHTML = `<video class="vthumb" muted preload="metadata" src="${esc(fileUrl(v.path))}#t=1"></video>
        <span class="vname"></span><span class="meta">${i === 0 ? '<span class="latest">Latest</span> ' : ""}${fmtSize(v.size)} · ${fmtTime(v.mtime)}</span>`;
      b.querySelector(".vname").textContent = v.path;
      b.onclick = () => selectVideo(v.path);
      list.appendChild(b);
    });
  }
  if (state.selected && !state.videos.some((v) => v.path === state.selected)) state.selected = null;
  if (!state.selected && state.videos.length) selectVideo(state.videos[0].path);
  else if (!state.videos.length) renderPlayer();
}

function fileUrl(path) {
  const v = state.videos.find((x) => x.path === path);
  return `/files/${encodeURIComponent(state.project)}/` + path.split("/").map(encodeURIComponent).join("/") + `?v=${v ? v.mtime : 0}`;
}

export function selectVideo(path) {
  state.selected = path;
  document.querySelectorAll(".vitem").forEach((b) => b.classList.toggle("active", b.dataset.path === path));
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
  p.querySelector(".cap .name").textContent = state.selected;
  const video = p.querySelector("video");
  video.addEventListener("loadedmetadata", () => {
    p.querySelector(".cap .meta").textContent = `· ${video.videoWidth}×${video.videoHeight}`;
  });
}

export function initVideos() {
  $("#refresh").onclick = loadVideos;
}
