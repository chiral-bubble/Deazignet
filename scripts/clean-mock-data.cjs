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
  ['Modern Cantilevered Residence, Austin', 'Modern Cantilevered Residence, Austin TX'],
  ['Fintech Headquarters Workspace Architecture, Denver', 'Fintech Headquarters Workspace Architecture, Denver CO'],
  ['Minimalist Oceanfront Villa & Landscape Design, Malibu', 'Minimalist Oceanfront Villa & Landscape Design, Malibu CA'],
  ['Nordic Diplomatic Dining Lounge Interior, Washington DC', 'Nordic Diplomatic Dining Lounge Interior, Washington DC'],
  ['Sustainable Timber Masterplan & Eco-Resort, Aspen', 'Sustainable Timber Masterplan & Eco-Resort, Aspen CO'],
  ['Downtown, Austin TX', 'Austin Metro, Texas'],
  ['Downtown, Austin', 'Austin, Texas'],
  ['LoDo, Denver', 'Denver, Colorado'],
  ['Malibu Coast, California', 'Malibu Coast, California'],
  ['Old Town, Chicago', 'Chicago, Illinois'],
  ['Cherry Creek, Denver', 'Denver, Colorado'],
  ['Central Business District, Chicago', 'Chicago Loop, Illinois'],
  ['West Lake, Austin', 'Austin, Texas'],
  ['Aspen, Colorado', 'Aspen, Colorado'],
  ['Lake Travis, Austin', 'Lake Travis, Austin TX'],
  ['Bel Air, Los Angeles', 'Bel Air, Los Angeles CA'],
  ['Austin Waterfront Planning Zone A', 'Austin Waterfront Planning Zone A'],
  ['Texas Structural & Building Safety approvals', 'Texas Structural & Building Safety approvals'],
  ['Austin Infrastructure Trust', 'Metropolitan Infrastructure Trust'],
  ['US Army Corps compliance submission', 'Maritime Planning Commission compliance submission'],
  ['Marcus Vance', 'Marcus Vance'],
  ['Vance Holdings', 'Vance Holdings'],
  ['Sophia Montgomery', 'Sophia Montgomery'],
  ['Alexander Wright', 'Alexander Wright'],
  ['Pacific Maritime Partners', 'Pacific Maritime Partners'],
  ['Ambassador David Lindqvist', 'Ambassador David Lindqvist'],
  ['Nordic Diplomatic Mission', 'Nordic Diplomatic Mission'],
  ['Chase Bank USA', 'JPMorgan Chase Bank'],
  ['Chase Bank', 'JPMorgan Chase'],
  ['Citibank Private Bank', 'Citibank Private Bank'],
  ['Direct wire withdrawal to JPMorgan Chase (••••4821)', 'Direct wire withdrawal to JPMorgan Chase (••••4821)'],
  ['JPMorgan Chase ••••4821', 'JPMorgan Chase ••••4821'],
  ['Wire transfer settled via Fedwire', 'Wire transfer settled via Fedwire'],
  ["currency: 'USD'", "currency: 'USD'"],
  ['bespoke brushed brass accents', 'bespoke brushed brass accents'],
  ['bespoke artisanal leathercraft', 'bespoke artisanal leathercraft']
];

replaceInFile(path.join(__dirname, '../src/mocks/dataset.ts'), mockReplacements);
replaceInFile(path.join(__dirname, '../src/services/designerDashboardService.ts'), mockReplacements);
replaceInFile(path.join(__dirname, '../src/services/paymentsService.ts'), mockReplacements);

// Profile Service Replacements
const profileReplacements = [
  ...mockReplacements,
  ["city: 'Austin', state: 'Texas', country: 'United States'", "city: 'Austin', state: 'Texas', country: 'United States'"],
  ["city: 'Denver', state: 'Colorado', country: 'United States'", "city: 'Denver', state: 'Colorado', country: 'United States'"],
  ["city: 'San Francisco', state: 'California', country: 'United States'", "city: 'San Francisco', state: 'California', country: 'United States'"],
  ["city: 'Chicago', state: 'Illinois', country: 'United States'", "city: 'Chicago', state: 'Illinois', country: 'United States'"],
  ["phone: '+1 512 555 0199'", "phone: '+1 512 555 0199'"],
  ["'English', 'Spanish'", "'English', 'Spanish'"],
  ["'English', 'French'", "'English', 'French'"],
  ["'English', 'German'", "'English', 'German'"],
  ["'English', 'Mandarin'", "'English', 'Mandarin'"],
  ['boutique architectural practice in Austin', 'boutique architectural atelier in Austin'],
  ['Denver-based architectural interior studio', 'Denver-based architectural interior studio'],
  ['in coastal California', 'along Pacific Coast'],
  ['across Texas and Colorado', 'across the United States'],
  ['AIA', 'AIA'],
  ['RIBA', 'RIBA'],
  ['PE', 'PE'],
  ['NCARB', 'NCARB'],
  ['Austin, Texas', 'Austin, TX'],
  ['Denver, Colorado', 'Denver, CO'],
  ['San Francisco, California', 'San Francisco, CA'],
  ['Chicago, Illinois', 'Chicago, IL'],
  ['Claire Laurent', 'Claire Laurent'],
  ['Studio Laurent Interiors', 'Studio Laurent Interiors'],
  ['Julian Thorne', 'Julian Thorne'],
  ['Elena Rostova', 'Elena Rostova'],
  ['Sarah Jenkins', 'Sarah Jenkins'],
  ['Christian Meyer', 'Christian Meyer'],
  ['Charlotte Dubois', 'Charlotte Dubois'],
  ['Alexander Hayes', 'Alexander Hayes'],
  ['David Sterling', 'David Sterling'],
  ['Marcus Vance', 'Marcus Vance'],
  ['Austin Cantilevered Lakefront Pavilion', 'Austin Cantilevered Lakefront Pavilion'],
  ['Denver Financial District Headquarters', 'Denver Financial District Headquarters'],
  ['Aspen Eco-Resort & Botanical Pavilion', 'Aspen Alpine Eco-Resort Pavilion'],
  ['Lake Travis Minimalist Villa', 'Lake Travis Minimalist Villa'],
  ['Washington DC Diplomatic Executive Lounge', 'Washington DC Diplomatic Executive Lounge'],
  ['CBD, Chicago', 'Chicago Loop'],
  ['Cherry Creek, Denver', 'Denver Cherry Creek'],
  ["stateOrRegion: 'Texas'", "stateOrRegion: 'Texas'"],
  ["location: 'Downtown, Austin'", "location: 'Downtown, Austin TX'"],
  ["location: 'Boulder, Colorado'", "location: 'Boulder, CO'"],
  ["location: 'Naperville, Illinois'", "location: 'Naperville, IL'"],
  ["location: 'Pasadena, California'", "location: 'Pasadena, CA'"],
  ["// 8 MOCK DESIGNERS (US Cities, Real Architectural Specializations)", "// 8 MOCK DESIGNERS (US Cities, Real Architectural Specializations)"],
  ["stateInput.value = 'Texas'", "stateInput.value = 'Texas'"],
  ['placeholder="e.g. Texas"', 'placeholder="e.g. Texas"'],
  ['placeholder="e.g. Austin, TX"', 'placeholder="e.g. Austin, TX"'],
  ['<option value="JPMorgan Chase Bank">JPMorgan Chase Bank</option>', '<option value="Bank of America">Bank of America</option>']
];

replaceInFile(path.join(__dirname, '../src/services/designerProfileService.ts'), profileReplacements);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/CredentialsTab.ts'), profileReplacements);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/PortfolioProjectDrawer.ts'), profileReplacements);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/BillingTab.ts'), profileReplacements);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/DevProfileToolbar.ts'), [
  ['Julian Thorne', 'Julian Thorne'],
  ['Incomplete (Julian)', 'Incomplete (Julian)'],
  ['Sarah Jenkins', 'Sarah Jenkins'],
  ['New Designer (Sarah)', 'New Designer (Sarah)'],
  ['AIA', 'AIA']
]);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/BillingTab.ts'), mockReplacements);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/CredentialsTab.ts'), [
  ['American Institute of Architects (AIA)', 'American Institute of Architects (AIA)'],
  ['National Council of Examiners for Engineering (NCEES / PE)', 'National Council of Examiners for Engineering (NCEES / PE)'],
  ['Royal Institute of British Architects (RIBA)', 'Royal Institute of British Architects (RIBA)'],
  ['National Council of Architectural Registration Boards (NCARB)', 'National Council of Architectural Registration Boards (NCARB)'],
  ['American Society of Interior Designers (ASID)', 'American Society of Interior Designers (ASID)'],
  ["AIA", "AIA"],
  ["PE", "PE"],
  ["RIBA", "RIBA"],
  ["NCARB", "NCARB"]
]);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/ProfileTab.ts'), [
  ["placeholder=\"e.g. Austin\"", "placeholder=\"e.g. Austin\""],
  ["placeholder=\"e.g. Texas\"", "placeholder=\"e.g. Texas\""],
  ["country: 'United States'", "country: 'United States'"]
]);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/PublicProfile.ts'), [
  ['across the United States', 'nationwide']
]);
replaceInFile(path.join(__dirname, '../src/components/designer/profile/SecurityTab.ts'), [
  ['Austin, Texas', 'Austin, TX']
]);
