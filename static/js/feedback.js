// The review loop in the chat: a player under each reply that rendered, comments pinned to moments
// in it, and suggestion chips taken from the latest reply.

import { $, esc } from "./util.js";
import { state } from "./state.js";
import { setInput } from "./guide.js";

const GENERIC = ["Create a kinetic typography intro", "Make it more cinematic", "Try a different style", "Make the animation faster"];
let comments = []; // pending, for the next message: { t: seconds, text, n: version }

const stamp = (t) => `${t < 10 ? "0" : ""}${t.toFixed(1)}s`;
const fileUrl = (path) => `/files/${encodeURIComponent(state.project)}/` + path.split("/").map(encodeURIComponent).join("/");

// ---------- inline player with a comment bar ----------
export function chatPlayer(path, n) {
  const box = document.createElement("div");
  box.className = "chat-video";
  box.innerHTML = `<video controls preload="metadata" playsinline src="${esc(fileUrl(path))}"></video>
    <div class="ctrack" role="slider" tabindex="0" aria-label="Comment bar: click a moment to comment on it" title="Click a moment to comment on it">
      <div class="ctrack-fill"></div></div>
    <div class="ctrack-hint hint">Click the bar under the video to comment on that exact moment${n ? ` of v${n}` : ""}.</div>
    <form class="cform" hidden><span class="cstamp"></span><input type="text" placeholder="What should change here?" aria-label="Comment">
      <button class="btn small primary">Add</button><button type="button" class="btn small cancel">Cancel</button></form>`;
  const video = box.querySelector("video"), track = box.querySelector(".ctrack"), form = box.querySelector(".cform");
  let at = 0;
  const pick = (t) => {
    at = Math.max(0, Math.min(t, video.duration || t));
    video.currentTime = at;
    video.pause();
    form.hidden = false;
    form.querySelector(".cstamp").textContent = stamp(at);
    form.querySelector("input").focus();
  };
  track.onclick = (e) => {
    if (!video.duration) return;
    const r = track.getBoundingClientRect();
    pick(((e.clientX - r.left) / r.width) * video.duration);
  };
  track.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(video.currentTime); } };
  video.addEventListener("timeupdate", () => {
    if (video.duration) track.querySelector(".ctrack-fill").style.width = `${(video.currentTime / video.duration) * 100}%`;
  });
  video.addEventListener("loadedmetadata", () => drawMarkers(box, n, video.duration));
  form.onsubmit = (e) => {
    e.preventDefault();
    const text = form.querySelector("input").value.trim();
    if (!text) return;
    comments.push({ t: at, text, n });
    form.querySelector("input").value = "";
    form.hidden = true;
    drawMarkers(box, n, video.duration);
    renderPending();
  };
  form.querySelector(".cancel").onclick = () => { form.hidden = true; };
  return box;
}

function drawMarkers(box, n, duration) {
  const track = box.querySelector(".ctrack");
  track.querySelectorAll(".cmark").forEach((m) => m.remove());
  if (!duration) return;
  comments.filter((c) => c.n === n).forEach((c) => {
    const m = document.createElement("span");
    m.className = "cmark";
    m.style.left = `${(c.t / duration) * 100}%`;
    m.title = `${stamp(c.t)} ${c.text}`;
    track.appendChild(m);
  });
}

const clearMarkers = () => document.querySelectorAll(".chat-video .cmark").forEach((m) => m.remove());

// Comments waiting to be sent, shown above the prompt box.
function renderPending() {
  const box = $("#pendingComments");
  box.hidden = !comments.length;
  box.innerHTML = comments.length ? `<b>${comments.length} comment${comments.length === 1 ? "" : "s"}</b> will go with your next message:
    <ul>${comments.map((c) => `<li>${c.n ? `v${c.n} ` : ""}[${stamp(c.t)}] ${esc(c.text)}</li>`).join("")}</ul>
    <button class="link-btn" type="button">Clear</button>` : "";
  box.querySelector("button")?.addEventListener("click", resetComments);
}

/** The comments as structured context for Claude, then clears them. "" when there are none. */
export function takeComments() {
  if (!comments.length) return "";
  const byVersion = {};
  [...comments].sort((a, b) => a.t - b.t).forEach((c) => (byVersion[c.n || 0] ||= []).push(c));
  const text = Object.entries(byVersion).map(([n, list]) =>
    `Comments on ${Number(n) ? `v${n} (renders/v${String(n).padStart(3, "0")}.mp4)` : "the video"}, each at a moment in it:\n` +
    list.map((c) => `[${stamp(c.t)}] ${c.text}`).join("\n")).join("\n\n");
  resetComments();
  return text;
}

export const hasComments = () => comments.length > 0;

export function resetComments() {
  comments = [];
  renderPending();
  clearMarkers();
}

// ---------- suggestion chips from the latest reply ----------
// Claude ends each reply with "Suggestions: a | b" (parsed on the server). Older replies don't, so fall
// back to the follow-ups it offered in plain words ("Want me to …?", "I can … if you'd like").
export function offered(text) {
  const out = [];
  for (const s of (text || "").split(/(?<=[.?!])\s+/)) {
    const m = s.trim().match(/^(?:want me to|should i|shall i|i can|i could)\s+(.+?)(?:,?\s+if you(?:'d)? (?:like|prefer|want)(?: it)?)?[.?!]?$/i);
    if (m) out.push(m[1].charAt(0).toUpperCase() + m[1].slice(1));
  }
  return out;
}

export function setChips(reply) {
  const list = reply?.suggestions?.length ? reply.suggestions : offered(reply?.text);
  const chips = (list.length ? list : GENERIC).slice(0, 4);
  const box = $("#ideaChips");
  box.innerHTML = chips.map((c) => `<button class="chip" type="button">${esc(c)}</button>`).join("");
  box.querySelectorAll("button").forEach((b, i) => (b.onclick = () => setInput(chips[i])));
}
