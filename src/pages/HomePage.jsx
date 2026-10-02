import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { fetchHauls } from "../lib/sheets";
import { optimizeImage } from "../lib/image";
import { Spinner, ErrorBanner, TileSkeleton } from "../components/Feedback";
import nainaAvatar from "../assets/naina-rawat.jpg";

// Tile colour palette cycling through brand colours
const TILE_PALETTES = [
  { bg: "linear-gradient(135deg,#E8E4D9,#DFD9CA)", accent: "rgba(58,38,28,0.05)" },
  { bg: "linear-gradient(135deg,rgba(138,162,127,0.2),rgba(138,162,127,0.4))", accent: "rgba(138,162,127,0.15)" },
  { bg: "linear-gradient(135deg,rgba(209,98,68,0.1),rgba(209,98,68,0.3))", accent: "rgba(209,98,68,0.1)" },
  { bg: "linear-gradient(135deg,rgba(243,185,56,0.2),rgba(243,185,56,0.4))", accent: "rgba(243,185,56,0.15)" },
  { bg: "linear-gradient(135deg,rgba(58,38,28,0.06),rgba(58,38,28,0.18))", accent: "rgba(58,38,28,0.04)" },
  { bg: "linear-gradient(135deg,rgba(138,162,127,0.1),rgba(138,162,127,0.3))", accent: "rgba(138,162,127,0.1)" },
];

// Category chips derived from sheet data + a static "All" chip
const STATIC_CATS = ["All"];

export default function HomePage() {
  const [haulNum, setHaulNum] = useState("");
  const [activeChip, setActiveChip] = useState("All");
  const navigate = useNavigate();

  // Re-fetchable hauls
  const [fetchKey, setFetchKey] = useState(0);
  const fetcher = useCallback(() => fetchHauls(), [fetchKey]);
  const { data: hauls, loading, error } = useFetch(fetcher, [fetchKey]);

  function handleShow() {
    const n = Number(haulNum);
    if (!n) return;
    const exists = hauls?.some(h => Number(h.haul_no) === n);
    if (exists) navigate(`/haul/${n}`);
    else navigate("/haul-not-found");
  }

  // Build category list from sheet
  const allCats = hauls
    ? ["All", ...new Set(hauls.map(h => h.category).filter(Boolean))]
    : STATIC_CATS;

  // Filter displayed tiles
  const filteredHauls = hauls
    ? (activeChip === "All" ? hauls : hauls.filter(h => h.category === activeChip))
    : [];

  // Sort descending by haul_no
  const sortedHauls = [...filteredHauls].sort((a, b) => Number(b.haul_no) - Number(a.haul_no));

  return (
    <main className="page-wrapper">

      {/* Header */}
      <header style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "clamp(1.5rem,5vw,3rem)", paddingBottom: "1rem", paddingLeft: "1.5rem", paddingRight: "1.5rem", textAlign: "center" }}>
        <div className="avatar" style={{ marginBottom: "1rem" }}>
          <img src={nainaAvatar} alt="Naina Rawat" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.4rem,4vw,2rem)", letterSpacing: "-0.02em", marginBottom: "0.25rem" }}>Naina Rawat</h1>
        <p style={{ color: "var(--muted)", fontSize: "clamp(13px,2.5vw,16px)", fontWeight: 500 }}>Big style, small budget</p>
      </header>

      {/* Divider */}
      <div style={{ marginBottom: "1.5rem", marginTop: "0.5rem" }}><div className="divider-sm" /></div>

      {/* Hero Card */}
      <section className="section-px" style={{ marginBottom: "2rem" }}>
        <div className="hero-card">
          <div className="hero-card-text" style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.1rem,3vw,1.4rem)", textAlign: "center", marginBottom: "1.25rem", color: "var(--brown-alt)", letterSpacing: "-0.01em" }}>
              Watched a haul?<br />Type its number
            </h2>
          </div>
          <div className="hero-card-controls" style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <input
              id="haul-number-input"
              type="number"
              className="number-input"
              value={haulNum}
              onChange={e => setHaulNum(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleShow()}
              placeholder="7"
            />
            <button id="show-products-btn" className="btn-primary" onClick={handleShow} style={{ maxWidth: "280px" }}>
              Show my products
              <svg style={{ width: "1.25rem", height: "1.25rem", opacity: 0.8 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Filter Chips */}
      {!loading && !error && (
        <nav style={{ marginBottom: "1.5rem" }}>
          <ul className="chips-row no-scroll" style={{ listStyle: "none" }}>
            {allCats.map(cat => (
              <li key={cat}>
                <button
                  id={`chip-${cat.replace(/\s+/g, "-").replace(/[^\w-]/g, "")}`}
                  className={`chip ${activeChip === cat ? "chip-active" : "chip-inactive"}`}
                  onClick={() => setActiveChip(cat)}
                >
                  {cat}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Error */}
      {error && <ErrorBanner message={error} onRetry={() => setFetchKey(k => k + 1)} />}

      {/* Loading skeletons */}
      {loading && (
        <section className="section-px" style={{ marginBottom: "2.5rem" }}>
          <div className="product-grid">
            {Array.from({ length: 6 }).map((_, i) => <TileSkeleton key={i} />)}
          </div>
        </section>
      )}

      {/* Haul Grid */}
      {!loading && !error && (
        <section className="section-px" style={{ marginBottom: "2.5rem" }}>
          {sortedHauls.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--muted-alt)", fontSize: 14, padding: "2rem 0" }}>
              No hauls found for this category yet.
            </p>
          ) : (
            <div className="product-grid">
              {sortedHauls.map((haul, idx) => {
                const palette = TILE_PALETTES[idx % TILE_PALETTES.length];
                return (
                  <a
                    key={haul.haul_no}
                    id={`haul-tile-${haul.haul_no}`}
                    className="product-tile"
                    onClick={() => navigate(`/haul/${haul.haul_no}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="product-tile-img" style={{ background: palette.bg }}>
                      {haul.thumbnail ? (
                        <img src={optimizeImage(haul.thumbnail, 400)} decoding="async" alt={haul.haul_title} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                      ) : (
                        <div style={{ position: "absolute", inset: 0, opacity: 0.1, background: `radial-gradient(circle at center, ${palette.accent}, transparent)` }} />
                      )}
                      <span className="product-tile-badge">#{haul.haul_no}</span>
                    </div>
                    <p className="product-tile-name">{haul.haul_title}</p>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Footer */}
      <footer className="section-px" style={{ paddingBottom: "3rem", marginTop: "auto" }}>
        <p style={{ textAlign: "center", fontSize: "11px", color: "rgba(139,120,109,0.7)", fontWeight: 500, lineHeight: 1.6 }}>
          Some links on this page are affiliate links. If you purchase through them, I may earn a small commission at no extra cost to you. Thanks for supporting my content!
        </p>
      </footer>

    </main>
  );
}
