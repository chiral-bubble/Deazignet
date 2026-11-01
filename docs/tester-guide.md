# Dezignet Tester Guide for Architects & Partners (United States)

Welcome to the **Dezignet** test environment. This guide was prepared specifically for our business partner and architectural review team to test the complete client-to-designer lifecycle, evaluate workflows, and provide professional feedback before launch.

---

## 1. About the Test Environment (Staging)

- **Simulated Operations:** All payments, bank payouts, and client escrows are simulated in this environment. No real funds or credit cards are required or charged.
- **Legal Drafts:** Terms of Service and Privacy Policy text are placeholders currently under legal review.
- **Data Isolation:** This staging environment is completely isolated from production. You can freely post projects, test contract scenarios, and approve deliverables.

---

## 2. Test Accounts & Login Credentials

All test accounts share the standard test password (unless overridden via your staging environment variables):

| Role | Email Address | Default Password | Description |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@dezignet.com` | `AdminTest2026!` | Access to the `/admin` area: review tester feedback, verify credentials, edit categories. |
| **Partner (Client)** | `partner.client@dezignet.com` | `TesterPass2026!` | Dr. Eleanor Vance (Austin, TX). Use this to post projects and review proposals. |
| **Partner (Architect)** | `partner.architect@dezignet.com` | `TesterPass2026!` | Marcus Vance, AIA (Austin, TX). NCARB/AIA-verified architect account to submit proposals and milestones. |
| **Partner (Pair 2 Client)**| `partner.client2@dezignet.com` | `TesterPass2026!` | David Miller (Denver, CO). |
| **Partner (Pair 2 Designer)**| `partner.designer2@dezignet.com` | `TesterPass2026!` | Sarah Jenkins (Interior Designer, San Francisco, CA). |
| **New Designer** | `new.designer@dezignet.com` | `Dezignet2026!` | Alex Rivera (Seattle, WA). Fresh un-onboarded designer account to test registration and profile onboarding. |

> **Pro-Tip (Plus-Addressing):** If you wish to create additional test accounts with your own inbox, you can use email plus-addressing (e.g. `yourname+client@yourdomain.com` and `yourname+architect@yourdomain.com`). All verification and system emails will arrive in your main inbox.

---

## 3. Key Test Scenarios & Walkthroughs

### Scenario A: Posting an Architectural Project (as Client)
1. Sign in as `partner.client@dezignet.com`.
2. Navigate to **Post Project** (`/post-project`).
3. **Step 1 — Project Basics:**
   - Select **Category** (e.g. *Residential*) and **Subcategory** (e.g. *Detached house / bungalow*).
   - Select **Professional Needed** chips (e.g. *Architect*, *Engineer*).
4. **Step 2 — Location & Details:**
   - Enter City/State (e.g. *Austin, Texas*).
   - Enter project description and upload site photos or survey sketches.
5. **Step 3 — Scope & Milestone Schedule:**
   - Select **Milestone Phased Payment**.
   - Note the **5 standard phases** (Schematic Design, Design Development, Construction Documents, Bidding & Permitting, Construction Administration) that total 100%.
   - Check the optional **Pre-Design / Site Feasibility** phase to see how the system auto-adjusts to the 6-phase split (100% total).
6. **Step 4 — Review & Publish:**
   - Review all fields and click **Publish Project**.

---

### Scenario B: Submitting a Proposal (as Architect)
1. In another browser tab or Incognito window, sign in as `partner.architect@dezignet.com`.
2. Browse **Find Work / Projects** (`/client-projects`).
3. Open your newly posted project and click **Send Proposal**.
4. **Scope & Terms:**
   - Select standard architectural assumptions using the chip suggestions (*"Client provides site survey & geotechnical report"*, *"Permit statutory fees paid directly by client"*).
   - Set reimbursable expenses (choose between *At Cost*, *Capped*, or *Included*).
   - Review the milestone fee splits and submit the proposal.

---

### Scenario C: Reviewing, Shortlisting & Contracts (as Client)
1. Switch back to your Client account (`partner.client@dezignet.com`).
2. Go to **My Projects** (`/my-projects`) and click into your project.
3. Open the **Proposals** tab:
   - Click **Compare** to view proposals side-by-side.
   - Click **Shortlist** on Marcus Vance's proposal.
   - Click **Accept Proposal** to generate the digital architectural contract.
4. Review the contract terms and add your digital signature to execute the engagement.

---

### Scenario D: Milestone Submissions & Escrow Fast-Forwarding
1. Once contracted, the project transitions into an active engagement.
2. The architect uploads deliverables for **Milestone 1** (drawings, concept sheets).
3. The client can:
   - **Request Revisions** (up to 2 included revisions per phase).
   - **Approve Deliverable**.

---

## 4. Using the Staging "Test Controls" Panel

In the bottom-right corner of the staging site, you will see a floating **🛠️ Test controls** button (available to testers and admins):

- **Fund Milestone:** Instantly simulates placing milestone funds into escrow without real card processing.
- **Fast-Forward 5 Days:** Simulates the passage of 5 days to trigger the end of the post-approval security hold and simulate designer payout release.
- **Fast-Forward 14 Days:** Simulates the 14-day client auto-approval window for submitted deliverables where the client has not responded.
- **Simulate Client Message:** Sends a realistic client inquiry into your active conversation thread to test messaging notifications.
- **Simulate Notification:** Generates a real-time system notification badge.

---

## 5. Submitting In-App Feedback

Whenever you encounter a confusing workflow, a bug, or an architectural suggestion:
1. Click the floating **Send feedback** button in the bottom-right corner.
2. Choose a category:
   - **Something is broken** (bug)
   - **Confusing / Hard to use** (usability)
   - **Suggest a change** (architectural refinement)
   - **Missing feature** (scope addition)
3. Select severity (*Blocker*, *Annoying*, or *Minor*).
4. Enter your feedback and optionally attach a screenshot or PDF.
5. Your browser context, active route, screen resolution, and diagnostic logs will be attached automatically.

---

## 6. Accessing the Admin Area (`/admin`)

Sign in as `admin@dezignet.com` to view:
- **Tester Feedback:** Filter, inspect, and update statuses on all reported feedback items.
- **Pending Credentials:** Review submitted AIA / NCARB / State Licensing Board certificates and approve or reject them with feedback.
- **Categories & Templates:** Inspect active taxonomy and verify standard 5-phase and 6-phase 100% split requirements.
- **Security Audit Log:** Inspect immutable records of all administrative actions.

---

## 7. Professional Review Checklist for Architects

Please review these specific design and practice areas during your walk-through:

- [ ] **Project Categorization:** Does the taxonomy (Residential, Commercial, Institutional, Healthcare, Industrial) and their subcategories cover standard US architectural briefs?
- [ ] **Discipline Requirements:** Is the "Professional needed" multi-select (Architect, Interior Designer, Landscape Architect, Engineer) intuitive?
- [ ] **Milestone Phasing Split:**
  - Standard 5-Phase: Schematic (20%), DD (25%), CD (30%), Bidding (15%), CA (10%).
  - 6-Phase with Feasibility: Pre-Design (10%), Schematic (15%), DD (25%), CD (25%), Bidding (15%), CA (10%).
  - Does this align with standard AIA Document B101 conditions of service?
- [ ] **Contract Assumptions & Reimbursables:** Are standard site exclusions (survey, geotechnical soil report, municipal plan review fees) clear?
- [ ] **Privacy Boundaries:** Confirm that full street addresses remain hidden until after the contract is signed by both parties.
- [ ] **Mobile Experience:** Test the proposal review and milestone submission on your mobile device (at 375px viewport).

---
*For questions or reset requests, please email admin@dezignet.com or report via the in-app feedback tool.*
