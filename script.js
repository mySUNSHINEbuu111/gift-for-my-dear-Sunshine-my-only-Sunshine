/* ==================================================================
   AMONG THE STARS — cinematic memory journey
   Pure HTML / CSS / vanilla JS. No dependencies.

   Structure of this file:
   1. Utilities
   2. Loading sequence (typing text, percentage, small starfield)
   3. Universe starfield engine (persistent canvas background)
   4. Memory section choreography (entrance / clearing / dissolve)
   5. Finale — stars gather into a heart
   6. Boot
   ================================================================== */

(function () {
  "use strict";

  /* ----------------------------------------------------------------
     1. UTILITIES
     ---------------------------------------------------------------- */
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const STAR_COLORS = ["#FFFFFF", "#FFFFFF", "#A9C7FF", "#F4C430"]; // weighted toward white

  /* ----------------------------------------------------------------
     2. LOADING SEQUENCE
     ---------------------------------------------------------------- */
  const LoadingSequence = (() => {
    const screenEl = document.getElementById("loading-screen");
    const typingTextEl = document.getElementById("typing-text");
    const percentEl = document.getElementById("loading-percent");
    const flashEl = document.getElementById("flash-overlay");
    const canvas = document.getElementById("loading-stars");
    const ctx = canvas.getContext("2d");

    const MESSAGE = "Every beautiful story begins with a single moment...";
    let dots = [];
    let raf = null;

    function resize() {
      canvas.width = window.innerWidth * devicePixelRatio;
      canvas.height = window.innerHeight * devicePixelRatio;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    }

    function seedDots(count) {
      while (dots.length < count) {
        dots.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          r: rand(0.4, 1.6),
          a: rand(0.2, 0.9),
          phase: rand(0, Math.PI * 2),
        });
      }
    }

    function drawDots(t) {
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const d of dots) {
        const tw = 0.5 + 0.5 * Math.sin(t * 0.002 + d.phase);
        ctx.globalAlpha = d.a * tw;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function typeText(onDone) {
      let i = 0;
      const speed = prefersReducedMotion ? 0 : 34;
      if (prefersReducedMotion) {
        typingTextEl.textContent = MESSAGE;
        onDone();
        return;
      }
      (function step() {
        typingTextEl.textContent = MESSAGE.slice(0, i);
        i++;
        if (i <= MESSAGE.length) {
          setTimeout(step, speed);
        } else {
          onDone();
        }
      })();
    }

    function runProgress(onDone) {
      const duration = prefersReducedMotion ? 400 : 2600;
      const start = performance.now();

      function frame(now) {
        const t = clamp((now - start) / duration, 0, 1);
        const pct = Math.round(easeOutCubic(t) * 100);
        percentEl.textContent = pct + "%";
        seedDots(Math.round(20 + pct * 4)); // stars accumulate as we load
        drawDots(now);
        if (t < 1) {
          raf = requestAnimationFrame(frame);
        } else {
          onDone();
        }
      }
      raf = requestAnimationFrame(frame);
    }

    function reveal() {
      cancelAnimationFrame(raf);
      flashEl.classList.add("flash");
      setTimeout(() => {
        screenEl.classList.add("hide");
        document.body.style.overflow = "";
      }, 160);
      setTimeout(() => {
        screenEl.remove();
        flashEl.remove();
      }, 1400);
    }

    function start() {
      document.body.style.overflow = "hidden";
      resize();
      window.addEventListener("resize", resize);
      typeText(() => {
        runProgress(reveal);
      });
    }

    return { start };
  })();

  /* ----------------------------------------------------------------
     3. UNIVERSE STARFIELD ENGINE
     ---------------------------------------------------------------- */
  const Universe = (() => {
    const canvas = document.getElementById("universe-canvas");
    const ctx = canvas.getContext("2d");

    let w = 0, h = 0, dpr = 1;
    let stars = [];
    let particles = [];
    let clearings = []; // { x, y, radius, strength }

    let scrollY = window.scrollY;
    let smoothScrollY = scrollY;
    let scrollVelocity = 0;

    let mouseX = 0, mouseY = 0; // normalized -1..1
    let time = 0;

    // Finale heart state
    const heart = {
      active: false,
      progress: 0,   // 0..1 gathering
      holding: 0,    // seconds held as a heart
      fading: 0,     // 0..1 fade out
      stars: [],
      done: false,
    };

    const STAR_COUNT_DESKTOP = 420;
    const STAR_COUNT_MOBILE = 220;
    const PARALLAX_SPEED = 0.0009; // how strongly scroll shifts each depth layer

    function starCount() {
      return window.innerWidth < 720 ? STAR_COUNT_MOBILE : STAR_COUNT_DESKTOP;
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function buildStars() {
      const count = starCount();
      stars = [];
      for (let i = 0; i < count; i++) {
        const depth = pick([0.35, 0.6, 1]); // far / mid / near
        stars.push({
          baseX: Math.random(),
          baseY: Math.random(),
          depth,
          size: depth * rand(0.7, 1.8) + 0.3,
          color: pick(STAR_COLORS),
          twinkleSpeed: rand(0.6, 1.8),
          twinklePhase: rand(0, Math.PI * 2),
          driftAmpX: rand(6, 22),
          driftAmpY: rand(6, 22),
          driftSpeed: rand(0.05, 0.15),
          driftPhase: rand(0, Math.PI * 2),
          absorbed: false, // true while participating in the finale heart
        });
      }
    }

    function onScroll() {
      scrollY = window.scrollY;
    }

    function onMouseMove(e) {
      mouseX = (e.clientX / w) * 2 - 1;
      mouseY = (e.clientY / h) * 2 - 1;
    }

    /* ---- Public API used by memory choreography ---- */
    function addClearing(id, x, y, radius) {
      let c = clearings.find((c) => c.id === id);
      if (!c) {
        c = { id, x, y, radius, strength: 0, target: 1 };
        clearings.push(c);
      }
      c.x = x;
      c.y = y;
      c.radius = radius;
      c.target = 1;
    }

    function releaseClearing(id) {
      const c = clearings.find((c) => c.id === id);
      if (c) c.target = 0;
    }

    function burstParticles(x, y, count = 26, color = "#F4D166") {
      for (let i = 0; i < count; i++) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(0.4, 2.2);
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: rand(0.6, 2.2),
          life: 1,
          decay: rand(0.006, 0.014),
          color,
        });
      }
    }

    function startHeart() {
      if (heart.active || heart.done) return;
      heart.active = true;
      heart.progress = 0;

      // Sample points along a parametric heart curve, centered on screen.
      const centerX = w / 2;
      const centerY = h * 0.46;
      const scale = Math.min(w, h) * 0.02;
      const n = Math.min(160, stars.length);
      const chosen = [...stars].sort(() => Math.random() - 0.5).slice(0, n);

      chosen.forEach((star, i) => {
        const t = (i / n) * Math.PI * 2;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy =
          -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));

        star.absorbed = true;
        heart.stars.push({
          star,
          sx: star.baseX * w,
          sy: star.baseY * h,
          tx: centerX + hx * scale,
          ty: centerY + hy * scale,
        });
      });
    }

    function drawStar(x, y, size, color, alpha) {
      if (alpha <= 0.002) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // soft glow for larger / near stars
      if (size > 1.1) {
        ctx.globalAlpha = alpha * 0.25;
        ctx.beginPath();
        ctx.arc(x, y, size * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function updateAndDraw(now) {
      time = now;
      ctx.clearRect(0, 0, w, h);

      // smooth the scroll so the "camera" glides rather than jitters
      smoothScrollY = lerp(smoothScrollY, scrollY, 0.08);
      scrollVelocity = lerp(scrollVelocity, scrollY - smoothScrollY, 0.1);

      // ease clearings toward their target strength
      clearings.forEach((c) => (c.strength = lerp(c.strength, c.target, 0.06)));
      clearings = clearings.filter((c) => !(c.target === 0 && c.strength < 0.01));

      for (const star of stars) {
        if (star.absorbed) continue; // drawn separately by the finale routine

        // continuous vertical parallax tied to scroll — near stars travel faster
        let py = (star.baseY * h + smoothScrollY * star.depth * PARALLAX_SPEED * 1000) % h;
        if (py < 0) py += h;
        let px = star.baseX * w;

        // gentle organic drift — "leaves floating on calm water"
        const drift = prefersReducedMotion ? 0 : 1;
        px += Math.sin(time * 0.001 * star.driftSpeed + star.driftPhase) * star.driftAmpX * drift;
        py += Math.cos(time * 0.001 * star.driftSpeed + star.driftPhase) * star.driftAmpY * drift;

        // subtle mouse parallax, stronger for nearer stars
        px += mouseX * 14 * star.depth;
        py += mouseY * 10 * star.depth;

        // scroll-velocity streak: near stars stretch outward from center briefly
        px += (px - w / 2) * Math.min(Math.abs(scrollVelocity) * 0.0006, 0.05) * star.depth;

        let alpha = 0.55 + 0.45 * Math.sin(time * 0.0016 * star.twinkleSpeed + star.twinklePhase);
        alpha = clamp(alpha, 0.08, 1) * (0.35 + 0.65 * star.depth);

        // stars part gently near an active memory — "water flowing around a stone"
        for (const c of clearings) {
          if (c.strength <= 0.01) continue;
          const dx = px - c.x, dy = py - c.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < c.radius) {
            const push = (1 - dist / c.radius) * c.strength;
            const angle = Math.atan2(dy, dx);
            px += Math.cos(angle) * push * 60;
            py += Math.sin(angle) * push * 60;
            alpha *= 1 - push * 0.85;
          }
        }

        drawStar(px, py, star.size, star.color, alpha);
      }

      // temporary dissolve / burst particles
      particles = particles.filter((p) => p.life > 0);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= p.decay;
        drawStar(p.x, p.y, 1.4, p.color, clamp(p.life, 0, 1));
      }

      // finale heart formation
      if (heart.active) {
        const GATHER_TIME = prefersReducedMotion ? 0.4 : 2.6;
        heart.progress = clamp(heart.progress + (1 / 60) / GATHER_TIME, 0, 1);
        const t = easeInOutSine(heart.progress);

        heart.stars.forEach((hs) => {
          const x = lerp(hs.sx, hs.tx, t);
          const y = lerp(hs.sy, hs.ty, t);
          let alpha = 0.9;
          let size = hs.star.size + 1.2;

          if (heart.progress >= 1) {
            const pulse = 0.5 + 0.5 * Math.sin(time * 0.0025);
            size += pulse * 1.4;
            alpha = 1;
          }
          if (heart.fading > 0) {
            alpha *= 1 - heart.fading;
          }
          drawStar(x, y, size, "#F4C430", alpha);
        });

        if (heart.progress >= 1) {
          heart.holding += 1 / 60;
          if (heart.holding > (prefersReducedMotion ? 0.6 : 2.4) && heart.fading < 1) {
            heart.fading = clamp(heart.fading + 1 / 120, 0, 1);
            document.getElementById("finale-message").classList.add("show");
          }
          if (heart.fading >= 1 && !heart.done) {
            heart.done = true;
            heart.stars.forEach((hs) => (hs.star.absorbed = false)); // return stars to the sky
            heart.active = false;
          }
        }
      }

      requestAnimationFrame(updateAndDraw);
    }

    function start() {
      resize();
      buildStars();
      window.addEventListener("resize", () => { resize(); buildStars(); });
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("mousemove", onMouseMove, { passive: true });
      requestAnimationFrame(updateAndDraw);
    }

    return { start, addClearing, releaseClearing, burstParticles, startHeart };
  })();

  /* ----------------------------------------------------------------
     4. MEMORY SECTION CHOREOGRAPHY
     ---------------------------------------------------------------- */
  const MemoryChoreography = (() => {
    function centerOf(el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.max(r.width, r.height) / 2 };
    }

    function init() {
      const figures = document.querySelectorAll(".memory-figure");

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const fig = entry.target;
            const id = fig.dataset.id;

            if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
              // stars part to make room, then the memory arrives
              const c = centerOf(fig);
              Universe.addClearing(id, c.x, c.y, c.r * 1.6 + 80);
              fig.classList.remove("leaving");
              fig.classList.add("in-view");
            } else if (fig.classList.contains("in-view")) {
              // the memory dissolves back into light as the camera moves on
              const c = centerOf(fig);
              fig.classList.add("leaving");
              fig.classList.remove("in-view");
              Universe.burstParticles(c.x, c.y, 30, "#F4D166");
              Universe.releaseClearing(id);
            }
          });
        },
        { threshold: [0, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9], rootMargin: "0px 0px -5% 0px" }
      );

      figures.forEach((fig, i) => {
        fig.dataset.id = "memory-" + i;
        observer.observe(fig);
      });
    }

    return { init };
  })();

  /* ----------------------------------------------------------------
     5. FINALE
     ---------------------------------------------------------------- */
  const Finale = (() => {
    function init() {
      const el = document.getElementById("finale");
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              Universe.startHeart();
            }
          });
        },
        { threshold: 0.5 }
      );
      observer.observe(el);
    }
    return { init };
  })();

  /* ----------------------------------------------------------------
     6. BOOT
     ---------------------------------------------------------------- */
  document.addEventListener("visibilitychange", () => {
    // Pausing heavy work when the tab is hidden keeps things efficient;
    // requestAnimationFrame already throttles in background tabs, so we
    // simply avoid doing extra work here — nothing further required.
  });

  window.addEventListener("DOMContentLoaded", () => {
    Universe.start();
    MemoryChoreography.init();
    Finale.init();
    LoadingSequence.start();
  });
})();






const music = document.getElementById("bgMusic");

function startMusic() {
    music.volume = 0.4; // 40% volume
    music.play();

    // Remove event listeners after first interaction
    document.removeEventListener("click", startMusic);
    document.removeEventListener("keydown", startMusic);
    document.removeEventListener("touchstart", startMusic);
}

document.addEventListener("click", startMusic);
document.addEventListener("keydown", startMusic);
document.addEventListener("touchstart", startMusic);

