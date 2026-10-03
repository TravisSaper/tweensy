// The chat panel: message history, sending a message and streaming Claude's reply.

import { $, esc, api, postJson, fmtDur } from "./util.js";
import { state, MOBILE, WORKING, findItem } from "./state.js";
import { md } from "./markdown.js";
import { showTab, setInput } from "./guide.js";
import { statusCard, notifyDone } from "./status-card.js";
import { loadVideos, selectVideo } from "./videos.js";

function welcome() {
  const starters = [
    ["Make my first video", "A 6-second card that counts up. About two minutes.", findItem("first-video")],
    ["Show me 10 motion moves", "A short demo of rise, pop, count-up, typewriter and more.", findItem("moves-demo")],
    ["A video made only of text", "Give it a script, it animates one sentence per screen.", findItem("text-video")],
  ];
  const el = document.createElement("div");
  el.className = "welcome";
  el.innerHTML = `<h3>What do you want to make?</h3>
    <p>Pick a starter, browse the menus at the bottom, or just describe your video in your own words. Claude builds it and the video shows up in Videos.</p>
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
    el.innerHTML = `<div class="who">Claude</div>`;
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
  }
  box.appendChild(el);
  scrollDown();
  return el;
}

export function renderHistory(history) {
  const box = $("#messages");
  box.innerHTML = "";
  if (!history.length) box.appendChild(welcome());
  history.forEach(addMessage);
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
  el.innerHTML = `<div class="who">Claude</div>`;
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
  const text = $("#input").value.trim();
  if (!text || state.busy || !state.project) return;
  const project = state.project;
  $("#input").value = "";
  autosize();
  if (MOBILE.matches) showTab("chat");
  addMessage({ role: "user", text });
  setBusy(true);
  try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch {}
  document.title = "Working… · Tweensy";

  const el = document.createElement("div");
  el.className = "msg assistant";
  el.innerHTML = `<div class="who">Claude</div>`;
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
      else if (ev.kind === "done") { failed = ev.error; seconds = ev.seconds; }
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

async function uploadFiles(files) {
  const folder = $("#attachTo").value;
  const saved = [];
  for (const f of files) {
    $("#busy").textContent = `Copying ${f.name}…`;
    const q = new URLSearchParams({ project: state.project, name: f.name, folder });
    const r = await api("/api/upload?" + q, { method: "POST", body: f });
    if (r.saved) saved.push(r.saved);
  }
  $("#busy").textContent = state.busy ? WORKING : "";
  if (saved.length) setInput(`I added ${saved.join(", ")} to this project.`, true);
  loadVideos();
}

export function initChat() {
  $("#send").onclick = send;
  $("#stop").onclick = () => postJson("/api/stop", { project: state.project });
  $("#input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  $("#input").addEventListener("input", autosize);
  $("#attach").onclick = () => $("#file").click();
  $("#file").onchange = async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    if (files.length && state.project) await uploadFiles(files);
  };
}
