import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,
  baseUrl: process.env.BASE_URL || "http://localhost:3000",
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    priceId: process.env.STRIPE_PRICE_ID || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  },
  quotas: {
    free: Number(process.env.FREE_MONTHLY_QUOTA) || 200,
    pro: Number(process.env.PRO_MONTHLY_QUOTA) || 50000,
  },
};

export const stripeEnabled = Boolean(
  config.stripe.secretKey && config.stripe.priceId,
);
