// The storyboard: draw each scene (layout + motion), add a style/transition note per
// scene, then hand the pictures to Claude.
// Black pen = what's on screen, red arrows = how things move, blue text = labels.

import { $, esc, api } from "./util.js";
import { state } from "./state.js";
import { setInput } from "./guide.js";
import { loadVideos } from "./videos.js";

const COLORS = { pen: "#1d1b2e", arrow: "#e11d48", text: "#2563eb" };
const SIZES = { "16:9": [1600, 900], "9:16": [900, 1600] };
const MAX_SCENES = 12;

let canvas;
let tool = "pen";
let aspect = "16:9";
let scenes = [newScene()]; // each: { strokes: [...], notes: "" }
let index = 0;             // scene being drawn
let current = null;        // stroke in progress

function newScene() {
  return { strokes: [], notes: "" };
}

const scene = () => scenes[index];

// ---------- drawing ----------
function paint(target, strokes, extra) {
  const c = target.getContext("2d");
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, target.width, target.height);
  c.save();
  c.scale(target.width / canvas.width, target.height / canvas.height);
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const s of extra ? [...strokes, extra] : strokes) drawStroke(c, s);
  c.restore();
}

function drawStroke(c, s) {
  c.strokeStyle = c.fillStyle = s.color;
  c.lineWidth = s.width;
  if (s.type === "line") {
    c.beginPath();
    s.points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    if (s.points.length === 1) c.lineTo(s.points[0][0] + 0.1, s.points[0][1]);
    c.stroke();
  } else if (s.type === "arrow") {
    const [[x1, y1], [x2, y2]] = s.points;
    const angle = Math.atan2(y2 - y1, x2 - x1), head = 34;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    c.beginPath();
    c.moveTo(x2, y2);
    c.lineTo(x2 - head * Math.cos(angle - 0.45), y2 - head * Math.sin(angle - 0.45));
    c.lineTo(x2 - head * Math.cos(angle + 0.45), y2 - head * Math.sin(angle + 0.45));
    c.closePath();
    c.fill();
  } else if (s.type === "text") {
    c.font = "600 44px Inter, system-ui, sans-serif";
    c.fillText(s.text, s.points[0][0], s.points[0][1]);
  }
}

function redraw() {
  paint(canvas, scene().strokes, current);
}

// A same-shape canvas with a scene painted on it, at `scale` of full size.
function sceneCanvas(s, scale = 1) {
  const c = document.createElement("canvas");
  c.width = Math.round(canvas.width * scale);
  c.height = Math.round(canvas.height * scale);
  paint(c, s.strokes);
  return c;
}

// ---------- scene strip ----------
function renderStrip() {
  const strip = $("#sceneStrip");
  strip.dataset.aspect = aspect;
  strip.innerHTML = scenes.map((s, i) => `<button class="scene-tile${i === index ? " on" : ""}" data-i="${i}" title="Scene ${i + 1}${s.notes ? ": " + esc(s.notes) : ""}">
      <img alt="Scene ${i + 1}" src="${sceneCanvas(s, 0.12).toDataURL()}"><span>Scene ${i + 1}</span>
      ${scenes.length > 1 ? `<span class="del" data-del="${i}" role="button" aria-label="Delete scene ${i + 1}">×</span>` : ""}
    </button>`).join("") +
    (scenes.length < MAX_SCENES ? `<button class="scene-add" id="sceneAdd">+ Add scene</button>` : "");
  strip.querySelectorAll(".scene-tile").forEach((b) => (b.onclick = (e) => {
    if (e.target.dataset.del) deleteScene(Number(e.target.dataset.del));
    else selectScene(Number(b.dataset.i));
  }));
  $("#sceneAdd")?.addEventListener("click", addScene);
}

function selectScene(i) {
  scene().notes = $("#sceneNotes").value;
  index = i;
  $("#sceneNotes").value = scene().notes;
  $("#sceneNotesLabel").textContent = `Scene ${index + 1}: style & transition (optional)`;
  renderStrip();
  redraw();
}

function addScene() {
  scene().notes = $("#sceneNotes").value;
  scenes.splice(index + 1, 0, newScene());
  selectScene(index + 1);
}

function deleteScene(i) {
  if (scenes[i].strokes.length && !confirm(`Delete scene ${i + 1}?`)) return;
  scene().notes = $("#sceneNotes").value;
  scenes.splice(i, 1);
  index = Math.min(i <= index ? Math.max(index - 1, 0) : index, scenes.length - 1);
  $("#sceneNotes").value = scene().notes;
  selectScene(index);
}

// ---------- pointer input ----------
// Pointer position in canvas pixels (the canvas is scaled down to fit the screen).
function pos(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height];
}

function onDown(e) {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  const p = pos(e);
  if (tool === "text") {
    const text = prompt("Label (for example: Logo, 100, Title)");
    if (text && text.trim()) scene().strokes.push({ type: "text", color: COLORS.text, width: 1, points: [p], text: text.trim() });
    changed();
    return;
  }
  if (tool === "arrow") current = { type: "arrow", color: COLORS.arrow, width: 8, points: [p, p] };
  else if (tool === "eraser") current = { type: "line", color: "#ffffff", width: 48, points: [p] };
  else current = { type: "line", color: COLORS.pen, width: 6, points: [p] };
  redraw();
}

function onMove(e) {
  if (!current) return;
  const p = pos(e);
  if (current.type === "arrow") current.points[1] = p;
  else current.points.push(p);
  redraw();
}

function onUp() {
  if (!current) return;
  const [a, b] = [current.points[0], current.points[current.points.length - 1]];
  if (current.type !== "arrow" || Math.hypot(b[0] - a[0], b[1] - a[1]) > 12) scene().strokes.push(current);
  current = null;
  changed();
}

// Redraw the board and refresh the current scene's thumbnail.
function changed() {
  redraw();
  const img = $(`#sceneStrip .scene-tile[data-i="${index}"] img`);
  if (img) img.src = sceneCanvas(scene(), 0.12).toDataURL();
}

function setTool(name) {
  tool = name;
  document.querySelectorAll("#sketchTools [data-tool]").forEach((b) => b.classList.toggle("on", b.dataset.tool === name));
}

function setAspect(name) {
  if (name === aspect) return;
  if (scenes.some((s) => s.strokes.length) && !confirm("Changing the shape clears every scene. Continue?")) return;
  aspect = name;
  [canvas.width, canvas.height] = SIZES[name];
  canvas.parentElement.dataset.aspect = name;
  scenes = [newScene()];
  index = 0;
  $("#sceneNotes").value = "";
  document.querySelectorAll("#sketchTools [data-aspect]").forEach((b) => b.classList.toggle("on", b.dataset.aspect === name));
  selectScene(0);
}

// ---------- hand-off to Claude ----------
function storyboardMessage(saved) {
  const lines = saved.map((path, i) => {
    const notes = scenes[i].notes.trim();
    return `Scene ${i + 1}: ${path}\n  Style & transition: ${notes || "(your choice: pick what fits)"}`;
  });
  const what = saved.length === 1 ? "my sketch" : `my ${saved.length}-scene storyboard (scenes play in this order)`;
  return `Make a ${aspect} video from ${what}.

${lines.join("\n")}

How to read each sketch:
- Black drawing = what's on screen and where it sits.
- Red arrows = how things move (follow each arrow's direction; numbers next to them mean the order).
- Blue text = labels for what each thing is.

Look at every scene first. If something is genuinely unclear (you can't tell what a drawing is, or what should happen in a scene), ask me short numbered questions and wait for my answers before building anything. If it's clear enough, tell me in one line per scene what you think happens, then build it as polished motion graphics (keep my layouts, motion and order, but make it look finished, not hand-drawn), use the transitions I asked for (pick fitting ones where I didn't), and render it to renders/storyboard.mp4.`;
}

async function useStoryboard() {
  if (!state.project) return;
  scene().notes = $("#sceneNotes").value;
  const drawn = scenes.filter((s) => s.strokes.length);
  if (!drawn.length) { alert("Draw at least one scene first."); return; }
  if (drawn.length < scenes.length && !confirm("Some scenes are empty. Leave them out and continue?")) return;
  scenes = drawn;
  index = Math.min(index, scenes.length - 1);
  const btn = $("#sketchUse");
  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const saved = [];
    for (const [i, s] of scenes.entries()) {
      const blob = await new Promise((resolve) => sceneCanvas(s).toBlob(resolve, "image/png"));
      const name = `storyboard-${stamp}-scene-${i + 1}.png`;
      const q = new URLSearchParams({ project: state.project, name, folder: "sketches" });
      const r = await api("/api/upload?" + q, { method: "POST", body: blob });
      if (!r.saved) throw new Error(r.error || "Couldn't save the storyboard.");
      saved.push(r.saved);
    }
    closeBoard();
    setInput(storyboardMessage(saved));
    loadVideos();
  } catch (err) {
    alert(err.message || err);
  } finally {
    btn.disabled = false;
    btn.textContent = "Use this storyboard";
  }
}

export function openBoard() {
  $("#sketch").hidden = false;
  renderStrip();
  redraw();
}

function closeBoard() {
  scene().notes = $("#sceneNotes").value;
  $("#sketch").hidden = true;
}

function undo() {
  scene().strokes.pop();
  changed();
}

export function initSketch() {
  canvas = $("#sketchCanvas");
  [canvas.width, canvas.height] = SIZES[aspect];
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  document.querySelectorAll("#sketchTools [data-tool]").forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
  document.querySelectorAll("#sketchTools [data-aspect]").forEach((b) => (b.onclick = () => setAspect(b.dataset.aspect)));
  $("#sketchUndo").onclick = undo;
  $("#sketchClear").onclick = () => {
    if (!scene().strokes.length || confirm(`Clear scene ${index + 1}?`)) { scene().strokes = []; changed(); }
  };
  $("#sceneNotes").addEventListener("input", (e) => { scene().notes = e.target.value; });
  $("#sketchClose").onclick = closeBoard;
  $("#sketchUse").onclick = useStoryboard;
  document.addEventListener("keydown", (e) => {
    if ($("#sketch").hidden) return;
    if (e.key === "Escape") closeBoard();
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.target.tagName !== "INPUT") { e.preventDefault(); undo(); }
  });
  setTool("pen");
  redraw();
}
