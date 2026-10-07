import { Link } from 'react-router';
import { ArrowLeft, CheckCircle2, FileSearch, Info, Shirt } from 'lucide-react';

const item = 'Real Madrid 2026 home jersey, player edition';
const shop = 'Demo Sports Shop';
const price = '$25';
const instruction = `Buy the ${item}, for ${price} from ${shop}.`;

export function DemoCase() {
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

      <p className="mt-6 flex items-start gap-2 text-xs text-slate-500">
        <FileSearch size={15} className="shrink-0" />
        This example is separate from the Sandbox transactions on the dashboard.
      </p>
    </main>
  );
}
