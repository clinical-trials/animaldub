// Minimal self-contained animated GIF89a encoder (original, no deps).
// Histogram median-cut palette (per frame) + GIF-LZW compression + NETSCAPE loop.
// Exposes window.encodeGIF(frames, width, height, {fps, loop}) -> Blob('image/gif').
// `frames` = array of Uint8ClampedArray (RGBA, width*height*4).
(function () {
  function ByteBuf() { this.a = new Uint8Array(1024); this.n = 0; }
  ByteBuf.prototype.byte = function (b) {
    if (this.n >= this.a.length) { const t = new Uint8Array(this.a.length * 2); t.set(this.a); this.a = t; }
    this.a[this.n++] = b & 0xff;
  };
  ByteBuf.prototype.bytes = function (arr) { for (let i = 0; i < arr.length; i++) this.byte(arr[i]); };
  ByteBuf.prototype.str = function (s) { for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); };
  ByteBuf.prototype.word = function (w) { this.byte(w); this.byte(w >> 8); };
  ByteBuf.prototype.out = function () { return this.a.subarray(0, this.n); };

  // ---- palette: histogram median-cut ----
  function quantize(rgba, n, maxColors) {
    const hist = new Map();
    for (let i = 0; i < n; i++) {
      const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
      const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const e = hist.get(k);
      if (e) { e.c++; e.r += r; e.g += g; e.b += b; }
      else hist.set(k, { c: 1, r, g, b });
    }
    let boxes = [[...hist.values()]];
    while (boxes.length < maxColors) {
      let bi = -1, brange = -1, bch = 0;
      for (let k = 0; k < boxes.length; k++) {
        const box = boxes[k]; if (box.length < 2) continue;
        const mn = [255, 255, 255], mx = [0, 0, 0];
        for (const e of box) {
          const rr = e.r / e.c, gg = e.g / e.c, bb = e.b / e.c;
          if (rr < mn[0]) mn[0] = rr; if (rr > mx[0]) mx[0] = rr;
          if (gg < mn[1]) mn[1] = gg; if (gg > mx[1]) mx[1] = gg;
          if (bb < mn[2]) mn[2] = bb; if (bb > mx[2]) mx[2] = bb;
        }
        const rng = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
        for (let c = 0; c < 3; c++) if (rng[c] > brange) { brange = rng[c]; bi = k; bch = c; }
      }
      if (bi < 0) break;
      const box = boxes[bi];
      box.sort((a, b) => (bch === 0 ? a.r / a.c - b.r / b.c : bch === 1 ? a.g / a.c - b.g / b.c : a.b / a.c - b.b / b.c));
      const mid = box.length >> 1;
      boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
    }
    const palette = boxes.map(box => {
      let r = 0, g = 0, b = 0, c = 0;
      for (const e of box) { r += e.r; g += e.g; b += e.b; c += e.c; }
      c = Math.max(1, c); return [Math.round(r / c), Math.round(g / c), Math.round(b / c)];
    });
    // map every pixel to nearest palette entry (cache by 15-bit color)
    const idx = new Uint8Array(n), cache = new Map();
    for (let i = 0; i < n; i++) {
      const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
      const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      let m = cache.get(k);
      if (m === undefined) {
        let best = 0, bd = 1e9;
        for (let p = 0; p < palette.length; p++) {
          const dr = r - palette[p][0], dg = g - palette[p][1], db = b - palette[p][2];
          const d = dr * dr + dg * dg + db * db;
          if (d < bd) { bd = d; best = p; }
        }
        m = best; cache.set(k, m);
      }
      idx[i] = m;
    }
    return { idx, palette };
  }

  // ---- GIF-LZW ----
  function lzw(buf, idx, minCode) {
    const clear = 1 << minCode, eoi = clear + 1;
    let size = minCode + 1, next = clear + 2, dict = new Map();
    buf.byte(minCode);
    // sub-block accumulator
    let block = [], bitBuf = 0, bitCnt = 0;
    const flushByte = b => { block.push(b); if (block.length === 255) { buf.byte(255); buf.bytes(block); block = []; } };
    const emit = code => {
      bitBuf |= code << bitCnt; bitCnt += size;
      while (bitCnt >= 8) { flushByte(bitBuf & 0xff); bitBuf >>>= 8; bitCnt -= 8; }
    };
    emit(clear);
    let prev = idx[0];
    for (let i = 1; i < idx.length; i++) {
      const c = idx[i], key = prev * 256 + c, f = dict.get(key);
      if (f !== undefined) { prev = f; }
      else {
        emit(prev);
        dict.set(key, next); next++;
        if (next === (1 << size)) { if (size < 12) size++; }
        if (next === 4096) { emit(clear); dict = new Map(); next = clear + 2; size = minCode + 1; }
        prev = c;
      }
    }
    emit(prev); emit(eoi);
    if (bitCnt > 0) flushByte(bitBuf & 0xff);
    if (block.length) { buf.byte(block.length); buf.bytes(block); }
    buf.byte(0); // block terminator
  }

  function paletteBits(len) { let b = 1; while ((1 << b) < len) b++; return Math.max(2, b); }

  window.encodeGIF = function (frames, W, H, opts) {
    opts = opts || {};
    const fps = opts.fps || 12, loop = opts.loop == null ? 0 : opts.loop;
    const delay = Math.max(2, Math.round(100 / fps));
    const buf = new ByteBuf();
    buf.str('GIF89a');
    buf.word(W); buf.word(H);
    buf.byte(0x70); buf.byte(0); buf.byte(0); // no global color table
    // NETSCAPE loop
    buf.byte(0x21); buf.byte(0xff); buf.byte(11); buf.str('NETSCAPE2.0');
    buf.byte(3); buf.byte(1); buf.word(loop); buf.byte(0);
    const n = W * H;
    for (const rgba of frames) {
      const { idx, palette } = quantize(rgba, n, 256);
      const bits = paletteBits(palette.length), tableLen = 1 << bits;
      // Graphic Control Extension
      buf.byte(0x21); buf.byte(0xf9); buf.byte(4); buf.byte(0); buf.word(delay); buf.byte(0); buf.byte(0);
      // Image Descriptor
      buf.byte(0x2c); buf.word(0); buf.word(0); buf.word(W); buf.word(H);
      buf.byte(0x80 | (bits - 1)); // local color table, size
      for (let i = 0; i < tableLen; i++) {
        const p = palette[i] || [0, 0, 0];
        buf.byte(p[0]); buf.byte(p[1]); buf.byte(p[2]);
      }
      lzw(buf, idx, Math.max(2, bits));
    }
    buf.byte(0x3b);
    return new Blob([buf.out()], { type: 'image/gif' });
  };
})();
