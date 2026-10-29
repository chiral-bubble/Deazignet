/**
 * ONE Shared Mock Dataset for Dezignet Designer Experience
 * 
 * Provides unified, consistent data across:
 * - Dashboard
 * - Client Projects Feed & Details
 * - My Proposals (List & Detail)
 * - Active Projects Workspace
 * - Conversations & Real-time Messages
 * - Payments, Balances, Transactions, Payout Accounts & Plan Tiers
 * - Notifications
 * - Public Designer Profiles
 * 
 * All IDs, amounts, client names, and milestone statuses are 100% synchronized.
 */

import { PAYMENTS_CONFIG } from '../config/paymentsConfig';

// ============================================================================
// RELATIVE DATE HELPERS
// ============================================================================
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

export function formatRelativeDate(isoDateStr: string): string {
  const target = new Date(isoDateStr).getTime();
  const now = new Date().getTime();
  const diffDays = Math.round((now - target) / (1000 * 3600 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 0 && diffDays > -7) return `In ${Math.abs(diffDays)} days`;
  return isoDateStr;
}

// ============================================================================
// DATA MODELS
// ============================================================================
export interface SharedClient {
  id: string;
  name: string;
  company?: string;
  location: string;
  avatarUrl?: string;
  memberSince: string;
  projectsPosted: number;
  paymentMethodVerified: boolean;
  totalSpent: number;
}

export interface MilestonePhase {
  id: string;
  title: string;
  feePercentage: number;
  amount: number;
  deliverablesSummary: string;
  dueDate: string;
  status: 'funded' | 'in_progress' | 'in_review' | 'approved_released' | 'upcoming';
  submittedDeliverableUrl?: string;
  submittedAt?: string;
  clientFeedback?: string;
}

export interface SharedProject {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  clientCompany?: string;
  clientLocation: string;
  paymentType: 'Milestone' | 'Hourly';
  category: string;
  budget: number;
  deadline: string;
  location: string;
  shortDescription: string;
  fullDescription: string;
  facts: {
    propertyType: string;
    projectScale: string;
    regulatoryZone: string;
    estimatedDuration: string;
  };
  status: 'open' | 'active' | 'completed';
  wasUpdatedSinceApplication?: boolean;
}

export interface SharedProposal {
  id: string;
  projectId: string;
  projectTitle: string;
  clientName: string;
  clientLocation: string;
  paymentType: 'Milestone' | 'Hourly';
  proposedPrice: number;
  clientBudget: number;
  deliveryTime: string;
  sentDate: string;
  status: 'pending' | 'viewed' | 'shortlisted' | 'accepted' | 'declined' | 'withdrawn';
  statusHint?: string;
  coverLetter: string;
  phases: MilestonePhase[];
  hourlyRate?: number;
  estimatedHours?: number;
  attachedPortfolioIds: string[];
  clientQuestionsAndAnswers: Array<{ question: string; answer?: string }>;
  declinedReason?: string;
  withdrawnReason?: string;
  timeline: Array<{ stage: string; date?: string; completed: boolean }>;
  editCount: number;
  hasClientMessaged: boolean;
  conversationId?: string;
}

export interface SharedActiveProject {
  id: string;
  projectId: string;
  title: string;
  clientId: string;
  clientName: string;
  clientCompany?: string;
  clientLocation: string;
  paymentType: 'Milestone' | 'Hourly';
  status: 'awaiting_deliverable' | 'in_review' | 'approved_released' | 'active_hourly';
  statusLabel: string;
  category: string;
  totalBudget: number;
  inEscrowAmount: number;
  milestones: MilestonePhase[];
  currentMilestoneName?: string;
  completedMilestonesCount?: number;
  totalMilestonesCount?: number;
  nextDeadline?: string;
  relativeDeadline?: string;
  escrowCurrentMilestone?: number;
  isDeliverableDue?: boolean;
  hasUploadedDeliverable?: boolean;
  awaitingReview?: boolean;
  // Hourly specific
  hoursThisWeek?: number;
  hourlyRate?: number;
  unbilledAmount?: number;
  totalHoursLogged?: number;
}

export interface SharedTransaction {
  id: string;
  referenceId: string;
  date: string;
  description: string;
  projectId?: string;
  projectName?: string;
  milestoneTitle?: string;
  type:
    | 'Milestone released'
    | 'Hourly invoice paid'
    | 'Platform fee'
    | 'Withdrawal'
    | 'Plan charge'
    | 'Refund'
    | 'Adjustment';
  grossAmount: number;
  feeAmount: number;
  feePercentage: number;
  netAmount: number;
  status: 'Completed' | 'Pending' | 'Held' | 'Failed' | 'Disputed';
  statusNote?: string;
  payoutAccountMasked?: string;
  timeline: Array<{ event: string; timestamp: string }>;
}

export interface SharedPayoutAccount {
  id: string;
  bankName: string;
  accountNumberMasked: string; // ••••••4821
  accountName: string;
  verificationStatus: 'Verified' | 'Pending';
  isDefault: boolean;
  currency: 'USD' | 'USD';
}

export interface SharedWithdrawal {
  id: string;
  reference: string;
  date: string;
  amount: number;
  destinationAccount: string;
  bankName: string;
  status: 'Processing' | 'Paid' | 'Failed';
  failureReason?: string;
}

export interface ConversationAttachment {
  id: string;
  name: string;
  sizeBytes: number;
  type: 'image' | 'pdf' | 'cad' | 'doc';
  url: string;
  thumbnailUrl?: string;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string; // 'designer' or client id
  senderName: string;
  isSelf: boolean;
  text: string;
  timestamp: string;
  dateString: string;
  status: 'Sent' | 'Delivered' | 'Read';
  isSystemMessage?: boolean;
  attachments?: ConversationAttachment[];
}

export interface SharedConversation {
  id: string;
  clientId: string;
  clientName: string;
  clientCompany?: string;
  clientLocation: string;
  clientAvatarUrl?: string;
  projectId: string;
  projectTitle: string;
  proposalId?: string;
  proposalStatus: string;
  lastMessageSnippet: string;
  lastMessageTime: string;
  unreadCount: number;
  isMuted: boolean;
  isArchived: boolean;
  isClosed: boolean;
  hasClientInitiated: boolean;
  messages: MessageItem[];
}

export interface SharedNotification {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  type: 'message' | 'milestone' | 'payment' | 'proposal' | 'system';
  isUnread: boolean;
  actionUrl?: string;
}

export interface SharedPlanState {
  currentPlanId: 'free' | 'basic' | 'upgraded';
  billingCycle: 'monthly' | 'yearly';
  renewsAt: string;
  paymentMethod: {
    brand: 'Visa' | 'Mastercard';
    last4: string;
    expMonth: number;
    expYear: number;
    isDefault: boolean;
  };
  proposalsUsedThisMonth: number;
}

export type GlobalMockState = 'full' | 'incomplete' | 'empty' | 'loading' | 'error';

// ============================================================================
// SINGLE SOURCE OF TRUTH DATASET
// ============================================================================

export class DezignetSharedDataset {
  private mockState: GlobalMockState = 'full';

  // Clients
  public clients: SharedClient[] = [
    {
      id: 'client-1',
      name: 'Dr. Tariq Al-Mansoor',
      company: 'Apex Capital Partners',
      location: 'Zurich, Switzerland',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
      memberSince: 'January 2023',
      projectsPosted: 7,
      paymentMethodVerified: true,
      totalSpent: 125000
    },
    {
      id: 'client-2',
      name: 'Sophia Montgomery',
      company: 'Horizon Ventures',
      location: 'City of London, UK',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
      memberSince: 'June 2022',
      projectsPosted: 12,
      paymentMethodVerified: true,
      totalSpent: 210000
    },
    {
      id: 'client-3',
      name: 'Marcus Vance',
      company: 'Vance Holdings',
      location: 'Malibu Coast, California',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      memberSince: 'March 2021',
      projectsPosted: 9,
      paymentMethodVerified: true,
      totalSpent: 165000
    },
    {
      id: 'client-4',
      name: 'Alexander Wright',
      company: 'Pacific Maritime Partners',
      location: 'San Francisco Bay, California',
      avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80',
      memberSince: 'November 2023',
      projectsPosted: 4,
      paymentMethodVerified: true,
      totalSpent: 85000
    },
    {
      id: 'client-5',
      name: 'Ambassador David Lindqvist',
      company: 'Nordic Diplomatic Mission',
      location: 'Geneva Diplomatic Quarter, Switzerland',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      memberSince: 'February 2024',
      projectsPosted: 3,
      paymentMethodVerified: true,
      totalSpent: 62000
    }
  ];

  // Projects
  public projects: SharedProject[] = [
    {
      id: 'proj-1',
      title: 'Modern Cantilevered Residence, Zurich',
      clientId: 'client-1',
      clientName: 'Dr. Tariq Al-Mansoor',
      clientCompany: 'Apex Capital Partners',
      clientLocation: 'Zurich, Switzerland',
      paymentType: 'Milestone',
      category: 'Residential Architecture',
      budget: 45000,
      deadline: daysFromNow(21),
      location: 'Zurich Gold Coast, Switzerland',
      shortDescription: 'Multi-level cantilevered reinforced concrete residence with lagoon waterfront orientation and cedar brise-soleil.',
      fullDescription: 'Bespoke residential estate requiring structural coordination for 6-meter cantilevers over private waterfront lagoon frontage. Includes passive ventilation corridors and smart lighting integration.',
      facts: {
        propertyType: 'Waterfront Villa',
        projectScale: '850 sqm Built Area',
        regulatoryZone: 'Zurich Waterfront Planning Zone A',
        estimatedDuration: '4 months'
      },
      status: 'active'
    },
    {
      id: 'proj-2',
      title: 'Fintech Headquarters Workspace Architecture, London',
      clientId: 'client-2',
      clientName: 'Sophia Montgomery',
      clientCompany: 'Horizon Ventures',
      clientLocation: 'Canary Wharf, London',
      paymentType: 'Hourly',
      category: 'Commercial Interiors & Architecture',
      budget: 28000,
      deadline: daysFromNow(45),
      location: 'Central District, Zurich',
      shortDescription: 'High-density biophilic tech workspace across 3 floors with acoustic timber paneling and executive boardroom.',
      fullDescription: 'Comprehensive workplace transformation incorporating agile collaboration hubs, acoustic isolation baffles, and sustainable local walnut woodwork.',
      facts: {
        propertyType: 'Commercial Corporate Floorplate',
        projectScale: '2,400 sqm',
        regulatoryZone: 'Zurich City Commercial Core',
        estimatedDuration: 'Ongoing retainer'
      },
      status: 'active'
    },
    {
      id: 'proj-3',
      title: 'Geneva Diplomatic Executive Lounge',
      clientId: 'client-5',
      clientName: 'Ambassador David Lindqvist',
      clientCompany: 'Nordic Diplomatic Mission',
      clientLocation: 'Geneva Diplomatic Quarter, Switzerland',
      paymentType: 'Milestone',
      category: 'Hospitality & Diplomatic',
      budget: 38000,
      deadline: daysFromNow(30),
      location: 'Geneva Diplomatic Quarter, Switzerland',
      shortDescription: 'Executive reception and private diplomatic dining lounge combining Nordic minimalism with bespoke brushed brass accents.',
      fullDescription: 'Refined diplomatic protocol salon requiring bespoke acoustic paneling, hand-carved mahogany pivot doors, and diplomatic security clearance standards.',
      facts: {
        propertyType: 'Diplomatic Compound Suite',
        projectScale: '420 sqm',
        regulatoryZone: 'Geneva International District',
        estimatedDuration: '2.5 months'
      },
      status: 'open'
    },
    {
      id: 'proj-4',
      title: 'Lakefront Contemporary Villa, Lucerne',
      clientId: 'client-3',
      clientName: 'Marcus Vance',
      clientCompany: 'Vance Holdings',
      clientLocation: 'Malibu Coast, California',
      paymentType: 'Milestone',
      category: 'Residential Architecture',
      budget: 65000,
      deadline: daysFromNow(60),
      location: 'Malibu, California',
      shortDescription: 'Contemporary five-bedroom luxury villa with infinity pool, limestone flooring, and automated solar harvesting.',
      fullDescription: 'Turnkey architectural concept and working drawings for high-net-worth client. Emphasis on flood mitigation, passive cooling, and private rooftop entertainment deck.',
      facts: {
        propertyType: 'Private Estate',
        projectScale: '1,100 sqm',
        regulatoryZone: 'Lucerne Lakefront Residential',
        estimatedDuration: '5 months'
      },
      status: 'open',
      wasUpdatedSinceApplication: true
    },
    {
      id: 'proj-5',
      title: 'Rotterdam Port Logistics Command Hub',
      clientId: 'client-4',
      clientName: 'Alexander Wright',
      clientCompany: 'Pacific Maritime Partners',
      clientLocation: 'San Francisco Bay, California',
      paymentType: 'Milestone',
      category: 'Industrial & Marine',
      budget: 120000,
      deadline: daysFromNow(90),
      location: 'Rotterdam Harbour, Netherlands',
      shortDescription: 'Hurricane-resistant long-span steel logistics headquarters featuring elevated pile foundation and solar microgrid.',
      fullDescription: 'Marine engineering and architectural logistics facility in swamp terrain requiring specialized foundation stabilization.',
      facts: {
        propertyType: 'Marine Industrial Hub',
        projectScale: '4,500 sqm',
        regulatoryZone: 'Rotterdam Port Free Trade Zone',
        estimatedDuration: '8 months'
      },
      status: 'open'
    }
  ];

  // Active Projects (Dashboard & Active Projects Tab)
  public activeProjects: SharedActiveProject[] = [
    {
      id: 'act-1',
      projectId: 'proj-1',
      title: 'Modern Cantilevered Residence, Zurich',
      clientId: 'client-1',
      clientName: 'Dr. Tariq Al-Mansoor',
      clientCompany: 'Apex Capital Partners',
      clientLocation: 'Zurich, Switzerland',
      paymentType: 'Milestone',
      status: 'in_review',
      statusLabel: 'Milestone 2 In Review',
      category: 'Residential Architecture',
      totalBudget: 45000,
      inEscrowAmount: 30000,
      currentMilestoneName: 'Phase 2: Detailed Architectural & Working Drawings',
      completedMilestonesCount: 1,
      totalMilestonesCount: 3,
      nextDeadline: daysFromNow(3),
      relativeDeadline: 'Due in 3 days',
      escrowCurrentMilestone: 15000,
      isDeliverableDue: true,
      hasUploadedDeliverable: true,
      awaitingReview: true,
      milestones: [
        {
          id: 'ms-1-1',
          title: 'Phase 1: Conceptual Schematic & Lagoon Elevation Studies',
          feePercentage: 33.33,
          amount: 15000,
          deliverablesSummary: 'Complete concept sketch set, 3D renderings, and lagoon line of sight calculations.',
          dueDate: daysAgo(14),
          status: 'approved_released',
          submittedDeliverableUrl: 'https://dezignet.studio/files/zurich-schematic-pack.pdf',
          submittedAt: daysAgo(16),
          clientFeedback: 'Approved without reservation. Superb spatial clarity.'
        },
        {
          id: 'ms-1-2',
          title: 'Phase 2: Detailed Architectural & Working Drawings',
          feePercentage: 33.33,
          amount: 15000,
          deliverablesSummary: 'CAD construction documentation, cantilever structural framing schedule, and window schedules.',
          dueDate: daysFromNow(3),
          status: 'in_review',
          submittedDeliverableUrl: 'https://dezignet.studio/files/zurich-phase2-working-dwgs.pdf',
          submittedAt: daysAgo(1),
          clientFeedback: 'Reviewing working drawings with structural contractor.'
        },
        {
          id: 'ms-1-3',
          title: 'Phase 3: Material Specifications & Tender Documentation',
          feePercentage: 33.34,
          amount: 15000,
          deliverablesSummary: 'Comprehensive finish schedule, BOQ review, and local council submission pack.',
          dueDate: daysFromNow(21),
          status: 'funded'
        }
      ]
    },
    {
      id: 'act-2',
      projectId: 'proj-2',
      title: 'Fintech Headquarters Workspace Architecture, London',
      clientId: 'client-2',
      clientName: 'Sophia Montgomery',
      clientCompany: 'Horizon Ventures',
      clientLocation: 'City of London',
      paymentType: 'Hourly',
      status: 'active_hourly',
      statusLabel: 'Active Hourly Retainer',
      category: 'Commercial Interiors',
      totalBudget: 28000,
      inEscrowAmount: 2000,
      hoursThisWeek: 18.5,
      hourlyRate: 140,
      unbilledAmount: 2590,
      totalHoursLogged: 84,
      milestones: []
    }
  ];

  // Proposals (My Proposals Tab & Dashboard Proposals Table)
  public proposals: SharedProposal[] = [
    {
      id: 'prop-1',
      projectId: 'proj-1',
      projectTitle: 'Modern Cantilevered Residence, Zurich',
      clientName: 'Dr. Tariq Al-Mansoor',
      clientLocation: 'Zurich, Switzerland',
      paymentType: 'Milestone',
      proposedPrice: 45000,
      clientBudget: 45000,
      deliveryTime: '4 months',
      sentDate: daysAgo(35),
      status: 'accepted',
      statusHint: 'Accepted • Active Commission',
      coverLetter: 'Dear Dr. Tariq, our studio has engineered multiple cantilevered residences across Zurich and Lucerne lakefronts. We propose a climate-responsive passive cooling scheme that integrates natural cedar louvers and monolithic concrete elements.',
      phases: [
        {
          id: 'p1-ph1',
          title: 'Schematic Design & 3D Concept',
          feePercentage: 33.33,
          amount: 15000,
          deliverablesSummary: 'Massing studies, 3D renderings, and environmental sunlight study.',
          dueDate: daysAgo(14),
          status: 'approved_released'
        },
        {
          id: 'p1-ph2',
          title: 'Working Drawings & Structural Coordination',
          feePercentage: 33.33,
          amount: 15000,
          deliverablesSummary: 'Detailed CAD set and cantilever reinforcement layouts.',
          dueDate: daysFromNow(3),
          status: 'in_review'
        },
        {
          id: 'p1-ph3',
          title: 'Council Approval & Tender Specifications',
          feePercentage: 33.34,
          amount: 15000,
          deliverablesSummary: 'Statutory approvals pack and tender review documentation.',
          dueDate: daysFromNow(21),
          status: 'funded'
        }
      ],
      attachedPortfolioIds: ['port-1', 'port-4'],
      clientQuestionsAndAnswers: [
        {
          question: 'Do you have direct experience with Swiss Cantonal Building & Structural approvals?',
          answer: 'Yes, our principal is a registered SIA Fellow and has cleared 14 approvals in Zurich Canton in the last 3 years.'
        }
      ],
      timeline: [
        { stage: 'Sent', date: daysAgo(35), completed: true },
        { stage: 'Viewed', date: daysAgo(34), completed: true },
        { stage: 'Shortlisted', date: daysAgo(32), completed: true },
        { stage: 'Accepted', date: daysAgo(30), completed: true }
      ],
      editCount: 0,
      hasClientMessaged: true,
      conversationId: 'conv-1'
    },
    {
      id: 'prop-2',
      projectId: 'proj-2',
      projectTitle: 'Fintech Headquarters Workspace Architecture, London',
      clientName: 'Sophia Montgomery',
      clientLocation: 'City of London',
      paymentType: 'Hourly',
      proposedPrice: 140, // per hour
      clientBudget: 28000,
      deliveryTime: 'Ongoing Retainer',
      sentDate: daysAgo(28),
      status: 'accepted',
      statusHint: 'Accepted • Active Hourly',
      coverLetter: 'Dear Ngozi, we understand the acoustic and biophilic requirements of modern high-growth tech workspaces. We will coordinate directly with your MEP and branding contractors.',
      hourlyRate: 140,
      estimatedHours: 200,
      phases: [],
      attachedPortfolioIds: ['port-2'],
      clientQuestionsAndAnswers: [],
      timeline: [
        { stage: 'Sent', date: daysAgo(28), completed: true },
        { stage: 'Viewed', date: daysAgo(27), completed: true },
        { stage: 'Shortlisted', date: daysAgo(26), completed: true },
        { stage: 'Accepted', date: daysAgo(24), completed: true }
      ],
      editCount: 1,
      hasClientMessaged: true,
      conversationId: 'conv-3'
    },
    {
      id: 'prop-3',
      projectId: 'proj-3',
      projectTitle: 'Geneva Diplomatic Executive Lounge',
      clientName: 'Ambassador David Lindqvist',
      clientLocation: 'Geneva Diplomatic Quarter, Switzerland',
      paymentType: 'Milestone',
      proposedPrice: 38000,
      clientBudget: 38000,
      deliveryTime: '2.5 months',
      sentDate: daysAgo(8),
      status: 'shortlisted',
      statusHint: 'Shortlisted • Client sent message',
      coverLetter: 'Your Excellency, our practice combines contemporary architectural spatial planning with rich artisanal brass and leather details appropriate for diplomatic state receptions.',
      phases: [
        {
          id: 'p3-ph1',
          title: 'Spatial Concept & Acoustic Layouts',
          feePercentage: 40,
          amount: 15200,
          deliverablesSummary: 'Acoustic baffle geometry and private reception floorplans.',
          dueDate: daysFromNow(14),
          status: 'upcoming'
        },
        {
          id: 'p3-ph2',
          title: 'Custom Joinery & Lighting Schedule',
          feePercentage: 60,
          amount: 22800,
          deliverablesSummary: 'Handcrafted woodwork blueprints and diplomatic security lighting.',
          dueDate: daysFromNow(40),
          status: 'upcoming'
        }
      ],
      attachedPortfolioIds: ['port-1', 'port-3'],
      clientQuestionsAndAnswers: [
        {
          question: 'Can you guarantee acoustic isolation between salon A and the press area?',
          answer: 'Yes, we specify double-leaf acoustic partitions with STC 55 rating.'
        }
      ],
      timeline: [
        { stage: 'Sent', date: daysAgo(8), completed: true },
        { stage: 'Viewed', date: daysAgo(7), completed: true },
        { stage: 'Shortlisted', date: daysAgo(3), completed: true },
        { stage: 'Accepted or Declined', date: undefined, completed: false }
      ],
      editCount: 0,
      hasClientMessaged: true,
      conversationId: 'conv-2'
    },
    {
      id: 'prop-4',
      projectId: 'proj-4',
      projectTitle: 'Lakefront Contemporary Villa, Lucerne',
      clientName: 'Marcus Vance',
      clientLocation: 'Malibu, California',
      paymentType: 'Milestone',
      proposedPrice: 64000,
      clientBudget: 65000,
      deliveryTime: '5 months',
      sentDate: daysAgo(5),
      status: 'viewed',
      statusHint: 'Client viewed 2 days ago',
      coverLetter: 'Dear Ms. Rostova, we propose a contemporary coastal residence oriented to maximize natural daylight and panoramic vistas, featuring monolithic concrete elements and sustainable solar shading.',
      phases: [
        {
          id: 'p4-ph1',
          title: 'Schematic Masterplan & Ocean Studies',
          feePercentage: 30,
          amount: 19200,
          deliverablesSummary: 'Complete concept package and physical massing model.',
          dueDate: daysFromNow(20),
          status: 'upcoming'
        },
        {
          id: 'p4-ph2',
          title: 'Full Engineering Coordination',
          feePercentage: 40,
          amount: 25600,
          deliverablesSummary: 'Structural, MEP, and foundation pile coordination.',
          dueDate: daysFromNow(50),
          status: 'upcoming'
        },
        {
          id: 'p4-ph3',
          title: 'Finishes & Construction Administration',
          feePercentage: 30,
          amount: 19200,
          deliverablesSummary: 'Tender dossier and site supervisory milestones.',
          dueDate: daysFromNow(90),
          status: 'upcoming'
        }
      ],
      attachedPortfolioIds: ['port-1'],
      clientQuestionsAndAnswers: [],
      timeline: [
        { stage: 'Sent', date: daysAgo(5), completed: true },
        { stage: 'Viewed', date: daysAgo(2), completed: true },
        { stage: 'Shortlisted', date: undefined, completed: false },
        { stage: 'Accepted or Declined', date: undefined, completed: false }
      ],
      editCount: 0,
      hasClientMessaged: false
    },
    {
      id: 'prop-5',
      projectId: 'proj-5',
      projectTitle: 'Rotterdam Port Logistics Command Hub',
      clientName: 'Alexander Wright',
      clientLocation: 'San Francisco Bay, California',
      paymentType: 'Milestone',
      proposedPrice: 118000,
      clientBudget: 120000,
      deliveryTime: '8 months',
      sentDate: daysAgo(2),
      status: 'pending',
      statusHint: 'Submitted • Awaiting Client Review',
      coverLetter: 'Dear Tonye, our team has extensive coastal engineering experience in the Niger Delta. We will engineer the pile foundations and long-span steel trusses to meet heavy maritime standards.',
      phases: [
        {
          id: 'p5-ph1',
          title: 'Geotechnical Integration & Steel Schematics',
          feePercentage: 35,
          amount: 41300,
          deliverablesSummary: 'Soil profile integration and structural frame analysis.',
          dueDate: daysFromNow(30),
          status: 'upcoming'
        },
        {
          id: 'p5-ph2',
          title: 'Full Civil, Marine & MEP Drawings',
          feePercentage: 45,
          amount: 53100,
          deliverablesSummary: 'Industrial port command center documentation.',
          dueDate: daysFromNow(75),
          status: 'upcoming'
        },
        {
          id: 'p5-ph3',
          title: 'Statutory NPA Clearance Dossier',
          feePercentage: 20,
          amount: 23600,
          deliverablesSummary: 'Maritime Planning Commission compliance submission.',
          dueDate: daysFromNow(120),
          status: 'upcoming'
        }
      ],
      attachedPortfolioIds: ['port-2', 'port-3'],
      clientQuestionsAndAnswers: [],
      timeline: [
        { stage: 'Sent', date: daysAgo(2), completed: true },
        { stage: 'Viewed', date: undefined, completed: false },
        { stage: 'Shortlisted', date: undefined, completed: false },
        { stage: 'Accepted or Declined', date: undefined, completed: false }
      ],
      editCount: 0,
      hasClientMessaged: false
    },
    {
      id: 'prop-6',
      projectId: 'proj-old-1',
      projectTitle: 'Basel Innovation Campus Civic Pavilion',
      clientName: 'Metropolitan Infrastructure Trust',
      clientLocation: 'Basel, Switzerland',
      paymentType: 'Milestone',
      proposedPrice: 92000,
      clientBudget: 90000,
      deliveryTime: '6 months',
      sentDate: daysAgo(45),
      status: 'declined',
      statusHint: 'Declined • Client feedback provided',
      declinedReason: 'Client selected a consortium with on-site precast concrete facilities. Commended our cantilever design ethos.',
      coverLetter: 'Comprehensive civic pavilion proposal with passive cooling.',
      phases: [],
      attachedPortfolioIds: ['port-1'],
      clientQuestionsAndAnswers: [],
      timeline: [
        { stage: 'Sent', date: daysAgo(45), completed: true },
        { stage: 'Viewed', date: daysAgo(44), completed: true },
        { stage: 'Accepted or Declined', date: daysAgo(38), completed: true }
      ],
      editCount: 0,
      hasClientMessaged: false
    },
    {
      id: 'prop-7',
      projectId: 'proj-old-2',
      projectTitle: 'Asokoro Luxury Compound Extension',
      clientName: 'Senator M. Peters',
      clientLocation: 'Mayfair, London',
      paymentType: 'Milestone',
      proposedPrice: 52000,
      clientBudget: 55000,
      deliveryTime: '3 months',
      sentDate: daysAgo(50),
      status: 'withdrawn',
      statusHint: 'Withdrawn by designer',
      withdrawnReason: 'Capacity constraints with ongoing Zurich Cantilevered Waterfront project.',
      coverLetter: 'Compound residential extension proposal.',
      phases: [],
      attachedPortfolioIds: ['port-4'],
      clientQuestionsAndAnswers: [],
      timeline: [
        { stage: 'Sent', date: daysAgo(50), completed: true },
        { stage: 'Withdrawn', date: daysAgo(42), completed: true }
      ],
      editCount: 0,
      hasClientMessaged: false
    }
  ];

  // Financial Balances & Transactions (Payments Page & Dashboard sync!)
  public balances = {
    availableToWithdraw: 28500.0,
    pendingRelease: 12500.0,
    inEscrow: 32000.0,
    totalEarned: 148200.0
  };

  public transactions: SharedTransaction[] = [
    {
      id: 'tx-1',
      referenceId: 'DEZ-TX-84920',
      date: daysAgo(1),
      description: 'Milestone 2 deliverable submission',
      projectId: 'proj-1',
      projectName: 'Modern Cantilevered Residence, Zurich',
      milestoneTitle: 'Phase 2: Detailed Architectural Drawings',
      type: 'Milestone released',
      grossAmount: 12500.0,
      feePercentage: 2.5,
      feeAmount: 312.5,
      netAmount: 12187.5,
      status: 'Held',
      statusNote: 'Held while client reviews working drawings and CAD schedules.',
      timeline: [
        { event: 'Deliverables submitted by designer', timestamp: daysAgo(1) + ' 14:20' },
        { event: 'Escrow lock placed for client review', timestamp: daysAgo(1) + ' 14:22' }
      ]
    },
    {
      id: 'tx-2',
      referenceId: 'DEZ-TX-84102',
      date: daysAgo(6),
      description: 'Hourly invoice auto-payment (18.5 hours)',
      projectId: 'proj-2',
      projectName: 'Fintech Headquarters Workspace Architecture, London',
      type: 'Hourly invoice paid',
      grossAmount: 2590.0,
      feePercentage: 2.5,
      feeAmount: 64.75,
      netAmount: 2525.25,
      status: 'Completed',
      timeline: [
        { event: 'Weekly time log submitted', timestamp: daysAgo(7) + ' 18:00' },
        { event: 'Client payment processed & funds credited', timestamp: daysAgo(6) + ' 09:15' }
      ]
    },
    {
      id: 'tx-3',
      referenceId: 'DEZ-TX-83911',
      date: daysAgo(14),
      description: 'Milestone 1 approval & release',
      projectId: 'proj-1',
      projectName: 'Modern Cantilevered Residence, Zurich',
      milestoneTitle: 'Phase 1: Conceptual Schematic Studies',
      type: 'Milestone released',
      grossAmount: 15000.0,
      feePercentage: 2.5,
      feeAmount: 375.0,
      netAmount: 14625.0,
      status: 'Completed',
      timeline: [
        { event: 'Schematics submitted', timestamp: daysAgo(16) + ' 11:00' },
        { event: 'Client approval confirmed', timestamp: daysAgo(14) + ' 16:45' },
        { event: 'Funds released to available balance', timestamp: daysAgo(14) + ' 16:46' }
      ]
    },
    {
      id: 'tx-4',
      referenceId: 'DEZ-TX-82901',
      date: daysAgo(20),
      description: 'Direct wire withdrawal to JPMorgan Chase (••••4821)',
      type: 'Withdrawal',
      grossAmount: -10000.0,
      feePercentage: 0,
      feeAmount: 0.0,
      netAmount: -10000.0,
      status: 'Completed',
      payoutAccountMasked: 'JPMorgan Chase ••••4821',
      timeline: [
        { event: 'Withdrawal requested by designer', timestamp: daysAgo(20) + ' 10:12' },
        { event: 'Wire transfer settled via Fedwire', timestamp: daysAgo(19) + ' 15:30' }
      ]
    },
    {
      id: 'tx-5',
      referenceId: 'DEZ-TX-81090',
      date: daysAgo(27),
      description: 'Dezignet Upgraded Subscription (Annual)',
      type: 'Plan charge',
      grossAmount: -479.9,
      feePercentage: 0,
      feeAmount: 0.0,
      netAmount: -479.9,
      status: 'Completed',
      timeline: [
        { event: 'Annual plan subscription billed to Visa ••••4242', timestamp: daysAgo(27) + ' 00:01' }
      ]
    },
    {
      id: 'tx-6',
      referenceId: 'DEZ-TX-79880',
      date: daysAgo(35),
      description: 'Project deposit funded into escrow',
      projectId: 'proj-1',
      projectName: 'Modern Cantilevered Residence, Zurich',
      type: 'Milestone released',
      grossAmount: 30000.0,
      feePercentage: 2.5,
      feeAmount: 750.0,
      netAmount: 29250.0,
      status: 'Pending',
      statusNote: 'Held in escrow pending project milestone completion.',
      timeline: [
        { event: 'Client escrow funded', timestamp: daysAgo(35) + ' 13:20' }
      ]
    }
  ];

  public payoutAccounts: SharedPayoutAccount[] = [
    {
      id: 'payout-1',
      bankName: 'JPMorgan Chase Bank',
      accountNumberMasked: '••••••4821',
      accountName: 'Sterling Atelier Ltd',
      verificationStatus: 'Verified',
      isDefault: true,
      currency: 'USD'
    },
    {
      id: 'payout-2',
      bankName: 'Citibank Private Bank',
      accountNumberMasked: '••••••1092',
      accountName: 'Alexandre Sterling Studio',
      verificationStatus: 'Verified',
      isDefault: false,
      currency: 'USD'
    }
  ];

  public withdrawals: SharedWithdrawal[] = [
    {
      id: 'w-1',
      reference: 'DEZ-W-98102',
      date: daysAgo(20),
      amount: 10000.0,
      destinationAccount: '••••••4821',
      bankName: 'JPMorgan Chase Bank',
      status: 'Paid'
    },
    {
      id: 'w-2',
      reference: 'DEZ-W-91204',
      date: daysAgo(52),
      amount: 15000.0,
      destinationAccount: '••••••4821',
      bankName: 'JPMorgan Chase Bank',
      status: 'Paid'
    }
  ];

  public planState: SharedPlanState = {
    currentPlanId: 'upgraded',
    billingCycle: 'yearly',
    renewsAt: daysFromNow(338),
    paymentMethod: {
      brand: 'Visa',
      last4: '4242',
      expMonth: 11,
      expYear: 2028,
      isDefault: true
    },
    proposalsUsedThisMonth: 5
  };

  // Conversations & Messages
  public conversations: SharedConversation[] = [
    {
      id: 'conv-1',
      clientId: 'client-1',
      clientName: 'Dr. Tariq Al-Mansoor',
      clientCompany: 'Apex Capital Partners',
      clientLocation: 'Zurich, Switzerland',
      clientAvatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
      projectId: 'proj-1',
      projectTitle: 'Modern Cantilevered Residence, Zurich',
      proposalId: 'prop-1',
      proposalStatus: 'Accepted',
      lastMessageSnippet: 'The structural engineer has approved the revised cantilever reinforcement schedule.',
      lastMessageTime: '10:42 AM',
      unreadCount: 1,
      isMuted: false,
      isArchived: false,
      isClosed: false,
      hasClientInitiated: true,
      messages: [
        {
          id: 'msg-1-1',
          conversationId: 'conv-1',
          senderId: 'client-1',
          senderName: 'Dr. Tariq Al-Mansoor',
          isSelf: false,
          text: 'Hello Alexandre, we are thrilled with the schematic package for the Zurich waterfront build.',
          timestamp: '09:15 AM',
          dateString: daysAgo(2),
          status: 'Read'
        },
        {
          id: 'msg-1-2',
          conversationId: 'conv-1',
          senderId: 'designer',
          senderName: 'Alexandre Sterling',
          isSelf: true,
          text: 'Thank you Dr. Tariq. We uploaded the detailed structural working drawings for Milestone 2 yesterday.',
          timestamp: '11:30 AM',
          dateString: daysAgo(2),
          status: 'Read'
        },
        {
          id: 'msg-1-3',
          conversationId: 'conv-1',
          senderId: 'system',
          senderName: 'Dezignet System',
          isSelf: false,
          text: 'Milestone 2 deliverable submitted & escrow held for client review',
          timestamp: '02:22 PM',
          dateString: daysAgo(1),
          status: 'Read',
          isSystemMessage: true
        },
        {
          id: 'msg-1-4',
          conversationId: 'conv-1',
          senderId: 'client-1',
          senderName: 'Dr. Tariq Al-Mansoor',
          isSelf: false,
          text: 'The structural engineer has approved the revised cantilever reinforcement schedule. We will release the milestone escrow tomorrow morning.',
          timestamp: '10:42 AM',
          dateString: 'Today',
          status: 'Delivered',
          attachments: [
            {
              id: 'att-1',
              name: 'zurich-cantilever-structural-approval.pdf',
              sizeBytes: 2450000,
              type: 'pdf',
              url: 'https://dezignet.studio/files/zurich-structural-approval.pdf'
            }
          ]
        }
      ]
    },
    {
      id: 'conv-2',
      clientId: 'client-5',
      clientName: 'Ambassador David Lindqvist',
      clientCompany: 'Nordic Diplomatic Mission',
      clientLocation: 'Geneva Diplomatic Quarter, Switzerland',
      clientAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      projectId: 'proj-3',
      projectTitle: 'Geneva Diplomatic Executive Lounge',
      proposalId: 'prop-3',
      proposalStatus: 'Shortlisted',
      lastMessageSnippet: 'Could you confirm if the mahogany acoustic louvers satisfy diplomatic security standards?',
      lastMessageTime: 'Yesterday',
      unreadCount: 1,
      isMuted: false,
      isArchived: false,
      isClosed: false,
      hasClientInitiated: true,
      messages: [
        {
          id: 'msg-2-1',
          conversationId: 'conv-2',
          senderId: 'client-5',
          senderName: 'Ambassador David Lindqvist',
          isSelf: false,
          text: 'Hello Alexandre, we reviewed your shortlisted proposal for the diplomatic lounge. Could you confirm if the mahogany acoustic louvers satisfy diplomatic security standards?',
          timestamp: '04:15 PM',
          dateString: daysAgo(1),
          status: 'Delivered'
        }
      ]
    },
    {
      id: 'conv-3',
      clientId: 'client-2',
      clientName: 'Sophia Montgomery',
      clientCompany: 'Horizon Ventures',
      clientLocation: 'City of London',
      clientAvatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
      projectId: 'proj-2',
      projectTitle: 'Fintech Headquarters Workspace Architecture',
      proposalId: 'prop-2',
      proposalStatus: 'Accepted',
      lastMessageSnippet: 'Approved the hours logged for the 3rd floor biophilic atrium.',
      lastMessageTime: daysAgo(5),
      unreadCount: 0,
      isMuted: false,
      isArchived: false,
      isClosed: false,
      hasClientInitiated: true,
      messages: [
        {
          id: 'msg-3-1',
          conversationId: 'conv-3',
          senderId: 'client-2',
          senderName: 'Sophia Montgomery',
          isSelf: false,
          text: 'Approved the hours logged for the 3rd floor biophilic atrium. The team loved the timber acoustic mockups.',
          timestamp: '03:10 PM',
          dateString: daysAgo(5),
          status: 'Read'
        }
      ]
    }
  ];

  // Notifications
  public notifications: SharedNotification[] = [
    {
      id: 'notif-1',
      title: 'New message from Dr. Tariq Al-Mansoor',
      detail: 'The structural engineer has approved the revised cantilever reinforcement schedule.',
      timestamp: '2 hours ago',
      type: 'message',
      isUnread: true,
      actionUrl: '#/conversations/conv-1'
    },
    {
      id: 'notif-2',
      title: 'Proposal shortlisted by Ambassador David Lindqvist',
      detail: 'Your proposal for Geneva Diplomatic Executive Lounge was shortlisted.',
      timestamp: daysAgo(1),
      type: 'proposal',
      isUnread: true,
      actionUrl: '#/conversations/conv-2'
    },
    {
      id: 'notif-3',
      title: 'Escrow payment credited: $2,525.25',
      detail: 'Hourly invoice paid for Fintech Headquarters Workspace Architecture.',
      timestamp: daysAgo(6),
      type: 'payment',
      isUnread: false,
      actionUrl: '#payments'
    }
  ];

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  public getMockState(): GlobalMockState {
    return this.mockState;
  }

  public setMockState(state: GlobalMockState): void {
    this.mockState = state;
    if (state === 'empty') {
      this.balances.availableToWithdraw = 0;
      this.balances.pendingRelease = 0;
      this.balances.inEscrow = 0;
      this.balances.totalEarned = 0;
      this.planState.proposalsUsedThisMonth = 0;
      this.planState.currentPlanId = 'free';
    } else if (state === 'incomplete') {
      this.balances.availableToWithdraw = 4200.0;
      this.balances.pendingRelease = 0;
      this.balances.inEscrow = 5000.0;
      this.balances.totalEarned = 18400.0;
      this.planState.proposalsUsedThisMonth = 2;
      this.planState.currentPlanId = 'free';
    } else {
      this.balances.availableToWithdraw = 28500.0;
      this.balances.pendingRelease = 12500.0;
      this.balances.inEscrow = 32000.0;
      this.balances.totalEarned = 148200.0;
      this.planState.proposalsUsedThisMonth = 5;
      this.planState.currentPlanId = 'upgraded';
    }
  }

  // ==========================================================================
  // ACTIONS / MUTATIONS
  // ==========================================================================

  /**
   * Withdraw funds: deducts from available balance, adds transaction and withdrawal record
   */
  public executeWithdrawal(amount: number, payoutAccountId: string): { success: boolean; error?: string } {
    if (amount <= 0) return { success: false, error: 'Amount must be greater than $0.' };
    if (amount < PAYMENTS_CONFIG.minimumWithdrawalAmount) {
      return { success: false, error: `Minimum withdrawal amount is $${PAYMENTS_CONFIG.minimumWithdrawalAmount.toFixed(2)}.` };
    }
    if (amount > this.balances.availableToWithdraw) {
      return { success: false, error: `Requested amount exceeds available balance ($${this.balances.availableToWithdraw.toLocaleString()}).` };
    }

    const acc = this.payoutAccounts.find((a) => a.id === payoutAccountId) || this.payoutAccounts[0];
    if (!acc) {
      return { success: false, error: 'Please select a verified payout bank account.' };
    }

    // Deduct available
    this.balances.availableToWithdraw -= amount;

    // Add withdrawal record
    const ref = `DEZ-W-${Math.floor(10000 + Math.random() * 90000)}`;
    this.withdrawals.unshift({
      id: `w-${Date.now()}`,
      reference: ref,
      date: 'Today',
      amount,
      destinationAccount: acc.accountNumberMasked,
      bankName: acc.bankName,
      status: 'Processing'
    });

    // Add transaction record
    this.transactions.unshift({
      id: `tx-${Date.now()}`,
      referenceId: ref,
      date: 'Today',
      description: `Direct wire withdrawal to ${acc.bankName} (${acc.accountNumberMasked})`,
      type: 'Withdrawal',
      grossAmount: -amount,
      feePercentage: 0,
      feeAmount: 0,
      netAmount: -amount,
      status: 'Pending',
      payoutAccountMasked: `${acc.bankName} ${acc.accountNumberMasked}`,
      timeline: [
        { event: 'Withdrawal requested by designer', timestamp: 'Just now' },
        { event: `Submitted to ${acc.bankName} via Fedwire / ACH clearing`, timestamp: 'In progress' }
      ]
    });

    return { success: true };
  }

  /**
   * Accept proposal (Dev action): transforms proposal to accepted, creates Active Project & escrow!
   */
  public acceptProposalInMock(proposalId: string): SharedActiveProject | null {
    const prop = this.proposals.find((p) => p.id === proposalId);
    if (!prop) return null;

    prop.status = 'accepted';
    prop.statusHint = 'Accepted • Active Commission';
    prop.timeline.push({ stage: 'Accepted', date: 'Today', completed: true });

    // Update or create active project
    let active = this.activeProjects.find((a) => a.projectId === prop.projectId);
    if (!active) {
      active = {
        id: `act-${Date.now()}`,
        projectId: prop.projectId,
        title: prop.projectTitle,
        clientId: 'client-5',
        clientName: prop.clientName,
        clientLocation: prop.clientLocation,
        paymentType: prop.paymentType,
        status: 'awaiting_deliverable',
        statusLabel: 'Active Commission',
        category: 'Architecture',
        totalBudget: prop.proposedPrice,
        inEscrowAmount: prop.proposedPrice * 0.4,
        milestones: prop.phases,
        completedMilestonesCount: 0,
        totalMilestonesCount: prop.phases.length
      };
      this.activeProjects.unshift(active);
    }

    // Add Escrow balance
    this.balances.inEscrow += prop.proposedPrice * 0.4;

    // Create notification
    this.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: `Proposal Accepted: "${prop.projectTitle}"`,
      detail: `${prop.clientName} accepted your proposal. Client has funded the initial milestone into escrow.`,
      timestamp: 'Just now',
      type: 'proposal',
      isUnread: true,
      actionUrl: '#active-projects'
    });

    return active;
  }

  /**
   * Withdraw proposal
   */
  public withdrawProposalInMock(proposalId: string, reason?: string): boolean {
    const prop = this.proposals.find((p) => p.id === proposalId);
    if (!prop) return false;

    prop.status = 'withdrawn';
    prop.statusHint = 'Withdrawn by designer';
    prop.withdrawnReason = reason || 'Withdrawn by designer';
    prop.timeline.push({ stage: 'Withdrawn', date: 'Today', completed: true });

    if (PAYMENTS_CONFIG.withdrawnProposalRestoresMonthlyLimit && this.planState.proposalsUsedThisMonth > 0) {
      this.planState.proposalsUsedThisMonth--;
    }

    return true;
  }

  /**
   * Send a conversation message
   */
  public sendMessageInMock(conversationId: string, text: string, attachments?: ConversationAttachment[]): MessageItem {
    const conv = this.conversations.find((c) => c.id === conversationId);
    if (!conv) throw new Error('Conversation not found');

    const newMsg: MessageItem = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId: 'designer',
      senderName: 'Alexandre Sterling',
      isSelf: true,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateString: 'Today',
      status: 'Sent',
      attachments
    };

    conv.messages.push(newMsg);
    conv.lastMessageSnippet = text || (attachments ? `Attachment: ${attachments[0].name}` : '');
    conv.lastMessageTime = 'Just now';

    return newMsg;
  }

  /**
   * Simulate client incoming message in dev
   */
  public simulateClientMessage(conversationId: string, text?: string): MessageItem {
    const conv = this.conversations.find((c) => c.id === conversationId);
    if (!conv) throw new Error('Conversation not found');

    const replyText = text || 'Thank you Alexandre, we reviewed the latest update. The drawings look excellent.';
    const newMsg: MessageItem = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId: conv.clientId,
      senderName: conv.clientName,
      isSelf: false,
      text: replyText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateString: 'Today',
      status: 'Delivered'
    };

    conv.messages.push(newMsg);
    conv.lastMessageSnippet = replyText;
    conv.lastMessageTime = 'Just now';
    conv.unreadCount++;

    this.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: `New message from ${conv.clientName}`,
      detail: replyText,
      timestamp: 'Just now',
      type: 'message',
      isUnread: true,
      actionUrl: `#/conversations/${conv.id}`
    });

    return newMsg;
  }
}

// Global Singleton Dataset Instance
export const sharedDataset = new DezignetSharedDataset();
