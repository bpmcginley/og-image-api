import Stripe from "stripe";
import { config, stripeEnabled } from "./config.js";
import {
  getAccountByKey,
  getAccountByCustomerId,
  setStripeCustomer,
  setPlan,
} from "./db.js";

const stripe = stripeEnabled ? new Stripe(config.stripe.secretKey) : null;

// Create a Checkout Session for the account identified by apiKey.
export async function createCheckout(apiKey) {
  if (!stripe) throw new Error("Stripe is not configured.");
  const account = getAccountByKey(apiKey);
  if (!account) throw new Error("Unknown API key.");

  let customerId = account.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: account.email,
      metadata: { account_id: account.id },
    });
    customerId = customer.id;
    setStripeCustomer(account.id, customerId);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: config.stripe.priceId, quantity: 1 }],
    success_url: `${config.baseUrl}/#dashboard?upgraded=1`,
    cancel_url: `${config.baseUrl}/#pricing`,
    metadata: { account_id: account.id },
  });
  return session.url;
}

// Create a Billing Portal session so customers can manage/cancel.
export async function createPortal(apiKey) {
  if (!stripe) throw new Error("Stripe is not configured.");
  const account = getAccountByKey(apiKey);
  if (!account?.stripe_customer_id) throw new Error("No subscription found.");
  const session = await stripe.billingPortal.sessions.create({
    customer: account.stripe_customer_id,
    return_url: `${config.baseUrl}/#dashboard`,
  });
  return session.url;
}

// Verify and handle a Stripe webhook. `rawBody` must be the raw Buffer.
export function handleWebhook(rawBody, signature) {
  if (!stripe) throw new Error("Stripe is not configured.");
  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    config.stripe.webhookSecret,
  );

  switch (event.type) {
    case "checkout.session.completed":
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const obj = event.data.object;
      const customerId = obj.customer;
      const account = getAccountByCustomerId(customerId);
      if (account) {
        const status = obj.status || obj.subscription_status;
        const active =
          event.type === "checkout.session.completed" ||
          status === "active" ||
          status === "trialing";
        setPlan(
          account.id,
          active ? "pro" : "free",
          obj.subscription || obj.id || null,
        );
      }
      break;
    }
    case "customer.subscription.deleted": {
      const account = getAccountByCustomerId(event.data.object.customer);
      if (account) setPlan(account.id, "free", null);
      break;
    }
  }
  return event.type;
}

export { stripeEnabled };
