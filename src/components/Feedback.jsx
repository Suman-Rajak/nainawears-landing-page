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
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* Error banner */
export function ErrorBanner({ message, onRetry }) {
  return (
    <div style={{ margin:"1.5rem 1rem", background:"rgba(200,90,72,0.08)", border:"1px solid rgba(200,90,72,0.2)", borderRadius:16, padding:"1.25rem 1.5rem", display:"flex", flexDirection:"column", gap:"0.75rem" }}>
      <p style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:15, color:"var(--terra-alt)" }}>
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

/* Tile-shaped skeleton for the product grid */
export function TileSkeleton() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"0.375rem" }}>
      <div style={{ width:"100%", aspectRatio:"2/3", borderRadius:18, background:"var(--placeholder)", animation:"pulse 1.4s ease-in-out infinite" }} />
      <div style={{ height:10, borderRadius:6, background:"var(--placeholder)", animation:"pulse 1.4s ease-in-out infinite", width:"70%" }} />
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.45}}`}</style>
    </div>
  );
}

/* Card-shaped skeleton for the haul product list */
export function CardSkeleton() {
  return (
    <div className="product-card" style={{ pointerEvents:"none" }}>
      <div style={{ width:"7rem", height:"7rem", borderRadius:12, background:"var(--placeholder)", flexShrink:0, animation:"pulse 1.4s ease-in-out infinite" }} />
      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:"0.5rem", paddingTop:"0.25rem" }}>
        <div style={{ height:14, borderRadius:6, background:"var(--placeholder)", animation:"pulse 1.4s ease-in-out infinite", width:"80%" }} />
        <div style={{ height:10, borderRadius:6, background:"var(--placeholder)", animation:"pulse 1.4s ease-in-out infinite", width:"50%" }} />
        <div style={{ marginTop:"auto", height:40, borderRadius:9999, background:"var(--placeholder)", animation:"pulse 1.4s ease-in-out infinite" }} />
      </div>
    </div>
  );
}
