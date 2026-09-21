const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

for (const preview of document.querySelectorAll("[data-climate-preview]")) {
  const trigger = preview.querySelector(".climate-trigger");
  const video = preview.querySelector("video");
  let pinnedOpen = false;

  if (!trigger || !video) continue;

  const play = () => {
    if (reducedMotion.matches) return;

    video.play().catch(() => {
      video.controls = true;
    });
  };

  const resetVideo = () => {
    video.pause();
    video.currentTime = 0;
  };

  const open = () => {
    preview.classList.remove("climate-hover--dismissed");
    preview.classList.add("climate-hover--active");
    play();
  };

  const close = () => {
    pinnedOpen = false;
    preview.classList.remove("climate-hover--active");
    preview.classList.add("climate-hover--dismissed");
    trigger.setAttribute("aria-expanded", "false");

    if (preview.contains(document.activeElement)) document.activeElement.blur();
    resetVideo();
  };

  const closeIfIdle = () => {
    if (pinnedOpen || preview.matches(":hover") || preview.contains(document.activeElement)) return;
    preview.classList.remove("climate-hover--active");
    resetVideo();
  };

  trigger.addEventListener("click", (event) => {
    event.preventDefault();

    if (pinnedOpen) {
      close();
      return;
    }

    pinnedOpen = true;
    trigger.setAttribute("aria-expanded", "true");
    open();
  });

  trigger.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    trigger.click();
  });

  preview.addEventListener("pointerenter", open);
  preview.addEventListener("pointerleave", () => {
    preview.classList.remove("climate-hover--dismissed");
    closeIfIdle();
  });
  preview.addEventListener("focusin", open);
  preview.addEventListener("focusout", () => requestAnimationFrame(closeIfIdle));

  document.addEventListener("pointerdown", (event) => {
    if (pinnedOpen && !preview.contains(event.target)) close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && pinnedOpen) close();
  });

  video.addEventListener("playing", () => {
    video.controls = false;
  });
}
