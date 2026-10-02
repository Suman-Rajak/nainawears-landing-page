/**
 * sheets.js
 * Fetches data from a public Google Sheet using the Sheets CSV export URL.
 * No API key required — sheet must be shared as "Anyone with the link can view".
 *
 * Sheet structure:
 *   Tab "Haul":    haul_no | haul_title | category | status | date_posted
 *   Tab "Product": haul_no | product_name | amazon_link | note | status
 */

const SHEET_ID = import.meta.env.VITE_SHEET_ID;

/** Build the CSV export URL for a named tab */
function csvUrl(tabName) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
}

/**
 * Parse a raw CSV string into an array of objects keyed by the first-row headers.
 * Handles quoted fields (including fields with commas inside).
 */
function parseCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  // Google's CSV export HTML-escapes characters like apostrophes (&#x27;) in text cells
  const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  const decodeEntities = (s) => s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (_, name) => NAMED_ENTITIES[name.toLowerCase()] ?? `&${name};`);

  // Strip surrounding quotes that Google adds to every field
  const strip = (s) => decodeEntities(s.replace(/^"|"$/g, '').replace(/""/g, '"').trim());

  // Split a CSV line respecting quoted fields
  function splitLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(strip(current));
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(strip(current));
    return result;
  }

  const headers = splitLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const values = splitLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

const MOCK_HAULS = [
  { haul_no: "12", haul_title: "My Favourite Floral Kurtis", category: "Kurtis", status: "published", date_posted: "2026-10-01", thumbnail: "https://images.unsplash.com/photo-1583391733958-d6995a5c92bf?w=400&q=80" },
  { haul_no: "11", haul_title: "Cozy Winter Sweaters", category: "Winterwear", status: "published", date_posted: "2026-09-28", thumbnail: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=400&q=80" },
  { haul_no: "10", haul_title: "Everyday Office Wear", category: "Office", status: "published", date_posted: "2026-09-20", thumbnail: "https://images.unsplash.com/photo-1485230895905-efd542603845?w=400&q=80" }
];

const MOCK_PRODUCTS = [
  { haul_no: "12", product_name: "Floral Anarkali Kurti", amazon_link: "https://amazon.in", note: "Size up for comfort", status: "published", image_url: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=200&q=80" },
  { haul_no: "12", product_name: "White Palazzo Set", amazon_link: "https://amazon.in", note: "Very breathable", status: "published", image_url: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=200&q=80" },
  { haul_no: "11", product_name: "Oversized Beige Cardigan", amazon_link: "https://amazon.in", note: "Super soft!", status: "published", image_url: "https://images.unsplash.com/photo-1588636756858-a5c9424c0423?w=200&q=80" },
  { haul_no: "10", product_name: "Straight Cut Cotton Kurta", amazon_link: "https://amazon.in", note: "True to size", status: "published", image_url: "https://images.unsplash.com/photo-1515347619152-19e31d33116f?w=200&q=80" }
];

/** Fetch and parse a single tab */
async function fetchTab(tabName) {
  if (!SHEET_ID || SHEET_ID === 'YOUR_SHEET_ID_HERE') {
    console.warn("Using demo data. Please add VITE_SHEET_ID to .env");
    return tabName === 'Haul' ? MOCK_HAULS : MOCK_PRODUCTS;
  }
  const res = await fetch(csvUrl(tabName));
  if (!res.ok) throw new Error(`Failed to fetch tab "${tabName}": ${res.status}`);
  const text = await res.text();
  return parseCsv(text);
}

/**
 * Fetch all hauls (status = "published") from the Haul tab.
 * Returns: [{ haul_no, haul_title, category, status, date_posted }, ...]
 */
export async function fetchHauls() {
  const rows = await fetchTab('Haul');
  return rows.filter(r => r.status?.toLowerCase() === 'published');
}

/**
 * Fetch all products for a given haul number.
 * Returns: [{ haul_no, product_name, amazon_link, note, status }, ...]
 */
export async function fetchProducts(haulNo) {
  const rows = await fetchTab('Product');
  return rows.filter(
    r => String(r.haul_no).trim() === String(haulNo).trim()
      && r.status?.toLowerCase() !== 'hidden'
  );
}

/**
 * Fetch one haul by its number (published only).
 * Returns the haul object or null.
 */
export async function fetchHaul(haulNo) {
  const hauls = await fetchHauls();
  return hauls.find(h => String(h.haul_no).trim() === String(haulNo).trim()) ?? null;
}
