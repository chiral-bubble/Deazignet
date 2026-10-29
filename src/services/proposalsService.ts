/**
 * Proposals Service for Dezignet
 * Clean service layer connecting My Proposals (list & detail) to the shared dataset.
 */

import {
  sharedDataset,
  type SharedProposal,
  type SharedProject,
  type SharedActiveProject
} from '../mocks/dataset';
import { PLAN_TIERS_CONFIG } from '../config/paymentsConfig';

function delay(ms = 120): Promise<void> {
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

export async function getMyProposalsList(
  filters?: ProposalFilterOptions
): Promise<{
  proposals: SharedProposal[];
  tabCounts: Record<ProposalStatusTab, number>;
}> {
  await delay(100);

  const all = [...sharedDataset.proposals];

  // Calculate tab counts
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
    const targetStatus = filters.tab.toLowerCase();
    filtered = filtered.filter((p) => p.status === targetStatus);
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.projectTitle.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        p.clientLocation.toLowerCase().includes(q)
    );
  }

  if (filters?.paymentType && filters.paymentType !== 'all') {
    filtered = filtered.filter((p) => p.paymentType === filters.paymentType);
  }

  if (filters?.sortBy === 'price-high') {
    filtered.sort((a, b) => b.proposedPrice - a.proposedPrice);
  } else {
    // Default newest (already sorted)
  }

  return { proposals: filtered, tabCounts };
}

export async function getProposalDetail(
  id: string
): Promise<{
  proposal: SharedProposal;
  projectSnapshot: SharedProject;
  clientInfo: any;
} | null> {
  await delay(120);

  const proposal = sharedDataset.proposals.find((p) => p.id === id);
  if (!proposal) return null;

  const projectSnapshot =
    sharedDataset.projects.find((p) => p.id === proposal.projectId) ||
    sharedDataset.projects[0];

  const clientInfo =
    sharedDataset.clients.find((c) => c.name === proposal.clientName) ||
    sharedDataset.clients[0];

  return {
    proposal: JSON.parse(JSON.stringify(proposal)),
    projectSnapshot: JSON.parse(JSON.stringify(projectSnapshot)),
    clientInfo: JSON.parse(JSON.stringify(clientInfo))
  };
}

export async function editProposal(
  id: string,
  updates: Partial<SharedProposal>
): Promise<SharedProposal> {
  await delay(180);

  const p = sharedDataset.proposals.find((item) => item.id === id);
  if (!p) throw new Error('Proposal not found');

  Object.assign(p, updates);
  p.editCount = (p.editCount || 0) + 1;

  return JSON.parse(JSON.stringify(p));
}

export async function withdrawProposal(
  id: string,
  reason?: string
): Promise<boolean> {
  await delay(160);
  return sharedDataset.withdrawProposalInMock(id, reason);
}

export async function acceptProposalDev(
  id: string
): Promise<SharedActiveProject | null> {
  await delay(200);
  return sharedDataset.acceptProposalInMock(id);
}

export async function getProposalUsage(): Promise<ProposalUsageInfo> {
  await delay(80);

  const currentPlan =
    PLAN_TIERS_CONFIG.find((t) => t.id === sharedDataset.planState.currentPlanId) ||
    PLAN_TIERS_CONFIG[1];

  const limit = currentPlan.proposalsPerMonth;
  const used = sharedDataset.planState.proposalsUsedThisMonth;

  return {
    used,
    limit,
    planName: currentPlan.name,
    isUnlimited: currentPlan.id === 'upgraded'
  };
}
