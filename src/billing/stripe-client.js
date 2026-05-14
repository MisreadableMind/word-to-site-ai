import Stripe from 'stripe';
import { config } from '../config.js';

let stripeInstance = null;

export function getStripe() {
  if (!config.stripe.enabled) {
    throw new Error('Stripe billing is disabled (set ENABLE_BILLING=true)');
  }
  if (!config.stripe.secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(config.stripe.secretKey, {
      apiVersion: '2025-09-30.clover',
      typescript: false,
    });
  }
  return stripeInstance;
}

export function isStripeReady() {
  return Boolean(config.stripe.enabled && config.stripe.secretKey);
}

export function verifyWebhookSignature(rawBody, signature) {
  if (!config.stripe.webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  return getStripe().webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
}
