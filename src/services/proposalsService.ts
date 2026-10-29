/**
 * Proposals Service for Dezignet (Phase 2)
 * Connects My Proposals (list & detail) to real Supabase tables/functions with mock fallback.
 */

import { supabase, USE_MOCKS } from '../lib/supabase';
import {
  sharedDataset,
  type SharedProposal,
  type SharedProject,
  type SharedActiveProject,
  type MilestonePhase
} from '../mocks/dataset';
import { PLAN_TIERS_CONFIG } from '../config/paymentsConfig';

function delay(ms = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ProposalStatusTab =
  | 'All'
  | 'Pending'
  | 'Viewed'
  | 'Shortlisted'
  | 'Accepted'
  | 'Declined'
  | 'Withdrawn';

export interface ProposalFilterOptions {
  tab?: ProposalStatusTab;
  search?: string;
  sortBy?: 'newest' | 'price-high' | 'deadline';
  paymentType?: 'all' | 'Milestone' | 'Hourly';
  category?: string;
}

export interface ProposalUsageInfo {
  used: number;
  limit: number;
  planName: string;
  isUnlimited: boolean;
}

// ─── Helpers to map Supabase rows to SharedProposal ───────────────────────────

function mapRowToSharedProposal(
  row: any,
  projectRow?: any,
  clientSummary?: any,
  milestones: any[] = [],
  _events: any[] = []
): SharedProposal {
  const pSnapshot = row.project_snapshot?.project ?? projectRow ?? {};
  const clientName = clientSummary?.display_name ?? 'Client';
  const clientLocation = clientSummary?.city ?? pSnapshot?.location_text ?? 'Nigeria';

  // Construct stages timeline
  const timeline = [
    { stage: 'Sent', date: row.sent_at ? new Date(row.sent_at).toLocaleDateString('en-GB') : undefined, completed: true },
    { stage: 'Viewed', date: row.viewed_at ? new Date(row.viewed_at).toLocaleDateString('en-GB') : undefined, completed: Boolean(row.viewed_at) },
    { stage: 'Shortlisted', date: row.status === 'shortlisted' ? new Date(row.decided_at || row.updated_at).toLocaleDateString('en-GB') : undefined, completed: row.status === 'shortlisted' || row.status === 'accepted' },
    { stage: row.status === 'accepted' ? 'Accepted' : (row.status === 'declined' ? 'Declined' : (row.status === 'withdrawn' ? 'Withdrawn' : 'Decision Pending')), date: row.decided_at ? new Date(row.decided_at).toLocaleDateString('en-GB') : undefined, completed: Boolean(row.decided_at) }
  ];

  const mappedPhases: MilestonePhase[] = milestones.map((m: any, i: number) => ({
    id: m.id ?? `phase-${i}`,
    title: m.name ?? `Phase ${i + 1}`,
    feePercentage: Number(m.fee_percent ?? 0),
    amount: Number(m.amount ?? 0),
    deliverablesSummary: Array.isArray(m.deliverables) ? m.deliverables.join(', ') : '',
    dueDate: 'TBD',
    status: 'upcoming'
  }));

  const paymentType: 'Milestone' | 'Hourly' = pSnapshot.payment_type === 'hourly' || row.hourly_rate ? 'Hourly' : 'Milestone';

  return {
    id: row.id,
    projectId: row.project_id,
    projectTitle: pSnapshot.title ?? 'Project Proposal',
    clientName,
    clientLocation,
    paymentType,
    proposedPrice: Number(row.total_price ?? 0),
    clientBudget: Number(pSnapshot.budget ?? row.total_price),
    deliveryTime: `${row.delivery_days} days`,
    sentDate: row.sent_at ? new Date(row.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently',
    status: row.status as SharedProposal['status'],
    statusHint: row.status === 'declined' ? row.decline_reason : (row.status === 'withdrawn' ? row.withdraw_reason : undefined),
    coverLetter: row.cover_letter,
    phases: mappedPhases,
    hourlyRate: row.hourly_rate ? Number(row.hourly_rate) : undefined,
    estimatedHours: row.estimated_hours ? Number(row.estimated_hours) : undefined,
    attachedPortfolioIds: [],
    clientQuestionsAndAnswers: row.question_for_client ? [{ question: row.question_for_client, answer: row.client_answer }] : [],
    declinedReason: row.decline_reason ?? undefined,
    withdrawnReason: row.withdraw_reason ?? undefined,
    timeline,
    editCount: (row.version_count ?? 1) - 1,
    hasClientMessaged: false
  };
}

// ─── Real Supabase Queries ───────────────────────────────────────────────────

async function realGetMyProposalsList(
  filters?: ProposalFilterOptions
): Promise<{
  proposals: SharedProposal[];
  tabCounts: Record<ProposalStatusTab, number>;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const db = supabase as any;

  // 1. Fetch all designer's proposals
  const { data: allProposals, error: propErr } = await db
    .from('proposals')
    .select('*')
    .eq('designer_id', user.id)
    .order('sent_at', { ascending: false });

  if (propErr) throw propErr;
  const list = allProposals ?? [];

  // Calculate tab counts
  const tabCounts: Record<ProposalStatusTab, number> = {
    All: list.length,
    Pending: list.filter((p: any) => p.status === 'pending').length,
    Viewed: list.filter((p: any) => p.status === 'viewed').length,
    Shortlisted: list.filter((p: any) => p.status === 'shortlisted').length,
    Accepted: list.filter((p: any) => p.status === 'accepted').length,
    Declined: list.filter((p: any) => p.status === 'declined').length,
    Withdrawn: list.filter((p: any) => p.status === 'withdrawn').length
  };

  // Filter by tab
  let filtered = [...list];
  if (filters?.tab && filters.tab !== 'All') {
    filtered = filtered.filter((p: any) => p.status === filters.tab!.toLowerCase());
  }

  if (filtered.length === 0) {
    return { proposals: [], tabCounts };
  }

  // Fetch client summaries
  const projectIds = [...new Set(filtered.map((p: any) => p.project_id))];
  const { data: projectsData } = await db
    .from('open_projects')
    .select('id, client_id, title, location_text, city, state_region, budget, payment_type')
    .in('id', projectIds);

  const clientIds = [...new Set((projectsData ?? []).map((pr: any) => pr.client_id))];
  const { data: clientSummaries } = await db
    .from('client_summaries')
    .select('*')
    .in('user_id', clientIds);

  const prMap: Record<string, any> = {};
  (projectsData ?? []).forEach((pr: any) => { prMap[pr.id] = pr; });

  const clientMap: Record<string, any> = {};
  (clientSummaries ?? []).forEach((cs: any) => { clientMap[cs.user_id] = cs; });

  const mapped: SharedProposal[] = filtered.map((row: any) => {
    const proj = prMap[row.project_id];
    const client = proj ? clientMap[proj.client_id] : null;
    return mapRowToSharedProposal(row, proj, client);
  });

  // Client-side search and sort
  let finalResult = mapped;
  if (filters?.search?.trim()) {
    const q = filters.search.toLowerCase().trim();
    finalResult = finalResult.filter(
      (p) =>
        p.projectTitle.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        p.clientLocation.toLowerCase().includes(q)
    );
  }

  if (filters?.paymentType && filters.paymentType !== 'all') {
    finalResult = finalResult.filter((p) => p.paymentType === filters.paymentType);
  }

  if (filters?.sortBy === 'price-high') {
    finalResult.sort((a, b) => b.proposedPrice - a.proposedPrice);
  }

  return { proposals: finalResult, tabCounts };
}

async function realGetProposalDetail(
  id: string
): Promise<{
  proposal: SharedProposal;
  projectSnapshot: SharedProject;
  clientInfo: any;
} | null> {
  const db = supabase as any;

  const [
    { data: proposalRow, error: pErr },
    { data: milestones },
    { data: events },
    { data: portfolioItems }
  ] = await Promise.all([
    db.from('proposals').select('*').eq('id', id).maybeSingle(),
    db.from('proposal_milestones').select('*').eq('proposal_id', id),
    db.from('proposal_events').select('*').eq('proposal_id', id).order('created_at', { ascending: true }),
    db.from('proposal_portfolio_items').select('portfolio_project_id').eq('proposal_id', id)
  ]);

  if (pErr || !proposalRow) return null;

  const snapshot = proposalRow.project_snapshot?.project ?? {};
  const snapshotMilestones = proposalRow.project_snapshot?.milestones ?? [];

  const { data: clientSummary } = await db
    .from('client_summaries')
    .select('*')
    .eq('user_id', snapshot.client_id)
    .maybeSingle();

  const mappedProposal = mapRowToSharedProposal(
    proposalRow,
    snapshot,
    clientSummary,
    (milestones && milestones.length > 0) ? milestones : snapshotMilestones,
    events ?? []
  );
  mappedProposal.attachedPortfolioIds = (portfolioItems ?? []).map((x: any) => x.portfolio_project_id);

  const mappedSnapshot: SharedProject = {
    id: snapshot.id ?? proposalRow.project_id,
    title: snapshot.title ?? 'Project Snapshot',
    clientId: snapshot.client_id ?? '',
    clientName: clientSummary?.display_name ?? 'Client',
    clientLocation: clientSummary?.city ?? snapshot.location_text ?? 'Nigeria',
    paymentType: snapshot.payment_type === 'hourly' ? 'Hourly' : 'Milestone',
    category: snapshot.category ?? 'Architecture',
    budget: Number(snapshot.budget ?? proposalRow.total_price),
    deadline: snapshot.deadline ?? 'Flexible',
    location: snapshot.location_text ?? 'Nigeria',
    shortDescription: snapshot.description ? snapshot.description.slice(0, 180) + '...' : '',
    fullDescription: snapshot.description ?? '',
    facts: {
      propertyType: snapshot.subcategory ?? 'Residential',
      projectScale: snapshot.area_sqft ? `${snapshot.area_sqft} sq ft` : 'Standard scale',
      regulatoryZone: snapshot.state_region ?? 'Nigeria',
      estimatedDuration: snapshot.timeline_days ? `${snapshot.timeline_days} days` : '12 weeks'
    },
    status: snapshot.status === 'open' ? 'open' : (snapshot.status === 'awarded' ? 'active' : 'completed')
  };

  const mappedClientInfo = {
    id: clientSummary?.user_id ?? snapshot.client_id,
    name: clientSummary?.display_name ?? 'Client',
    location: clientSummary?.city ?? snapshot.location_text ?? 'Nigeria',
    memberSince: clientSummary?.member_since ? new Date(clientSummary.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown',
    projectsPosted: Number(clientSummary?.projects_posted ?? 1),
    paymentMethodVerified: clientSummary?.payment_verified === true,
    totalSpent: 0
  };

  return {
    proposal: mappedProposal,
    projectSnapshot: mappedSnapshot,
    clientInfo: mappedClientInfo
  };
}

async function realGetProposalUsage(): Promise<ProposalUsageInfo> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const db = supabase as any;
  const { data, error } = await db.rpc('proposal_usage', { p_designer_id: user.id });
  if (error || !data || data.length === 0) {
    return {
      used: 0,
      limit: 5,
      planName: 'Free',
      isUnlimited: false
    };
  }

  const { used, limit } = data[0];
  const { data: dp } = await db.from('designer_profiles').select('plan').eq('user_id', user.id).maybeSingle();
  const plan = dp?.plan ?? 'free';
  const planName = plan === 'upgraded' ? 'Upgraded' : (plan === 'basic' ? 'Basic' : 'Free');

  return {
    used: Number(used),
    limit: Number(limit),
    planName,
    isUnlimited: plan === 'upgraded'
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getMyProposalsList(
  filters?: ProposalFilterOptions
): Promise<{
  proposals: SharedProposal[];
  tabCounts: Record<ProposalStatusTab, number>;
}> {
  if (USE_MOCKS.proposals) {
    await delay(100);
    const all = [...sharedDataset.proposals];
    const tabCounts: Record<ProposalStatusTab, number> = {
      All: all.length,
      Pending: all.filter((p) => p.status === 'pending').length,
      Viewed: all.filter((p) => p.status === 'viewed').length,
      Shortlisted: all.filter((p) => p.status === 'shortlisted').length,
      Accepted: all.filter((p) => p.status === 'accepted').length,
      Declined: all.filter((p) => p.status === 'declined').length,
      Withdrawn: all.filter((p) => p.status === 'withdrawn').length
    };
    let filtered = [...all];
    if (filters?.tab && filters.tab !== 'All') {
      filtered = filtered.filter((p) => p.status === filters.tab!.toLowerCase());
    }
    return { proposals: filtered, tabCounts };
  }

  try {
    return await realGetMyProposalsList(filters);
  } catch (err) {
    console.error('[proposalsService] realGetMyProposalsList failed, falling back to mock', err);
    // fallback
    const all = [...sharedDataset.proposals];
    return {
      proposals: all,
      tabCounts: { All: all.length, Pending: 0, Viewed: 0, Shortlisted: 0, Accepted: 0, Declined: 0, Withdrawn: 0 }
    };
  }
}

export async function getProposalDetail(
  id: string
): Promise<{
  proposal: SharedProposal;
  projectSnapshot: SharedProject;
  clientInfo: any;
} | null> {
  if (USE_MOCKS.proposals) {
    await delay(120);
    const proposal = sharedDataset.proposals.find((p) => p.id === id);
    if (!proposal) return null;
    const projectSnapshot =
      sharedDataset.projects.find((p) => p.id === proposal.projectId) || sharedDataset.projects[0];
    const clientInfo =
      sharedDataset.clients.find((c) => c.name === proposal.clientName) || sharedDataset.clients[0];
    return {
      proposal: JSON.parse(JSON.stringify(proposal)),
      projectSnapshot: JSON.parse(JSON.stringify(projectSnapshot)),
      clientInfo: JSON.parse(JSON.stringify(clientInfo))
    };
  }

  try {
    const real = await realGetProposalDetail(id);
    if (real) return real;
    // fallback check in mock
    const proposal = sharedDataset.proposals.find((p) => p.id === id);
    if (!proposal) return null;
    return {
      proposal: JSON.parse(JSON.stringify(proposal)),
      projectSnapshot: JSON.parse(JSON.stringify(sharedDataset.projects[0])),
      clientInfo: JSON.parse(JSON.stringify(sharedDataset.clients[0]))
    };
  } catch (err) {
    console.error('[proposalsService] realGetProposalDetail failed', err);
    return null;
  }
}

export async function editProposal(
  id: string,
  updates: Partial<SharedProposal>
): Promise<SharedProposal> {
  if (USE_MOCKS.proposals) {
    await delay(180);
    const p = sharedDataset.proposals.find((item) => item.id === id);
    if (!p) throw new Error('Proposal not found');
    Object.assign(p, updates);
    p.editCount = (p.editCount || 0) + 1;
    return JSON.parse(JSON.stringify(p));
  }

  const db = supabase as any;
  const { error } = await db.rpc('update_proposal', {
    p_proposal_id: id,
    p_cover_letter: updates.coverLetter ?? null,
    p_total_price: updates.proposedPrice ?? null,
    p_delivery_days: updates.deliveryTime ? parseInt(updates.deliveryTime.replace(/\D/g, ''), 10) || 14 : null,
    p_hourly_rate: updates.hourlyRate ?? null,
    p_estimated_hours: updates.estimatedHours ?? null,
    p_exclusions: null,
    p_question_for_client: null,
    p_milestone_offers: null
  });

  if (error) throw error;
  const detail = await realGetProposalDetail(id);
  if (!detail) throw new Error('Failed to load updated proposal');
  return detail.proposal;
}

export async function withdrawProposal(
  id: string,
  reason?: string
): Promise<boolean> {
  if (USE_MOCKS.proposals) {
    await delay(160);
    return sharedDataset.withdrawProposalInMock(id, reason);
  }

  const db = supabase as any;
  const { error } = await db.rpc('withdraw_proposal', {
    p_proposal_id: id,
    p_reason: reason ?? null
  });
  if (error) throw error;
  return true;
}

export async function acceptProposalDev(
  id: string
): Promise<SharedActiveProject | null> {
  await delay(200);
  return sharedDataset.acceptProposalInMock(id);
}

export async function getProposalUsage(): Promise<ProposalUsageInfo> {
  if (USE_MOCKS.proposals) {
    await delay(80);
    const currentPlan =
      PLAN_TIERS_CONFIG.find((t) => t.id === sharedDataset.planState.currentPlanId) ||
      PLAN_TIERS_CONFIG[1];
    return {
      used: sharedDataset.planState.proposalsUsedThisMonth,
      limit: currentPlan.proposalsPerMonth,
      planName: currentPlan.name,
      isUnlimited: currentPlan.id === 'upgraded'
    };
  }

  try {
    return await realGetProposalUsage();
  } catch (err) {
    console.error('[proposalsService] realGetProposalUsage failed, using plan limits', err);
    return {
      used: 0,
      limit: 5,
      planName: 'Free',
      isUnlimited: false
    };
  }
}
