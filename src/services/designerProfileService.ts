/**
 * Designer Profile Service for Dezignet
 * Clean service layer powering both the private Profile Settings and the Public Designer Profile.
 * 
 * Functions can be swapped for real backend API calls later.
 */

export type ProfessionalType =
  | 'Architect'
  | 'Interior Designer'
  | 'Landscape Architect'
  | 'Engineer';

export type CredentialStatus = 'verified' | 'pending' | 'rejected';

export interface DesignerCredential {
  id: string;
  registrationBody: string; // e.g. AIA, PE, RIBA, NCARB, TOPREC
  registrationNumber: string; // e.g. A-14285
  stateOrRegion: string;
  year: number | string;
  certificateUrl?: string;
  status: CredentialStatus;
  rejectionReason?: string;
}

export interface PortfolioImage {
  id: string;
  url: string;
  caption?: string;
  isCover: boolean;
}

export interface PortfolioProject {
  id: string;
  title: string;
  year: number | string;
  category: string;
  location: string;
  shortDescription: string;
  role: string;
  images: PortfolioImage[];
  order: number;
}

export interface DesignerReview {
  id: string;
  clientName: string;
  clientCompany?: string;
  rating: number; // 1-5
  reviewText: string;
  projectName: string;
  date: string;
}

export interface PayoutAccount {
  id: string;
  bankName: string;
  accountNumberMasked: string; // e.g. ••••••4821
  accountName: string;
  isPrimary: boolean;
}

export interface InvoiceItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'Paid' | 'Pending';
  downloadUrl?: string;
}

export interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface DesignerNotificationSettings {
  email: {
    newMessage: boolean;
    proposalViewed: boolean;
    proposalShortlisted: boolean;
    proposalAccepted: boolean;
    milestoneApproved: boolean;
    paymentReleased: boolean;
    platformNews: boolean;
  };
  inApp: {
    newMessage: boolean;
    proposalViewed: boolean;
    proposalShortlisted: boolean;
    proposalAccepted: boolean;
    milestoneApproved: boolean;
    paymentReleased: boolean;
    platformNews: boolean;
  };
}

export interface DesignerProfile {
  id: string;
  name: string;
  avatarUrl: string;
  professionalTitle: string;
  professionalType: ProfessionalType;
  companyName?: string;
  location: {
    city: string;
    state: string;
    country: string;
  };
  email: string;
  phone?: string; // Private
  languages: string[];
  yearsOfExperience: number;
  about: string; // Max 600 chars
  specializations: string[];
  hourlyRate?: number;
  isAvailableForProjects: boolean;
  availabilityNote?: string;
  memberSince: string;
  stats: {
    projectsCompleted: number;
    averageRating: number;
    reviewCount: number;
    responseTime: string;
  };
  currentPlanId: 'free' | 'basic' | 'upgraded';
  planBillingCycle: 'monthly' | 'yearly';
  hasActiveProjectsOrEscrow: boolean;
  credentials: DesignerCredential[];
  portfolio: PortfolioProject[];
  reviews: DesignerReview[];
  payoutAccounts: PayoutAccount[];
  invoices: InvoiceItem[];
  sessions: ActiveSession[];
  notifications: DesignerNotificationSettings;
  showInDesignerSearch?: boolean;
  hideRateFromPeers?: boolean;
}

export interface CompletenessCheckItem {
  id: string;
  label: string;
  tab: 'profile' | 'portfolio' | 'credentials' | 'security' | 'billing';
  completed: boolean;
}

export interface ProfileCompletenessResult {
  score: number; // 0 - 100
  checklist: CompletenessCheckItem[];
}

export type ViewerRole = 'client' | 'designer' | 'self';
export type MockProfileStateKey = 'complete' | 'incomplete' | 'empty';

// ============================================================================
// MOCK ARCHITECTURAL PORTFOLIO IMAGES (Clean architectural photography)
// ============================================================================
const ARCH_IMAGES = [
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80'
];

// ============================================================================
// 8 MOCK DESIGNERS (International Cities, Real Architectural Specializations)
// ============================================================================
const INITIAL_DESIGNERS: DesignerProfile[] = [
  {
    id: 'des-1',
    name: 'Alexandre Sterling',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Principal Architect & Urbanist',
    professionalType: 'Architect',
    companyName: 'Sterling Atelier Architecture',
    location: { city: 'Zurich', state: 'Zurich Canton', country: 'Switzerland' },
    email: 'alexandre.sterling@dezignet.studio',
    phone: '+41 44 214 8900',
    languages: ['English', 'French', 'German'],
    yearsOfExperience: 14,
    about: 'Leading a boutique architectural atelier in Zurich specializing in high-end tropical residential estates, passive solar design, and cantilevered concrete forms. Committed to climate-resilient luxury structures that integrate native mahogany and bespoke brise-soleil facades.',
    specializations: ['Residential', 'Commercial', 'Sustainable', 'Interior Architecture'],
    hourlyRate: 140,
    isAvailableForProjects: true,
    availabilityNote: 'Accepting commissions for Q1/Q2 residential & cultural builds.',
    memberSince: 'March 2022',
    stats: {
      projectsCompleted: 38,
      averageRating: 4.96,
      reviewCount: 24,
      responseTime: 'Under 1 hour'
    },
    currentPlanId: 'upgraded',
    planBillingCycle: 'yearly',
    hasActiveProjectsOrEscrow: true,
    credentials: [
      {
        id: 'cred-1',
        registrationBody: 'AIA',
        registrationNumber: 'F-2491',
        stateOrRegion: 'Zurich',
        year: 2012,
        certificateUrl: 'https://dezignet.studio/certs/sia-f2491.pdf',
        status: 'verified'
      },
      {
        id: 'cred-2',
        registrationBody: 'RIBA',
        registrationNumber: 'M-4812',
        stateOrRegion: 'Zurich',
        year: 2014,
        certificateUrl: 'https://dezignet.studio/certs/riba-m4812.pdf',
        status: 'verified'
      }
    ],
    portfolio: [
      {
        id: 'port-1',
        title: 'Lake Zurich Cantilevered Pavilion',
        year: 2024,
        category: 'Residential',
        location: 'Zurich, Switzerland',
        shortDescription: 'Multi-level cantilevered reinforced concrete residence with panoramic lagoon vistas, integrated rainwater harvesting, and cedar louvers.',
        role: 'Lead Architect',
        order: 1,
        images: [
          { id: 'img-1-1', url: ARCH_IMAGES[0], caption: 'Lagoon facade and pool deck', isCover: true },
          { id: 'img-1-2', url: ARCH_IMAGES[1], caption: 'Double-height central living gallery', isCover: false },
          { id: 'img-1-3', url: ARCH_IMAGES[2], caption: 'Master cantilevered terrace', isCover: false }
        ]
      },
      {
        id: 'port-2',
        title: 'City of London Fintech Headquarters',
        year: 2023,
        category: 'Commercial',
        location: 'City of London, UK',
        shortDescription: 'Adaptive workplace architecture with 12,000 sqm of biophilic collaboration zones, acoustic wood paneling, and an atrium lightwell.',
        role: 'Architectural Director',
        order: 2,
        images: [
          { id: 'img-2-1', url: ARCH_IMAGES[3], caption: 'Atrium reception and sculptural staircase', isCover: true },
          { id: 'img-2-2', url: ARCH_IMAGES[4], caption: 'Executive boardroom overlooking skyline', isCover: false }
        ]
      },
      {
        id: 'port-3',
        title: 'Aspen Alpine Eco-Resort Pavilion',
        year: 2023,
        category: 'Hospitality',
        location: 'Aspen, Colorado',
        shortDescription: 'Low-impact timber post-and-beam villas nestled along mangrove waterways, featuring natural cross-ventilation and rammed earth walls.',
        role: 'Principal Architect',
        order: 3,
        images: [
          { id: 'img-3-1', url: ARCH_IMAGES[5], caption: 'Mangrove boardwalk pavilion', isCover: true },
          { id: 'img-3-2', url: ARCH_IMAGES[6], caption: 'Private infinity plunge pool', isCover: false },
          { id: 'img-3-3', url: ARCH_IMAGES[7], caption: 'Natural stone bathroom retreat', isCover: false }
        ]
      },
      {
        id: 'port-4',
        title: 'Lake Geneva Minimalist Villa',
        year: 2022,
        category: 'Residential',
        location: 'Lake Geneva, Switzerland',
        shortDescription: 'Monolithic travertine and bronze residence with sunken courtyards and private sculpture garden.',
        role: 'Lead Design Architect',
        order: 4,
        images: [
          { id: 'img-4-1', url: ARCH_IMAGES[1], caption: 'Travertine exterior courtyard', isCover: true }
        ]
      }
    ],
    reviews: [
      {
        id: 'rev-1',
        clientName: 'Dr. Tariq Al-Mansoor',
        clientCompany: 'Apex Capital Partners',
        rating: 5,
        reviewText: 'Alexandre delivered an extraordinary vision for our Zurich waterfront build. Every milestone was met ahead of schedule and the attention to acoustic comfort and natural light is peerless.',
        projectName: 'Lake Zurich Cantilevered Pavilion',
        date: 'October 14, 2025'
      },
      {
        id: 'rev-2',
        clientName: 'Sophia Montgomery',
        clientCompany: 'Horizon Ventures',
        rating: 5,
        reviewText: 'Outstanding professionalism. Our 8-story corporate headquarters is now the crown jewel of Victoria Island. Clear communication throughout the entire escrow process.',
        projectName: 'City of London Fintech Headquarters',
        date: 'June 2, 2025'
      },
      {
        id: 'rev-3',
        clientName: 'Marcus Vance',
        rating: 4.9,
        reviewText: 'A true master of modern tropical architecture. Alexandre incorporated sustainable cooling techniques that reduced our HVAC energy consumption by 40%.',
        projectName: 'Lake Geneva Minimalist Villa',
        date: 'January 18, 2025'
      }
    ],
    payoutAccounts: [
      {
        id: 'payout-1',
        bankName: 'JPMorgan Chase Bank',
        accountNumberMasked: '••••••4821',
        accountName: 'Sterling Atelier Ltd',
        isPrimary: true
      }
    ],
    invoices: [
      { id: 'inv-101', date: 'Oct 01, 2026', description: 'Dezignet Upgraded Subscription (Annual)', amount: 479.90, status: 'Paid' },
      { id: 'inv-100', date: 'Oct 01, 2025', description: 'Dezignet Upgraded Subscription (Annual)', amount: 479.90, status: 'Paid' }
    ],
    sessions: [
      { id: 'sess-1', device: 'Apple MacBook Pro 16"', browser: 'Google Chrome', location: 'Zurich, Switzerland', lastActive: 'Active now', isCurrent: true },
      { id: 'sess-2', device: 'Apple iPhone 15 Pro', browser: 'Mobile Safari', location: 'Zurich, Switzerland', lastActive: '4 hours ago', isCurrent: false }
    ],
    notifications: {
      email: {
        newMessage: true,
        proposalViewed: true,
        proposalShortlisted: true,
        proposalAccepted: true,
        milestoneApproved: true,
        paymentReleased: true,
        platformNews: false
      },
      inApp: {
        newMessage: true,
        proposalViewed: true,
        proposalShortlisted: true,
        proposalAccepted: true,
        milestoneApproved: true,
        paymentReleased: true,
        platformNews: true
      }
    }
  },
  {
    id: 'des-2',
    name: 'Claire Laurent',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Interior Architect & Workplace Strategist',
    professionalType: 'Interior Designer',
    companyName: 'Studio Laurent Interiors',
    location: { city: 'Geneva', state: 'Geneva Canton', country: 'Switzerland' },
    email: 'amina.bello@dezignet.studio',
    languages: ['English', 'French'],
    yearsOfExperience: 10,
    about: 'Geneva-based architectural interior studio focused on sensory-rich hospitality spaces, ergonomic diplomatic suites, and bespoke contemporary furniture. We merge Nordic minimalism with bespoke artisanal leathercraft and brass accents.',
    specializations: ['Interior', 'Commercial', 'Hospitality'],
    hourlyRate: 110,
    isAvailableForProjects: true,
    availabilityNote: 'Booking boutique commercial interiors and diplomatic residences.',
    memberSince: 'July 2023',
    stats: {
      projectsCompleted: 22,
      averageRating: 4.92,
      reviewCount: 16,
      responseTime: 'Under 2 hours'
    },
    currentPlanId: 'basic',
    planBillingCycle: 'monthly',
    hasActiveProjectsOrEscrow: false,
    credentials: [
      {
        id: 'cred-3',
        registrationBody: 'RIBA',
        registrationNumber: 'M-5201',
        stateOrRegion: 'Zurich',
        year: 2017,
        status: 'verified'
      }
    ],
    portfolio: [
      {
        id: 'port-21',
        title: 'Geneva Diplomatic Executive Lounge',
        year: 2024,
        category: 'Interior',
        location: 'Geneva Diplomatic Quarter, Switzerland',
        shortDescription: 'Refined reception and diplomatic dining lounge utilizing walnut woodwork, handwoven upholstery, and custom acoustic ceiling baffling.',
        role: 'Lead Interior Architect',
        order: 1,
        images: [
          { id: 'img-21-1', url: ARCH_IMAGES[2], caption: 'Private salon & brass fixtures', isCover: true },
          { id: 'img-21-2', url: ARCH_IMAGES[3], caption: 'Boardroom lounge', isCover: false }
        ]
      },
      {
        id: 'port-22',
        title: 'Central Business District Coffee & Co-work Atelier',
        year: 2023,
        category: 'Commercial',
        location: 'City of London',
        shortDescription: 'Industrial warm cafe with cast-terrazzo counters, fluted glass partitions, and integrated library shelving.',
        role: 'Interior Designer',
        order: 2,
        images: [
          { id: 'img-22-1', url: ARCH_IMAGES[4], caption: 'Terrazzo barista counter and banquettes', isCover: true }
        ]
      },
      {
        id: 'port-23',
        title: 'Asokoro Penthouse Interior Renovation',
        year: 2023,
        category: 'Residential',
        location: 'Geneva Old Town',
        shortDescription: 'Minimalist penthouse sanctuary featuring micro-cement floors, floor-to-ceiling pivot doors, and concealed smart lighting.',
        role: 'Lead Designer',
        order: 3,
        images: [
          { id: 'img-23-1', url: ARCH_IMAGES[0], caption: 'Living room overlooking Lake Geneva', isCover: true }
        ]
      }
    ],
    reviews: [
      {
        id: 'rev-21',
        clientName: 'Ambassador David Lindqvist',
        rating: 5,
        reviewText: 'Amina transformed our reception spaces with exceptional taste. She understood our diplomatic protocol requirements seamlessly.',
        projectName: 'Geneva Diplomatic Executive Lounge',
        date: 'September 19, 2025'
      }
    ],
    payoutAccounts: [
      {
        id: 'payout-2',
        bankName: 'Citibank Private Bank',
        accountNumberMasked: '••••••1092',
        accountName: 'Studio Bello Ltd',
        isPrimary: true
      }
    ],
    invoices: [],
    sessions: [],
    notifications: {
      email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true },
      inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true }
    }
  },
  {
    id: 'des-3',
    name: 'Lukas Weber',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Lead Structural Architect & Marine Engineer',
    professionalType: 'Engineer',
    companyName: 'Weber Structural Innovations',
    location: { city: 'Rotterdam', state: 'South Holland', country: 'Netherlands' },
    email: 'lukas.weber@dezignet.studio',
    languages: ['English', 'German', 'Dutch'],
    yearsOfExperience: 18,
    about: 'Chartered structural engineer and architect in Rotterdam specializing in long-span steel engineering, marine architecture, deep foundation stabilization, and harbor logistics facilities across Northern Europe.',
    specializations: ['Commercial', 'Structural', 'Government', 'Industrial'],
    hourlyRate: 165,
    isAvailableForProjects: true,
    availabilityNote: 'Available for structural feasibility audits and coastal development projects.',
    memberSince: 'January 2021',
    stats: {
      projectsCompleted: 54,
      averageRating: 4.95,
      reviewCount: 31,
      responseTime: 'Within 3 hours'
    },
    currentPlanId: 'upgraded',
    planBillingCycle: 'monthly',
    hasActiveProjectsOrEscrow: true,
    credentials: [
      {
        id: 'cred-31',
        registrationBody: 'PE',
        registrationNumber: 'R-18920',
        stateOrRegion: 'Rivers',
        year: 2009,
        status: 'verified'
      }
    ],
    portfolio: [
      {
        id: 'port-31',
        title: 'Rotterdam Port Logistics Command Hub',
        year: 2023,
        category: 'Commercial',
        location: 'Rotterdam Harbour, Netherlands',
        shortDescription: 'Hurricane-resistant long-span steel logistics headquarters featuring elevated pile foundation and solar microgrid.',
        role: 'Chief Structural Engineer',
        order: 1,
        images: [{ id: 'img-31-1', url: ARCH_IMAGES[3], caption: 'Steel framework and facade', isCover: true }]
      },
      {
        id: 'port-32',
        title: 'Old GRA Modern Manor',
        year: 2022,
        category: 'Residential',
        location: 'Port Harcourt, Rivers State',
        shortDescription: 'Reinforced concrete residence engineered with anti-seepage waterproof basements and cantilevered canopy overhangs.',
        role: 'Structural Consultant',
        order: 2,
        images: [{ id: 'img-32-1', url: ARCH_IMAGES[6], caption: 'Rear garden and structural span', isCover: true }]
      },
      {
        id: 'port-33',
        title: 'Bonny Island Educational Campus Pavilion',
        year: 2021,
        category: 'Government',
        location: 'Bonny Island, Rivers State',
        shortDescription: 'Low-carbon composite wood and concrete civic auditorium with 1,200 capacity.',
        role: 'Lead Structural Architect',
        order: 3,
        images: [{ id: 'img-33-1', url: ARCH_IMAGES[5], caption: 'Auditorium roof geometry', isCover: true }]
      }
    ],
    reviews: [
      {
        id: 'rev-31',
        clientName: 'Alexander Wright',
        clientCompany: 'Pacific Maritime Partners',
        rating: 5,
        reviewText: 'Chukwuemeka solved engineering challenges that two other firms deemed impossible. Ground stabilization was handled impeccably.',
        projectName: 'Rotterdam Port Logistics Command Hub',
        date: 'July 11, 2025'
      }
    ],
    payoutAccounts: [
      {
        id: 'payout-3',
        bankName: 'ING Bank Netherlands',
        accountNumberMasked: '••••••8832',
        accountName: 'Weber Struct Ltd',
        isPrimary: true
      }
    ],
    invoices: [],
    sessions: [],
    notifications: {
      email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: false },
      inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true }
    }
  },
  {
    id: 'des-4',
    name: 'Charlotte Dubois',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Landscape Architect & Environmental Planner',
    professionalType: 'Landscape Architect',
    companyName: 'TerraVerde Landscapes',
    location: { city: 'Zurich', state: 'Zurich Canton', country: 'Switzerland' },
    email: 'charlotte.dubois@dezignet.studio',
    languages: ['English', 'German'],
    yearsOfExperience: 9,
    about: 'Regenerative landscape architecture practice crafting drought-tolerant private botanical gardens, green roof canopies, and storm drainage masterplans along Lake Zurich.',
    specializations: ['Landscape', 'Sustainable', 'Residential'],
    hourlyRate: 95,
    isAvailableForProjects: true,
    availabilityNote: 'Accepting estate masterplans and luxury private gardens.',
    memberSince: 'September 2023',
    stats: {
      projectsCompleted: 19,
      averageRating: 4.88,
      reviewCount: 12,
      responseTime: 'Under 4 hours'
    },
    currentPlanId: 'basic',
    planBillingCycle: 'yearly',
    hasActiveProjectsOrEscrow: false,
    credentials: [
      {
        id: 'cred-41',
        registrationBody: 'RIBA',
        registrationNumber: 'L-3904',
        stateOrRegion: 'Zurich',
        year: 2018,
        status: 'verified'
      }
    ],
    portfolio: [
      {
        id: 'port-41',
        title: 'Cotswolds Botanical Courtyard Gardens',
        year: 2024,
        category: 'Landscape',
        location: 'Malibu, California',
        shortDescription: 'Urban oasis integrating bioswales, indigenous flowering flora, limestone pavers, and illuminated reflecting pools.',
        role: 'Lead Landscape Architect',
        order: 1,
        images: [{ id: 'img-41-1', url: ARCH_IMAGES[0], caption: 'Reflecting pool with indigenous palms', isCover: true }]
      },
      {
        id: 'port-42',
        title: 'Lugano Lakeside Botanical Club',
        year: 2023,
        category: 'Commercial',
        location: 'Lugano Waterfront, Switzerland',
        shortDescription: 'Alpine lake-breeze tolerant rooftop sky garden with pergola cabanas and drip irrigation.',
        role: 'Landscape Consultant',
        order: 2,
        images: [{ id: 'img-42-1', url: ARCH_IMAGES[7], caption: 'Sky garden lounge', isCover: true }]
      },
      {
        id: 'port-43',
        title: 'Bern Old Town Riverbank Restoration',
        year: 2022,
        category: 'Sustainable',
        location: 'Bern Old Town, Switzerland',
        shortDescription: 'Community ecological revitalization project restoring riparian habitat with pedestrian boardwalk.',
        role: 'Environmental Planner',
        order: 3,
        images: [{ id: 'img-43-1', url: ARCH_IMAGES[5], caption: 'Wetland boardwalk', isCover: true }]
      }
    ],
    reviews: [
      {
        id: 'rev-41',
        clientName: 'Marcus Vance',
        rating: 5,
        reviewText: 'Charlotte brought our courtyard to life. The choice of flora and stone was extraordinary.',
        projectName: 'Cotswolds Botanical Courtyard Gardens',
        date: 'May 20, 2025'
      }
    ],
    payoutAccounts: [],
    invoices: [],
    sessions: [],
    notifications: {
      email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true },
      inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true }
    }
  },
  {
    id: 'des-5',
    name: 'Julian Thorne',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Heritage & Residential Architect',
    professionalType: 'Architect',
    companyName: 'Thorne Heritage Studio',
    location: { city: 'London', state: 'Greater London', country: 'United Kingdom' },
    email: 'julian.thorne@dezignet.studio',
    languages: ['English', 'German'],
    yearsOfExperience: 6,
    about: 'Architectural designer based in London focusing on the adaptive reuse of mid-century residences and contemporary masonry villas across Greater London and Surrey.',
    specializations: ['Residential', 'Heritage'],
    hourlyRate: 85,
    isAvailableForProjects: true,
    availabilityNote: 'Open for residential renovations across Central Europe and the UK.',
    memberSince: 'February 2024',
    stats: {
      projectsCompleted: 8,
      averageRating: 4.75,
      reviewCount: 5,
      responseTime: 'Within 5 hours'
    },
    currentPlanId: 'free',
    planBillingCycle: 'monthly',
    hasActiveProjectsOrEscrow: false,
    credentials: [
      {
        id: 'cred-51',
        registrationBody: 'RIBA',
        registrationNumber: 'UK-RIBA-8812',
        stateOrRegion: 'Greater London',
        year: 2024,
        status: 'pending' // Pending credential!
      }
    ],
    portfolio: [
      {
        id: 'port-51',
        title: 'Hampstead Mid-Century Renovation',
        year: 2024,
        category: 'Residential',
        location: 'Hampstead, London',
        shortDescription: 'Modernization of a 1968 brick villa incorporating floor-to-ceiling glass and local red clay brickwork.',
        role: 'Architect',
        order: 1,
        images: [{ id: 'img-51-1', url: ARCH_IMAGES[1], caption: 'Restored brick facade', isCover: true }]
      },
      {
        id: 'port-52',
        title: 'Richmond Hill Botanical Villa',
        year: 2023,
        category: 'Residential',
        location: 'Richmond, Surrey',
        shortDescription: 'Sloping hill residence with stone retaining walls and breeze blocks.',
        role: 'Lead Architect',
        order: 2,
        images: [{ id: 'img-52-1', url: ARCH_IMAGES[4], caption: 'Slope garden view', isCover: true }]
      }
    ],
    reviews: [
      {
        id: 'rev-51',
        clientName: 'Dr. Arthur Pendelton',
        rating: 4.8,
        reviewText: 'Julian showed immense respect for the architectural integrity of our family estate.',
        projectName: 'Hampstead Mid-Century Renovation',
        date: 'August 12, 2025'
      }
    ],
    payoutAccounts: [],
    invoices: [],
    sessions: [],
    notifications: {
      email: { newMessage: true, proposalViewed: false, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: false },
      inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true }
    }
  },
  {
    id: 'des-6',
    name: 'Sarah Jenkins',
    avatarUrl: '', // No avatar (empty profile mock)
    professionalTitle: 'Architect & 3D Spatial Designer',
    professionalType: 'Architect',
    companyName: '',
    location: { city: 'Geneva', state: 'Geneva Canton', country: 'Switzerland' },
    email: 'sarah.jenkins@dezignet.studio',
    languages: ['English', 'French'],
    yearsOfExperience: 2,
    about: '', // Empty bio
    specializations: ['Interior', 'Commercial'],
    hourlyRate: 65,
    isAvailableForProjects: false,
    memberSince: 'October 2026',
    stats: {
      projectsCompleted: 0,
      averageRating: 0,
      reviewCount: 0,
      responseTime: 'New designer'
    },
    currentPlanId: 'free',
    planBillingCycle: 'monthly',
    hasActiveProjectsOrEscrow: false,
    credentials: [], // No credentials
    portfolio: [], // No portfolio
    reviews: [],
    payoutAccounts: [],
    invoices: [],
    sessions: [],
    notifications: {
      email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true },
      inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true }
    }
  },
  {
    id: 'des-7',
    name: 'Matteo Bianchi',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Urban Designer & Masterplanner',
    professionalType: 'Architect',
    companyName: 'Bianchi Urban Design Studio',
    location: { city: 'Zurich', state: 'Zurich Canton', country: 'Switzerland' },
    email: 'matteo.bianchi@dezignet.studio',
    languages: ['English', 'German', 'Italian'],
    yearsOfExperience: 15,
    about: 'Urban masterplanning and high-density mixed-use developments with focus on walkable transit hubs, public plazas, and solar-integrated facades.',
    specializations: ['Commercial', 'Government', 'Residential'],
    hourlyRate: 150,
    isAvailableForProjects: true,
    availabilityNote: 'Taking select masterplanning contracts for 2027 delivery.',
    memberSince: 'May 2021',
    stats: {
      projectsCompleted: 42,
      averageRating: 4.93,
      reviewCount: 28,
      responseTime: 'Under 2 hours'
    },
    currentPlanId: 'upgraded',
    planBillingCycle: 'yearly',
    hasActiveProjectsOrEscrow: false,
    credentials: [
      {
        id: 'cred-71',
        registrationBody: 'AIA',
        registrationNumber: 'F-2180',
        stateOrRegion: 'Zurich',
        year: 2011,
        status: 'verified'
      }
    ],
    portfolio: [
      {
        id: 'port-71',
        title: 'Basel Innovation Campus Masterplan',
        year: 2024,
        category: 'Government',
        location: 'Basel, Switzerland',
        shortDescription: '150-hectare sustainable smart city grid featuring autonomous transit lanes and decentralized water purification.',
        role: 'Masterplanner',
        order: 1,
        images: [{ id: 'img-71-1', url: ARCH_IMAGES[3], caption: 'Civic center plaza visualization', isCover: true }]
      },
      {
        id: 'port-72',
        title: 'Oxford Innovation Mixed-Use Hub',
        year: 2023,
        category: 'Commercial',
        location: 'Oxfordshire, United Kingdom',
        shortDescription: 'Integrated bus terminal, retail promenade, and 120-unit loft apartments.',
        role: 'Lead Architect',
        order: 2,
        images: [{ id: 'img-72-1', url: ARCH_IMAGES[0], caption: 'Commercial concourse', isCover: true }]
      },
      {
        id: 'port-73',
        title: 'Edinburgh Arts District Plaza',
        year: 2022,
        category: 'Commercial',
        location: 'Edinburgh New Town, UK',
        shortDescription: 'Pedestrianized arts promenade with shaded canopies and outdoor amphitheater.',
        role: 'Urban Designer',
        order: 3,
        images: [{ id: 'img-73-1', url: ARCH_IMAGES[2], caption: 'Amphitheater plaza', isCover: true }]
      }
    ],
    reviews: [
      {
        id: 'rev-71',
        clientName: 'Metropolitan Infrastructure Trust',
        rating: 5,
        reviewText: 'Matteo is a visionary in urban circulation and public space design. A seamless partnership from conception to documentation.',
        projectName: 'Oxford Innovation Mixed-Use Hub',
        date: 'November 04, 2025'
      }
    ],
    payoutAccounts: [],
    invoices: [],
    sessions: [],
    notifications: {
      email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true },
      inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true }
    }
  },
  {
    id: 'des-8',
    name: 'Helena Lindqvist',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Luxury Hospitality Architect & Lighting Designer',
    professionalType: 'Architect',
    companyName: 'Lindqvist Luxury Architecture',
    location: { city: 'Stockholm', state: 'Stockholm County', country: 'Sweden' },
    email: 'helena.lindqvist@dezignet.studio',
    languages: ['English', 'Swedish', 'German'],
    yearsOfExperience: 11,
    about: 'Specialized in five-star boutique hotels, wellness spas, and private island retreats that harmonize architectural lighting with sculptural natural stone.',
    specializations: ['Hospitality', 'Interior Architecture', 'Commercial'],
    hourlyRate: 135,
    isAvailableForProjects: true,
    availabilityNote: 'Available for international & regional hospitality concepts.',
    memberSince: 'April 2022',
    stats: {
      projectsCompleted: 26,
      averageRating: 4.97,
      reviewCount: 19,
      responseTime: 'Under 1 hour'
    },
    currentPlanId: 'upgraded',
    planBillingCycle: 'monthly',
    hasActiveProjectsOrEscrow: false,
    credentials: [
      {
        id: 'cred-81',
        registrationBody: 'RIBA',
        registrationNumber: 'M-4610',
        stateOrRegion: 'Stockholm',
        year: 2015,
        status: 'verified'
      }
    ],
    portfolio: [
      {
        id: 'port-81',
        title: 'Stockholm Archipelago Spa & Wellness Sanctuary',
        year: 2024,
        category: 'Hospitality',
        location: 'Stockholm, Sweden',
        shortDescription: 'Thermal bath retreat crafted with black basalt stone, concealed cove lighting, and open skylights.',
        role: 'Design Director',
        order: 1,
        images: [{ id: 'img-81-1', url: ARCH_IMAGES[6], caption: 'Thermal bath sanctuary', isCover: true }]
      },
      {
        id: 'port-82',
        title: 'Gothenburg Marina Boutique Hotel',
        year: 2023,
        category: 'Hospitality',
        location: 'Gothenburg, Sweden',
        shortDescription: '45-key luxury hotel celebrating Nordic maritime heritage with contemporary teak balconies.',
        role: 'Lead Architect',
        order: 2,
        images: [{ id: 'img-82-1', url: ARCH_IMAGES[4], caption: 'Waterfront terrace suite', isCover: true }]
      },
      {
        id: 'port-83',
        title: 'Geneva Lakefront Executive Lounge',
        year: 2022,
        category: 'Commercial',
        location: 'Geneva, Switzerland',
        shortDescription: 'Rooftop cocktail pavilion with panoramic lake views and kinetic shade louvers.',
        role: 'Architect & Lighting Specialist',
        order: 3,
        images: [{ id: 'img-83-1', url: ARCH_IMAGES[2], caption: 'Illuminated sunset terrace', isCover: true }]
      }
    ],
    reviews: [
      {
        id: 'rev-81',
        clientName: 'Senator M. Peters',
        rating: 5,
        reviewText: 'Halima created a serene retreat that exceeded our expectations. The interplay of lighting and natural water features is world-class.',
        projectName: 'Gulf Coast Spa & Wellness Sanctuary',
        date: 'December 28, 2025'
      }
    ],
    payoutAccounts: [],
    invoices: [],
    sessions: [],
    notifications: {
      email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: false },
      inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true }
    }
  },

  {
    id: 'des-9',
    name: 'Soren Lindberg',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Nordic Timber & Passive House Architect',
    professionalType: 'Architect',
    companyName: 'Lindberg Studio Copenhagen',
    location: { city: 'Copenhagen', state: 'Capital Region', country: 'Denmark' },
    email: 'soren.lindberg@dezignet.studio',
    languages: ['English', 'Danish', 'German'],
    yearsOfExperience: 15,
    about: 'Pioneering mass timber residential communities, cross-laminated timber cantilevers, and net-zero alpine pavilions throughout Northern Europe.',
    specializations: ['Sustainable', 'Residential', 'Commercial'],
    hourlyRate: 155,
    isAvailableForProjects: true,
    availabilityNote: 'Accepting select CLT residential commissions for 2027.',
    memberSince: 'January 2021',
    stats: { projectsCompleted: 42, averageRating: 4.98, reviewCount: 31, responseTime: 'Under 1 hour' },
    currentPlanId: 'upgraded',
    planBillingCycle: 'yearly',
    hasActiveProjectsOrEscrow: false,
    credentials: [{ id: 'cred-91', registrationBody: 'RIBA', registrationNumber: 'DK-9921', stateOrRegion: 'Copenhagen', year: 2011, status: 'verified' }],
    portfolio: [{ id: 'port-91', title: 'Copenhagen Waterfront Eco-Pavilion', year: 2024, category: 'Sustainable', location: 'Copenhagen, Denmark', shortDescription: 'Curvilinear mass timber community hub powered by integrated geothermal loops.', role: 'Lead Architect', order: 1, images: [{ id: 'img-91-1', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80', caption: 'Curvilinear mass timber hall', isCover: true }] }],
    reviews: [{ id: 'rev-91', clientName: 'Mads Mikkelsen', rating: 5, reviewText: 'Soren set a new benchmark for timber architecture. Remarkable acoustic balance.', projectName: 'Copenhagen Waterfront Eco-Pavilion', date: 'January 14, 2026' }],
    payoutAccounts: [], invoices: [], sessions: [],
    notifications: { email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true }, inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true } },
    showInDesignerSearch: true,
    hideRateFromPeers: false
  },
  {
    id: 'des-10',
    name: 'Chiara Moretti',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Historic Preservation & Adaptive Reuse Specialist',
    professionalType: 'Architect',
    companyName: 'Moretti Restauro Atelier',
    location: { city: 'Milan', state: 'Lombardy', country: 'Italy' },
    email: 'chiara.moretti@dezignet.studio',
    languages: ['English', 'Italian', 'French'],
    yearsOfExperience: 12,
    about: 'Breathing contemporary life into centuries-old palazzo courtyards and stone masonry villas across Northern Italy and Switzerland.',
    specializations: ['Historical', 'Residential', 'Interior Architecture'],
    hourlyRate: 145,
    isAvailableForProjects: true,
    availabilityNote: 'Consulting on heritage renovations and palazzo revivals.',
    memberSince: 'March 2023',
    stats: { projectsCompleted: 29, averageRating: 4.94, reviewCount: 22, responseTime: 'Under 2 hours' },
    currentPlanId: 'basic',
    planBillingCycle: 'monthly',
    hasActiveProjectsOrEscrow: false,
    credentials: [{ id: 'cred-101', registrationBody: 'AIA', registrationNumber: 'IT-4412', stateOrRegion: 'Milan', year: 2014, status: 'verified' }],
    portfolio: [{ id: 'port-101', title: 'Brera Palazzo Conversion & Atelier', year: 2024, category: 'Historical', location: 'Milan, Italy', shortDescription: '17th-century terracotta arch preservation integrated with floating steel mezzanine.', role: 'Restoration Lead', order: 1, images: [{ id: 'img-101-1', url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80', caption: 'Vaulted ceiling mezzanine', isCover: true }] }],
    reviews: [{ id: 'rev-101', clientName: 'Gianluigi Bianchi', rating: 5, reviewText: 'Chiara treated our historic family estate with reverence and brilliant modern engineering.', projectName: 'Brera Palazzo Conversion', date: 'November 20, 2025' }],
    payoutAccounts: [], invoices: [], sessions: [],
    notifications: { email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: false }, inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true } },
    showInDesignerSearch: true,
    hideRateFromPeers: false
  },
  {
    id: 'des-11',
    name: 'Marcus Chen',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Lead Structural & Parametric Engineer',
    professionalType: 'Engineer',
    companyName: 'Apex Structural Dynamics',
    location: { city: 'San Francisco', state: 'California', country: 'United States' },
    email: 'marcus.chen@dezignet.studio',
    languages: ['English', 'Mandarin'],
    yearsOfExperience: 16,
    about: 'Seismic engineering director specializing in long-span architectural trusses, glass canopy facades, and post-tensioned concrete residential cantilevers.',
    specializations: ['Structural', 'Parametric', 'Commercial'],
    hourlyRate: 175,
    isAvailableForProjects: true,
    availabilityNote: 'Booking structural calculations for Q1/Q2 high-wind and seismic builds.',
    memberSince: 'September 2021',
    stats: { projectsCompleted: 58, averageRating: 4.99, reviewCount: 44, responseTime: 'Under 1 hour' },
    currentPlanId: 'upgraded',
    planBillingCycle: 'yearly',
    hasActiveProjectsOrEscrow: false,
    credentials: [{ id: 'cred-111', registrationBody: 'PE', registrationNumber: 'CA-88912', stateOrRegion: 'California', year: 2010, status: 'verified' }],
    portfolio: [{ id: 'port-111', title: 'Marin County Cantilever Residence Trusses', year: 2024, category: 'Structural', location: 'Marin County, California', shortDescription: 'Post-tensioned concrete slab spanning 8.5 meters above coastal ridge.', role: 'Principal Engineer', order: 1, images: [{ id: 'img-111-1', url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80', caption: 'Cantilever support view', isCover: true }] }],
    reviews: [{ id: 'rev-111', clientName: 'David S. Miller', rating: 5, reviewText: 'Marcus engineered what three other firms called impossible. Flawless execution.', projectName: 'Marin County Cantilever', date: 'August 12, 2025' }],
    payoutAccounts: [], invoices: [], sessions: [],
    notifications: { email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true }, inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true } },
    showInDesignerSearch: true,
    hideRateFromPeers: true
  },
  {
    id: 'des-12',
    name: 'Astrid Lindau',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Regenerative Landscape Architect',
    professionalType: 'Landscape Architect',
    companyName: 'Lindau Landscape Ecologies',
    location: { city: 'Zurich', state: 'Zurich Canton', country: 'Switzerland' },
    email: 'astrid.lindau@dezignet.studio',
    languages: ['English', 'German', 'French'],
    yearsOfExperience: 13,
    about: 'Crafting private alpine botanical gardens, natural bio-swimming ponds, and steep-slope reforestation for luxury residences along Lake Zurich.',
    specializations: ['Landscape', 'Sustainable', 'Residential'],
    hourlyRate: 130,
    isAvailableForProjects: true,
    availabilityNote: 'Accepting lakefront and alpine landscape commissions.',
    memberSince: 'May 2022',
    stats: { projectsCompleted: 35, averageRating: 4.95, reviewCount: 27, responseTime: 'Under 2 hours' },
    currentPlanId: 'basic',
    planBillingCycle: 'yearly',
    hasActiveProjectsOrEscrow: false,
    credentials: [{ id: 'cred-121', registrationBody: 'RIBA', registrationNumber: 'CH-7102', stateOrRegion: 'Zurich', year: 2013, status: 'verified' }],
    portfolio: [{ id: 'port-121', title: 'Lake Zurich Bio-Swimming Oasis', year: 2024, category: 'Landscape', location: 'Zurich, Switzerland', shortDescription: 'Chemical-free natural filtration swimming basin nestled into granite slope.', role: 'Landscape Architect', order: 1, images: [{ id: 'img-121-1', url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80', caption: 'Natural pool & stone terrace', isCover: true }] }],
    reviews: [{ id: 'rev-121', clientName: 'Felix Baumgartner', rating: 5, reviewText: 'Astrid transformed our rocky lake terrace into a breathtaking native paradise.', projectName: 'Lake Zurich Bio-Swimming Oasis', date: 'October 19, 2025' }],
    payoutAccounts: [], invoices: [], sessions: [],
    notifications: { email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: false }, inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true } },
    showInDesignerSearch: true,
    hideRateFromPeers: false
  },
  {
    id: 'des-13',
    name: 'Henri de Montmirail',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Haute Horlogerie & Luxury Retail Architect',
    professionalType: 'Architect',
    companyName: 'Montmirail Architecture Paris',
    location: { city: 'Paris', state: 'Île-de-France', country: 'France' },
    email: 'henri.montmirail@dezignet.studio',
    languages: ['English', 'French'],
    yearsOfExperience: 18,
    about: 'Boutique flagship architecture for high jewelry, Swiss watchmakers, and Michelin-starred culinary dining rooms along Place Vendôme and Mayfair.',
    specializations: ['Commercial', 'Interior Architecture', 'Hospitality'],
    hourlyRate: 190,
    isAvailableForProjects: false,
    availabilityNote: 'Booked through Q3 2027. Inquiries for 2028 welcome.',
    memberSince: 'February 2020',
    stats: { projectsCompleted: 50, averageRating: 4.97, reviewCount: 38, responseTime: 'Under 4 hours' },
    currentPlanId: 'upgraded',
    planBillingCycle: 'yearly',
    hasActiveProjectsOrEscrow: false,
    credentials: [{ id: 'cred-131', registrationBody: 'AIA', registrationNumber: 'FR-1092', stateOrRegion: 'Paris', year: 2008, status: 'verified' }],
    portfolio: [{ id: 'port-131', title: 'Place Vendôme Horlogerie Salon', year: 2023, category: 'Commercial', location: 'Paris, France', shortDescription: 'Bronze acoustic partitions, museum-grade fiber optic illumination, and travertine display vitrines.', role: 'Principal Architect', order: 1, images: [{ id: 'img-131-1', url: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80', caption: 'Custom brass display vitrines', isCover: true }] }],
    reviews: [{ id: 'rev-131', clientName: 'Jean-Luc Godard', rating: 5, reviewText: 'Henri is a master of refined proportion and tactile luxury.', projectName: 'Place Vendôme Salon', date: 'September 2, 2025' }],
    payoutAccounts: [], invoices: [], sessions: [],
    notifications: { email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true }, inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true } },
    showInDesignerSearch: true,
    hideRateFromPeers: false
  },
  {
    id: 'des-14',
    name: 'Yukihiro Takahashi',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Minimalist Spatial Architect & Tea Pavilion Designer',
    professionalType: 'Architect',
    companyName: 'Takahashi Kukan Atelier',
    location: { city: 'Tokyo', state: 'Tokyo Prefecture', country: 'Japan' },
    email: 'yukihiro.takahashi@dezignet.studio',
    languages: ['English', 'Japanese'],
    yearsOfExperience: 20,
    about: 'Merging sacred Japanese woodworking traditions (Kigumi) with ultra-minimal monolithic concrete architecture and micro-courtyards.',
    specializations: ['Residential', 'Minimalist', 'Cultural'],
    hourlyRate: 165,
    isAvailableForProjects: true,
    availabilityNote: 'Accepting select international residential commissions.',
    memberSince: 'August 2021',
    stats: { projectsCompleted: 46, averageRating: 5.0, reviewCount: 39, responseTime: 'Under 1 hour' },
    currentPlanId: 'upgraded',
    planBillingCycle: 'yearly',
    hasActiveProjectsOrEscrow: false,
    credentials: [{ id: 'cred-141', registrationBody: 'AIA', registrationNumber: 'JP-3301', stateOrRegion: 'Tokyo', year: 2006, status: 'verified' }],
    portfolio: [{ id: 'port-141', title: 'Karuizawa Forest Meditation Retreat', year: 2024, category: 'Residential', location: 'Nagano, Japan', shortDescription: 'Cedar post-and-beam pavilion with sliding washi partitions and frameless glass forest view.', role: 'Lead Architect', order: 1, images: [{ id: 'img-141-1', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80', caption: 'Forest-facing tatami gallery', isCover: true }] }],
    reviews: [{ id: 'rev-141', clientName: 'Kenjiro Watanabe', rating: 5, reviewText: 'An ethereal sanctuary. Yukihiro captured the spiritual harmony of the Karuizawa pines.', projectName: 'Karuizawa Forest Retreat', date: 'July 11, 2025' }],
    payoutAccounts: [], invoices: [], sessions: [],
    notifications: { email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: false }, inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true } },
    showInDesignerSearch: true,
    hideRateFromPeers: false
  },
  {
    id: 'des-15',
    name: 'Maya Linnea',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Workplace Ergonomics & Biophilic Interior Architect',
    professionalType: 'Interior Designer',
    companyName: 'Linnea Studio Stockholm',
    location: { city: 'Stockholm', state: 'Stockholm County', country: 'Sweden' },
    email: 'maya.linnea@dezignet.studio',
    languages: ['English', 'Swedish', 'Norwegian'],
    yearsOfExperience: 9,
    about: 'Creating human-centric corporate headquarters that foster wellbeing, natural circadian lighting, and soundscape acoustic comfort.',
    specializations: ['Commercial', 'Interior Architecture', 'Sustainable'],
    hourlyRate: 120,
    isAvailableForProjects: true,
    availabilityNote: 'Available for European corporate HQ design and advisory.',
    memberSince: 'September 2023',
    stats: { projectsCompleted: 21, averageRating: 4.91, reviewCount: 15, responseTime: 'Under 2 hours' },
    currentPlanId: 'basic',
    planBillingCycle: 'monthly',
    hasActiveProjectsOrEscrow: false,
    credentials: [{ id: 'cred-151', registrationBody: 'RIBA', registrationNumber: 'SE-5521', stateOrRegion: 'Stockholm', year: 2017, status: 'verified' }],
    portfolio: [{ id: 'port-151', title: 'Stockholm Tech Hub Biophilic Commons', year: 2024, category: 'Commercial', location: 'Stockholm, Sweden', shortDescription: '2,500 sqm open workspace featuring living moss walls, ash wood desks, and sound-absorbing felt booths.', role: 'Lead Interior Designer', order: 1, images: [{ id: 'img-151-1', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80', caption: 'Biophilic collaboration lounge', isCover: true }] }],
    reviews: [{ id: 'rev-151', clientName: 'Elinor Falk', rating: 5, reviewText: 'Our employee satisfaction skyrocketed by 35% after moving into Maya’s designed workspace.', projectName: 'Stockholm Tech Hub', date: 'May 30, 2025' }],
    payoutAccounts: [], invoices: [], sessions: [],
    notifications: { email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true }, inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true } },
    showInDesignerSearch: true,
    hideRateFromPeers: false
  },
  {
    id: 'des-16',
    name: 'Callum MacLeod',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Coastal Cliffside Structural Engineer',
    professionalType: 'Engineer',
    companyName: 'MacLeod Engineering Edinburgh',
    location: { city: 'Edinburgh', state: 'Midlothian', country: 'United Kingdom' },
    email: 'callum.macleod@dezignet.studio',
    languages: ['English', 'Gaelic'],
    yearsOfExperience: 14,
    about: 'Specialized in steep cliff foundation engineering, marine environment concrete durability, and gale-force wind resistant cantilever framing.',
    specializations: ['Structural', 'Coastal', 'Residential'],
    hourlyRate: 150,
    isAvailableForProjects: true,
    availabilityNote: 'Advising on Scottish coastal, Hebridean, and Irish Atlantic cliffs.',
    memberSince: 'March 2022',
    stats: { projectsCompleted: 33, averageRating: 4.96, reviewCount: 25, responseTime: 'Under 3 hours' },
    currentPlanId: 'upgraded',
    planBillingCycle: 'monthly',
    hasActiveProjectsOrEscrow: false,
    credentials: [{ id: 'cred-161', registrationBody: 'PE', registrationNumber: 'UK-6712', stateOrRegion: 'Edinburgh', year: 2012, status: 'verified' }],
    portfolio: [{ id: 'port-161', title: 'Isle of Skye Cliff Edge Retreat Substructure', year: 2024, category: 'Structural', location: 'Isle of Skye, UK', shortDescription: 'Anchored rock bolts and micro-piles supporting cantilevered basalt glass residence.', role: 'Chief Structural Engineer', order: 1, images: [{ id: 'img-161-1', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80', caption: 'Anchored cliffside foundations', isCover: true }] }],
    reviews: [{ id: 'rev-161', clientName: 'Rory Stewart', rating: 5, reviewText: 'Callum is the only engineer we trust on the stormy Atlantic coast.', projectName: 'Isle of Skye Retreat', date: 'April 4, 2025' }],
    payoutAccounts: [], invoices: [], sessions: [],
    notifications: { email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: false }, inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true } },
    showInDesignerSearch: true,
    hideRateFromPeers: false
  },
  {
    id: 'des-17',
    name: 'Beatrix von Berg',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Alpine Chalet & Thermal Bath Architect',
    professionalType: 'Architect',
    companyName: 'Studio Von Berg St. Moritz',
    location: { city: 'St. Moritz', state: 'Grisons', country: 'Switzerland' },
    email: 'beatrix.vonberg@dezignet.studio',
    languages: ['English', 'German', 'Italian'],
    yearsOfExperience: 17,
    about: 'Sculpting high-altitude luxury chalets, natural stone thermal grottos, and avalanche-deflecting residential forms across the Engadin valley.',
    specializations: ['Hospitality', 'Residential', 'Alpine'],
    hourlyRate: 180,
    isAvailableForProjects: true,
    availabilityNote: 'Booking St. Moritz and Zermatt chalet builds for 2027.',
    memberSince: 'June 2021',
    stats: { projectsCompleted: 40, averageRating: 4.98, reviewCount: 32, responseTime: 'Under 1 hour' },
    currentPlanId: 'upgraded',
    planBillingCycle: 'yearly',
    hasActiveProjectsOrEscrow: false,
    credentials: [{ id: 'cred-171', registrationBody: 'AIA', registrationNumber: 'CH-9914', stateOrRegion: 'Grisons', year: 2009, status: 'verified' }],
    portfolio: [{ id: 'port-171', title: 'Engadin Valley Monolithic Slate Chalet', year: 2024, category: 'Residential', location: 'St. Moritz, Switzerland', shortDescription: 'Deep recessed timber window reveals, heated local Valser quartzite floors, and private ski vault.', role: 'Principal Architect', order: 1, images: [{ id: 'img-171-1', url: 'https://images.unsplash.com/photo-1542314831-c6a4d2720d2d?auto=format&fit=crop&w=1200&q=80', caption: 'Chalet exterior snowscape', isCover: true }] }],
    reviews: [{ id: 'rev-171', clientName: 'Gunter Sachs Estate', rating: 5, reviewText: 'Beatrix understands the quiet grandeur of the Swiss Alps like no other.', projectName: 'Engadin Valley Chalet', date: 'March 15, 2025' }],
    payoutAccounts: [], invoices: [], sessions: [],
    notifications: { email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true }, inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true } },
    showInDesignerSearch: true,
    hideRateFromPeers: false
  },
  {
    id: 'des-18',
    name: 'Liam O’Connor',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Civil Water Systems & Sustainable Drainage Engineer',
    professionalType: 'Engineer',
    companyName: 'O’Connor Hydrology Dublin',
    location: { city: 'Dublin', state: 'Leinster', country: 'Ireland' },
    email: 'liam.oconnor@dezignet.studio',
    languages: ['English'],
    yearsOfExperience: 11,
    about: 'Designing low-impact flood mitigation systems, porous urban paving, and integrated rainwater recycling infrastructure for estate developments.',
    specializations: ['Civil', 'Water Systems', 'Sustainable'],
    hourlyRate: 125,
    isAvailableForProjects: true,
    availabilityNote: 'Available for SuDS design, environmental site impact assessments.',
    memberSince: 'October 2022',
    stats: { projectsCompleted: 24, averageRating: 4.88, reviewCount: 18, responseTime: 'Under 3 hours' },
    currentPlanId: 'free',
    planBillingCycle: 'monthly',
    hasActiveProjectsOrEscrow: false,
    credentials: [{ id: 'cred-181', registrationBody: 'PE', registrationNumber: 'IE-4029', stateOrRegion: 'Dublin', year: 2015, status: 'verified' }],
    portfolio: [{ id: 'port-181', title: 'Wicklow Eco-Estate SuDS & Wetland', year: 2023, category: 'Sustainable', location: 'Wicklow, Ireland', shortDescription: 'Cascade bio-retention swales preventing flood runoff into salmon rivers.', role: 'Civil Water Engineer', order: 1, images: [{ id: 'img-181-1', url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80', caption: 'Natural retention wetlands', isCover: true }] }],
    reviews: [{ id: 'rev-181', clientName: 'Liam Kavanagh', rating: 5, reviewText: 'Delivered full environmental planning approval 4 weeks early.', projectName: 'Wicklow Eco-Estate', date: 'February 19, 2025' }],
    payoutAccounts: [], invoices: [], sessions: [],
    notifications: { email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: false }, inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true } },
    showInDesignerSearch: true,
    hideRateFromPeers: false
  },
  {
    id: 'des-19',
    name: 'Nathalie Vasseur',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Botanical Garden & Urban Rooftop Designer',
    professionalType: 'Landscape Architect',
    companyName: 'Atelier Vasseur Paysage',
    location: { city: 'Geneva', state: 'Geneva Canton', country: 'Switzerland' },
    email: 'nathalie.vasseur@dezignet.studio',
    languages: ['English', 'French'],
    yearsOfExperience: 15,
    about: 'Designing high-density living green walls, rooftop pollinator sanctuaries, and diplomatic courtyard fountains for European organizations and private estates.',
    specializations: ['Landscape', 'Urban Ecology', 'Commercial'],
    hourlyRate: 140,
    isAvailableForProjects: true,
    availabilityNote: 'Booking spring and summer botanical landscape designs.',
    memberSince: 'April 2021',
    stats: { projectsCompleted: 38, averageRating: 4.96, reviewCount: 30, responseTime: 'Under 2 hours' },
    currentPlanId: 'upgraded',
    planBillingCycle: 'yearly',
    hasActiveProjectsOrEscrow: false,
    credentials: [{ id: 'cred-191', registrationBody: 'RIBA', registrationNumber: 'CH-8411', stateOrRegion: 'Geneva', year: 2011, status: 'verified' }],
    portfolio: [{ id: 'port-191', title: 'Geneva Lakefront Living Wall & Courtyard', year: 2024, category: 'Landscape', location: 'Geneva, Switzerland', shortDescription: 'Three-story vertical hydroponic botanical wall with native alpine ferns.', role: 'Landscape Director', order: 1, images: [{ id: 'img-191-1', url: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1200&q=80', caption: 'Vertical garden atrium', isCover: true }] }],
    reviews: [{ id: 'rev-191', clientName: 'Mme. Catherine Dufour', rating: 5, reviewText: 'Nathalie brought an extraordinary level of botanical artistry to our Geneva mission.', projectName: 'Geneva Lakefront Living Wall', date: 'December 1, 2025' }],
    payoutAccounts: [], invoices: [], sessions: [],
    notifications: { email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: false }, inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true } },
    showInDesignerSearch: true,
    hideRateFromPeers: false
  },
  {
    id: 'des-20',
    name: 'Darius Thorne',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Monolithic Concrete & Desert Villa Architect',
    professionalType: 'Architect',
    companyName: 'Thorne Desert Studio',
    location: { city: 'Austin', state: 'Texas', country: 'United States' },
    email: 'darius.thorne@dezignet.studio',
    languages: ['English', 'Spanish'],
    yearsOfExperience: 14,
    about: 'Crafting board-formed concrete residences, thermal mass passive cooling homes, and desert courtyard estates that blur inside and outside living.',
    specializations: ['Residential', 'Sustainable', 'Brutalist'],
    hourlyRate: 150,
    isAvailableForProjects: true,
    availabilityNote: 'Accepting Hill Country and desert modern commissions.',
    memberSince: 'July 2022',
    stats: { projectsCompleted: 31, averageRating: 4.93, reviewCount: 23, responseTime: 'Under 1 hour' },
    currentPlanId: 'upgraded',
    planBillingCycle: 'monthly',
    hasActiveProjectsOrEscrow: false,
    credentials: [{ id: 'cred-201', registrationBody: 'AIA', registrationNumber: 'TX-2901', stateOrRegion: 'Texas', year: 2012, status: 'verified' }],
    portfolio: [{ id: 'port-201', title: 'Austin Hill Country Board-Formed Villa', year: 2024, category: 'Residential', location: 'Austin, Texas', shortDescription: 'Thermal mass concrete home with cantilevered steel shade canopies overlooking Lake Travis.', role: 'Lead Architect', order: 1, images: [{ id: 'img-201-1', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80', caption: 'Concrete terrace & pool', isCover: true }] }],
    reviews: [{ id: 'rev-201', clientName: 'Travis Vance', rating: 5, reviewText: 'Darius designed our dream sanctuary. The thermal efficiency in Texas summers is astonishing.', projectName: 'Austin Hill Country Villa', date: 'October 8, 2025' }],
    payoutAccounts: [], invoices: [], sessions: [],
    notifications: { email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true }, inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true } },
    showInDesignerSearch: true,
    hideRateFromPeers: false
  },
  {
    id: 'des-21',
    name: 'Anika Sharma',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Architectural Lighting & Spatial Experience Designer',
    professionalType: 'Interior Designer',
    companyName: 'Lumen Studio London',
    location: { city: 'London', state: 'Greater London', country: 'United Kingdom' },
    email: 'anika.sharma@dezignet.studio',
    languages: ['English', 'Hindi'],
    yearsOfExperience: 10,
    about: 'Specialized in bespoke luxury architectural lighting, subtle cove illumination, circadian fixtures, and contemporary gallery installations.',
    specializations: ['Lighting Design', 'Interior Architecture', 'Commercial'],
    hourlyRate: 130,
    isAvailableForProjects: true,
    availabilityNote: 'Booking lighting consultation for luxury residential and retail.',
    memberSince: 'November 2023',
    stats: { projectsCompleted: 25, averageRating: 4.95, reviewCount: 19, responseTime: 'Under 2 hours' },
    currentPlanId: 'basic',
    planBillingCycle: 'monthly',
    hasActiveProjectsOrEscrow: false,
    credentials: [{ id: 'cred-211', registrationBody: 'RIBA', registrationNumber: 'UK-8820', stateOrRegion: 'London', year: 2016, status: 'verified' }],
    portfolio: [{ id: 'port-211', title: 'Mayfair Contemporary Art Gallery Lighting', year: 2024, category: 'Commercial', location: 'London, UK', shortDescription: 'Tunable white 98+ CRI gallery illumination system with zero shadow distortion.', role: 'Lighting Director', order: 1, images: [{ id: 'img-211-1', url: 'https://images.unsplash.com/photo-1541123437800-1bb1317badc2?auto=format&fit=crop&w=1200&q=80', caption: 'Gallery lighting installation', isCover: true }] }],
    reviews: [{ id: 'rev-211', clientName: 'Grosvenor Art Foundation', rating: 5, reviewText: 'Anika elevated the artwork with sublime lighting mastery.', projectName: 'Mayfair Art Gallery', date: 'November 15, 2025' }],
    payoutAccounts: [], invoices: [], sessions: [],
    notifications: { email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: false }, inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true } },
    showInDesignerSearch: true,
    hideRateFromPeers: true
  },
  {
    id: 'des-22',
    name: 'Klaus Reinhardt',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Façade Engineering & Kinetic Solar Louvers Specialist',
    professionalType: 'Engineer',
    companyName: 'Reinhardt Façade Lab Berlin',
    location: { city: 'Berlin', state: 'Berlin State', country: 'Germany' },
    email: 'klaus.reinhardt@dezignet.studio',
    languages: ['English', 'German'],
    yearsOfExperience: 15,
    about: 'Custom curtain wall design, triple-glazed thermal envelopes, and dynamic motorized brise-soleil facades for commercial towers and museums.',
    specializations: ['Façade Engineering', 'Commercial', 'Sustainable'],
    hourlyRate: 160,
    isAvailableForProjects: true,
    availabilityNote: 'Consulting on European high-performance façade engineering.',
    memberSince: 'January 2022',
    stats: { projectsCompleted: 37, averageRating: 4.94, reviewCount: 28, responseTime: 'Under 1 hour' },
    currentPlanId: 'upgraded',
    planBillingCycle: 'yearly',
    hasActiveProjectsOrEscrow: false,
    credentials: [{ id: 'cred-221', registrationBody: 'PE', registrationNumber: 'DE-7719', stateOrRegion: 'Berlin', year: 2011, status: 'verified' }],
    portfolio: [{ id: 'port-221', title: 'Berlin Tech Campus Kinetic Louver Façade', year: 2023, category: 'Façade', location: 'Berlin, Germany', shortDescription: 'Autonomous sun-tracking perforated bronze panels reducing cooling loads by 48%.', role: 'Façade Lead', order: 1, images: [{ id: 'img-221-1', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80', caption: 'Kinetic bronze façade', isCover: true }] }],
    reviews: [{ id: 'rev-221', clientName: 'Berlin Innovation Trust', rating: 5, reviewText: 'Klaus’s façade engineering cut our energy targets well ahead of EU 2030 standards.', projectName: 'Berlin Tech Campus', date: 'August 29, 2025' }],
    payoutAccounts: [], invoices: [], sessions: [],
    notifications: { email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true }, inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true } },
    showInDesignerSearch: true,
    hideRateFromPeers: false
  },
  {
    id: 'des-23',
    name: 'Camilla Rossi',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Mediterranean Cliffside & Terrazzo Architect',
    professionalType: 'Architect',
    companyName: 'Rossi Architettura Amalfi',
    location: { city: 'Naples', state: 'Campania', country: 'Italy' },
    email: 'camilla.rossi@dezignet.studio',
    languages: ['English', 'Italian'],
    yearsOfExperience: 13,
    about: 'Crafting coastal limestone residences, infinity pool lookouts, and custom cast-in-place terrazzo patios along the Amalfi Coast and Capri.',
    specializations: ['Residential', 'Coastal', 'Interior Architecture'],
    hourlyRate: 145,
    isAvailableForProjects: true,
    availabilityNote: 'Booking Amalfi and Mediterranean villas for late 2026.',
    memberSince: 'April 2023',
    stats: { projectsCompleted: 27, averageRating: 4.96, reviewCount: 20, responseTime: 'Under 2 hours' },
    currentPlanId: 'basic',
    planBillingCycle: 'monthly',
    hasActiveProjectsOrEscrow: false,
    credentials: [{ id: 'cred-231', registrationBody: 'AIA', registrationNumber: 'IT-5510', stateOrRegion: 'Campania', year: 2013, status: 'verified' }],
    portfolio: [{ id: 'port-231', title: 'Positano Cliffside Terraced Villa', year: 2024, category: 'Residential', location: 'Positano, Italy', shortDescription: 'Carved into coastal cliffs with whitewashed arches, olive courtyards, and sea views.', role: 'Lead Architect', order: 1, images: [{ id: 'img-231-1', url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80', caption: 'Positano terrace overlooking Mediterranean', isCover: true }] }],
    reviews: [{ id: 'rev-231', clientName: 'Conte Andrea Visconti', rating: 5, reviewText: 'Camilla captured the timeless poetry of Positano with sublime sensitivity.', projectName: 'Positano Cliffside Villa', date: 'October 12, 2025' }],
    payoutAccounts: [], invoices: [], sessions: [],
    notifications: { email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: false }, inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true } },
    showInDesignerSearch: true,
    hideRateFromPeers: false
  },
  {
    id: 'des-24',
    name: 'Zane Gallagher',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
    professionalTitle: 'Passive Solar & Rammed Earth Architect',
    professionalType: 'Architect',
    companyName: 'Gallagher Earth Atelier',
    location: { city: 'Boulder', state: 'Colorado', country: 'United States' },
    email: 'zane.gallagher@dezignet.studio',
    languages: ['English'],
    yearsOfExperience: 12,
    about: 'Specialized in rammed earth thermal walls, triple-glazed solar solariums, and off-grid mountain cabins designed to harmonize with Rocky Mountain geology.',
    specializations: ['Sustainable', 'Residential', 'Passive Solar'],
    hourlyRate: 135,
    isAvailableForProjects: true,
    availabilityNote: 'Accepting Rocky Mountain off-grid commissions.',
    memberSince: 'May 2023',
    stats: { projectsCompleted: 22, averageRating: 4.92, reviewCount: 17, responseTime: 'Under 1 hour' },
    currentPlanId: 'free',
    planBillingCycle: 'monthly',
    hasActiveProjectsOrEscrow: false,
    credentials: [{ id: 'cred-241', registrationBody: 'AIA', registrationNumber: 'CO-9931', stateOrRegion: 'Colorado', year: 2014, status: 'verified' }],
    portfolio: [{ id: 'port-241', title: 'Boulder Canyon Rammed Earth Sanctuary', year: 2024, category: 'Sustainable', location: 'Boulder, Colorado', shortDescription: 'Thermal rammed earth spine retaining passive solar heat through Rocky Mountain winters.', role: 'Lead Architect', order: 1, images: [{ id: 'img-241-1', url: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1200&q=80', caption: 'Rammed earth south-facing facade', isCover: true }] }],
    reviews: [{ id: 'rev-241', clientName: 'Garrett Vance', rating: 5, reviewText: 'The home stays naturally warm in sub-zero winters with almost zero active heating.', projectName: 'Boulder Canyon Sanctuary', date: 'December 22, 2025' }],
    payoutAccounts: [], invoices: [], sessions: [],
    notifications: { email: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: false }, inApp: { newMessage: true, proposalViewed: true, proposalShortlisted: true, proposalAccepted: true, milestoneApproved: true, paymentReleased: true, platformNews: true } },
    showInDesignerSearch: true,
    hideRateFromPeers: false
  }

];

// In-memory working copy
let designersStore: DesignerProfile[] = JSON.parse(JSON.stringify(INITIAL_DESIGNERS));

// Global simulation states
let activeLoggedUserId: string = 'des-1'; // Default: Alexandre Sterling
let currentViewerRole: ViewerRole = 'client'; // Default: Client viewing public profile
let mockProposalHistory: Record<string, boolean> = {
  // Key: designerId, Value: whether current client has received a proposal from this designer
  'des-1': true, // Client HAS received proposal from Alexandre -> Message button shown!
  'des-2': false, // No proposal -> Message button hidden with helper text
  'des-3': false,
  'des-4': false,
  'des-5': false,
  'des-6': false,
  'des-7': false,
  'des-8': false
};

// ============================================================================
// PROFILE COMPLETENESS CALCULATION
// ============================================================================
export function calculateProfileCompleteness(profile: DesignerProfile): ProfileCompletenessResult {
  const checklist: CompletenessCheckItem[] = [
    {
      id: 'photo',
      label: 'Profile photo',
      tab: 'profile',
      completed: Boolean(profile.avatarUrl && profile.avatarUrl.trim().length > 0)
    },
    {
      id: 'bio',
      label: 'About & bio (min 50 characters)',
      tab: 'profile',
      completed: Boolean(profile.about && profile.about.trim().length >= 50)
    },
    {
      id: 'specialization',
      label: 'Specialization & title',
      tab: 'profile',
      completed: Boolean(
        profile.professionalTitle &&
        profile.specializations &&
        profile.specializations.length > 0
      )
    },
    {
      id: 'portfolio',
      label: 'Portfolio (min 3 projects)',
      tab: 'portfolio',
      completed: Boolean(profile.portfolio && profile.portfolio.length >= 3)
    },
    {
      id: 'credentials',
      label: 'Professional registration / credentials',
      tab: 'credentials',
      completed: Boolean(profile.credentials && profile.credentials.length >= 1)
    }
  ];

  const completedCount = checklist.filter((item) => item.completed).length;
  const score = Math.round((completedCount / checklist.length) * 100);

  return { score, checklist };
}

// ============================================================================
// SERVICE FUNCTIONS (Swappable for Real APIs)
// ============================================================================

export async function getProfile(): Promise<DesignerProfile> {
  await delay(120);
  const found = designersStore.find((d) => d.id === activeLoggedUserId);
  if (!found) {
    return JSON.parse(JSON.stringify(designersStore[0]));
  }
  return JSON.parse(JSON.stringify(found));
}

export async function updateProfile(updates: Partial<DesignerProfile>): Promise<DesignerProfile> {
  await delay(150);
  const index = designersStore.findIndex((d) => d.id === activeLoggedUserId);
  if (index === -1) throw new Error('Designer profile not found');

  designersStore[index] = {
    ...designersStore[index],
    ...updates,
    location: {
      ...designersStore[index].location,
      ...(updates.location || {})
    }
  };

  return JSON.parse(JSON.stringify(designersStore[index]));
}

export async function uploadPortfolioItem(
  item: Omit<PortfolioProject, 'id' | 'order'>
): Promise<PortfolioProject> {
  await delay(200);
  const profile = designersStore.find((d) => d.id === activeLoggedUserId);
  if (!profile) throw new Error('Designer profile not found');

  const newId = `port-${Date.now()}`;
  const newOrder = profile.portfolio.length + 1;
  const newProject: PortfolioProject = {
    ...item,
    id: newId,
    order: newOrder
  };

  profile.portfolio.push(newProject);
  return JSON.parse(JSON.stringify(newProject));
}

export async function updatePortfolioItem(
  id: string,
  updates: Partial<PortfolioProject>
): Promise<PortfolioProject> {
  await delay(180);
  const profile = designersStore.find((d) => d.id === activeLoggedUserId);
  if (!profile) throw new Error('Designer profile not found');

  const pIndex = profile.portfolio.findIndex((p) => p.id === id);
  if (pIndex === -1) throw new Error('Portfolio project not found');

  profile.portfolio[pIndex] = {
    ...profile.portfolio[pIndex],
    ...updates
  };

  return JSON.parse(JSON.stringify(profile.portfolio[pIndex]));
}

export async function reorderPortfolio(projectIds: string[]): Promise<PortfolioProject[]> {
  await delay(120);
  const profile = designersStore.find((d) => d.id === activeLoggedUserId);
  if (!profile) throw new Error('Designer profile not found');

  const reordered: PortfolioProject[] = [];
  projectIds.forEach((id, index) => {
    const item = profile.portfolio.find((p) => p.id === id);
    if (item) {
      item.order = index + 1;
      reordered.push(item);
    }
  });

  profile.portfolio = reordered;
  return JSON.parse(JSON.stringify(profile.portfolio));
}

export async function deletePortfolioItem(id: string): Promise<boolean> {
  await delay(150);
  const profile = designersStore.find((d) => d.id === activeLoggedUserId);
  if (!profile) throw new Error('Designer profile not found');

  profile.portfolio = profile.portfolio.filter((p) => p.id !== id);
  // Re-index orders
  profile.portfolio.forEach((p, idx) => {
    p.order = idx + 1;
  });
  return true;
}

export async function getPublicProfile(id: string): Promise<DesignerProfile | null> {
  await delay(140);
  const designer = designersStore.find((d) => d.id === id);
  if (!designer) return null;
  return JSON.parse(JSON.stringify(designer));
}

export async function getPublicDesignersList(): Promise<DesignerProfile[]> {
  await delay(100);
  return JSON.parse(JSON.stringify(designersStore));
}

export async function changePassword(
  currentPass: string,
  newPass: string
): Promise<{ success: boolean; error?: string }> {
  await delay(300);
  if (currentPass !== 'Dezignet2026!' && currentPass.length < 6) {
    return { success: false, error: 'Current password does not match our records.' };
  }
  if (newPass.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters long.' };
  }
  return { success: true };
}

export async function addCredential(
  cred: Omit<DesignerCredential, 'id' | 'status'>
): Promise<DesignerCredential> {
  await delay(180);
  const profile = designersStore.find((d) => d.id === activeLoggedUserId);
  if (!profile) throw new Error('Profile not found');

  const newCred: DesignerCredential = {
    ...cred,
    id: `cred-${Date.now()}`,
    status: 'pending' // Initial status is pending review
  };

  profile.credentials.push(newCred);
  return JSON.parse(JSON.stringify(newCred));
}

export async function updateCredential(
  id: string,
  updates: Partial<DesignerCredential>
): Promise<DesignerCredential> {
  await delay(180);
  const profile = designersStore.find((d) => d.id === activeLoggedUserId);
  if (!profile) throw new Error('Profile not found');

  const cIndex = profile.credentials.findIndex((c) => c.id === id);
  if (cIndex === -1) throw new Error('Credential not found');

  const existing = profile.credentials[cIndex];
  // Rule: changing a verified credential resets status to pending review
  const nextStatus: CredentialStatus =
    existing.status === 'verified' ? 'pending' : updates.status || existing.status;

  profile.credentials[cIndex] = {
    ...existing,
    ...updates,
    status: nextStatus
  };

  return JSON.parse(JSON.stringify(profile.credentials[cIndex]));
}

export async function deleteCredential(id: string): Promise<boolean> {
  await delay(150);
  const profile = designersStore.find((d) => d.id === activeLoggedUserId);
  if (!profile) throw new Error('Profile not found');

  profile.credentials = profile.credentials.filter((c) => c.id !== id);
  return true;
}

export async function addPayoutAccount(
  account: Omit<PayoutAccount, 'id' | 'isPrimary'>
): Promise<PayoutAccount> {
  await delay(200);
  const profile = designersStore.find((d) => d.id === activeLoggedUserId);
  if (!profile) throw new Error('Profile not found');

  const last4 = account.accountNumberMasked.slice(-4);
  const masked = `••••••${last4}`;
  const newAccount: PayoutAccount = {
    id: `payout-${Date.now()}`,
    bankName: account.bankName,
    accountNumberMasked: masked,
    accountName: account.accountName,
    isPrimary: profile.payoutAccounts.length === 0
  };

  profile.payoutAccounts.push(newAccount);
  return JSON.parse(JSON.stringify(newAccount));
}

export async function updateNotificationSettings(
  settings: Partial<DesignerNotificationSettings>
): Promise<DesignerNotificationSettings> {
  await delay(100);
  const profile = designersStore.find((d) => d.id === activeLoggedUserId);
  if (!profile) throw new Error('Profile not found');

  profile.notifications = {
    email: { ...profile.notifications.email, ...(settings.email || {}) },
    inApp: { ...profile.notifications.inApp, ...(settings.inApp || {}) }
  };

  return JSON.parse(JSON.stringify(profile.notifications));
}

export async function deleteAccount(
  confirmEmail: string
): Promise<{ success: boolean; error?: string }> {
  await delay(300);
  const profile = designersStore.find((d) => d.id === activeLoggedUserId);
  if (!profile) return { success: false, error: 'User not found.' };

  if (confirmEmail.trim().toLowerCase() !== profile.email.toLowerCase()) {
    return { success: false, error: 'Entered email does not match your account email.' };
  }

  if (profile.hasActiveProjectsOrEscrow) {
    return {
      success: false,
      error: 'Cannot delete account while you have active milestone projects or funds in escrow. Complete or cancel all ongoing commissions first.'
    };
  }

  // Remove designer
  designersStore = designersStore.filter((d) => d.id !== activeLoggedUserId);
  return { success: true };
}

// ============================================================================
// SIMULATION & DEV SWITCHERS
// ============================================================================

export function getMockProfileState(): MockProfileStateKey {
  if (activeLoggedUserId === 'des-1') return 'complete';
  if (activeLoggedUserId === 'des-5') return 'incomplete';
  return 'empty';
}

export function setMockProfileState(state: MockProfileStateKey): void {
  if (state === 'complete') activeLoggedUserId = 'des-1';
  else if (state === 'incomplete') activeLoggedUserId = 'des-5';
  else activeLoggedUserId = 'des-6';
}

export function getViewerRole(): ViewerRole {
  return currentViewerRole;
}

export function setViewerRole(role: ViewerRole): void {
  currentViewerRole = role;
}

export function hasClientReceivedProposal(designerId: string): boolean {
  return Boolean(mockProposalHistory[designerId]);
}

export function setClientReceivedProposal(designerId: string, has: boolean): void {
  mockProposalHistory[designerId] = has;
}

export function getActiveLoggedUserId(): string {
  return activeLoggedUserId;
}

// Helper utility
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


// ============================================================================
// DESIGNER SEARCH & SAVED TALENT SERVICE
// ============================================================================

export interface DesignerSearchParams {
  query?: string;
  professionalType?: string;
  specializations?: string[];
  location?: string;
  cityOrState?: string;
  minYears?: number;
  minExperience?: number;
  minRating?: number;
  verifiedOnly?: boolean;
  availableOnly?: boolean;
  onlySaved?: boolean;
  sort?: 'best_match' | 'highest_rated' | 'most_experienced' | 'newest';
  page?: number;
  limit?: number;
}

export interface DesignerSearchResult {
  designers: DesignerProfile[];
  totalCount: number;
  hasMore: boolean;
  page: number;
}

// In-memory saved designer IDs
const savedDesignerIds = new Set<string>(['des-9', 'des-11', 'des-14']);

export function getSavedDesignerIds(): string[] {
  return Array.from(savedDesignerIds);
}

export function isDesignerSaved(id: string): boolean {
  return savedDesignerIds.has(id);
}

export function toggleSaveDesigner(id: string): boolean {
  if (savedDesignerIds.has(id)) {
    savedDesignerIds.delete(id);
    return false;
  } else {
    savedDesignerIds.add(id);
    return true;
  }
}

/**
 * Search designers with query, filters, sorting, and pagination.
 * Excludes viewing designer's own profile and respects privacy settings.
 */
export async function searchDesigners(
  paramsOrQuery: string | DesignerSearchParams = {},
  extraFilters?: DesignerSearchParams,
  extraSort?: 'best_match' | 'highest_rated' | 'most_experienced' | 'newest',
  extraPage?: number
): Promise<DesignerSearchResult> {
  await delay(120);

  let params: DesignerSearchParams = {};
  if (typeof paramsOrQuery === 'string') {
    params = {
      query: paramsOrQuery,
      ...extraFilters,
      sort: extraSort || extraFilters?.sort,
      page: extraPage || extraFilters?.page
    };
  } else {
    params = paramsOrQuery || {};
  }

  const {
    query = '',
    professionalType = '',
    specializations = [],
    location = params.cityOrState || '',
    minYears = params.minExperience || 0,
    minRating = 0,
    verifiedOnly = false,
    availableOnly = false,
    onlySaved = false,
    sort = 'best_match',
    page = 1,
    limit = 12
  } = params;

  const currentUserId = getActiveLoggedUserId();
  const q = query.trim().toLowerCase();

  let results = designersStore.filter((d) => {
    // 0. Only saved filter
    if (onlySaved && !savedDesignerIds.has(d.id)) return false;

    // 1. Exclude viewing designer's own profile
    if (d.id === currentUserId) return false;

    // 2. Respect privacy toggle: "Show my profile in designer search"
    if (d.showInDesignerSearch === false) return false;

    // 3. Text query (name, title, specialization, location)
    if (q) {
      const matchName = d.name.toLowerCase().includes(q);
      const matchTitle = (d.professionalTitle || '').toLowerCase().includes(q);
      const matchSpec = (d.specializations || []).some((s) => s.toLowerCase().includes(q));
      const matchCity = (d.location.city || '').toLowerCase().includes(q);
      const matchCountry = (d.location.country || '').toLowerCase().includes(q);
      const matchAbout = (d.about || '').toLowerCase().includes(q);
      if (!matchName && !matchTitle && !matchSpec && !matchCity && !matchCountry && !matchAbout) {
        return false;
      }
    }

    // 4. Professional type
    if (professionalType && professionalType !== 'all') {
      if (d.professionalType.toLowerCase() !== professionalType.toLowerCase()) return false;
    }

    // 5. Specializations (multi-select filter)
    if (specializations.length > 0) {
      const hasMatch = specializations.some((spec) =>
        d.specializations.map((s) => s.toLowerCase()).includes(spec.toLowerCase())
      );
      if (!hasMatch) return false;
    }

    // 6. Location
    if (location && location !== 'all') {
      const locQ = location.toLowerCase();
      const inCity = d.location.city.toLowerCase().includes(locQ);
      const inState = d.location.state.toLowerCase().includes(locQ);
      const inCountry = d.location.country.toLowerCase().includes(locQ);
      if (!inCity && !inState && !inCountry) return false;
    }

    // 7. Years of Experience
    if (minYears > 0 && d.yearsOfExperience < minYears) return false;

    // 8. Rating
    if (minRating > 0 && d.stats.averageRating < minRating) return false;

    // 9. Verified credentials only
    if (verifiedOnly) {
      const hasVerified = d.credentials.some((c) => c.status === 'verified');
      if (!hasVerified) return false;
    }

    // 10. Available for new projects only
    if (availableOnly && !d.isAvailableForProjects) return false;

    return true;
  });

  // Sorting
  if (sort === 'highest_rated') {
    results.sort((a, b) => b.stats.averageRating - a.stats.averageRating);
  } else if (sort === 'most_experienced') {
    results.sort((a, b) => b.yearsOfExperience - a.yearsOfExperience);
  } else if (sort === 'newest') {
    results.sort((a, b) => b.id.localeCompare(a.id));
  } else {
    // Best match: rating * completed projects
    results.sort((a, b) => (b.stats.averageRating * b.stats.projectsCompleted) - (a.stats.averageRating * a.stats.projectsCompleted));
  }

  const totalCount = results.length;
  const startIndex = (page - 1) * limit;
  const paginated = results.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < totalCount;

  // Respect "Hide my hourly rate from other designers" for results
  const sanitized = paginated.map((d) => {
    const copy = JSON.parse(JSON.stringify(d));
    if (copy.hideRateFromPeers) {
      delete copy.hourlyRate;
    }
    return copy;
  });

  return {
    designers: sanitized,
    totalCount,
    hasMore,
    page
  };
}
