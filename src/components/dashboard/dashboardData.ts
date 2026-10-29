/**
 * Realistic Mock Data for Dezignet Designer Dashboard
 */

export interface ProjectItem {
  id: string;
  title: string;
  category: 'Residential' | 'Commercial' | 'Hospitality' | 'Civic';
  status: 'pending' | 'ongoing' | 'completed';
  description: string;
  budget: number;
  duration: string;
  deadline: string;
  location: string;
  coverImage?: string;
  progress?: number;
  proposalsCount?: number;
  designerAvatars?: { name: string; initials: string; color: string }[];
}

export interface ActivityEvent {
  id: string;
  type: 'proposal' | 'payment' | 'milestone' | 'contract';
  title: string;
  description: string;
  timestamp: string;
  iconType: string;
}

export interface AttentionItem {
  id: string;
  type: 'proposal' | 'approval' | 'message';
  title: string;
  project: string;
  actionText: string;
  urgent?: boolean;
}

export interface ContractItem {
  id: string;
  contractNumber: string;
  client: string;
  projectTitle: string;
  totalValue: number;
  escrowStatus: 'Secured' | 'Released' | 'Partial';
  signedDate: string;
  currentMilestone: string;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  projectTitle: string;
  milestone: string;
  amount: number;
  date: string;
  status: 'Released' | 'Held in Escrow' | 'Processing';
}

export const initialProjects: ProjectItem[] = [
  {
    id: 'proj-1',
    title: 'Modern Cantilevered Hillside Residence',
    category: 'Residential',
    status: 'ongoing',
    description: 'High-end cantilevered modern residence with perforated bronze screens, rooftop plunge pool, and passive solar ventilation.',
    budget: 85000,
    duration: '14 Weeks',
    deadline: 'Nov 24, 2026',
    location: 'Pacific Palisades, Los Angeles',
    coverImage: '/hero-frames/frame_0080.webp',
    progress: 65,
    proposalsCount: 6,
    designerAvatars: [
      { name: 'Elena Vance', initials: 'EV', color: '#2F7BE5' },
      { name: 'Marcus Kim', initials: 'MK', color: '#10b981' },
      { name: 'Studio Atelier', initials: 'SA', color: '#8b5cf6' }
    ]
  },
  {
    id: 'proj-2',
    title: 'Boutique Hotel Lobby & Sky Atrium',
    category: 'Hospitality',
    status: 'ongoing',
    description: 'Bespoke biophilic interior renovation featuring triple-height glass facade, travertine finishes, and integrated custom acoustic louvering.',
    budget: 95000,
    duration: '20 Weeks',
    deadline: 'Dec 15, 2026',
    location: 'Zurich, Switzerland',
    coverImage: '/hero-frames/frame_0045.webp',
    progress: 35,
    proposalsCount: 8,
    designerAvatars: [
      { name: 'Tariq Al-Mansoor', initials: 'TA', color: '#f59e0b' },
      { name: 'Elena Vance', initials: 'EV', color: '#2F7BE5' }
    ]
  },
  {
    id: 'proj-3',
    title: 'Contemporary Art Pavilion & Sculptural Gardens',
    category: 'Civic',
    status: 'pending',
    description: 'Open-air public cultural pavilion and landscape architecture with native coastal flora, rammed earth walls, and exhibition walkways.',
    budget: 165000,
    duration: '28 Weeks',
    deadline: 'Jan 30, 2027',
    location: 'Brooklyn, New York',
    coverImage: '/hero-frames/frame_0110.webp',
    proposalsCount: 5,
    designerAvatars: [
      { name: 'Katherine Sterling', initials: 'KS', color: '#ec4899' },
      { name: 'Marcus Kim', initials: 'MK', color: '#10b981' }
    ]
  },
  {
    id: 'proj-4',
    title: 'Minimalist Penthouse Residence',
    category: 'Residential',
    status: 'pending',
    description: 'Full interior architecture overhaul of a 480 sqm penthouse overlooking the harbour, emphasizing brushed steel, fluted oak, and concealed lighting.',
    budget: 52000,
    duration: '10 Weeks',
    deadline: 'Dec 02, 2026',
    location: 'Tribeca, New York',
    proposalsCount: 4,
    designerAvatars: [
      { name: 'Studio Atelier', initials: 'SA', color: '#8b5cf6' },
      { name: 'David Chen', initials: 'DC', color: '#06b6d4' }
    ]
  },
  {
    id: 'proj-5',
    title: 'Sustainable Waterfront Eco-Villa',
    category: 'Residential',
    status: 'completed',
    description: 'Net-zero private sanctuary utilizing off-grid solar microgrids, rainwater harvesting, geothermal cooling, and sustainable timber framing.',
    budget: 155000,
    duration: '32 Weeks',
    deadline: 'Completed Oct 2026',
    location: 'Lake Geneva, Switzerland',
    coverImage: '/hero-frames/frame_0010.webp',
    progress: 100,
    proposalsCount: 7,
    designerAvatars: [
      { name: 'Elena Vance', initials: 'EV', color: '#2F7BE5' }
    ]
  },
  {
    id: 'proj-6',
    title: 'Commercial Fintech Innovation Tower',
    category: 'Commercial',
    status: 'completed',
    description: 'A 14-story LEED Platinum certified corporate headquarters featuring flexible collaboration spaces, kinetic exterior shades, and rooftop terraces.',
    budget: 210000,
    duration: '48 Weeks',
    deadline: 'Completed Aug 2026',
    location: 'Marina Financial District',
    coverImage: '/hero-frames/frame_0140.webp',
    progress: 100,
    proposalsCount: 12,
    designerAvatars: [
      { name: 'Camilla Rossi', initials: 'CR', color: '#ec4899' },
      { name: 'Tariq Al-Mansoor', initials: 'TA', color: '#f59e0b' }
    ]
  }
];

export const attentionItems: AttentionItem[] = [
  {
    id: 'att-1',
    type: 'proposal',
    title: 'Review 3 new design proposals',
    project: 'Contemporary Art Pavilion',
    actionText: 'Review Bids',
    urgent: true
  },
  {
    id: 'att-2',
    type: 'approval',
    title: 'Milestone 2 awaiting structural sign-off',
    project: 'Modern 3-Bedroom Duplex',
    actionText: 'Inspect & Approve'
  },
  {
    id: 'att-3',
    type: 'message',
    title: 'Client question regarding HVAC specifications',
    project: 'Boutique Hotel Lobby',
    actionText: 'Reply in Chat'
  }
];

export const recentActivities: ActivityEvent[] = [
  {
    id: 'act-1',
    type: 'payment',
    title: 'Escrow Payment Released',
    description: '$18,500 released for Milestone 1: Architectural Schematic Drawings.',
    timestamp: '2 hours ago',
    iconType: 'shieldCheck'
  },
  {
    id: 'act-2',
    type: 'proposal',
    title: 'New Bid from Studio ArchiKraft',
    description: 'Submitted detailed structural proposal for $38,000.',
    timestamp: '5 hours ago',
    iconType: 'fileText'
  },
  {
    id: 'act-3',
    type: 'milestone',
    title: '3D Renderings Delivered',
    description: 'Elena Vance uploaded 12 high-resolution exterior renders.',
    timestamp: 'Yesterday',
    iconType: 'box'
  },
  {
    id: 'act-4',
    type: 'contract',
    title: 'Contract Executed & Verified',
    description: 'Boutique Hotel Atrium contract signed with Escrow verified.',
    timestamp: '2 days ago',
    iconType: 'checkCircle'
  }
];

export const contractsData: ContractItem[] = [
  {
    id: 'cnt-1',
    contractNumber: 'DZT-2026-0891',
    client: 'Heritage Developments Ltd',
    projectTitle: 'Modern 3-Bedroom Duplex',
    totalValue: 45000,
    escrowStatus: 'Secured',
    signedDate: 'Sep 12, 2026',
    currentMilestone: 'Phase 2: Technical Specifications'
  },
  {
    id: 'cnt-2',
    contractNumber: 'DZT-2026-0742',
    client: 'Azurite Hospitality Group',
    projectTitle: 'Boutique Hotel Lobby & Sky Atrium',
    totalValue: 78000,
    escrowStatus: 'Secured',
    signedDate: 'Aug 28, 2026',
    currentMilestone: 'Phase 1: Concept & Spatial Flow'
  },
  {
    id: 'cnt-3',
    contractNumber: 'DZT-2026-0518',
    client: 'Oasis Ecological Estates',
    projectTitle: 'Sustainable Waterfront Eco-Villa',
    totalValue: 95000,
    escrowStatus: 'Released',
    signedDate: 'Jan 14, 2026',
    currentMilestone: 'Completed & Certified'
  }
];

export const paymentHistoryData: PaymentRecord[] = [
  {
    id: 'pay-1',
    invoiceId: 'INV-2026-881',
    projectTitle: 'Modern 3-Bedroom Duplex',
    milestone: 'Schematic Design & Floor Plans',
    amount: 15000,
    date: 'Oct 24, 2026',
    status: 'Released'
  },
  {
    id: 'pay-2',
    invoiceId: 'INV-2026-845',
    projectTitle: 'Boutique Hotel Lobby',
    milestone: 'Design Exploration & 3D Concepts',
    amount: 25000,
    date: 'Oct 18, 2026',
    status: 'Held in Escrow'
  },
  {
    id: 'pay-3',
    invoiceId: 'INV-2026-812',
    projectTitle: 'Modern 3-Bedroom Duplex',
    milestone: 'Structural Framing Calculations',
    amount: 12500,
    date: 'Oct 04, 2026',
    status: 'Held in Escrow'
  },
  {
    id: 'pay-4',
    invoiceId: 'INV-2026-756',
    projectTitle: 'Sustainable Waterfront Eco-Villa',
    milestone: 'Final Commissioning & As-Built CAD',
    amount: 32000,
    date: 'Sep 29, 2026',
    status: 'Released'
  }
];
