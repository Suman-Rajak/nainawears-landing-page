import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { fetchHaul, fetchProducts } from "../lib/sheets";
import { Spinner, ErrorBanner, CardSkeleton } from "../components/Feedback";

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

  return (
    <main className="page-wrapper" style={{ background:"var(--cream-alt)" }}>

      {/* Back nav */}
      <nav className="back-nav">
        <button id="back-to-hauls" className="back-link" onClick={() => navigate("/")}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          All hauls
        </button>
      </nav>

      {/* Header skeleton while loading */}
      {loading && <Spinner />}

      {/* Error state */}
      {error && <ErrorBanner message={error} onRetry={() => setRetryKey(k => k+1)} />}

      {/* Loaded content */}
      {!loading && !error && haul && (
        <>
          {/* Header */}
          <header className="section-px" style={{ marginTop:"1rem", marginBottom:"1.25rem", display:"flex", alignItems:"center", gap:"1rem" }}>
            {/* Cover thumbnail */}
            <div style={{ width:"5rem", height:"7rem", position:"relative", flexShrink:0, overflow:"visible" }}>
              {haul.thumbnail ? (
                <img src={haul.thumbnail} alt={haul.haul_title} style={{ width:"100%", height:"100%", borderRadius:"1rem", objectFit:"cover", boxShadow:"0 2px 12px rgba(58,38,28,0.1)", border:"1px solid rgba(0,0,0,0.05)" }} loading="lazy" />
              ) : (
                <div style={{ width:"100%", height:"100%", borderRadius:"1rem", background:"var(--placeholder)", position:"relative", overflow:"hidden", boxShadow:"0 2px 12px rgba(58,38,28,0.1)", border:"1px solid rgba(0,0,0,0.05)" }}>
                  <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"50%", background:"rgba(234,163,21,0.3)", borderTopLeftRadius:"50%", borderTopRightRadius:"50%" }} />
                  <div style={{ position:"absolute", top:"1rem", left:"50%", transform:"translateX(-50%)", width:"2rem", height:"2rem", borderRadius:"50%", background:"rgba(139,168,150,0.4)" }} />
                </div>
              )}
              <div style={{ position:"absolute", top:"-0.25rem", right:"-0.25rem", background:"var(--sage-alt)", color:"#fff", fontFamily:"var(--font-display)", fontWeight:700, fontSize:"0.85rem", width:"2rem", height:"2rem", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid var(--cream-alt)", zIndex:10, boxShadow:"0 1px 4px rgba(0,0,0,0.1)" }}>
                #{haul.haul_no}
              </div>
            </div>

            <div>
              <h1 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"clamp(1.5rem,5vw,2.25rem)", lineHeight:1.1, color:"var(--brown-alt)", marginBottom:"0.35rem" }}>
                {haul.haul_title}
              </h1>
              <p style={{ color:"var(--muted-alt)", fontSize:"0.875rem", fontWeight:500 }}>
                {products?.length ?? 0} item{products?.length !== 1 ? "s" : ""} featured
              </p>
              {haul.category && (
                <span style={{ display:"inline-block", marginTop:"0.4rem", background:"rgba(138,162,127,0.15)", color:"var(--sage)", border:"1px solid rgba(138,162,127,0.3)", borderRadius:9999, padding:"2px 10px", fontSize:12, fontWeight:600 }}>
                  {haul.category}
                </span>
              )}
            </div>
          </header>

          {/* Divider */}
          <div className="section-px" style={{ marginBottom:"1.5rem" }}>
            <div className="divider-lg" />
          </div>

          {/* Product cards */}
          <section className="section-px haul-products-grid" style={{ marginBottom:"2rem" }}>
            {products && products.length > 0 ? products.map((p, i) => (
              <article key={i} id={`product-card-${i+1}`} className="product-card">
                <div className="product-card-thumb">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.product_name} style={{ width:"100%", height:"100%", objectFit:"cover" }} loading="lazy" />
                  ) : (
                    ICONS[i % ICONS.length]
                  )}
                </div>
                <div className="product-card-body">
                  <div>
                    <h2 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"clamp(1rem,2.5vw,1.2rem)", lineHeight:1.2, color:"var(--brown-alt)" }}>
                      {p.product_name}
                    </h2>
                    {p.note && (
                      <p style={{ color:"var(--muted-alt)", fontSize:"0.75rem", marginTop:"0.25rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {p.note}
                      </p>
                    )}
                  </div>
                  <a
                    id={`amazon-link-${i+1}`}
                    href={p.amazon_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-terracotta"
                    style={{ marginTop:"0.75rem", textDecoration:"none" }}
                  >
                    View on Amazon
                  </a>
                </div>
              </article>
            )) : (
              <p style={{ color:"var(--muted-alt)", fontSize:14, gridColumn:"1/-1" }}>No products listed for this haul yet.</p>
            )}
          </section>

          {/* Footer */}
          <footer className="section-px" style={{ paddingBottom:"2.5rem", textAlign:"center" }}>
            <p style={{ fontSize:"11px", color:"var(--muted-alt)", fontWeight:500, lineHeight:1.6, maxWidth:"320px", margin:"0 auto" }}>
              As an Amazon Associate I earn from qualifying purchases.
            </p>
          </footer>
        </>
      )}

    </main>
  );
}
