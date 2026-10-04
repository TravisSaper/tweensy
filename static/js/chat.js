// The chat panel: message history, sending a message and streaming Claude's reply.

import { $, esc, api, postJson, fmtDur } from "./util.js";
import { state, MOBILE, WORKING, findItem } from "./state.js";
import { md } from "./markdown.js";
import { showTab, setInput } from "./guide.js";
import { statusCard, notifyDone } from "./status-card.js";
import { loadVideos, selectVideo, fmtSize } from "./videos.js";
import { chatPlayer, takeComments, hasComments, resetComments, setChips } from "./feedback.js";

function welcome() {
  const starters = [
    ["Make my first video", "A 6-second card that counts up. About two minutes.", findItem("first-video")],
    ["Show me 10 motion moves", "A short demo of rise, pop, count-up, typewriter and more.", findItem("moves-demo")],
    ["A video made only of text", "Give it a script, it animates one sentence per screen.", findItem("text-video")],
  ];
  const el = document.createElement("div");
  el.className = "welcome";
  el.innerHTML = `<h3>What do you want to make?</h3>
    <p>Pick a starter, browse the menus at the bottom, or just describe your video in your own words. Claude builds it, you review it in Creations, then say what to change.</p>
    <div class="starters"></div>`;
  starters.forEach(([title, sub, item]) => {
    if (!item) return;
    const b = document.createElement("button");
    b.className = "starter";
    b.innerHTML = `<b>${esc(title)}</b><span>${esc(sub)}</span>`;
    b.onclick = () => setInput(item.text);
    el.querySelector(".starters").appendChild(b);
  });
  return el;
}

function stepsBox(steps, live) {
  const d = document.createElement("details");
  d.className = "steps";
  d.innerHTML = `<summary>${live ? '<span class="spinner"></span>' : "✓"} <span class="sum"></span></summary><ol></ol>`;
  const ol = d.querySelector("ol");
  steps.forEach((s) => { const li = document.createElement("li"); li.textContent = s; ol.appendChild(li); });
  d.querySelector(".sum").textContent = live ? "Working…" : `What Claude did (${steps.length} step${steps.length === 1 ? "" : "s"})`;
  return d;
}

function addMessage(m) {
  const box = $("#messages");
  box.querySelector(".welcome")?.remove();
  const el = document.createElement("div");
  el.className = `msg ${m.role}` + (m.error ? " error" : "");
  if (m.role === "user") {
    el.innerHTML = `<div class="bubble"></div>`;
    el.querySelector(".bubble").textContent = m.text;
  } else {
    el.innerHTML = `<div class="who"><span class="avatar" aria-hidden="true">▶</span>Claude</div>`;
    if (m.error) {
      const c = document.createElement("div");
      c.className = "status-card err";
      c.innerHTML = `<div class="status-top"><span>!</span><span class="title">Didn't finish. See the note below.</span></div>`;
      el.appendChild(c);
    }
    if (m.steps && m.steps.length) el.appendChild(stepsBox(m.steps, false));
    const b = document.createElement("div");
    b.className = "bubble";
    b.innerHTML = md(m.text || "");
    el.appendChild(b);
    if (m.video) el.appendChild(chatPlayer(m.video, m.version));
  }
  box.appendChild(el);
  scrollDown();
  return el;
}

let historyProject = null;
export function renderHistory(history) {
  const box = $("#messages");
  box.innerHTML = "";
  if (historyProject !== state.project) { historyProject = state.project; resetComments(); }
  if (!history.length) box.appendChild(welcome());
  history.forEach(addMessage);
  setChips([...history].reverse().find((m) => m.role === "assistant"));
}

function scrollDown() {
  const s = $("#chatScroll");
  s.scrollTop = s.scrollHeight;
}

export function setBusy(b) {
  state.busy = b;
  $("#send").disabled = b;
  $("#send").textContent = b ? "Working…" : "Send";
  $("#stop").hidden = !b;
  $("#busy").textContent = b ? WORKING : "";
}

export function autosize() {
  const t = $("#input");
  t.style.height = "auto";
  t.style.height = Math.min(t.scrollHeight + 2, 260) + "px";
}

// Load videos again and return the one that's new since the run started, if any.
async function freshVideo() {
  const before = new Set(state.videos.map((v) => v.path + v.mtime));
  await loadVideos();
  const fresh = state.videos.find((v) => !before.has(v.path + v.mtime));
  if (fresh) selectVideo(fresh.path);
  return fresh;
}

let reopenPoll = null;
export function watchBusyProject(name, progress) {
  // The page was reopened while Claude was still working: show a live card and check back.
  clearTimeout(reopenPoll);
  const el = document.createElement("div");
  el.className = "msg assistant";
  el.innerHTML = `<div class="who"><span class="avatar" aria-hidden="true">▶</span>Claude</div>`;
  const card = statusCard();
  card.el.querySelector(".time").textContent = "";
  card.el.querySelector(".title").textContent = "Still working on this project…";
  el.appendChild(card.el);
  $("#messages").appendChild(el);
  scrollDown();
  if (progress) card.progress(progress);
  const check = async () => {
    if (state.project !== name) { card.stop(); return; }
    const data = await api(`/api/projects/${encodeURIComponent(name)}/history`);
    if (data.busy) {
      if (data.progress) card.progress(data.progress);
      reopenPoll = setTimeout(check, 2000);
      return;
    }
    card.stop();
    renderHistory(data.history || []);
    setBusy(false);
    const fresh = await freshVideo();
    notifyDone("✓ Done", fresh ? `${fresh.path} is ready` : "Claude finished");
  };
  reopenPoll = setTimeout(check, 2000);
}

// Read the server-sent events from /api/chat and hand each one to onEvent.
async function readStream(res, onEvent) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      if (chunk.startsWith("data: ")) onEvent(JSON.parse(chunk.slice(6)));
    }
  }
}

export async function send() {
  const typed = $("#input").value.trim();
  if ((!typed && !hasComments()) || state.busy || !state.project) return;
  const project = state.project;
  // Comments pinned to moments in a video go first, as structured context: "[02.4s] make this pause longer".
  const notes = takeComments();
  const text = notes ? notes + (typed ? `\n\n${typed}` : "") : typed;
  $("#input").value = "";
  autosize();
  if (MOBILE.matches) showTab("chat");
  addMessage({ role: "user", text });
  setBusy(true);
  try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch {}
  document.title = "Working… · Tweensy";

  const el = document.createElement("div");
  el.className = "msg assistant";
  el.innerHTML = `<div class="who"><span class="avatar" aria-hidden="true">▶</span>Claude</div>`;
  const card = statusCard();
  const steps = [];
  const sb = stepsBox(steps, true);
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  el.append(card.el, sb, bubble);
  $("#messages").appendChild(el);
  scrollDown();
  let reply = "", failed = false, seconds = null;

  try {
    const res = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project, message: text }),
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Couldn't reach Claude.");
    }
    await readStream(res, (ev) => {
      if (state.project !== project) return;
      if (ev.kind === "text") { reply += ev.text; bubble.innerHTML = md(reply); }
      else if (ev.kind === "step") {
        steps.push(ev.text);
        const li = document.createElement("li");
        li.textContent = ev.text;
        sb.querySelector("ol").appendChild(li);
        sb.querySelector(".sum").textContent = ev.text;
        card.step(ev.text);
      } else if (ev.kind === "progress") { card.progress(ev); }
      else if (ev.kind === "done") {
        failed = ev.error; seconds = ev.seconds;
        if (ev.text != null) { reply = ev.text; bubble.innerHTML = md(reply); }
        if (ev.version) el.appendChild(chatPlayer(`renders/v${String(ev.version).padStart(3, "0")}.mp4`, ev.version));
        setChips({ suggestions: ev.suggestions, text: ev.text });
      }
      const s = $("#chatScroll");
      if (s.scrollHeight - s.scrollTop - s.clientHeight < 160) scrollDown();
    });
  } catch (e) {
    failed = true;
    reply = reply || String(e.message || e);
    bubble.innerHTML = md(reply);
  }
  if (state.project !== project) { card.stop(); return; }
  if (steps.length) sb.replaceWith(stepsBox(steps, false)); else sb.remove();
  if (!reply) bubble.innerHTML = md("(no reply)");
  setBusy(false);
  const fresh = await freshVideo();
  const took = seconds != null ? ` in ${fmtDur(seconds)}` : "";
  if (/\(?Stopped\.\)?\s*$/.test(reply)) {
    card.finish(false, "Stopped");
  } else if (failed) {
    card.finish(false, /usage limit/i.test(reply) ? "Stopped: Claude plan usage limit reached" : "Didn't finish. See the note below.");
    notifyDone("Needs attention", "Claude stopped before finishing");
  } else if (fresh) {
    card.finish(true, `Done${took}. ${fresh.path} is ready`);
    notifyDone("✓ Done", `${fresh.path} is ready`);
  } else {
    card.finish(true, `Done${took}`);
    notifyDone("✓ Done", "Claude finished");
  }
}

// Where your own files can go, and what each folder is for.
const DESTINATIONS = [
  { folder: "", title: "Project folder", path: "your project", accept: "",
    icon: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    text: "Your own video, a product photo, a logo or anything Claude should use directly. Put your talking video here for “Graphics on your own video”." },
  { folder: "screenshots", title: "Screenshots", path: "screenshots/", accept: "image/*",
    icon: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="8.5" r="1.5"/>',
    text: "Screens of your app or website. The “App promo from screenshots” example builds a video around them." },
  { folder: "fonts", title: "Fonts", path: "fonts/", accept: ".ttf,.otf,.woff,.woff2",
    icon: '<path d="M4 20 10 4h4l6 16M7 14h10"/>',
    text: "Your own font files (.ttf, .otf, .woff2), so your videos use your brand font. Then say “use my font”." },
  { folder: "sfx", title: "Sound effects", path: "sfx/", accept: "audio/*",
    icon: '<path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    text: "Short clicks, ticks, whooshes or chimes (.wav, .mp3) for the “Add sound effects” prompt." },
];
let uploadFolder = "";

function renderDestinations() {
  const list = $("#destList");
  list.innerHTML = DESTINATIONS.map((d, i) => `<button class="dest" data-i="${i}">
      <span class="dest-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${d.icon}</svg></span>
      <span class="dest-body"><b>${esc(d.title)}</b> <code>${esc(d.path)}</code><span>${esc(d.text)}</span></span>
    </button>`).join("");
  list.querySelectorAll(".dest").forEach((card) => {
    const d = DESTINATIONS[Number(card.dataset.i)];
    card.onclick = () => {
      uploadFolder = d.folder;
      $("#file").accept = d.accept;
      $("#file").click();
    };
    card.addEventListener("dragover", (e) => { e.preventDefault(); card.classList.add("drop"); });
    card.addEventListener("dragleave", () => card.classList.remove("drop"));
    card.addEventListener("drop", async (e) => {
      e.preventDefault();
      card.classList.remove("drop");
      uploadFolder = d.folder;
      if (e.dataTransfer.files.length && state.project) await uploadFiles([...e.dataTransfer.files]);
    });
  });
}

function openAddFiles() {
  if (!state.project) return;
  $("#addFilesNote").textContent = "";
  $("#addFiles").hidden = false;
  renderUploads();
}

// Files added before live once in the Assets folder; adding one to a project links it, no new copy.
const FOLDER_FOR = { font: "fonts", audio: "sfx" };

async function renderUploads() {
  const { assets, folder } = await api("/api/assets");
  $("#uploadsTip").innerHTML = (assets.length ? "Add one to this project without uploading it again. " : "Nothing yet. ") +
    `Every file is kept once, however many projects use it. Tip: move files into <code>${esc(folder)}</code> yourself and they're never copied at all.`;
  const box = $("#uploads");
  box.innerHTML = "";
  assets.forEach((a) => {
    const row = document.createElement("div");
    row.className = "upload-row";
    row.innerHTML = (a.kind === "image" ? `<img class="upload-thumb" alt="" src="/assets/${encodeURIComponent(a.name)}?v=${a.mtime}">`
      : `<span class="upload-thumb kind">${esc(a.kind)}</span>`) +
      `<span class="upload-name"></span><span class="hint">${fmtSize(a.size)}</span>
      <select aria-label="Folder">${DESTINATIONS.map((d) => `<option value="${d.folder}">${esc(d.title)}</option>`).join("")}</select>
      <button class="btn small">Add</button>`;
    row.querySelector(".upload-name").textContent = a.name;
    row.querySelector("select").value = FOLDER_FOR[a.kind] || "";
    row.querySelector("button").onclick = async () => {
      const r = await postJson("/api/assets/add", { project: state.project, name: a.name, folder: row.querySelector("select").value });
      if (!r.saved) return;
      closeAddFiles();
      setInput(`I added ${r.saved} to this project.`);
      loadVideos();
    };
    box.appendChild(row);
  });
}

function closeAddFiles() {
  $("#addFiles").hidden = true;
}

async function uploadFiles(files) {
  const folder = uploadFolder;
  const saved = [];
  let reused = 0;
  for (const f of files) {
    $("#busy").textContent = $("#addFilesNote").textContent = `Adding ${f.name}…`;
    const q = new URLSearchParams({ project: state.project, name: f.name, folder });
    const r = await api("/api/upload?" + q, { method: "POST", body: f });
    if (r.saved) saved.push(r.saved);
    if (r.reused) reused++;
  }
  $("#busy").textContent = state.busy ? WORKING : "";
  if (reused) {
    $("#busy").textContent = `${reused === 1 ? "That file was" : `${reused} files were`} already in your uploads, so no extra space was used.`;
    setTimeout(() => { $("#busy").textContent = state.busy ? WORKING : ""; }, 5000);
  }
  closeAddFiles();
  if (saved.length) setInput(`I added ${saved.join(", ")} to this project.`);
  loadVideos();
}

export function initChat() {
  $("#send").onclick = send;
  $("#stop").onclick = () => postJson("/api/stop", { project: state.project });
  $("#input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  $("#input").addEventListener("input", autosize);
  renderDestinations();
  $("#attach").onclick = openAddFiles;
  $("#addFilesClose").onclick = closeAddFiles;
  $("#addFiles").addEventListener("click", (e) => { if (e.target.id === "addFiles") closeAddFiles(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAddFiles(); });
  $("#file").onchange = async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    if (files.length && state.project) await uploadFiles(files);
  };
}
