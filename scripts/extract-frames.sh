#!/usr/bin/env bash
# ============================================================
# extract-frames.sh — Extract WebP frames from a source video
# for the Dezignet scroll-scrubbed hero section.
#
# Usage:
#   ./scripts/extract-frames.sh <video-path> [fps]
#
# Arguments:
#   video-path  Path to the source video (MP4, MOV, etc.)
#   fps         Frames per second to extract (default: 15)
#
# Output:
#   public/hero-frames/        — 1920px wide WebP frames
#   public/hero-frames-mobile/  — 960px wide WebP frames
#
# Prerequisites:
#   - ffmpeg must be installed and on PATH
#
# Example:
#   ./scripts/extract-frames.sh ~/Downloads/my-video.mp4 12
# ============================================================

set -euo pipefail

VIDEO="${1:?Usage: $0 <video-path> [fps]}"
FPS="${2:-15}"
QUALITY=75

DESKTOP_DIR="public/hero-frames"
MOBILE_DIR="public/hero-frames-mobile"

# Validate
if ! command -v ffmpeg &>/dev/null; then
  echo "❌ ffmpeg is not installed. Install it first."
  exit 1
fi

if [ ! -f "$VIDEO" ]; then
  echo "❌ Video file not found: $VIDEO"
  exit 1
fi

# Clean old frames
echo "🗑️  Cleaning old frames..."
rm -rf "$DESKTOP_DIR" "$MOBILE_DIR"
mkdir -p "$DESKTOP_DIR" "$MOBILE_DIR"

# Extract desktop frames (1920px wide)
echo "🖥️  Extracting desktop frames (1920px wide, ${FPS}fps, quality ${QUALITY})..."
ffmpeg -i "$VIDEO" \
  -vf "fps=${FPS},scale=1920:-1" \
  -c:v libwebp -quality "$QUALITY" \
  -y "${DESKTOP_DIR}/frame_%04d.webp" \
  2>&1 | tail -5

DESKTOP_COUNT=$(ls -1 "$DESKTOP_DIR"/*.webp 2>/dev/null | wc -l)
echo "✅ Desktop: ${DESKTOP_COUNT} frames"

# Extract mobile frames (960px wide)
echo "📱 Extracting mobile frames (960px wide, ${FPS}fps, quality ${QUALITY})..."
ffmpeg -i "$VIDEO" \
  -vf "fps=${FPS},scale=960:-1" \
  -c:v libwebp -quality "$QUALITY" \
  -y "${MOBILE_DIR}/frame_%04d.webp" \
  2>&1 | tail -5

MOBILE_COUNT=$(ls -1 "$MOBILE_DIR"/*.webp 2>/dev/null | wc -l)
echo "✅ Mobile: ${MOBILE_COUNT} frames"

# Report sizes
DESKTOP_SIZE=$(du -sh "$DESKTOP_DIR" | awk '{print $1}')
MOBILE_SIZE=$(du -sh "$MOBILE_DIR" | awk '{print $1}')
echo ""
echo "📊 Summary:"
echo "   Desktop: ${DESKTOP_COUNT} frames, ${DESKTOP_SIZE}"
echo "   Mobile:  ${MOBILE_COUNT} frames, ${MOBILE_SIZE}"
echo ""
echo "⚠️  Update TOTAL_FRAMES in src/components/heroScroll.ts if frame count changed."
echo "   Current value should be: ${DESKTOP_COUNT}"
