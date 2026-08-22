# 🐾 Animal Dub

**Give your pet the voice they clearly already have.**

Point your phone at your pet, catch the bark or meow, pick a funny line and a
voice, and Animal Dub stitches a dubbed video **right on your phone** that you
can save and post. No pet at home? Make a talking critter instead.

> Working title / placeholder branding: **Animal Dub**.

## What works today (static demo, runs 100% in the browser)

- **Talking dog hero** — type anything into the text box and a cartoon golden
  retriever says it out loud, jaw flapping, via the free browser speech engine.
  Loads of voices + character presets (Chipmunk, Monster, Robot, Baby, Fancy…).
- **Dub your own pet** — record / upload a clip, pick a voice + line, optional
  emoji sticker (draggable), choose when the voice starts, and **save an `.mp4`**.
- **No pet? Make one** — six original open-mouth cartoon pets (Puppy, Kitty,
  Lion, Frog, Bear, Panda) whose **jaws lip-sync to the voice's volume**, also
  saveable as a video clip. Great for kids without a pet at home.
- **Pre-baked character voices** — 7 personalities (Snooty Aristocat, Doomsday
  Doggo, Cosmic Cat, Grumpy Ol' Ralph, Conspiracy Cat, Boing, Robo-Overlord)
  generated for free with the macOS `say` engine.
- **Private by design** — your video never leaves the device; the site stores
  nothing.

## How the clip is made

Everything is stitched in-browser: the pet video (or animated critter) is drawn
onto a `<canvas>`, the chosen voice clip is mixed in with the Web Audio API
(original pet sound optionally ducked underneath), and the combined stream is
recorded with `MediaRecorder` → a downloadable file. On iOS Safari that's an
`.mp4` ready for the camera roll.

## Run it locally

```bash
python3 -m http.server 5177 --directory .
# open http://localhost:5177
```

## Regenerate the voice clips

```bash
./scripts/generate_voices.sh   # uses macOS `say` + ffmpeg -> assets/voices/*.mp3
```

## Roadmap

- **Real voice engine (ElevenLabs)** — save clips of *anything you type*, not
  just the pre-baked lines, in rich character voices.
- **Real open-mouth pet art** — swap the emoji stand-ins in the gallery for
  original licensed/CC0 photos or commissioned illustrations.
- Hosted key endpoint so live "type-anything" dubs are saveable.

## Project layout

```
index.html            # the app
css/style.css         # styling (mobile-first, light/dark)
js/app.js             # capture, voices, critters, the in-browser stitch
assets/manifest.json  # voices + funny lines
assets/voices/        # pre-baked say voice clips (voiceKey_lineIndex.mp3)
assets/sample/        # bundled sample clip for trying the flow
scripts/generate_voices.sh
docs/                 # design notes
```
