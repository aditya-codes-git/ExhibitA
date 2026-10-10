import express from 'express';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import type { Readiness } from '@exhibita/shared';
import { createOrderRequestSchema } from '@exhibita/shared';
import type { Config } from './config.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { PayPalClient, extractCaptureDetails } from './paypal.js';
import { demoBuyerInstruction, demoProduct } from './demo-store.js';
import { runJerseyAgent, type AgentModel } from './jersey-agent.js';
import { verifyAccessToken } from './auth.js';
import type {
  PayPalSignatureHeaders,
  PayPalWebhookVerifier,
} from './paypal-webhook.js';
import { parsePayPalWebhookEvent } from './paypal-webhook-event.js';

const jerseyDemo = {
  ...demoProduct,
  buyerInstruction: demoBuyerInstruction,
} as const;

export function createApp({
  config,
  checkDatabase,
  database,
  paypalClient,
  paypalWebhookVerifier,
  agentModel,
  verifyToken,
  webRoot,
}: {
  config: Config;
  checkDatabase?: () => Promise<void>;
  database?: PrismaClient;
  paypalClient?: PayPalClient;
  paypalWebhookVerifier?: Pick<PayPalWebhookVerifier, 'verify'>;
  agentModel?: AgentModel;
  verifyToken?: (token: string) => Promise<{ id: string } | null>;
  webRoot?: string;
}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          connectSrc: [
            "'self'",
            ...(config.supabaseUrl ? [new URL(config.supabaseUrl).origin] : []),
          ],
        },
      },
    }),
  );

  app.post(
    '/api/paypal/webhook',
    express.raw({ type: 'application/json', limit: '256kb' }),
    async (req, res) => {
      if (!config.paypalWebhookId || !paypalWebhookVerifier || !database) {
        return res.status(503).json({ error: 'PayPal webhook is unavailable' });
      }
      if (!Buffer.isBuffer(req.body)) {
        return res
          .status(400)
          .json({ error: 'Invalid PayPal webhook request' });
      }
      const headers: PayPalSignatureHeaders = {
        transmissionId: req.header('paypal-transmission-id') ?? '',
        transmissionTime: req.header('paypal-transmission-time') ?? '',
        certUrl: req.header('paypal-cert-url') ?? '',
        authAlgo: req.header('paypal-auth-algo') ?? '',
        transmissionSig: req.header('paypal-transmission-sig') ?? '',
      };
      if (Object.values(headers).some((value) => !value)) {
        return res
          .status(400)
          .json({ error: 'Invalid PayPal webhook request' });
      }
      try {
        if (
          !(await paypalWebhookVerifier.verify(
            req.body,
            headers,
            config.paypalWebhookId,
          ))
        ) {
          return res
            .status(400)
            .json({ error: 'Invalid PayPal webhook signature' });
        }
      } catch {
        return res
          .status(503)
          .json({ error: 'PayPal webhook verification unavailable' });
      }

      let event: ReturnType<typeof parsePayPalWebhookEvent>;
      try {
        event = parsePayPalWebhookEvent(req.body);
      } catch {
        return res.status(400).json({ error: 'Invalid PayPal webhook event' });
      }
      try {
        const receipt = {
          paypalEventId: event.paypalEventId,
          eventType: event.eventType,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          ...(event.paypalOrderId
            ? { paypalOrderId: event.paypalOrderId }
            : {}),
          occurredAt: event.occurredAt,
          payload: event.payload,
        };
        await database.$transaction(async (tx) => {
          let orderId: string | undefined;
          if (event.paypalOrderId) {
            orderId = (
              await tx.order.findUnique({
                where: { paypalOrderId: event.paypalOrderId },
                select: { id: true },
              })
            )?.id;
          }
          if (!orderId && event.relatedCaptureId) {
            orderId = (
              await tx.capture.findUnique({
                where: { paypalCaptureId: event.relatedCaptureId },
                select: { orderId: true },
              })
            )?.orderId;
          }
          await tx.payPalWebhookEvent.upsert({
            where: { paypalEventId: event.paypalEventId },
            create: {
              ...receipt,
              orderId: orderId ?? null,
              verifiedAt: new Date(),
            },
            update: orderId ? { orderId } : {},
          });
          if (orderId) {
            await tx.evidenceEvent.createMany({
              data: [
                {
                  orderId,
                  source: 'PAYPAL',
                  kind: 'PAYPAL_WEBHOOK',
                  externalEventId: event.paypalEventId,
                  occurredAt: event.occurredAt,
                  payload: {
                    eventType: event.eventType,
                    resourceType: event.resourceType,
                    resourceId: event.resourceId,
                    ...event.payload,
                  },
                },
              ],
              skipDuplicates: true,
            });
          }
        });
      } catch {
        return res
          .status(503)
          .json({ error: 'Could not store PayPal webhook' });
      }
      return res.status(200).json({ received: true });
    },
  );

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .json({ status: 'ok', service: 'exhibita-api' });
  });

  app.get('/api/demo-store/product', (_req, res) => {
    return res.set('Cache-Control', 'no-store').json(demoProduct);
  });

  app.use('/api', async (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/.exec(req.header('Authorization') ?? '');
    if (!match)
      return res.status(401).json({ error: 'Authentication required' });
    if (!verifyToken && (!config.supabaseUrl || !config.supabaseAnonKey)) {
      return res
        .status(503)
        .json({ error: 'Authentication is not configured' });
    }
    try {
      const user = await (
        verifyToken ?? ((token) => verifyAccessToken(token, config))
      )(match[1]!);
      if (!user) return res.status(401).json({ error: 'Invalid session' });
      res.locals.userId = user.id;
      next();
    } catch {
      return res.status(503).json({ error: 'Authentication is unavailable' });
    }
  });

  const merchantForUser = (userId: string) =>
    database!.merchant.upsert({
      where: { authUserId: userId },
      create: { name: 'ExhibitA Merchant', authUserId: userId },
      update: {},
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
    let paypalStatus: Readiness['paypal'] = 'not_configured';
    if (config.paypalClientId && config.paypalClientSecret) {
      paypalStatus = 'configured_unverified';
      try {
        if (paypalClient) {
          await paypalClient.verifyCredentials();
          paypalStatus = 'verified';
        }
      } catch {
        /* Readiness never discloses PayPal credentials or OAuth errors. */
      }
    }
    const result: Readiness = {
      database: databaseStatus,
      paypal: paypalStatus,
      paymentFlow:
        databaseStatus === 'connected' && paypalStatus === 'verified'
          ? 'ready'
          : 'not_implemented',
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
        where: { merchant: { authUserId: res.locals.userId } },
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
      const order = await database.order.findFirst({
        where: {
          id: req.params.id,
          merchant: { authUserId: res.locals.userId },
        },
        include: {
          merchant: true,
          captures: true,
          evidenceCase: true,
          evidenceEvents: {
            orderBy: [{ occurredAt: 'asc' }, { recordedAt: 'asc' }],
          },
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

  app.post('/api/agent-cases', async (_req, res) => {
    if (!database)
      return res.status(503).json({ error: 'Database is not connected' });
    try {
      const merchant = await merchantForUser(res.locals.userId);
      const order = await database.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            merchantId: merchant.id,
            amountMinor: demoProduct.amountMinor,
            currency: demoProduct.currency,
            status: 'LOCAL_CREATED',
            createRequestId: randomUUID(),
            captureRequestId: randomUUID(),
          },
        });
        await tx.evidenceCase.create({
          data: {
            orderId: created.id,
            buyerInstruction: demoBuyerInstruction,
            itemName: demoProduct.itemName,
            shopName: demoProduct.shopName,
            agentActionSource: null,
            agentActionAt: null,
            agentRunStatus: 'READY',
          },
        });
        return created;
      });
      return res
        .status(201)
        .set('Cache-Control', 'no-store')
        .json({ orderId: order.id });
    } catch {
      return res.status(500).json({ error: 'Could not create agent case' });
    }
  });

  app.post('/api/agent-cases/:id/run', async (req, res) => {
    if (!database)
      return res.status(503).json({ error: 'Database is not connected' });
    const id = req.params.id;
    let order: Awaited<ReturnType<typeof database.order.findFirst>>;
    try {
      order = await database.order.findFirst({
        where: { id, merchant: { authUserId: res.locals.userId } },
      });
    } catch {
      return res.status(500).json({ error: 'Could not load agent case' });
    }
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!paypalClient)
      return res.status(503).json({ error: 'PayPal is not configured' });
    if (!agentModel)
      return res.status(503).json({
        error: 'Groq agent is not configured. Add GROQ_API_KEY to local .env.',
      });
    try {
      const claimed = await database.evidenceCase.updateMany({
        where: {
          orderId: id,
          order: { merchant: { authUserId: res.locals.userId } },
          agentRunStatus: 'READY',
        },
        data: { agentRunStatus: 'RUNNING' },
      });
      if (claimed.count !== 1)
        return res
          .status(409)
          .json({ error: 'Agent case is not ready to run' });
      try {
        const result = await runJerseyAgent({
          database,
          paypalClient,
          model: agentModel,
          order,
        });
        await database.evidenceCase.update({
          where: { orderId: id },
          data: { agentRunStatus: 'CHECKOUT_READY' },
        });
        return res.set('Cache-Control', 'no-store').json(result);
      } catch {
        await database.evidenceCase.update({
          where: { orderId: id },
          data: { agentRunStatus: 'FAILED' },
        });
        return res.status(502).json({
          error:
            'Agent run did not complete. Review the saved case for recorded steps.',
        });
      }
    } catch {
      return res.status(500).json({ error: 'Could not start agent run' });
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
      const merchant = await merchantForUser(res.locals.userId);

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
      const order = await database.order.findFirst({
        where: { id, merchant: { authUserId: res.locals.userId } },
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
        const committedOrder = await database.order.findFirst({
          where: { id: order.id, merchant: { authUserId: res.locals.userId } },
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

  if (webRoot) {
    app.use(express.static(webRoot));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
      return res.sendFile('index.html', { root: webRoot });
    });
  }

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  return app;
}
