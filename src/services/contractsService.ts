/**
 * Contracts Service for Dezignet
 * Bilateral contract execution, signature submission, verification and PDF download
 */

import { supabase, USE_MOCKS } from '../lib/supabase';
import type { ContractStatus, SignatureStyleType } from '../types/database.types';

export interface ContractSignature {
  id: string;
  signer_id: string;
  signer_role: 'client' | 'designer';
  typed_name: string;
  signature_style: SignatureStyleType;
  signed_at: string;
  content_hash_at_signing: string;
}

export interface ContractDetail {
  id: string;
  engagement_id: string;
  number: string;
  status: ContractStatus;
  content: any;
  content_hash: string;
  created_at: string;
  expires_at: string;
  activated_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  signatures: ContractSignature[];
  client_id: string;
  designer_id: string;
}

/**
 * Retrieves the full immutable contract details for an engagement
 */
export async function getContract(engagementId: string): Promise<ContractDetail | null> {
  if (USE_MOCKS.active_work) {
    return getMockContract(engagementId);
  }

  const { data, error } = await (supabase.rpc as any)('get_contract', {
    p_engagement_id: engagementId
  });

  if (error) {
    console.error('Failed to load contract:', error);
    throw new Error(error.message || 'Could not load contract.');
  }

  return data as ContractDetail | null;
}

/**
 * Signs the contract (either as client or designer)
 */
export async function signContract(
  contractId: string,
  typedName: string,
  signatureStyle: SignatureStyleType = 'typed',
  signatureFileId?: string,
  agreed: boolean = true
): Promise<{ status: string; signatures_count: number; activated_at?: string }> {
  if (USE_MOCKS.active_work) {
    return { status: 'active', signatures_count: 2, activated_at: new Date().toISOString() };
  }

  const { data, error } = await (supabase.rpc as any)('sign_contract', {
    p_contract_id: contractId,
    p_typed_name: typedName,
    p_signature_style: signatureStyle,
    p_signature_file_id: signatureFileId || null,
    p_agreed: agreed,
    p_ip_address: null,
    p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser Client'
  });

  if (error) {
    console.error('Failed to sign contract:', error);
    throw new Error(error.message || 'Contract signing failed.');
  }

  return data;
}

/**
 * Cancels an unsigned or partially signed contract before activation
 */
export async function cancelContract(contractId: string, reason: string): Promise<{ success: boolean }> {
  if (USE_MOCKS.active_work) {
    return { success: true };
  }

  const { data, error } = await (supabase.rpc as any)('cancel_contract', {
    p_contract_id: contractId,
    p_reason: reason
  });

  if (error) {
    throw new Error(error.message || 'Could not cancel contract.');
  }

  return data || { success: true };
}

/**
 * Verifies document hash integrity against cryptographic signatures
 */
export async function verifyContract(
  contractId: string
): Promise<{ verified: boolean; stored_hash: string; computed_hash: string; signatures_intact: boolean }> {
  if (USE_MOCKS.active_work) {
    return { verified: true, stored_hash: 'mock-sha256-hash', computed_hash: 'mock-sha256-hash', signatures_intact: true };
  }

  const { data, error } = await (supabase.rpc as any)('verify_contract', {
    p_contract_id: contractId
  });

  if (error) {
    throw new Error(error.message || 'Verification check failed.');
  }

  return data;
}

/**
 * Generates or downloads the official signed contract PDF URL
 */
export async function getContractPdfUrl(contractId: string): Promise<string> {
  // If mocks enabled, return mock URL
  if (USE_MOCKS.active_work) {
    return `/mock-downloads/contract-${contractId}.pdf`;
  }

  const { data, error } = await (supabase.storage.from('contracts') as any).createSignedUrl(
    `signed_${contractId}.pdf`,
    3600
  );

  if (error || !data?.signedUrl) {
    // Fallback data-uri for preview
    return '#';
  }

  return data.signedUrl;
}

function getMockContract(engagementId: string): ContractDetail {
  return {
    id: 'mock-ctr-1',
    engagement_id: engagementId,
    number: 'DZ-2026-1042',
    status: 'awaiting_signatures',
    content: {
      section_1_header: {
        contract_number: 'DZ-2026-1042',
        date: '2026-10-29',
        project_title: 'Modern Detached Bungalow',
        category: 'Residential',
        subcategory: 'Detached house / bungalow',
        client: { name: 'Dr. Eleanor Vance', location: 'Austin, TX' },
        designer: { name: 'Marcus Vance, AIA', studio_name: 'Vance Architecture Studio', professional_type: 'architect', location: 'Austin, TX' }
      },
      section_2_scope: {
        project_description: 'Full architectural concept and structural coordination package for a luxury detached bungalow.',
        cover_letter: 'I have extensive experience delivering luxury residential bungalow drawings in this region...'
      },
      section_3_assumptions_exclusions: {
        assumptions: ['Client provides topographic survey', 'Zoning setback clearance confirmed'],
        exclusions: 'Statutory physical blueprint printing and courier costs'
      },
      section_4_compensation: {
        total_price: 18500,
        currency: 'USD',
        payment_type: 'milestone',
        milestones: [
          { phase_number: 1, name: 'Schematic Design', amount: 3700, fee_percent: 20 },
          { phase_number: 2, name: 'Design Development', amount: 4625, fee_percent: 25 },
          { phase_number: 3, name: 'Construction Documents', amount: 6475, fee_percent: 35 },
          { phase_number: 4, name: 'Bidding & Permitting', amount: 925, fee_percent: 5 },
          { phase_number: 5, name: 'Construction Administration', amount: 2775, fee_percent: 15 }
        ]
      },
      section_5_reimbursable_additional: {
        reimbursable_expenses_type: 'capped',
        reimbursable_cap: 500,
        additional_services_rate: 120
      },
      section_6_revisions: {
        included_revisions_per_phase: 2,
        policy: 'Revisions beyond the included count shall be billed as Additional Services.'
      },
      section_7_timeline: {
        delivery_days: 45,
        policy: 'Milestone due dates are computed upon activation and funding of each phase.'
      },
      section_8_payment_terms: {
        escrow_funding: 'Milestones must be funded in escrow before design commencement.',
        review_period_days: 14,
        security_hold_days: 5,
        platform_fee_percent: 10
      },
      section_9_standard_terms: {
        terms_version: '2026.1',
        body_markdown: '### Standard Terms of Professional Architectural & Design Services\n\n1. **Ownership of Work Product & License on Payment**: Upon receipt of full payment for each milestone, the Designer grants the Client an exclusive, perpetual, irrevocable license to use the Deliverables for the construction, maintenance, and marketing of the specified project.\n\n2. **Confidentiality & Non-Disclosure**: Both parties agree to maintain the confidentiality of proprietary site information.\n\n3. **Termination & Suspension**: Either party may terminate services with 14 calendar days written notice.'
      },
      section_10_signatures: {
        status: 'awaiting_signatures'
      }
    },
    content_hash: '9a8f21b7c84439c362145e43bc0912f2cba0431289cf78912891bbec81648a12',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    expires_at: new Date(Date.now() + 3600000 * 24 * 6).toISOString(),
    activated_at: null,
    cancelled_at: null,
    cancel_reason: null,
    signatures: [],
    client_id: 'mock-client-1',
    designer_id: 'mock-des-1'
  };
}

