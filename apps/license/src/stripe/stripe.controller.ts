import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  RawBodyRequest,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import type { Request } from 'express';

class CheckoutDto {
  tier!: string;
  email!: string;
  successUrl!: string;
  cancelUrl!: string;
}

class PortalDto {
  customerId!: string;
  returnUrl!: string;
}

@Controller('stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(private readonly stripeService: StripeService) {}

  @Get('plans')
  getPlans() {
    return this.stripeService.getPlans();
  }

  @Post('checkout')
  async createCheckout(@Body() dto: CheckoutDto) {
    const { tier, email, successUrl, cancelUrl } = dto;
    if (!tier || !email) throw new BadRequestException('tier and email required');
    return this.stripeService.createCheckoutSession(tier, email, successUrl, cancelUrl);
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const payload = req.rawBody;
    if (!payload) throw new BadRequestException('No raw body');
    try {
      await this.stripeService.handleWebhook(payload, signature);
      return { received: true };
    } catch (err) {
      this.logger.error(`Webhook error: ${(err as Error).message}`);
      throw new BadRequestException('Webhook error');
    }
  }

  @Post('portal')
  async createPortal(@Body() dto: PortalDto) {
    const { customerId, returnUrl } = dto;
    if (!customerId) throw new BadRequestException('customerId required');
    return this.stripeService.createCustomerPortal(customerId, returnUrl);
  }
}
