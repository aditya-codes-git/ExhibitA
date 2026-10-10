import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { demoProductSchema, type DemoProduct } from '@exhibita/shared';
import { apiUrl } from './api';

export function DemoStore() {
  const [product, setProduct] = useState<DemoProduct | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    document.title = 'Home Jersey · Demo Sports Shop';
    fetch(apiUrl('/api/demo-store/product'), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Product details are unavailable.');
        return demoProductSchema.parse(await response.json());
      })
      .then(setProduct)
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Product details are unavailable.',
          );
      });
    return () => {
      controller.abort();
      document.title = 'ExhibitA';
    };
  }, []);

  return (
    <div className="demo-store">
      <div className="store-notice">
        <ShieldCheck size={15} aria-hidden="true" /> Fictional storefront ·
        PayPal Sandbox demo · No jersey shipped
      </div>
      <header className="store-header">
        <Link
          className="store-logo"
          to="/demo-store"
          aria-label="Demo Sports Shop home"
        >
          <span className="store-logo-mark">DS</span>
          <span>
            DEMO
            <br />
            SPORTS SHOP
          </span>
        </Link>
        <nav aria-label="Store navigation" className="store-nav">
          <a href="#product">The jersey</a>
          <a href="#details">Details</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <Link className="store-exhibit-link" to="/">
          <ArrowLeft size={15} aria-hidden="true" /> ExhibitA workspace
        </Link>
      </header>

      <main>
        <div className="store-breadcrumb">
          THE COLLECTION <span>/</span> 2026 HOME
        </div>
        <section
          className="store-product"
          id="product"
          aria-labelledby="store-product-title"
        >
          <div className="store-photo-wrap">
            <span className="store-photo-label">2026 / HOME COLLECTION</span>
            <img
              src="/demo-jersey.png"
              alt="Illustrative unbranded white football jersey with navy and gold trim"
              className="store-photo"
            />
            <span className="store-photo-caption">
              Illustrative product image · no official club merchandise
            </span>
          </div>
          <div className="store-product-info">
            <div className="store-eyebrow">
              <span className="store-eyebrow-line" /> MATCHDAY / 2026
            </div>
            <h1 id="store-product-title">
              The home jersey.
              <br />
              <em>Every detail matters.</em>
            </h1>
            <p className="store-product-subtitle">
              Real Madrid 2026 home jersey, player edition
            </p>
            <div className="store-price-row">
              <span className="store-price">
                {product ? `$${(product.amountMinor / 100).toFixed(2)}` : '—'}
              </span>
              <span className="store-price-note">
                USD · Sandbox test amount
              </span>
            </div>
            {error ? (
              <p className="store-error" role="alert">
                {error} Please try again later.
              </p>
            ) : !product ? (
              <p className="store-loading" role="status">
                Loading product details…
              </p>
            ) : (
              <>
                <div className="store-specs" id="details">
                  <div>
                    <span>Edition</span>
                    <strong>{product.edition}</strong>
                  </div>
                  <div>
                    <span>Product ID</span>
                    <strong>{product.productId}</strong>
                  </div>
                  <div>
                    <span>Store</span>
                    <strong>{product.shopName}</strong>
                  </div>
                </div>
                <Link to="/demo-case" className="store-cta">
                  Try AI-assisted Sandbox checkout{' '}
                  <ArrowRight size={20} aria-hidden="true" />
                </Link>
              </>
            )}
            <p className="store-cta-note">
              <ShieldCheck size={17} aria-hidden="true" /> Test payment only. No
              real jersey is purchased or delivered.
            </p>
          </div>
        </section>

        <section
          className="store-editorial"
          id="how-it-works"
          aria-labelledby="store-how-title"
        >
          <div>
            <p className="store-section-kicker">THE EXHIBITA DEMONSTRATION</p>
            <h2 id="store-how-title">
              A purchase story you can actually trace.
            </h2>
          </div>
          <div className="store-how-steps">
            <div>
              <span>01</span>
              <p>
                Start with an exact buyer instruction for this jersey and $25
                price.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                The controlled agent checks this product record and prepares a
                Sandbox checkout.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                Approve as a Sandbox buyer, then review the recorded evidence in
                ExhibitA.
              </p>
            </div>
          </div>
        </section>
        <div className="store-footnote">
          <Check size={17} aria-hidden="true" /> This is a fictional
          single-product demonstration, not a real retail offer.
        </div>
      </main>
      <footer className="store-footer">
        <span>DEMO SPORTS SHOP</span>
        <span>Built for the ExhibitA evidence demo · Sandbox only</span>
      </footer>
    </div>
  );
}
