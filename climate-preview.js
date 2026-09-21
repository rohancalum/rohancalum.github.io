const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)");

for (const preview of document.querySelectorAll("[data-climate-preview]")) {
  const trigger = preview.querySelector(".climate-trigger");
  const video = preview.querySelector("video");
  const closeButton = preview.querySelector(".climate-preview__close");
  let pinnedOpen = false;

  if (!trigger || !video) continue;

  if (!hoverCapable.matches && video.dataset.mobileSrc) {
    video.preload = "metadata";
    video.src = video.dataset.mobileSrc;
    video.load();
  }

  const play = (userInitiated = false) => {
    if (reducedMotion.matches && !userInitiated) return;

    video.play().catch(() => {
      video.controls = true;
    });
  };

  const resetVideo = () => {
    video.pause();
    video.currentTime = 0;
  };

  const open = (userInitiated = false) => {
    preview.classList.remove("climate-hover--dismissed");
    preview.classList.add("climate-hover--active");
    play(userInitiated);
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
    open(true);
  });

  trigger.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    trigger.click();
  });

  closeButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    close();
  });

  if (hoverCapable.matches) {
    preview.addEventListener("pointerenter", () => open());
    preview.addEventListener("pointerleave", () => {
      preview.classList.remove("climate-hover--dismissed");
      closeIfIdle();
    });
    preview.addEventListener("focusin", () => open());
    preview.addEventListener("focusout", () => requestAnimationFrame(closeIfIdle));
  }

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
