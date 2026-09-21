const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

for (const preview of document.querySelectorAll("[data-climate-preview]")) {
  const video = preview.querySelector("video");

  if (!video) continue;

  const play = () => {
    if (!reducedMotion.matches) video.play().catch(() => {});
  };

  const pause = () => {
    if (preview.matches(":hover") || preview.contains(document.activeElement)) return;
    video.pause();
    video.currentTime = 0;
  };

  preview.addEventListener("pointerenter", play);
  preview.addEventListener("pointerleave", pause);
  preview.addEventListener("focusin", play);
  preview.addEventListener("focusout", () => requestAnimationFrame(pause));
}
