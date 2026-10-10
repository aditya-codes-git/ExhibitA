import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileSearch,
} from 'lucide-react';
import {
  demoProductSchema,
  isCaseCaptureComplete,
  orderItemSchema,
  type EvidenceEventItem,
  type OrderItem,
} from '@exhibita/shared';
import { apiFetch } from './api';

const money = (minor: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(minor / 100);

function time(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not recorded';
}

function eventFacts(event: EvidenceEventItem) {
  if (event.source === 'DEMO_STORE') {
    const product = demoProductSchema.safeParse(event.payload.product);
    return product.success
      ? `${product.data.itemName} · ${product.data.edition} · ${product.data.shopName} · ${money(product.data.amountMinor)} USD`
      : 'Product payload is missing or invalid.';
  }
  if (event.source === 'EXHIBITA_TOOL') {
    return typeof event.payload.paypalOrderId === 'string'
      ? `PayPal Sandbox order ${event.payload.paypalOrderId} · ${typeof event.payload.amountMinor === 'number' ? money(event.payload.amountMinor) : 'amount missing'} ${event.payload.currency === 'USD' ? 'USD' : 'currency unverified'} · buyer approval still required`
      : 'Checkout result is missing an order reference.';
  }
  const args = event.payload.arguments;
  if (typeof args !== 'object' || !args) return 'Tool arguments were invalid.';
  const values = args as Record<string, unknown>;
  return event.payload.tool === 'inspect_product'
    ? `Requested product: ${String(values.productId)}`
    : `Requested product: ${String(values.productId)} · Amount: ${String(values.amountMinor)} USD minor units`;
}

export function SavedCase() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<OrderItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) {
      setError('Missing order ID.');
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    apiFetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Order record could not be loaded.');
        return orderItemSchema.parse(await response.json());
      })
      .then((saved) => {
        setOrder(saved);
        setLoading(false);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Order record could not be loaded.',
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [orderId]);

  if (loading) {
    return <main className="dashboard-content">Loading saved record…</main>;
  }
  if (error || !order) {
    return (
      <main className="dashboard-content">
        <p role="alert" className="rounded-xl bg-rose-50 p-5 text-rose-800">
          {error || 'Order record could not be loaded.'}
        </p>
        <Link
          to="/"
          className="mt-4 inline-block font-semibold text-teal-800 hover:underline"
        >
          Return to dashboard
        </Link>
      </main>
    );
  }

  const evidence = order.evidenceCase;
  const capture =
    order.captures.find((item) => item.status === 'COMPLETED') ??
    order.captures[0];
  const completed = isCaseCaptureComplete(order);
  const recorded = Boolean(evidence?.agentRunStatus);
  const productEvent = order.evidenceEvents.find(
    (event) => event.source === 'DEMO_STORE' && event.kind === 'TOOL_RESULT',
  );
  const product = demoProductSchema.safeParse(productEvent?.payload.product);
  const productMatches =
    product.success &&
    Boolean(evidence) &&
    product.data.itemName === evidence?.itemName &&
    product.data.shopName === evidence?.shopName &&
    product.data.amountMinor === order.amountMinor;
  const checkoutRequested = order.evidenceEvents.some(
    (event) =>
      event.source === 'AGENT_MODEL' &&
      event.kind === 'TOOL_REQUEST' &&
      event.payload.tool === 'initiate_sandbox_checkout' &&
      typeof event.payload.arguments === 'object' &&
      event.payload.arguments !== null &&
      (event.payload.arguments as Record<string, unknown>).amountMinor === 2500,
  );

  return (
    <main className="dashboard-content">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:underline"
      >
        <ArrowLeft size={16} /> Back to dashboard
      </Link>

      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
            {recorded ? 'Recorded agent case' : 'Saved Sandbox record'}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">
            {evidence ? 'Football jersey evidence case' : 'Manual test order'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Local order ID: <code className="break-all">{order.id}</code>
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
            completed
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-900'
          }`}
        >
          {completed ? <CheckCircle2 size={17} /> : <Clock size={17} />}
          {completed ? 'Sandbox capture completed' : 'Payment not confirmed'}
        </span>
      </div>

      {evidence ? (
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
              1 · Demo-submitted buyer request
            </p>
            <blockquote className="mt-4 border-l-4 border-teal-700 bg-teal-50 p-4 text-lg font-medium text-slate-900">
              {evidence.buyerInstruction}
            </blockquote>
            <p className="mt-4 text-sm text-slate-600">
              {evidence.itemName} · {evidence.shopName} ·{' '}
              {money(order.amountMinor)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Preset demo input, saved by ExhibitA at{' '}
              {time(evidence.recordedAt)}. Not independent proof of buyer
              identity.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
              2 · {recorded ? 'Recorded agent activity' : 'Simulated action'}
            </p>
            {recorded ? (
              <>
                <p className="mt-4 text-lg font-bold text-slate-950">
                  {evidence.agentRunStatus === 'CHECKOUT_READY'
                    ? 'Sandbox checkout prepared'
                    : evidence.agentRunStatus === 'FAILED'
                      ? 'Agent run incomplete'
                      : evidence.agentRunStatus === 'RUNNING'
                        ? 'Agent run in progress'
                        : 'Agent run not started'}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Source: recorded model tool calls and local tool results.{' '}
                  {order.evidenceEvents.length} events stored.
                </p>
              </>
            ) : evidence.agentActionSource === 'SIMULATED_DEMO' ? (
              <>
                <p className="mt-4 text-lg font-bold text-slate-950">
                  Demo flow initiated the requested PayPal order
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Source: SIMULATED_DEMO · ExhibitA server time:{' '}
                  {time(evidence.agentActionAt)}
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm text-amber-800">
                No simulated action recorded. PayPal order creation may not have
                completed.
              </p>
            )}
            <p className="mt-4 text-xs text-slate-500">
              {recorded
                ? 'Any recorded product lookup reads a controlled server record; it does not prove an external website visit.'
                : 'This is scripted demo activity, not telemetry from an external AI agent or proof that a shop was visited.'}
            </p>
          </section>
        </div>
      ) : (
        <p className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
          This manual Sandbox order has no jersey evidence case. Its payment
          record is still available below.
        </p>
      )}

      {recorded && (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
            3 · Source-labeled evidence trail
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">
            What was actually recorded
          </h2>
          {order.evidenceEvents.length ? (
            <ol className="evidence-event-list">
              {order.evidenceEvents.map((event) => (
                <li key={event.id}>
                  <span className="evidence-event-source">
                    {event.source.replaceAll('_', ' ')} ·{' '}
                    {event.kind.replaceAll('_', ' ')}
                  </span>
                  <strong>
                    {event.payload.tool === 'inspect_product'
                      ? 'Product lookup requested'
                      : event.payload.tool === 'initiate_sandbox_checkout'
                        ? 'Sandbox checkout requested'
                        : event.source === 'DEMO_STORE'
                          ? 'Product record returned'
                          : event.source === 'EXHIBITA_TOOL'
                            ? 'PayPal order recorded'
                            : 'Invalid tool request'}
                  </strong>
                  <p className="evidence-event-facts">{eventFacts(event)}</p>
                  <p>
                    Observed {time(event.occurredAt)} · Stored{' '}
                    {time(event.recordedAt)}
                  </p>
                  <code>Event ID: {event.externalEventId}</code>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-amber-800">
              No agent tool events are stored yet.
            </p>
          )}
          <div className="evidence-checks">
            <p>
              <strong>
                {productMatches ? 'Matched' : 'Missing or conflicting'}
              </strong>{' '}
              Store product, item, edition, shop, and $25 amount
            </p>
            <p>
              <strong>{checkoutRequested ? 'Recorded' : 'Missing'}</strong>{' '}
              Agent checkout request for $25
            </p>
            <p>
              <strong>{completed ? 'Confirmed' : 'Missing'}</strong> Completed
              PayPal Sandbox capture
            </p>
          </div>
        </section>
      )}

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <FileSearch className="text-teal-800" size={22} />
          <h2 className="text-xl font-bold text-slate-950">
            PayPal Sandbox payment record
          </h2>
        </div>
        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <p>
            <span className="block text-slate-500">Order amount</span>
            <strong>{money(order.amountMinor)} USD</strong>
          </p>
          <p>
            <span className="block text-slate-500">Local status</span>
            <strong>{order.status}</strong>
          </p>
          <p>
            <span className="block text-slate-500">PayPal order ID</span>
            <code className="break-all">
              {order.paypalOrderId || 'Not recorded'}
            </code>
          </p>
          <p>
            <span className="block text-slate-500">Local order created</span>
            <time dateTime={order.createdAt}>{time(order.createdAt)}</time>
          </p>
          {capture && (
            <>
              <p>
                <span className="block text-slate-500">PayPal capture ID</span>
                <code className="break-all">{capture.paypalCaptureId}</code>
              </p>
              <p>
                <span className="block text-slate-500">
                  Capture status and amount
                </span>
                <strong>
                  {capture.status} · {money(capture.amountMinor)}{' '}
                  {capture.currency}
                </strong>
              </p>
              <p>
                <span className="block text-slate-500">
                  Capture event time (response or fallback)
                </span>
                <time dateTime={capture.occurredAt}>
                  {time(capture.occurredAt)}
                </time>
              </p>
              <p>
                <span className="block text-slate-500">
                  Recorded by ExhibitA
                </span>
                <time dateTime={capture.recordedAt}>
                  {time(capture.recordedAt)}
                </time>
              </p>
            </>
          )}
        </div>
        {!completed && (
          <p className="mt-5 flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle size={18} className="shrink-0" />
            No completed capture is stored for this order. Buyer approval,
            cancellation, or capture outcome may still need review.
          </p>
        )}
        <p className="mt-5 text-xs text-slate-500">
          PayPal confirms Sandbox payment details only. It does not verify the
          jersey, edition, fictional shop, or agent activity.
        </p>
      </section>
    </main>
  );
}
