import { prepareWithSegments, layoutWithLines } from "@chenglou/pretext";

// ─── Config ───────────────────────────────────────────────────────────────────
const CHAR_POOL = "shortpoint";
const FONT_FAMILY = "SF Mono, Fira Code, Courier New, monospace";
const BRAND_BLUE = [49, 97, 209];   // #3161D1
const BRAND_DARK = [120, 140, 190]; // lighter version of #474F65 for visibility on dark bg
const BG_COLOR = "#0a0e1a";
const MOUSE_RADIUS = 80;
const MOUSE_RADIUS_SQ = MOUSE_RADIUS * MOUSE_RADIUS;
const MOUSE_FORCE_SCALED = 2000 * 0.01;
const SETTLE_SPEED = 0.15;
const FRICTION = 0.85;

// ─── Canvas setup ─────────────────────────────────────────────────────────────
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let W, H, dpr;

function resize() {
  dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener("resize", () => { resize(); buildParticles(); });

// ─── Mouse ────────────────────────────────────────────────────────────────────
let mouse = { x: -9999, y: -9999 };
document.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
document.addEventListener("mouseleave", () => { mouse.x = -9999; mouse.y = -9999; });
document.addEventListener("touchmove", (e) => {
  const t = e.touches[0];
  mouse.x = t.clientX;
  mouse.y = t.clientY;
}, { passive: true });
document.addEventListener("touchend", () => { mouse.x = -9999; mouse.y = -9999; });

// ─── ShortPoint logo as a bitmap mask ─────────────────────────────────────────

// ─── Rasterize icon only (geometric S mark) — used on mobile ─────────────────
function rasterizeIconOnly(targetW, targetH) {
  const offscreen = document.createElement("canvas");
  offscreen.width = targetW;
  offscreen.height = targetH;
  const c = offscreen.getContext("2d");

  const sx = targetW / 24;
  const sy = targetH / 32;
  c.setTransform(sx, 0, 0, sy, 0, 0);

  c.fillStyle = "#fff";
  c.strokeStyle = "#fff";
  c.lineWidth = 0.8;
  c.lineJoin = "round";

  const iconPath = new Path2D("M4.677 18.254h8.715v4.725H0V.429h13.392v4.725H4.677v13.1zm5.952-4.295V9.234H24.02v22.55H10.629V27.06h8.715v-13.1h-8.715z");
  c.fill(iconPath);
  c.stroke(iconPath);

  return c.getImageData(0, 0, targetW, targetH);
}

// ─── Rasterize full "shortpoint" text logo ────────────────────────────────────
function rasterizeFullLogo(targetW, targetH) {
  const offscreen = document.createElement("canvas");
  offscreen.width = targetW;
  offscreen.height = targetH;
  const c = offscreen.getContext("2d");

  // Use the SVG paths from Logo.astro — viewBox 0 0 186 32
  const sx = targetW / 186;
  const sy = targetH / 32;
  c.setTransform(sx, 0, 0, sy, 0, 0);

  c.fillStyle = "#fff";
  c.strokeStyle = "#fff";
  // Thicken thin strokes so they survive downsampling into the ASCII grid
  c.lineWidth = 0.8;
  c.lineJoin = "round";

  // Icon mark
  const iconPath = new Path2D("M4.677 18.254h8.715v4.725H0V.429h13.392v4.725H4.677v13.1zm5.952-4.295V9.234H24.02v22.55H10.629V27.06h8.715v-13.1h-8.715z");
  c.fill(iconPath);
  c.stroke(iconPath);

  // "short" text — these are thin serif strokes, thicken more
  c.lineWidth = 1.2;
  const textPath = new Path2D("M50.805 24.913V.429h1.7v8.484c2.084-1.311 4.252-1.976 6.441-1.976 4.337 0 6.526 2.233 6.526 6.721v11.255h-1.786V12.929c0-2.921-1.616-4.36-4.826-4.36-2.147 0-4.272.773-6.356 2.297v14.047h-1.7zM33.8 24.14v-1.719c1.977.688 3.868 1.031 5.782 1.031 3.763 0 5.633-1.203 5.633-3.608 0-1.955-1.382-2.92-4.166-2.92h-2.274c-3.741 0-5.613-1.611-5.613-4.811 0-3.437 2.488-5.155 7.441-5.155 1.914 0 3.762.279 5.761.859v1.719c-1.977-.688-3.847-1.032-5.76-1.032-3.763 0-5.655 1.203-5.655 3.609 0 2.061 1.276 3.092 3.827 3.092h2.274c3.975 0 5.952 1.547 5.952 4.639 0 3.436-2.465 5.155-7.418 5.155-1.913.021-3.783-.279-5.782-.859zm35.371-8.161c0-6.143 2.784-9.192 8.332-9.192 5.57 0 8.333 3.071 8.333 9.192s-2.785 9.192-8.333 9.192c-5.527 0-8.311-3.072-8.332-9.192zm8.354 7.645c4.378 0 6.547-2.577 6.547-7.732 0-5.047-2.189-7.581-6.547-7.581-4.379 0-6.547 2.535-6.547 7.581-.021 5.176 2.168 7.732 6.547 7.732zm11.969 1.288V6.872h1.275l.319 3.072c1.786-1.997 3.784-2.985 5.994-2.985v1.439c-2.125 0-4.039 1.052-5.696 3.157v13.357h-1.892zm12.965-20.831h-1.253v16.064c0 3.243 1.445 4.875 4.358 4.875h2.635v-1.545h-2.677c-1.723 0-2.638-1.203-2.638-3.565V8.59h5.315V6.873h-5.42l-.32-2.792z");
  c.fill(textPath);
  c.stroke(textPath);

  // "point" portion — bolder strokes (these are already thicker paths)
  c.lineWidth = 0.6;
  const pointPath = new Path2D("M150.5 0h3.826v3.865H150.5V0zm-31.418 6.615c-2.529 0-5.015.257-7.397.752l-.298.064V32h3.891v-7.281c1.211.452 2.487.688 3.762.688 5.973 0 8.992-3.308 8.992-9.836 0-5.949-2.998-8.956-8.95-8.956zm-3.804 3.759c1.083-.215 2.359-.344 3.783-.344 3.466 0 5.144 1.804 5.144 5.499 0 4.273-1.7 6.356-5.165 6.356-1.361 0-2.636-.257-3.741-.795V10.374h-.021zm23.403-3.759c-5.888 0-8.864 3.157-8.864 9.385.021 6.207 2.997 9.364 8.864 9.364 5.889 0 8.865-3.157 8.865-9.364 0-6.228-2.998-9.385-8.865-9.385zm0 15.441c-3.337 0-4.974-1.997-4.974-6.12 0-4.017 1.637-5.992 4.974-5.992s4.974 1.953 4.974 5.992c0 4.123-1.636 6.12-4.974 6.12zm15.645-15.399H150.5v18.685h3.826V6.657zm12.945-.042c-2.082 0-4.017.687-5.781 2.019l-.489-1.976h-2.784v18.685h3.975V12.091c1.508-1.375 3.018-2.061 4.655-2.061 2.445 0 3.635 1.16 3.635 3.629v11.684h3.826V13.701c0-4.703-2.36-7.087-7.037-7.087zM186 6.657v3.221h-4.272v10.031c0 1.481.488 2.147 1.721 2.147H186v3.287h-3.359c-3.167 0-4.846-1.761-4.846-5.176V3.651h2.636l.679 3.007H186z");
  c.fill(pointPath);
  c.stroke(pointPath);

  return c.getImageData(0, 0, targetW, targetH);
}

// ─── Use pretext to measure characters ────────────────────────────────────────
function measureCharWidths(fontSize) {
  const font = `${fontSize}px ${FONT_FAMILY}`;
  const charWidths = new Map();

  for (const ch of CHAR_POOL) {
    const prepared = prepareWithSegments(ch, font);
    const result = layoutWithLines(prepared, 9999, fontSize);
    if (result.lines.length > 0) {
      charWidths.set(ch, result.lines[0].width);
    }
  }
  return charWidths;
}

// ─── Particle system ──────────────────────────────────────────────────────────
let particles = [];
let charWidths = new Map();
let fontSize = 14;

class Particle {
  constructor(targetX, targetY, char, color) {
    this.x = targetX;
    this.y = targetY;
    this.targetX = targetX;
    this.targetY = targetY;
    this.char = char;
    this.displayChar = char;
    this.colorStr = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    this.vx = 0;
    this.vy = 0;
  }

  update() {
    // Spring toward target
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    this.vx += dx * SETTLE_SPEED;
    this.vy += dy * SETTLE_SPEED;

    // Mouse repulsion (squared distance to avoid sqrt)
    const mdx = this.x - mouse.x;
    const mdy = this.y - mouse.y;
    const distSq = mdx * mdx + mdy * mdy;
    if (distSq < MOUSE_RADIUS_SQ && distSq > 0) {
      const dist = Math.sqrt(distSq);
      const f = (MOUSE_RADIUS - dist) / MOUSE_RADIUS * MOUSE_FORCE_SCALED / dist;
      this.vx += mdx * f;
      this.vy += mdy * f;
    }

    this.vx *= FRICTION;
    this.vy *= FRICTION;
    this.x += this.vx;
    this.y += this.vy;
  }

  draw(ctx) {
    ctx.fillStyle = this.colorStr;
    ctx.fillText(this.displayChar, this.x, this.y);
  }
}

// ─── Build particles from logo mask ───────────────────────────────────────────
function buildParticles() {
  const isMobile = W < 600;

  // Smaller font = denser grid = more readable logo
  fontSize = isMobile ? 8 : W < 1000 ? 9 : 11;
  charWidths = measureCharWidths(fontSize);

  const charW = charWidths.values().next().value || fontSize * 0.6;
  const charH = fontSize * 1.2;

  // On mobile: icon only (nearly square, looks great small)
  // On desktop: full horizontal wordmark
  const logoAspect = isMobile ? (24 / 32) : (186 / 32);
  const maxLogoW = W * (isMobile ? 0.5 : 0.75);
  const maxLogoH = H * (isMobile ? 0.45 : 0.5);
  let logoW = maxLogoW;
  let logoH = logoW / logoAspect;
  if (logoH > maxLogoH) {
    logoH = maxLogoH;
    logoW = logoH * logoAspect;
  }

  // Grid size for character placement
  const cols = Math.floor(logoW / charW);
  const rows = Math.floor(logoH / charH);

  // Rasterize at 4x resolution for accurate sampling of thin strokes
  const superSample = 4;
  const hiResW = cols * superSample;
  const hiResH = rows * superSample;
  const imageData = isMobile
    ? rasterizeIconOnly(hiResW, hiResH)
    : rasterizeFullLogo(hiResW, hiResH);
  const pixels = imageData.data;

  // Downsample: a grid cell is "filled" if enough sub-pixels are opaque
  function isCellFilled(col, row) {
    const x0 = col * superSample;
    const y0 = row * superSample;
    let filled = 0;
    for (let dy = 0; dy < superSample; dy++) {
      for (let dx = 0; dx < superSample; dx++) {
        const idx = ((y0 + dy) * hiResW + (x0 + dx)) * 4;
        if (pixels[idx + 3] > 64) filled++;
      }
    }
    return filled >= superSample * superSample * 0.25;
  }

  // Center offset
  const offsetX = (W - cols * charW) / 2;
  const offsetY = (H - rows * charH) / 2;

  particles = [];

  // Icon boundary (only relevant for full logo on desktop)
  const iconBoundaryCols = isMobile ? cols : Math.floor(cols * (26 / 186));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!isCellFilled(col, row)) continue;

      const x = offsetX + col * charW;
      const y = offsetY + row * charH;
      const char = CHAR_POOL[Math.floor(Math.random() * CHAR_POOL.length)];

      // On mobile everything is blue (icon only); on desktop icon=blue, text=gray
      const isIcon = col < iconBoundaryCols;
      const color = isIcon ? BRAND_BLUE : BRAND_DARK;

      particles.push(new Particle(x, y, char, color));
    }
  }
}

buildParticles();

// ─── Background floating characters ──────────────────────────────────────────
class BackgroundChar {
  constructor() {
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    this.char = CHAR_POOL[Math.floor(Math.random() * CHAR_POOL.length)];
    this.alpha = 0.02 + Math.random() * 0.06;
    this.vy = -0.1 - Math.random() * 0.3;
    this.vx = (Math.random() - 0.5) * 0.2;
    this.size = 10 + Math.random() * 8;
  }

  update() {
    this.y += this.vy;
    this.x += this.vx;
    if (this.y < -20) {
      this.y = H + 20;
      this.x = Math.random() * W;
    }
  }

  draw(ctx) {
    ctx.font = `${this.size}px ${FONT_FAMILY}`;
    ctx.fillStyle = `rgba(49, 97, 209, ${this.alpha})`;
    ctx.fillText(this.char, this.x, this.y);
  }
}

const bgChars = Array.from({ length: 80 }, () => new BackgroundChar());

// ─── Animation loop ──────────────────────────────────────────────────────────
function render() {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, W, H);

  // Background chars
  for (const bg of bgChars) {
    bg.update();
    bg.draw(ctx);
  }

  // Main particles
  ctx.font = `${fontSize}px ${FONT_FAMILY}`;
  ctx.textBaseline = "middle";

  for (const p of particles) {
    p.update();
    p.draw(ctx);
  }

  // Reset shadow
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  requestAnimationFrame(render);
}

render();
