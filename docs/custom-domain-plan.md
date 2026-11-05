# Architecture Plan: Custom Domains for Designer Studios

## 1. Overview
This document specifies the technical architecture for enabling designers on the Upgraded tier to point their own custom domain or subdomain (e.g., `studio.acmearchitects.com` or `acmearchitects.com`) to their Dezignet studio profile, replacing or aliasing `/studio/{slug}`.

---

## 2. DNS Configuration
To connect a custom domain, the designer must configure two DNS records in their registrar/DNS provider:

1. **Host Routing (CNAME or ALIAS)**:
   - For subdomains (`studio.acme.com`):
     - **Type**: `CNAME`
     - **Host**: `studio`
     - **Target**: `cname.dezignet.com`
   - For apex/root domains (`acme.com`):
     - **Type**: `ALIAS` / `ANAME` or Cloudflare CNAME flattening
     - **Target**: `cname.dezignet.com`
2. **Domain Ownership Verification (TXT)**:
   - **Type**: `TXT`
   - **Host**: `_dezignet-verify.studio`
   - **Value**: `dezignet-verification-token={verification_hash}` (cryptographically salted hash linked to `designer_id`)

---

## 3. SSL/TLS Certificate Provisioning & Renewal
To terminate HTTPS securely with modern browser trust:

- **Provider**: Cloudflare for Platforms (Custom Hostnames) or AWS Certificate Manager via Amazon CloudFront / Let's Encrypt with ACME HTTP-01 / DNS-01 challenge.
- **Workflow**:
  1. Designer submits domain in Profile Settings.
  2. Dezignet backend registers custom hostname with the CDN/edge API.
  3. Edge provider validates the `TXT` or `CNAME` record.
  4. Edge provider automatically issues an SNI TLS certificate within 5–15 minutes.
  5. Automatic certificate renewals occur 30 days before expiration without designer intervention.

---

## 4. Routing & Edge Mapping
When an incoming HTTP/HTTPS request hits Dezignet's edge CDN:

1. The CDN edge worker / middleware extracts the `Host` header (e.g. `studio.acmearchitects.com`).
2. If `Host` matches `dezignet.com` or a deployment preview, standard Next/Vite routing applies.
3. If `Host` is a foreign custom domain:
   - Edge worker queries a fast low-latency key-value cache (e.g., Cloudflare KV, Redis, or Supabase Edge Config):
     ```json
     "studio.acmearchitects.com" -> { "designer_id": "...", "studio_slug": "acme" }
     ```
   - Worker rewrites the incoming path internally to `/studio/acme` with header `x-dezignet-custom-domain: 1`.
   - The React frontend renders the public studio view directly, suppressing the Dezignet global navigation header if in white-label mode, while keeping required license disclosures.

---

## 5. Domain Removal & Downgrades
- **Designer voluntarily disconnects**:
  - The custom hostname mapping is immediately deleted from the edge.
  - The domain entry in `designer_profiles` is cleared.
  - The designer's `/studio/{slug}` URL continues to function normally.
- **Designer downgrades from Upgraded tier**:
  - The custom domain is deactivated at the end of the current billing cycle.
  - A 30-day grace period is provided where the domain displays a polite "This studio profile has moved to Dezignet" placeholder before edge hostname deregistration.

---

## 6. Abuse, Security & Support Risks
1. **Phishing & Brand Impersonation**: Malicious users pointing domains designed to mimic banks, government agencies, or competing architectural firms. Requires an automated domain reputation scan (Google Safe Browsing API).
2. **Expired / Dropped Domains**: Designers who abandon their domain registration may expose visitors to domain takeover if the CNAME remains configured.
3. **DNS Misconfiguration Support**: 80% of customer support requests regarding custom domains stem from user errors in configuring DNS records (TTL latency, conflicting A records, Cloudflare proxy conflicts). Requires in-app step-by-step DNS diagnostics.

---

## 7. Effort & Cost Estimate
| Component | Scope | Estimated Effort |
| :--- | :--- | :--- |
| **Edge Provider Setup** | Cloudflare for SaaS / Custom Hostnames setup, SSL automation | 3–4 days |
| **Database & API** | `designer_custom_domains` table, verification status polling, webhook endpoints | 2–3 days |
| **Settings UI** | Domain entry, DNS instructions, copy-to-clipboard, status badge, DNS checker | 2–3 days |
| **Edge Middleware** | Host header parsing, KV cache lookup, fallback routing | 2 days |
| **Testing & Edge Cases** | Apex domain quirks, SSL failure recovery, downgrade triggers | 3 days |
| **Total** | Full end-to-end production implementation | **~2.5 weeks** |

