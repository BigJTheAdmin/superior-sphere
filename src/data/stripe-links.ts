// src/data/stripe-links.ts
// Central place to store Stripe Payment Link URLs for TEST and LIVE.
// How to use:
// 1) Paste your TEST links under TEST_LINKS and LIVE links under LIVE_LINKS.
// 2) Set build-time mode with PUBLIC_STRIPE_MODE=test|live (defaults to test).
// 3) import { getStripeLink } and use getStripeLink('career_coaching') in your pages.

export type StripeSKU =
  | "firewall_audit"
  | "incident_retainer"
  | "design_review"
  | "compliance_assessment"
  | "managed_network_services"
  | "career_coaching"
  | "project_deposit"
  | "resume_review"
  | "resume_linkedin"
  | "career_branding"
  | "job_single"
  | "job_featured_addon"
  | "job_starter_plan"
  | "job_pro_plan"
  | "job_enterprise_plan"
  | "donation";

type LinkMap = Record<StripeSKU, string>;

// ======= PASTE YOUR TEST LINKS HERE (from the CLI script output) =======
// Keep the placeholders until you paste real URLs.
export const TEST_LINKS: LinkMap = {
  firewall_audit:         "PASTE_TEST_firewall_audit",
  incident_retainer:      "PASTE_TEST_incident_retainer",
  design_review:          "PASTE_TEST_design_review",
  compliance_assessment:  "PASTE_TEST_compliance_assessment",
  managed_network_services:"PASTE_TEST_managed_network_services",
  career_coaching:        "PASTE_TEST_career_coaching",
  project_deposit:        "PASTE_TEST_project_deposit",
  resume_review:          "PASTE_TEST_resume_review",
  resume_linkedin:        "PASTE_TEST_resume_linkedin",
  career_branding:        "PASTE_TEST_career_branding",
  job_single:             "PASTE_TEST_job_single",
  job_featured_addon:     "PASTE_TEST_job_featured_addon",
  job_starter_plan:       "PASTE_TEST_job_starter_plan",
  job_pro_plan:           "PASTE_TEST_job_pro_plan",
  job_enterprise_plan:    "PASTE_TEST_job_enterprise_plan",
  donation:               "PASTE_TEST_donation",
};

// ======= PASTE YOUR LIVE LINKS HERE (when you re-run the script in live) =======
export const LIVE_LINKS: LinkMap = {
  firewall_audit:         "https://buy.stripe.com/5kQ3cw1EEeuX60O6Vb9k40e",
  incident_retainer:      "https://buy.stripe.com/aFa5kEbfebiLdtgenD9k40d",
  design_review:          "https://buy.stripe.com/28EdRacjiaeHexk1AR9k40c",
  compliance_assessment:  "https://buy.stripe.com/aFaaEYfvu2Mf88WenD9k40b",
  managed_network_services:"https://buy.stripe.com/00w6oI3MMgD5ah46Vb9k40a",
  career_coaching:        "https://buy.stripe.com/cNi8wQ832aeHfBo93j9k409",
  project_deposit:        "https://buy.stripe.com/28E7sM976dqT4WKgvL9k408",
  resume_review:          "https://buy.stripe.com/6oU3cwcjifz10GuenD9k407",
  resume_linkedin:        "https://buy.stripe.com/7sY00kfvu86zgFs3IZ9k406",
  career_branding:        "https://buy.stripe.com/7sY6oIcjifz1ah47Zf9k405",
  job_single:             "https://buy.stripe.com/3cI14oaba5YrfBoa7n9k404",
  job_featured_addon:     "https://buy.stripe.com/5kQeVe2IIaeHexk93j9k403",
  job_starter_plan:       "https://buy.stripe.com/eVq4gA4QQcmPdtg0wN9k402",
  job_pro_plan:           "https://buy.stripe.com/00w3cwgzy0E7ah43IZ9k401",
  job_enterprise_plan:    "https://buy.stripe.com/fZu00kfvufz1ah47Zf9k400",
  donation:               "https://buy.stripe.com/fZu8wQ3MMaeH60O5R79k40f",
};

const MODE = (import.meta.env.PUBLIC_STRIPE_MODE ?? "test").toLowerCase();
const MAP = MODE === "live" ? LIVE_LINKS : TEST_LINKS;

export function getStripeLink(sku: StripeSKU): string {
  const url = MAP[sku];
  if (!url || url.startsWith("PASTE_")) {
    if (typeof window !== "undefined") {
      console.warn(`Stripe link missing for ${sku} in ${MODE} mode`);
    }
    return "#";
  }
  return url;
}

export const ALL_SKUS: StripeSKU[] = [
  "firewall_audit",
  "incident_retainer",
  "design_review",
  "compliance_assessment",
  "managed_network_services",
  "career_coaching",
  "project_deposit",
  "resume_review",
  "resume_linkedin",
  "career_branding",
  "job_single",
  "job_featured_addon",
  "job_starter_plan",
  "job_pro_plan",
  "job_enterprise_plan",
  "donation",
];
