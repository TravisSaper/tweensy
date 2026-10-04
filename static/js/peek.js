// The peek card: hover (or focus) a row in the slim side panel and its full card opens beside the
// panel, with the description, the text, a style's moving swatch and its buttons. Click a row to pin it.

let el = null, current = null, pinned = null, showTimer = 0, hideTimer = 0;

function card() {
  if (el) return el;
  el = document.createElement("div");
  el.className = "peek";
  el.id = "peek";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  el.addEventListener("mouseleave", () => { if (!pinned) hideSoon(); });
  document.body.appendChild(el);
  return el;
}

function show(row, build) {
  clearTimeout(hideTimer);
  const box = card();
  if (current !== row) {
    current?.classList.remove("peeking");
    box.replaceChildren(build());
    box.setAttribute("aria-label", row.querySelector(".crow-name")?.textContent || "Details");
    current = row;
  }
  row.classList.add("peeking");
  box.hidden = false;
  const r = row.getBoundingClientRect(), panel = row.closest(".panel").getBoundingClientRect();
  box.style.left = `${panel.right + 10}px`;
  box.style.top = `${Math.max(64, Math.min(r.top - 12, innerHeight - box.offsetHeight - 12))}px`;
}

function hideSoon() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hidePeek, 150);
}

export function hidePeek() {
  clearTimeout(showTimer);
  pinned = null;
  current?.classList.remove("peeking", "pinned");
  current = null;
  if (el) el.hidden = true;
}

export function attachPeek(row, build) {
  row.addEventListener("mouseenter", () => {
    clearTimeout(hideTimer);
    if (!pinned) showTimer = setTimeout(() => show(row, build), 120);
  });
  row.addEventListener("mouseleave", () => { clearTimeout(showTimer); if (!pinned) hideSoon(); });
  row.addEventListener("focus", () => { if (!pinned) show(row, build); });
  row.addEventListener("blur", (e) => { if (!pinned && !el?.contains(e.relatedTarget)) hideSoon(); });
  row.addEventListener("click", () => {
    if (pinned === row) { hidePeek(); return; }
    current?.classList.remove("pinned");
    show(row, build);
    pinned = row;
    row.classList.add("pinned");
  });
}

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && el && !el.hidden) hidePeek(); });
document.addEventListener("click", (e) => {
  if (pinned && !pinned.contains(e.target) && !el.contains(e.target)) hidePeek();
});
// Scrolling the panel moves the row away from its card, so close it (but not when scrolling the card itself).
document.addEventListener("scroll", (e) => {
  if (el && !el.hidden && !pinned && !el.contains(e.target)) hidePeek();
}, true);
addEventListener("resize", hidePeek);
