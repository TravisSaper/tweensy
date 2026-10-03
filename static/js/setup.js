// The Setup checklist: what's installed, what's missing, and how to fix it on this OS.

import { $, esc, api } from "./util.js";
import { findItem } from "./state.js";
import { setInput } from "./guide.js";
import { send } from "./chat.js";

const INSTALL = {
  claude: {
    mac: [["In the Terminal app, paste:", "curl -fsSL https://claude.ai/install.sh | bash"]],
    linux: [["In a terminal, paste:", "curl -fsSL https://claude.ai/install.sh | bash"]],
    windows: [
      ["Claude Code needs Git for Windows. In PowerShell, paste:", "winget install --id Git.Git -e"],
      ["Then install Claude Code (PowerShell):", "irm https://claude.ai/install.ps1 | iex"],
    ],
  },
  login: [["Open a new terminal, type this, and sign in with your Claude account:", "claude"]],
  node: {
    mac: [["Or install it yourself in Terminal (needs Homebrew from brew.sh):", "brew install node"]],
    windows: [["Or install it yourself in PowerShell:", "winget install OpenJS.NodeJS.LTS"]],
    linux: [["Or install Node.js 22+ with your package manager, for example:", "sudo apt install nodejs"]],
  },
  ffmpeg: {
    mac: [["Or install it yourself in Terminal:", "brew install ffmpeg"]],
    windows: [["Or install it yourself in PowerShell:", "winget install Gyan.FFmpeg"]],
    linux: [["Or install it with your package manager, for example:", "sudo apt install ffmpeg"]],
  },
};

function cmdRows(rows) {
  return rows.map(([label, cmd]) =>
    `<p>${esc(label)}</p><div class="cmd"><code>${esc(cmd)}</code><button class="btn small copy" data-cmd="${esc(cmd)}">Copy</button></div>`).join("");
}

function renderSetup(s) {
  const os = s.os;
  const items = [];
  const add = (st, title, sub, how) => items.push({ st, title, sub, how });
  add(s.claude ? "ok" : "todo", "Claude Code installed", s.claude_version ? `version ${s.claude_version}` : "",
    s.claude ? "" : cmdRows(INSTALL.claude[os]) + "<p>Then close Tweensy and open it again.</p>");
  add(s.logged_in ? "ok" : "todo", "Signed in to your Claude plan", s.logged_in && s.plan ? `${s.plan}` : "",
    s.logged_in ? "" : (s.claude ? cmdRows(INSTALL.login) + "<p>It opens your browser to log in. You need a paid plan: Pro, Max, Team or Enterprise.</p>" : "<p>Do this after Claude Code is installed.</p>"));
  const ready = s.claude && s.logged_in;
  const toolsHow = (key) => (ready ? `<p>Easiest: press <b>Set up my computer</b> below and Claude installs it for you.</p>` : "") + cmdRows(INSTALL[key][os]);
  add(s.node ? "ok" : "todo", "Node.js 22 or newer", s.node_version || "", s.node ? "" : toolsHow("node"));
  add(s.ffmpeg ? "ok" : "todo", "FFmpeg", "", s.ffmpeg ? "" : toolsHow("ffmpeg"));
  const viaSetup = ready ? "Press <b>Set up my computer</b> below. It" : "Once Claude Code is signed in, the <b>Set up my computer</b> button";
  add(s.skills ? "ok" : "optional", "HyperFrames skills", s.skills ? "" : "recommended",
    s.skills ? "" : `<p>${viaSetup} installs them (it runs <code>npx hyperframes skills</code>).</p>`);
  add(s.whisper ? "ok" : "optional", "whisper-cpp", s.whisper ? "" : "optional",
    s.whisper ? "" : `<p>Only needed to add graphics to your own talking video. ${viaSetup} installs it too.</p>`);

  $("#checklist").innerHTML = items.map((it) => `<li class="check ${it.st}">
      <span class="mark">${it.st === "ok" ? "✓" : it.st === "todo" ? "!" : "–"}</span>
      <span class="t">${esc(it.title)}${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</span>
      ${it.how ? `<div class="how">${it.how}</div>` : ""}
    </li>`).join("");

  const foot = $(".modal-foot");
  foot.querySelector("#runSetup")?.remove();
  if (ready && (!s.node || !s.ffmpeg || !s.skills || !s.whisper)) {
    const b = document.createElement("button");
    b.className = "btn"; b.id = "runSetup"; b.textContent = "Set up my computer";
    b.onclick = () => {
      const p = findItem("setup");
      closeSetup();
      if (p) { setInput(p.text); send(); }
    };
    foot.insertBefore(b, $("#recheckNote"));
  }
  $("#checklist").querySelectorAll(".copy").forEach((b) => (b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.cmd); b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1200); } catch {}
  }));
}

export async function loadStatus(open) {
  $("#recheckNote").textContent = "Checking…";
  const s = await api("/api/status");
  $("#recheckNote").textContent = s.ready ? "All set. You can make videos." : "";
  $("#setupDot").className = "dot " + (s.ready ? "ok" : "bad");
  $("#setupLabel").textContent = s.ready ? "Ready" : "Setup needed";
  renderSetup(s);
  if (open || !s.ready) openSetup();
}

function openSetup() { $("#setup").hidden = false; }
function closeSetup() { $("#setup").hidden = true; }

export function initSetup() {
  $("#setupBtn").onclick = () => { openSetup(); loadStatus(false); };
  $("#setupClose").onclick = closeSetup;
  $("#setup").addEventListener("click", (e) => { if (e.target.id === "setup") closeSetup(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSetup(); });
  $("#recheck").onclick = () => loadStatus(false);
}
