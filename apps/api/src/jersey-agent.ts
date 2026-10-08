import Groq from 'groq-sdk';
import { z } from 'zod';
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from 'groq-sdk/resources/chat/completions.js';
import type { PrismaClient } from './generated/prisma/client.js';
import type { PayPalClient } from './paypal.js';
import { demoBuyerInstruction, demoProduct } from './demo-store.js';

type OrderForAgent = Pick<
  Awaited<ReturnType<PrismaClient['order']['findFirstOrThrow']>>,
  'id' | 'amountMinor' | 'currency' | 'createRequestId'
>;

export interface AgentModel {
  complete(
    messages: ChatCompletionMessageParam[],
    signal: AbortSignal,
    nextTool: 'inspect_product' | 'initiate_sandbox_checkout',
  ): Promise<{
    content?: string | null;
    tool_calls?: ChatCompletionMessageToolCall[];
  }>;
}

const inspectArgs = z.strictObject({
  productId: z.literal(demoProduct.productId),
});
const checkoutArgs = z.strictObject({
  productId: z.literal(demoProduct.productId),
  amountMinor: z.literal(demoProduct.amountMinor),
});

export class GroqAgentModel implements AgentModel {
  private client: Groq;
  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Groq({ apiKey, maxRetries: 0, timeout: 40_000 });
  }

  async complete(
    messages: ChatCompletionMessageParam[],
    signal: AbortSignal,
    nextTool: 'inspect_product' | 'initiate_sandbox_checkout',
  ) {
    const response = await this.client.chat.completions.create(
      {
        model: this.model,
        messages,
        temperature: 0,
        parallel_tool_calls: false,
        tool_choice: { type: 'function', function: { name: nextTool } },
        tools: [
          {
            type: 'function',
            function: {
              name: 'inspect_product',
              description: 'Read the controlled demo store product record.',
              parameters: {
                type: 'object',
                properties: { productId: { type: 'string' } },
                required: ['productId'],
                additionalProperties: false,
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'initiate_sandbox_checkout',
              description:
                'Create the PayPal Sandbox order after checking the product.',
              parameters: {
                type: 'object',
                properties: {
                  productId: { type: 'string' },
                  amountMinor: { type: 'integer' },
                },
                required: ['productId', 'amountMinor'],
                additionalProperties: false,
              },
            },
          },
        ],
      },
      { signal },
    );
    return response.choices[0]?.message ?? {};
  }
}

export async function runJerseyAgent({
  database,
  paypalClient,
  model,
  order,
}: {
  database: PrismaClient;
  paypalClient: PayPalClient;
  model: AgentModel;
  order: OrderForAgent;
}) {
  if (order.amountMinor !== demoProduct.amountMinor || order.currency !== 'USD')
    throw new Error('Case amount does not match the demo product');

  const signal = AbortSignal.timeout(45_000);
  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content:
        'You are a constrained Sandbox demo agent. First call inspect_product with productId jersey-2026-home-player. Only after reading the result, call initiate_sandbox_checkout with the same productId and amountMinor 2500. Do not claim the buyer approved payment or a jersey was shipped. Use only the available functions.',
    },
    { role: 'user', content: demoBuyerInstruction },
  ];
  const seen = new Set<string>();
  let inspected = false;

  async function record(
    source: 'AGENT_MODEL' | 'DEMO_STORE' | 'EXHIBITA_TOOL',
    kind: 'TOOL_REQUEST' | 'TOOL_RESULT',
    externalEventId: string,
    payload: Record<string, unknown>,
  ) {
    await database.evidenceEvent.create({
      data: {
        orderId: order.id,
        source,
        kind,
        externalEventId,
        occurredAt: new Date(),
        payload: payload as never,
      },
    });
  }

  for (let step = 0; step < 4; step++) {
    if (signal.aborted) throw new Error('Agent run timed out');
    const answer = await model.complete(
      messages,
      signal,
      inspected ? 'initiate_sandbox_checkout' : 'inspect_product',
    );
    if (signal.aborted) throw new Error('Agent run timed out');
    const calls = answer.tool_calls ?? [];
    if (calls.length !== 1 || !calls[0])
      throw new Error('Agent must request one tool at a time');
    const call = calls[0];
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(call.id) || seen.has(call.id))
      throw new Error('Agent returned a duplicate or invalid tool call');
    seen.add(call.id);
    const name = call.function.name;
    let args: unknown;
    try {
      args = JSON.parse(call.function.arguments);
    } catch {
      args = null;
    }
    const parsed =
      name === 'inspect_product'
        ? inspectArgs.safeParse(args)
        : name === 'initiate_sandbox_checkout'
          ? checkoutArgs.safeParse(args)
          : null;
    await record(
      'AGENT_MODEL',
      'TOOL_REQUEST',
      call.id,
      parsed?.success
        ? { tool: name, arguments: parsed.data }
        : { tool: 'invalid', accepted: false },
    );
    if (!parsed?.success)
      throw new Error('Agent requested an invalid product or amount');

    messages.push({
      role: 'assistant',
      content: answer.content ?? null,
      tool_calls: calls,
    });
    if (name === 'inspect_product') {
      if (inspected) throw new Error('Agent repeated the product lookup');
      inspected = true;
      await record('DEMO_STORE', 'TOOL_RESULT', call.id, {
        product: demoProduct,
      });
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(demoProduct),
      });
      continue;
    }
    if (!inspected)
      throw new Error('Agent tried to check out before inspecting the product');
    if (signal.aborted) throw new Error('Agent run timed out');
    const paypal = await paypalClient.createOrder({
      amountMinor: demoProduct.amountMinor,
      requestId: order.createRequestId,
      reference: order.id,
      returnUrl: `http://127.0.0.1:5173/return?orderId=${order.id}`,
      cancelUrl: `http://127.0.0.1:5173/cancel?orderId=${order.id}`,
    });
    await database.order.update({
      where: { id: order.id },
      data: { paypalOrderId: paypal.id, status: 'PAYPAL_ORDER_CREATED' },
    });
    await record('EXHIBITA_TOOL', 'TOOL_RESULT', call.id, {
      paypalOrderId: paypal.id,
      amountMinor: demoProduct.amountMinor,
      currency: 'USD',
      status: 'PAYPAL_ORDER_CREATED',
    });
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: JSON.stringify({
        paypalOrderId: paypal.id,
        status: 'PAYPAL_ORDER_CREATED',
      }),
    });
    return {
      orderId: order.id,
      paypalOrderId: paypal.id,
      approvalUrl: paypal.approvalUrl,
      amountMinor: demoProduct.amountMinor,
      currency: 'USD' as const,
    };
  }
  throw new Error('Agent did not complete the required two tool calls');
}
