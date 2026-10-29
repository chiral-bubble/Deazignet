/**
 * Projects Mock Service Layer for Dezignet (Designer Side)
 * Clean service abstraction that can be swapped for real API calls later.
 */

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
  category: 'Residential' | 'Commercial' | 'Hospitality' | 'Civic' | 'Landscape' | 'Interior';
  subcategory: string;
  description: string;
  budget: number;
  paymentType: 'Milestone' | 'Hourly';
  hourlyRate?: number;
  estimatedHours?: number;
  timeline: string;
  deadline: string;
  area: number; // in sq ft
  location: string;
  postedDate: string;
  proposalsCount: number;
  status: 'Open' | 'Under Review' | 'Awarded' | 'Closed';
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
  paymentType?: 'Milestone' | 'Hourly' | 'All';
  timeline?: string;
  sortBy?: 'newest' | 'budget-high' | 'budget-low' | 'deadline-soon';
  onlySaved?: boolean;
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
  paymentType: 'Milestone' | 'Hourly';
  milestoneOffers?: ProposalMilestoneOffer[];
  hourlyRate?: number;
  estimatedHours?: number;
  deliveryTime: string;
  portfolioItems: string[];
  clientQuestion?: string;
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
  status: 'Pending' | 'Viewed' | 'Shortlisted' | 'Accepted' | 'Declined';
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

// -------------------------------------------------------------
// Standard Architectural Milestone Templates
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// Realistic Mock Database (International Architectural Commissions)
// -------------------------------------------------------------
const mockProjectsData: Project[] = [
  {
    id: 'proj-pacific-palisades',
    title: 'Modern Cantilevered Hillside Residence, Pacific Palisades',
    category: 'Residential',
    subcategory: 'Contemporary Villa',
    description: 'Client is commissioning an executive architectural lead for a contemporary 4-bedroom cliffside residence with panoramic Pacific ocean vistas. Requirements include cantilevered post-tensioned floor plates, solar-responsive motorized louvers, private screening lounge, and zero-edge infinity pool.',
    budget: 85000,
    paymentType: 'Milestone',
    timeline: '18 Weeks',
    deadline: 'In 5 days',
    area: 5800,
    location: 'Los Angeles, California',
    postedDate: '2 days ago',
    proposalsCount: 6,
    status: 'Open',
    isSaved: true,
    hasApplied: false,
    client: {
      id: 'client-sterling',
      name: 'Katherine Sterling',
      company: 'Sterling Pacific Ventures',
      location: 'Los Angeles, USA',
      memberSince: 'March 2022',
      projectsPosted: 4,
      paymentVerified: true,
      avatarText: 'KS'
    },
    referenceImages: [
      { id: 'ref-1', url: '/hero-frames/frame_0040.webp', caption: 'Modern Facade Concept' },
      { id: 'ref-2', url: '/hero-frames/frame_0080.webp', caption: 'Rear Courtyard & Terrace' },
      { id: 'ref-3', url: '/hero-frames/frame_0120.webp', caption: 'Double-Height Living Volume' }
    ],
    milestones: standardMilestonePhases
  },
  {
    id: 'proj-shoreditch-hq',
    title: 'Fintech Headquarters Workspace Architecture, Shoreditch',
    category: 'Commercial',
    subcategory: 'Corporate Workspace',
    description: 'Complete architectural and spatial planning for a 4-story creative tech headquarters. Scope encompasses acoustic timber breakout pavilions, daylight-optimized central atrium, executive boardroom with switchable privacy glazing, and landscaped rooftop pavilion.',
    budget: 110000,
    paymentType: 'Milestone',
    timeline: '20 Weeks',
    deadline: 'In 3 days',
    area: 12400,
    location: 'London, United Kingdom',
    postedDate: 'Yesterday',
    proposalsCount: 11,
    status: 'Open',
    isSaved: false,
    hasApplied: true,
    appliedProposalId: 'prop-shoreditch-01',
    client: {
      id: 'client-vance',
      name: 'Julian Vance',
      company: 'Vance Kinetic Capital',
      location: 'London, UK',
      memberSince: 'January 2021',
      projectsPosted: 7,
      paymentVerified: true,
      avatarText: 'JV'
    },
    referenceImages: [
      { id: 'ref-4', url: '/hero-frames/frame_0060.webp', caption: 'Open Plan Layout Sample' },
      { id: 'ref-5', url: '/hero-frames/frame_0100.webp', caption: 'Acoustic Ceiling Concept' }
    ],
    milestones: standardMilestonePhases
  },
  {
    id: 'proj-zurich-hotel',
    title: 'Boutique Alpine Lake Hotel Lobby & Spa, Lake Zurich',
    category: 'Hospitality',
    subcategory: 'Luxury Hotel',
    description: 'Interior architectural master plan for a 52-key luxury lakefront boutique hotel. Seeking an architect specialized in tactile limestone finishes, concealed ambient lighting coves, bespoke millwork, and seamless indoor-outdoor hydrothermal wellness suites.',
    budget: 95000,
    paymentType: 'Milestone',
    timeline: '16 Weeks',
    deadline: 'In 8 days',
    area: 6800,
    location: 'Zurich, Switzerland',
    postedDate: '3 days ago',
    proposalsCount: 5,
    status: 'Open',
    isSaved: true,
    hasApplied: false,
    client: {
      id: 'client-laurent',
      name: 'Sophia Laurent',
      company: 'Alpen Crest Resorts AG',
      location: 'Zurich, Switzerland',
      memberSince: 'July 2021',
      projectsPosted: 5,
      paymentVerified: true,
      avatarText: 'SL'
    },
    referenceImages: [
      { id: 'ref-6', url: '/hero-frames/frame_0090.webp', caption: 'Lobby Atrium Inspiration' },
      { id: 'ref-7', url: '/hero-frames/frame_0140.webp', caption: 'Waterfront Terrace Decking' }
    ],
    milestones: standardMilestonePhases
  },
  {
    id: 'proj-brooklyn-civic',
    title: 'Contemporary Civic Arts Center & Amphitheater, Brooklyn',
    category: 'Civic',
    subcategory: 'Auditorium & Arts',
    description: 'Structural architecture and acoustic envelope design for a 900-seat community performing arts center. Requires mass timber glulam roof trusses, dynamic sound diffusion baffles, flexible stage staging, and LEED Gold certified envelope.',
    budget: 165000,
    paymentType: 'Milestone',
    timeline: '32 Weeks',
    deadline: 'In 12 days',
    area: 18500,
    location: 'New York, USA',
    postedDate: '4 days ago',
    proposalsCount: 7,
    status: 'Open',
    isSaved: false,
    hasApplied: false,
    client: {
      id: 'client-bennett',
      name: 'Marcus Bennett',
      company: 'Hudson Cultural Trust',
      location: 'New York, USA',
      memberSince: 'October 2020',
      projectsPosted: 3,
      paymentVerified: true,
      avatarText: 'MB'
    },
    referenceImages: [
      { id: 'ref-8', url: '/hero-frames/frame_0020.webp', caption: 'Auditorium Acoustic Envelope' }
    ],
    milestones: standardMilestonePhases
  },
  {
    id: 'proj-tribeca-penthouse',
    title: 'Private Rooftop Solarium & Urban Forest, Tribeca',
    category: 'Landscape',
    subcategory: 'Penthouse Garden',
    description: 'Landscape and structural architect needed for a multi-tiered rooftop garden atop a historic Tribeca loft building. Requires structural dead-load verification, integrated micro-irrigation, weathered steel planters, outdoor culinary suite, and glass windbreaks.',
    budget: 52000,
    paymentType: 'Milestone',
    timeline: '12 Weeks',
    deadline: 'In 6 days',
    area: 3200,
    location: 'New York, USA',
    postedDate: '2 days ago',
    proposalsCount: 4,
    status: 'Open',
    isSaved: false,
    hasApplied: false,
    client: {
      id: 'client-croft',
      name: 'Harrison Croft',
      company: 'Croft Urban Estates',
      location: 'New York, USA',
      memberSince: 'September 2022',
      projectsPosted: 4,
      paymentVerified: true,
      avatarText: 'HC'
    },
    referenceImages: [
      { id: 'ref-9', url: '/hero-frames/frame_0150.webp', caption: 'Skyline Terrace Pergola' }
    ],
    milestones: standardMilestonePhases
  },
  {
    id: 'proj-aspen-chalet',
    title: 'Executive Mountain Chalet & Wellness Compound, Aspen',
    category: 'Residential',
    subcategory: 'Executive Estate',
    description: 'High-alpine 6-bedroom estate featuring triple-glazed panoramic thermal envelope, geothermal radiant slab heating, cantilevered hot spring cedar deck, and private subterranean ski valet and equipment gallery.',
    budget: 240000,
    paymentType: 'Milestone',
    timeline: '36 Weeks',
    deadline: 'In 16 days',
    area: 12500,
    location: 'Aspen, Colorado',
    postedDate: '5 days ago',
    proposalsCount: 14,
    status: 'Open',
    isSaved: true,
    hasApplied: false,
    client: {
      id: 'client-pendelton',
      name: 'Arthur Pendelton',
      company: 'Pendelton Family Trust',
      location: 'Aspen, USA',
      memberSince: 'May 2021',
      projectsPosted: 6,
      paymentVerified: true,
      avatarText: 'AP'
    },
    referenceImages: [
      { id: 'ref-10', url: '/hero-frames/frame_0070.webp', caption: 'Hillside Massing Example' }
    ],
    milestones: standardMilestonePhases
  },
  {
    id: 'proj-geneva-clinic',
    title: 'Advanced Surgical Center & Diagnostic Facility, Geneva',
    category: 'Commercial',
    subcategory: 'Healthcare Architecture',
    description: 'State-of-the-art medical clinic design with MRI diagnostic suites, ISO Class 5 sterile operating theaters, and daylight-infused rehabilitation solarium. Compliance with Swiss healthcare architectural standards required.',
    budget: 135000,
    paymentType: 'Milestone',
    timeline: '26 Weeks',
    deadline: 'In 9 days',
    area: 9200,
    location: 'Geneva, Switzerland',
    postedDate: '3 days ago',
    proposalsCount: 5,
    status: 'Open',
    isSaved: false,
    hasApplied: false,
    client: {
      id: 'client-rostova',
      name: 'Dr. Elena Rostova',
      company: 'Leman Health Sciences Foundation',
      location: 'Geneva, Switzerland',
      memberSince: 'August 2022',
      projectsPosted: 2,
      paymentVerified: true,
      avatarText: 'ER'
    },
    referenceImages: [
      { id: 'ref-11', url: '/hero-frames/frame_0110.webp', caption: 'Clinical Flow Schematic' }
    ],
    milestones: standardMilestonePhases
  },
  {
    id: 'proj-sydney-penthouse',
    title: 'Harbour View Sky Penthouse Interior Architecture, Sydney',
    category: 'Interior',
    subcategory: 'High-End Residential',
    description: 'Interior architect for a 6,800 sq ft dual-level penthouse overlooking Sydney Harbour. Scope includes bespoke curved fluted oak partitions, bookmatched Calacatta marble island, automated shading, and integrated acoustical ceiling baffles.',
    budget: 90000,
    paymentType: 'Hourly',
    hourlyRate: 135,
    estimatedHours: 650,
    timeline: '16 Weeks',
    deadline: 'In 4 days',
    area: 6800,
    location: 'Sydney, Australia',
    postedDate: '1 day ago',
    proposalsCount: 8,
    status: 'Open',
    isSaved: true,
    hasApplied: false,
    client: {
      id: 'client-thorne',
      name: 'Charlotte Thorne',
      company: 'Thorne Global Properties',
      location: 'Sydney, Australia',
      memberSince: 'February 2022',
      projectsPosted: 5,
      paymentVerified: true,
      avatarText: 'CT'
    },
    referenceImages: [
      { id: 'ref-12', url: '/hero-frames/frame_0130.webp', caption: 'Oceanfront Glass Envelope' }
    ]
  },
  {
    id: 'proj-kyoto-retreat',
    title: 'Minimalist Cedar Pavilion & Reflective Pool, Kyoto',
    category: 'Hospitality',
    subcategory: 'Eco-Resort',
    description: 'Architectural design for a boutique retreat comprising 8 detached Hinoki cypress guest villas linked by elevated covered timber walkways, raked gravel zen courtyards, and natural geothermal onsen bathing pavilions.',
    budget: 155000,
    paymentType: 'Milestone',
    timeline: '28 Weeks',
    deadline: 'In 20 days',
    area: 13200,
    location: 'Kyoto, Japan',
    postedDate: '6 days ago',
    proposalsCount: 3,
    status: 'Open',
    isSaved: false,
    hasApplied: false,
    client: {
      id: 'client-takahashi',
      name: 'Kenji Takahashi',
      company: 'Moriyama Heritage Resorts',
      location: 'Kyoto, Japan',
      memberSince: 'April 2021',
      projectsPosted: 2,
      paymentVerified: true,
      avatarText: 'KT'
    },
    referenceImages: [
      { id: 'ref-13', url: '/hero-frames/frame_0030.webp', caption: 'Stilt Lodge Conceptual Profile' }
    ],
    milestones: standardMilestonePhases
  },
  {
    id: 'proj-austin-innovation',
    title: 'Clean-Tech Research Labs & Prototyping Campus, Austin',
    category: 'Commercial',
    subcategory: 'Warehouse & Logistics',
    description: 'High-bay industrial R&D laboratory facility with vibration-isolated testing pads, cleanroom enclosures, automated materials handling, and open collaboration mezannine.',
    budget: 105000,
    paymentType: 'Hourly',
    hourlyRate: 110,
    estimatedHours: 950,
    timeline: '22 Weeks',
    deadline: 'In 10 days',
    area: 24000,
    location: 'Austin, Texas',
    postedDate: '4 days ago',
    proposalsCount: 5,
    status: 'Open',
    isSaved: false,
    hasApplied: false,
    client: {
      id: 'client-reynolds',
      name: 'David Reynolds',
      company: 'NextGen Clean Energy Corp',
      location: 'Austin, USA',
      memberSince: 'November 2021',
      projectsPosted: 4,
      paymentVerified: true,
      avatarText: 'DR'
    },
    referenceImages: [],
    milestones: standardMilestonePhases
  },
  {
    id: 'proj-vancouver-waterfront',
    title: 'Coastal Waterfront Dining Pavilion & Pier, Vancouver',
    category: 'Commercial',
    subcategory: 'F&B Restaurant',
    description: 'Glass-enclosed coastal dining pavilion perched above English Bay. Features glulam Douglas fir structural ribs, operable accordion glass facades, marine-grade zinc roofing, and sustainable seawater heat-exchange heating.',
    budget: 56000,
    paymentType: 'Milestone',
    timeline: '14 Weeks',
    deadline: 'In 7 days',
    area: 3400,
    location: 'Vancouver, Canada',
    postedDate: '5 days ago',
    proposalsCount: 8,
    status: 'Open',
    isSaved: false,
    hasApplied: false,
    client: {
      id: 'client-mackenzie',
      name: 'Clara MacKenzie',
      company: 'Pacific Tide Hospitality',
      location: 'Vancouver, Canada',
      memberSince: 'June 2023',
      projectsPosted: 3,
      paymentVerified: true,
      avatarText: 'CM'
    },
    referenceImages: [
      { id: 'ref-14', url: '/hero-frames/frame_0050.webp', caption: 'Waterfront Deck Rendering' }
    ],
    milestones: standardMilestonePhases
  },
  {
    id: 'proj-milan-tower',
    title: 'Mixed-Use Architecture & Residential Tower, Milan',
    category: 'Commercial',
    subcategory: 'Mixed-Use Tower',
    description: 'Competition-level concept package for a 16-story sustainable mixed-use tower in Porta Nuova district with vertical gardens and biophilic terraces. Commission awarded.',
    budget: 380000,
    paymentType: 'Milestone',
    timeline: '48 Weeks',
    deadline: 'Closed',
    area: 48000,
    location: 'Milan, Italy',
    postedDate: '3 weeks ago',
    proposalsCount: 26,
    status: 'Closed',
    isSaved: false,
    hasApplied: false,
    client: {
      id: 'client-rossi',
      name: 'Matteo Rossi',
      company: 'Lombardia Real Estate SpA',
      location: 'Milan, Italy',
      memberSince: 'January 2019',
      projectsPosted: 14,
      paymentVerified: true,
      avatarText: 'MR'
    },
    referenceImages: [],
    milestones: standardMilestonePhases
  }
];

// Mock submitted proposals
let submittedProposalsStore: SubmittedProposal[] = [
  {
    id: 'prop-shoreditch-01',
    projectId: 'proj-shoreditch-hq',
    projectTitle: 'Fintech Headquarters Workspace Architecture, Shoreditch',
    projectLocation: 'London, United Kingdom',
    clientName: 'Julian Vance',
    dateSent: 'Yesterday',
    proposedPrice: 105000,
    paymentType: 'Milestone',
    status: 'Shortlisted',
    coverLetter: 'Our studio has delivered over 18 corporate workspace interiors across London and Zurich, including verified acoustic performance pods, daylighting models, and low-energy lighting schemes.',
    deliveryTime: '18 Weeks',
    milestones: standardMilestonePhases.map((m) => ({
      phaseId: m.id,
      phaseName: m.name,
      feePercentage: m.defaultFeePercentage,
      amount: Math.round((105000 * m.defaultFeePercentage) / 100)
    }))
  }
];

// -------------------------------------------------------------
// Service Functions
// -------------------------------------------------------------

/**
 * Fetch projects with client-side filtering and sorting
 */
export async function getProjects(filters?: ProjectFiltersState): Promise<Project[]> {
  // Simulate quick 120ms network latency
  await new Promise((resolve) => setTimeout(resolve, 120));

  let results = [...mockProjectsData];

  // Only open projects or saved
  if (filters?.onlySaved) {
    results = results.filter((p) => p.isSaved);
  }

  // Text search in title and description only
  if (filters?.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    results = results.filter(
      (p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }

  // Category filter
  if (filters?.category && filters.category !== 'All') {
    results = results.filter((p) => p.category === filters.category);
  }

  // Subcategory filter
  if (filters?.subcategory && filters.subcategory !== 'All') {
    results = results.filter((p) => p.subcategory.toLowerCase().includes(filters.subcategory!.toLowerCase()));
  }

  // Location filter
  if (filters?.location && filters.location !== 'All') {
    results = results.filter((p) => p.location.toLowerCase().includes(filters.location!.toLowerCase()));
  }

  // Payment type filter
  if (filters?.paymentType && filters.paymentType !== 'All') {
    results = results.filter((p) => p.paymentType === filters.paymentType);
  }

  // Budget range
  if (filters?.minBudget !== undefined && filters.minBudget > 0) {
    results = results.filter((p) => p.budget >= filters.minBudget!);
  }
  if (filters?.maxBudget !== undefined && filters.maxBudget > 0) {
    results = results.filter((p) => p.budget <= filters.maxBudget!);
  }

  // Sorting
  if (filters?.sortBy === 'budget-high') {
    results.sort((a, b) => b.budget - a.budget);
  } else if (filters?.sortBy === 'budget-low') {
    results.sort((a, b) => a.budget - b.budget);
  } else if (filters?.sortBy === 'deadline-soon') {
    results.sort((a, b) => (a.deadline === 'Closed' ? 1 : 0) - (b.deadline === 'Closed' ? 1 : 0));
  } else {
    // Newest first by default (keep mock order)
  }

  return results;
}

/**
 * Fetch a single project by ID
 */
export async function getProject(id: string): Promise<Project | null> {
  await new Promise((resolve) => setTimeout(resolve, 80));
  const found = mockProjectsData.find((p) => p.id === id);
  return found ? { ...found } : null;
}

/**
 * Toggle bookmark/save state
 */
export function toggleSaveProject(projectId: string): boolean {
  const p = mockProjectsData.find((item) => item.id === projectId);
  if (p) {
    p.isSaved = !p.isSaved;
    return !!p.isSaved;
  }
  return false;
}

/**
 * Submit a proposal for a project
 */
export async function submitProposal(
  projectId: string,
  proposal: ProposalSubmission
): Promise<{ success: boolean; proposalId?: string; error?: string }> {
  // Simulate network request
  await new Promise((resolve) => setTimeout(resolve, 400));

  const project = mockProjectsData.find((p) => p.id === projectId);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  if (project.status === 'Closed') {
    return { success: false, error: 'Project is closed and no longer accepting proposals' };
  }

  const newProposalId = `prop-${Date.now()}`;
  const submittedItem: SubmittedProposal = {
    id: newProposalId,
    projectId: project.id,
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
  };

  submittedProposalsStore.unshift(submittedItem);

  // Update project state
  project.hasApplied = true;
  project.appliedProposalId = newProposalId;
  project.proposalsCount += 1;

  // Clear draft
  clearProposalDraft(projectId);

  return { success: true, proposalId: newProposalId };
}

/**
 * Withdraw an active proposal
 */
export async function withdrawProposal(proposalId: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const index = submittedProposalsStore.findIndex((p) => p.id === proposalId);
  if (index !== -1) {
    const item = submittedProposalsStore[index];
    submittedProposalsStore.splice(index, 1);

    // Revert project applied status
    const proj = mockProjectsData.find((p) => p.id === item.projectId);
    if (proj) {
      proj.hasApplied = false;
      proj.appliedProposalId = undefined;
      proj.proposalsCount = Math.max(0, proj.proposalsCount - 1);
    }
    return true;
  }
  return false;
}

/**
 * Fetch all submitted proposals for the designer
 */
export async function getMyProposals(): Promise<SubmittedProposal[]> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return [...submittedProposalsStore];
}

// -------------------------------------------------------------
// Draft Management in localStorage
// -------------------------------------------------------------
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
    // Ignore quota issues in mock
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
