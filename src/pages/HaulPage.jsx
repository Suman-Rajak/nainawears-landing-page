import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { fetchHaul, fetchProducts } from "../lib/sheets";
import { hideOnError, optimizeImage } from "../lib/image";
import { ErrorBanner, CardSkeleton, HaulHeaderSkeleton } from "../components/Feedback";
import { ArrowLeft, ArrowUpRight, Heart, Sparkle } from "../components/Icons";

// SVG placeholder icons cycling by product index
const ICONS = [
  <svg key="a" width="48" height="60" viewBox="0 0 48 60" fill="none">
    <path d="M18 4C18 4 20 2 24 2C28 2 30 4 30 4L42 16L36 22L32 18V56C32 57.1 31.1 58 30 58H18C16.9 58 16 57.1 16 56V18L12 22L6 16L18 4Z" fill="#EAA315" opacity="0.8"/>
    <path d="M24 2L24 16" stroke="white" strokeWidth="2" strokeLinecap="round"/>
  </svg>,
  <svg key="b" width="40" height="56" viewBox="0 0 40 56" fill="none">
    <path d="M6 2H34C36.2 2 38 3.8 38 6V10L34 54H22L20 20L18 54H6L2 10V6C2 3.8 3.8 2 6 2Z" fill="#8BA896" opacity="0.8"/>
    <rect x="14" y="2" width="12" height="6" rx="2" fill="white" opacity="0.5"/>
  </svg>,
  <svg key="c" width="48" height="48" viewBox="0 0 48 48" fill="none">
    <circle cx="16" cy="24" r="8" fill="#3F2C24" opacity="0.7"/>
    <circle cx="32" cy="24" r="8" fill="#3F2C24" opacity="0.7"/>
    <path d="M16 16V8C16 8 18 4 14 4" stroke="#3F2C24" strokeWidth="2" strokeLinecap="round"/>
    <path d="M32 16V8C32 8 34 4 30 4" stroke="#3F2C24" strokeWidth="2" strokeLinecap="round"/>
    <path d="M16 32L16 40M32 32L32 40" stroke="#3F2C24" strokeWidth="2" strokeLinecap="round"/>
  </svg>,
  <svg key="d" width="52" height="40" viewBox="0 0 52 40" fill="none">
    <path d="M4 28C4 28 12 12 26 12C40 12 48 28 48 28H4Z" fill="#C85A48" opacity="0.8"/>
    <path d="M6 32H46C47.1 32 48 32.9 48 34C48 35.1 47.1 36 46 36H6C4.9 36 4 35.1 4 34C4 32.9 4.9 32 6 32Z" fill="#3F2C24" opacity="0.9"/>
    <circle cx="26" cy="18" r="4" fill="white" opacity="0.9"/>
  </svg>,
];

export default function HaulPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [retryKey, setRetryKey] = useState(0);

  // Fetch haul meta + products in parallel
  const haulFetcher    = useCallback(() => fetchHaul(id),     [id, retryKey]);
  const productFetcher = useCallback(() => fetchProducts(id),  [id, retryKey]);

  const { data: haul,     loading: haulLoading,    error: haulError    } = useFetch(haulFetcher,    [id, retryKey]);
  const { data: products, loading: prodsLoading,   error: prodsError   } = useFetch(productFetcher, [id, retryKey]);

  const loading = haulLoading || prodsLoading;
  const error   = haulError   || prodsError;

  // If haul not found after loading, redirect
  if (!loading && !error && haul === null) {
    navigate("/haul-not-found", { replace: true });
    return null;
  }

  const count = products?.length ?? 0;

  return (
    <main className="page-wrapper">

      {/* Back nav */}
      <nav className="top-bar">
        <button id="back-to-hauls" className="back-link" onClick={() => navigate("/")}>
          <ArrowLeft />
          All hauls
        </button>
      </nav>

      {/* Skeletons while loading */}
      {loading && (
        <>
          <HaulHeaderSkeleton />
          <section className="section-px haul-products-grid" style={{ marginBottom:"2rem" }}>
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </section>
        </>
      )}

      {/* Error state */}
      {error && (
        <div className="section-px">
          <ErrorBanner message={error} onRetry={() => setRetryKey(k => k+1)} />
        </div>
      )}

      {/* Loaded content */}
      {!loading && !error && haul && (
        <>
          {/* Header */}
          <header className="haul-hero">
            {haul.thumbnail && (
              <div className="haul-hero-bg" aria-hidden="true">
                <img src={optimizeImage(haul.thumbnail, 200)} decoding="async" onError={hideOnError} alt="" />
              </div>
            )}

            {/* Cover thumbnail */}
            <div className="haul-cover reveal">
              <div className="haul-cover-img">
                {haul.thumbnail ? (
                  <img src={optimizeImage(haul.thumbnail, 300)} decoding="async" onError={hideOnError} alt={haul.haul_title} />
                ) : (
                  <div style={{ width:"100%", height:"100%", position:"relative", background:"linear-gradient(135deg,#F3CF73,#D9894F)" }}>
                    <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"50%", background:"rgba(255,255,255,0.25)", borderTopLeftRadius:"50%", borderTopRightRadius:"50%" }} />
                    <div style={{ position:"absolute", top:"1rem", left:"50%", transform:"translateX(-50%)", width:"2rem", height:"2rem", borderRadius:"50%", background:"rgba(255,255,255,0.4)" }} />
                  </div>
                )}
              </div>
              <span className="haul-cover-badge">#{haul.haul_no}</span>
            </div>

            <div className="haul-meta reveal" style={{ "--i": 1 }}>
              <span className="eyebrow"><Sparkle size={12} /> Haul no. {haul.haul_no}</span>
              <h1 className="haul-title">{haul.haul_title}</h1>
              <div className="haul-meta-row">
                {haul.category && <span className="tag">{haul.category}</span>}
                <span className="meta-chip">{count} item{count !== 1 ? "s" : ""} featured</span>
              </div>
            </div>
          </header>

          {/* Divider */}
          <div className="section-px" style={{ marginBottom:"1.5rem" }}>
            <div className="divider-lg" />
          </div>

          {/* Product cards */}
          <section className="section-px haul-products-grid" style={{ marginBottom:"2.5rem" }}>
            {products && products.length > 0 ? products.map((p, i) => (
              <article key={i} id={`product-card-${i+1}`} className="product-card reveal" style={{ "--i": Math.min(i + 2, 12) }}>
                <div className="product-card-thumb">
                  {p.image_url ? (
                    <img src={optimizeImage(p.image_url, 400)} decoding="async" onError={hideOnError} alt={p.product_name} loading="lazy" />
                  ) : (
                    ICONS[i % ICONS.length]
                  )}
                  <span className="product-index">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="product-card-body">
                  <div>
                    <h2 className="product-name">{p.product_name}</h2>
                    {p.note && (
                      <p className="product-note">
                        <Sparkle size={11} />
                        <span>{p.note}</span>
                      </p>
                    )}
                  </div>
                  <a
                    id={`amazon-link-${i+1}`}
                    href={p.amazon_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-shop"
                  >
                    Shop on Amazon
                    <ArrowUpRight />
                  </a>
                </div>
              </article>
            )) : (
              <p style={{ color:"var(--muted-alt)", fontSize:14, gridColumn:"1/-1" }}>No products listed for this haul yet.</p>
            )}
          </section>

          {/* Footer */}
          <footer className="section-px site-footer">
            <p className="disclosure" style={{ justifyContent:"center" }}>
              <Heart size={14} />
              <span>As an Amazon Associate I earn from qualifying purchases.</span>
            </p>
          </footer>
        </>
      )}

    </main>
  );
}
