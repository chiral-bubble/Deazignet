const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [from, to] of replacements) {
    content = content.split(from).join(to);
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated: ${filePath}`);
}

const mockReplacements = [
  ['Modern Cantilevered Residence, Lagos', 'Modern Cantilevered Residence, Zurich'],
  ['Fintech Headquarters Workspace Architecture, Abuja', 'Fintech Headquarters Workspace Architecture, London'],
  ['Minimalist Oceanfront Villa & Landscape Design, Lekki', 'Minimalist Oceanfront Villa & Landscape Design, Malibu'],
  ['Nordic Diplomatic Dining Lounge Interior, Abuja', 'Nordic Diplomatic Dining Lounge Interior, Geneva'],
  ['Sustainable Timber Masterplan & Eco-Resort, Epe', 'Sustainable Timber Masterplan & Eco-Resort, Aspen'],
  ['Ikoyi, Lagos State', 'Zurich Gold Coast, Switzerland'],
  ['Ikoyi, Lagos', 'Zurich, Switzerland'],
  ['Victoria Island, Lagos', 'City of London, UK'],
  ['Lekki Phase 1, Lagos', 'Malibu Coast, California'],
  ['Old GRA, Port Harcourt', 'San Francisco Bay, California'],
  ['Maitama, Abuja', 'Geneva Diplomatic Quarter, Switzerland'],
  ['Central Business District, Abuja', 'Canary Wharf, London'],
  ['Lekki, Lagos', 'Malibu, California'],
  ['Epe, Lagos', 'Aspen, Colorado'],
  ['Banana Island, Lagos', 'Lake Geneva, Switzerland'],
  ['Ibeju-Lekki, Lagos', 'Bel Air, Los Angeles'],
  ['Lagos Waterfront Planning Zone A', 'Zurich Waterfront Planning Zone A'],
  ['Lagos State Ministry of Physical Planning approvals', 'Swiss Cantonal Building & Structural approvals'],
  ['Lagos State Infrastructure Trust', 'Metropolitan Infrastructure Trust'],
  ['Nigerian Ports Authority compliance submission', 'Maritime Planning Commission compliance submission'],
  ['Chief Kunle Adeleke', 'Marcus Vance'],
  ['Adeleke Holdings', 'Vance Holdings'],
  ['Ngozi Chimamanda', 'Sophia Montgomery'],
  ['Tonye Briggs', 'Alexander Wright'],
  ['Delta Coast Maritime', 'Pacific Maritime Partners'],
  ['Ambassador K. Ibrahim', 'Ambassador David Lindqvist'],
  ['Sahel Diplomatic Mission', 'Nordic Diplomatic Mission'],
  ['Access Bank Nigeria', 'JPMorgan Chase Bank'],
  ['Access Bank', 'JPMorgan Chase'],
  ['Guaranty Trust Bank (GTBank)', 'Citibank Private Bank'],
  ['Direct wire withdrawal to Access Bank (••••4821)', 'Direct wire withdrawal to JPMorgan Chase (••••4821)'],
  ['Access Bank ••••4821', 'JPMorgan Chase ••••4821'],
  ['Wire transfer settled with NIBSS', 'Wire transfer settled via Fedwire'],
  ["currency: 'NGN'", "currency: 'USD'"],
  ['Northern Nigerian brass accents', 'bespoke brushed brass accents'],
  ['Northern Nigerian leathercraft', 'bespoke artisanal leathercraft']
];

replaceInFile(path.join(__dirname, '../src/mocks/dataset.ts'), mockReplacements);
replaceInFile(path.join(__dirname, '../src/services/designerDashboardService.ts'), mockReplacements);
replaceInFile(path.join(__dirname, '../src/services/paymentsService.ts'), mockReplacements);

// Profile Service Replacements
const profileReplacements = [
  ...mockReplacements,
  ["city: 'Lagos', state: 'Lagos State', country: 'Nigeria'", "city: 'Zurich', state: 'Zurich Canton', country: 'Switzerland'"],
  ["city: 'Abuja', state: 'FCT', country: 'Nigeria'", "city: 'Geneva', state: 'Geneva Canton', country: 'Switzerland'"],
  ["city: 'Port Harcourt', state: 'Rivers State', country: 'Nigeria'", "city: 'San Francisco', state: 'California', country: 'United States'"],
  ["city: 'Ibadan', state: 'Oyo State', country: 'Nigeria'", "city: 'London', state: 'Greater London', country: 'United Kingdom'"],
  ["phone: '+234 802 345 6789'", "phone: '+41 44 214 8900'"],
  ["'English', 'French', 'Yoruba'", "'English', 'French', 'German'"],
  ["'English', 'Hausa'", "'English', 'French'"],
  ["'English', 'Yoruba'", "'English', 'German'"],
  ["'English', 'Igbo'", "'English', 'Spanish'"],
  ['boutique architectural practice in Lagos', 'boutique architectural atelier in Zurich'],
  ['Abuja-based architectural interior studio', 'Geneva-based architectural interior studio'],
  ['in coastal Lagos', 'along Lake Zurich'],
  ['across South-West Nigeria', 'across Central Europe and the UK'],
  ['ARCON', 'AIA'],
  ['NIA', 'RIBA'],
  ['COREN', 'PE'],
  ['CORBON', 'NCARB'],
  ['Lagos, Nigeria', 'Zurich, Switzerland'],
  ['Abuja, Nigeria', 'Geneva, Switzerland'],
  ['Port Harcourt, Nigeria', 'San Francisco, USA'],
  ['Ibadan, Nigeria', 'London, UK'],
  ['Amina Bello', 'Claire Laurent'],
  ['Studio Bello Interiors', 'Studio Laurent Interiors'],
  ['Tunde Balogun', 'Julian Thorne'],
  ['Zainab Al-Hassan', 'Elena Rostova'],
  ['Zainab Aliyu', 'Sarah Jenkins'],
  ['Emeka Okafor', 'Christian Meyer'],
  ['Folake Adeleke', 'Charlotte Dubois'],
  ['Damilola Adeleke', 'Alexander Hayes'],
  ['Kunle Adebayo', 'David Sterling'],
  ['Oluwaseun Davies', 'Marcus Vance'],
  ['Ikoyi Cantilevered Waterfront Pavilion', 'Lake Zurich Cantilevered Pavilion'],
  ['Victoria Island Fintech Headquarters', 'City of London Fintech Headquarters'],
  ['Epe Eco-Resort & Botanical Pavilion', 'Aspen Alpine Eco-Resort Pavilion'],
  ['Banana Island Minimalist Villa', 'Lake Geneva Minimalist Villa'],
  ['Maitama Diplomatic Executive Lounge', 'Geneva Diplomatic Executive Lounge'],
  ['CBD, Abuja', 'City of London'],
  ['Asokoro, Abuja', 'Geneva Old Town'],
  ["stateOrRegion: 'Lagos'", "stateOrRegion: 'Zurich'"],
  ["location: 'Eko Atlantic, Lagos'", "location: 'Lugano Waterfront, Switzerland'"],
  ["location: 'Ogudu, Lagos'", "location: 'Bern Old Town, Switzerland'"],
  ["location: 'Maryland, Lagos'", "location: 'Oxfordshire, United Kingdom'"],
  ["location: 'Surulere, Lagos'", "location: 'Edinburgh New Town, UK'"],
  ["// 8 MOCK DESIGNERS (Nigerian Cities, Real Architectural Specializations)", "// 8 MOCK DESIGNERS (International Cities, Real Architectural Specializations)"],
  ["stateInput.value = 'Lagos State'", "stateInput.value = 'Zurich Canton'"],
  ['placeholder="e.g. Lagos State"', 'placeholder="e.g. Zurich Canton"'],
  ['placeholder="e.g. Ikoyi, Lagos"', 'placeholder="e.g. Zurich, Switzerland"'],
  ['<option value="First Bank of Nigeria">First Bank of Nigeria</option>', '<option value="Barclays Bank">Barclays Bank</option>']
];

replaceInFile(path.join(__dirname, '../src/services/designerProfileService.ts'), profileReplacements);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/CredentialsTab.ts'), profileReplacements);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/PortfolioProjectDrawer.ts'), profileReplacements);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/BillingTab.ts'), profileReplacements);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/DevProfileToolbar.ts'), [
  ['Tunde Balogun', 'Julian Thorne'],
  ['Incomplete (Tunde)', 'Incomplete (Julian)'],
  ['Zainab Aliyu', 'Sarah Jenkins'],
  ['New Designer (Zainab)', 'New Designer (Sarah)'],
  ['ARCON', 'AIA']
]);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/BillingTab.ts'), mockReplacements);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/CredentialsTab.ts'), [
  ['Architects Registration Council of Nigeria', 'American Institute of Architects (AIA)'],
  ['Council for the Regulation of Engineering in Nigeria', 'National Council of Examiners for Engineering (NCEES / PE)'],
  ['Nigerian Institute of Architects', 'Royal Institute of British Architects (RIBA)'],
  ['Council of Registered Builders of Nigeria', 'National Council of Architectural Registration Boards (NCARB)'],
  ['Nigerian Institution of Estate Surveyors and Valuers', 'Royal Institution of Chartered Surveyors (RICS)'],
  ["ARCON", "AIA"],
  ["COREN", "PE"],
  ["NIA", "RIBA"],
  ["CORBON", "NCARB"]
]);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/ProfileTab.ts'), [
  ["placeholder=\"e.g. Lagos\"", "placeholder=\"e.g. Zurich\""],
  ["placeholder=\"e.g. Lagos State\"", "placeholder=\"e.g. Zurich Canton\""],
  ["country: 'Nigeria'", "country: 'Switzerland'"]
]);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/PublicProfile.ts'), [
  ['across Nigeria', 'internationally']
]);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/SecurityTab.ts'), [
  ['Lagos, Nigeria', 'Zurich, Switzerland']
]);
