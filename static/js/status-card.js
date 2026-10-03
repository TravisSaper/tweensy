// The live card at the top of Claude's reply: which stage it's in, a timer, and a real
// progress bar with time left while HyperFrames renders.

import { esc, fmtDur } from "./util.js";

const PHASES = ["Planning", "Building", "Rendering", "Checking"];
const TITLES = ["Planning the video…", "Building the animation…", "Rendering the video…", "Checking the result…"];

export function statusCard(startedAt = Date.now()) {
  const el = document.createElement("div");
  el.className = "status-card";
  el.innerHTML = `<div class="status-top"><span class="spinner"></span><span class="title">Claude is working…</span><span class="time">0:00</span></div>
    <div class="phases">${PHASES.map((p) => `<span class="phase">${p}</span>`).join("")}</div>
    <div class="progress" hidden><div class="track"><div class="fill"></div></div><div class="meta"><span class="stage"></span><span class="eta"></span></div></div>`;
  let phase = 0, rendered = false, sawProgress = false;
  const setPhase = (i, force = false) => {
    phase = force ? i : Math.max(phase, i);
    el.querySelectorAll(".phase").forEach((p, n) => { p.className = "phase" + (n < phase ? " done" : n === phase ? " on" : ""); });
    el.querySelector(".title").textContent = TITLES[phase];
  };
  setPhase(0);
  const tick = () => { el.querySelector(".time").textContent = fmtDur((Date.now() - startedAt) / 1000); };
  const timer = setInterval(tick, 1000);
  return {
    el,
    step(text) {
      // The progress log is the real signal for Rendering and Checking; step names are only
      // a fallback for renders that don't write it.
      if (!sawProgress && /\brender\b(?!s)/i.test(text) && !/frame|still|snapshot/i.test(text)) { setPhase(2); rendered = true; }
      else if (rendered && phase === 2 && !sawProgress && /frame|probe|confirm|look/i.test(text)) setPhase(3);
      else if (phase < 2 && /edit|writ|scaffold|download|font|copy|install|creat|build|validat|check/i.test(text)) setPhase(1);
    },
    progress(ev) {
      sawProgress = true;
      setPhase(ev.percent >= 100 ? 3 : 2, true);
      rendered = true;
      const box = el.querySelector(".progress");
      box.hidden = false;
      box.querySelector(".fill").style.width = `${ev.percent}%`;
      box.querySelector(".stage").innerHTML = `<b>${ev.percent}%</b> · ${esc(ev.stage)}`;
      box.querySelector(".eta").textContent = ev.percent >= 100 ? "done" : ev.eta != null ? `about ${fmtDur(ev.eta)} left` : "estimating…";
    },
    finish(ok, title) {
      clearInterval(timer);
      tick();
      el.classList.add(ok ? "ok" : "err");
      el.querySelector(".spinner").outerHTML = ok ? "<span>✓</span>" : "<span>!</span>";
      el.querySelector(".title").textContent = title;
      if (ok) el.querySelectorAll(".phase").forEach((p) => { p.className = "phase done"; });
      el.querySelector(".progress").hidden = true;
    },
    stop() { clearInterval(timer); },
  };
}

// Tell the person Claude finished: tab title, plus a desktop notification if they're elsewhere.
export function notifyDone(title, body) {
  document.title = `${title} · Tweensy`;
  const reset = () => { document.title = "Tweensy"; window.removeEventListener("focus", reset); };
  if (document.hasFocus()) setTimeout(reset, 4000); else window.addEventListener("focus", reset);
  try {
    if ("Notification" in window && Notification.permission === "granted" && !document.hasFocus()) new Notification(title, { body });
  } catch {}
}
