const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/services/designerProfileService.ts');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add fields to DesignerProfile interface
content = content.replace(
  '  notifications: DesignerNotificationSettings;\n}',
  '  notifications: DesignerNotificationSettings;\n  showInDesignerSearch?: boolean;\n  hideRateFromPeers?: boolean;\n}'
);

// 2. Extra 16 international designers to reach 24 total
const extraDesigners = `
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
`;

// Insert extraDesigners before the end of INITIAL_DESIGNERS
content = content.replace(
  '    }\n  }\n];',
  '    }\n  },\n' + extraDesigners + '\n];'
);

// 3. Search and Saved Implementation
const searchServiceCode = `
// ============================================================================
// DESIGNER SEARCH & SAVED TALENT SERVICE
// ============================================================================

export interface DesignerSearchParams {
  query?: string;
  professionalType?: string;
  specializations?: string[];
  location?: string;
  minYears?: number;
  minRating?: number;
  verifiedOnly?: boolean;
  availableOnly?: boolean;
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
 * Debounced typing (300ms) at caller level.
 * Excludes viewing designer's own profile and respects privacy settings.
 */
export async function searchDesigners(params: DesignerSearchParams = {}): Promise<DesignerSearchResult> {
  await delay(120);

  const {
    query = '',
    professionalType = '',
    specializations = [],
    location = '',
    minYears = 0,
    minRating = 0,
    verifiedOnly = false,
    availableOnly = false,
    sort = 'best_match',
    page = 1,
    limit = 8
  } = params;

  const currentUserId = getActiveLoggedUserId();
  const q = query.trim().toLowerCase();

  let results = designersStore.filter((d) => {
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
`;

content += '\n' + searchServiceCode;

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully expanded designerProfileService.ts with 24 international designers and searchDesigners API!');
