import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useMatch,
  useNavigate,
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
import { readinessSchema, type Readiness } from '@exhibita/shared';
import { DemoCase } from './DemoCase';
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

function StatusBadge({ status }: { status: string }) {
  if (status === 'COMPLETED' || status === 'PAYPAL_COMPLETED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800 border border-blue-200">
        <CheckCircle2 size={13} className="text-blue-600" />
        Captured
      </span>
    );
  }
  if (status === 'PAYPAL_ORDER_CREATED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800 border border-blue-200">
        <Clock size={13} className="text-blue-600" />
        Awaiting Buyer Approval
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
      {status}
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

  const isConfigured =
    readiness?.database === 'connected' &&
    readiness?.paypal !== 'not_configured';

  const completedOrders = orders.filter(
    (order) => order.status === 'COMPLETED',
  );

  return (
    <main className="dashboard-content">
      {/* Hero Header */}
      <div className="mb-10">
        <p className="text-sm font-semibold text-blue-700">
          Merchant workspace / Overview
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Transaction overview
        </h1>
        <p className="mt-3 max-w-3xl text-base text-slate-600 leading-relaxed">
          Review recent Sandbox orders, check your integrations, and follow a
          payment from checkout to its stored capture.
        </p>
      </div>

      <section className="mb-10" aria-labelledby="quick-access-heading">
        <h2
          id="quick-access-heading"
          className="mb-5 text-lg font-bold text-slate-950"
        >
          Quick access
        </h2>
        <div className="quick-actions">
          <a href="#purchase">
            <span>
              <CreditCard size={23} />
            </span>
            Test purchase
          </a>
          <a href="#orders">
            <span>
              <Layers size={23} />
            </span>
            Recent orders
          </a>
          <a href="#integrations">
            <span>
              <Database size={23} />
            </span>
            Integrations
          </a>
        </div>
      </section>

      <section className="mb-10" aria-labelledby="activity-heading">
        <h2
          id="activity-heading"
          className="mb-5 text-lg font-bold text-slate-950"
        >
          Recent activity
        </h2>
        <div className="overview-cards">
          <div>
            <p>Orders in view</p>
            <strong>{ordersLoaded ? orders.length : '—'}</strong>
            <small>Latest 20 records</small>
          </div>
          <div>
            <p>Captured in view</p>
            <strong>{ordersLoaded ? completedOrders.length : '—'}</strong>
            <small>Completed orders</small>
          </div>
          <div>
            <p>Captured value in view</p>
            <strong>
              {ordersLoaded
                ? formatCurrency(
                    completedOrders.reduce(
                      (sum, order) => sum + order.amountMinor,
                      0,
                    ),
                  )
                : '—'}
            </strong>
            <small>USD · latest 20 records</small>
          </div>
        </div>
      </section>

      {/* Integration Readiness Bar */}
      <section
        id="integrations"
        className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        aria-labelledby="system-status-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Database size={20} />
            </div>
            <div>
              <h2
                id="system-status-heading"
                className="text-base font-bold text-slate-900"
              >
                Environment & Integration Readiness
              </h2>
              <p className="text-xs text-slate-500">
                Database connectivity and Sandbox credential configuration
              </p>
            </div>
          </div>
          <button
            onClick={() => setAttempt((v) => v + 1)}
            disabled={isChecking}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
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

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
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

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
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

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <span className="text-xs font-medium text-slate-500">
              Payment Pipeline
            </span>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isConfigured ? 'bg-blue-600' : 'bg-slate-400'
                }`}
              />
              <span className="text-sm font-semibold text-slate-900">
                {isConfigured ? 'Ready to test' : 'Pending configuration'}
              </span>
            </div>
          </div>
        </div>

        {!isConfigured && (
          <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-900 leading-relaxed">
            <p className="font-semibold mb-1">
              Configuration required in local{' '}
              <code className="bg-blue-100 px-1 py-0.5 rounded">.env</code>:
            </p>
            <p>
              {readiness?.database !== 'connected' && (
                <>
                  Set <code className="font-mono">DATABASE_URL</code> to the
                  Supabase session pooler URI.{' '}
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
                'PayPal credentials are configured but have not been verified.'}
            </p>
          </div>
        )}
      </section>

      {/* Two Column Layout: Purchase Simulator & Live Evidence Stream */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Purchase Trigger */}
        <section
          id="purchase"
          className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between"
          aria-labelledby="simulate-purchase-heading"
        >
          <div>
            <div className="flex items-center gap-2.5 text-slate-900 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <CreditCard size={18} />
              </div>
              <h2 id="simulate-purchase-heading" className="text-lg font-bold">
                PayPal Sandbox Purchase
              </h2>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Create a manual test order and approve it as a Sandbox buyer.
              Agent activity is not recorded in this flow.
            </p>

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
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
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
                    className="w-full rounded-xl border border-slate-200 pl-8 pr-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
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
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-700 py-3 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* Result after creation */}
          {createdOrderResult && (
            <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-xs">
              <div className="flex items-center gap-2 font-bold text-blue-900 mb-2">
                <CheckCircle2 size={16} className="text-blue-700" />
                PayPal Order Initialized
              </div>
              <p className="text-blue-800 mb-2">
                Order ID:{' '}
                <code className="font-mono">
                  {createdOrderResult.paypalOrderId}
                </code>
              </p>
              <a
                href={createdOrderResult.approvalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-800 transition shadow-sm"
              >
                Approve via PayPal Sandbox <ExternalLink size={13} />
              </a>
            </div>
          )}
        </section>

        {/* Right: Traceable Evidence Timeline / Orders Explorer */}
        <section
          id="orders"
          className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          aria-labelledby="recent-transactions-heading"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                <Layers size={18} />
              </div>
              <div>
                <h2
                  id="recent-transactions-heading"
                  className="text-lg font-bold text-slate-900"
                >
                  Recent Sandbox orders
                </h2>
                <p className="text-xs text-slate-500">
                  Supabase private schema:{' '}
                  <code className="font-mono text-blue-700">exhibita</code>
                </p>
              </div>
            </div>
            <button
              onClick={refreshOrders}
              disabled={loadingOrders}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw
                size={12}
                className={loadingOrders ? 'animate-spin' : ''}
              />
              Refresh
            </button>
          </div>

          {ordersError ? (
            <p
              role="alert"
              className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
            >
              {ordersError}
            </p>
          ) : !ordersLoaded ? (
            <div className="py-12 text-center">
              <Database size={36} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">
                Connect Supabase to load orders
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
                Recent Sandbox orders will appear after the database connection
                is available.
              </p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center">
              <FileSearch size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700">
                No orders recorded yet
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Orders and their PayPal capture references will appear here
                after a Sandbox checkout.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const capture = order.captures?.[0];
                return (
                  <div
                    key={order.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:border-slate-300"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-900">
                          {formatCurrency(order.amountMinor, order.currency)}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                      <span className="text-xs font-mono text-slate-500">
                        {new Date(order.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-200/60 font-mono">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">
                          Local Order ID
                        </span>
                        <span className="truncate block">{order.id}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">
                          PayPal Order ID
                        </span>
                        <span>{order.paypalOrderId || 'Pending'}</span>
                      </div>
                      {capture && (
                        <div className="sm:col-span-2 bg-emerald-50/70 border border-emerald-200/60 rounded-lg p-2.5 text-emerald-950 font-sans mt-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="flex items-center gap-1.5 text-emerald-800">
                              <ShieldCheck
                                size={14}
                                className="text-emerald-600"
                              />
                              Capture stored in Supabase
                            </span>
                            <span className="font-mono text-[11px] text-emerald-700">
                              Capture ID: {capture.paypalCaptureId}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
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
  const navigate = useNavigate();
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
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {status === 'capturing' && (
          <div className="text-center py-8">
            <RefreshCw
              size={36}
              className="mx-auto text-blue-600 animate-spin mb-4"
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
                  <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-blue-600" />
                  <p className="text-xs font-bold text-slate-800">
                    Step 1: Local test order created
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">
                    Order ID: {orderId}
                  </p>
                </li>
                <li className="ml-4">
                  <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-blue-600" />
                  <p className="text-xs font-bold text-slate-800">
                    Step 2: PayPal Order Created with Request Idempotency
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">
                    PayPal Order ID:{' '}
                    {token || capturedData?.order?.paypalOrderId}
                  </p>
                </li>
                <li className="ml-4">
                  <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-blue-600" />
                  <p className="text-xs font-bold text-slate-800">
                    Step 3: PayPal reported a completed capture
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">
                    Capture status: {capturedData?.capture?.status}
                  </p>
                </li>
                <li className="ml-4">
                  <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-emerald-600" />
                  <p className="text-xs font-bold text-emerald-800">
                    Step 4: Capture record stored in exhibita.Capture
                  </p>
                  <p className="text-[11px] font-mono text-emerald-700">
                    Capture ID: {capturedData?.capture?.paypalCaptureId} ·
                    Status: {capturedData?.capture?.status}
                  </p>
                </li>
              </ol>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800 transition shadow-sm"
              >
                Return to Dashboard <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function CancelPage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-16 text-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <AlertTriangle size={36} className="mx-auto text-amber-500 mb-3" />
        <h1 className="text-xl font-bold text-slate-900">
          Payment Cancelled by Buyer
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          You returned from the Sandbox checkout without capturing through
          ExhibitA. Check the order list for its current status.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
        >
          Return to Dashboard
        </Link>
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
        ? 'This is a simulated example. No PayPal payment or order was created.'
        : 'You’re viewing test transactions in PayPal Sandbox.'}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <aside className="app-sidebar" aria-label="Main navigation">
        <Link to="/" className="sidebar-brand">
          <FileSearch size={29} strokeWidth={2.5} />
          <span>ExhibitA</span>
        </Link>
        <span className="sidebar-workspace">DEVELOPER WORKSPACE</span>
        <nav className="sidebar-links" aria-label="Workspace">
          <Link to="/">
            <Home size={19} />
            Overview
          </Link>
          <Link to="/demo-case">
            <FileSearch size={19} />
            Simulated case
          </Link>
          <a href="/#purchase">
            <CreditCard size={19} />
            Test purchase
          </a>
          <a href="/#orders">
            <Layers size={19} />
            Recent orders
          </a>
          <a href="/#integrations">
            <Database size={19} />
            Integrations
          </a>
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={18} />
          <span>
            Sandbox workspace
            <br />
            <small>Test transactions only</small>
          </span>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <Link to="/" className="mobile-brand">
            <FileSearch size={22} />
            ExhibitA
          </Link>
          <span className="topbar-title">
            Test Store <small>ExhibitA merchant dashboard</small>
          </span>
          <span className="topbar-mode">
            <span aria-hidden="true" />
            Sandbox mode
          </span>
        </header>
        <WorkspaceStrip />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/demo-case" element={<DemoCase />} />
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
