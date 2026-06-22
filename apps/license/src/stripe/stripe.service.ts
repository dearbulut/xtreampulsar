import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const PRICE_MAP: Record<string, string | undefined> = {
  STARTER: process.env.STRIPE_PRICE_STARTER,
  PRO: process.env.STRIPE_PRICE_PRO,
  BUSINESS: process.env.STRIPE_PRICE_BUSINESS,
  WHITE_LABEL: process.env.STRIPE_PRICE_WHITE_LABEL,
};

const PLAN_INFO = [
  { tier: 'STARTER', name: 'Starter', price: 39, description: 'Küçük ölçekli operatörler' },
  { tier: 'PRO', name: 'Pro', price: 79, description: 'Büyüyen operatörler' },
  { tier: 'BUSINESS', name: 'Business', price: 149, description: 'Büyük ölçekli operasyonlar' },
  { tier: 'WHITE_LABEL', name: 'White-label', price: 299, description: 'Tam özelleştirme' },
];

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
      apiVersion: '2026-05-27.dahlia',
    });
  }

  async createCheckoutSession(
    tier: string,
    email: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    const priceId = PRICE_MAP[tier];
    if (!priceId) throw new Error(`Unknown tier: ${tier}`);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { tier, email },
      subscription_data: { metadata: { tier, email } },
    });

    return { sessionId: session.id, url: session.url };
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET not configured');
      return;
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${(err as Error).message}`);
      throw err;
    }

    this.logger.log(`Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.createLicenseFromCheckout(session);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await this.cancelLicenseByCustomer(sub.customer as string);
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        await this.gracePeriodLicenseByCustomer(inv.customer as string);
        break;
      }
      case 'invoice.payment_succeeded': {
        const inv = event.data.object as Stripe.Invoice;
        await this.extendLicenseByCustomer(inv.customer as string);
        break;
      }
    }
  }

  async createCustomerPortal(customerId: string, returnUrl: string) {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  getPlans() {
    return PLAN_INFO.map((p) => ({
      ...p,
      priceId: PRICE_MAP[p.tier] ?? null,
      currency: 'EUR',
    }));
  }

  generateLicenseKey(): string {
    const raw = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `XP-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
  }

  async createLicenseFromCheckout(session: Stripe.Checkout.Session): Promise<void> {
    const email = session.metadata?.email ?? session.customer_email ?? '';
    const tier = (session.metadata?.tier ?? 'STARTER') as 'STARTER' | 'PRO' | 'BUSINESS' | 'WHITE_LABEL';
    const customerId = session.customer as string;

    const key = this.generateLicenseKey();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await this.prisma.license.create({
      data: {
        key,
        tier,
        status: 'ACTIVE',
        expiresAt,
      },
    });

    this.logger.log(`License created: ${key} tier=${tier} email=${email}`);
    await this.sendWelcomeEmail(email, key, tier);
    void customerId; // stored in Stripe metadata for future portal use
  }

  private async cancelLicenseByCustomer(customerId: string): Promise<void> {
    this.logger.log(`Cancelling license for customer ${customerId}`);
    // In production: map customerId → licenseKey via a CustomerLicense table
    // For now log the event — full mapping requires an additional model
  }

  private async gracePeriodLicenseByCustomer(customerId: string): Promise<void> {
    this.logger.warn(`Payment failed for customer ${customerId} — grace period`);
  }

  private async extendLicenseByCustomer(customerId: string): Promise<void> {
    this.logger.log(`Payment succeeded for customer ${customerId} — extending license`);
  }

  private async sendWelcomeEmail(email: string, key: string, tier: string): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'XtreamPulsar <noreply@xtreampulsar.io>',
          to: [email],
          subject: `[XtreamPulsar] ${tier} Lisansınız Hazır`,
          html: `
            <h2>XtreamPulsar'a Hoş Geldiniz!</h2>
            <p>Lisans anahtarınız: <strong style="font-size:1.2em;letter-spacing:2px">${key}</strong></p>
            <p>Tier: <strong>${tier}</strong></p>
            <p>Paneli kurmak için <a href="https://docs.xtreampulsar.io/install">kurulum kılavuzunu</a> takip edin.</p>
            <p>Sorularınız için <a href="mailto:support@xtreampulsar.io">support@xtreampulsar.io</a></p>
          `,
        }),
      });
      this.logger.log(`Welcome email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send welcome email: ${(err as Error).message}`);
    }
  }
}
