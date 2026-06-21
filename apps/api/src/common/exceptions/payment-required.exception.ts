import { HttpException, HttpStatus } from '@nestjs/common';

export class PaymentRequiredException extends HttpException {
  constructor(message = 'Payment required') {
    super(message, HttpStatus.PAYMENT_REQUIRED);
  }
}
