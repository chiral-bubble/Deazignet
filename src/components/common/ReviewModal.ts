/**
 * Two-Way Double-Blind Review Modal & Report Dialog for Dezignet
 * Accessible keyboard navigation, dimensional ratings, live character counters,
 * real-time contact info / link warning, double-blind guarantee banner, and 14-day countdown.
 */

import {
  submitReview,
  updateReview,
  reportReview,
  replyToReview,
  detectReviewContactFlags,
  CLIENT_REVIEW_DIMENSIONS,
  DESIGNER_REVIEW_DIMENSIONS,
  REVIEW_SETTINGS,
  type ReviewItem
} from '../../services/reviewsService';

export interface OpenReviewModalOptions {
  engagementId: string;
  role: 'client' | 'designer';
  counterpartName: string;
  projectTitle?: string;
  existingReview?: ReviewItem | null;
  daysRemaining?: number;
  onSubmitted?: () => void;
}

export interface OpenReportModalOptions {
  reviewId: string;
  onReported?: () => void;
}

export interface OpenReplyModalOptions {
  reviewId: string;
  existingReply?: string | null;
  replyEditableUntil?: string | null;
  onReplied?: () => void;
}

/**
 * Renders an accessible 1-5 star rating picker
 */
function renderStarPicker(name: string, selectedValue: number, label: string): string {
  return `
    <div class="star-rating-picker" role="radiogroup" aria-label="${label}" data-name="${name}" style="display: inline-flex; align-items: center; gap: 4px;">
      ${[1, 2, 3, 4, 5].map((val) => `
        <button
          type="button"
          class="star-btn"
          role="radio"
          aria-checked="${val === selectedValue}"
          aria-label="${val} of 5 stars"
          tabindex="0"
          data-value="${val}"
          style="background: transparent; border: none; cursor: pointer; padding: 4px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; outline: none;"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="${val <= selectedValue ? '#F59E0B' : '#E5E7EB'}" stroke="${val <= selectedValue ? '#D97706' : '#9CA3AF'}" stroke-width="1.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      `).join('')}
      <span class="star-score-label" style="font-size: 13px; font-weight: 600; color: #4B5563; margin-left: 6px;">
        ${selectedValue > 0 ? `${selectedValue} / 5` : 'Select rating'}
      </span>
    </div>
  `;
}

/**
 * Initializes keyboard navigation for star button groups
 */
function attachStarPickerEvents(container: HTMLElement, onChange: (name: string, val: number) => void) {
  const pickers = container.querySelectorAll('.star-rating-picker');
  pickers.forEach((picker) => {
    const name = picker.getAttribute('data-name') || 'overall';
    const buttons = Array.from(picker.querySelectorAll<HTMLButtonElement>('.star-btn'));
    const scoreLabel = picker.querySelector('.star-score-label') as HTMLElement;

    function setVal(val: number) {
      buttons.forEach((btn) => {
        const btnVal = parseInt(btn.getAttribute('data-value') || '0', 10);
        btn.setAttribute('aria-checked', btnVal === val ? 'true' : 'false');
        const svg = btn.querySelector('svg');
        if (svg) {
          svg.setAttribute('fill', btnVal <= val ? '#F59E0B' : '#E5E7EB');
          svg.setAttribute('stroke', btnVal <= val ? '#D97706' : '#9CA3AF');
        }
      });
      if (scoreLabel) scoreLabel.textContent = `${val} / 5`;
      onChange(name, val);
    }

    buttons.forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const val = parseInt(btn.getAttribute('data-value') || '0', 10);
        setVal(val);
      });

      btn.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          const next = Math.min(5, index + 2);
          buttons[next - 1]?.focus();
          setVal(next);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          const prev = Math.max(1, index);
          buttons[prev - 1]?.focus();
          setVal(prev);
        } else if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          setVal(index + 1);
        }
      });
    });
  });
}

/**
 * Opens the two-way double-blind review modal
 */
export function openReviewModal(options: OpenReviewModalOptions): void {
  const existing = options.existingReview;
  const isEditing = Boolean(existing && existing.status === 'pending');
  let overallRating = existing?.rating || 5;
  const dimensionRatings: Record<string, number> = existing?.ratings ? { ...existing.ratings } : {};
  let wouldWorkAgain = existing?.would_work_again ?? existing?.would_hire_again ?? true;
  let commentText = existing?.comment || '';

  const dimensions = options.role === 'client' ? CLIENT_REVIEW_DIMENSIONS : DESIGNER_REVIEW_DIMENSIONS;

  // Initialize dimensions if unset
  dimensions.forEach((d) => {
    if (dimensionRatings[d.key] === undefined) {
      dimensionRatings[d.key] = 5;
    }
  });

  const daysRemaining = options.daysRemaining !== undefined ? options.daysRemaining : 14;

  const modalHtml = `
    <div id="dez-review-modal-backdrop" style="position: fixed; inset: 0; background: rgba(17, 24, 39, 0.6); backdrop-filter: blur(2px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px; overflow-y: auto;">
      <div id="dez-review-modal-box" role="dialog" aria-modal="true" aria-labelledby="review-modal-title" style="background: #FFFFFF; border-radius: 12px; width: 100%; max-width: 620px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; display: flex; flex-direction: column; max-height: 90vh;">
        
        <!-- Header -->
        <div style="padding: 20px 24px; border-bottom: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: flex-start; background: #FAFAFA;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: #EEF2FF; color: #4338CA; padding: 2px 8px; border-radius: 4px;">
                ${options.role === 'client' ? 'Client Review' : 'Designer Review'}
              </span>
              <span style="font-size: 11px; font-weight: 600; color: #92400E; background: #FEF3C7; padding: 2px 8px; border-radius: 4px;">
                ⏰ ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining
              </span>
            </div>
            <h2 id="review-modal-title" style="font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 4px 0;">
              ${isEditing ? 'Edit Your Review' : `Review ${options.counterpartName}`}
            </h2>
            <div style="font-size: 12.5px; color: #6B7280;">
              ${options.projectTitle ? `Project: <strong>${options.projectTitle}</strong>` : 'Completed Engagement'}
            </div>
          </div>
          <button id="btn-close-review-modal" aria-label="Close modal" style="background: transparent; border: none; font-size: 20px; cursor: pointer; color: #9CA3AF; padding: 4px 8px; line-height: 1; border-radius: 4px;">&times;</button>
        </div>

        <!-- Scrollable Body -->
        <div style="padding: 20px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px;">
          
          <!-- Double-blind Guarantee Notice -->
          <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 12px 14px; display: flex; gap: 10px; align-items: flex-start;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <div style="font-size: 12px; color: #166534; line-height: 1.45;">
              <strong>Double-Blind Review:</strong> Your review remains private until <em>both</em> parties submit their review or the 14-day window closes. Neither party can view the other's feedback before reveal. You may edit your review anytime before it is revealed.
            </div>
          </div>

          <!-- Overall Rating -->
          <div>
            <label style="display: block; font-size: 13.5px; font-weight: 600; color: #111827; margin-bottom: 6px;">
              Overall Rating <span style="color: #DC2626;">*</span>
            </label>
            ${renderStarPicker('overall', overallRating, 'Overall Rating')}
          </div>

          <!-- Dimension Ratings -->
          <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px 16px;">
            <div style="font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 12px;">
              Rating Dimensions
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${dimensions.map((dim) => `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <div>
                    <div style="font-size: 13px; font-weight: 600; color: #1F2937;">${dim.label}</div>
                    <div style="font-size: 11px; color: #6B7280;">${dim.desc}</div>
                  </div>
                  <div>
                    ${renderStarPicker(dim.key, dimensionRatings[dim.key] || 5, dim.label)}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Would Work Again -->
          <div>
            <label style="display: block; font-size: 13.5px; font-weight: 600; color: #111827; margin-bottom: 6px;">
              Would you work with this ${options.role === 'client' ? 'designer' : 'client'} again?
            </label>
            <div style="display: flex; gap: 12px;">
              <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: #374151; cursor: pointer;">
                <input type="radio" name="would_work_again" value="true" ${wouldWorkAgain ? 'checked' : ''} />
                <span>Yes, definitely</span>
              </label>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: #374151; cursor: pointer;">
                <input type="radio" name="would_work_again" value="false" ${!wouldWorkAgain ? 'checked' : ''} />
                <span>No, would not recommend</span>
              </label>
            </div>
          </div>

          <!-- Comment Box -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
              <label for="review-comment-input" style="font-size: 13.5px; font-weight: 600; color: #111827;">
                Detailed Feedback <span style="color: #DC2626;">*</span>
              </label>
              <span id="review-char-counter" style="font-size: 11.5px; color: #6B7280;">
                ${commentText.length} / 1500 characters (min 10)
              </span>
            </div>
            <textarea
              id="review-comment-input"
              rows="4"
              placeholder="Share specific highlights, turnaround, craftsmanship, and communication details..."
              style="width: 100%; border: 1px solid #D1D5DB; border-radius: 6px; padding: 10px 12px; font-size: 13.5px; font-family: inherit; line-height: 1.5; resize: vertical; box-sizing: border-box;"
            >${commentText}</textarea>
            
            <!-- Real-time Contact Warning Banner -->
            <div id="review-contact-warning" style="display: none; margin-top: 6px; font-size: 11.5px; color: #B45309; background: #FEF3C7; border: 1px solid #FCD34D; padding: 6px 10px; border-radius: 4px;">
              ⚠️ Direct contact details or external links detected. This review will be flagged for moderation upon submission.
            </div>
          </div>

        </div>

        <!-- Footer Actions -->
        <div style="padding: 16px 24px; border-top: 1px solid #E5E7EB; background: #FAFAFA; display: flex; justify-content: flex-end; gap: 10px;">
          <button id="btn-cancel-review" type="button" style="background: #FFFFFF; border: 1px solid #D1D5DB; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; color: #374151; cursor: pointer;">
            Cancel
          </button>
          <button id="btn-submit-review" type="button" style="background: #059669; color: #FFFFFF; border: none; padding: 8px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">
            ${isEditing ? 'Save Changes' : 'Submit Review'}
          </button>
        </div>

      </div>
    </div>
  `;

  // Remove any existing modal
  const oldModal = document.getElementById('dez-review-modal-backdrop');
  if (oldModal) oldModal.remove();

  const container = document.createElement('div');
  container.innerHTML = modalHtml;
  document.body.appendChild(container.firstElementChild!);

  const backdrop = document.getElementById('dez-review-modal-backdrop')!;
  const btnClose = document.getElementById('btn-close-review-modal')!;
  const btnCancel = document.getElementById('btn-cancel-review')!;
  const btnSubmit = document.getElementById('btn-submit-review') as HTMLButtonElement;
  const commentInput = document.getElementById('review-comment-input') as HTMLTextAreaElement;
  const charCounter = document.getElementById('review-char-counter')!;
  const contactWarning = document.getElementById('review-contact-warning')!;

  function closeModal() {
    backdrop.remove();
  }

  btnClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  window.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') {
      closeModal();
      window.removeEventListener('keydown', onEsc);
    }
  });

  // Star events
  attachStarPickerEvents(backdrop, (name, val) => {
    if (name === 'overall') {
      overallRating = val;
    } else {
      dimensionRatings[name] = val;
    }
  });

  // Would work again radio
  backdrop.querySelectorAll('input[name="would_work_again"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      wouldWorkAgain = (e.target as HTMLInputElement).value === 'true';
    });
  });

  // Comment input validations & contact info detection
  commentInput.addEventListener('input', () => {
    const val = commentInput.value;
    charCounter.textContent = `${val.length} / 1500 characters (min 10)`;

    const { flagged } = detectReviewContactFlags(val);
    contactWarning.style.display = flagged ? 'block' : 'none';

    btnSubmit.disabled = val.trim().length < REVIEW_SETTINGS.COMMENT_MIN_CHARS || val.length > REVIEW_SETTINGS.COMMENT_MAX_CHARS;
    btnSubmit.style.opacity = btnSubmit.disabled ? '0.6' : '1';
  });

  // Initial trigger for edit mode
  commentInput.dispatchEvent(new Event('input'));

  // Submit handler
  btnSubmit.addEventListener('click', async () => {
    const comment = commentInput.value.trim();
    if (comment.length < REVIEW_SETTINGS.COMMENT_MIN_CHARS) {
      alert(`Please write at least ${REVIEW_SETTINGS.COMMENT_MIN_CHARS} characters of feedback.`);
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Submitting...';

    try {
      if (isEditing && existing) {
        await updateReview(existing.id, {
          rating: overallRating,
          ratings: dimensionRatings,
          wouldWorkAgain,
          comment
        });
        alert('Your review has been updated. It remains private until reveal.');
      } else {
        const res = await submitReview({
          engagementId: options.engagementId,
          rating: overallRating,
          ratings: dimensionRatings,
          wouldWorkAgain,
          comment
        });
        if (res.revealed) {
          alert('Both parties have submitted their review! Your reviews are now published.');
        } else {
          alert('Thank you! Your review has been submitted and will remain completely private until the other party submits or the 14-day window closes.');
        }
      }

      closeModal();
      if (options.onSubmitted) options.onSubmitted();
    } catch (err: any) {
      alert(err.message || 'Failed to submit review.');
      btnSubmit.disabled = false;
      btnSubmit.textContent = isEditing ? 'Save Changes' : 'Submit Review';
    }
  });
}

/**
 * Opens a report modal for a review
 */
export function openReportReviewModal(options: OpenReportModalOptions): void {
  const modalHtml = `
    <div id="dez-report-modal-backdrop" style="position: fixed; inset: 0; background: rgba(17, 24, 39, 0.6); backdrop-filter: blur(2px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px;">
      <div style="background: #FFFFFF; border-radius: 12px; width: 100%; max-width: 480px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); overflow: hidden;">
        <div style="padding: 16px 20px; border-bottom: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 16px; font-weight: 700; color: #111827; margin: 0;">Report Review</h3>
          <button id="btn-close-report-modal" style="background: transparent; border: none; font-size: 20px; cursor: pointer; color: #9CA3AF;">&times;</button>
        </div>
        <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
          <p style="font-size: 13px; color: #4B5563; margin: 0;">
            Please select the reason for reporting this review. Our moderation team reviews all reports.
          </p>
          <div>
            <label style="display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 6px;">Reason</label>
            <select id="report-reason-select" style="width: 100%; border: 1px solid #D1D5DB; border-radius: 6px; padding: 8px 10px; font-size: 13px; background: #FFF;">
              <option value="inappropriate_content">Inappropriate or offensive content</option>
              <option value="harassment">Harassment or abusive language</option>
              <option value="conflict_of_interest">Conflict of interest / fake review</option>
              <option value="false_information">Verifiably false factual assertions</option>
              <option value="private_contact_info">Private contact info or personal data exposed</option>
              <option value="other">Other policy violation</option>
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 6px;">Additional Details (Optional)</label>
            <textarea id="report-details-input" rows="3" placeholder="Provide context to assist moderator review..." style="width: 100%; border: 1px solid #D1D5DB; border-radius: 6px; padding: 8px 10px; font-size: 13px; box-sizing: border-box;"></textarea>
          </div>
        </div>
        <div style="padding: 14px 20px; border-top: 1px solid #E5E7EB; background: #FAFAFA; display: flex; justify-content: flex-end; gap: 10px;">
          <button id="btn-cancel-report" type="button" style="background: #FFFFFF; border: 1px solid #D1D5DB; padding: 7px 14px; border-radius: 6px; font-size: 12.5px; font-weight: 500; color: #374151; cursor: pointer;">Cancel</button>
          <button id="btn-submit-report" type="button" style="background: #DC2626; color: #FFFFFF; border: none; padding: 7px 16px; border-radius: 6px; font-size: 12.5px; font-weight: 600; cursor: pointer;">Submit Report</button>
        </div>
      </div>
    </div>
  `;

  const old = document.getElementById('dez-report-modal-backdrop');
  if (old) old.remove();

  const wrap = document.createElement('div');
  wrap.innerHTML = modalHtml;
  document.body.appendChild(wrap.firstElementChild!);

  const backdrop = document.getElementById('dez-report-modal-backdrop')!;
  const btnClose = document.getElementById('btn-close-report-modal')!;
  const btnCancel = document.getElementById('btn-cancel-report')!;
  const btnSubmit = document.getElementById('btn-submit-report') as HTMLButtonElement;
  const reasonSelect = document.getElementById('report-reason-select') as HTMLSelectElement;
  const detailsInput = document.getElementById('report-details-input') as HTMLTextAreaElement;

  function close() { backdrop.remove(); }
  btnClose.addEventListener('click', close);
  btnCancel.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  btnSubmit.addEventListener('click', async () => {
    btnSubmit.disabled = true;
    try {
      await reportReview(options.reviewId, reasonSelect.value, detailsInput.value);
      alert('Thank you. Your report has been submitted to the moderation team.');
      close();
      if (options.onReported) options.onReported();
    } catch (err: any) {
      alert(err.message || 'Failed to submit report.');
      btnSubmit.disabled = false;
    }
  });
}

/**
 * Opens a modal for posting or editing a review reply (editable for 10 minutes)
 */
export function openReplyModal(options: OpenReplyModalOptions): void {
  const isEditing = Boolean(options.existingReply);

  const modalHtml = `
    <div id="dez-reply-modal-backdrop" style="position: fixed; inset: 0; background: rgba(17, 24, 39, 0.6); backdrop-filter: blur(2px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px;">
      <div style="background: #FFFFFF; border-radius: 12px; width: 100%; max-width: 520px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); overflow: hidden;">
        <div style="padding: 16px 20px; border-bottom: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 16px; font-weight: 700; color: #111827; margin: 0;">
            ${isEditing ? 'Edit Reply' : 'Reply to Review'}
          </h3>
          <button id="btn-close-reply-modal" style="background: transparent; border: none; font-size: 20px; cursor: pointer; color: #9CA3AF;">&times;</button>
        </div>
        <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
          <div style="background: #EFF6FF; border: 1px solid #DBEAFE; border-radius: 6px; padding: 10px 12px; font-size: 12px; color: #1E40AF;">
            ℹ️ You can post one public response to this review. Your reply can be edited for up to 10 minutes after posting.
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <label for="reply-text-input" style="font-size: 12.5px; font-weight: 600; color: #374151;">Your Reply</label>
              <span id="reply-char-counter" style="font-size: 11px; color: #6B7280;">0 / 800</span>
            </div>
            <textarea id="reply-text-input" rows="4" placeholder="Write a professional, constructive reply..." style="width: 100%; border: 1px solid #D1D5DB; border-radius: 6px; padding: 8px 10px; font-size: 13px; box-sizing: border-box;">${options.existingReply || ''}</textarea>
          </div>
        </div>
        <div style="padding: 14px 20px; border-top: 1px solid #E5E7EB; background: #FAFAFA; display: flex; justify-content: flex-end; gap: 10px;">
          <button id="btn-cancel-reply" type="button" style="background: #FFFFFF; border: 1px solid #D1D5DB; padding: 7px 14px; border-radius: 6px; font-size: 12.5px; font-weight: 500; color: #374151; cursor: pointer;">Cancel</button>
          <button id="btn-submit-reply" type="button" style="background: #2563EB; color: #FFFFFF; border: none; padding: 7px 16px; border-radius: 6px; font-size: 12.5px; font-weight: 600; cursor: pointer;">
            ${isEditing ? 'Update Reply' : 'Post Reply'}
          </button>
        </div>
      </div>
    </div>
  `;

  const old = document.getElementById('dez-reply-modal-backdrop');
  if (old) old.remove();

  const wrap = document.createElement('div');
  wrap.innerHTML = modalHtml;
  document.body.appendChild(wrap.firstElementChild!);

  const backdrop = document.getElementById('dez-reply-modal-backdrop')!;
  const btnClose = document.getElementById('btn-close-reply-modal')!;
  const btnCancel = document.getElementById('btn-cancel-reply')!;
  const btnSubmit = document.getElementById('btn-submit-reply') as HTMLButtonElement;
  const replyInput = document.getElementById('reply-text-input') as HTMLTextAreaElement;
  const charCounter = document.getElementById('reply-char-counter')!;

  function close() { backdrop.remove(); }
  btnClose.addEventListener('click', close);
  btnCancel.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  replyInput.addEventListener('input', () => {
    charCounter.textContent = `${replyInput.value.length} / 800`;
  });
  replyInput.dispatchEvent(new Event('input'));

  btnSubmit.addEventListener('click', async () => {
    const text = replyInput.value.trim();
    if (!text) {
      alert('Please enter your reply.');
      return;
    }
    btnSubmit.disabled = true;
    try {
      await replyToReview(options.reviewId, text);
      alert('Your reply has been posted.');
      close();
      if (options.onReplied) options.onReplied();
    } catch (err: any) {
      alert(err.message || 'Failed to post reply.');
      btnSubmit.disabled = false;
    }
  });
}
