import { createClient } from '@supabase/supabase-js';
import { sharedDataset } from '../src/mocks/dataset';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hnssctjagfwdfbagpikv.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhuc3NjdGphZ2Z3ZGZiYWdwaWt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzIyNjk5MywiZXhwIjoyMTA4ODAyOTkzfQ.uAygYR2rR2DDk_oRt1OgO-59VpnTCbfbpwU2lk-z8CQ';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function seed() {
  console.log('Seeding Supabase database with shared dataset...');

  // 1. Seed Main Designer
  const designerId = 'des-alexandre';
  const designerData = {
    id: designerId,
    name: 'Alexandre Sterling',
    avatar_url: '/assets/avatars/alexandre.jpg',
    professional_title: 'Principal Architect & Urban Designer',
    professional_type: 'Architect',
    company_name: 'Studio Sterling Architecture',
    location: { city: 'Zurich', country: 'Switzerland' },
    email: 'alexandre@sterling-atelier.ch',
    phone: '+41 44 123 4567',
    languages: ['English', 'German', 'French', 'Italian'],
    years_of_experience: 14,
    about: 'Specializing in residential cantilevers, sustainable facades, and precision timber engineering across the Alpine and European landscape.',
    specializations: ['Residential', 'Sustainable', 'Timber Engineering', 'BIM Masterplanning'],
    hourly_rate: 185.00,
    hide_rate_from_peers: false,
    show_in_search: true,
    is_available_for_projects: true,
    availability_note: 'Available for selected private commissions and competition design consultancies.',
    member_since: 'March 2021',
    stats: {
      projectsCompleted: 24,
      averageRating: 4.96,
      reviewCount: 18,
      responseTime: '< 1 hour'
    },
    current_plan_id: 'upgraded',
    plan_billing_cycle: 'yearly'
  };

  const { error: desErr } = await supabase.from('designers').upsert(designerData);
  if (desErr) console.error('Error seeding designer:', desErr);
  else console.log('✓ Seeded designer profile');

  // 2. Seed Designer Balances
  const balancesData = {
    designer_id: designerId,
    available_to_withdraw: sharedDataset.balances.availableToWithdraw,
    pending_release: sharedDataset.balances.pendingRelease,
    in_escrow: sharedDataset.balances.inEscrow,
    total_earned: sharedDataset.balances.totalEarned
  };
  const { error: balErr } = await supabase.from('designer_balances').upsert(balancesData);
  if (balErr) console.error('Error seeding balances:', balErr);
  else console.log('✓ Seeded designer balances');

  // 3. Seed Marketplace Projects (including historical projects for proposals)
  const projectsData = sharedDataset.projects.map((p) => {
    const client = sharedDataset.clients.find((c) => c.id === p.clientId) || {
      name: p.clientName,
      company: p.clientCompany,
      location: p.clientLocation,
      memberSince: '2023',
      paymentMethodVerified: true
    };

    return {
      id: p.id,
      title: p.title,
      category: p.category,
      subcategory: p.facts?.propertyType || 'Architecture',
      budget: p.budget,
      payment_type: p.paymentType,
      timeline: p.facts?.estimatedDuration || '3 months',
      deadline: p.deadline,
      posted_date: '2026-10-20',
      area: 500,
      location: p.location,
      description: p.fullDescription || p.shortDescription,
      client,
      reference_images: [],
      milestones: [],
      hourly_rate: p.paymentType === 'Hourly' ? 150 : null,
      estimated_hours: p.paymentType === 'Hourly' ? 120 : null,
      proposals_count: 4,
      status: p.status === 'open' ? 'Open' : 'Awarded'
    };
  });

  // Add historical stub projects so all proposals satisfy the foreign key
  const historicalProjects = [
    {
      id: 'proj-old-1',
      title: 'Historical Civic Pavilion',
      category: 'Civic',
      subcategory: 'Pavilion',
      budget: 80000,
      payment_type: 'Milestone',
      timeline: '6 months',
      deadline: '2026-08-01',
      posted_date: '2026-06-01',
      area: 800,
      location: 'Rotterdam, Netherlands',
      description: 'Historical completed project.',
      client: { name: 'Municipality of Rotterdam', location: 'Netherlands' },
      reference_images: [],
      milestones: [],
      proposals_count: 0,
      status: 'Closed'
    },
    {
      id: 'proj-old-2',
      title: 'Luxury Compound Extension',
      category: 'Residential',
      subcategory: 'Private Estate',
      budget: 55000,
      payment_type: 'Milestone',
      timeline: '3 months',
      deadline: '2026-08-15',
      posted_date: '2026-07-01',
      area: 600,
      location: 'London, UK',
      description: 'Withdrawn proposal commission.',
      client: { name: 'Senator M. Peters', location: 'London' },
      reference_images: [],
      milestones: [],
      proposals_count: 0,
      status: 'Closed'
    }
  ];

  const allProjects = [...projectsData, ...historicalProjects];
  const { error: projErr } = await supabase.from('projects').upsert(allProjects);
  if (projErr) console.error('Error seeding projects:', projErr);
  else console.log(`✓ Seeded ${allProjects.length} marketplace & historical projects`);

  // 4. Seed Proposals
  const proposalsData = sharedDataset.proposals.map((pr) => ({
    id: pr.id,
    project_id: pr.projectId,
    designer_id: designerId,
    project_title: pr.projectTitle,
    client_name: pr.clientName,
    client_location: pr.clientLocation,
    payment_type: pr.paymentType,
    proposed_price: pr.proposedPrice,
    client_budget: pr.clientBudget || null,
    delivery_time: pr.deliveryTime,
    sent_date: pr.sentDate,
    status: pr.status,
    status_hint: pr.statusHint || null,
    cover_letter: pr.coverLetter,
    phases: pr.phases || [],
    hourly_rate: pr.hourlyRate || null
  }));

  const { error: propErr } = await supabase.from('proposals').upsert(proposalsData);
  if (propErr) console.error('Error seeding proposals:', propErr);
  else console.log(`✓ Seeded ${proposalsData.length} proposals`);

  // 5. Seed Active Projects
  const activeProjectsData = sharedDataset.activeProjects.map((ap) => ({
    id: ap.id,
    designer_id: designerId,
    title: ap.title,
    client_name: ap.clientName,
    client_company: ap.clientCompany || null,
    client_location: ap.clientLocation,
    payment_type: ap.paymentType,
    status: ap.status,
    status_label: ap.statusLabel,
    category: ap.category,
    milestones: ap.milestones || [],
    current_milestone_name: ap.currentMilestoneName || null,
    completed_milestones_count: ap.completedMilestonesCount || 0,
    total_milestones_count: ap.totalMilestonesCount || 0,
    next_deadline: ap.nextDeadline || null,
    relative_deadline: ap.relativeDeadline || null,
    escrow_current_milestone: ap.escrowCurrentMilestone || 0,
    is_deliverable_due: ap.isDeliverableDue || false,
    has_uploaded_deliverable: ap.hasUploadedDeliverable || false,
    awaiting_review: ap.awaitingReview || false,
    hours_this_week: ap.hoursThisWeek || 0,
    hourly_rate: ap.hourlyRate || 0,
    unbilled_amount: ap.unbilledAmount || 0,
    total_hours_logged: ap.totalHoursLogged || 0
  }));

  const { error: apErr } = await supabase.from('active_projects').upsert(activeProjectsData);
  if (apErr) console.error('Error seeding active projects:', apErr);
  else console.log(`✓ Seeded ${activeProjectsData.length} active projects`);

  // 6. Seed Transactions
  const txData = sharedDataset.transactions.map((tx) => ({
    id: tx.id,
    designer_id: designerId,
    date: tx.date,
    type: tx.type,
    description: tx.description,
    project_title: tx.projectName || null,
    client_name: null,
    amount: Math.abs(tx.grossAmount || tx.netAmount || 0),
    fee: tx.feeAmount || 0,
    net_amount: tx.netAmount,
    status: tx.status,
    reference: tx.referenceId || tx.id
  }));

  const { error: txErr } = await supabase.from('transactions').upsert(txData);
  if (txErr) console.error('Error seeding transactions:', txErr);
  else console.log(`✓ Seeded ${txData.length} transactions`);

  // 7. Seed Payout Accounts
  const payoutData = sharedDataset.payoutAccounts.map((pa) => ({
    id: pa.id,
    designer_id: designerId,
    type: 'bank_account',
    bank_name: pa.bankName,
    account_name: pa.accountName,
    account_number_masked: pa.accountNumberMasked,
    routing_number: '021000021',
    currency: pa.currency || 'USD',
    country: 'CH',
    is_primary: pa.isDefault || false,
    is_verified: pa.verificationStatus === 'Verified'
  }));

  const { error: paErr } = await supabase.from('payout_accounts').upsert(payoutData);
  if (paErr) console.error('Error seeding payout accounts:', paErr);
  else console.log(`✓ Seeded ${payoutData.length} payout accounts`);

  // 8. Seed Invoices
  const invoicesData = [
    {
      id: 'inv-1',
      designer_id: designerId,
      invoice_number: 'INV-DEZ-2026-0091',
      date: 'Oct 1, 2026',
      client_name: 'Studio Subscription',
      project_title: 'Annual Membership — Upgraded Studio Tier (12 months)',
      amount: 479.90,
      status: 'paid',
      download_url: '#'
    },
    {
      id: 'inv-2',
      designer_id: designerId,
      invoice_number: 'INV-DEZ-2026-0042',
      date: 'Sep 15, 2026',
      client_name: 'Dr. Tariq Al-Mansoor',
      project_title: 'Milestone 1 Escrow Release (Modern Cantilevered Residence)',
      amount: 375.00,
      status: 'paid',
      download_url: '#'
    },
    {
      id: 'inv-3',
      designer_id: designerId,
      invoice_number: 'INV-DEZ-2025-0012',
      date: 'Oct 1, 2025',
      client_name: 'Studio Subscription',
      project_title: 'Annual Membership — Basic Studio Tier (12 months)',
      amount: 287.90,
      status: 'paid',
      download_url: '#'
    }
  ];

  const { error: invErr } = await supabase.from('invoices').upsert(invoicesData);
  if (invErr) console.error('Error seeding invoices:', invErr);
  else console.log(`✓ Seeded ${invoicesData.length} invoices`);

  // 9. Seed Conversations & Messages
  for (const c of sharedDataset.conversations) {
    const { error: convErr } = await supabase.from('conversations').upsert({
      id: c.id,
      designer_id: designerId,
      client_name: c.clientName,
      client_company: c.clientCompany || null,
      client_avatar: c.clientAvatarUrl || null,
      project_id: c.projectId || null,
      project_title: c.projectTitle || null,
      project_status: c.proposalStatus || null,
      project_budget: 45000,
      unread_count: c.unreadCount,
      last_message: c.lastMessageSnippet,
      last_message_time: c.lastMessageTime
    });
    if (convErr) console.error(`Error seeding conversation ${c.id}:`, convErr);

    const msgs = c.messages.map((m) => ({
      id: m.id,
      conversation_id: c.id,
      sender_id: m.senderId,
      sender_name: m.senderName,
      sender_role: m.isSelf ? 'designer' : 'client',
      text: m.text,
      timestamp: m.timestamp,
      attachments: []
    }));

    if (msgs.length > 0) {
      const { error: msgErr } = await supabase.from('messages').upsert(msgs);
      if (msgErr) console.error(`Error seeding messages for conversation ${c.id}:`, msgErr);
    }
  }
  console.log(`✓ Seeded ${sharedDataset.conversations.length} conversations and their message threads`);

  // 10. Seed Notifications
  const notifData = sharedDataset.notifications.map((n) => ({
    id: n.id,
    designer_id: designerId,
    type: n.type,
    title: n.title,
    detail: n.detail,
    relative_time: n.timestamp,
    is_unread: n.isUnread,
    action_link_text: n.actionUrl ? 'View' : null,
    action_url: n.actionUrl || null
  }));

  const { error: notifErr } = await supabase.from('notifications').upsert(notifData);
  if (notifErr) console.error('Error seeding notifications:', notifErr);
  else console.log(`✓ Seeded ${notifData.length} notifications`);

  console.log('\n🎉 ALL DATA SEEDED TO SUPABASE SUCCESSFULLY WITH ZERO ERRORS!');
}

seed();
