/* Spinner — shown while fetching data */
export function Spinner() {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"1rem", padding:"3rem 1rem", flex:1 }}>
      {/* Rotating block-print ring */}
      <div style={{
        width:48, height:48,
        border:"4px solid var(--placeholder)",
        borderTopColor:"var(--terra-alt)",
        borderRadius:"50%",
        animation:"spin 0.8s linear infinite",
      }} />
      <p style={{ fontFamily:"var(--font-display)", fontWeight:600, fontSize:14, color:"var(--muted-alt)" }}>
        Loading&hellip;
      </p>
    </div>
  );
}

/* Error banner */
export function ErrorBanner({ message, onRetry }) {
  return (
    <div style={{ margin:"1.5rem 0", background:"rgba(200,90,72,0.08)", border:"1px solid rgba(200,90,72,0.2)", borderRadius:20, padding:"1.25rem 1.5rem", display:"flex", flexDirection:"column", gap:"0.75rem" }}>
      <p style={{ fontFamily:"var(--font-display)", fontWeight:600, fontSize:17, color:"var(--terra-alt)" }}>
        Could not load data
      </p>
      <p style={{ fontSize:13, color:"var(--muted-alt)", lineHeight:1.5 }}>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-terracotta" style={{ maxWidth:160, height:40, fontSize:14 }}>
          Retry
        </button>
      )}
    </div>
  );
}

/* Tile-shaped skeleton for the haul grid */
export function TileSkeleton() {
  return <div className="skeleton" style={{ width:"100%", aspectRatio:"3/4", borderRadius:20 }} />;
}

/* Header-shaped skeleton for the haul page */
export function HaulHeaderSkeleton() {
  return (
    <div className="section-px" style={{ display:"flex", alignItems:"center", gap:"1.25rem", padding:"1rem var(--gutter) 1.75rem" }}>
      <div className="skeleton" style={{ width:96, aspectRatio:"3/4", borderRadius:18, flexShrink:0 }} />
      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:"0.6rem" }}>
        <div className="skeleton" style={{ height:10, width:"35%", borderRadius:6 }} />
        <div className="skeleton" style={{ height:26, width:"85%", borderRadius:8 }} />
        <div className="skeleton" style={{ height:20, width:"50%", borderRadius:9999 }} />
      </div>
    </div>
  );
}

/* Card-shaped skeleton for the haul product list */
export function CardSkeleton() {
  return (
    <div className="product-card" style={{ pointerEvents:"none" }}>
      <div className="skeleton product-card-thumb" />
      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:"0.5rem", paddingTop:"0.25rem" }}>
        <div className="skeleton" style={{ height:14, borderRadius:6, width:"85%" }} />
        <div className="skeleton" style={{ height:14, borderRadius:6, width:"60%" }} />
        <div className="skeleton" style={{ height:10, borderRadius:6, width:"45%" }} />
        <div className="skeleton" style={{ marginTop:"auto", height:44, borderRadius:14 }} />
      </div>
    </div>
  );
}
