#!/usr/bin/env bash
# Animal Dub — pre-generate the funny voice clips using the free macOS `say` voices.
# Output: assets/voices/<voiceKey>_<lineIndex>.mp3
# Re-run any time to regenerate. ElevenLabs will replace this in a later step.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="assets/voices"
mkdir -p "$OUT"
TMP="$(mktemp -t animaldub).aiff"

# Personality => macOS `say` voice (+ optional ffmpeg audio filter for character)
# key | say voice | ffmpeg -af filter (or "-")
VOICES=(
  "aristocat|Daniel|-"
  "doomsday|Bad News|-"
  "cosmic|Zarvox|-"
  "ralph|Ralph|-"
  "whisper|Whisper|-"
  "boing|Boing|-"
  "overlord|Fred|aresample=44100,asetrate=44100*0.75,aresample=44100,atempo=1.33,aecho=0.8:0.85:55:0.35"
  "clown|Jester|-"
  "bubbles|Bubbles|-"
  "chipmunk|Fred|aresample=44100,asetrate=44100*1.4,aresample=44100,atempo=0.72"
  "diva|Superstar|-"
)

LINES=(
  "Does this fur make me look fat?"
  "Bring me to your refrigerator. Immediately."
  "I went to middle school too, you know."
  "I am not fat. I am aggressively fluffy."
  "You call that a belly rub? Do it again, human."
  "I have reviewed the household budget. We are getting more treats."
  "I knocked it off the table. On purpose. For science."
  "Kneel. Then feed me. In that order."
  "You DARE approach me without snacks?"
)

for entry in "${VOICES[@]}"; do
  IFS='|' read -r key sv filt <<< "$entry"
  for i in "${!LINES[@]}"; do
    line="${LINES[$i]}"
    say -v "$sv" -o "$TMP" "$line"
    if [ "$filt" = "-" ]; then
      ffmpeg -y -loglevel error -i "$TMP" -codec:a libmp3lame -q:a 5 "$OUT/${key}_${i}.mp3"
    else
      ffmpeg -y -loglevel error -i "$TMP" -af "$filt" -codec:a libmp3lame -q:a 5 "$OUT/${key}_${i}.mp3"
    fi
    echo "  ✓ ${key}_${i}.mp3"
  done
done

rm -f "$TMP"
echo "Done. $(ls -1 "$OUT"/*.mp3 | wc -l | tr -d ' ') clips in $OUT"
