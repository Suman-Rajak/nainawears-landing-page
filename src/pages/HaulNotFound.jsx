import { useNavigate } from "react-router-dom";

export default function HaulNotFound() {
  const navigate = useNavigate();

  return (
    <main className="page-wrapper" style={{ background:"var(--cream-alt)", position:"relative", overflow:"hidden" }}>

      {/* Back nav */}
      <nav style={{ padding:"2rem 1.25rem 0.5rem", position:"absolute", top:0, width:"100%", zIndex:20 }}>
        <button id="back-btn-not-found" className="back-link" onClick={() => navigate("/")}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          Back
        </button>
      </nav>

      {/* Top decorative divider */}
      <div style={{ position:"absolute", top:"5.5rem", left:0, right:0, padding:"0 1.25rem", opacity:0.7 }}>
        <div className="divider-lg" />
      </div>

      {/* Center content */}
      <div style={{
        flex:1, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        padding:"0 2rem", position:"relative", zIndex:10,
        minHeight:"100vh",
      }}>
        {/* SVG illustration */}
        <div style={{ marginBottom:"2rem", position:"relative" }}>
          <div style={{ position:"absolute", inset:0, background:"rgba(243,185,56,0.1)", borderRadius:"50%", filter:"blur(32px)", transform:"scale(1.5)" }} />
          <svg
            width="140" height="140" viewBox="0 0 140 140" fill="none"
            style={{ position:"relative", zIndex:1, width:"clamp(100px,25vw,160px)", height:"auto" }}
          >
            <path d="M70 20C85 45 95 60 70 85C45 60 55 45 70 20Z" fill="#C85A48" opacity="0.9"/>
            <path d="M70 85C95 90 115 70 100 45C85 60 75 70 70 85Z" fill="#C85A48" opacity="0.9"/>
            <path d="M70 85C45 90 25 70 40 45C55 60 65 70 70 85Z" fill="#C85A48" opacity="0.9"/>
            <circle cx="70" cy="72" r="3" fill="#FDF9F1"/>
            <circle cx="62" cy="62" r="2.5" fill="#FDF9F1"/>
            <circle cx="78" cy="62" r="2.5" fill="#FDF9F1"/>
            <path d="M70 95C100 95 120 115 100 125C85 115 75 105 70 95Z" fill="#8BA896" opacity="0.9"/>
            <path d="M70 95C40 95 20 115 40 125C55 115 65 105 70 95Z" fill="#8BA896" opacity="0.9"/>
            <path d="M70 85V130" stroke="#8BA896" strokeWidth="4" strokeLinecap="round"/>
          </svg>
        </div>

        <h1 style={{
          fontFamily:"var(--font-display)", fontWeight:700,
          fontSize:"clamp(1.4rem,4vw,2rem)",
          lineHeight:1.2, textAlign:"center",
          color:"var(--brown-alt)", marginBottom:"0.625rem",
        }}>
          No haul with that<br/>number yet
        </h1>
        <p style={{ color:"var(--muted-alt)", fontSize:"clamp(14px,2vw,16px)", textAlign:"center", marginBottom:"2.5rem", maxWidth:"260px" }}>
          Check the badge on the reel to make sure it&apos;s the right number.
        </p>

        <button id="try-again-btn" className="btn-mustard" onClick={() => navigate("/")}>
          Try again
        </button>
      </div>

      {/* Bottom decorative divider */}
      <div style={{ position:"absolute", bottom:"3rem", left:0, right:0, padding:"0 1.25rem", opacity:0.7 }}>
        <div className="divider-lg" />
      </div>

    </main>
  );
}
