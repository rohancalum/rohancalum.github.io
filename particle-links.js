(() => {
  "use strict";

  const precisePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!precisePointer.matches || reducedMotion.matches) {
    return;
  }

  const FIELD_PADDING = 0;
  const INNER_EDGE = 1;
  const MIN_FRAGMENT = 2.75;
  const MAX_FRAGMENTS = 128;
  const MAX_PIXEL_RATIO = 2;
  let activeField = null;

  const randomVelocity = () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.45 + Math.random() * 0.75;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };
  };

  const splitText = (text) => {
    if ("Segmenter" in Intl) {
      const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      return [...segmenter.segment(text)].map(({ segment }) => segment);
    }

    return Array.from(text);
  };

  const fontFrom = (style) => [
    style.fontStyle,
    style.fontVariant,
    style.fontWeight,
    style.fontSize,
    style.fontFamily,
  ].join(" ");

  const canSplit = (particle) => (
    particle.w >= MIN_FRAGMENT * 2 || particle.h >= MIN_FRAGMENT * 2
  );

  const splitParticle = (state, index) => {
    if (state.particles.length >= MAX_FRAGMENTS) {
      return false;
    }

    const particle = state.particles[index];
    const canSplitX = particle.w >= MIN_FRAGMENT * 2;
    const canSplitY = particle.h >= MIN_FRAGMENT * 2;

    if (!canSplitX && !canSplitY) {
      return false;
    }

    const splitX = canSplitX && (!canSplitY || (
      particle.w > particle.h ? Math.random() > 0.18 : Math.random() > 0.72
    ));
    const ratio = 0.4 + Math.random() * 0.2;
    const kick = 0.25 + Math.random() * 0.35;
    let first;
    let second;

    if (splitX) {
      const cut = Math.max(
        MIN_FRAGMENT,
        Math.min(particle.w - MIN_FRAGMENT, particle.w * ratio),
      );

      first = {
        ...particle,
        sw: cut,
        w: cut,
        vx: particle.vx - kick,
        vy: particle.vy + (Math.random() - 0.5) * kick,
      };
      second = {
        ...particle,
        sx: particle.sx + cut,
        sw: particle.sw - cut,
        x: particle.x + cut,
        w: particle.w - cut,
        targetX: particle.targetX + cut,
        vx: particle.vx + kick,
        vy: particle.vy + (Math.random() - 0.5) * kick,
      };
    } else {
      const cut = Math.max(
        MIN_FRAGMENT,
        Math.min(particle.h - MIN_FRAGMENT, particle.h * ratio),
      );

      first = {
        ...particle,
        sh: cut,
        h: cut,
        vx: particle.vx + (Math.random() - 0.5) * kick,
        vy: particle.vy - kick,
      };
      second = {
        ...particle,
        sy: particle.sy + cut,
        sh: particle.sh - cut,
        y: particle.y + cut,
        h: particle.h - cut,
        targetY: particle.targetY + cut,
        vx: particle.vx + (Math.random() - 0.5) * kick,
        vy: particle.vy + kick,
      };
    }

    state.particles.splice(index, 1, first, second);
    return true;
  };

  const limitSpeed = (particle) => {
    const speed = Math.hypot(particle.vx, particle.vy);
    const limit = 1.8;

    if (speed > limit) {
      particle.vx = (particle.vx / speed) * limit;
      particle.vy = (particle.vy / speed) * limit;
    }
  };

  const collide = (state, impacted) => {
    const particles = state.particles;

    for (let i = 0; i < particles.length; i += 1) {
      const first = particles[i];
      const neighborWindow = particles.length > 96 ? 5 : 9;
      const searchEnd = Math.min(particles.length, i + neighborWindow);

      for (let j = i + 1; j < searchEnd; j += 1) {
        const second = particles[j];
        const overlapX = Math.min(first.x + first.w, second.x + second.w)
          - Math.max(first.x, second.x);
        const overlapY = Math.min(first.y + first.h, second.y + second.h)
          - Math.max(first.y, second.y);

        if (overlapX <= 0 || overlapY <= 0) {
          continue;
        }

        impacted.add(i);
        impacted.add(j);

        if (overlapX < overlapY) {
          const direction = first.x < second.x ? -1 : 1;
          first.x += direction * overlapX * 0.5;
          second.x -= direction * overlapX * 0.5;
          [first.vx, second.vx] = [second.vx, first.vx];
        } else {
          const direction = first.y < second.y ? -1 : 1;
          first.y += direction * overlapY * 0.5;
          second.y -= direction * overlapY * 0.5;
          [first.vy, second.vy] = [second.vy, first.vy];
        }
      }
    }
  };

  const updateGas = (state, elapsed, now) => {
    const impacted = new Set();

    state.particles.forEach((particle, index) => {
      particle.vx += (Math.random() - 0.5) * 0.022 * elapsed;
      particle.vy += (Math.random() - 0.5) * 0.022 * elapsed;
      limitSpeed(particle);

      particle.x += particle.vx * elapsed;
      particle.y += particle.vy * elapsed;

      const maxX = state.width - INNER_EDGE - particle.w;
      const maxY = state.height - INNER_EDGE - particle.h;

      if (particle.x <= INNER_EDGE || particle.x >= maxX) {
        particle.x = Math.max(INNER_EDGE, Math.min(maxX, particle.x));
        particle.vx *= -1;
        impacted.add(index);
      }

      if (particle.y <= INNER_EDGE || particle.y >= maxY) {
        particle.y = Math.max(INNER_EDGE, Math.min(maxY, particle.y));
        particle.vy *= -1;
        impacted.add(index);
      }
    });

    collide(state, impacted);

    if (now < state.nextSplitAt || state.particles.length >= MAX_FRAGMENTS) {
      return;
    }

    const candidates = [...impacted]
      .filter((index) => canSplit(state.particles[index]))
      .sort((a, b) => {
        const firstArea = state.particles[a].w * state.particles[a].h;
        const secondArea = state.particles[b].w * state.particles[b].h;
        return secondArea - firstArea;
      });

    if (candidates.length === 0) {
      state.particles.forEach((particle, index) => {
        if (canSplit(particle)) {
          candidates.push(index);
        }
      });
      candidates.sort((a, b) => {
        const firstArea = state.particles[a].w * state.particles[a].h;
        const secondArea = state.particles[b].w * state.particles[b].h;
        return secondArea - firstArea;
      });
    }

    const splits = Math.min(2, candidates.length);
    candidates
      .slice(0, splits)
      .sort((a, b) => b - a)
      .forEach((index) => splitParticle(state, index));

    const density = state.particles.length / MAX_FRAGMENTS;
    state.nextSplitAt = now + 90 + density * 180;
  };

  const updateAssembly = (state, elapsed, now) => {
    let totalDistance = 0;
    let totalSpeed = 0;
    const damping = Math.pow(0.8, elapsed);

    state.particles.forEach((particle) => {
      const dx = particle.targetX - particle.x;
      const dy = particle.targetY - particle.y;

      particle.vx = (particle.vx + dx * 0.045 * elapsed) * damping;
      particle.vy = (particle.vy + dy * 0.045 * elapsed) * damping;
      particle.x += particle.vx * elapsed;
      particle.y += particle.vy * elapsed;

      totalDistance += Math.abs(dx) + Math.abs(dy);
      totalSpeed += Math.abs(particle.vx) + Math.abs(particle.vy);
    });

    const settled = totalDistance / state.particles.length < 0.18
      && totalSpeed / state.particles.length < 0.08;
    const timedOut = now - state.assemblyStartedAt > 1050;

    if (settled || timedOut) {
      finish(state);
    }
  };

  const draw = (state) => {
    const { context, pixelRatio } = state;
    context.clearRect(0, 0, state.width, state.height);

    state.particles.forEach((particle) => {
      context.drawImage(
        state.atlas,
        particle.sx * pixelRatio,
        particle.sy * pixelRatio,
        particle.sw * pixelRatio,
        particle.sh * pixelRatio,
        particle.x,
        particle.y,
        particle.w,
        particle.h,
      );
    });
  };

  const tick = (state, now) => {
    if (activeField !== state) {
      return;
    }

    const elapsed = Math.min((now - state.previousFrame) / 16.667, 2);
    state.previousFrame = now;

    if (state.mode === "gas") {
      updateGas(state, elapsed, now);
    } else {
      updateAssembly(state, elapsed, now);
    }

    if (activeField === state) {
      draw(state);
      state.animationFrame = requestAnimationFrame((time) => tick(state, time));
    }
  };

  function finish(state) {
    if (!state) {
      return;
    }

    cancelAnimationFrame(state.animationFrame);
    state.link.classList.remove("particle-link--active");
    state.overlay.remove();

    if (activeField === state) {
      activeField = null;
    }
  }

  const buildField = (link) => {
    const clientRects = link.getClientRects();
    if (clientRects.length !== 1) {
      return null;
    }

    const rect = link.getBoundingClientRect();
    const text = link.textContent.replace(/\s+/g, " ").trim();

    if (!text || rect.width < 2 || rect.height < 2) {
      return null;
    }

    const style = getComputedStyle(link);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const width = rect.width + FIELD_PADDING * 2;
    const height = rect.height + FIELD_PADDING * 2;
    const overlay = document.createElement("span");
    const canvas = document.createElement("canvas");
    const atlas = document.createElement("canvas");

    overlay.className = "particle-field";
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.left = `${rect.left - FIELD_PADDING}px`;
    overlay.style.top = `${rect.top - FIELD_PADDING}px`;
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
    overlay.style.color = style.color;

    canvas.width = Math.ceil(width * pixelRatio);
    canvas.height = Math.ceil(height * pixelRatio);
    atlas.width = canvas.width;
    atlas.height = canvas.height;
    overlay.append(canvas);

    const context = canvas.getContext("2d");
    const atlasContext = atlas.getContext("2d");
    if (!context || !atlasContext) {
      return null;
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    atlasContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    atlasContext.font = fontFrom(style);
    atlasContext.textBaseline = "alphabetic";
    atlasContext.fillStyle = style.color;

    const glyphs = splitText(text);
    const letterSpacing = Number.parseFloat(style.letterSpacing) || 0;
    const measurements = glyphs.map((glyph) => atlasContext.measureText(glyph));
    const totalWidth = measurements.reduce((sum, measurement, index) => (
      sum + measurement.width + (index < measurements.length - 1 ? letterSpacing : 0)
    ), 0);
    const reference = atlasContext.measureText("Mg");
    const fallbackSize = Number.parseFloat(style.fontSize) || rect.height;
    const ascent = reference.actualBoundingBoxAscent || fallbackSize * 0.75;
    const descent = reference.actualBoundingBoxDescent || fallbackSize * 0.25;
    const baseline = FIELD_PADDING + (rect.height - ascent - descent) / 2 + ascent;
    let cursor = FIELD_PADDING + Math.max(0, (rect.width - totalWidth) / 2);
    const particles = [];

    glyphs.forEach((glyph, index) => {
      const measurement = measurements[index];
      atlasContext.fillText(glyph, cursor, baseline);

      if (!/^\s+$/.test(glyph)) {
        const left = measurement.actualBoundingBoxLeft || 0;
        const right = measurement.actualBoundingBoxRight || measurement.width;
        const glyphAscent = measurement.actualBoundingBoxAscent || ascent;
        const glyphDescent = measurement.actualBoundingBoxDescent || descent;
        const sx = Math.max(0, cursor - left - 1);
        const sy = Math.max(0, baseline - glyphAscent - 1);
        const sw = Math.min(width - sx, Math.max(2, left + right + 2));
        const sh = Math.min(height - sy, Math.max(2, glyphAscent + glyphDescent + 2));
        const velocity = randomVelocity();

        particles.push({
          sx,
          sy,
          sw,
          sh,
          x: sx,
          y: sy,
          w: sw,
          h: sh,
          targetX: sx,
          targetY: sy,
          ...velocity,
        });
      }

      cursor += measurement.width + letterSpacing;
    });

    if (particles.length === 0) {
      return null;
    }

    document.body.append(overlay);
    link.classList.add("particle-link--active");

    const now = performance.now();
    return {
      link,
      overlay,
      atlas,
      context,
      particles,
      width,
      height,
      pixelRatio,
      mode: "gas",
      previousFrame: now,
      nextSplitAt: now + 120,
      assemblyStartedAt: 0,
      animationFrame: 0,
    };
  };

  const activate = (link) => {
    if (document.documentElement.classList.contains("word-collision-active")) {
      return;
    }

    if (activeField?.link === link) {
      activeField.mode = "gas";
      activeField.particles.forEach((particle) => {
        if (Math.hypot(particle.vx, particle.vy) < 0.25) {
          Object.assign(particle, randomVelocity());
        }
      });
      return;
    }

    finish(activeField);
    activeField = buildField(link);

    if (activeField) {
      draw(activeField);
      const field = activeField;
      field.animationFrame = requestAnimationFrame((time) => tick(field, time));
    }
  };

  const reassemble = (link) => {
    if (!activeField || activeField.link !== link) {
      return;
    }

    activeField.mode = "assemble";
    activeField.assemblyStartedAt = performance.now();
  };

  const initialize = () => {
    document.documentElement.classList.add("particle-links-ready");

    document.querySelectorAll("a").forEach((link) => {
      link.addEventListener("pointerenter", (event) => {
        if (!event.pointerType || event.pointerType === "mouse") {
          activate(link);
        }
      });
      link.addEventListener("pointerleave", () => reassemble(link));
    });

    const clearActiveField = () => finish(activeField);
    window.addEventListener("wordcollisionstart", clearActiveField);
    window.addEventListener("resize", clearActiveField, { passive: true });
    window.addEventListener("scroll", clearActiveField, { passive: true });
    window.addEventListener("pagehide", clearActiveField);
  };

  initialize();
})();
