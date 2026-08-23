(() => {
  "use strict";

  const precisePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const trigger = document.querySelector("[data-word-collision]");

  if (!trigger || !precisePointer.matches || reducedMotion.matches) {
    return;
  }

  const root = document.documentElement;
  const WORD_PATTERN = /\S+/gu;
  const MAX_SPEED = 6.5;
  let activeState = null;

  const textNodes = () => {
    const nodes = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT;
          }

          const parent = node.parentElement;
          if (!parent || parent.closest("script, style, .particle-field")) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    return nodes;
  };

  const wrapWords = () => {
    const wordElements = [];
    const parents = new Set();

    textNodes().forEach((node) => {
      const text = node.nodeValue;
      const fragment = document.createDocumentFragment();
      let cursor = 0;

      for (const match of text.matchAll(WORD_PATTERN)) {
        if (match.index > cursor) {
          fragment.append(document.createTextNode(text.slice(cursor, match.index)));
        }

        const word = document.createElement("span");
        word.className = "word-particle";
        word.textContent = match[0];
        fragment.append(word);
        wordElements.push(word);
        cursor = match.index + match[0].length;
      }

      if (cursor < text.length) {
        fragment.append(document.createTextNode(text.slice(cursor)));
      }

      parents.add(node.parentNode);
      node.replaceWith(fragment);
    });

    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const particles = wordElements.map((element) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const outwardAngle = Math.atan2(
        centerY - viewportCenterY,
        centerX - viewportCenterX,
      );
      const angle = outwardAngle + (Math.random() - 0.5) * 1.45;
      const speed = 2.6 + Math.random() * 2.8;

      return {
        element,
        homeX: rect.left,
        homeY: rect.top,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      };
    });

    return { particles, parents };
  };

  const unwrapWords = (state) => {
    state.particles.forEach(({ element }) => {
      element.replaceWith(document.createTextNode(element.textContent));
    });
    state.parents.forEach((parent) => parent?.normalize());
  };

  const capSpeed = (particle) => {
    const speed = Math.hypot(particle.vx, particle.vy);
    if (speed > MAX_SPEED) {
      particle.vx = (particle.vx / speed) * MAX_SPEED;
      particle.vy = (particle.vy / speed) * MAX_SPEED;
    }
  };

  const collide = (particles) => {
    for (let firstIndex = 0; firstIndex < particles.length; firstIndex += 1) {
      const first = particles[firstIndex];

      for (let secondIndex = firstIndex + 1; secondIndex < particles.length; secondIndex += 1) {
        const second = particles[secondIndex];
        const overlapX = Math.min(first.x + first.width, second.x + second.width)
          - Math.max(first.x, second.x);
        const overlapY = Math.min(first.y + first.height, second.y + second.height)
          - Math.max(first.y, second.y);

        if (overlapX <= 0 || overlapY <= 0) {
          continue;
        }

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

  const updateGas = (state, elapsed) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    state.particles.forEach((particle) => {
      particle.vx += (Math.random() - 0.5) * 0.018 * elapsed;
      particle.vy += (Math.random() - 0.5) * 0.018 * elapsed;
      capSpeed(particle);

      particle.x += particle.vx * elapsed;
      particle.y += particle.vy * elapsed;

      const maxX = Math.max(0, viewportWidth - particle.width);
      const maxY = Math.max(0, viewportHeight - particle.height);

      if (particle.x <= 0 || particle.x >= maxX) {
        particle.x = Math.max(0, Math.min(maxX, particle.x));
        particle.vx = particle.x <= 0
          ? Math.abs(particle.vx)
          : -Math.abs(particle.vx);
      }

      if (particle.y <= 0 || particle.y >= maxY) {
        particle.y = Math.max(0, Math.min(maxY, particle.y));
        particle.vy = particle.y <= 0
          ? Math.abs(particle.vy)
          : -Math.abs(particle.vy);
      }
    });

    collide(state.particles);
  };

  const updateAssembly = (state, elapsed, now) => {
    let totalDistance = 0;
    let totalSpeed = 0;
    const damping = Math.pow(0.78, elapsed);

    state.particles.forEach((particle) => {
      const dx = particle.homeX - particle.x;
      const dy = particle.homeY - particle.y;

      particle.vx = (particle.vx + dx * 0.052 * elapsed) * damping;
      particle.vy = (particle.vy + dy * 0.052 * elapsed) * damping;
      particle.x += particle.vx * elapsed;
      particle.y += particle.vy * elapsed;

      totalDistance += Math.abs(dx) + Math.abs(dy);
      totalSpeed += Math.abs(particle.vx) + Math.abs(particle.vy);
    });

    const averageDistance = totalDistance / state.particles.length;
    const averageSpeed = totalSpeed / state.particles.length;
    const settled = averageDistance < 0.18 && averageSpeed < 0.08;
    const timedOut = now - state.assemblyStartedAt > 1150;

    if (settled || timedOut) {
      finish(state);
    }
  };

  const draw = (state) => {
    state.particles.forEach((particle) => {
      const x = particle.x - particle.homeX;
      const y = particle.y - particle.homeY;
      particle.element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
  };

  const tick = (state, now) => {
    if (activeState !== state) {
      return;
    }

    const elapsed = Math.min((now - state.previousFrame) / 16.667, 2);
    state.previousFrame = now;

    if (state.mode === "gas") {
      updateGas(state, elapsed);
    } else {
      updateAssembly(state, elapsed, now);
    }

    if (activeState === state) {
      draw(state);
      state.animationFrame = requestAnimationFrame((time) => tick(state, time));
    }
  };

  function finish(state) {
    if (!state) {
      return;
    }

    cancelAnimationFrame(state.animationFrame);
    unwrapWords(state);
    root.classList.remove("word-collision-active");

    if (activeState === state) {
      activeState = null;
    }
  }

  const activate = () => {
    if (activeState) {
      activeState.mode = "gas";
      activeState.particles.forEach((particle) => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.6 + Math.random() * 2.8;
        particle.vx += Math.cos(angle) * speed;
        particle.vy += Math.sin(angle) * speed;
        capSpeed(particle);
      });
      return;
    }

    window.dispatchEvent(new Event("wordcollisionstart"));
    root.classList.add("word-collision-active");
    const { particles, parents } = wrapWords();

    if (particles.length === 0) {
      root.classList.remove("word-collision-active");
      return;
    }

    const now = performance.now();
    activeState = {
      particles,
      parents,
      mode: "gas",
      previousFrame: now,
      assemblyStartedAt: 0,
      animationFrame: 0,
    };

    draw(activeState);
    const state = activeState;
    state.animationFrame = requestAnimationFrame((time) => tick(state, time));
  };

  const reassemble = () => {
    if (!activeState) {
      return;
    }

    activeState.mode = "assemble";
    activeState.assemblyStartedAt = performance.now();
  };

  const cancel = () => finish(activeState);

  trigger.addEventListener("pointerenter", activate);
  trigger.addEventListener("pointerleave", reassemble);
  window.addEventListener("blur", reassemble);
  window.addEventListener("resize", cancel, { passive: true });
  window.addEventListener("pagehide", cancel);
})();
