import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Info,
  Shirt,
} from 'lucide-react';
import {
  createOrderResponseSchema,
  type CreateOrderResponse,
} from '@exhibita/shared';

const item = 'Real Madrid 2026 home jersey, player edition';
const shop = 'Demo Sports Shop';
const price = '$25';
const instruction = `Buy the ${item}, for ${price} from ${shop}.`;

export function DemoCase() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreateOrderResponse | null>(null);

  const startTest = async () => {
    setCreating(true);
    setError('');
    setCreated(null);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoCase: 'football_jersey_2026' }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not start test');
      setCreated(createOrderResponseSchema.parse(body));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start test');
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="dashboard-content">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"
      >
        <ArrowLeft size={16} /> Back to dashboard
      </Link>

      <div className="mt-8 max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800">
          <Info size={14} /> Simulated example
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Football jersey purchase
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          A simple example of a buyer giving an AI agent exact purchase
          instructions and the agent following them.
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-700">
              1
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Buyer instruction
              </p>
              <h2 className="text-lg font-bold text-slate-950">
                What the buyer asked for
              </h2>
            </div>
          </div>
          <blockquote className="mt-6 rounded-xl border-l-4 border-blue-600 bg-blue-50 p-5 text-lg font-medium leading-relaxed text-slate-900">
            {instruction}
          </blockquote>
          <p className="mt-4 text-sm text-slate-600">
            The buyer specified the item, edition, price, and demo shop.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 font-bold text-violet-700">
              2
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
                Simulated example: agent action
              </p>
              <h2 className="text-lg font-bold text-slate-950">
                What the agent did
              </h2>
            </div>
          </div>
          <div className="mt-6 flex items-start gap-4 rounded-xl bg-slate-50 p-5">
            <Shirt size={24} className="mt-1 shrink-0 text-blue-700" />
            <div>
              <p className="font-bold text-slate-950">{item}</p>
              <p className="mt-1 text-sm text-slate-600">{shop}</p>
              <p className="mt-3 text-xl font-bold text-slate-950">{price}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            The simulated checkout uses the buyer's exact selection. No real
            order was placed for this example.
          </p>
        </section>
      </div>

      <section className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
        <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
        <div>
          <h2 className="font-bold">Request and simulated action match</h2>
          <p className="mt-1 text-sm">
            Both show the same jersey, player edition, fictional shop, and $25
            price. This is a demonstration, not verified agent activity or a
            PayPal payment.
          </p>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-6">
        <h2 className="text-lg font-bold text-slate-950">
          Try this $25 request in PayPal Sandbox
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          ExhibitA will save the preset request and a clearly labeled simulated
          action. You will approve a test payment as a Sandbox buyer; this does
          not purchase a jersey from a real shop.
        </p>
        <button
          type="button"
          onClick={startTest}
          disabled={creating}
          className="mt-4 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? 'Creating Sandbox order…' : 'Start $25 Sandbox test'}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-rose-700">
            {error}
          </p>
        )}
        {created && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4 text-sm">
            <p className="font-semibold text-slate-900">Test order saved</p>
            <p className="mt-1 font-mono text-xs text-slate-500">
              Local order ID: {created.orderId}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={created.approvalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
              >
                Approve in PayPal Sandbox <ExternalLink size={15} />
              </a>
              <Link
                to={`/cases/${created.orderId}`}
                className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 font-semibold text-blue-800 hover:bg-slate-50"
              >
                View saved case
              </Link>
            </div>
          </div>
        )}
      </section>

      <p className="mt-6 flex items-start gap-2 text-xs text-slate-500">
        <FileSearch size={15} className="shrink-0" />
        Viewing this example alone does not create an order. Sandbox test cases
        appear with recent orders on the dashboard.
      </p>
    </main>
  );
}
