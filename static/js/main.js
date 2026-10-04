// Entry point: wire up each part of the page, then load the guide, projects and setup status.

import { api } from "./util.js";
import { state, MOBILE } from "./state.js";
import { TABS, buildNav, renderGuide, showTab } from "./guide.js";
import { initExport } from "./export.js";
import { initSetup, loadStatus } from "./setup.js";
import { initProjects, loadProjects } from "./projects.js";
import { initChat } from "./chat.js";
import { initVideos } from "./videos.js";
import { initSketch } from "./sketch.js";
import { initDialog } from "./dialog.js";
import { initLibrary } from "./library.js";

initExport();
initSetup();
initProjects();
initChat();
initVideos();
initSketch();
initDialog();
buildNav();
initLibrary();

state.guide = await api("/api/guide");
let tab = "guide";
try { tab = localStorage.getItem("ms-tab") || "guide"; } catch {}
state.tab = TABS.some((t) => t.id === tab && !t.mobile) ? tab : "guide";
renderGuide();
showTab(MOBILE.matches ? "chat" : state.tab);
await Promise.all([loadProjects(), loadStatus(false)]);
