import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { fetchHauls } from "../lib/sheets";
import { hideOnError, optimizeImage } from "../lib/image";
import { ErrorBanner, TileSkeleton } from "../components/Feedback";
import { ArrowRight, BlockPrintMotif, Heart, Sparkle } from "../components/Icons";
import nainaAvatar from "../assets/naina-rawat.jpg";

// Fallback tile backgrounds (used when a haul has no thumbnail), cycling through brand colours
const TILE_PALETTES = [
  "linear-gradient(135deg,#E8C27A,#D9894F)",
  "linear-gradient(135deg,#A9BE9F,#6F8C63)",
  "linear-gradient(135deg,#E79A7E,#C85A48)",
  "linear-gradient(135deg,#F3CF73,#EAA315)",
  "linear-gradient(135deg,#8C6E5E,#3F2C24)",
  "linear-gradient(135deg,#C6D2B9,#8BA896)",
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

  function handleShow(e) {
    e?.preventDefault();
    const n = Number(haulNum);
    if (!n) return;
    const exists = hauls?.some(h => Number(h.haul_no) === n);
    if (exists) navigate(`/haul/${n}`);
    else navigate("/haul-not-found");
  }

  // Build category list (with counts) from sheet
  const allCats = hauls
    ? ["All", ...new Set(hauls.map(h => h.category).filter(Boolean))]
    : STATIC_CATS;
  const catCount = cat => (cat === "All" ? hauls?.length : hauls?.filter(h => h.category === cat).length) ?? 0;

  // Filter displayed tiles
  const filteredHauls = hauls
    ? (activeChip === "All" ? hauls : hauls.filter(h => h.category === activeChip))
    : [];

  // Sort descending by haul_no; the newest one gets the spotlight card
  const sortedHauls = [...filteredHauls].sort((a, b) => Number(b.haul_no) - Number(a.haul_no));
  const [latest, ...rest] = sortedHauls;

  return (
    <main className="page-wrapper">

      {/* Header */}
      <header className="profile reveal">
        <div className="avatar-ring">
          <div className="avatar">
            <img src={nainaAvatar} alt="Naina Rawat" />
          </div>
        </div>
        <h1 className="profile-name">Naina <em>Rawat</em></h1>
        <p className="tagline"><Sparkle size={14} /> Big style, small budget</p>
      </header>

      {/* Divider */}
      <div style={{ marginBottom: "1.75rem", marginTop: "0.5rem" }}><div className="divider-sm" /></div>

      {/* Lookup Card */}
      <section className="section-px reveal" style={{ marginBottom: "2.5rem", "--i": 1 }}>
        <div className="lookup">
          <BlockPrintMotif className="lookup-motif" />
          <div>
            <span className="eyebrow"><span className="live-dot" /> From the reels</span>
            <h2 className="lookup-title">Watched a haul?<br /><em>Type its number.</em></h2>
          </div>
          <form className="lookup-form" onSubmit={handleShow}>
            <label className="number-field">
              <span className="number-field-hash" aria-hidden="true">#</span>
              <input
                id="haul-number-input"
                type="number"
                inputMode="numeric"
                aria-label="Haul number"
                className="number-input"
                value={haulNum}
                onChange={e => setHaulNum(e.target.value)}
                placeholder="7"
              />
            </label>
            <button id="show-products-btn" type="submit" className="btn-glow">
              Show my products
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </section>

      {/* Hauls */}
      <section className="section-px" style={{ marginBottom: "3rem" }}>
        <div className="section-head reveal" style={{ "--i": 2 }}>
          <h2 className="section-title">All the <em>hauls</em></h2>
          {hauls && <span className="section-count">{hauls.length} haul{hauls.length !== 1 ? "s" : ""}</span>}
        </div>

        {/* Filter Chips */}
        {!loading && !error && (
          <nav aria-label="Filter by category">
            <ul className="chips-row no-scroll reveal" style={{ "--i": 3 }}>
              {allCats.map(cat => (
                <li key={cat}>
                  <button
                    id={`chip-${cat.replace(/\s+/g, "-").replace(/[^\w-]/g, "")}`}
                    className={`chip ${activeChip === cat ? "chip-active" : "chip-inactive"}`}
                    aria-pressed={activeChip === cat}
                    onClick={() => setActiveChip(cat)}
                  >
                    {cat}
                    <span className="chip-count">{catCount(cat)}</span>
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
          <div className="product-grid">
            {Array.from({ length: 4 }).map((_, i) => <TileSkeleton key={i} />)}
          </div>
        )}

        {/* Spotlight + Haul Grid */}
        {!loading && !error && (
          !latest ? (
            <p style={{ textAlign: "center", color: "var(--muted-alt)", fontSize: 14, padding: "2rem 0" }}>
              No hauls found for this category yet.
            </p>
          ) : (
            <>
              <Link
                key={`spot-${latest.haul_no}`}
                to={`/haul/${latest.haul_no}`}
                id={`haul-tile-${latest.haul_no}`}
                className="spotlight reveal"
                style={{ "--i": 4 }}
              >
                <div className="spotlight-media" style={{ background: TILE_PALETTES[0] }}>
                  {latest.thumbnail && (
                    <img src={optimizeImage(latest.thumbnail, 600)} decoding="async" onError={hideOnError} alt={latest.haul_title} />
                  )}
                  <span className="product-tile-badge">#{latest.haul_no}</span>
                </div>
                <div className="spotlight-body">
                  <span className="eyebrow"><span className="live-dot" /> Latest haul</span>
                  <h3 className="spotlight-title">{latest.haul_title}</h3>
                  {latest.category && <span className="tag">{latest.category}</span>}
                  <span className="spotlight-cta">Shop the haul <ArrowRight size={16} /></span>
                </div>
              </Link>

              {rest.length > 0 && (
                <div className="product-grid">
                  {rest.map((haul, idx) => (
                    <Link
                      key={haul.haul_no}
                      to={`/haul/${haul.haul_no}`}
                      id={`haul-tile-${haul.haul_no}`}
                      className="product-tile reveal"
                      style={{ background: TILE_PALETTES[(idx + 1) % TILE_PALETTES.length], "--i": Math.min(idx + 5, 12) }}
                    >
                      {haul.thumbnail && (
                        <img src={optimizeImage(haul.thumbnail, 400)} decoding="async" onError={hideOnError} alt={haul.haul_title} loading="lazy" />
                      )}
                      <span className="product-tile-badge">#{haul.haul_no}</span>
                      <span className="product-tile-go" aria-hidden="true"><ArrowRight size={14} /></span>
                      <div className="product-tile-info">
                        {haul.category && <p className="product-tile-cat">{haul.category}</p>}
                        <p className="product-tile-name">{haul.haul_title}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )
        )}
      </section>

      {/* Footer */}
      <footer className="section-px site-footer">
        <p className="disclosure">
          <Heart size={14} />
          <span>Some links on this page are affiliate links. If you purchase through them, I may earn a small commission at no extra cost to you. Thanks for supporting my content!</span>
        </p>
        <p className="footer-sign">— with love, Naina</p>
      </footer>

    </main>
  );
}
