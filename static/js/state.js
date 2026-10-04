// Shared app state. Modules read and write these fields directly.

export const state = {
  project: null,      // open project name
  busy: false,        // Claude is working on the open project
  guide: [],          // sections from /api/guide
  selected: null,     // video path shown in the player
  videos: [],         // videos in the open project
  versions: [],       // render versions, newest first (see tweensy/versions.py)
  current: null,      // version number the project files match
  compare: [],        // up to two version files picked for side-by-side
  tab: "guide",       // left-panel menu
  exp: { aspect: "16:9", res: "4k", fps: 60 }, // export setting for the open project
};

export const MOBILE = window.matchMedia("(max-width: 1100px)");
export const WORKING = "Claude is working. Renders can take a minute.";

export const findItem = (id) => state.guide.flatMap((s) => s.items).find((i) => i.id === id);
