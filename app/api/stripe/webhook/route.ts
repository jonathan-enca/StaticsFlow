// POST /api/stripe/webhook
// Handles Stripe subscription events to update user plan in DB
// Configure in Stripe Dashboard: https://dashboard.stripe.com/webhooks

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe, getPlanFromStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;
      if (userId && plan) {
        await prisma.user.update({
          where: { id: userId },
          data: { plan: getPlanFromStripe(plan) },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object;
      const customer = await stripe.customers.retrieve(sub.customer as string);
      if (customer.deleted) break;
      const userId = (customer as { metadata: Record<string, string> }).metadata?.userId;
      if (!userId) break;

      const priceId = sub.items.data[0]?.price?.id ?? "";
      // Determine plan from price ID (fallback to STARTER)
      const plan = Object.entries(
        await import("@/lib/stripe").then((m) => m.STRIPE_PRICES)
      ).find(([, id]) => id === priceId)?.[0] ?? "STARTER";

      await prisma.user.update({
        where: { id: userId },
        data: { plan: getPlanFromStripe(plan) },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const customer = await stripe.customers.retrieve(sub.customer as string);
      if (customer.deleted) break;
      const userId = (customer as { metadata: Record<string, string> }).metadata?.userId;
      if (!userId) break;
      // Downgrade to STARTER on cancellation
      await prisma.user.update({
        where: { id: userId },
        data: { plan: "STARTER" },
      });
      break;
    }

    default:
      // Unhandled event types — ignore
      break;
  }

  return NextResponse.json({ received: true });
}
