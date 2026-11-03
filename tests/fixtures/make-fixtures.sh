#!/usr/bin/env bash
# F-001 fixtures (adapters/tests.md "Layout"). Promoted from spike SP-decode (ADR-0005, ADR-0018):
# the same patterns and EXIF writer, without the wide-gamut fixtures, which embed Apple ColorSync
# profiles that must be registered in dependencies.md before they enter the repo (ADR-0018).
# Tools: ImageMagick 7 (`magick`) and python3 (tools/exif_orient.py). Re-run to regenerate; every
# output is small and deterministic and is checked in.
set -euo pipefail
cd "$(dirname "$0")"

# Upright 240 × 160 asymmetric pattern: red top-left, green top-right, blue bottom-left, yellow
# bottom-right, a white mark near the top-left corner.
magick -size 120x80 xc:'#e01010' xc:'#10c010' +append \( -size 120x80 xc:'#1030e0' xc:'#f0e020' +append \) -append \
  -fill white -draw 'rectangle 8,8 40,24' -strip fmt.png

# RULE-03: EXIF orientation 1 and 6 (stored pixels are the inverse of what orientation asks for).
magick fmt.png -quality 95 -sampling-factor 4:4:4 -strip tmp.jpg
python3 tools/exif_orient.py tmp.jpg orient-1.jpg 1
magick fmt.png -rotate -90 -quality 95 -sampling-factor 4:4:4 -strip tmp.jpg
python3 tools/exif_orient.py tmp.jpg orient-6.jpg 6
rm tmp.jpg

# RULE-01 formats.
magick fmt.png -define webp:lossless=true fmt.webp
magick fmt.png -quality 100 fmt.avif
magick fmt.png -quality 90 fmt.heic
magick -size 8x8 xc:'#e01010' -type TrueColor BMP3:fmt.bmp
magick -delay 50 fmt.png \( -size 240x160 xc:blue \) -loop 0 fmt-anim.gif

# Refusals: a renamed text file and a PNG signature with a garbage body.
printf 'This is plain text, not an image.\n' > not-image.png
{ printf '\x89PNG\r\n\x1a\n'; head -c 400 /dev/zero | tr '\0' 'x'; } > broken.png

# RULE-02 / F-001.AC7: 6000 × 3400 (20.4 MP, over the limit); F-001.AC1: a wide screenshot-sized PNG.
magick -size 6000x3400 xc:'#3366cc' -define png:compression-level=9 -strip large-6000x3400.png
magick -size 2000x1000 xc:'#10c010' -strip wide-2000x1000.png

# ADR-0023 header sizes: lossy WebP (VP8), extended WebP with alpha (VP8X), and an over-limit JPEG
# stored 3400 × 6000 with orientation 6 (shown 6000 × 3400, scale-down to 5441 × 3083).
magick fmt.png -quality 80 fmt-lossy.webp
magick fmt.png -alpha set -channel A -evaluate set 50% +channel -quality 80 fmt-alpha.webp
magick fmt.png -filter point -resize 6000x3400! -rotate -90 -quality 5 -sampling-factor 4:2:0 -strip tmp.jpg
python3 tools/exif_orient.py tmp.jpg large-rot6.jpg 6
rm tmp.jpg

# F-001 edge case: a fully transparent PNG shows the checkerboard on screen.
magick -size 64x64 xc:none transparent.png
