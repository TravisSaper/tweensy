// In-app dialogs (a centred card over a blurred background) instead of the browser's
// prompt/confirm/alert boxes. Each call returns a promise.

import { $ } from "./util.js";

let close = null; // resolves the open dialog

function open({ title, text = "", input = null, okText = "OK", cancelText = "Cancel", danger = false, hint = null }) {
  return new Promise((resolve) => {
    $("#dlgTitle").textContent = title;
    $("#dlgText").textContent = text;
    $("#dlgText").hidden = !text;
    const field = $("#dlgInput");
    field.hidden = !input;
    field.value = input?.value || "";
    field.placeholder = input?.placeholder || "";
    const ok = $("#dlgOk");
    ok.textContent = okText;
    ok.classList.toggle("danger", danger);
    $("#dlgCancel").textContent = cancelText;
    $("#dlgCancel").hidden = !cancelText;
    const update = () => {
      const h = hint ? hint(field.value) : "";
      $("#dlgHint").innerHTML = h || "";
      $("#dlgHint").hidden = !h;
      ok.disabled = !!input && !field.value.trim();
    };
    field.oninput = update;
    update();
    close = (value) => { $("#dialog").hidden = true; close = null; resolve(value); };
    ok.onclick = () => close(input ? field.value.trim() : true);
    $("#dlgCancel").onclick = () => close(input ? null : false);
    $("#dialog").hidden = false;
    (input ? field : ok).focus();
  });
}

// Ask for a line of text. Resolves to the text, or null if cancelled.
export const askText = (opts) => open({ ...opts, input: { value: opts.value, placeholder: opts.placeholder } });
// Ask yes/no. Resolves to true or false.
export const confirmBox = (opts) => open(opts);
// Tell the person something. Resolves when they close it.
export const notice = (text, title = "Heads up") => open({ title, text, cancelText: "" });

export function initDialog() {
  $("#dialog").addEventListener("click", (e) => { if (e.target.id === "dialog" && close) $("#dlgCancel").click(); });
  // Capture so Escape/Enter here don't also reach the storyboard or chat underneath.
  document.addEventListener("keydown", (e) => {
    if (!close) return;
    if (e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); $("#dlgCancel").hidden ? $("#dlgOk").click() : $("#dlgCancel").click(); }
    if (e.key === "Enter" && !$("#dlgOk").disabled) { e.stopImmediatePropagation(); e.preventDefault(); $("#dlgOk").click(); }
  }, true);
}
