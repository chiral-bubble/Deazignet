/**
 * useFrameSequence — Preloads a sequence of image frames and provides
 * a draw function to render any frame index onto a <canvas>.
 *
 * Usage:
 *   const seq = createFrameSequence({ canvas, totalFrames, basePath, onProgress });
 *   await seq.load();
 *   seq.drawFrame(42);
 */

export interface FrameSequenceOptions {
  /** The canvas element to draw on */
  canvas: HTMLCanvasElement;
  /** Total number of frames (1-indexed: frame_0001 … frame_NNNN) */
  totalFrames: number;
  /** Base path, e.g. '/hero-frames/' */
  basePath: string;
  /** Called with progress 0–1 as frames load */
  onProgress?: (progress: number) => void;
  /** Optional: number of concurrent loads (default 6) */
  concurrency?: number;
}

export interface FrameSequence {
  /** Load all frames. Resolves when complete. */
  load: () => Promise<void>;
  /** Draw frame at index (0-based) */
  drawFrame: (index: number) => void;
  /** Resize canvas (call on window resize) */
  resize: () => void;
  /** Number of successfully loaded frames */
  loadedCount: number;
  /** All frames */
  frames: HTMLImageElement[];
}

function padNumber(n: number, digits: number): string {
  return String(n).padStart(digits, '0');
}

export function createFrameSequence(opts: FrameSequenceOptions): FrameSequence {
  const {
    canvas,
    totalFrames,
    basePath,
    onProgress,
    concurrency = 6,
  } = opts;

  const ctx = canvas.getContext('2d')!;
  const frames: HTMLImageElement[] = new Array(totalFrames);
  let loadedCount = 0;
  let lastDrawnIndex = -1;

  /** Resize canvas to match display size × devicePixelRatio */
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Redraw current frame after resize
    if (lastDrawnIndex >= 0 && frames[lastDrawnIndex]) {
      drawFrame(lastDrawnIndex);
    }
  }

  /** Draw a single frame with object-fit: cover behavior */
  function drawFrame(index: number) {
    const clamped = Math.max(0, Math.min(index, totalFrames - 1));
    const img = frames[clamped];
    if (!img || !img.complete) return;

    lastDrawnIndex = clamped;

    const rect = canvas.getBoundingClientRect();
    const canvasW = rect.width;
    const canvasH = rect.height;
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;

    // Object-fit: cover calculation
    const scale = Math.max(canvasW / imgW, canvasH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const offsetX = (canvasW - drawW) / 2;
    const offsetY = (canvasH - drawH) / 2;

    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  }

  /** Load a single image */
  function loadImage(index: number): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = `${basePath}frame_${padNumber(index + 1, 4)}.webp`;
      img.onload = () => {
        frames[index] = img;
        loadedCount++;
        onProgress?.(loadedCount / totalFrames);
        resolve();
      };
      img.onerror = () => {
        // Still count it so progress completes
        loadedCount++;
        onProgress?.(loadedCount / totalFrames);
        resolve();
      };
    });
  }

  /** Load all frames with concurrency control */
  async function load(): Promise<void> {
    // Load first frame immediately for instant display
    await loadImage(0);
    drawFrame(0);
    resize();

    // Load remaining with concurrency pool
    const remaining = Array.from({ length: totalFrames - 1 }, (_, i) => i + 1);
    const pool: Promise<void>[] = [];

    for (const idx of remaining) {
      const p = loadImage(idx);
      pool.push(p);

      if (pool.length >= concurrency) {
        await Promise.race(pool);
        // Remove resolved promises
        for (let i = pool.length - 1; i >= 0; i--) {
          // Use Promise.race trick: replace resolved ones
          pool.splice(
            i,
            1,
            ...(await Promise.allSettled([pool[i]])).filter(
              (r) => r.status === 'pending' as any
            ).map(() => pool[i])
          );
        }
      }
    }

    await Promise.all(pool);
  }

  return {
    load,
    drawFrame,
    resize,
    get loadedCount() { return loadedCount; },
    frames,
  };
}
