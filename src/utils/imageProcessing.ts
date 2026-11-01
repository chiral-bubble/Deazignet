/**
 * Image Processing Utility for Dezignet (Phase 6)
 * Client-side image resizing, WebP conversion, thumbnail generation, and EXIF/GPS stripping.
 * Drawing onto an HTML5 Canvas completely discards EXIF/metadata, protecting user privacy.
 */

export interface ProcessedImageResult {
  file: File;
  thumbnail?: File;
  previewUrl: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
}

/**
 * Resizes an image file to WebP format, constraining the longest edge,
 * stripping all EXIF/GPS metadata, and creating an optional 400px thumbnail.
 */
export async function processImageForUpload(
  file: File,
  options: {
    maxDimension?: number;
    quality?: number;
    generateThumbnail?: boolean;
    thumbnailDimension?: number;
  } = {}
): Promise<ProcessedImageResult> {
  const {
    maxDimension = 2400,
    quality = 0.85,
    generateThumbnail = true,
    thumbnailDimension = 400
  } = options;

  // If not an image or in Node/test environment without window/canvas, return original
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
    return {
      file,
      previewUrl: '',
      width: 0,
      height: 0
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);

      try {
        let width = img.width;
        let height = img.height;

        // Calculate constrained dimensions
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        // 1. Draw main canvas (strips EXIF automatically)
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable.');

        ctx.drawImage(img, 0, 0, width, height);

        const mainBlob = await new Promise<Blob>((res, rej) => {
          canvas.toBlob(
            (b) => (b ? res(b) : rej(new Error('Failed to convert canvas to blob.'))),
            'image/webp',
            quality
          );
        });

        const newFileName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
        const processedFile = new File([mainBlob], newFileName, { type: 'image/webp' });
        const previewUrl = URL.createObjectURL(processedFile);

        // 2. Generate thumbnail if requested
        let thumbFile: File | undefined;
        let thumbUrl: string | undefined;

        if (generateThumbnail) {
          let tWidth = img.width;
          let tHeight = img.height;

          if (tWidth > thumbnailDimension || tHeight > thumbnailDimension) {
            if (tWidth > tHeight) {
              tHeight = Math.round((tHeight * thumbnailDimension) / tWidth);
              tWidth = thumbnailDimension;
            } else {
              tWidth = Math.round((tWidth * thumbnailDimension) / tHeight);
              tHeight = thumbnailDimension;
            }
          }

          const thumbCanvas = document.createElement('canvas');
          thumbCanvas.width = tWidth;
          thumbCanvas.height = tHeight;
          const tCtx = thumbCanvas.getContext('2d');
          if (tCtx) {
            tCtx.drawImage(img, 0, 0, tWidth, tHeight);
            const thumbBlob = await new Promise<Blob>((res, rej) => {
              thumbCanvas.toBlob(
                (b) => (b ? res(b) : rej(new Error('Thumbnail conversion failed.'))),
                'image/webp',
                0.8
              );
            });
            const thumbName = file.name.replace(/\.[^/.]+$/, '') + '_thumb.webp';
            thumbFile = new File([thumbBlob], thumbName, { type: 'image/webp' });
            thumbUrl = URL.createObjectURL(thumbFile);
          }
        }

        resolve({
          file: processedFile,
          thumbnail: thumbFile,
          previewUrl,
          thumbnailUrl: thumbUrl,
          width,
          height
        });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for processing.'));
    };

    img.src = objectUrl;
  });
}

