import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useMatch,
  useSearchParams,
} from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  ExternalLink,
  FileSearch,
  Home,
  Layers,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  isCaseCaptureComplete,
  readinessSchema,
  type Readiness,
} from '@exhibita/shared';
import { DemoCase } from './DemoCase';
import { SavedCase } from './SavedCase';
import { DemoStore } from './DemoStore';
import './style.css';

type OrderWithCaptures = {
  id: string;
  merchantId: string;
  merchant?: { id: string; name: string };
  amountMinor: number;
  currency: string;
  status: string;
  paypalOrderId: string | null;
  createRequestId: string;
  captureRequestId: string;
  createdAt: string;
  updatedAt: string;
  evidenceCase?: { orderId: string } | null;
  captures: Array<{
    id: string;
    orderId: string;
    paypalCaptureId: string;
    status: string;
    amountMinor: number;
    currency: string;
    occurredAt: string;
    recordedAt: string;
  }>;
};

function formatCurrency(amountMinor: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amountMinor / 100);
}

function StatusBadge({ order }: { order: OrderWithCaptures }) {
  if (isCaseCaptureComplete(order)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        <CheckCircle2 size={13} />
        Captured
      </span>
    );
  }
  if (order.status === 'PAYPAL_FAILED' || order.status === 'PAYPAL_DECLINED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
        Payment failed
      </span>
    );
  }
  if (
    order.status === 'PAYPAL_ORDER_CREATED' ||
    order.status === 'PAYPAL_PENDING' ||
    order.status === 'COMPLETED' ||
    order.status === 'PAYPAL_COMPLETED'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
        <Clock size={13} />
        {order.status === 'PAYPAL_ORDER_CREATED'
          ? 'Awaiting buyer approval'
          : order.status === 'PAYPAL_PENDING'
            ? 'Capture pending'
            : 'Capture not confirmed'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
      {order.status === 'LOCAL_CREATED'
        ? 'Preparing order'
        : order.status.replaceAll('_', ' ')}
    </span>
  );
}

function Dashboard() {
  const [readiness, setReadiness] = useState<Readiness>();
  const [readinessError, setReadinessError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const [orders, setOrders] = useState<OrderWithCaptures[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [ordersError, setOrdersError] = useState('');

  const [amountInput, setAmountInput] = useState('15.00');
  const [itemInput, setItemInput] = useState('Demo digital service');
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [createdOrderResult, setCreatedOrderResult] = useState<{
    orderId: string;
    paypalOrderId: string;
    approvalUrl: string;
    amountMinor: number;
    currency: string;
  } | null>(null);
  const [createError, setCreateError] = useState('');

  // Fetch readiness
  useEffect(() => {
    const controller = new AbortController();
    setIsChecking(true);
    setReadinessError('');
    fetch('/api/readiness', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok && res.status !== 503) {
          throw new Error('Readiness check failed');
        }
        return readinessSchema.parse(await res.json());
      })
      .then((data) => {
        setReadiness(data);
        setIsChecking(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setIsChecking(false);
          setReadinessError(
            'Could not reach API. Ensure Express is running on port 3001.',
          );
        }
      });
    return () => controller.abort();
  }, [attempt]);

  // Fetch orders if DB is connected
  const refreshOrders = () => {
    setLoadingOrders(true);
    setOrdersError('');
    fetch('/api/orders')
      .then(async (res) => {
        if (!res.ok) throw new Error('Orders could not be loaded.');
        return (await res.json()) as OrderWithCaptures[];
      })
      .then((data) => {
        setOrders(data);
        setOrdersLoaded(true);
        setLoadingOrders(false);
      })
      .catch(() => {
        setOrdersError(
          'Orders could not be loaded. Recheck the database connection.',
        );
        setLoadingOrders(false);
      });
  };

  useEffect(() => {
    if (readiness?.database === 'connected') {
      refreshOrders();
    }
  }, [readiness?.database]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreatedOrderResult(null);
    setCreatingOrder(true);

    const validAmount = /^\d+\.\d{2}$/.test(amountInput);
    const [dollars, cents] = amountInput.split('.');
    const amountMinor = validAmount
      ? Number(dollars) * 100 + Number(cents)
      : NaN;
    if (
      !Number.isSafeInteger(amountMinor) ||
      amountMinor < 1 ||
      amountMinor > 1_000_000
    ) {
      setCreateError(
        'Enter a USD amount from $0.01 to $10,000.00 using two decimal places.',
      );
      setCreatingOrder(false);
      return;
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountMinor,
          itemName: itemInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create order');
      }

      setCreatedOrderResult(data);
      refreshOrders();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCreatingOrder(false);
    }
  };

  const isConfigured = readiness?.paymentFlow === 'ready';

  const completedOrders = orders.filter(isCaseCaptureComplete);
  const showOrderSummary =
    ordersLoaded &&
    !isChecking &&
    !loadingOrders &&
    !ordersError &&
    !readinessError &&
    readiness?.database === 'connected';

  return (
    <main className="dashboard-content">
      <header className="overview-header">
        <div>
          <p className="overview-eyebrow">Merchant overview / Sandbox</p>
          <h1>Transaction evidence</h1>
          <p>
            Review recent orders and see which payments have a stored capture.
          </p>
        </div>
        <Link to="/demo-case" className="overview-action">
          Open $25 guided demo <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </header>

      <section className="mb-7" aria-label="Latest 20 order summary">
        <div className="overview-cards">
          <div>
            <p>Latest 20 orders</p>
            <strong>{showOrderSummary ? orders.length : '—'}</strong>
          </div>
          <div>
            <p>Captured orders</p>
            <strong>{showOrderSummary ? completedOrders.length : '—'}</strong>
          </div>
          <div>
            <p>Captured amount · USD</p>
            <strong>
              {showOrderSummary
                ? formatCurrency(
                    completedOrders.reduce(
                      (sum, order) =>
                        sum +
                        order.captures
                          .filter((capture) => capture.status === 'COMPLETED')
                          .reduce(
                            (total, capture) => total + capture.amountMinor,
                            0,
                          ),
                      0,
                    ),
                  )
                : '—'}
            </strong>
          </div>
        </div>
      </section>

      {/* Recent evidence records */}
      <section
        id="orders"
        className="workspace-panel mb-6"
        aria-labelledby="recent-transactions-heading"
      >
        <div className="section-header">
          <div>
            <p className="section-eyebrow">Case records</p>
            <h2 id="recent-transactions-heading">Recent orders</h2>
            <p>Latest 20 Sandbox orders, newest first.</p>
          </div>
          <button
            type="button"
            onClick={refreshOrders}
            disabled={loadingOrders}
            className="secondary-button"
          >
            <RefreshCw
              size={15}
              className={loadingOrders ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        </div>

        {ordersError || readinessError ? (
          <p
            role="alert"
            className="m-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            {ordersError ||
              'Could not verify the API. Recent orders may be out of date.'}
          </p>
        ) : loadingOrders || (!ordersLoaded && (isChecking || !readiness)) ? (
          <p role="status" className="order-empty">
            Loading recent orders…
          </p>
        ) : !ordersLoaded ? (
          <p className="order-empty">
            Connect Supabase to load recent orders. Check Integrations below.
          </p>
        ) : orders.length === 0 ? (
          <div className="order-empty">
            <p className="font-semibold text-slate-800">
              No orders recorded yet
            </p>
            <p>Start the guided demo to create the first Sandbox case.</p>
          </div>
        ) : (
          <div className="order-list">
            {orders.map((order) => (
              <article key={order.id} className="order-row">
                <div className="order-row-details">
                  <div className="order-row-heading">
                    <strong>
                      {formatCurrency(order.amountMinor, order.currency)}
                    </strong>
                    <StatusBadge order={order} />
                  </div>
                  <p>
                    {order.evidenceCase
                      ? 'Jersey demo · simulated action'
                      : 'Manual Sandbox order'}
                  </p>
                </div>
                <div className="order-row-meta">
                  <time dateTime={order.createdAt}>
                    {new Date(order.createdAt).toLocaleString()}
                  </time>
                  <Link to={`/cases/${order.id}`}>
                    View record <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {/* Manual Sandbox purchase */}
      <section
        id="purchase"
        className="workspace-panel purchase-panel mb-6"
        aria-labelledby="simulate-purchase-heading"
      >
        <div className="section-header">
          <div>
            <p className="section-eyebrow">Secondary tool</p>
            <h2 id="simulate-purchase-heading">Manual Sandbox purchase</h2>
            <p>
              Create a manual test order and approve it as a Sandbox buyer.
              Agent activity is not recorded in this flow.
            </p>
          </div>
        </div>

        <div className="purchase-body">
          <form onSubmit={handleCreateOrder} className="space-y-4">
            <div>
              <label
                htmlFor="item-name"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
              >
                Demo item label
              </label>
              <input
                id="item-name"
                type="text"
                value={itemInput}
                onChange={(e) => setItemInput(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-teal-700 outline-none"
                placeholder="e.g. AI-Agent Server Token"
                required
              />
            </div>
            <p className="text-xs text-slate-500">
              This label is shown for the checkout demo; it is not stored with
              the order.
            </p>

            <div>
              <label
                htmlFor="order-amount"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
              >
                Amount (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm font-semibold text-slate-400">
                  $
                </span>
                <input
                  id="order-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="10000"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 pl-8 pr-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-teal-700 outline-none"
                  required
                />
              </div>
            </div>

            {createError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                {createError}
              </div>
            )}

            <button
              type="submit"
              disabled={creatingOrder || !isConfigured}
              className="purchase-submit flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingOrder ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  Initializing PayPal Order…
                </>
              ) : (
                <>
                  <CreditCard size={16} />
                  Create PayPal Sandbox Order
                </>
              )}
            </button>
          </form>
        </div>

        {createdOrderResult && (
          <div className="mt-6 rounded-lg border border-teal-200 bg-teal-50 p-4 text-xs">
            <div className="mb-2 flex items-center gap-2 font-bold text-teal-900">
              <CheckCircle2 size={16} />
              PayPal Order Initialized
            </div>
            <p className="mb-2 break-all text-teal-900">
              Order ID:{' '}
              <code className="font-mono">
                {createdOrderResult.paypalOrderId}
              </code>
            </p>
            <a
              href={createdOrderResult.approvalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-teal-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-900"
            >
              Approve via PayPal Sandbox <ExternalLink size={13} />
            </a>
          </div>
        )}
      </section>

      {/* Integration readiness */}
      <section
        id="integrations"
        className="workspace-panel"
        aria-labelledby="system-status-heading"
      >
        <div className="section-header">
          <div>
            <p className="section-eyebrow">Connections</p>
            <h2 id="system-status-heading">Integration readiness</h2>
            <p>Database and PayPal Sandbox availability for test orders.</p>
          </div>
          <button
            type="button"
            onClick={() => setAttempt((v) => v + 1)}
            disabled={isChecking}
            className="secondary-button"
          >
            <RefreshCw size={13} className={isChecking ? 'animate-spin' : ''} />
            {isChecking ? 'Checking…' : 'Recheck Status'}
          </button>
        </div>

        {readinessError && (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs font-medium text-amber-900">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            {readinessError}
          </div>
        )}

        <div className="readiness-grid">
          <div>
            <span className="text-xs font-medium text-slate-500">
              Supabase PostgreSQL
            </span>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  readiness?.database === 'connected'
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
              />
              <span className="text-sm font-semibold text-slate-900 capitalize">
                {readiness?.database
                  ? readiness.database.replace('_', ' ')
                  : 'Checking…'}
              </span>
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-500">
              PayPal Sandbox OAuth
            </span>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  readiness?.paypal === 'verified'
                    ? 'bg-emerald-500'
                    : readiness?.paypal === 'configured_unverified'
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                }`}
              />
              <span className="text-sm font-semibold text-slate-900 capitalize">
                {readiness?.paypal
                  ? readiness.paypal.replace('_', ' ')
                  : 'Checking…'}
              </span>
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-500">
              Payment Pipeline
            </span>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isConfigured ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
              <span className="text-sm font-semibold text-slate-900">
                {isConfigured ? 'Ready to test' : 'Not ready'}
              </span>
            </div>
          </div>
        </div>

        {!isConfigured && (
          <div className="m-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
            <p className="font-semibold mb-1">Integration checks:</p>
            <p>
              {readiness?.database !== 'connected' && (
                <>
                  Check the Supabase connection in local{' '}
                  <code className="font-mono">.env</code>.{' '}
                </>
              )}
              {readiness?.paypal === 'not_configured' && (
                <>
                  Set <code className="font-mono">PAYPAL_CLIENT_ID</code> and{' '}
                  <code className="font-mono">PAYPAL_CLIENT_SECRET</code> for
                  Sandbox access.
                </>
              )}
              {readiness?.paypal === 'configured_unverified' &&
                'PayPal Sandbox OAuth has not passed verification.'}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

type CaptureResult = {
  success: boolean;
  order?: {
    id: string;
    paypalOrderId?: string | null;
    status: string;
  };
  capture?: {
    id: string;
    paypalCaptureId: string;
    status: string;
    amountMinor: number;
    currency: string;
  };
};

function ReturnPage() {
  const [params] = useSearchParams();
  const orderId = params.get('orderId');
  const token = params.get('token'); // PayPal Order ID

  const [status, setStatus] = useState<
    'capturing' | 'success' | 'pending' | 'error'
  >('capturing');
  const [errorMessage, setErrorMessage] = useState('');
  const [capturedData, setCapturedData] = useState<CaptureResult | null>(null);

  useEffect(() => {
    if (!orderId || !token) {
      setStatus('error');
      setErrorMessage('Missing order reference in the PayPal return URL.');
      return;
    }

    const controller = new AbortController();
    fetch(`/api/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body.error || 'Failed to capture payment');
        }
        return body;
      })
      .then((data) => {
        setCapturedData(data);
        setStatus(
          data.order?.status === 'COMPLETED' &&
            data.capture?.status === 'COMPLETED'
            ? 'success'
            : 'pending',
        );
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setStatus('error');
          setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
        }
      });

    return () => controller.abort();
  }, [orderId, token]);

  return (
    <main className="evidence-outcome mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {status === 'capturing' && (
          <div className="text-center py-8">
            <RefreshCw
              size={36}
              className="mx-auto text-teal-700 animate-spin mb-4"
            />
            <h1 className="text-2xl font-bold text-slate-900">
              Capturing PayPal Sandbox Payment
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Asking PayPal for the capture result and saving its response…
            </p>
          </div>
        )}

        {(status === 'error' || status === 'pending') && (
          <div className="text-center py-6">
            <AlertTriangle size={42} className="mx-auto text-rose-500 mb-4" />
            <h1 className="text-2xl font-bold text-slate-900">
              {status === 'pending'
                ? 'Capture still pending'
                : 'Capture could not be confirmed'}
            </h1>
            <p className="mt-2 text-sm text-rose-700 bg-rose-50 p-4 rounded-xl border border-rose-200">
              {status === 'pending'
                ? 'PayPal has not reported a completed capture. Review the order status before treating this payment as complete.'
                : errorMessage}
            </p>
            <div className="mt-6 flex justify-center gap-4">
              {orderId && (
                <Link
                  to={`/cases/${orderId}`}
                  className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-teal-800 hover:bg-slate-50"
                >
                  View saved record
                </Link>
              )}
              <Link
                to="/"
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div className="flex items-center gap-3 text-emerald-700 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  PayPal capture completed
                </h1>
                <p className="text-xs text-slate-500">
                  Capture response stored in the ExhibitA database
                </p>
              </div>
            </div>

            {/* Evidence Timeline */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                <Layers size={14} /> Traceable Transaction Evidence Timeline
              </h2>
              <ol className="relative border-l border-slate-200 space-y-4 ml-2">
                <li className="ml-4">
                  <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-teal-700" />
                  <p className="text-xs font-bold text-slate-800">
                    Local Sandbox order created
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">
                    Order ID: {orderId}
                  </p>
                </li>
                <li className="ml-4">
                  <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-teal-700" />
                  <p className="text-xs font-bold text-slate-800">
                    PayPal Sandbox order created
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">
                    PayPal Order ID:{' '}
                    {capturedData?.order?.paypalOrderId || 'Not recorded'}
                  </p>
                </li>
                <li className="ml-4">
                  <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-teal-700" />
                  <p className="text-xs font-bold text-slate-800">
                    PayPal reported a completed capture
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">
                    Capture status: {capturedData?.capture?.status}
                  </p>
                </li>
                <li className="ml-4">
                  <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-emerald-600" />
                  <p className="text-xs font-bold text-emerald-800">
                    Capture record stored by ExhibitA
                  </p>
                  <p className="text-[11px] font-mono text-emerald-700">
                    Capture ID: {capturedData?.capture?.paypalCaptureId} ·
                    Status: {capturedData?.capture?.status}
                  </p>
                </li>
              </ol>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              {orderId && (
                <Link
                  to={`/cases/${orderId}`}
                  className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-teal-800 hover:bg-slate-50"
                >
                  View saved record
                </Link>
              )}
              <Link
                to="/"
                className="flex items-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-900 transition shadow-sm"
              >
                Return to dashboard <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function CancelPage() {
  const [params] = useSearchParams();
  const orderId = params.get('orderId');
  return (
    <main className="evidence-outcome mx-auto max-w-lg px-6 py-16 text-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <AlertTriangle size={36} className="mx-auto text-amber-500 mb-3" />
        <h1 className="text-xl font-bold text-slate-900">
          Sandbox checkout cancelled
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          You returned from the Sandbox checkout without capturing through
          ExhibitA. Check the order list for its current status.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {orderId && (
            <Link
              to={`/cases/${orderId}`}
              className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-teal-800 hover:bg-slate-50"
            >
              View saved record
            </Link>
          )}
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

function WorkspaceStrip() {
  const isDemoCase = useMatch('/demo-case');

  return (
    <div className="sandbox-strip">
      <ShieldCheck size={16} aria-hidden="true" />
      {isDemoCase
        ? 'Controlled agent demonstration · PayPal Sandbox test transactions only.'
        : 'PayPal Sandbox environment · All transactions shown here are test transactions.'}
    </div>
  );
}

function WorkspaceNav({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav
      className={mobile ? 'mobile-nav' : 'sidebar-links'}
      aria-label={
        mobile ? 'Mobile workspace navigation' : 'Workspace navigation'
      }
    >
      <NavLink to="/" end>
        <Home size={18} aria-hidden="true" /> Overview
      </NavLink>
      <NavLink to="/demo-case">
        <FileSearch size={18} aria-hidden="true" /> Guided case
      </NavLink>
      <a href="/#purchase">
        <CreditCard size={18} aria-hidden="true" /> Test purchase
      </a>
      <a href="/#orders">
        <Layers size={18} aria-hidden="true" /> Recent orders
      </a>
      <a href="/#integrations">
        <Database size={18} aria-hidden="true" /> Integrations
      </a>
    </nav>
  );
}

function WorkspaceApp() {
  return (
    <>
      <aside className="app-sidebar" aria-label="Main navigation">
        <Link to="/" className="sidebar-brand">
          <FileSearch size={29} strokeWidth={2.5} />
          <span>ExhibitA</span>
        </Link>
        <span className="sidebar-workspace">EVIDENCE WORKSPACE</span>
        <WorkspaceNav />
        <div className="sidebar-note">
          <ShieldCheck size={18} />
          <span>
            Sandbox
            <br />
            <small>Test transactions only</small>
          </span>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <Link to="/" className="mobile-brand">
            <FileSearch size={22} />
            <span>
              ExhibitA <small>Evidence workspace</small>
            </span>
          </Link>
          <span className="topbar-title">
            Evidence workspace <small>Test Store · merchant view</small>
          </span>
          <span className="topbar-mode">
            <span aria-hidden="true" />
            Sandbox
          </span>
        </header>
        <WorkspaceNav mobile />
        <WorkspaceStrip />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/demo-case" element={<DemoCase />} />
          <Route path="/cases/:orderId" element={<SavedCase />} />
          <Route path="/return" element={<ReturnPage />} />
          <Route path="/cancel" element={<CancelPage />} />
          <Route
            path="*"
            element={
              <main className="p-12 text-center">
                Page not found.{' '}
                <Link to="/" className="underline text-blue-700 font-semibold">
                  Return to dashboard
                </Link>
              </main>
            }
          />
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/demo-store" element={<DemoStore />} />
        <Route path="*" element={<WorkspaceApp />} />
      </Routes>
    </BrowserRouter>
  );
}

const root =
  import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!);
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
