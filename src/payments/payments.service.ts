import { Request, Response } from 'express';
import { HttpStatus, Injectable } from '@nestjs/common';

import { envs } from '../config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto/payment-session.dto';

@Injectable()
export class PaymentsService {
  private readonly stripe = new Stripe(envs.stripeSecret);

  async createPaymentSession({ currency, items, orderId }: PaymentSessionDto) {
    const lineItems = items.map(({ name, price, quantity }) => ({
      price_data: {
        currency,
        product_data: {
          name,
        },
        unit_amount: Math.round(price * 100),
      },
      quantity,
    }));

    const session = await this.stripe.checkout.sessions.create({
      payment_intent_data: {
        metadata: {
          orderId,
        },
      },
      line_items: lineItems,
      mode: 'payment',
      success_url: envs.stripeSuccessUrl,
      cancel_url: envs.stripeCancelUrl,
    });

    return session;
  }

  async stripeWebhook(req: Request, res: Response) {
    const signature = req.headers['stripe-signature'];

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        req['rawBody'],
        signature,
        envs.stripeEndpointSecret,
      );
    } catch (error) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send(`Webhook Error: ${error.message}`);
    }

    switch (event.type) {
      case 'charge.succeeded':
        const chargeSucceeded = event.data.object;
        console.log({
          orderId: chargeSucceeded.metadata.orderId,
        });
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
        break;
    }

    return res.status(HttpStatus.OK).json({ signature });
  }
}
