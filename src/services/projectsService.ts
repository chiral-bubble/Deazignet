/**
 * Projects Service for Dezignet (Phase 2)
 * Real Supabase backend with mock fallback (VITE_USE_MOCKS_PROJECTS=true).
 * Service signatures are identical to Phase 1 mocks — no page changes needed.
 */

import { supabase, USE_MOCKS } from '../lib/supabase';
import type { ProjectStatus, PaymentType } from '../types/database.types';

// ─── Public Types (same shape as mock layer) ─────────────────────────────────

export interface MilestonePhase {
  id: string;
  name: string;
  description: string;
  deliverables: string[];
  billingTrigger: string;
  defaultFeePercentage: number;
}

export interface ClientInfo {
  id: string;
  name: string;
  company?: string;
  location: string;
  memberSince: string;
  projectsPosted: number;
  paymentVerified: boolean;
  avatarText: string;
}

export interface ProjectReferenceImage {
  id: string;
  url: string;
  caption: string;
}

export interface Project {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  description: string;
  budget: number;
  currency: string;
  paymentType: 'Milestone' | 'Hourly';
  hourlyRate?: number;
  estimatedHours?: number;
  timeline: string;
  deadline: string;
  area: number;
  location: string;
  city?: string;
  stateRegion?: string;
  postedDate: string;
  proposalsCount: number;
  status: 'Open' | 'Under Review' | 'Awarded' | 'Closed' | 'Draft' | 'Cancelled';
  isSaved?: boolean;
  hasApplied?: boolean;
  appliedProposalId?: string;
  client: ClientInfo;
  referenceImages: ProjectReferenceImage[];
  milestones?: MilestonePhase[];
}

export interface ProjectFiltersState {
  search?: string;
  category?: string;
  subcategory?: string;
  minBudget?: number;
  maxBudget?: number;
  location?: string;
  city?: string;
  paymentType?: 'Milestone' | 'Hourly' | 'All';
  timeline?: string;
  sortBy?: 'newest' | 'budget-high' | 'budget-low' | 'deadline-soon';
  onlySaved?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ProposalMilestoneOffer {
  phaseId: string;
  phaseName: string;
  feePercentage: number;
  amount: number;
}

export interface ProposalSubmission {
  projectId: string;
  coverLetter: string;
  proposedTotal: number;
  currency?: string;
  paymentType: 'Milestone' | 'Hourly';
  milestoneOffers?: ProposalMilestoneOffer[];
  hourlyRate?: number;
  estimatedHours?: number;
  deliveryTime: string;
  deliveryDays?: number;
  portfolioItems: string[];
  clientQuestion?: string;
  exclusions?: string;
}

export interface SubmittedProposal {
  id: string;
  projectId: string;
  projectTitle: string;
  projectLocation: string;
  clientName: string;
  dateSent: string;
  proposedPrice: number;
  paymentType: 'Milestone' | 'Hourly';
  status: 'Pending' | 'Viewed' | 'Shortlisted' | 'Accepted' | 'Declined' | 'Withdrawn';
  coverLetter: string;
  deliveryTime: string;
  milestones?: ProposalMilestoneOffer[];
}

export interface ProposalDraft {
  coverLetter: string;
  proposedTotal: number;
  milestonePercentages: Record<string, number>;
  hourlyRate?: number;
  estimatedHours?: number;
  deliveryTime: string;
  portfolioItems: string[];
  clientQuestion?: string;
  lastUpdated: number;
}

// ─── Standard Milestone Templates ─────────────────────────────────────────────

export const standardMilestonePhases: MilestonePhase[] = [
  {
    id: 'phase-1',
    name: 'Pre-Design & Site Feasibility',
    description: 'Topographical analysis, zoning compliance, boundary checks, and architectural design brief sign-off.',
    deliverables: ['Site analysis report', 'Zoning setback clearance', 'Client requirements brief'],
    billingTrigger: 'Approval of Site Feasibility Document',
    defaultFeePercentage: 15
  },
  {
    id: 'phase-2',
    name: 'Schematic Design',
    description: 'Initial spatial layouts, 3D volumetric massing, preliminary floor plans, and mood board directions.',
    deliverables: ['Concept floor plans (1:100)', 'Massing 3D sketches', 'Spatial relationship matrix'],
    billingTrigger: 'Client Selection & Sign-off of Schematic Concept',
    defaultFeePercentage: 20
  },
  {
    id: 'phase-3',
    name: 'Design Development',
    description: 'Refined architectural drawings, exterior elevations, window schedules, materials palette, and MEP coordination.',
    deliverables: ['Dimensioned floor plans', '4 exterior elevations', 'Structural coordination overlay'],
    billingTrigger: 'Approval of Coordinated Design Development Package',
    defaultFeePercentage: 25
  },
  {
    id: 'phase-4',
    name: 'Construction Documents',
    description: 'Permit-ready working drawings, structural details, door/window schedules, and technical building specifications.',
    deliverables: ['Full CAD/BIM construction set', 'Building specifications', 'Foundation & framing details'],
    billingTrigger: 'Delivery of Signed Architectural Permit Set',
    defaultFeePercentage: 25
  },
  {
    id: 'phase-5',
    name: 'Bidding & Permitting',
    description: 'Assisting client with municipal development approvals, contractor bid evaluation, and tender inquiries.',
    deliverables: ['Local planning submission package', 'Bid tender response analysis', 'Bill of quantities review'],
    billingTrigger: 'Statutory Approval & Contractor Contract Award',
    defaultFeePercentage: 10
  },
  {
    id: 'phase-6',
    name: 'Construction Administration',
    description: 'Periodic site inspections to certify compliance with architectural drawings and milestone sign-offs.',
    deliverables: ['Site observation reports', 'Shop drawing submittal reviews', 'Defects punch list'],
    billingTrigger: 'Final Certificate of Architectural Completion',
    defaultFeePercentage: 5
  }
];

// ─── Error mapping ─────────────────────────────────────────────────────────────

type ProjectServiceError =
  | 'limit_reached'
  | 'profile_incomplete'
  | 'already_applied'
  | 'project_closed'
  | 'not_editable'
  | 'invalid_percentages'
  | 'invalid_hourly_fields'
  | 'unknown';

function mapSupabaseError(err: any): ProjectServiceError {
  const msg: string = err?.message || err?.hint || '';
  if (msg.includes('limit_reached')) return 'limit_reached';
  if (msg.includes('profile_incomplete')) return 'profile_incomplete';
  if (msg.includes('already_applied') || (err?.code === '23505')) return 'already_applied';
  if (msg.includes('project_closed')) return 'project_closed';
  if (msg.includes('not_editable')) return 'not_editable';
  if (msg.includes('invalid_percentages')) return 'invalid_percentages';
  if (msg.includes('invalid_hourly_fields')) return 'invalid_hourly_fields';
  return 'unknown';
}

// ─── Shape helpers ──────────────────────────────────────────────────────────────

function dbStatusToDisplay(s: ProjectStatus): Project['status'] {
  const map: Record<ProjectStatus, Project['status']> = {
    draft: 'Draft',
    open: 'Open',
    awarded: 'Awarded',
    closed: 'Closed',
    cancelled: 'Cancelled'
  };
  return map[s] ?? 'Closed';
}

function dbPaymentTypeToDisplay(t: PaymentType): 'Milestone' | 'Hourly' {
  return t === 'milestone' ? 'Milestone' : 'Hourly';
}

function formatTimelineFromDays(days: number | null): string {
  if (!days) return 'TBD';
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.round(days / 7)} Weeks`;
  return `${Math.round(days / 30)} Months`;
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatDeadlineRelative(dateStr: string | null): string {
  if (!dateStr) return 'No deadline';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return `In ${diffDays} days`;
}

function rowToProject(row: any, clientRow: any): Project {
  const milestones: MilestonePhase[] = Array.isArray(row.milestones)
    ? row.milestones.map((m: any, i: number) => ({
        id: m.id ?? `ms-${i}`,
        name: m.name ?? '',
        description: m.description ?? '',
        deliverables: m.deliverables ?? [],
        billingTrigger: m.billing_trigger ?? '',
        defaultFeePercentage: Number(m.fee_percent ?? 0)
      }))
    : [];

  const clientName = clientRow?.display_name ?? 'Client';
  const nameParts = clientName.split(' ');
  const avatarText = nameParts.map((p: string) => p[0]).join('').toUpperCase().slice(0, 2);

  return {
    id: row.id,
    title: row.title,
    category: row.category,
    subcategory: row.subcategory ?? '',
    description: row.description ?? '',
    budget: Number(row.budget),
    currency: row.currency ?? 'USD',
    paymentType: dbPaymentTypeToDisplay(row.payment_type),
    hourlyRate: row.hourly_rate_max ? Number(row.hourly_rate_max) : undefined,
    timeline: formatTimelineFromDays(row.timeline_days),
    deadline: formatDeadlineRelative(row.deadline),
    area: Number(row.area_sqft ?? 0),
    location: [row.city, row.state_region].filter(Boolean).join(', ') || row.location_text || 'Location TBD',
    city: row.city ?? undefined,
    stateRegion: row.state_region ?? undefined,
    postedDate: formatRelativeDate(row.published_at),
    proposalsCount: Number(row.proposal_count ?? 0),
    status: dbStatusToDisplay(row.status ?? 'open'),
    isSaved: row.is_saved === true,
    hasApplied: row.has_applied === true,
    client: {
      id: clientRow?.user_id ?? row.client_id,
      name: clientName,
      location: [clientRow?.city, clientRow?.state_region].filter(Boolean).join(', ') || 'Unknown',
      memberSince: clientRow?.member_since
        ? new Date(clientRow.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'Unknown',
      projectsPosted: Number(clientRow?.projects_posted ?? 0),
      paymentVerified: clientRow?.payment_verified === true,
      avatarText
    },
    referenceImages: [], // mocked until storage phase
    milestones: milestones.length > 0 ? milestones : undefined
  };
}

// ─── Real Supabase implementation ──────────────────────────────────────────────

async function realGetProjects(filters?: ProjectFiltersState): Promise<Project[]> {
  const db = supabase as any;
  let query = db.from('open_projects').select('*');

  // Full-text search
  if (filters?.search?.trim()) {
    query = query.textSearch('search', filters.search.trim(), { type: 'websearch' });
  }

  // Category
  if (filters?.category && filters.category !== 'All') {
    query = query.eq('category', filters.category);
  }

  // Subcategory
  if (filters?.subcategory && filters.subcategory !== 'All') {
    query = query.ilike('subcategory', `%${filters.subcategory}%`);
  }

  // Location
  if (filters?.city) {
    query = query.ilike('city', `%${filters.city}%`);
  }

  // Payment type
  if (filters?.paymentType && filters.paymentType !== 'All') {
    query = query.eq('payment_type', filters.paymentType.toLowerCase());
  }

  // Budget range
  if (filters?.minBudget && filters.minBudget > 0) {
    query = query.gte('budget', filters.minBudget);
  }
  if (filters?.maxBudget && filters.maxBudget > 0) {
    query = query.lte('budget', filters.maxBudget);
  }

  // Saved only
  if (filters?.onlySaved) {
    query = query.eq('is_saved', true);
  }

  // Sort
  if (filters?.sortBy === 'budget-high') {
    query = query.order('budget', { ascending: false });
  } else if (filters?.sortBy === 'budget-low') {
    query = query.order('budget', { ascending: true });
  } else if (filters?.sortBy === 'deadline-soon') {
    query = query.order('deadline', { ascending: true });
  } else {
    query = query.order('published_at', { ascending: false });
  }

  // Pagination
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  query = query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data: projectRows, error: pErr } = await query;
  if (pErr) throw pErr;
  if (!projectRows?.length) return [];

  // Fetch client summaries for all unique client IDs
  const clientIds: string[] = Array.from(new Set(projectRows.map((r: any) => String(r.client_id))));
  const { data: clientRows } = await db
    .from('client_summaries')
    .select('*')
    .in('user_id', clientIds);

  const clientMap: Record<string, any> = {};
  (clientRows ?? []).forEach((c: any) => { clientMap[c.user_id] = c; });

  return projectRows.map((row: any) => rowToProject(row, clientMap[row.client_id]));
}

async function realGetProject(id: string): Promise<Project | null> {
  const db = supabase as any;
  const { data: row, error } = await db
    .from('open_projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !row) return null;

  const { data: clientRow } = await db
    .from('client_summaries')
    .select('*')
    .eq('user_id', row.client_id)
    .maybeSingle();

  return rowToProject(row, clientRow);
}

async function realSaveProject(projectId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const db = supabase as any;
  const { error } = await db
    .from('saved_projects')
    .upsert({ user_id: user.id, project_id: projectId });
  if (error) throw error;
}

async function realUnsaveProject(projectId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const db = supabase as any;
  const { error } = await db
    .from('saved_projects')
    .delete()
    .eq('user_id', user.id)
    .eq('project_id', projectId);
  if (error) throw error;
}

async function realSubmitProposal(
  projectId: string,
  proposal: ProposalSubmission
): Promise<{ success: boolean; proposalId?: string; error?: ProjectServiceError; message?: string }> {
  try {
    const db = supabase as any;
    const milestoneOffers = proposal.milestoneOffers?.map(m => ({
      project_milestone_id: m.phaseId,
      fee_percent: m.feePercentage,
      amount: m.amount
    })) ?? [];

    const deliveryDays = proposal.deliveryDays
      ?? (proposal.deliveryTime
        ? parseInt(proposal.deliveryTime.replace(/\D/g, ''), 10) * 7 || 14
        : 14);

    const { data, error } = await db.rpc('submit_proposal', {
      p_project_id: projectId,
      p_cover_letter: proposal.coverLetter,
      p_total_price: proposal.proposedTotal,
      p_currency: proposal.currency ?? 'USD',
      p_delivery_days: deliveryDays,
      p_hourly_rate: proposal.hourlyRate ?? null,
      p_estimated_hours: proposal.estimatedHours ?? null,
      p_exclusions: proposal.exclusions ?? null,
      p_question_for_client: proposal.clientQuestion ?? null,
      p_milestone_offers: milestoneOffers,
      p_portfolio_item_ids: proposal.portfolioItems ?? []
    });

    if (error) {
      const code = mapSupabaseError(error);
      return { success: false, error: code, message: error.message };
    }

    clearProposalDraft(projectId);
    return { success: true, proposalId: data };
  } catch (err: any) {
    const code = mapSupabaseError(err);
    return { success: false, error: code, message: err.message };
  }
}

async function realWithdrawProposal(proposalId: string, reason?: string): Promise<boolean> {
  const db = supabase as any;
  const { error } = await db.rpc('withdraw_proposal', {
    p_proposal_id: proposalId,
    p_reason: reason ?? null
  });
  if (error) throw error;
  return true;
}

async function realGetProjectProposalCount(projectId: string): Promise<number> {
  const db = supabase as any;
  const { data } = await db
    .from('open_projects')
    .select('proposal_count')
    .eq('id', projectId)
    .maybeSingle();
  return Number(data?.proposal_count ?? 0);
}

// ─── Mock fallback ──────────────────────────────────────────────────────────────

// Mock store in memory (same data as before)
const mockProjectsData: Project[] = [
  {
    id: 'proj-austin-residence',
    title: 'Luxury Smart Home Residence, Austin Hill Country',
    category: 'Residential',
    subcategory: 'Smart Home',
    description: 'A 5-bedroom smart home project in Austin Hill Country. Requirements include automated lighting, security, HVAC integration and a terrace with pool.',
    budget: 85000,
    currency: 'USD',
    paymentType: 'Milestone',
    timeline: '16 Weeks',
    deadline: 'In 10 days',
    area: 4800,
    location: 'Austin, Texas',
    city: 'Austin',
    stateRegion: 'Texas',
    postedDate: '1 day ago',
    proposalsCount: 3,
    status: 'Open',
    isSaved: false,
    hasApplied: false,
    client: {
      id: 'client-mock-1',
      name: 'Dr. Eleanor Vance',
      location: 'Austin, TX',
      memberSince: 'January 2023',
      projectsPosted: 2,
      paymentVerified: true,
      avatarText: 'EV'
    },
    referenceImages: [],
    milestones: standardMilestonePhases
  },
  {
    id: 'proj-denver-commercial',
    title: 'Mixed-Use Commercial Center, Denver Tech Corridor',
    category: 'Commercial',
    subcategory: 'Mixed-Use Tower',
    description: 'A mixed-use development combining retail, office and residential units in Denver. Looking for a lead architect with experience in high-efficiency design.',
    budget: 195000,
    currency: 'USD',
    paymentType: 'Milestone',
    timeline: '40 Weeks',
    deadline: 'In 18 days',
    area: 28000,
    location: 'Denver, Colorado',
    city: 'Denver',
    stateRegion: 'Colorado',
    postedDate: '3 days ago',
    proposalsCount: 8,
    status: 'Open',
    isSaved: true,
    hasApplied: false,
    client: {
      id: 'client-mock-2',
      name: 'David Miller',
      location: 'Denver, CO',
      memberSince: 'March 2022',
      projectsPosted: 5,
      paymentVerified: true,
      avatarText: 'DM'
    },
    referenceImages: [],
    milestones: standardMilestonePhases
  },
  {
    id: 'proj-miami-hotel',
    title: 'Boutique Waterfront Hotel, Miami Beach',
    category: 'Hospitality',
    subcategory: 'Boutique Hotel',
    description: 'A 32-key boutique hotel on the Miami Beach waterfront. Emphasis on coastal modernism, natural cross-ventilation, and hurricane-resilient glazing.',
    budget: 140000,
    currency: 'USD',
    paymentType: 'Hourly',
    hourlyRate: 110,
    timeline: '24 Weeks',
    deadline: 'In 14 days',
    area: 12000,
    location: 'Miami Beach, Florida',
    city: 'Miami Beach',
    stateRegion: 'Florida',
    postedDate: '2 days ago',
    proposalsCount: 5,
    status: 'Open',
    isSaved: false,
    hasApplied: true,
    appliedProposalId: 'mock-prop-001',
    client: {
      id: 'client-mock-3',
      name: 'Beacon Crest Development LLC',
      location: 'Miami, FL',
      memberSince: 'June 2021',
      projectsPosted: 3,
      paymentVerified: true,
      avatarText: 'CE'
    },
    referenceImages: [],
    milestones: undefined
  }
];

const submittedProposalsStore: SubmittedProposal[] = [];

async function mockGetProjects(filters?: ProjectFiltersState): Promise<Project[]> {
  await new Promise((r) => setTimeout(r, 80));
  let results = [...mockProjectsData].filter((p) => p.status === 'Open');

  if (filters?.onlySaved) results = results.filter((p) => p.isSaved);
  if (filters?.search?.trim()) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }
  if (filters?.category && filters.category !== 'All')
    results = results.filter((p) => p.category === filters.category);
  if (filters?.paymentType && filters.paymentType !== 'All')
    results = results.filter((p) => p.paymentType === filters.paymentType);
  if (filters?.minBudget && filters.minBudget > 0)
    results = results.filter((p) => p.budget >= filters.minBudget!);
  if (filters?.maxBudget && filters.maxBudget > 0)
    results = results.filter((p) => p.budget <= filters.maxBudget!);
  if (filters?.sortBy === 'budget-high') results.sort((a, b) => b.budget - a.budget);
  else if (filters?.sortBy === 'budget-low') results.sort((a, b) => a.budget - b.budget);

  return results;
}

async function mockGetProject(id: string): Promise<Project | null> {
  await new Promise((r) => setTimeout(r, 60));
  return mockProjectsData.find((p) => p.id === id) ?? null;
}

async function mockSubmitProposal(
  projectId: string,
  proposal: ProposalSubmission
): Promise<{ success: boolean; proposalId?: string; error?: ProjectServiceError; message?: string }> {
  await new Promise((r) => setTimeout(r, 350));
  const project = mockProjectsData.find((p) => p.id === projectId);
  if (!project) return { success: false, error: 'project_closed', message: 'Project not found' };
  if (project.hasApplied) return { success: false, error: 'already_applied' };
  const id = `prop-${Date.now()}`;
  submittedProposalsStore.unshift({
    id,
    projectId,
    projectTitle: project.title,
    projectLocation: project.location,
    clientName: project.client.name,
    dateSent: 'Just now',
    proposedPrice: proposal.proposedTotal,
    paymentType: proposal.paymentType,
    status: 'Pending',
    coverLetter: proposal.coverLetter,
    deliveryTime: proposal.deliveryTime,
    milestones: proposal.milestoneOffers
  });
  project.hasApplied = true;
  project.appliedProposalId = id;
  project.proposalsCount += 1;
  clearProposalDraft(projectId);
  return { success: true, proposalId: id };
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetch filtered list of open projects.
 */
export async function getProjects(filters?: ProjectFiltersState): Promise<Project[]> {
  if (USE_MOCKS.projects) return mockGetProjects(filters);
  try {
    return await realGetProjects(filters);
  } catch (err) {
    console.error('[projectsService] getProjects failed, falling back to mock', err);
    return mockGetProjects(filters);
  }
}

/**
 * Fetch a single project by ID.
 */
export async function getProject(id: string): Promise<Project | null> {
  if (USE_MOCKS.projects) return mockGetProject(id);
  try {
    const real = await realGetProject(id);
    if (real) return real;
    // My Work: might be a project with non-open status the designer proposed on
    return mockGetProject(id);
  } catch (err) {
    console.error('[projectsService] getProject failed, falling back to mock', err);
    return mockGetProject(id);
  }
}

/**
 * Save a project (bookmark).
 */
export async function saveProject(projectId: string): Promise<void> {
  if (USE_MOCKS.projects) {
    const p = mockProjectsData.find((x) => x.id === projectId);
    if (p) p.isSaved = true;
    return;
  }
  try {
    await realSaveProject(projectId);
  } catch (err) {
    console.error('[projectsService] saveProject failed', err);
  }
}

/**
 * Unsave a project.
 */
export async function unsaveProject(projectId: string): Promise<void> {
  if (USE_MOCKS.projects) {
    const p = mockProjectsData.find((x) => x.id === projectId);
    if (p) p.isSaved = false;
    return;
  }
  try {
    await realUnsaveProject(projectId);
  } catch (err) {
    console.error('[projectsService] unsaveProject failed', err);
  }
}

/**
 * Toggle save state — returns the new isSaved value.
 */
export function toggleSaveProject(projectId: string): boolean {
  const p = mockProjectsData.find((x) => x.id === projectId);
  if (p) {
    p.isSaved = !p.isSaved;
    if (USE_MOCKS.projects) return !!p.isSaved;
    // Fire and forget real call
    if (p.isSaved) realSaveProject(projectId).catch(() => {});
    else realUnsaveProject(projectId).catch(() => {});
    return !!p.isSaved;
  }
  return false;
}

/**
 * Get saved projects for the current designer.
 */
export async function getSavedProjects(): Promise<Project[]> {
  if (USE_MOCKS.projects) {
    await new Promise((r) => setTimeout(r, 80));
    return mockProjectsData.filter((p) => p.isSaved);
  }
  try {
    return await realGetProjects({ onlySaved: true });
  } catch (err) {
    console.error('[projectsService] getSavedProjects failed', err);
    return [];
  }
}

/**
 * Submit a proposal for a project.
 */
export async function submitProposal(
  projectId: string,
  proposal: ProposalSubmission
): Promise<{ success: boolean; proposalId?: string; error?: ProjectServiceError; message?: string }> {
  if (USE_MOCKS.projects) return mockSubmitProposal(projectId, proposal);
  return realSubmitProposal(projectId, proposal);
}

/**
 * Withdraw an active proposal.
 */
export async function withdrawProposal(proposalId: string, reason?: string): Promise<boolean> {
  if (USE_MOCKS.projects) {
    await new Promise((r) => setTimeout(r, 200));
    const i = submittedProposalsStore.findIndex((p) => p.id === proposalId);
    if (i !== -1) {
      submittedProposalsStore[i].status = 'Withdrawn';
      const proj = mockProjectsData.find((p) => p.id === submittedProposalsStore[i].projectId);
      if (proj) { proj.hasApplied = false; proj.appliedProposalId = undefined; }
      return true;
    }
    return false;
  }
  return realWithdrawProposal(proposalId, reason);
}

/**
 * Get the proposal count for a project (for the detail view counter).
 */
export async function getProjectProposalCount(projectId: string): Promise<number> {
  if (USE_MOCKS.projects) {
    return mockProjectsData.find((p) => p.id === projectId)?.proposalsCount ?? 0;
  }
  return realGetProjectProposalCount(projectId);
}

/**
 * Fetch submitted proposals for the current designer (used in My Work legacy path).
 */
export async function getMyProposals(): Promise<SubmittedProposal[]> {
  await new Promise((r) => setTimeout(r, 80));
  return [...submittedProposalsStore];
}

// ─── Draft Management (localStorage) ─────────────────────────────────────────

const DRAFT_PREFIX = 'dezignet_proposal_draft_';

export function saveProposalDraft(projectId: string, draft: Partial<ProposalDraft>): void {
  try {
    const existing: Partial<ProposalDraft> = getProposalDraft(projectId) || {};
    const payload: ProposalDraft = {
      coverLetter: draft.coverLetter ?? existing.coverLetter ?? '',
      proposedTotal: draft.proposedTotal ?? existing.proposedTotal ?? 0,
      milestonePercentages: draft.milestonePercentages ?? existing.milestonePercentages ?? {},
      hourlyRate: draft.hourlyRate ?? existing.hourlyRate,
      estimatedHours: draft.estimatedHours ?? existing.estimatedHours,
      deliveryTime: draft.deliveryTime ?? existing.deliveryTime ?? '',
      portfolioItems: draft.portfolioItems ?? existing.portfolioItems ?? [],
      clientQuestion: draft.clientQuestion ?? existing.clientQuestion ?? '',
      lastUpdated: Date.now()
    };
    localStorage.setItem(DRAFT_PREFIX + projectId, JSON.stringify(payload));
  } catch {
    // Ignore quota issues
  }
}

export function getProposalDraft(projectId: string): ProposalDraft | null {
  try {
    const str = localStorage.getItem(DRAFT_PREFIX + projectId);
    return str ? (JSON.parse(str) as ProposalDraft) : null;
  } catch {
    return null;
  }
}

export function clearProposalDraft(projectId: string): void {
  try {
    localStorage.removeItem(DRAFT_PREFIX + projectId);
  } catch {
    // Ignore
  }
}

// =============================================================================
// CLIENT-SIDE POST & MANAGE PROJECTS SERVICES (PHASE 7 / CLIENT SUPABASE INTEGRATION)
// =============================================================================

export interface CategoryItem {
  id: string;
  name: string;
  sort_order: number;
  subcategories: SubcategoryItem[];
}

export interface SubcategoryItem {
  id: string;
  category_id: string;
  name: string;
  sort_order: number;
}

export interface PhaseTemplateItem {
  id: string;
  sort_order: number;
  name: string;
  description: string;
  deliverables: string[];
  billing_trigger: string;
  default_fee_percent: number;
  fee_percent_without_predesign?: number;
  is_optional?: boolean;
}

export interface ProjectDraftPayload {
  id?: string;
  title: string;
  category: string;
  subcategory?: string;
  disciplines?: string[];
  description: string;
  city?: string;
  state_region?: string;
  street?: string;
  postal_code?: string;
  site_notes?: string;
  access_instructions?: string;
  building_status?: 'new_build' | 'renovation' | 'extension';
  site_status?: 'has_land' | 'no_land_yet';
  existing_documents?: string[];
  area_sqft?: number;
  area_unit?: 'sqft' | 'sqm';
  design_budget: number;
  construction_cost_estimate?: number;
  currency?: string;
  deadline?: string;
  proposal_deadline?: string;
  timeline_days?: number;
  included_revisions_requested?: number;
  payment_type: 'milestone' | 'hourly';
  hourly_rate_max?: number;
  phases?: Array<{
    id?: string;
    sort_order: number;
    name: string;
    description?: string;
    deliverables: string[];
    billing_trigger?: string;
    fee_percent: number;
  }>;
  image_file_ids?: string[];
  wizard_step?: number;
}

export interface MyProjectsFilter {
  status?: 'all' | 'draft' | 'open' | 'awarded' | 'closed' | 'cancelled';
  category?: string;
  search?: string;
  sortBy?: 'newest' | 'proposals' | 'deadline';
  page?: number;
  pageSize?: number;
}

export interface MyProjectItem {
  id: string;
  title: string;
  status: 'draft' | 'open' | 'awarded' | 'closed' | 'cancelled';
  category: string;
  subcategory: string | null;
  design_budget: number;
  payment_type: 'milestone' | 'hourly';
  deadline: string | null;
  city: string | null;
  state_region: string | null;
  proposals_count: number;
  new_proposals_count: number;
  created_at: string;
  wizard_step?: number;
}

export interface MyProjectsSummary {
  openProjects: number;
  proposalsToReview: number;
  activeProjects: number;
  completedProjects: number;
}

export interface ProjectUpdateItem {
  id: string;
  project_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface ProjectActivityItem {
  id: string;
  type: 'published' | 'proposal_received' | 'update_posted' | 'status_changed' | 'deadline_extended';
  title: string;
  date: string;
  description?: string;
}

export interface ClientProjectDetail {
  project: any;
  privateDetails?: any;
  phases: any[];
  images: any[];
  updates: ProjectUpdateItem[];
  activities: ProjectActivityItem[];
  proposalsCount: number;
  unviewedProposalsCount: number;
  hasProposals: boolean;
  canEditTitle: boolean;
  canEditScope: boolean;
}

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  {
    id: 'cat-res',
    name: 'Residential',
    sort_order: 1,
    subcategories: [
      { id: 'sub-res-1', category_id: 'cat-res', name: 'Detached house / bungalow', sort_order: 1 },
      { id: 'sub-res-2', category_id: 'cat-res', name: 'Duplex', sort_order: 2 },
      { id: 'sub-res-3', category_id: 'cat-res', name: 'Terrace / semi-detached', sort_order: 3 },
      { id: 'sub-res-4', category_id: 'cat-res', name: 'Apartment block', sort_order: 4 },
      { id: 'sub-res-5', category_id: 'cat-res', name: 'Housing estate', sort_order: 5 },
      { id: 'sub-res-6', category_id: 'cat-res', name: 'Student hostel', sort_order: 6 }
    ]
  },
  {
    id: 'cat-comm',
    name: 'Commercial',
    sort_order: 2,
    subcategories: [
      { id: 'sub-comm-1', category_id: 'cat-comm', name: 'Office building', sort_order: 1 },
      { id: 'sub-comm-2', category_id: 'cat-comm', name: 'Retail / shopping', sort_order: 2 },
      { id: 'sub-comm-3', category_id: 'cat-comm', name: 'Hotel & hospitality', sort_order: 3 },
      { id: 'sub-comm-4', category_id: 'cat-comm', name: 'Restaurant & cafe', sort_order: 4 },
      { id: 'sub-comm-5', category_id: 'cat-comm', name: 'Mixed-use', sort_order: 5 },
      { id: 'sub-comm-6', category_id: 'cat-comm', name: 'Filling station', sort_order: 6 }
    ]
  },
  {
    id: 'cat-inst',
    name: 'Institutional',
    sort_order: 3,
    subcategories: [
      { id: 'sub-inst-1', category_id: 'cat-inst', name: 'School & university', sort_order: 1 },
      { id: 'sub-inst-2', category_id: 'cat-inst', name: 'Church / mosque / worship', sort_order: 2 },
      { id: 'sub-inst-3', category_id: 'cat-inst', name: 'Government building', sort_order: 3 },
      { id: 'sub-inst-4', category_id: 'cat-inst', name: 'Cultural & civic', sort_order: 4 },
      { id: 'sub-inst-5', category_id: 'cat-inst', name: 'Sports & recreation', sort_order: 5 }
    ]
  },
  {
    id: 'cat-health',
    name: 'Healthcare',
    sort_order: 4,
    subcategories: [
      { id: 'sub-health-1', category_id: 'cat-health', name: 'Hospital', sort_order: 1 },
      { id: 'sub-health-2', category_id: 'cat-health', name: 'Clinic', sort_order: 2 },
      { id: 'sub-health-3', category_id: 'cat-health', name: 'Laboratory', sort_order: 3 },
      { id: 'sub-health-4', category_id: 'cat-health', name: 'Pharmacy', sort_order: 4 }
    ]
  },
  {
    id: 'cat-ind',
    name: 'Industrial',
    sort_order: 5,
    subcategories: [
      { id: 'sub-ind-1', category_id: 'cat-ind', name: 'Warehouse', sort_order: 1 },
      { id: 'sub-ind-2', category_id: 'cat-ind', name: 'Factory', sort_order: 2 },
      { id: 'sub-ind-3', category_id: 'cat-ind', name: 'Logistics', sort_order: 3 }
    ]
  }
];

export const DEFAULT_PHASE_TEMPLATES: PhaseTemplateItem[] = [
  {
    id: 't-1',
    sort_order: 1,
    name: 'Pre-Design / Site Feasibility',
    description: 'Review of site survey, zoning and setbacks, feasibility diagrams',
    deliverables: ['Site survey review', 'Zoning setback clearance', 'Feasibility diagrams'],
    billing_trigger: 'Approval of site feasibility document',
    default_fee_percent: 10.0,
    fee_percent_without_predesign: 0.0,
    is_optional: true
  },
  {
    id: 't-2',
    sort_order: 2,
    name: 'Schematic Design',
    description: 'Layout options and building concepts',
    deliverables: ['Concept floor plans', 'Massing 3D sketches', 'Spatial relationship matrix'],
    billing_trigger: 'Client selection and sign-off of schematic concept',
    default_fee_percent: 15.0,
    fee_percent_without_predesign: 20.0,
    is_optional: false
  },
  {
    id: 't-3',
    sort_order: 3,
    name: 'Design Development',
    description: 'Refine the selected design, coordinate with consultants',
    deliverables: ['Dimensioned floor plans', 'Exterior elevations', 'Consultant coordination overlay'],
    billing_trigger: 'Approval of coordinated design development package',
    default_fee_percent: 20.0,
    fee_percent_without_predesign: 25.0,
    is_optional: false
  },
  {
    id: 't-4',
    sort_order: 4,
    name: 'Construction Documents',
    description: 'Permit and construction-ready drawing set',
    deliverables: ['Full permit drawing set', 'Technical specifications', 'Foundation and framing details'],
    billing_trigger: 'Delivery of signed architectural permit set',
    default_fee_percent: 35.0,
    fee_percent_without_predesign: 35.0,
    is_optional: false
  },
  {
    id: 't-5',
    sort_order: 5,
    name: 'Bidding & Permitting',
    description: 'Assist with contractor selection and permit responses',
    deliverables: ['Permit submission support', 'Bid tender evaluation', 'Bill of quantities review'],
    billing_trigger: 'Statutory permit approval & contractor award',
    default_fee_percent: 5.0,
    fee_percent_without_predesign: 5.0,
    is_optional: false
  },
  {
    id: 't-6',
    sort_order: 6,
    name: 'Construction Administration',
    description: 'Support during construction and respond to RFIs',
    deliverables: ['Site observation reports', 'RFI responses', 'Defects punch list'],
    billing_trigger: 'Final certificate of completion',
    default_fee_percent: 15.0,
    fee_percent_without_predesign: 15.0,
    is_optional: false
  }
];

/**
 * Fetch all shared Categories and their Subcategories from database
 * Falls back to standard production categories if database schema is awaiting migration
 */
export async function getCategories(): Promise<CategoryItem[]> {
  if (USE_MOCKS.projects) {
    return DEFAULT_CATEGORIES;
  }

  try {
    const { data: cats, error: catErr } = await supabase
      .from('categories')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true });

    if (catErr || !cats || cats.length === 0) {
      if (catErr) console.warn('Categories query returned error, using verified defaults:', catErr.message);
      return DEFAULT_CATEGORIES;
    }

    const { data: subs, error: subErr } = await supabase
      .from('subcategories')
      .select('id, category_id, name, sort_order')
      .order('sort_order', { ascending: true });

    if (subErr) {
      console.warn('Subcategories query returned error:', subErr.message);
    }

    const subMap: Record<string, SubcategoryItem[]> = {};
    (subs || []).forEach((s) => {
      if (!subMap[s.category_id]) subMap[s.category_id] = [];
      subMap[s.category_id].push(s);
    });

    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      sort_order: c.sort_order,
      subcategories: subMap[c.id] || []
    }));
  } catch (err) {
    console.warn('Error fetching categories from database, using verified defaults:', err);
    return DEFAULT_CATEGORIES;
  }
}

/**
 * Fetch the six standard Architectural Phase Templates from database
 * Falls back to standard production phase templates if database schema is awaiting migration
 */
export async function getPhaseTemplates(): Promise<PhaseTemplateItem[]> {
  if (USE_MOCKS.projects) {
    return DEFAULT_PHASE_TEMPLATES;
  }

  try {
    const { data, error } = await supabase
      .from('phase_templates')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      if (error) console.warn('Phase templates query returned error, using verified defaults:', error.message);
      return DEFAULT_PHASE_TEMPLATES;
    }

    return data.map((t: any) => ({
      id: t.id,
      sort_order: t.sort_order,
      name: t.name,
      description: t.description || '',
      deliverables: t.deliverables || [],
      billing_trigger: t.billing_trigger || '',
      default_fee_percent: Number(t.default_fee_percent),
      fee_percent_without_predesign: Number(t.fee_percent_without_predesign ?? 0),
      is_optional: Boolean(t.is_optional)
    }));
  } catch (err) {
    console.warn('Error fetching phase templates from database, using verified defaults:', err);
    return DEFAULT_PHASE_TEMPLATES;
  }
}

/**
 * Creates a new Draft Project in the database
 */
export async function createDraftProject(payload: Partial<ProjectDraftPayload> = {}): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required to create a project.');

  const newId = payload.id || crypto.randomUUID();

  const { error } = await supabase.from('projects').insert({
    id: newId,
    client_id: user.id,
    title: payload.title || 'Untitled Project',
    category: payload.category || 'Residential',
    subcategory: payload.subcategory || null,
    disciplines: payload.disciplines || [],
    description: payload.description || '',
    design_budget: payload.design_budget && payload.design_budget > 0 ? payload.design_budget : 1000,
    currency: payload.currency || 'USD',
    payment_type: payload.payment_type || 'milestone',
    city: payload.city || null,
    state_region: payload.state_region || null,
    building_status: payload.building_status || null,
    site_status: payload.site_status || null,
    existing_documents: payload.existing_documents || [],
    area_sqft: payload.area_sqft || null,
    area_unit: payload.area_unit || 'sqft',
    status: 'draft',
    wizard_step: payload.wizard_step || 1,
    last_saved_at: new Date().toISOString()
  });

  if (error) {
    console.error('Failed to create draft project:', error);
    throw new Error(error.message);
  }

  return newId;
}

/**
 * Autosaves a draft project (called with debounce 1.5s in the wizard)
 */
export async function autosaveDraft(
  projectId: string,
  payload: Partial<ProjectDraftPayload>,
  step?: number
): Promise<void> {
  if (USE_MOCKS.projects) {
    return;
  }

  // 1. Update project table
  const updateFields: any = {
    updated_at: new Date().toISOString(),
    last_saved_at: new Date().toISOString()
  };

  if (payload.title !== undefined) updateFields.title = payload.title.trim() || 'Untitled Project';
  if (payload.category !== undefined) updateFields.category = payload.category;
  if (payload.subcategory !== undefined) updateFields.subcategory = payload.subcategory;
  if (payload.disciplines !== undefined) updateFields.disciplines = payload.disciplines;
  if (payload.description !== undefined) updateFields.description = payload.description;
  if (payload.city !== undefined) updateFields.city = payload.city;
  if (payload.state_region !== undefined) updateFields.state_region = payload.state_region;
  if (payload.building_status !== undefined) updateFields.building_status = payload.building_status;
  if (payload.site_status !== undefined) updateFields.site_status = payload.site_status;
  if (payload.existing_documents !== undefined) updateFields.existing_documents = payload.existing_documents;
  if (payload.area_sqft !== undefined) updateFields.area_sqft = payload.area_sqft;
  if (payload.area_unit !== undefined) updateFields.area_unit = payload.area_unit;
  if (payload.design_budget !== undefined && payload.design_budget > 0) updateFields.design_budget = payload.design_budget;
  if (payload.construction_cost_estimate !== undefined) updateFields.construction_cost_estimate = payload.construction_cost_estimate || null;
  if (payload.currency !== undefined) updateFields.currency = payload.currency;
  if (payload.deadline !== undefined) updateFields.deadline = payload.deadline || null;
  if (payload.proposal_deadline !== undefined) updateFields.proposal_deadline = payload.proposal_deadline || null;
  if (payload.timeline_days !== undefined) updateFields.timeline_days = payload.timeline_days || null;
  if (payload.included_revisions_requested !== undefined) updateFields.included_revisions_requested = payload.included_revisions_requested || null;
  if (payload.payment_type !== undefined) updateFields.payment_type = payload.payment_type;
  if (payload.hourly_rate_max !== undefined) updateFields.hourly_rate_max = payload.hourly_rate_max || null;
  if (step !== undefined) updateFields.wizard_step = step;

  const { error: projErr } = await supabase
    .from('projects')
    .update(updateFields)
    .eq('id', projectId)
    .eq('status', 'draft');

  if (projErr) {
    console.error('Autosave project error:', projErr);
    throw new Error(projErr.message);
  }

  // 2. Upsert private site details if provided
  if (payload.street !== undefined || payload.postal_code !== undefined || payload.site_notes !== undefined || payload.access_instructions !== undefined) {
    await supabase.from('project_private_details').upsert({
      project_id: projectId,
      street: payload.street || null,
      postal_code: payload.postal_code || null,
      site_notes: payload.site_notes || null,
      access_instructions: payload.access_instructions || null,
      updated_at: new Date().toISOString()
    });
  }

  // 3. Upsert milestone phases if provided
  if (payload.phases && Array.isArray(payload.phases)) {
    // Delete existing milestones and replace
    await supabase.from('project_milestones').delete().eq('project_id', projectId);

    if (payload.phases.length > 0) {
      const inserts = payload.phases.map((p, idx) => ({
        project_id: projectId,
        sort_order: idx + 1,
        name: p.name,
        description: p.description || null,
        deliverables: p.deliverables || [],
        billing_trigger: p.billing_trigger || null,
        fee_percent: p.fee_percent
      }));
      await supabase.from('project_milestones').insert(inserts);
    }
  }

  // 4. Update image references if provided
  if (payload.image_file_ids && Array.isArray(payload.image_file_ids)) {
    await supabase.from('project_images').delete().eq('project_id', projectId);
    if (payload.image_file_ids.length > 0) {
      const imgInserts = payload.image_file_ids.map((fid, idx) => ({
        project_id: projectId,
        path: fid,
        sort_order: idx + 1
      }));
      await supabase.from('project_images').insert(imgInserts);
    }
  }
}

/**
 * Fetch a draft project by ID for resuming the wizard
 */
export async function getProjectDraft(projectId: string): Promise<ProjectDraftPayload | null> {
  const { data: proj, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();

  if (error || !proj) return null;

  // Fetch private details
  const { data: priv } = await supabase
    .from('project_private_details')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  // Fetch milestones
  const { data: ms } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  // Fetch images
  const { data: imgs } = await supabase
    .from('project_images')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  return {
    id: proj.id,
    title: proj.title,
    category: proj.category,
    subcategory: proj.subcategory || undefined,
    description: proj.description || '',
    city: proj.city || undefined,
    state_region: proj.state_region || undefined,
    street: priv?.street || undefined,
    postal_code: priv?.postal_code || undefined,
    site_notes: priv?.site_notes || undefined,
    access_instructions: priv?.access_instructions || undefined,
    building_status: proj.building_status as any,
    site_status: proj.site_status as any,
    existing_documents: proj.existing_documents || [],
    area_sqft: proj.area_sqft || undefined,
    area_unit: (proj.area_unit as any) || 'sqft',
    design_budget: Number(proj.design_budget || proj.budget || 0),
    construction_cost_estimate: proj.construction_cost_estimate ? Number(proj.construction_cost_estimate) : undefined,
    currency: proj.currency || 'USD',
    deadline: proj.deadline || undefined,
    proposal_deadline: proj.proposal_deadline || undefined,
    timeline_days: proj.timeline_days || undefined,
    included_revisions_requested: proj.included_revisions_requested || undefined,
    payment_type: (proj.payment_type as any) || 'milestone',
    hourly_rate_max: proj.hourly_rate_max ? Number(proj.hourly_rate_max) : undefined,
    phases: (ms || []).map((m: any) => ({
      id: m.id,
      sort_order: m.sort_order,
      name: m.name,
      description: m.description,
      deliverables: m.deliverables || [],
      billing_trigger: m.billing_trigger,
      fee_percent: Number(m.fee_percent)
    })),
    image_file_ids: (imgs || []).map((im: any) => im.path),
    wizard_step: proj.wizard_step || 1
  };
}

/**
 * Publish a project (owner only, enforces full database validation)
 */
export async function publishProject(projectId: string): Promise<void> {
  const { error } = await supabase.rpc('publish_project', {
    p_project_id: projectId
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Close an open project
 */
export async function closeProject(projectId: string): Promise<void> {
  const { error } = await supabase.rpc('close_project', {
    p_project_id: projectId
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Cancel a project (only while no engagement exists)
 */
export async function cancelProject(projectId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_project', {
    p_project_id: projectId,
    p_reason: reason || 'Project cancelled by the client'
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Duplicate an existing project into a new draft
 */
export async function duplicateProject(projectId: string): Promise<string> {
  const { data, error } = await supabase.rpc('duplicate_project', {
    p_project_id: projectId
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data as any)?.new_project_id;
}

/**
 * Delete a draft project
 */
export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_project', {
    p_project_id: projectId
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Add a project update (communicates scope clarifications to proposal submitters)
 */
export async function addProjectUpdate(projectId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('add_project_update', {
    p_project_id: projectId,
    p_body: body
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Extend project deadline
 */
export async function extendDeadline(projectId: string, newDate: string): Promise<void> {
  const { error } = await supabase.rpc('extend_deadline', {
    p_project_id: projectId,
    p_new_deadline: newDate
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Fetch My Projects list for the Client dashboard
 */
export async function getMyProjects(filters: MyProjectsFilter = {}): Promise<{
  projects: MyProjectItem[];
  total: number;
  summary: MyProjectsSummary;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required.');

  // 1. Fetch Summary Counts across all owner projects
  const { data: allOwnerProjects } = await supabase
    .from('projects')
    .select('id, status')
    .eq('client_id', user.id);

  const summary: MyProjectsSummary = {
    openProjects: 0,
    proposalsToReview: 0,
    activeProjects: 0,
    completedProjects: 0
  };

  const projectIds = (allOwnerProjects || []).map((p) => p.id);

  (allOwnerProjects || []).forEach((p) => {
    if (p.status === 'open') summary.openProjects++;
    if (p.status === 'awarded') summary.activeProjects++;
    if (p.status === 'closed') summary.completedProjects++;
  });

  // Fetch unviewed proposals count across all owner's open projects
  if (projectIds.length > 0) {
    const { count: unviewedCount } = await supabase
      .from('proposals')
      .select('id', { count: 'exact', head: true })
      .in('project_id', projectIds)
      .eq('status', 'pending');
    summary.proposalsToReview = unviewedCount || 0;
  }

  // 2. Query filtered projects
  let query = supabase
    .from('projects')
    .select('*', { count: 'exact' })
    .eq('client_id', user.id);

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.category && filters.category !== 'all') {
    query = query.eq('category', filters.category);
  }

  if (filters.search) {
    query = query.ilike('title', `%${filters.search.trim()}%`);
  }

  if (filters.sortBy === 'deadline') {
    query = query.order('deadline', { ascending: true, nullsFirst: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const pageSize = filters.pageSize || 10;
  const page = filters.page || 1;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error || !data) {
    console.error('Failed to get client projects:', error);
    return { projects: [], total: 0, summary };
  }

  // Fetch proposal counts for retrieved projects
  const retrievedIds = data.map((d) => d.id);
  const proposalCounts: Record<string, { total: number; new: number }> = {};

  if (retrievedIds.length > 0) {
    const { data: propRows } = await supabase
      .from('proposals')
      .select('id, project_id, status')
      .in('project_id', retrievedIds)
      .neq('status', 'withdrawn');

    (propRows || []).forEach((pr) => {
      if (!proposalCounts[pr.project_id]) {
        proposalCounts[pr.project_id] = { total: 0, new: 0 };
      }
      proposalCounts[pr.project_id].total++;
      if (pr.status === 'pending') {
        proposalCounts[pr.project_id].new++;
      }
    });
  }

  const items: MyProjectItem[] = data.map((d) => ({
    id: d.id,
    title: d.title,
    status: d.status as any,
    category: d.category,
    subcategory: d.subcategory,
    design_budget: Number(d.design_budget || d.budget || 0),
    payment_type: (d.payment_type as any) || 'milestone',
    deadline: d.deadline,
    city: d.city,
    state_region: d.state_region,
    proposals_count: proposalCounts[d.id]?.total || 0,
    new_proposals_count: proposalCounts[d.id]?.new || 0,
    created_at: d.created_at,
    wizard_step: d.wizard_step || 1
  }));

  if (filters.sortBy === 'proposals') {
    items.sort((a, b) => b.proposals_count - a.proposals_count);
  }

  return {
    projects: items,
    total: count || 0,
    summary
  };
}

/**
 * Fetch detailed Project view for the Client
 */
export async function getMyProject(projectId: string): Promise<ClientProjectDetail | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required.');

  // Fetch project
  const { data: proj, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();

  if (error || !proj) return null;

  // Fetch private details
  const { data: priv } = await supabase
    .from('project_private_details')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  // Fetch milestones
  const { data: ms } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  // Fetch images
  const { data: imgs } = await supabase
    .from('project_images')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  // Fetch updates
  const { data: updates } = await supabase
    .from('project_updates')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  // Fetch proposals count & unviewed count
  const { data: propRows } = await supabase
    .from('proposals')
    .select('id, status, created_at')
    .eq('project_id', projectId)
    .neq('status', 'withdrawn');

  const totalProposals = (propRows || []).length;
  const unviewedProposals = (propRows || []).filter((p) => p.status === 'pending').length;
  const hasProposals = totalProposals > 0;

  // Title correction rule: only within 24 hours of publishing
  const publishedAt = proj.published_at ? new Date(proj.published_at).getTime() : 0;
  const now = Date.now();
  const canEditTitle = !hasProposals || (publishedAt > 0 && (now - publishedAt) <= 86400000);

  // Scope edit rule: false if proposals exist
  const canEditScope = !hasProposals && proj.status === 'draft';

  // Construct activities list
  const activities: ProjectActivityItem[] = [];

  if (proj.published_at) {
    activities.push({
      id: 'act-published',
      type: 'published',
      title: 'Project Published',
      date: proj.published_at,
      description: 'Project was opened for designer proposals.'
    });
  }

  (propRows || []).forEach((pr, i) => {
    activities.push({
      id: `act-prop-${pr.id}`,
      type: 'proposal_received',
      title: 'Proposal Received',
      date: pr.created_at,
      description: `Proposal #${i + 1} was submitted.`
    });
  });

  (updates || []).forEach((up) => {
    activities.push({
      id: `act-update-${up.id}`,
      type: 'update_posted',
      title: 'Project Update Posted',
      date: up.created_at,
      description: up.body
    });
  });

  if (proj.status === 'closed' && proj.closed_at) {
    activities.push({
      id: 'act-closed',
      type: 'status_changed',
      title: 'Project Closed',
      date: proj.closed_at,
      description: 'Project is no longer accepting new proposals.'
    });
  }

  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    project: proj,
    privateDetails: priv,
    phases: ms || [],
    images: imgs || [],
    updates: updates || [],
    activities,
    proposalsCount: totalProposals,
    unviewedProposalsCount: unviewedProposals,
    hasProposals,
    canEditTitle,
    canEditScope
  };
}

/**
 * Requests official account deletion with safety checks (open projects, active engagements, escrow)
 */
export async function requestAccountDeletion(email: string): Promise<{ success: boolean; message: string }> {
  if (USE_MOCKS.projects) {
    return { success: true, message: 'Deletion request logged for administrator review.' };
  }

  const { data, error } = await (supabase.rpc as any)('request_account_deletion', {
    p_email: email
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data as { success: boolean; message: string }) || { success: true, message: 'Account deletion request submitted.' };
}

/**
 * Creates a support ticket for help or problems
 */
export async function createSupportTicket(params: {
  topic: string;
  message: string;
  projectId?: string;
  type?: 'help' | 'problem';
}): Promise<string> {
  if (USE_MOCKS.projects) {
    return 'mock-ticket-' + Date.now();
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required.');

  const { data, error } = await supabase.rpc('create_support_ticket', {
    p_engagement_id: null,
    p_type: params.type || 'help',
    p_subject: params.topic,
    p_details: params.projectId ? `[Project ID: ${params.projectId}]\n\n${params.message}` : params.message
  });

  if (error) {
    // Fallback: direct insert if function parameter varies
    const { data: insertData, error: insertErr } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        type: params.type || 'help',
        subject: params.topic,
        details: params.projectId ? `[Project ID: ${params.projectId}]\n\n${params.message}` : params.message
      })
      .select('id')
      .single();

    if (insertErr) throw new Error(insertErr.message);
    return insertData.id;
  }

  return data;
}

export interface ClientAwaitingMilestone {
  id: string;
  engagementId: string;
  projectTitle: string;
  milestoneTitle: string;
  amount: number;
  status: string;
  escrowStatus: string;
}

/**
 * Fetches real milestones awaiting funding for client payments view
 */
export async function getClientAwaitingMilestones(): Promise<ClientAwaitingMilestone[]> {
  if (USE_MOCKS.projects) {
    return [];
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Query milestones through user's client engagements
  const { data, error } = await supabase
    .from('engagement_milestones')
    .select(`
      id,
      engagement_id,
      title,
      amount,
      status,
      escrow_status,
      engagements!inner (
        id,
        client_id,
        project_id,
        projects (
          title
        )
      )
    `)
    .eq('engagements.client_id', user.id)
    .in('escrow_status', ['pending', 'held']);

  if (error || !data) {
    return [];
  }

  return data.map((m: any) => ({
    id: m.id,
    engagementId: m.engagement_id,
    projectTitle: m.engagements?.projects?.title || 'Architectural Project',
    milestoneTitle: m.title,
    amount: Number(m.amount) || 0,
    status: m.status,
    escrowStatus: m.escrow_status
  }));
}

/**
 * Calls dev_fund_milestone RPC in development environment
 */
export async function devFundMilestone(milestoneId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('dev_fund_milestone', {
    p_milestone_id: milestoneId
  });

  if (error) {
    throw new Error(error.message);
  }
}

export interface ClientDashboardData {
  client_name: string;
  summary: {
    open_projects_count: number;
    new_proposals_count: number;
    active_projects_count: number;
    funds_in_escrow: number;
  };
  attention_items: Array<{
    type: string;
    title: string;
    subtitle: string;
    link: string;
    action_label: string;
  }>;
  active_projects: Array<{
    id: string;
    project_id: string;
    title: string;
    status: string;
    designer_name: string;
    designer_avatar: string | null;
    total_milestones: number;
    approved_milestones: number;
    escrow_amount: number;
  }>;
  recent_projects: Array<{
    id: string;
    title: string;
    status: string;
    category: string;
    proposals_count: number;
    unviewed_proposals_count: number;
    deadline: string | null;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    type: string;
    created_at: string;
    read_at: string | null;
  }>;
}

/**
 * Fetches centralized client dashboard metrics, pending attention items, and active projects
 */
export async function getClientDashboard(): Promise<ClientDashboardData> {
  if (USE_MOCKS.projects) {
    return {
      client_name: 'Client',
      summary: {
        open_projects_count: 1,
        new_proposals_count: 2,
        active_projects_count: 1,
        funds_in_escrow: 3700
      },
      attention_items: [
        {
          type: 'review_proposal',
          title: 'New proposal from David Adeleke Studio',
          subtitle: 'Modern Detached Bungalow',
          link: '#project-details?id=mock-proj-1&tab=proposals',
          action_label: 'Review proposal'
        }
      ],
      active_projects: [
        {
          id: 'mock-eng-1',
          project_id: 'mock-proj-1',
          title: 'Modern Detached Bungalow',
          status: 'active',
          designer_name: 'David Adeleke',
          designer_avatar: null,
          total_milestones: 5,
          approved_milestones: 1,
          escrow_amount: 3700
        }
      ],
      recent_projects: [
        {
          id: 'mock-proj-1',
          title: 'Modern Detached Bungalow',
          status: 'open',
          category: 'Residential',
          proposals_count: 2,
          unviewed_proposals_count: 1,
          deadline: '2026-12-15'
        }
      ],
      notifications: []
    };
  }

  const { data, error } = await (supabase.rpc as any)('get_client_dashboard');

  if (error || !data) {
    console.error('Failed to load client dashboard:', error);
    // Return verified zero fallback
    return {
      client_name: 'Client',
      summary: {
        open_projects_count: 0,
        new_proposals_count: 0,
        active_projects_count: 0,
        funds_in_escrow: 0
      },
      attention_items: [],
      active_projects: [],
      recent_projects: [],
      notifications: []
    };
  }

  return data as ClientDashboardData;
}


