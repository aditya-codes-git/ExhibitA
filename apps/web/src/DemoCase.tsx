import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Store,
} from 'lucide-react';
import {
  createAgentCaseResponseSchema,
  createOrderResponseSchema,
  type CreateOrderResponse,
} from '@exhibita/shared';

const instruction =
  'Buy the Real Madrid 2026 home jersey, player edition, for $25 from Demo Sports Shop.';

export function DemoCase() {
  const [phase, setPhase] = useState<
    'idle' | 'creating' | 'running' | 'ready' | 'failed'
  >('idle');
  const [caseId, setCaseId] = useState('');
  const [checkout, setCheckout] = useState<CreateOrderResponse | null>(null);
  const [error, setError] = useState('');

  async function start() {
    setPhase('creating');
    setCaseId('');
    setCheckout(null);
    setError('');
    try {
      const createdResponse = await fetch('/api/agent-cases', {
        method: 'POST',
      });
      const createdBody = await createdResponse.json();
      if (!createdResponse.ok)
        throw new Error(createdBody.error || 'Could not save the case.');
      const created = createAgentCaseResponseSchema.parse(createdBody);
      setCaseId(created.orderId);
      setPhase('running');
      const runResponse = await fetch(
        `/api/agent-cases/${created.orderId}/run`,
        { method: 'POST' },
      );
      const runBody = await runResponse.json();
      if (!runResponse.ok)
        throw new Error(runBody.error || 'The agent run did not complete.');
      setCheckout(createOrderResponseSchema.parse(runBody));
      setPhase('ready');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The agent run did not complete.',
      );
      setPhase('failed');
    }
  }

  return (
    <main className="dashboard-content evidence-page">
      <div className="evidence-breadcrumb">
        <Link to="/">Workspace</Link>
        <span>/</span> Guided demonstration
      </div>
      <div className="evidence-page-heading">
        <div>
          <p className="evidence-kicker">THE CONTROLLED JOURNEY</p>
          <h1>Follow the evidence from request to payment.</h1>
          <p>
            One exact instruction. One fixed store product. A recorded agent
            lookup and PayPal Sandbox checkout that you can inspect afterward.
          </p>
        </div>
        <Link className="evidence-store-link" to="/demo-store">
          <Store size={17} /> Visit Demo Sports Shop <ArrowRight size={16} />
        </Link>
      </div>

      <div className="evidence-guided-grid">
        <section className="evidence-panel">
          <span className="evidence-step">01 / DEMO-SUBMITTED REQUEST</span>
          <h2>The buyer's exact instruction</h2>
          <blockquote>“{instruction}”</blockquote>
          <p>
            The instruction is preset for this local demo. It does not
            independently verify the buyer's identity.
          </p>
        </section>
        <section className="evidence-panel">
          <span className="evidence-step">02 / CONTROLLED PRODUCT</span>
          <h2>What the agent can inspect</h2>
          <div className="evidence-mini-product">
            <img
              src="/demo-jersey.png"
              alt="Illustrative unbranded white football jersey"
            />
            <div>
              <strong>2026 home jersey</strong>
              <span>Player edition · Demo Sports Shop</span>
              <b>$25.00 USD</b>
            </div>
          </div>
          <p>
            The agent reads the store's server product record. This is not a
            claim that it browsed an external site.
          </p>
        </section>
      </div>

      <section className="evidence-launch">
        <div>
          <span className="evidence-step">03 / RECORDED AGENT TEST</span>
          <h2>Run the Sandbox journey</h2>
          <p>
            ExhibitA saves the case first, records actual model tool calls, then
            prepares a $25 PayPal Sandbox checkout. Only a Sandbox buyer can
            approve it.
          </p>
          <div className="evidence-launch-status" role="status">
            {phase === 'creating' && 'Saving the demo case…'}
            {phase === 'running' &&
              'Agent is inspecting the product and preparing checkout…'}
            {phase === 'ready' && (
              <>
                <CheckCircle2 size={17} /> Checkout ready. Buyer approval is
                still required.
              </>
            )}
            {phase === 'idle' && (
              <>
                <FileSearch size={17} /> No case has been created yet.
              </>
            )}
            {phase === 'failed' &&
              'Run incomplete. The saved case shows any recorded steps.'}
          </div>
          {error && (
            <p className="evidence-error" role="alert">
              {error}
            </p>
          )}
          <div className="evidence-actions">
            <button
              className="evidence-primary"
              type="button"
              onClick={start}
              disabled={phase === 'creating' || phase === 'running'}
            >
              {phase === 'creating' || phase === 'running'
                ? 'Working…'
                : phase === 'failed'
                  ? 'Start a new case'
                  : 'Run recorded agent Sandbox test'}{' '}
              <ArrowRight size={17} />
            </button>
            {checkout && (
              <a
                className="evidence-secondary"
                href={checkout.approvalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Approve in PayPal Sandbox <ExternalLink size={16} />
              </a>
            )}
            {caseId && (
              <Link className="evidence-secondary" to={`/cases/${caseId}`}>
                View saved case <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
        <aside>
          <strong>Sandbox boundaries</strong>
          <p>
            No live payment, real store sale, or jersey shipment occurs. A
            prepared checkout is not a completed capture.
          </p>
        </aside>
      </section>
    </main>
  );
}
