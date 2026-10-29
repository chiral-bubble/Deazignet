# Dezignet Designer Platform — Data Model & Architecture Notes

> **Document Status**: Production Pre-Database Audit Specification  
> **Prepared For**: Dezignet Backend Engineering & Database Architecture Migration  
> **Target Scope**: Entire Designer-Side Experience (Dashboard, Client Projects, My Work, Conversations, Payments, Profile Settings, Notifications, Public Profile)

---

## 1. Entities & Data Schema

This section documents every entity utilized across the Dezignet designer application, including field types, nullability/optionality, and the pages where each field is read or mutated.

### 1.1. `DesignerProfile`
*Primary account entity representing the authenticated designer and public atelier page.*

| Field | Type | Required | Used On Pages | Description / Constraints |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `string` (UUID) | Yes | All Pages | Unique identifier (`des-1`, etc.). |
| `name` | `string` | Yes | Dashboard, Profile Settings, Public Profile, Topbar | Full professional name. |
| `avatarUrl` | `string` (URL) | No | Topbar, Sidebar, Profile Settings, Public Profile | Profile photograph. If empty, falls back to uppercase initials. |
| `professionalTitle` | `string` | Yes | Sidebar, Profile Settings, Public Profile, Talent Search | Professional headline (e.g., "Principal Architect & Urban Designer"). |
| `professionalType` | `enum` | Yes | Profile Settings, Talent Search, Public Profile | `'Architect' \| 'Interior Designer' \| 'Landscape Architect' \| 'Engineer'`. |
| `companyName` | `string` | No | Profile Settings, Public Profile, Talent Search | Studio or firm trading entity name. |
| `location` | `object` | Yes | Profile Settings, Public Profile, Talent Search | `{ city: string, state: string, country: string }`. |
| `email` | `string` | Yes | Profile Settings (Private), Account Security | Authenticated private email address. **Never displayed publicly**. |
| `phone` | `string` | No | Profile Settings (Private) | Kept strictly private for escrow / security alerts. |
| `languages` | `string[]` | Yes | Profile Settings, Public Profile | Spoken and documentation languages. |
| `yearsOfExperience` | `number` | Yes | Profile Settings, Public Profile, Talent Search | Non-negative integer. |
| `about` | `string` | Yes | Profile Settings, Public Profile | Long-form practice narrative and design ethos. |
| `specializations` | `string[]` | Yes | Profile Settings, Public Profile, Talent Search | Array of architectural taxonomy tags (e.g., Residential, Sustainable, BIM). |
| `hourlyRate` | `number` | Yes | Profile Settings, Public Profile, Talent Search | Hourly billing rate in USD. |
| `hideRateFromPeers` | `boolean` | No | Profile Settings, Talent Search, Public Profile | Privacy setting to suppress hourly rate when viewed by other designers. |
| `showInSearch` | `boolean` | No | Profile Settings, Talent Search | Search discovery index toggle. |
| `isAvailableForProjects`| `boolean` | Yes | Profile Settings, Public Profile, Talent Search | Commission availability toggle. |
| `availabilityNote` | `string` | No | Profile Settings, Public Profile | Supporting availability status note. |
| `memberSince` | `string` | Yes | Public Profile, Profile Settings | Account registration date. |
| `stats` | `object` | Yes | Public Profile, Talent Search | `{ projectsCompleted: number, averageRating: number, reviewCount: number, responseTime: string }`. |
| `currentPlanId` | `enum` | Yes | Profile Settings, Payments (Plan Tab), Proposals | `'free' \| 'basic' \| 'upgraded'`. |
| `planBillingCycle` | `enum` | Yes | Payments (Plan Tab) | `'monthly' \| 'yearly'`. |
| `hasActiveProjectsOrEscrow`| `boolean` | Yes | Account Deletion Guard | Prevents deletion if active funds or contracts exist. |
| `credentials` | `CredentialItem[]`| Yes | Profile Settings, Public Profile | Array of accredited professional licenses. |
| `portfolio` | `PortfolioProject[]`| Yes | Profile Settings, Public Profile, Proposal Drawer | Showcase commissions and built case studies. |
| `reviews` | `ClientReview[]` | Yes | Public Profile | Verified client testimonials. |
| `payoutAccounts` | `PayoutAccount[]` | Yes | Payments, Profile Settings | Linked withdrawal bank accounts. |
| `invoices` | `InvoiceItem[]` | Yes | Payments (Transactions & Overview) | Downloadable tax receipts and fee invoices. |
| `sessions` | `ActiveSession[]` | Yes | Profile Settings (Account Tab) | Active authenticated client devices and locations. |
| `notifications` | `NotificationPrefs`| Yes | Profile Settings (Account Tab) | Channel preferences `{ email: {...}, inApp: {...} }`. |

---

### 1.2. `Project` (Client Commissions)
*Marketplace commissions posted by clients for bidding.*

| Field | Type | Required | Used On Pages | Description / Constraints |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `string` (UUID) | Yes | Client Projects, Project Details, Proposal Drawer | Unique identifier. |
| `title` | `string` | Yes | Client Projects, Project Details, Proposal Drawer | Commission project title. |
| `category` | `string` | Yes | Client Projects, Project Details | Primary classification (e.g., Residential). |
| `subcategory` | `string` | Yes | Client Projects, Project Details | Specific typology (e.g., Contemporary Villa). |
| `budget` | `number` | Yes | Client Projects, Project Details, Proposal Drawer | Client target budget in USD. |
| `paymentType` | `enum` | Yes | Client Projects, Project Details, Proposal Drawer | `'Milestone' \| 'Hourly'`. |
| `timeline` | `string` | Yes | Client Projects, Project Details | Estimated delivery timeline (e.g., "18 Weeks"). |
| `deadline` | `string` | Yes | Client Projects, Project Details | Bid closing deadline. |
| `postedDate` | `string` | Yes | Client Projects, Project Details | Date commission was published. |
| `area` | `number` | Yes | Client Projects, Project Details | Architectural square footage. |
| `location` | `string` | Yes | Client Projects, Project Details | Geographic site location. |
| `description` | `string` | Yes | Client Projects, Project Details | Complete architectural brief and scope of work. |
| `client` | `ClientSummary` | Yes | Project Details, Proposal Drawer | Client profile facts (name, company, memberSince, paymentVerified). **Strictly no email or phone**. |
| `referenceImages` | `ReferenceImage[]`| No | Project Details (Lightbox) | Client reference photographs and site plans. |
| `milestones` | `MilestonePhase[]` | No | Project Details, Proposal Drawer | Phased milestone schedule (if paymentType is `'Milestone'`). |
| `hourlyRate` | `number` | No | Project Details, Proposal Drawer | Target hourly rate (if paymentType is `'Hourly'`). |
| `estimatedHours` | `number` | No | Project Details, Proposal Drawer | Estimated total billable hours. |
| `proposalsCount` | `number` | Yes | Client Projects, Project Details | Total submissions received. |
| `status` | `enum` | Yes | Client Projects, Project Details | `'Open' \| 'Under Review' \| 'Awarded' \| 'Closed'`. |
| `hasApplied` | `boolean` | Yes | Client Projects, Project Details | Indicates whether logged designer has submitted a bid. |
| `appliedProposalId` | `string` | No | Project Details, My Work | References designer's active proposal ID. |
| `isSaved` | `boolean` | Yes | Client Projects, Project Details | Bookmark state for designer. |

---

### 1.3. `Proposal` (Designer Submissions)
*Proposals submitted by designers on client commissions.*

| Field | Type | Required | Used On Pages | Description / Constraints |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `string` (UUID) | Yes | My Work (Proposals), Dashboard, Proposal Drawer | Unique submission identifier. |
| `projectId` | `string` (UUID) | Yes | My Work, Dashboard, Proposal Drawer | Target commission ID. |
| `projectTitle` | `string` | Yes | My Work, Dashboard | Commission title. |
| `clientName` | `string` | Yes | My Work, Dashboard | Client contact name. |
| `clientLocation` | `string` | Yes | My Work | Client geographic location. |
| `paymentType` | `enum` | Yes | My Work, Proposal Drawer | `'Milestone' \| 'Hourly'`. |
| `proposedPrice` | `number` | Yes | My Work, Dashboard, Proposal Drawer | Proposed total price in USD. |
| `clientBudget` | `number` | Yes | My Work | Original client budget for comparison. |
| `deliveryTime` | `string` | Yes | My Work, Proposal Drawer | Proposed delivery duration. |
| `sentDate` | `string` | Yes | My Work, Dashboard | Submission timestamp. |
| `status` | `enum` | Yes | My Work, Dashboard | `'pending' \| 'viewed' \| 'shortlisted' \| 'accepted' \| 'declined' \| 'withdrawn'`. |
| `statusHint` | `string` | No | My Work | Explanatory subtext (e.g., "Client viewed 2 days ago"). |
| `coverLetter` | `string` | Yes | My Work, Proposal Drawer | Proposal narrative and studio introduction. |
| `phases` | `MilestonePhase[]` | No | My Work, Proposal Drawer | Milestone phased fee breakdown. |
| `hourlyRate` | `number` | No | My Work, Proposal Drawer | Proposed rate per hour (if hourly). |
| `estimatedHours` | `number` | No | My Work, Proposal Drawer | Proposed hours total. |
| `attachments` | `Attachment[]` | No | My Work, Proposal Drawer | Selected portfolio items or uploaded drawings. |
| `clientQuestions` | `string` | No | My Work, Proposal Drawer | Answers to client technical brief queries. |
| `editCount` | `number` | Yes | My Work (Proposals) | Number of times proposal was modified before review. |
| `declinedReason` | `string` | No | My Work | Client feedback explanation if declined. |
| `withdrawnReason` | `string` | No | My Work | Designer's retracted reason. |

---

### 1.4. `ActiveProject` (Awarded Workspaces)
*Contracts currently active with milestones, deliverables, and billing.*

| Field | Type | Required | Used On Pages | Description / Constraints |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `string` (UUID) | Yes | My Work (Projects), Dashboard | Contract identifier. |
| `projectId` | `string` (UUID) | Yes | My Work, Dashboard | Original commission ID. |
| `title` | `string` | Yes | My Work, Dashboard | Project title. |
| `clientId` | `string` (UUID) | Yes | My Work, Dashboard | Client entity reference. |
| `clientName` | `string` | Yes | My Work, Dashboard | Client contact name. |
| `clientCompany` | `string` | No | My Work, Dashboard | Client organization. |
| `clientLocation` | `string` | Yes | My Work, Dashboard | Project / client location. |
| `paymentType` | `enum` | Yes | My Work, Dashboard | `'Milestone' \| 'Hourly'`. |
| `status` | `enum` | Yes | My Work, Dashboard | `'awaiting_deliverable' \| 'in_review' \| 'approved_released' \| 'active_hourly'`. |
| `statusLabel` | `string` | Yes | My Work, Dashboard | UI status display string. |
| `category` | `string` | Yes | My Work, Dashboard | Architectural typology. |
| `totalBudget` | `number` | Yes | My Work, Dashboard | Total contracted value in USD. |
| `inEscrowAmount` | `number` | Yes | My Work, Dashboard, Payments | Funds presently locked in platform escrow. |
| `milestones` | `MilestoneItem[]` | No | My Work (Workspace Tab 2), Dashboard | Milestone deliverables, submission status, and approvals. |
| `hoursThisWeek` | `number` | No | My Work, Dashboard | Logged hours for current billing week. |
| `hourlyRate` | `number` | No | My Work, Dashboard | Approved hourly contract rate. |
| `unbilledAmount` | `number` | No | My Work, Dashboard | Accrued unbilled balance. |
| `totalHoursLogged` | `number` | No | My Work, Dashboard | Lifetime project hours. |

---

### 1.5. `Transaction` & `BalanceLedger`
*Financial accounting records.*

| Field | Type | Required | Used On Pages | Description / Constraints |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `string` (UUID) | Yes | Payments (Transactions, Overview), Dashboard | Unique transaction ID. |
| `referenceId` | `string` | Yes | Payments, Transaction Drawer | Public reference string (`DEZ-TX-84920`). |
| `date` | `string` | Yes | Payments, Dashboard | Transaction settlement date. |
| `description` | `string` | Yes | Payments, Dashboard | Ledger description. |
| `projectId` | `string` (UUID) | No | Payments, Transaction Drawer | Associated commission. |
| `projectName` | `string` | No | Payments, Transaction Drawer | Associated project name. |
| `milestoneTitle` | `string` | No | Payments, Transaction Drawer | Associated milestone. |
| `type` | `enum` | Yes | Payments (Filter & Table) | `'Milestone released' \| 'Hourly invoice paid' \| 'Withdrawal' \| 'Plan charge'`. |
| `grossAmount` | `number` | Yes | Payments, Transaction Drawer | Gross currency amount (positive for inflows, negative for outflows). |
| `feePercentage` | `number` | Yes | Payments, Transaction Drawer | Platform fee percentage applied. |
| `feeAmount` | `number` | Yes | Payments, Transaction Drawer | Platform fee dollar deduction. |
| `netAmount` | `number` | Yes | Payments, Balance Computations | Net credited / debited amount. |
| `status` | `enum` | Yes | Payments, Transaction Drawer | `'Completed' \| 'Held' \| 'Pending' \| 'Failed'`. |
| `statusNote` | `string` | No | Transaction Drawer | Explanatory note (e.g., escrow lock reasons). |
| `payoutAccountMasked`| `string` | No | Payments, Transaction Drawer | Destination bank account mask. |
| `timeline` | `AuditStep[]` | Yes | Transaction Drawer | Settlement progression steps. |

---

### 1.6. `Conversation` & `Message`
*Project and commission thread messaging.*

| Field | Type | Required | Used On Pages | Description / Constraints |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `string` (UUID) | Yes | Conversations | Thread identifier. |
| `peerId` | `string` (UUID) | Yes | Conversations | Client user ID. |
| `peerName` | `string` | Yes | Conversations | Client name. |
| `peerRole` | `string` | Yes | Conversations | Client organization / role. |
| `lastMessage` | `string` | Yes | Conversations | Snippet for thread preview. |
| `lastMessageTime` | `string` | Yes | Conversations | Relative timestamp. |
| `unreadCount` | `number` | Yes | Conversations, Sidebar Badge | Unread message counter. |
| `isOnline` | `boolean` | Yes | Conversations | Real-time presence indicator. |
| `projectId` | `string` (UUID) | No | Conversations | Linked project context. |
| `projectTitle` | `string` | No | Conversations | Linked project title. |
| `proposalId` | `string` (UUID) | No | Conversations | Linked proposal context. |
| `isMuted` | `boolean` | Yes | Conversations | Mute thread alerts toggle. |
| `isArchived` | `boolean` | Yes | Conversations | Archive thread toggle. |
| **`Message` Fields** | | | | |
| `id` | `string` (UUID) | Yes | Conversation Thread | Message identifier. |
| `conversationId` | `string` (UUID) | Yes | Conversation Thread | Parent thread. |
| `senderId` | `string` (UUID) | Yes | Conversation Thread | Sender ID. |
| `senderRole` | `enum` | Yes | Conversation Thread | `'client' \| 'designer' \| 'system'`. |
| `text` | `string` | Yes | Conversation Thread | Message body. Filtered for off-platform contact terms. |
| `timestamp` | `string` | Yes | Conversation Thread | Creation timestamp. |
| `isRead` | `boolean` | Yes | Conversation Thread | Read receipt flag. |
| `attachmentUrl` | `string` (URL) | No | Conversation Thread | PDF / CAD drawing attachment. |

---

### 1.7. `Notification`
*System, escrow, and proposal notifications.*

| Field | Type | Required | Used On Pages | Description / Constraints |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `string` (UUID) | Yes | Notifications Page, Topbar Bell Dropdown | Unique notice identifier. |
| `type` | `NotificationTypeKey` | Yes | Notifications Page, Bell Dropdown | One of 15 centralized notification keys. |
| `title` | `string` | Yes | Notifications Page, Bell Dropdown | Header text. |
| `detail` | `string` | Yes | Notifications Page, Bell Dropdown | One-line explanation. |
| `relativeTime` | `string` | Yes | Notifications Page, Bell Dropdown | Formatted time string. |
| `isUnread` | `boolean` | Yes | Notifications Page, Bell Dropdown, Badges | Unread indicator state. |
| `destinationUrl` | `string` | Yes | Notifications Page, Bell Dropdown, Toasts | Route navigated to on click. |
| `payload` | `object` | No | Notifications Service | Dynamic context (`proposalId`, `projectId`, `transactionId`). |

---

## 2. Service Layer API Specifications

| Service Function | Input Arguments | Output Return Type | Description |
| :--- | :--- | :--- | :--- |
| **`designerDashboardService`** | | | |
| `getDesignerSummary` | `()` | `Promise<DesignerSummary>` | Returns active project counts, deadlines due, pending proposals, escrow amount, and total earned. |
| `getActiveProjects` | `(filter?: 'all' \| 'milestone' \| 'hourly')` | `Promise<ActiveProject[]>` | Retrieves current designer projects with filter applied. |
| `getNotifications` | `()` | `Promise<DesignerNotification[]>` | Returns recent notifications for dashboard card. |
| `getPayments` | `()` | `Promise<DesignerPaymentsSummary>` | Returns available, pending, and total earned balances. |
| `getUpcomingDeadlines`| `()` | `Promise<UpcomingDeadline[]>` | Returns nearest milestone dates and weekly time submission deadlines. |
| `getRecentProposals` | `()` | `Promise<RecentProposalItem[]>` | Returns latest submitted bids for dashboard table. |
| `getProfileCompleteness`| `()` | `Promise<ProfileCompleteness>` | Computes profile completeness percentage and missing items. |
| `uploadDeliverable` | `(projectId: string, title: string)` | `Promise<boolean>` | Submits milestone package and notifies client. |
| `requestMilestoneReview`| `(projectId: string)` | `Promise<boolean>` | Dispatches review reminder to client. |
| `logHourlyTime` | `(projectId: string, hours: number)` | `Promise<boolean>` | Adds billable time and recalculates unbilled total. |
| `withdrawFunds` | `(amount: number)` | `Promise<{ success: boolean; message: string }>` | Dispatches withdrawal to default payout account. |
| **`projectsService`** | | | |
| `getProjects` | `(filters?: ProjectFiltersState)` | `Promise<Project[]>` | Searches commission marketplace with category, budget, and location filters. |
| `getProject` | `(id: string)` | `Promise<Project \| null>` | Returns full project specification, brief, and reference images. |
| `getProposalDraft` | `(projectId: string)` | `ProposalDraft \| null` | Restores local proposal draft form state. |
| `saveProposalDraft` | `(projectId: string, draft: ProposalDraft)` | `void` | Autosaves work-in-progress bid. |
| `submitProposal` | `(sub: ProposalSubmission)` | `Promise<{ success: boolean; proposalId?: string; error?: string }>` | Submits finalized bid and advances project proposals count. |
| `toggleSaveProject` | `(projectId: string)` | `boolean` | Toggles bookmark for commission. |
| **`proposalsService`** | | | |
| `getProposals` | `(statusFilter?: string)` | `Promise<SharedProposal[]>` | Returns all proposals submitted by designer with filter counts. |
| `getProposal` | `(id: string)` | `Promise<SharedProposal \| null>` | Retrieves single proposal details, timeline, and phased fee breakdown. |
| `withdrawProposal` | `(id: string)` | `Promise<boolean>` | Retracts bid and marks status as withdrawn. |
| `editProposal` | `(id: string, updates: Partial<SharedProposal>)`| `Promise<boolean>` | Updates proposal prior to client review. |
| `getProposalUsage` | `()` | `Promise<ProposalUsage>` | Returns plan proposal quota and remaining submissions for cycle. |
| **`paymentsService`** | | | |
| `getPaymentsOverview` | `()` | `Promise<PaymentsOverviewData>` | Returns balance breakdown, upcoming milestones, recent ledger rows, and account status. |
| `getTransactions` | `(filters?: TransactionFilterOptions)` | `Promise<SharedTransaction[]>` | Returns financial ledger with type, status, and search filters. |
| `getPayoutAccounts` | `()` | `Promise<SharedPayoutAccount[]>` | Lists linked bank accounts with masked numbers. |
| `addPayoutAccount` | `(data: { bankName: string; accountNumber: string; accountName: string })` | `Promise<SharedPayoutAccount>` | Validates routing and adds linked bank destination. |
| `setDefaultPayoutAccount`| `(id: string)` | `Promise<void>` | Sets primary disbursement account. |
| `removePayoutAccount` | `(id: string)` | `Promise<void>` | Removes linked bank account. |
| `getWithdrawals` | `()` | `Promise<SharedWithdrawal[]>` | Returns withdrawal disbursement log. |
| `requestWithdrawal` | `(amount: number, accountId: string)` | `Promise<{ success: boolean; error?: string }>` | Dispatches wire payout and debits available balance. |
| `getPlanState` | `()` | `Promise<SharedPlanState>` | Returns designer's current Dezignet Studio subscription tier and card. |
| `updatePlanSubscription`| `(tier: 'free' \| 'basic' \| 'upgraded', cycle: 'monthly' \| 'yearly')` | `Promise<void>` | Updates platform tier. |
| `updatePlanPaymentCard`| `(data: CardData)` | `Promise<void>` | Updates billing payment method. |
| **`conversationsService`** | | | |
| `getConversations` | `()` | `Promise<SharedConversation[]>` | Lists message threads sorted by recency. |
| `getConversationThread`| `(id: string)` | `Promise<{ conversation: SharedConversation; messages: SharedMessage[] }>` | Returns thread metadata and message history. |
| `sendMessage` | `(conversationId: string, text: string, attachment?: File)` | `Promise<SharedMessage>` | Sends message, performs off-platform safety check, and appends to thread. |
| `markConversationAsRead`| `(id: string)` | `Promise<void>` | Clears unread messages for conversation. |
| `toggleMuteConversation`| `(id: string)` | `Promise<boolean>` | Toggles thread mute status. |
| `toggleArchiveConversation`| `(id: string)` | `Promise<boolean>` | Toggles thread archive state. |
| `getUnreadMessagesCount`| `()` | `number` | Returns total unread messages across all threads for sidebar badge. |
| **`notificationsService`** | | | |
| `getNotifications` | `(filters?: { tab?: 'all' \| 'unread'; category?: string; limit?: number })` | `Promise<{ notifications: NotificationItem[]; totalCount: number }>` | Returns notifications with date groupings. |
| `markAsRead` | `(id: string)` | `Promise<void>` | Sets notification `isUnread: false`. |
| `markAllAsRead` | `()` | `Promise<void>` | Marks all notifications as read. |
| `deleteNotification` | `(id: string)` | `Promise<boolean>` | Soft-deletes notification with undo stack support. |
| `undoDeleteNotification`| `(id: string)` | `Promise<boolean>` | Restores previously deleted notification. |
| `getUnreadNotificationsCount`| `()` | `{ count: number; display: string }` | Returns unread badge counter (`9+` cap). |
| **`designerProfileService`** | | | |
| `getProfile` | `(id: string)` | `Promise<DesignerProfile \| null>` | Retrieves full profile with credentials and portfolio. |
| `updateProfile` | `(id: string, updates: Partial<DesignerProfile>)` | `Promise<DesignerProfile>` | Persists profile settings changes. |
| `changePassword` | `(currentPass: string, newPass: string)` | `Promise<{ success: boolean; error?: string }>` | Verifies current credentials and sets new password. |
| `deleteAccount` | `(emailConfirm: string)` | `Promise<{ success: boolean; error?: string }>` | Verifies active projects/escrow guard and executes account deletion. |
| `getPublicProfile` | `(id: string)` | `Promise<PublicDesignerProfile \| null>` | Returns sanitized public atelier data. |
| `uploadPortfolioItem`| `(item: PortfolioProjectInput)` | `Promise<PortfolioProject>` | Adds or edits showcase project. |
| `deletePortfolioItem`| `(itemId: string)` | `Promise<boolean>` | Removes showcase project. |

---

## 3. Platform Configuration Values (To Move to Admin Settings)

These configuration parameters are currently defined in client-side code and must be extracted into database-driven system settings:

1. **Platform Escrow Fee**:
   - `escrowFeePercentage`: `2.5%` (Applied on milestone release and hourly timesheet approval).
   - `proposalPlatformFeePercentage`: `10.0%` (Displayed during proposal submission step 1).
2. **Withdrawal Limits & Timing**:
   - `minimumWithdrawalAmount`: `$50.00` USD.
   - `payoutProcessingTimeText`: `"1-2 business days"`.
   - `maximumSingleWithdrawal`: `$100,000.00` USD (Requires secondary KYC).
3. **Plan Tiers & Submission Quotas**:
   - `free`: 5 proposal submissions per calendar month; 10 active portfolio case studies; standard support.
   - `basic`: 25 proposal submissions per month ($29/mo or $290/yr); 20 portfolio case studies; verified badge.
   - `upgraded`: Unlimited proposal submissions ($49/mo or $480/yr); unlimited portfolio case studies; zero commission surcharge, top priority talent search ranking.
4. **Deliverable & Asset Limits**:
   - `maxDeliverableUploadSize`: `250 MB`.
   - `maxAvatarUploadSize`: `5 MB`.
   - `maxPortfolioImagesPerProject`: `12 images`.
   - `allowedDeliverableExtensions`: `['.pdf', '.dwg', '.dxf', '.ifc', '.rvt', '.zip']`.
   - `allowedImageExtensions`: `['.jpg', '.jpeg', '.png', '.webp']`.
5. **Contract Milestones & Revisions**:
   - `standardRevisionsIncluded`: `2` per architectural milestone.
   - `escrowInactivityAutoReleaseDays`: `14 days` after unreviewed deliverable submission.

---

## 4. UI-Computed Logic To Migrate to Server Calculations

The following computations are currently handled in browser JavaScript and must be performed on the backend to guarantee security and data integrity:

1. **Balance Ledger Totals**:
   - `totalEarned`: Sum of all completed milestone releases and approved hourly payouts.
   - `availableToWithdraw`: Lifetime net earnings minus completed withdrawals and plan charges.
   - `pendingRelease`: Sum of milestone transactions with status `'Held'` or in client review.
   - `inEscrow`: Sum of client funds currently deposited in escrow for active milestone phases.
2. **Fee Deductions & Net Payouts**:
   - Calculation of `feeAmount = grossAmount * (feePercentage / 100)` and `netAmount = grossAmount - feeAmount`.
3. **Badge Counters**:
   - Unread message count across active threads.
   - Unread notification count.
   - Actionable attention counts (projects with deliverables due or milestones in review).
4. **Proposal Quotas**:
   - Monthly proposal count enforcement based on active subscription tier.
5. **Profile Completeness Percentage**:
   - Weighted score evaluation (Photo 15%, Bio 20%, Specializations 15%, Credentials 25%, Portfolio 25%).
6. **Safety & Off-Platform Keyword Scanning**:
   - Scanning message texts for phone numbers, personal emails, and off-platform payment solicitations.

---

## 5. Mock-Only Behaviors Requiring Real Backend Infrastructure

1. **Real-Time Messaging & Presence**:
   - Replace simulated polling with WebSocket or Server-Sent Events (SSE) connections for instant message transmission, typing indicators, and peer online status.
2. **Cloud Storage & Pre-signed Uploads**:
   - Direct-to-bucket uploads (AWS S3 / Google Cloud Storage) with signed URLs for large CAD files (up to 250MB) and portfolio imagery.
3. **Payment Processor & Escrow Banking**:
   - Real-time escrow holds, milestone releases, and automated bank wires via Stripe Connect / Wise Payouts / Plaid.
4. **Identity & Credential Verification**:
   - Automated routing and license check verification against official architectural regulatory registries (AIA, RIBA, SIA, NCARB).
5. **Transactional Email & Push Notifications**:
   - Webhook-triggered email dispatches (SendGrid / Postmark) for proposal acceptances, escrow releases, and unread message summaries.

