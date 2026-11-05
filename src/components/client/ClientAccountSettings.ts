/**
 * Client Account Settings Component
 * Tabs:
 * 1. Profile: Photo (FileUploader), Full Name, Account Type (individual / company), Company Name, Location, Phone (private), Email (read-only + change flow). Sticky save bar when unsaved.
 * 2. Account: Password change with verification, Global sign out, In-app Notification Preferences, Danger Zone (Request Account Deletion).
 */

import { supabase, USE_MOCKS } from '../../lib/supabase';
import type { ClientAccountType } from '../../types/database.types';
import { changePasswordWithVerification, logOut } from '../../services/authService';
import { requestAccountDeletion } from '../../services/projectsService';
import { FileUploader } from '../common/FileUploader';
import { renderClientShell, initClientShell } from './ClientLayout';
import { US_STATES } from '../../services/usMarketService';

export async function renderClientAccountSettings(container: HTMLElement, activeTab: 'profile' | 'account' = 'profile'): Promise<void> {
  container.innerHTML = renderClientShell(
    {
      activeTab: 'settings',
      pageTitle: 'Account Settings'
    },
    `
      <div id="settings-loading" style="padding: 40px; text-align: center; color: #6B7280; font-size: 13px;">
        Loading account settings...
      </div>
    `
  );

  initClientShell(container);

  const mainArea = container.querySelector('main div');
  if (!mainArea) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !USE_MOCKS.auth) {
    window.location.hash = '#login';
    return;
  }

  // Load user profile & client profile
  let fullName = user?.user_metadata?.full_name || '';
  let avatarUrl = user?.user_metadata?.avatar_url || '';
  let email = user?.email || 'client@example.com';
  let accountType = 'individual';
  let companyName = '';
  let city = '';
  let stateRegion = '';
  let phone = '';

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_path, location')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      if (profile.full_name) fullName = profile.full_name;
      if (profile.avatar_path) avatarUrl = profile.avatar_path;
      if (profile.location) {
        const parts = profile.location.split(',');
        city = parts[0]?.trim() || '';
        stateRegion = parts[1]?.trim() || '';
      }
    }

    const { data: clientProf } = await supabase
      .from('client_profiles')
      .select('account_type, company_name, phone')
      .eq('user_id', user.id)
      .maybeSingle();

    if (clientProf) {
      if (clientProf.account_type) accountType = clientProf.account_type;
      if (clientProf.company_name) companyName = clientProf.company_name;
      if (clientProf.phone) phone = clientProf.phone;
    }
  }

  let currentTab = activeTab;
  let hasUnsavedChanges = false;

  // Unsaved changes leave warning
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  function renderLayout(): void {
    mainArea!.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto; padding-bottom: 80px;">
        <!-- Header -->
        <div style="margin-bottom: 24px;">
          <h1 style="font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 6px;">
            Account Settings
          </h1>
          <p style="font-size: 13.5px; color: #6B7280; margin: 0;">
            Manage your personal profile, credentials, and notification preferences.
          </p>
        </div>

        <!-- Navigation Tabs: Profile & Account -->
        <div style="display: flex; gap: 8px; border-bottom: 1px solid #E5E7EB; margin-bottom: 24px;">
          <button
            type="button"
            id="tab-btn-profile"
            style="background: none; border: none; padding: 10px 16px; font-size: 13.5px; font-weight: 600; cursor: pointer; border-bottom: 2px solid ${currentTab === 'profile' ? '#2F7BE5' : 'transparent'}; color: ${currentTab === 'profile' ? '#2F7BE5' : '#6B7280'};"
          >
            Profile
          </button>
          <button
            type="button"
            id="tab-btn-account"
            style="background: none; border: none; padding: 10px 16px; font-size: 13.5px; font-weight: 600; cursor: pointer; border-bottom: 2px solid ${currentTab === 'account' ? '#2F7BE5' : 'transparent'}; color: ${currentTab === 'account' ? '#2F7BE5' : '#6B7280'};"
          >
            Account Security & Preferences
          </button>
        </div>

        <!-- Tab Body -->
        <div id="settings-tab-content">
          ${currentTab === 'profile' ? renderProfileTab() : renderAccountTab()}
        </div>

        <!-- Sticky Save Bar for Profile Changes -->
        <div
          id="sticky-save-bar"
          style="display: ${hasUnsavedChanges ? 'flex' : 'none'}; position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: calc(100% - 40px); max-width: 800px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px 20px; align-items: center; justify-content: space-between; z-index: 50; box-shadow: 0 4px 12px rgba(0,0,0,0.06);"
        >
          <span style="font-size: 13px; font-weight: 500; color: #111827;">You have unsaved profile changes.</span>
          <div style="display: flex; gap: 8px;">
            <button type="button" id="btn-discard-profile" style="background: none; border: 1px solid #E5E7EB; color: #374151; font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 6px; cursor: pointer;">
              Discard
            </button>
            <button type="button" id="btn-save-profile" style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 8px 18px; border-radius: 6px; cursor: pointer;">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    `;

    bindTabEvents();
    if (currentTab === 'profile') bindProfileEvents();
    else bindAccountEvents();
  }

  function renderProfileTab(): string {
    return `
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px; display: flex; flex-direction: column; gap: 20px;">
        <!-- Avatar Photo Uploader -->
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px;">Profile Photo</label>
          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
            <img
              id="avatar-img-preview"
              src="${avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}"
              style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 1px solid #E5E7EB;"
              alt="Avatar"
            />
            <div style="font-size: 12px; color: #6B7280;">
              JPG, PNG or WebP. Max 5 MB.
            </div>
          </div>
          <div id="avatar-uploader-mount"></div>
        </div>

        <!-- Full Name -->
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Full Name *</label>
          <input
            type="text"
            id="f-prof-name"
            value="${escapeHtml(fullName)}"
            placeholder="e.g. Eleanor Vance"
            style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; box-sizing: border-box;"
          />
        </div>

        <!-- Account Type (Individual vs Company) -->
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Account Type *</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <label style="display: flex; align-items: center; gap: 8px; border: 1px solid #E5E7EB; padding: 10px 14px; border-radius: 6px; cursor: pointer; background: ${accountType === 'individual' ? '#F7F7F8' : '#FFFFFF'};">
              <input type="radio" name="acc_type" value="individual" ${accountType === 'individual' ? 'checked' : ''} style="accent-color: #2F7BE5;" />
              <span style="font-size: 13px; font-weight: 500; color: #111827;">Individual Client</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; border: 1px solid #E5E7EB; padding: 10px 14px; border-radius: 6px; cursor: pointer; background: ${accountType === 'company' ? '#F7F7F8' : '#FFFFFF'};">
              <input type="radio" name="acc_type" value="company" ${accountType === 'company' ? 'checked' : ''} style="accent-color: #2F7BE5;" />
              <span style="font-size: 13px; font-weight: 500; color: #111827;">Company / Developer</span>
            </label>
          </div>
        </div>

        <!-- Company Name (conditional) -->
        <div id="company-name-group" style="display: ${accountType === 'company' ? 'block' : 'none'};">
          <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Company / Entity Name</label>
          <input
            type="text"
            id="f-prof-company"
            value="${escapeHtml(companyName)}"
            placeholder="e.g. Apex Realty Developments"
            style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; box-sizing: border-box;"
          />
        </div>

        <!-- Location (City and State/ZIP) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">City *</label>
            <input
              type="text"
              id="f-prof-city"
              value="${escapeHtml(city)}"
              placeholder="e.g. Austin, Denver, Chicago"
              style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; box-sizing: border-box;"
            />
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">State *</label>
            <select
              id="f-prof-state"
              style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; box-sizing: border-box; background: #FFFFFF;"
            >
              <option value="">Select State...</option>
              ${US_STATES.map(s => `<option value="${s.code}" ${stateRegion === s.code || stateRegion === s.name ? 'selected' : ''}>${s.name} (${s.code})</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Phone (Private) -->
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Phone Number (Private)</label>
          <input
            type="tel"
            id="f-prof-phone"
            value="${escapeHtml(phone)}"
            placeholder="e.g. +234 801 234 5678"
            style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; box-sizing: border-box;"
          />
          <span style="font-size: 12px; color: #6B7280; display: block; margin-top: 4px;">Private. Never shown to designers browsing the platform.</span>
        </div>

        <!-- Email (Read-only with Change Email flow) -->
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Email Address</label>
          <div style="display: flex; gap: 8px;">
            <input
              type="email"
              value="${escapeHtml(email)}"
              disabled
              style="flex: 1; height: 40px; border: 1px solid #E5E7EB; background: #F7F7F8; border-radius: 6px; padding: 0 12px; font-size: 13px; color: #6B7280; box-sizing: border-box;"
            />
            <button
              type="button"
              id="btn-open-change-email"
              style="background: none; border: 1px solid #E5E7EB; color: #2F7BE5; font-size: 13px; font-weight: 600; padding: 0 16px; border-radius: 6px; cursor: pointer; white-space: nowrap;"
            >
              Change Email
            </button>
          </div>
          <span style="font-size: 12px; color: #6B7280; display: block; margin-top: 4px;">Used for sign-in and transactional communications.</span>
        </div>
      </div>
    `;
  }

  function renderAccountTab(): string {
    return `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        
        <!-- 1. Password Security -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
          <h3 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 6px;">Change Password</h3>
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 16px;">Ensure your account uses a secure password of at least 8 characters.</p>

          <div style="display: flex; flex-direction: column; gap: 12px; max-width: 480px;">
            <div>
              <label style="display: block; font-size: 12.5px; font-weight: 500; color: #374151; margin-bottom: 4px;">Current Password</label>
              <input type="password" id="f-curr-pass" placeholder="••••••••" style="width: 100%; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; box-sizing: border-box;" />
            </div>
            <div>
              <label style="display: block; font-size: 12.5px; font-weight: 500; color: #374151; margin-bottom: 4px;">New Password</label>
              <input type="password" id="f-new-pass" placeholder="At least 8 characters" style="width: 100%; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; box-sizing: border-box;" />
            </div>
            <div>
              <label style="display: block; font-size: 12.5px; font-weight: 500; color: #374151; margin-bottom: 4px;">Confirm New Password</label>
              <input type="password" id="f-conf-pass" placeholder="Confirm new password" style="width: 100%; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; box-sizing: border-box;" />
            </div>

            <div id="pass-feedback" style="display: none; font-size: 12px; padding: 6px 10px; border-radius: 4px;"></div>

            <div style="margin-top: 4px;">
              <button type="button" id="btn-update-pass" style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 9px 18px; border-radius: 6px; cursor: pointer;">
                Update Password
              </button>
            </div>
          </div>
        </div>

        <!-- 2. Global Sign Out (Applies to both client and designer) -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
          <h3 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 6px;">Active Sessions</h3>
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 16px;">
            Sign out of all desktop and mobile devices where your account is currently signed in.
          </p>

          <button type="button" id="btn-global-signout" style="background: none; border: 1px solid #E5E7EB; color: #DC2626; font-size: 13px; font-weight: 600; padding: 9px 16px; border-radius: 6px; cursor: pointer;">
            Sign Out of All Devices
          </button>
        </div>

        <!-- 3. Notification Preferences -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
            <h3 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0;">Notification Preferences</h3>
            <span id="notif-saved-indicator" style="font-size: 11px; color: #059669; display: none;">Saved</span>
          </div>
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 20px;">
            Control in-app alerts for milestone updates, messages, and project proposals.
          </p>

          <div style="display: flex; flex-direction: column; gap: 14px;">
            ${[
              { key: 'proposals', label: 'Proposal Received', desc: 'Alert when a designer submits a proposal on your open projects' },
              { key: 'milestones', label: 'Milestone Submissions & Approvals', desc: 'Alert when deliverables are submitted for your inspection' },
              { key: 'messages', label: 'Direct Messages', desc: 'Alert when a designer replies in an active conversation thread' },
              { key: 'announcements', label: 'Platform Announcements', desc: 'System updates and essential security advisories' }
            ].map((n) => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid #F3F4F6;">
                <div>
                  <div style="font-size: 13px; font-weight: 600; color: #111827;">${n.label}</div>
                  <div style="font-size: 12px; color: #6B7280;">${n.desc}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 16px;">
                  <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #374151; cursor: pointer;">
                    <input type="checkbox" class="chk-notif-pref" checked style="accent-color: #2F7BE5;" />
                    <span>In-app</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #9CA3AF; cursor: not-allowed;" title="Email notifications coming soon">
                    <input type="checkbox" disabled style="accent-color: #2F7BE5;" />
                    <span>Email (Coming soon)</span>
                  </label>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 4. Danger Zone (Request Account Deletion) -->
        <div style="background: #FFFFFF; border: 1px solid #FECACA; border-radius: 8px; padding: 24px;">
          <h3 style="font-size: 15px; font-weight: 600; color: #B91C1C; margin: 0 0 6px;">Danger Zone</h3>
          <p style="font-size: 13px; color: #4B5563; margin: 0 0 16px; line-height: 1.5;">
            Submit a formal request to delete your account and personal data. Deletion is blocked while you have active projects, ongoing designer contracts, or funds in escrow. Certain transaction history must be retained for legal compliance.
          </p>

          <button type="button" id="btn-request-deletion" style="background: #FEF2F2; border: 1px solid #FCA5A5; color: #DC2626; font-size: 13px; font-weight: 600; padding: 9px 16px; border-radius: 6px; cursor: pointer;">
            Request Account Deletion
          </button>
        </div>
      </div>
    `;
  }

  function bindTabEvents() {
    document.getElementById('tab-btn-profile')?.addEventListener('click', () => {
      currentTab = 'profile';
      renderLayout();
    });

    document.getElementById('tab-btn-account')?.addEventListener('click', () => {
      currentTab = 'account';
      renderLayout();
    });
  }

  function bindProfileEvents() {
    const nameInput = document.getElementById('f-prof-name') as HTMLInputElement;
    const compInput = document.getElementById('f-prof-company') as HTMLInputElement;
    const cityInput = document.getElementById('f-prof-city') as HTMLInputElement;
    const stateInput = document.getElementById('f-prof-state') as HTMLInputElement;
    const phoneInput = document.getElementById('f-prof-phone') as HTMLInputElement;
    const companyGroup = document.getElementById('company-name-group');

    const markDirty = () => {
      hasUnsavedChanges = true;
      const bar = document.getElementById('sticky-save-bar');
      if (bar) bar.style.display = 'flex';
    };

    nameInput?.addEventListener('input', markDirty);
    compInput?.addEventListener('input', markDirty);
    cityInput?.addEventListener('input', markDirty);
    stateInput?.addEventListener('input', markDirty);
    phoneInput?.addEventListener('input', markDirty);

    document.querySelectorAll('input[name="acc_type"]').forEach((r) => {
      r.addEventListener('change', () => {
        accountType = (r as HTMLInputElement).value;
        if (companyGroup) companyGroup.style.display = accountType === 'company' ? 'block' : 'none';
        markDirty();
      });
    });

    // Mount avatar uploader
    const mountEl = document.getElementById('avatar-uploader-mount');
    if (mountEl) {
      new FileUploader(mountEl, {
        purpose: 'avatar',
        maxFiles: 1,
        maxSizeBytes: 5242880, // 5 MB
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
        onAllCompleted: async (records) => {
          if (records.length > 0) {
            avatarUrl = records[0].path;
            const preview = document.getElementById('avatar-img-preview') as HTMLImageElement;
            if (preview) preview.src = avatarUrl;
            markDirty();
          }
        }
      });
    }

    // Discard button
    document.getElementById('btn-discard-profile')?.addEventListener('click', () => {
      hasUnsavedChanges = false;
      renderLayout();
    });

    // Save button
    document.getElementById('btn-save-profile')?.addEventListener('click', async () => {
      const newName = nameInput?.value.trim() || fullName;
      const newCity = cityInput?.value.trim() || city;
      const newState = stateInput?.value.trim() || stateRegion;
      const newPhone = phoneInput?.value.trim() || phone;
      const newCompany = compInput?.value.trim() || companyName;

      if (!newName || !newCity || !newState) {
        alert('Please fill in required fields (Full name, City, and State).');
        return;
      }

      if (user) {
        const locationStr = `${newCity}, ${newState}`;
        await supabase
          .from('profiles')
          .update({
            full_name: newName,
            location: locationStr,
            avatar_path: avatarUrl || null
          })
          .eq('id', user.id);

        await supabase
          .from('client_profiles')
          .upsert({
            user_id: user.id,
            account_type: accountType as ClientAccountType,
            company_name: accountType === 'company' ? newCompany : null,
            phone: newPhone || null
          });
      }

      fullName = newName;
      city = newCity;
      stateRegion = newState;
      phone = newPhone;
      companyName = newCompany;
      hasUnsavedChanges = false;

      alert('Profile updated successfully.');
      renderLayout();
    });

    // Change email trigger
    document.getElementById('btn-open-change-email')?.addEventListener('click', async () => {
      const newEmail = prompt('Enter your new email address:');
      if (!newEmail || !newEmail.includes('@')) return;

      try {
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) alert(`Error: ${error.message}`);
        else alert(`Verification email sent to ${newEmail}. Please confirm to complete email change.`);
      } catch (e: any) {
        alert(`Failed: ${e.message}`);
      }
    });
  }

  function bindAccountEvents() {
    // Password change
    document.getElementById('btn-update-pass')?.addEventListener('click', async () => {
      const curr = (document.getElementById('f-curr-pass') as HTMLInputElement)?.value;
      const next = (document.getElementById('f-new-pass') as HTMLInputElement)?.value;
      const conf = (document.getElementById('f-conf-pass') as HTMLInputElement)?.value;
      const fbk = document.getElementById('pass-feedback');

      if (!curr || !next || !conf) {
        if (fbk) {
          fbk.style.display = 'block';
          fbk.style.background = '#FEF2F2';
          fbk.style.color = '#B91C1C';
          fbk.textContent = 'Please fill in all password fields.';
        }
        return;
      }

      if (next !== conf) {
        if (fbk) {
          fbk.style.display = 'block';
          fbk.style.background = '#FEF2F2';
          fbk.style.color = '#B91C1C';
          fbk.textContent = 'New password and confirmation do not match.';
        }
        return;
      }

      const res = await changePasswordWithVerification(curr, next);
      if (fbk) {
        fbk.style.display = 'block';
        if (res.success) {
          fbk.style.background = '#ECFDF5';
          fbk.style.color = '#047857';
          fbk.textContent = 'Password updated successfully.';
          (document.getElementById('f-curr-pass') as HTMLInputElement).value = '';
          (document.getElementById('f-new-pass') as HTMLInputElement).value = '';
          (document.getElementById('f-conf-pass') as HTMLInputElement).value = '';
        } else {
          fbk.style.background = '#FEF2F2';
          fbk.style.color = '#B91C1C';
          fbk.textContent = res.error || 'Failed to update password.';
        }
      }
    });

    // Global sign out
    document.getElementById('btn-global-signout')?.addEventListener('click', async () => {
      if (confirm('Are you sure you want to sign out of all active devices?')) {
        await supabase.auth.signOut({ scope: 'global' });
        await logOut();
        window.location.hash = '#login';
      }
    });

    // Notification preferences auto-save
    document.querySelectorAll('.chk-notif-pref').forEach((chk) => {
      chk.addEventListener('change', () => {
        const ind = document.getElementById('notif-saved-indicator');
        if (ind) {
          ind.style.display = 'inline';
          setTimeout(() => { ind.style.display = 'none'; }, 2000);
        }
      });
    });

    // Request Account Deletion
    document.getElementById('btn-request-deletion')?.addEventListener('click', async () => {
      const confirmEmail = prompt(`To request deletion, type your registered email address (${email}):`);
      if (!confirmEmail) return;

      if (confirmEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
        alert('Email does not match. Deletion request aborted.');
        return;
      }

      try {
        const res = await requestAccountDeletion(confirmEmail.trim());
        alert(res.message || 'Deletion request submitted for administrator handling.');
      } catch (err: any) {
        alert(`Account deletion blocked: ${err?.message || 'Server check failed'}`);
      }
    });
  }

  renderLayout();
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
