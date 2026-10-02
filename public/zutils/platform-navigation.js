// Connect the standalone tool export's category sidebar to the platform toolbox.
// Use ordinary top-level links so keyboard, modifiers and standalone windows work too.
(function () {
  "use strict";
  const source = document.currentScript && document.currentScript.src;
  if (!source) return;
  const pathname = new URL(source).pathname;
  const marker = pathname.lastIndexOf("/zutils/");
  if (marker < 0) return;
  const basePath = pathname.slice(0, marker);
  const categories = new Set(["all", "hardware", "instrument", "network", "code", "ai", "crc", "radix", "time", "design"]);

  function repair(anchor) {
    if (!anchor || !anchor.closest("aside")) return;
    const match = (anchor.getAttribute("href") || "").match(/^\/?#([a-z]+)$/);
    if (!match || !categories.has(match[1])) return;
    const route = match[1] === "ai"
      ? "/app/agent"
      : "/app/tools" + (match[1] === "all" ? "" : "?category=" + match[1]);
    anchor.setAttribute("href", basePath + route);
    anchor.setAttribute("target", "_top");
  }

  document.querySelectorAll("aside a").forEach(repair);
  // React can recreate sidebar anchors after the static export hydrates. Repair
  // before every native activation, including keyboard, middle click and copying links.
  function beforeActivation(event) {
    if (event.target instanceof Element) repair(event.target.closest("aside a"));
  }
  for (const type of ["pointerdown", "click", "auxclick", "contextmenu"]) {
    document.addEventListener(type, beforeActivation, true);
  }
})();
