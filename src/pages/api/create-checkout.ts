// src/pages/api/create-checkout.ts
import type { APIRoute } from "astro";
import Stripe from "stripe";

// ─────────────────────────────────────────────────────────────────────────────
// ENV you must set:
// - STRIPE_SECRET_KEY
// - SITE_URL (e.g. https://pingtresssh.com) no trailing slash
// - JOB_SIGNING_SECRET (for secure tokens)
// Optionally:
// - CURRENCY (defaults to "usd")
// ─────────────────────────────────────────────────────────────────────────────

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export const post: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    // Expected body (example):
    // {
    //   "email": "buyer@company.com",
    //   "company": "Acme Corp",
    //   "plan": "standard", // "standard" | "featured"
    //   "addons": ["highlight", "pin", "social"]
    // }

    const {
      email,
      company,
      plan = "standard",
      addons = [],
    }: {
      email: string;
      company?: string;
      plan?: "standard" | "featured";
      addons?: Array<"highlight" | "pin" | "social">;
    } = body || {};

    if (!email) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing buyer email" }),
        { status: 400 }
      );
    }

    const SITE_URL = import.meta.env.SITE_URL!;
    const currency = (import.meta.env.CURRENCY || "usd") as Stripe.Checkout.SessionCreateParams.PaymentMethodOptions.AcssDebit.Currency;

    // Base product prices (you’ll map to actual Stripe Price IDs in production)
    // For simplicity, we use inline prices; replace with price IDs if you prefer.
    const priceMap = {
      standard: 9900, // $99.00 one-time
      featured: 19900, // $199.00 one-time (includes featured placement)
      highlight: 1500, // $15 highlight (colored card/badge)
      pin: 2500,       // $25 pin to top for 7 days
      social: 3900,    // $39 social boost (tweet/newsletter mention)
    };

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: plan === "featured" ? priceMap.featured : priceMap.standard,
          product_data: {
            name:
              plan === "featured"
                ? "Job Post — Featured (30 days)"
                : "Job Post — Standard (30 days)",
            description:
              plan === "featured"
                ? "Includes marquee placement in the Featured Jobs strip + 30 days live"
                : "Standard listing live for 30 days",
          },
        },
      },
    ];

    // Addons
    const addonNames: Record<string, string> = {
      highlight: "Highlight Add‑on",
      pin: "Pinned Add‑on (7 days)",
      social: "Social Boost",
    };

    addons.forEach((a) => {
      const amt = priceMap[a as keyof typeof priceMap];
      if (!amt) return;
      line_items.push({
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amt,
          product_data: {
            name: addonNames[a] || a,
          },
        },
      });
    });

    // We’ll echo plan/addons/email as metadata so the webhook can mint the post link.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items,
      success_url: `${SITE_URL}/post-job?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/job-pricing?canceled=1`,
      metadata: {
        plan,
        addons: JSON.stringify(addons || []),
        buyer_email: email,
        company: company || "",
      },
    });

    return new Response(JSON.stringify({ ok: true, url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
