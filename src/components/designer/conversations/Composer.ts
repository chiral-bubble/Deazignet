/**
 * Composer Component
 * Auto-growing textarea with:
 * - Enter to send, Shift+Enter for newline
 * - Character count limit (2000)
 * - File / image attachment handler (mock upload with size & type limits)
 * - Reply-only enforcement: if client hasn't initiated, disabled with banner
 * - Safety detector: detects phone numbers, emails, and off-platform payment terms
 *   and displays a clear warning ("Keep communication and payments on Dezignet to stay protected.")
 * - Dev simulation trigger: "Simulate client message"
 */

import { sendMessage, simulateIncomingClientMessage } from '../../../services/conversationsService';
import { type ConversationAttachment } from '../../../mocks/dataset';

const OFF_PLATFORM_KEYWORDS = [
  'paypal',
  'paystack direct',
  'wire me',
  'transfer directly',
  'whatsapp',
  'telegram',
  'cashapp',
  'zelle',
  'crypto',
  'bitcoin',
  'usdt',
  'bank transfer direct'
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(\+?[0-9]{1,4}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/;

export function renderComposer(isClosed: boolean, hasClientInitiated: boolean): string {
  if (isClosed) {
    return `
      <div class="dez-composer-closed" style="background: #F3F4F6; border-top: 1px solid #E5E7EB; padding: 16px 20px; text-align: center; color: #4B5563; font-size: 13px;">
        This project has concluded and the conversation thread is closed. Read-only mode.
      </div>
    `;
  }

  if (!hasClientInitiated) {
    return `
      <div class="dez-composer-waiting" style="background: #F7F7F8; border-top: 1px solid #E5E7EB; padding: 18px 20px; text-align: center;">
        <div style="font-weight: 500; font-size: 13.5px; color: #111827; margin-bottom: 2px;">Waiting for the client to start the conversation</div>
        <div style="font-size: 12.5px; color: #6B7280;">Clients review proposals and initiate the first message. You can reply as soon as they reach out.</div>
      </div>
    `;
  }

  return `
    <div class="dez-composer-container" style="border-top: 1px solid #E5E7EB; background: #FFFFFF; padding: 14px 20px;">
      <!-- Safety Warning Banner (shown dynamically) -->
      <div id="composer-safety-warning" style="display: none; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; font-size: 12.5px; color: #92400E; display: none; align-items: center; gap: 8px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span><strong>Safety reminder:</strong> Keep communication and payments on Dezignet to stay protected by escrow.</span>
      </div>

      <!-- Pending Attachments Chips Slot -->
      <div id="composer-pending-attachments" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;"></div>

      <!-- Textarea & Actions -->
      <form id="form-composer" style="display: flex; flex-direction: column; gap: 8px;">
        <div style="position: relative;">
          <textarea
            id="composer-textarea"
            class="dez-form-input"
            rows="2"
            maxlength="2000"
            placeholder="Type your reply... (Press Enter to send, Shift+Enter for new line)"
            style="width: 100%; resize: none; font-size: 13.5px; line-height: 1.5; padding: 10px 12px; min-height: 48px; max-height: 160px;"
          ></textarea>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <!-- Attachment Button & Hidden File Input -->
            <input type="file" id="composer-file-input" style="display: none;" multiple accept=".png,.jpg,.jpeg,.pdf,.dwg,.dxf" />
            <button
              type="button"
              class="dez-btn-secondary"
              id="btn-composer-attach"
              title="Attach files or drawings (PNG, JPG, PDF, CAD up to 15MB)"
              style="height: 32px; padding: 0 10px; font-size: 12.5px; display: inline-flex; align-items: center; gap: 4px;"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              <span>Attach</span>
            </button>

            <!-- Dev Test Simulation Button -->
            <button
              type="button"
              id="btn-simulate-incoming"
              style="height: 32px; font-size: 11.5px; padding: 0 10px; background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; border-radius: 6px; cursor: pointer;"
              title="Dev simulation: trigger incoming message from client"
            >
              ⚡ Simulate client message
            </button>
          </div>

          <div style="display: flex; align-items: center; gap: 12px;">
            <span id="composer-char-count" style="font-size: 11.5px; color: #9CA3AF;">0/2000</span>
            <button
              type="submit"
              class="dez-btn-primary"
              id="btn-composer-send"
              style="height: 34px; padding: 0 18px; font-size: 13px;"
            >
              Send
            </button>
          </div>
        </div>
      </form>
    </div>
  `;
}

export function initComposer(
  container: HTMLElement,
  conversationId: string,
  callbacks: {
    onMessageSent: () => void;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): void {
  const form = container.querySelector('#form-composer') as HTMLFormElement;
  const textarea = container.querySelector('#composer-textarea') as HTMLTextAreaElement;
  const btnAttach = container.querySelector('#btn-composer-attach') as HTMLButtonElement;
  const fileInput = container.querySelector('#composer-file-input') as HTMLInputElement;
  const safetyWarn = container.querySelector('#composer-safety-warning') as HTMLElement;
  const charCount = container.querySelector('#composer-char-count') as HTMLElement;
  const attachmentsSlot = container.querySelector('#composer-pending-attachments') as HTMLElement;
  const btnSimulate = container.querySelector('#btn-simulate-incoming');

  let pendingAttachments: ConversationAttachment[] = [];

  // Auto-grow textarea
  function autoGrow() {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(160, textarea.scrollHeight) + 'px';
  }

  // Check safety triggers
  function checkSafety(text: string) {
    if (!safetyWarn) return;
    const lower = text.toLowerCase();
    const hasOffPlatformWord = OFF_PLATFORM_KEYWORDS.some((kw) => lower.includes(kw));
    const hasEmail = EMAIL_REGEX.test(text);
    const hasPhone = PHONE_REGEX.test(text) && text.replace(/[^0-9]/g, '').length >= 8;

    if (hasOffPlatformWord || hasEmail || hasPhone) {
      safetyWarn.style.display = 'flex';
    } else {
      safetyWarn.style.display = 'none';
    }
  }

  textarea?.addEventListener('input', () => {
    autoGrow();
    const len = textarea.value.length;
    if (charCount) charCount.textContent = `${len}/2000`;
    checkSafety(textarea.value);
  });

  // Enter to send, Shift+Enter for newline
  textarea?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form?.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });

  // Attachment handler
  btnAttach?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', () => {
    const files = fileInput.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size > 15 * 1024 * 1024) {
        callbacks.onShowToast('File too large', `${f.name} exceeds the 15MB limit.`, 'error');
        continue;
      }

      const isImg = f.type.startsWith('image/');
      pendingAttachments.push({
        id: `att-${Date.now()}-${i}`,
        name: f.name,
        sizeBytes: f.size,
        type: isImg ? 'image' : 'pdf',
        url: isImg
          ? 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'
          : 'https://dezignet.studio/files/sample-drawing.pdf'
      });
    }

    renderPendingAttachments();
    fileInput.value = '';
  });

  function renderPendingAttachments() {
    if (!attachmentsSlot) return;
    attachmentsSlot.innerHTML = pendingAttachments
      .map(
        (att, idx) => `
      <div style="background: #F3F4F6; border: 1px solid #E5E7EB; border-radius: 4px; padding: 3px 8px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 6px;">
        <span>${att.name}</span>
        <button type="button" class="btn-remove-pending-att" data-att-idx="${idx}" style="background: none; border: none; color: #6B7280; cursor: pointer; padding: 0;">&times;</button>
      </div>
    `
      )
      .join('');

    attachmentsSlot.querySelectorAll<HTMLButtonElement>('.btn-remove-pending-att').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-att-idx') || '0', 10);
        pendingAttachments.splice(idx, 1);
        renderPendingAttachments();
      });
    });
  }

  // Form submit
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = textarea?.value.trim() || '';

    if (!text && pendingAttachments.length === 0) return;

    const attachmentsToSend = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined;
    textarea.value = '';
    pendingAttachments = [];
    renderPendingAttachments();
    if (safetyWarn) safetyWarn.style.display = 'none';
    if (charCount) charCount.textContent = '0/2000';
    textarea.style.height = 'auto';

    try {
      await sendMessage(conversationId, text, attachmentsToSend);
      callbacks.onMessageSent();
    } catch (err: any) {
      callbacks.onShowToast('Error', err.message || 'Failed to send message.', 'error');
    }
  });

  // Dev simulate button
  btnSimulate?.addEventListener('click', async () => {
    await simulateIncomingClientMessage(conversationId);
    callbacks.onMessageSent();
    callbacks.onShowToast('Message Simulated', 'Client reply received.', 'info');
  });
}
