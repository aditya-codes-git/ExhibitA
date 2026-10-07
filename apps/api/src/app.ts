import express from 'express';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import type { Readiness } from '@exhibita/shared';
import { createOrderRequestSchema } from '@exhibita/shared';
import type { Config } from './config.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { PayPalClient, extractCaptureDetails } from './paypal.js';

const jerseyDemo = {
  itemName: 'Real Madrid 2026 home jersey, player edition',
  shopName: 'Demo Sports Shop',
  buyerInstruction:
    'Buy the Real Madrid 2026 home jersey, player edition, for $25 from Demo Sports Shop.',
  amountMinor: 2500,
} as const;

export function createApp({
  config,
  checkDatabase,
  database,
  paypalClient,
}: {
  config: Config;
  checkDatabase?: () => Promise<void>;
  database?: PrismaClient;
  paypalClient?: PayPalClient;
}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .json({ status: 'ok', service: 'exhibita-api' });
  });

  app.get('/api/readiness', async (_req, res) => {
    let databaseStatus: Readiness['database'] = 'not_configured';
    if (config.databaseUrl) {
      databaseStatus = 'unavailable';
      try {
        if (checkDatabase) {
          await checkDatabase();
          databaseStatus = 'connected';
        }
      } catch {
        /* Readiness never discloses database credentials or driver errors. */
      }
    }
    const result: Readiness = {
      database: databaseStatus,
      paypal:
        config.paypalClientId && config.paypalClientSecret
          ? 'configured_unverified'
          : 'not_configured',
      paymentFlow: 'not_implemented',
    };
    res
      .status(databaseStatus === 'connected' ? 200 : 503)
      .set('Cache-Control', 'no-store')
      .json(result);
  });

  app.get('/api/orders', async (_req, res) => {
    if (!database) {
      return res.status(503).json({ error: 'Database is not connected' });
    }
    try {
      const orders = await database.order.findMany({
        include: {
          merchant: true,
          captures: true,
          evidenceCase: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      return res.set('Cache-Control', 'no-store').json(orders);
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to query orders',
      });
    }
  });

  app.get('/api/orders/:id', async (req, res) => {
    if (!database) {
      return res.status(503).json({ error: 'Database is not connected' });
    }
    try {
      const order = await database.order.findUnique({
        where: { id: req.params.id },
        include: {
          merchant: true,
          captures: true,
          evidenceCase: true,
        },
      });
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      return res.set('Cache-Control', 'no-store').json(order);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to query order',
      });
    }
  });

  app.post('/api/orders', async (req, res) => {
    if (!database) {
      return res.status(503).json({ error: 'Database is not connected' });
    }
    if (!paypalClient) {
      return res.status(503).json({ error: 'PayPal is not configured' });
    }
    const parsed = createOrderRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid order input' });
    }
    const isJerseyDemo = parsed.data.demoCase === 'football_jersey_2026';
    if (
      isJerseyDemo &&
      (parsed.data.amountMinor !== undefined ||
        parsed.data.itemName !== undefined)
    ) {
      return res.status(400).json({ error: 'Invalid demo order input' });
    }
    const amountMinor = isJerseyDemo
      ? jerseyDemo.amountMinor
      : (parsed.data.amountMinor ?? 1500);
    const itemName = isJerseyDemo ? jerseyDemo.itemName : parsed.data.itemName;

    try {
      let merchant = await database.merchant.findFirst();
      if (!merchant) {
        merchant = await database.merchant.create({
          data: {
            name: 'ExhibitA Demo Merchant',
          },
        });
      }

      const createRequestId = randomUUID();
      const captureRequestId = randomUUID();

      const orderData = {
        merchantId: merchant.id,
        amountMinor,
        currency: 'USD',
        status: 'LOCAL_CREATED',
        createRequestId,
        captureRequestId,
      };
      const order = isJerseyDemo
        ? await database.$transaction(async (tx) => {
            const created = await tx.order.create({ data: orderData });
            await tx.evidenceCase.create({
              data: {
                orderId: created.id,
                buyerInstruction: jerseyDemo.buyerInstruction,
                itemName: jerseyDemo.itemName,
                shopName: jerseyDemo.shopName,
                agentActionSource: null,
                agentActionAt: null,
              },
            });
            return created;
          })
        : await database.order.create({ data: orderData });

      const origin = 'http://127.0.0.1:5173';
      const returnUrl = `${origin}/return?orderId=${order.id}`;
      const cancelUrl = `${origin}/cancel?orderId=${order.id}`;

      const paypalResult = await paypalClient.createOrder({
        amountMinor,
        requestId: createRequestId,
        reference: order.id,
        returnUrl,
        cancelUrl,
      });

      const updatedOrderData = {
        paypalOrderId: paypalResult.id,
        status: 'PAYPAL_ORDER_CREATED',
      };
      const updatedOrder = isJerseyDemo
        ? await database.$transaction(async (tx) => {
            const updated = await tx.order.update({
              where: { id: order.id },
              data: updatedOrderData,
            });
            await tx.evidenceCase.update({
              where: { orderId: order.id },
              data: {
                agentActionSource: 'SIMULATED_DEMO',
                agentActionAt: new Date(),
              },
            });
            return updated;
          })
        : await database.order.update({
            where: { id: order.id },
            data: updatedOrderData,
          });

      return res.status(201).json({
        orderId: updatedOrder.id,
        paypalOrderId: paypalResult.id,
        approvalUrl: paypalResult.approvalUrl,
        amountMinor: updatedOrder.amountMinor,
        currency: updatedOrder.currency,
        itemName: itemName || 'AI-Assisted Demonstration Item',
      });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Order creation failed',
      });
    }
  });

  app.post('/api/orders/:id/capture', async (req, res) => {
    if (!database) {
      return res.status(503).json({ error: 'Database is not connected' });
    }
    if (!paypalClient) {
      return res.status(503).json({ error: 'PayPal is not configured' });
    }
    const { id } = req.params;

    try {
      const order = await database.order.findUnique({
        where: { id },
        include: { merchant: true, captures: true },
      });
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      if (order.status === 'COMPLETED' && order.captures.length > 0) {
        return res.status(200).json({
          success: true,
          alreadyCaptured: true,
          order,
          capture: order.captures[0],
        });
      }
      if (!order.paypalOrderId) {
        return res
          .status(400)
          .json({ error: 'Order missing PayPal order reference' });
      }

      const capturePayload = await paypalClient.captureOrder(
        order.paypalOrderId,
        order.captureRequestId,
      );

      const captureDetails = extractCaptureDetails(capturePayload);
      if (captureDetails.amountMinor !== order.amountMinor) {
        throw new Error('PayPal capture amount does not match the local order');
      }

      const existingCapture = await database.capture.findUnique({
        where: { paypalCaptureId: captureDetails.paypalCaptureId },
      });
      if (existingCapture) {
        if (existingCapture.orderId !== order.id) {
          throw new Error('PayPal capture belongs to a different order');
        }
        const committedOrder = await database.order.findUnique({
          where: { id: order.id },
          include: { merchant: true, captures: true },
        });
        if (!committedOrder) throw new Error('Captured order not found');
        return res.status(200).json({
          success: true,
          alreadyCaptured: true,
          order: committedOrder,
          capture: existingCapture,
        });
      }

      const result = await database.$transaction(async (tx) => {
        const newCapture = await tx.capture.create({
          data: {
            orderId: order.id,
            paypalCaptureId: captureDetails.paypalCaptureId,
            status: captureDetails.status,
            amountMinor: captureDetails.amountMinor,
            currency: captureDetails.currency,
            occurredAt: captureDetails.occurredAt,
          },
        });

        const updated = await tx.order.update({
          where: { id: order.id },
          data: {
            status:
              captureDetails.status === 'COMPLETED'
                ? 'COMPLETED'
                : `PAYPAL_${captureDetails.status}`,
          },
          include: {
            merchant: true,
            captures: true,
          },
        });

        return { order: updated, capture: newCapture };
      });

      return res.status(200).json({
        success: true,
        order: result.order,
        capture: result.capture,
      });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Capture failed',
      });
    }
  });

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  return app;
}
