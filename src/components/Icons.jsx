/* Small inline SVG icons shared across pages */

export function ArrowRight({ size = 18 }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

export function ArrowLeft({ size = 16 }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 12H5m6 6-6-6 6-6" />
    </svg>
  );
}

export function ArrowUpRight({ size = 16 }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export function Sparkle({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 1.5c.6 4.9 2.6 8 9.5 10.5-6.9 2.5-8.9 5.6-9.5 10.5-.6-4.9-2.6-8-9.5-10.5C9.4 9.5 11.4 6.4 12 1.5Z" />
    </svg>
  );
}

export function Heart({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.6 4.5c2.1 0 3.6 1.1 4.4 2.6.8-1.5 2.3-2.6 4.4-2.6 3.6 0 5.7 3.8 4.2 7.2C19.5 16.4 12 21 12 21Z" />
    </svg>
  );
}

/* Block-print flower — the brand motif */
export function BlockPrintMotif({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 140 140" fill="none" aria-hidden="true">
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
  );
}
