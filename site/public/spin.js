// A spinning 3D [x] drawn in ASCII, the way the classic spinning donut is.
// The [x] is a flat pixel shape pushed out into a solid. Points on its surface are turned,
// projected onto a character grid, and each cell shows the closest point's brightness as a character.
{
  const art = document.querySelector('.spin');
  if (art) {
    // The shape, one cell per '#'. Brackets on the outside, the x in the middle.
    const SHAPE = [
      '#####.............#####',
      '##.....##.....##.....##',
      '##......##...##......##',
      '##.......##.##.......##',
      '##........###........##',
      '##.......##.##.......##',
      '##......##...##......##',
      '##.....##.....##.....##',
      '#####.............#####',
    ];
    const isX = (c) => c >= 5 && c <= 17; // columns of the x (coloured green)
    const W = 64, H = 26;           // character grid
    const DEPTH = 3;                // how thick the solid is
    const STEP = 0.25;              // how finely the surface is sampled
    const RAMP = '.,-~:;=!*#$@';    // dark to bright
    const ASPECT = 0.6;             // a character is 0.6 as wide as it is tall (at line-height 1)

    const rows = SHAPE.length, cols = SHAPE[0].length;
    const filled = (r, c) => SHAPE[r]?.[c] === '#';
    // Surface points: x, y, z, the way the surface faces (nx, ny, nz), and whether it's part of the x.
    const pts = [];
    const add = (x, y, z, nx, ny, nz, part) => pts.push([x - cols / 2, y - rows / 2, z - DEPTH / 2, nx, ny, nz, part]);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!filled(r, c)) continue;
        const part = isX(c) ? 1 : 0;
        for (let a = 0; a < 1; a += STEP) {
          for (let b = 0; b < 1; b += STEP) {
            add(c + a, r + b, 0, 0, 0, -1, part);    // front
            add(c + a, r + b, DEPTH, 0, 0, 1, part); // back
          }
          // Side walls wherever the next cell is empty.
          for (let d = 0; d < DEPTH; d += STEP) {
            if (!filled(r, c - 1)) add(c, r + a, d, -1, 0, 0, part);
            if (!filled(r, c + 1)) add(c + 1, r + a, d, 1, 0, 0, part);
            if (!filled(r - 1, c)) add(c + a, r, d, 0, -1, 0, part);
            if (!filled(r + 1, c)) add(c + a, r + 1, d, 0, 1, 0, part);
          }
        }
      }
    }

    // Two layers of text: the brackets, and the x on top in green. Same grid, so they line up.
    const [frame, cross] = art.querySelectorAll('span');
    const zbuf = new Float32Array(W * H);
    const lum = new Int8Array(W * H);
    const who = new Int8Array(W * H);
    const K2 = 34;                       // how far away the shape sits
    const K1 = (W * K2 * 0.75) / cols;   // scale so it fills about three quarters of the width
    const L = [0, -0.7071, -0.7071];     // light from above and in front

    function draw(A, B) {
      const cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B);
      zbuf.fill(0);
      for (const [x, y, z, nx, ny, nz, part] of pts) {
        // Turn around the vertical axis by A, then tip by B.
        const x1 = x * cA + z * sA, z1 = -x * sA + z * cA;
        const y2 = y * cB - z1 * sB, z2 = y * sB + z1 * cB;
        const ooz = 1 / (z2 + K2); // one over depth: bigger is closer
        const sx = Math.round(W / 2 + K1 * ooz * x1);
        const sy = Math.round(H / 2 + K1 * ooz * y2 * ASPECT);
        if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue;
        const i = sy * W + sx;
        if (ooz <= zbuf[i]) continue;
        zbuf[i] = ooz;
        const n1x = nx * cA + nz * sA, n1z = -nx * sA + nz * cA;
        const n2y = ny * cB - n1z * sB, n2z = ny * sB + n1z * cB;
        const light = n1x * L[0] + n2y * L[1] + n2z * L[2];
        lum[i] = Math.max(0, Math.min(RAMP.length - 1, Math.round((light * 0.5 + 0.5) * (RAMP.length - 1))));
        who[i] = part;
      }
      let a = '', b = '';
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const ch = zbuf[i] ? RAMP[lum[i]] : ' ';
          a += zbuf[i] && !who[i] ? ch : ' ';
          b += zbuf[i] && who[i] ? ch : ' ';
        }
        a += '\n';
        b += '\n';
      }
      frame.textContent = a;
      cross.textContent = b;
    }

    // Spin at about 30 frames a second, only while it's on screen. Still, at an angle, with reduced motion.
    const calm = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true, last = 0, A = 0.6, raf = 0;
    const B = 0.35;
    const tick = (t) => {
      raf = 0;
      if (t - last >= 33) {
        A += Math.min(t - last, 100) * 0.0012;
        last = t;
        draw(A, B + Math.sin(A * 0.5) * 0.2);
      }
      start();
    };
    const start = () => { if (!raf && visible && !calm.matches) raf = requestAnimationFrame(tick); };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = performance.now(); start(); }).observe(art);
    calm.addEventListener('change', () => { draw(A, B); start(); });
    draw(A, B);
    start();
  }
}
