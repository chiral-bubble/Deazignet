/**
 * US Market Service & Localization Utilities
 * 50 States + DC, ZIP Code Validation, US Phone Validation, Formatting & Conversion
 */

export interface UsState {
  code: string;
  name: string;
}

export const US_STATES: UsState[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' }
];

export const CREDENTIAL_TYPES = [
  { value: 'license', label: 'License' },
  { value: 'certification', label: 'Certification' },
  { value: 'registration', label: 'Registration' },
  { value: 'other', label: 'Other' }
] as const;

export type CredentialType = typeof CREDENTIAL_TYPES[number]['value'];

export const US_LICENSE_TYPES = [
  { value: 'architect', label: 'Architect' },
  { value: 'professional_engineer', label: 'Professional Engineer' },
  { value: 'landscape_architect', label: 'Landscape Architect' },
  { value: 'interior_designer', label: 'Interior Designer' },
  { value: 'other', label: 'Other' }
] as const;

export type UsLicenseType = typeof US_LICENSE_TYPES[number]['value'];

/**
 * Validates US ZIP code (5 digits or ZIP+4)
 */
export function validateZipCode(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip.trim());
}

/**
 * Validates 2-letter US State code
 */
export function validateUsState(stateCode: string): boolean {
  return US_STATES.some(s => s.code === stateCode.toUpperCase());
}

/**
 * Validates US Phone format (+1 standard)
 */
export function validateUsPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}

/**
 * Formats phone number to US national format (XXX) XXX-XXXX
 */
export function formatUsPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const clean = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (clean.length !== 10) return phone;
  return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
}

/**
 * Formats money as USD tabular currency ($12,500.00)
 * Uses explicit formatting to guarantee exactly one dollar sign across all browser locales.
 */
export function formatUSD(amount: number | string): string {
  let num: number;
  if (typeof amount === 'string') {
    const isNeg = amount.includes('-');
    const cleanStr = amount.replace(/[^0-9.]/g, '');
    num = parseFloat(cleanStr);
    if (isNaN(num)) return '$0.00';
    if (isNeg) num = -num;
  } else {
    num = amount;
  }
  if (isNaN(num)) return '$0.00';
  const isNegative = num < 0;
  const absFormatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.abs(num));
  return `${isNegative ? '-' : ''}$${absFormatted}`;
}

/**
 * Formats date as MM/DD/YYYY
 */
export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '';
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Formats timestamp with user's time zone label (e.g. 11/04/2026, 3:30 AM EST)
 */
export function formatDateTimeWithZone(dateStr: string | Date | null | undefined, timeZone?: string): string {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '';
  
  const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: tz
  }).format(d);
}

/**
 * Masks license number to last 3 characters
 */
export function maskLicenseNumber(licenseNumber: string): string {
  if (!licenseNumber) return '';
  const trimmed = licenseNumber.trim();
  if (trimmed.length <= 3) return trimmed;
  return '•'.repeat(Math.max(3, trimmed.length - 3)) + trimmed.slice(-3);
}

/**
 * Formats "Licensed in CO, TX" string from issuing states list
 */
export function formatLicensedStatesLabel(states: string[] | null | undefined): string {
  if (!states || states.length === 0) return '';
  const unique = Array.from(new Set(states)).sort();
  return `Licensed in ${unique.join(', ')}`;
}

/**
 * Square Feet to Square Meters conversion
 */
export function sqftToSqm(sqft: number): number {
  return Math.round(sqft * 0.092903);
}

/**
 * Square Meters to Square Feet conversion
 */
export function sqmToSqft(sqm: number): number {
  return Math.round(sqm * 10.7639);
}

/**
 * Detects browser time zone
 */
export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  } catch {
    return 'America/New_York';
  }
}

