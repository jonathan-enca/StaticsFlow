// Stripe client — subscriptions only at launch (SPECS.md §7)
// Plans: Starter (29€), Pro (79€), Agency (199€) — monthly subscriptions
// BYOK model: users pay for platform access, bring own AI API keys

import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
  typescript: true,
});

// Price IDs — replace with actual IDs from Stripe Dashboard after creating products
export const STRIPE_PRICES = {
  STARTER: process.env.STRIPE_PRICE_STARTER ?? "price_starter_placeholder",
  PRO: process.env.STRIPE_PRICE_PRO ?? "price_pro_placeholder",
  AGENCY: process.env.STRIPE_PRICE_AGENCY ?? "price_agency_placeholder",
} as const;

export type StripePlan = keyof typeof STRIPE_PRICES;

/** Map Stripe subscription status to our Plan enum */
export function getPlanFromStripe(planName: string): "STARTER" | "PRO" | "AGENCY" {
  const normalized = planName.toUpperCase();
  if (normalized.includes("AGENCY")) return "AGENCY";
  if (normalized.includes("PRO")) return "PRO";
  return "STARTER";
}
