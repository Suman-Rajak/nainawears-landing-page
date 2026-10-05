import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, BlockPrintMotif } from "../components/Icons";

export default function HaulNotFound() {
  const navigate = useNavigate();

  return (
    <main className="page-wrapper" style={{ position:"relative", overflow:"hidden" }}>

      {/* Back nav */}
      <nav className="top-bar" style={{ position:"absolute", width:"100%" }}>
        <button id="back-btn-not-found" className="back-link" onClick={() => navigate("/")}>
          <ArrowLeft />
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
        minHeight:"min(100vh, 760px)",
      }}>
        {/* Illustration */}
        <div className="reveal" style={{ marginBottom:"2rem", position:"relative" }}>
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(circle, rgba(243,185,56,0.45), rgba(209,98,68,0.15) 55%, transparent 70%)", borderRadius:"50%", filter:"blur(24px)", transform:"scale(1.6)" }} />
          <BlockPrintMotif className="float" style={{ position:"relative", zIndex:1, width:"clamp(110px,25vw,160px)", height:"auto" }} />
        </div>

        <span className="eyebrow reveal" style={{ color:"var(--terra-alt)", marginBottom:"0.75rem", "--i": 1 }}>Hmm, nothing here</span>
        <h1 className="reveal" style={{
          fontFamily:"var(--font-display)", fontWeight:600,
          fontSize:"clamp(1.9rem,6vw,2.6rem)", letterSpacing:"-0.03em",
          lineHeight:1.05, textAlign:"center",
          color:"var(--ink)", marginBottom:"0.75rem", "--i": 2,
        }}>
          No haul with that<br/><em style={{ fontWeight:500, color:"var(--terra-alt)" }}>number yet</em>
        </h1>
        <p className="reveal" style={{ color:"var(--muted-alt)", fontSize:"clamp(14px,2vw,16px)", lineHeight:1.5, textAlign:"center", marginBottom:"2.25rem", maxWidth:"280px", "--i": 3 }}>
          Check the badge on the reel to make sure it&apos;s the right number.
        </p>

        <button id="try-again-btn" className="btn-glow reveal" onClick={() => navigate("/")} style={{ flex:"none", "--i": 4 }}>
          Try again
          <ArrowRight size={18} />
        </button>
      </div>

      {/* Bottom decorative divider */}
      <div style={{ position:"absolute", bottom:"3rem", left:0, right:0, padding:"0 1.25rem", opacity:0.7 }}>
        <div className="divider-lg" />
      </div>

    </main>
  );
}
