# ShortPoint ASCII Art Logo

An interactive ASCII art animation of the [ShortPoint](https://www.shortpoint.com) logo, powered by [@chenglou/pretext](https://github.com/chenglou/pretext) for precise text measurement.

## How it works

The animation renders the ShortPoint logo as a field of ASCII characters on a canvas. Each character is a physics-driven particle that reacts to the mouse cursor. There are three main stages: **rasterization**, **character grid placement**, and **animation**.

### 1. Logo rasterization

The ShortPoint logo SVG paths are drawn onto a hidden offscreen canvas at high resolution. The logo has three path groups:

- **Icon mark** -- the interlocking geometric "S" shape
- **"short" text** -- thin serif-style strokes (thickened with `stroke()` at `lineWidth: 1.2` so they survive downsampling)
- **"point" text** -- bolder strokes rendered from the SVG `Path2D` data

The offscreen canvas is rasterized at **4x the final grid resolution** (supersampling) to ensure thin strokes aren't lost when mapped to the coarser character grid.

### 2. Character grid placement (where pretext comes in)

This is where `@chenglou/pretext` is used. For each character in the pool (`shortpoint{}[]<>/\|!@#$%^&*()_+-=~`01`), pretext's `prepareWithSegments()` and `layoutWithLines()` measure the **exact rendered width** of each glyph in the chosen monospace font -- without triggering any DOM reflows.

These measured widths determine the grid cell size. The pipeline:

```
measureCharWidths(fontSize)
  -> for each char in pool:
       prepareWithSegments(char, font)   // pretext: segment + measure via canvas
       layoutWithLines(prepared, ...)     // pretext: get precise width
  -> charW = measured width of one character
  -> charH = fontSize * 1.2
```

The supersampled logo bitmap is then downsampled to this grid. Each grid cell is checked: if >= 25% of its sub-pixels are opaque, a particle is placed there with a random character from the pool.

Color is determined by horizontal position -- columns within the icon mark region get ShortPoint blue (`#3161D1`), the rest get a lighter blue-gray.

### 3. Physics animation

Each particle has:
- A **target position** (its grid cell in the logo)
- A **current position** and **velocity**
- A **spring force** pulling it toward target (`SETTLE_SPEED = 0.15`)
- **Friction** damping velocity each frame (`FRICTION = 0.85`)

On mouse interaction, particles within 80px of the cursor get pushed away via a repulsion force. The force uses squared-distance early-out to avoid `Math.sqrt` on every particle, only computing it for particles actually in range.

Background floating characters drift upward for atmosphere.

### Architecture diagram

```
SVG Paths
       |
       v
[Offscreen Canvas] -- rasterizeFullLogo(hiResW, hiResH)
       |                fill + stroke Path2D at 4x resolution
       v
[Supersampled Bitmap] -- getImageData()
       |
       v
[Downsample to Grid] -- isCellFilled(col, row)
       |                 >= 25% sub-pixel threshold
       v
[Particle Array] -- one Particle per filled cell
       |             position = grid cell center
       |             char = random from pool
       |             color = blue (icon) or gray (text)
       v
[Animation Loop] -- requestAnimationFrame
       |
       +-- update(): spring + mouse repulsion + friction
       +-- draw(): ctx.fillText(char, x, y)
```

### Why pretext?

Traditional approaches to measuring text width use DOM methods like `getBoundingClientRect()` or `offsetWidth`, which trigger expensive **forced synchronous reflows**. For a grid with hundreds of characters, this would mean hundreds of reflows at setup time.

Pretext measures text using the browser's canvas font engine and caches the results. This means:
- Zero DOM reflows
- Sub-millisecond measurement for the entire character pool
- Accurate glyph widths that match actual rendering

This matters for the ASCII grid because **character width precision determines whether the logo looks right**. If widths are off by even a pixel, columns misalign and the logo becomes unreadable.

## Running locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Tech stack

- **[@chenglou/pretext](https://github.com/chenglou/pretext)** -- text measurement (15KB, zero deps)
- **Canvas 2D API** -- rendering + offscreen rasterization
- **Vite** -- dev server + bundling
