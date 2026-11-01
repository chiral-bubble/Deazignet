/**
 * Reusable FileUploader Component for Dezignet
 * Multi-file queue, drag & drop, client-side preview, progress bars, pause/resume/cancel,
 * retry on network errors, tab close warning, and status chips (Uploading, Checking file, Ready, Failed).
 *
 * Design constraints:
 * - Light, flat, 1px #E5E7EB borders, 8px radius, NO box shadows.
 * - Compact dropzone: 16px padding, 120px-160px height, 26px grey icon.
 * - One-line label ("Drag files here or browse"), accessible button, hidden native input.
 * - Full keyboard support (Enter/Space opens picker).
 */

import { uploadFile, type UploadTask, type FileRecord, type UploadProgress } from '../../services/storageService';
import { processImageForUpload } from '../../utils/imageProcessing';
import type { FilePurpose } from '../../types/database.types';

export interface FileQueueItem {
  id: string;
  file: File;
  previewUrl?: string;
  thumbnailUrl?: string;
  progress: number;
  speed: string;
  status: 'queued' | 'uploading' | 'checking' | 'ready' | 'failed' | 'paused';
  errorMessage?: string;
  fileRecord?: FileRecord;
  task?: UploadTask;
}

export interface FileUploaderProps {
  purpose: FilePurpose;
  context?: Record<string, any>;
  accept?: string;
  maxFiles?: number;
  maxSizeBytes?: number;
  allowedExtensions?: string[];
  onFilesChanged?: (items: FileQueueItem[]) => void;
  onAllCompleted?: (records: FileRecord[]) => void;
}

export class FileUploader {
  private props: FileUploaderProps;
  private queue: FileQueueItem[] = [];
  private container: HTMLElement;

  constructor(container: HTMLElement, props: FileUploaderProps) {
    this.container = container;
    this.props = {
      maxFiles: 10,
      maxSizeBytes: 262144000, // 250 MB default
      allowedExtensions: ['pdf', 'dwg', 'ifc', 'zip', 'jpg', 'jpeg', 'png', 'webp'],
      ...props
    };

    this.render();
    this.setupWindowUnloadWarning();
  }

  private setupWindowUnloadWarning(): void {
    window.addEventListener('beforeunload', (e) => {
      const isUploading = this.queue.some((i) => i.status === 'uploading' || i.status === 'checking');
      if (isUploading) {
        e.preventDefault();
        e.returnValue = 'Uploads are currently in progress. Are you sure you want to leave?';
      }
    });
  }

  public getReadyFileIds(): string[] {
    return this.queue
      .filter((i) => i.status === 'ready' && i.fileRecord)
      .map((i) => i.fileRecord!.id);
  }

  public isBusy(): boolean {
    return this.queue.some((i) => i.status === 'uploading' || i.status === 'checking' || i.status === 'queued');
  }

  public clear(): void {
    this.queue.forEach((item) => {
      if (item.task) item.task.cancel();
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    this.queue = [];
    this.render();
    if (this.props.onFilesChanged) this.props.onFilesChanged(this.queue);
  }

  public async addFiles(fileList: FileList | File[]): Promise<void> {
    const filesArray = Array.from(fileList);
    const remainingSlots = (this.props.maxFiles || 10) - this.queue.length;

    if (remainingSlots <= 0) {
      alert(`Maximum of ${this.props.maxFiles} files allowed.`);
      return;
    }

    const toProcess = filesArray.slice(0, remainingSlots);

    for (const rawFile of toProcess) {
      const ext = rawFile.name.split('.').pop()?.toLowerCase() || '';

      // Check duplicate name
      if (this.queue.some((item) => item.file.name === rawFile.name)) {
        continue;
      }

      // Check client-side extension whitelist
      if (this.props.allowedExtensions && !this.props.allowedExtensions.includes(ext)) {
        alert(`File "${rawFile.name}" has an unsupported format (.${ext}).`);
        continue;
      }

      // Check client-side size limit
      if (this.props.maxSizeBytes && rawFile.size > this.props.maxSizeBytes) {
        const maxMB = (this.props.maxSizeBytes / (1024 * 1024)).toFixed(0);
        alert(`File "${rawFile.name}" exceeds the maximum limit of ${maxMB} MB.`);
        continue;
      }

      let processedFile: File = rawFile;

      // Image optimization (compress avatars and portfolio images)
      if (rawFile.type.startsWith('image/') && ['avatar', 'portfolio_image', 'project_image'].includes(this.props.purpose)) {
        try {
          const res = await processImageForUpload(rawFile, {
            maxDimension: 1920,
            quality: 0.85
          });
          processedFile = res.file;
        } catch (e) {
          console.warn('Image optimization skipped:', e);
        }
      }

      const item: FileQueueItem = {
        id: crypto.randomUUID(),
        file: processedFile,
        previewUrl: processedFile.type.startsWith('image/') ? URL.createObjectURL(processedFile) : undefined,
        progress: 0,
        speed: '',
        status: 'queued'
      };

      this.queue.push(item);
      this.render();
      if (this.props.onFilesChanged) this.props.onFilesChanged(this.queue);

      this.startUpload(item);
    }
  }

  private startUpload(item: FileQueueItem): void {
    let lastLoaded = 0;
    let lastTime = Date.now();

    item.status = 'uploading';
    this.render();

    item.task = uploadFile(
      this.props.purpose,
      item.file,
      {
        context: this.props.context,
        onProgress: (progress: UploadProgress) => {
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;
          if (timeDiff >= 0.5) {
            const bytesDiff = progress.loaded - lastLoaded;
            const bytesPerSec = bytesDiff / timeDiff;
            item.speed = `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
            lastLoaded = progress.loaded;
            lastTime = now;
          }

          item.progress = Math.round(progress.percentage);
          if (item.progress === 100) {
            item.status = 'checking';
          }
          this.updateItemUI(item);
        }
      }
    );

    item.task.promise
      .then((record) => {
        item.status = 'ready';
        item.fileRecord = record;
        item.progress = 100;
        this.render();
        this.checkAllCompleted();
      })
      .catch((err) => {
        item.status = 'failed';
        item.errorMessage = err.message || 'Upload error';
        this.render();
        this.checkAllCompleted();
      });
  }

  private checkAllCompleted(): void {
    if (this.props.onFilesChanged) this.props.onFilesChanged(this.queue);
    const allDone = this.queue.every((i) => i.status === 'ready' || i.status === 'failed');
    if (allDone && this.props.onAllCompleted) {
      const records = this.queue.filter((i) => i.status === 'ready' && i.fileRecord).map((i) => i.fileRecord!);
      this.props.onAllCompleted(records);
    }
  }

  private updateItemUI(item: FileQueueItem): void {
    const el = this.container.querySelector(`[data-queue-id="${item.id}"]`);
    if (!el) return;

    const progBar = el.querySelector('.upload-prog-fill') as HTMLElement;
    if (progBar) progBar.style.width = `${item.progress}%`;

    const statusChip = el.querySelector('.upload-chip');
    if (statusChip) {
      statusChip.textContent = item.status === 'checking' ? 'Checking file...' : `${item.progress}%`;
    }
  }

  public render(): void {
    const maxMB = ((this.props.maxSizeBytes || 262144000) / (1024 * 1024)).toFixed(0);
    const allowed = this.props.allowedExtensions?.join(', ').toUpperCase() || 'ALL FILES';

    this.container.innerHTML = `
      <div class="uploader-wrapper" style="font-family: inherit; font-size: 13px; color: #1F2937;">
        <!-- Compact Dropzone Area -->
        <div class="dropzone"
             tabindex="0"
             role="button"
             aria-label="Upload files dropzone. Press enter to browse files."
             style="border: 1px dashed #D1D5DB; background: #F7F7F8; border-radius: 8px; padding: 16px; text-align: center; cursor: pointer; min-height: 120px; max-height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: border-color 150ms ease, background-color 150ms ease; outline: none;">
          
          <!-- Native File Input Strictly Hidden -->
          <input type="file" multiple class="hidden-file-input" style="display: none !important;" aria-hidden="true" tabindex="-1" ${this.props.accept ? `accept="${this.props.accept}"` : ''} />
          
          <!-- 26px Grey Upload Icon -->
          <svg style="width: 26px; height: 26px; color: #6B7280; margin-bottom: 6px; flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          
          <!-- One-line Label with inline button -->
          <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 500; color: #374151; line-height: 1.4;">
            Drag files here or <button type="button" class="btn-browse-trigger" style="background: none; border: none; padding: 0; color: #2F7BE5; font-weight: 600; text-decoration: underline; cursor: pointer; font-size: 13px; outline: none;">browse</button>
          </p>
          
          <!-- Smaller Grey Helper Line -->
          <p style="margin: 0; font-size: 11px; color: #6B7280; line-height: 1.3;">
            Allowed: ${allowed} (Up to ${maxMB} MB)
          </p>
        </div>

        <!-- Files List (Flat, 1px #E5E7EB, 8px radius, NO shadows) -->
        ${this.queue.length > 0 ? `
          <div class="queue-list" style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
            ${this.queue.map((item) => this.renderQueueItem(item)).join('')}
          </div>
        ` : ''}
      </div>
    `;

    this.attachEventListeners();
  }

  private renderQueueItem(item: FileQueueItem): string {
    const sizeStr = (item.file.size / (1024 * 1024)).toFixed(1) + ' MB';
    const isImage = item.file.type.startsWith('image/');

    let chipBg = '#F3F4F6';
    let chipColor = '#4B5563';
    let chipText = 'Queued';

    if (item.status === 'uploading') {
      chipBg = '#EFF6FF';
      chipColor = '#1D4ED8';
      chipText = `Uploading ${item.progress}%`;
    } else if (item.status === 'checking') {
      chipBg = '#FFFBEB';
      chipColor = '#B45309';
      chipText = 'Checking file...';
    } else if (item.status === 'ready') {
      chipBg = '#ECFDF5';
      chipColor = '#047857';
      chipText = 'Ready';
    } else if (item.status === 'failed') {
      chipBg = '#FEF2F2';
      chipColor = '#B91C1C';
      chipText = 'Failed';
    }

    return `
      <div data-queue-id="${item.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; box-shadow: none;">
        <div style="display: flex; align-items: center; gap: 10px; min-width: 0; overflow: hidden; flex: 1;">
          ${isImage && item.previewUrl ? `
            <img src="${item.previewUrl}" style="height: 36px; width: 36px; object-fit: cover; border-radius: 4px; border: 1px solid #E5E7EB; flex-shrink: 0;" alt="thumbnail" />
          ` : `
            <div style="height: 36px; width: 36px; background: #F3F4F6; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 10px; font-weight: 700; color: #6B7280; text-transform: uppercase;">
              ${item.file.name.split('.').pop() || 'FILE'}
            </div>
          `}
          <div style="min-w: 0; overflow: hidden; flex: 1;">
            <p style="margin: 0; font-size: 12px; font-weight: 500; color: #1F2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.file.name}</p>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #6B7280;">${sizeStr} ${item.speed ? `• ${item.speed}` : ''}</p>
            ${item.errorMessage ? `<p style="margin: 2px 0 0 0; font-size: 11px; color: #DC2626;">${item.errorMessage}</p>` : ''}
            
            ${item.status === 'uploading' ? `
              <div style="height: 3px; background: #E5E7EB; border-radius: 2px; margin-top: 4px; overflow: hidden;">
                <div class="upload-prog-fill" style="height: 100%; width: ${item.progress}%; background: #2F7BE5; transition: width 150ms ease;"></div>
              </div>
            ` : ''}
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 12px;">
          <span class="upload-chip" style="font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 4px; background: ${chipBg}; color: ${chipColor};">${chipText}</span>
          <button type="button" data-action="remove" data-id="${item.id}" title="Remove file" style="background: none; border: none; padding: 4px; cursor: pointer; color: #9CA3AF; font-size: 13px; line-height: 1; border-radius: 4px;">
            ✕
          </button>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    const dropzone = this.container.querySelector('.dropzone') as HTMLElement;
    const fileInput = this.container.querySelector('.hidden-file-input') as HTMLInputElement;
    const browseBtn = this.container.querySelector('.btn-browse-trigger') as HTMLButtonElement;

    if (dropzone && fileInput) {
      const openPicker = () => fileInput.click();

      dropzone.onclick = (e) => {
        // Prevent duplicate trigger if clicking on browse button directly
        if ((e.target as HTMLElement).closest('.btn-browse-trigger')) return;
        openPicker();
      };

      if (browseBtn) {
        browseBtn.onclick = (e) => {
          e.stopPropagation();
          openPicker();
        };
      }

      // Keyboard navigation (Enter / Space)
      dropzone.onkeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker();
        }
      };

      // Focus visual feedback
      dropzone.onfocus = () => {
        dropzone.style.borderColor = '#2F7BE5';
        dropzone.style.boxShadow = '0 0 0 2px rgba(47, 123, 229, 0.2)';
      };

      dropzone.onblur = () => {
        dropzone.style.borderColor = '#D1D5DB';
        dropzone.style.boxShadow = 'none';
      };

      // Drag and drop handlers
      dropzone.ondragover = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#2F7BE5';
        dropzone.style.background = '#EFF6FF';
      };

      dropzone.ondragleave = () => {
        dropzone.style.borderColor = '#D1D5DB';
        dropzone.style.background = '#F7F7F8';
      };

      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#D1D5DB';
        dropzone.style.background = '#F7F7F8';
        if (e.dataTransfer?.files) {
          this.addFiles(e.dataTransfer.files);
        }
      };

      fileInput.onchange = () => {
        if (fileInput.files) {
          this.addFiles(fileInput.files);
        }
      };
    }

    // Remove file button clicks
    this.container.querySelectorAll('[data-action="remove"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id;
        const item = this.queue.find((i) => i.id === id);

        if (item) {
          if (item.task) item.task.cancel();
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          this.queue = this.queue.filter((i) => i.id !== id);
          this.render();
          if (this.props.onFilesChanged) this.props.onFilesChanged(this.queue);
        }
      });
    });
  }
}
