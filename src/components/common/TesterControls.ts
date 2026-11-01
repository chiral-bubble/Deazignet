/**
 * Tester Controls Floating Panel for Staging Environment
 * Collapsible panel (bottom-right) accessible strictly to testers (is_tester = true or admin).
 * Provides one-click operational simulations: milestone escrow funding,
 * fast-forwarding 5 or 14 days (security hold / auto-approval), client message simulation, and notification simulation.
 */

import { devFastForward, devSimulateMessage, devSimulateNotification } from '../../services/stagingService';
import { devFundMilestone } from '../../services/activeWorkService';
import { supabase } from '../../lib/supabase';
import { getAuthState } from '../../services/authService';

export function renderTesterControlsTrigger(): string {
  return `
    <button id="btn-toggle-test-controls" type="button" style="height: 38px; padding: 0 14px; background: #FEF3C7; border: 1px solid #F59E0B; color: #92400E; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: Inter, sans-serif;">
      <span>🛠️ Test controls</span>
    </button>
  `;
}

export function initTesterControls(root: HTMLElement = document.body): void {
  let panelHost = document.getElementById('tester-controls-host');
  if (!panelHost) {
    panelHost = document.createElement('div');
    panelHost.id = 'tester-controls-host';
    root.appendChild(panelHost);
  }

  let isOpen = false;

  document.getElementById('btn-toggle-test-controls')?.addEventListener('click', () => {
    isOpen = !isOpen;
    renderPanel();
  });

  function renderPanel() {
    if (!isOpen) {
      panelHost!.innerHTML = '';
      return;
    }

    panelHost!.innerHTML = `
      <div id="test-controls-card" style="position: fixed; bottom: 80px; right: 24px; width: 340px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); padding: 18px; z-index: 999; font-family: Inter, sans-serif;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E5E7EB; padding-bottom: 10px; margin-bottom: 14px;">
          <div>
            <div style="font-size: 14px; font-weight: 600; color: #111827;">Tester Controls</div>
            <div style="font-size: 11px; color: #6B7280;">Staging environment helpers</div>
          </div>
          <button id="btn-close-test-controls" type="button" style="background: transparent; border: none; font-size: 18px; color: #9CA3AF; cursor: pointer;">&times;</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          
          <!-- Control 1: Fund Next Milestone -->
          <div style="border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; background: #F8FAFC;">
            <div style="font-size: 12.5px; font-weight: 600; color: #1E293B;">Fund Next Milestone</div>
            <div style="font-size: 11px; color: #64748B; margin: 2px 0 8px;">Places the next unfunded milestone fee into simulated escrow.</div>
            <button id="tc-btn-fund-milestone" type="button" style="width: 100%; height: 30px; background: #2F7BE5; color: #FFFFFF; border: none; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
              Fund Milestone
            </button>
          </div>

          <!-- Control 2: Fast-Forward 5 Days -->
          <div style="border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; background: #F8FAFC;">
            <div style="font-size: 12.5px; font-weight: 600; color: #1E293B;">Fast-Forward 5 Days</div>
            <div style="font-size: 11px; color: #64748B; margin: 2px 0 8px;">Advances time by 5 days to complete security holds or trigger auto-approval.</div>
            <button id="tc-btn-ff-5" type="button" style="width: 100%; height: 30px; background: #059669; color: #FFFFFF; border: none; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
              Fast-Forward 5 Days
            </button>
          </div>

          <!-- Control 3: Fast-Forward 14 Days -->
          <div style="border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; background: #F8FAFC;">
            <div style="font-size: 12.5px; font-weight: 600; color: #1E293B;">Fast-Forward 14 Days</div>
            <div style="font-size: 11px; color: #64748B; margin: 2px 0 8px;">Advances time by 2 weeks to test milestone expiration and reminder alerts.</div>
            <button id="tc-btn-ff-14" type="button" style="width: 100%; height: 30px; background: #4B5563; color: #FFFFFF; border: none; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
              Fast-Forward 14 Days
            </button>
          </div>

          <!-- Control 4: Simulate Client Message -->
          <div style="border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; background: #F8FAFC;">
            <div style="font-size: 12.5px; font-weight: 600; color: #1E293B;">Simulate Client Message</div>
            <div style="font-size: 11px; color: #64748B; margin: 2px 0 8px;">Sends a realistic client clarification note into the conversation thread.</div>
            <button id="tc-btn-sim-msg" type="button" style="width: 100%; height: 30px; background: #FFFFFF; border: 1px solid #CBD5E1; color: #334155; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
              Send Simulated Message
            </button>
          </div>

          <!-- Control 5: Simulate Notification -->
          <div style="border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; background: #F8FAFC;">
            <div style="font-size: 12.5px; font-weight: 600; color: #1E293B;">Simulate Notification</div>
            <div style="font-size: 11px; color: #64748B; margin: 2px 0 8px;">Triggers a test notification to verify the bell counter and popover.</div>
            <button id="tc-btn-sim-notif" type="button" style="width: 100%; height: 30px; background: #FFFFFF; border: 1px solid #CBD5E1; color: #334155; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
              Trigger Notification
            </button>
          </div>

        </div>
      </div>
    `;

    document.getElementById('btn-close-test-controls')?.addEventListener('click', () => {
      isOpen = false;
      renderPanel();
    });

    // Control 1: Fund Milestone
    document.getElementById('tc-btn-fund-milestone')?.addEventListener('click', async () => {
      try {
        const { data: ms } = await supabase
          .from('engagement_milestones')
          .select('id, name, amount')
          .eq('status', 'awaiting_funding')
          .limit(1)
          .maybeSingle();

        if (!ms?.id) {
          alert('No milestones currently awaiting funding.');
          return;
        }

        await devFundMilestone(ms.id);
        alert(`Funded milestone "${ms.name}" with $${ms.amount}. Funds placed in escrow.`);
        window.location.reload();
      } catch (err: any) {
        alert(`Error funding milestone: ${err?.message}`);
      }
    });

    // Control 2: FF 5 Days
    document.getElementById('tc-btn-ff-5')?.addEventListener('click', async () => {
      try {
        const res = await devFastForward(5);
        alert(`Fast-forwarded 5 days.\nAuto-approved: ${res.auto_approved}\nPayouts released: ${res.payouts_released}`);
        window.location.reload();
      } catch (err: any) {
        alert(`Error: ${err?.message}`);
      }
    });

    // Control 3: FF 14 Days
    document.getElementById('tc-btn-ff-14')?.addEventListener('click', async () => {
      try {
        const res = await devFastForward(14);
        alert(`Fast-forwarded 14 days.\nAuto-approved: ${res.auto_approved}\nPayouts released: ${res.payouts_released}`);
        window.location.reload();
      } catch (err: any) {
        alert(`Error: ${err?.message}`);
      }
    });

    // Control 4: Simulate Message
    document.getElementById('tc-btn-sim-msg')?.addEventListener('click', async () => {
      try {
        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (!conv?.id) {
          alert('No active conversation thread found to simulate message in.');
          return;
        }

        const sampleNote = 'Hello Arc. Adeleke, we have uploaded the revised site survey showing the 3-meter setback requirement.';
        await devSimulateMessage(conv.id, sampleNote);
        alert('Simulated message sent into conversation thread.');
      } catch (err: any) {
        alert(`Error: ${err?.message}`);
      }
    });

    // Control 5: Simulate Notification
    document.getElementById('tc-btn-sim-notif')?.addEventListener('click', async () => {
      const authState = getAuthState();
      if (!authState.user?.id) return;
      try {
        await devSimulateNotification(
          authState.user.id,
          'Test Notification Alert',
          'This is a simulated platform notification for verification of bell badge counter.'
        );
        alert('Notification triggered! Check the top bell icon.');
      } catch (err: any) {
        alert(`Error: ${err?.message}`);
      }
    });
  }
}

