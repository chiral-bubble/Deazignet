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
    id: 'proj-lagos-residence',
    title: 'Luxury Smart Home Residence, Victoria Island Lagos',
    category: 'Residential',
    subcategory: 'Smart Home',
    description: 'A 5-bedroom smart home project on Victoria Island. Requirements include automated lighting, security, HVAC integration and a rooftop terrace with infinity pool.',
    budget: 75000,
    currency: 'USD',
    paymentType: 'Milestone',
    timeline: '16 Weeks',
    deadline: 'In 10 days',
    area: 4800,
    location: 'Victoria Island, Lagos State',
    city: 'Victoria Island',
    stateRegion: 'Lagos State',
    postedDate: '1 day ago',
    proposalsCount: 3,
    status: 'Open',
    isSaved: false,
    hasApplied: false,
    client: {
      id: 'client-mock-1',
      name: 'Adaobi Okafor',
      location: 'Lagos, Nigeria',
      memberSince: 'January 2023',
      projectsPosted: 2,
      paymentVerified: true,
      avatarText: 'AO'
    },
    referenceImages: [],
    milestones: standardMilestonePhases
  },
  {
    id: 'proj-abuja-commercial',
    title: 'Mixed-Use Commercial Tower, Abuja Central District',
    category: 'Commercial',
    subcategory: 'Mixed-Use Tower',
    description: 'A 12-story mixed-use development combining retail, office and residential units in Abuja. Looking for a lead architect with experience in high-rise structural design.',
    budget: 195000,
    currency: 'USD',
    paymentType: 'Milestone',
    timeline: '40 Weeks',
    deadline: 'In 18 days',
    area: 28000,
    location: 'Abuja, FCT',
    city: 'Abuja',
    stateRegion: 'FCT',
    postedDate: '3 days ago',
    proposalsCount: 8,
    status: 'Open',
    isSaved: true,
    hasApplied: false,
    client: {
      id: 'client-mock-2',
      name: 'Emeka Nwosu',
      location: 'Abuja, Nigeria',
      memberSince: 'March 2022',
      projectsPosted: 5,
      paymentVerified: true,
      avatarText: 'EN'
    },
    referenceImages: [],
    milestones: standardMilestonePhases
  },
  {
    id: 'proj-ph-hotel',
    title: 'Boutique Waterfront Hotel, Port Harcourt',
    category: 'Hospitality',
    subcategory: 'Boutique Hotel',
    description: 'A 40-key boutique hotel on the Port Harcourt waterfront. Emphasis on natural ventilation, local materials, and panoramic views of the Bonny River.',
    budget: 120000,
    currency: 'USD',
    paymentType: 'Hourly',
    hourlyRate: 85,
    timeline: '24 Weeks',
    deadline: 'In 14 days',
    area: 12000,
    location: 'Port Harcourt, Rivers State',
    city: 'Port Harcourt',
    stateRegion: 'Rivers State',
    postedDate: '2 days ago',
    proposalsCount: 5,
    status: 'Open',
    isSaved: false,
    hasApplied: true,
    appliedProposalId: 'mock-prop-001',
    client: {
      id: 'client-mock-3',
      name: 'Chidinma Eze',
      location: 'Port Harcourt, Nigeria',
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
