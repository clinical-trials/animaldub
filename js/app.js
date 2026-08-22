// Animal Dub — front-end. Everything runs in the browser; no uploads.
// Two ways to make a clip:
//   • Pet video  -> draw the video on a <canvas>, mix a pre-baked voice clip in
//     Web Audio, record with MediaRecorder -> downloadable file.
//   • Critter    -> draw an animated cartoon animal whose jaw tracks the voice's
//     volume (AnalyserNode), same record pipeline -> downloadable file.
// The hero "talking dog" types-anything demo uses the free browser speech voice
// (lots of options); saveable custom voices arrive with the real voice engine.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = {
  manifest: null,
  mode: null,          // 'video' | 'critter'
  srcUrl: null,
  srcDuration: 0,
  critterType: null,
  voiceKey: null,
  lineIndex: null,
  customText: '',
  sticker: { emoji: null, nx: 0.5, ny: 0.32, size: 0.20 },
  voiceStart: 0,
  duck: true,
};

const CHARACTERS = [
  { key: 'normal',   label: '😀 Normal',   rate: 0.96, pitch: 1.0 },
  { key: 'chipmunk', label: '🐿️ Chipmunk', rate: 1.3,  pitch: 1.9 },
  { key: 'monster',  label: '👹 Monster',  rate: 0.8,  pitch: 0.25 },
  { key: 'robot',    label: '🤖 Robot',    rate: 0.9,  pitch: 0.5 },
  { key: 'baby',     label: '🐣 Baby',     rate: 1.05, pitch: 2.0 },
  { key: 'fancy',    label: '🎩 Fancy',    rate: 0.82, pitch: 1.15 },
];
let charKey = 'normal';

const CRITTERS = [
  { key: 'dog',  emoji: '🐶', name: 'Puppy', head: '#E8A94B', head2: '#EEB85E', ear: '#C6863B', earType: 'floppy', muzzle: '#F6DBA6', nose: '#2b1a0e' },
  { key: 'cat',  emoji: '🐱', name: 'Kitty', head: '#F0A24B', head2: '#F6B65E', ear: '#E0883B', earType: 'point',  muzzle: '#FBE6C8', nose: '#E5738A', whiskers: true },
  { key: 'lion', emoji: '🦁', name: 'Lion',  head: '#E7A94B', head2: '#F0BC63', ear: '#C6863B', earType: 'round',  muzzle: '#F6DBA6', nose: '#3a2410', mane: '#B5701F' },
  { key: 'frog', emoji: '🐸', name: 'Frog',  head: '#6CC24A', head2: '#7FD65C', ear: null,      earType: 'frogeyes', muzzle: '#8ED96F', nose: null },
  { key: 'bear', emoji: '🐻', name: 'Bear',  head: '#9B7A54', head2: '#AD8A63', ear: '#7E6242', earType: 'round',  muzzle: '#D9C3A5', nose: '#2b1a0e' },
  { key: 'panda',emoji: '🐼', name: 'Panda', head: '#f4f4f4', head2: '#ffffff', ear: '#222',    earType: 'round',  muzzle: '#ffffff', nose: '#222', patches: true },
];

const STICKERS = ['😎', '🕶️', '👑', '🔥', '❤️', '🌭', '💅', '🎩'];

const els = {};
init();

async function init() {
  ['tagline','previewWrap','sourceVideo','critterCanvas','liveVideo','stickerHandle','btnRecord','btnStop',
   'fileInput','btnSample','btnCritter','critterPicker','critterChips','captureStatus','voiceGrid','lineChips',
   'customText','btnPreviewVoice','stickerRow','startSlider','startVal','duckToggle','btnMake','makeStatus',
   'result','resultVideo','downloadLink','btnShare','formatNote','dogSvg','dogBubble','heroText','btnTalk',
   'charChips','voiceSelect']
    .forEach(id => els[id] = document.getElementById(id) || $('#' + id));
  els.canvas = $('#stitchCanvas');

  try { state.manifest = await (await fetch('assets/manifest.json?b=' + Date.now())).json(); }
  catch (e) { return setStatus(els.captureStatus, 'Could not load voices.', 'err'); }
  if (state.manifest.tagline) els.tagline.textContent = state.manifest.tagline;

  buildHero();
  buildVoices();
  buildLines();
  buildStickers();
  buildCritters();
  wireGallery();
  wireCapture();
  wireControls();
}

/* ---------------- Gallery: tap a pet to make it talk ---------------- */
let galleryAudio = null, galleryFlap = 0;
function wireGallery() {
  document.querySelectorAll('#gallery .talkable').forEach(card =>
    card.addEventListener('click', () => galleryTalk(card)));
}
function galleryTalk(card) {
  document.querySelectorAll('#gallery .talkable').forEach(c => c.classList.remove('talking'));
  clearInterval(galleryFlap);
  if (galleryAudio) { galleryAudio.pause(); galleryAudio = null; }
  const jaw = card.querySelector('.jaw');
  const emoji = card.querySelector('.pet');
  card.classList.add('talking');
  const t0 = performance.now();
  galleryFlap = setInterval(() => {
    const p = performance.now() - t0;
    if (jaw) jaw.style.transform = `scaleY(${(1 + 0.16 * Math.abs(Math.sin(p / 95))).toFixed(3)})`;
    if (emoji) emoji.style.transform = `scale(${(1 + 0.08 * Math.abs(Math.sin(p / 110))).toFixed(3)}) rotate(${(5 * Math.sin(p / 120)).toFixed(1)}deg)`;
  }, 40);
  const stop = () => {
    clearInterval(galleryFlap); card.classList.remove('talking');
    if (jaw) jaw.style.transform = 'scaleY(1)';
    if (emoji) emoji.style.transform = '';
  };
  galleryAudio = new Audio(`${state.manifest.audioDir}/${card.dataset.voice}_${card.dataset.line}.mp3`);
  galleryAudio.onended = stop; galleryAudio.onerror = () => { setTimeout(stop, 1400); };
  galleryAudio.play().catch(() => setTimeout(stop, 1600));
}

/* ---------------- HERO: talking dog ---------------- */
function buildHero() {
  // character chips
  els.charChips.innerHTML = '';
  CHARACTERS.forEach(c => {
    const b = document.createElement('button');
    b.className = 'chip' + (c.key === charKey ? ' sel' : '');
    b.textContent = c.label;
    b.addEventListener('click', () => {
      charKey = c.key;
      $$('.chip', els.charChips).forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
    });
    els.charChips.appendChild(b);
  });
  // voices
  populateVoices();
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = populateVoices;
  els.btnTalk.addEventListener('click', () => talk(els.heroText.value.trim() || 'Woof.'));
  els.heroText.addEventListener('keydown', e => { if (e.key === 'Enter') talk(els.heroText.value.trim() || 'Woof.'); });
}
function populateVoices() {
  if (!('speechSynthesis' in window)) { els.voiceSelect.innerHTML = '<option>No voices on this browser</option>'; return; }
  const voices = speechSynthesis.getVoices();
  if (!voices.length) { els.voiceSelect.innerHTML = '<option value="">Default device voice</option>'; return; }
  const cur = els.voiceSelect.value;
  const sorted = voices.slice().sort((a, b) =>
    (a.lang.startsWith('en') ? 0 : 1) - (b.lang.startsWith('en') ? 0 : 1) || a.name.localeCompare(b.name));
  els.voiceSelect.innerHTML = '';
  sorted.forEach(v => {
    const o = document.createElement('option');
    o.value = v.name; o.textContent = `${v.name} (${v.lang})`;
    els.voiceSelect.appendChild(o);
  });
  if (cur) els.voiceSelect.value = cur;
}
function talk(text) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  const ch = CHARACTERS.find(c => c.key === charKey);
  u.rate = ch.rate; u.pitch = ch.pitch;
  const v = speechSynthesis.getVoices().find(x => x.name === els.voiceSelect.value);
  if (v) u.voice = v;
  els.dogBubble.textContent = text; els.dogBubble.hidden = false;
  els.dogSvg.classList.add('talking');           // head nod
  startFlap();                                    // JS-driven jaw — always moves
  let stopped = false;
  const stop = () => { if (stopped) return; stopped = true; clearTimeout(safety);
    els.dogSvg.classList.remove('talking'); stopFlap(); setTimeout(() => (els.dogBubble.hidden = true), 900); };
  u.onend = stop; u.onerror = stop;
  // safety: keep the jaw moving ~length of the line even if speech events don't fire
  const safety = setTimeout(stop, Math.min(12000, 900 + text.length * 90));
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
let flapTimer = 0;
function startFlap() {
  const jaw = document.querySelector('#dogSvg .jaw');
  if (!jaw) return;
  clearInterval(flapTimer);
  const t0 = performance.now();
  flapTimer = setInterval(() => {
    const s = 0.42 + 0.58 * Math.abs(Math.sin((performance.now() - t0) / 90));
    jaw.style.transform = `scaleY(${s.toFixed(3)})`;
  }, 40);
}
function stopFlap() {
  clearInterval(flapTimer);
  const jaw = document.querySelector('#dogSvg .jaw');
  if (jaw) jaw.style.transform = 'scaleY(0.6)';
}

/* ---------------- Voices / lines / stickers ---------------- */
function buildVoices() {
  els.voiceGrid.innerHTML = '';
  state.manifest.voices.forEach(v => {
    const b = document.createElement('button');
    b.className = 'voice'; b.dataset.key = v.key;
    b.innerHTML = `<div class="emoji">${v.emoji}</div><div class="vname">${v.name}</div><div class="vblurb">${v.blurb}</div>`;
    b.addEventListener('click', () => selectVoice(v.key));
    els.voiceGrid.appendChild(b);
  });
}
function buildLines() {
  els.lineChips.innerHTML = '';
  state.manifest.lines.forEach((line, i) => {
    const c = document.createElement('button');
    c.className = 'chip'; c.textContent = line; c.dataset.i = i;
    c.addEventListener('click', () => selectLine(i));
    els.lineChips.appendChild(c);
  });
  els.customText.addEventListener('input', () => {
    state.customText = els.customText.value.trim();
    if (state.customText) { state.lineIndex = null; $$('.chip', els.lineChips).forEach(c => c.classList.remove('sel')); }
    refreshMakeButton();
  });
}
function buildStickers() {
  els.stickerRow.innerHTML = '';
  ['🚫', ...STICKERS].forEach(em => {
    const c = document.createElement('button');
    c.className = 'chip'; c.textContent = em;
    c.addEventListener('click', () => selectSticker(em === '🚫' ? null : em, c));
    els.stickerRow.appendChild(c);
  });
}
function buildCritters() {
  els.critterChips.innerHTML = '';
  CRITTERS.forEach(c => {
    const b = document.createElement('button');
    b.className = 'chip'; b.dataset.key = c.key;
    b.textContent = `${c.emoji} ${c.name}`;
    b.addEventListener('click', () => selectCritter(c.key, b));
    els.critterChips.appendChild(b);
  });
}
function selectVoice(key) {
  state.voiceKey = key;
  $$('.voice', els.voiceGrid).forEach(v => v.classList.toggle('sel', v.dataset.key === key));
  els.btnPreviewVoice.disabled = false;
  refreshMakeButton();
}
function selectLine(i) {
  state.lineIndex = i; state.customText = ''; els.customText.value = '';
  $$('.chip', els.lineChips).forEach(c => c.classList.toggle('sel', +c.dataset.i === i));
  refreshMakeButton();
}
function selectSticker(emoji, chipEl) {
  state.sticker.emoji = emoji;
  $$('.chip', els.stickerRow).forEach(c => c.classList.remove('sel'));
  if (chipEl && emoji) chipEl.classList.add('sel');
  els.stickerHandle.hidden = !emoji;
  if (emoji) { els.stickerHandle.textContent = emoji; positionHandleFromState(); }
}

/* ---------------- Capture ---------------- */
let mediaStream = null, recorder = null, recChunks = [], recTimer = null;
function wireCapture() {
  els.btnRecord.addEventListener('click', startRecording);
  els.btnStop.addEventListener('click', stopRecording);
  els.fileInput.addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) setSourceVideo(URL.createObjectURL(f), `Loaded “${f.name}”.`);
  });
  els.btnSample.addEventListener('click', () =>
    setSourceVideo('assets/sample/sample-pet.mp4', 'Sample loaded — pick a voice & line, then Make my dub.'));
  els.btnCritter.addEventListener('click', () => {
    els.critterPicker.hidden = !els.critterPicker.hidden;
  });
}
async function startRecording() {
  try { mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true }); }
  catch (e) { return setStatus(els.captureStatus, 'No camera — use 📁 Upload, ✨ Sample, or 🧸 Make one.', 'err'); }
  els.liveVideo.hidden = false; els.liveVideo.srcObject = mediaStream;
  await els.liveVideo.play().catch(() => {});
  recChunks = [];
  const mime = pickRecordMime();
  recorder = new MediaRecorder(mediaStream, mime ? { mimeType: mime } : undefined);
  recorder.ondataavailable = e => e.data.size && recChunks.push(e.data);
  recorder.onstop = () => {
    setSourceVideo(URL.createObjectURL(new Blob(recChunks, { type: recorder.mimeType || 'video/webm' })), 'Recorded! Now give them a voice.');
    mediaStream.getTracks().forEach(t => t.stop());
    els.liveVideo.srcObject = null; els.liveVideo.hidden = true;
  };
  recorder.start();
  els.btnRecord.hidden = true; els.btnStop.hidden = false;
  setStatus(els.captureStatus, 'Recording… tap Stop when your pet delivers.', 'work');
  recTimer = setTimeout(stopRecording, 15000);
}
function stopRecording() {
  clearTimeout(recTimer);
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  els.btnRecord.hidden = false; els.btnStop.hidden = true;
}
function setSourceVideo(url, msg) {
  state.mode = 'video'; state.critterType = null;
  if (state.srcUrl && state.srcUrl.startsWith('blob:')) URL.revokeObjectURL(state.srcUrl);
  state.srcUrl = url;
  els.previewWrap.hidden = false;
  els.critterCanvas.hidden = true; els.sourceVideo.hidden = false;
  els.sourceVideo.src = url;
  els.sourceVideo.onloadedmetadata = () => {
    state.srcDuration = els.sourceVideo.duration || 5;
    els.startSlider.max = Math.max(0.5, Math.min(state.srcDuration, 15)).toFixed(1);
    unlockSteps(); refreshMakeButton();
  };
  if (msg) setStatus(els.captureStatus, msg, 'ok');
}
function selectCritter(key, chipEl) {
  state.mode = 'critter'; state.critterType = key; state.srcUrl = null;
  $$('.chip', els.critterChips).forEach(c => c.classList.remove('sel'));
  if (chipEl) chipEl.classList.add('sel');
  els.previewWrap.hidden = false;
  els.sourceVideo.hidden = true; els.critterCanvas.hidden = false;
  els.critterCanvas.width = 540; els.critterCanvas.height = 720;
  drawCritter(els.critterCanvas.getContext('2d'), 540, 720, CRITTERS.find(c => c.key === key), 0.14);
  els.startSlider.max = '3';
  unlockSteps(); refreshMakeButton();
  setStatus(els.captureStatus, `${CRITTERS.find(c => c.key === key).name} ready — pick a voice & line, then Make my dub!`, 'ok');
}
function unlockSteps() {
  ['#step-voice', '#step-line', '#step-style', '#step-make'].forEach(s => $(s).classList.remove('locked'));
}

/* ---------------- Controls ---------------- */
function wireControls() {
  els.startSlider.addEventListener('input', () => {
    state.voiceStart = +els.startSlider.value; els.startVal.textContent = state.voiceStart.toFixed(1);
  });
  els.duckToggle.addEventListener('change', () => (state.duck = els.duckToggle.checked));
  els.btnPreviewVoice.addEventListener('click', previewVoice);
  els.btnMake.addEventListener('click', makeDub);
  wireStickerDrag();
}
function refreshMakeButton() {
  const haveSource = (state.mode === 'video' && state.srcUrl) || (state.mode === 'critter' && state.critterType);
  const haveLine = state.lineIndex !== null || state.customText;
  els.btnMake.disabled = !(haveSource && state.voiceKey && haveLine);
  els.btnMake.textContent = (state.customText && state.lineIndex === null) ? '▶️ Preview (browser voice)' : '🎬 Make my dub';
}
async function previewVoice() {
  if (!state.voiceKey) return;
  if (state.lineIndex !== null) new Audio(voiceUrl()).play().catch(() => {});
  else if (state.customText) talk(state.customText);
  else new Audio(`${state.manifest.audioDir}/${state.voiceKey}_0.mp3`).play().catch(() => {});
}
function voiceUrl() { return `${state.manifest.audioDir}/${state.voiceKey}_${state.lineIndex}.mp3`; }

/* ---------------- Sticker drag ---------------- */
function positionHandleFromState() {
  els.stickerHandle.style.left = state.sticker.nx * 100 + '%';
  els.stickerHandle.style.top = state.sticker.ny * 100 + '%';
}
function wireStickerDrag() {
  let dragging = false;
  const move = (x, y) => {
    const r = els.previewWrap.getBoundingClientRect();
    state.sticker.nx = clamp((x - r.left) / r.width, 0.05, 0.95);
    state.sticker.ny = clamp((y - r.top) / r.height, 0.05, 0.95);
    positionHandleFromState();
  };
  const start = e => { dragging = true; e.preventDefault(); };
  const onMove = e => { if (!dragging) return; const p = e.touches ? e.touches[0] : e; move(p.clientX, p.clientY); };
  const end = () => (dragging = false);
  els.stickerHandle.addEventListener('mousedown', start);
  els.stickerHandle.addEventListener('touchstart', start, { passive: false });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', end); window.addEventListener('touchend', end);
}

/* ---------------- MAKE ---------------- */
async function makeDub() {
  if (state.customText && state.lineIndex === null) return previewCustom();
  setStatus(els.makeStatus, 'Rendering… it plays through once while we record. Hang tight.', 'work');
  els.btnMake.disabled = true; els.result.hidden = true;
  try {
    const blob = state.mode === 'critter' ? await renderCritterClip() : await renderVideoClip();
    const ext = (blob.type || '').includes('mp4') ? 'mp4' : 'webm';
    const url = URL.createObjectURL(blob);
    els.resultVideo.src = url;
    els.downloadLink.href = url; els.downloadLink.download = `animal-dub.${ext}`;
    els.result.hidden = false; setupShare(blob, ext);
    els.formatNote.textContent = ext === 'webm'
      ? 'Saved as .webm here. On an iPhone it saves as .mp4, ready for the camera roll.'
      : 'Saved as .mp4 — drop it straight into your camera roll or socials.';
    setStatus(els.makeStatus, 'Done! 🎉 Save it below.', 'ok');
    els.result.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {
    console.error(e);
    setStatus(els.makeStatus, 'Rendering hit a snag on this browser: ' + e.message, 'err');
  } finally { els.btnMake.disabled = false; }
}

function renderVideoClip() {
  return new Promise(async (resolve, reject) => {
    try {
      const video = document.createElement('video');
      video.src = state.srcUrl; video.playsInline = true; video.muted = false;
      await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = () => rej(new Error('video load failed')); });
      const W = Math.min(video.videoWidth || 480, 720);
      const H = Math.round((video.videoHeight || 854) * (W / (video.videoWidth || W)));
      const cv = els.canvas; cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const mix = ac.createMediaStreamDestination();
      let srcNode = null; try { srcNode = ac.createMediaElementSource(video); } catch (_) {}
      if (srcNode) { const g = ac.createGain(); g.gain.value = state.duck ? 0.18 : 0.0; srcNode.connect(g); g.connect(mix); g.connect(ac.destination); }
      const buf = await ac.decodeAudioData(await (await fetch(voiceUrl())).arrayBuffer());
      const vs = ac.createBufferSource(); vs.buffer = buf; vs.connect(mix); vs.connect(ac.destination);
      const out = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...mix.stream.getAudioTracks()]);
      const mime = pickRecordMime();
      const rec = new MediaRecorder(out, mime ? { mimeType: mime } : undefined);
      const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      let raf = 0;
      const draw = () => { ctx.drawImage(video, 0, 0, W, H); drawStickerOn(ctx, W, H); raf = requestAnimationFrame(draw); };
      const finish = () => { cancelAnimationFrame(raf); try { vs.stop(); } catch (_) {} video.pause(); if (rec.state !== 'inactive') rec.stop(); };
      rec.onstop = () => { ac.close(); resolve(new Blob(chunks, { type: rec.mimeType || mime || 'video/webm' })); };
      video.onended = finish;
      const cap = setTimeout(finish, Math.min(video.duration || 8, 15) * 1000 + 400);
      rec.addEventListener('stop', () => clearTimeout(cap), { once: true });
      video.currentTime = 0; await video.play();
      if (ac.state === 'suspended') await ac.resume();
      rec.start(); draw(); vs.start(ac.currentTime + state.voiceStart);
    } catch (e) { reject(e); }
  });
}

async function renderCritterClip() {
  const c = CRITTERS.find(x => x.key === state.critterType);
  const W = 540, H = 720; const cv = els.canvas; cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const mix = ac.createMediaStreamDestination();
  const buf = await ac.decodeAudioData(await (await fetch(voiceUrl())).arrayBuffer());
  const vs = ac.createBufferSource(); vs.buffer = buf;
  const analyser = ac.createAnalyser(); analyser.fftSize = 256;
  const data = new Uint8Array(analyser.frequencyBinCount);
  vs.connect(analyser); analyser.connect(mix); vs.connect(ac.destination);
  const out = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...mix.stream.getAudioTracks()]);
  const mime = pickRecordMime();
  const rec = new MediaRecorder(out, mime ? { mimeType: mime } : undefined);
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(r => (rec.onstop = r));
  let raf = 0, open = 0.12;
  const draw = () => {
    analyser.getByteFrequencyData(data);
    let sum = 0; for (let i = 0; i < 16; i++) sum += data[i];
    const amp = Math.min(1, (sum / 16) / 130);
    open = open * 0.45 + amp * 0.55;
    drawCritter(ctx, W, H, c, Math.max(0.06, open));
    drawStickerOn(ctx, W, H);
    raf = requestAnimationFrame(draw);
  };
  rec.start(); draw();
  if (ac.state === 'suspended') await ac.resume();
  vs.start(ac.currentTime + state.voiceStart);
  await new Promise(r => setTimeout(r, (state.voiceStart + buf.duration + 0.5) * 1000));
  cancelAnimationFrame(raf); try { vs.stop(); } catch (_) {} if (rec.state !== 'inactive') rec.stop();
  await done; ac.close();
  return new Blob(chunks, { type: rec.mimeType || mime || 'video/webm' });
}

function previewCustom() {
  setStatus(els.makeStatus, 'Live browser-voice preview (custom lines aren’t saveable yet).', 'work');
  if (state.mode === 'critter') {
    const c = CRITTERS.find(x => x.key === state.critterType);
    const ctx = els.critterCanvas.getContext('2d');
    let t = 0, iv = setInterval(() => { t += 0.1; drawCritter(ctx, 540, 720, c, 0.5 + 0.45 * Math.sin(t * 14)); }, 60);
    const u = new SpeechSynthesisUtterance(state.customText); u.rate = 0.98;
    u.onend = u.onerror = () => { clearInterval(iv); drawCritter(ctx, 540, 720, c, 0.14);
      setStatus(els.makeStatus, 'That was a preview. Pick a ready-made line to save a file today.', 'ok'); };
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } else {
    const v = els.sourceVideo; v.currentTime = 0; v.muted = false; v.play();
    setTimeout(() => talk(state.customText), state.voiceStart * 1000);
    setStatus(els.makeStatus, 'That was a preview. Pick a ready-made line to save a file today.', 'ok');
  }
}

/* ---------------- Critter drawing ---------------- */
function ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
function drawCritter(ctx, W, H, c, open) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2c264a'); g.addColorStop(1, '#14121f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H * 0.48, R = Math.min(W, H) * 0.3;
  if (c.mane) { ctx.fillStyle = c.mane; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; ell(ctx, cx + Math.cos(a) * R * 1.06, cy + Math.sin(a) * R * 1.06, R * 0.34, R * 0.34); } }
  // ears
  ctx.fillStyle = c.ear || c.head;
  if (c.earType === 'floppy') { ell(ctx, cx - R * 0.92, cy + R * 0.12, R * 0.3, R * 0.6); ell(ctx, cx + R * 0.92, cy + R * 0.12, R * 0.3, R * 0.6); }
  else if (c.earType === 'point') { [-1, 1].forEach(s => { ctx.beginPath(); ctx.moveTo(cx + s * R * 0.5, cy - R * 0.72); ctx.lineTo(cx + s * R * 0.95, cy - R * 1.4); ctx.lineTo(cx + s * R * 0.98, cy - R * 0.5); ctx.closePath(); ctx.fill(); }); }
  else if (c.earType === 'round') { ell(ctx, cx - R * 0.82, cy - R * 0.82, R * 0.32, R * 0.32); ell(ctx, cx + R * 0.82, cy - R * 0.82, R * 0.32, R * 0.32); }
  // head
  ctx.fillStyle = c.head; ell(ctx, cx, cy, R * 1.05, R);
  ctx.fillStyle = c.head2; ell(ctx, cx, cy - R * 0.28, R * 0.86, R * 0.6);
  if (c.patches) { ctx.fillStyle = '#222'; ell(ctx, cx - R * 0.42, cy - R * 0.12, R * 0.26, R * 0.3); ell(ctx, cx + R * 0.42, cy - R * 0.12, R * 0.26, R * 0.3); }
  // eyes
  if (c.earType === 'frogeyes') {
    [-1, 1].forEach(s => { ctx.fillStyle = c.head; ell(ctx, cx + s * R * 0.55, cy - R * 0.85, R * 0.34, R * 0.34); ctx.fillStyle = '#fff'; ell(ctx, cx + s * R * 0.55, cy - R * 0.85, R * 0.22, R * 0.22); ctx.fillStyle = '#111'; ell(ctx, cx + s * R * 0.55, cy - R * 0.8, R * 0.1, R * 0.12); });
  } else {
    [-1, 1].forEach(s => { const ex = cx + s * R * 0.42, ey = cy - R * 0.12; ctx.fillStyle = c.patches ? '#fff' : '#2a1c10'; if (c.patches) ell(ctx, ex, ey, R * 0.14, R * 0.16); ctx.fillStyle = '#2a1c10'; ell(ctx, ex, ey, R * 0.1, R * 0.13); ctx.fillStyle = '#fff'; ell(ctx, ex - R * 0.03, ey - R * 0.04, R * 0.035, R * 0.035); });
  }
  // muzzle
  if (c.muzzle) { ctx.fillStyle = c.muzzle; ell(ctx, cx, cy + R * 0.36, R * 0.62, R * 0.5); }
  // mouth
  const mo = open * R * 0.85;
  ctx.fillStyle = '#5b1f28'; ctx.beginPath(); ctx.ellipse(cx, cy + R * 0.5, R * 0.46, mo * 0.6 + R * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#F58AA6'; ctx.beginPath(); ctx.ellipse(cx, cy + R * 0.5 + mo * 0.3, R * 0.28, mo * 0.35 + R * 0.03, 0, 0, Math.PI * 2); ctx.fill();
  // nose
  if (c.nose) { ctx.fillStyle = c.nose; ell(ctx, cx, cy + R * 0.14, R * 0.14, R * 0.1); }
  // whiskers
  if (c.whiskers) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; [-1, 1].forEach(s => { for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(cx + s * R * 0.22, cy + R * 0.28 + k * 7); ctx.lineTo(cx + s * R * 0.95, cy + R * 0.2 + k * 14); ctx.stroke(); } }); }
}
function drawStickerOn(ctx, W, H) {
  if (!state.sticker.emoji) return;
  ctx.font = `${state.sticker.size * H}px "Apple Color Emoji","Segoe UI Emoji",serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(state.sticker.emoji, state.sticker.nx * W, state.sticker.ny * H);
}

/* ---------------- share / util ---------------- */
function setupShare(blob, ext) {
  els.btnShare.hidden = true;
  const file = new File([blob], `animal-dub.${ext}`, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    els.btnShare.hidden = false;
    els.btnShare.onclick = () => navigator.share({ files: [file], title: 'Animal Dub', text: 'My pet has thoughts.' }).catch(() => {});
  }
}
function pickRecordMime() {
  const c = ['video/mp4;codecs=h264,aac', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (const m of c) if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m;
  return '';
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function setStatus(el, msg, kind) { if (el) { el.textContent = msg; el.className = 'status' + (kind ? ' ' + kind : ''); } }
