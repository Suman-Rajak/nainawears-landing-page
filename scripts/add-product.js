import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Parse .env manually
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  });
}

const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL;

if (!IMGBB_API_KEY || !SHEETS_WEBHOOK_URL || IMGBB_API_KEY === 'YOUR_IMGBB_KEY_HERE') {
  console.error("❌ ERROR: Missing IMGBB_API_KEY or SHEETS_WEBHOOK_URL in .env");
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("❌ Usage: npm run add-products <haul_no> <notepad_file.txt>");
  console.error("Example: npm run add-products 4 list.txt");
  process.exit(1);
}

const [haul_no, txt_file] = args;

if (!fs.existsSync(txt_file)) {
  console.error(`❌ ERROR: Notepad file not found at ${txt_file}`);
  process.exit(1);
}

// Decode the handful of HTML entities that show up in Amazon page titles
function decodeHtmlEntities(str) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (_, name) => named[name.toLowerCase()] ?? `&${name};`);
}

const MAX_NAME_LENGTH = 70;

// Turn a raw Amazon <title> (marketing copy) into a short, clean product name
function cleanProductTitle(rawTitle) {
  let title = decodeHtmlEntities(rawTitle).trim();

  title = title.split('|')[0].trim();
  title = title.replace(/^Amazon\.in\s*:\s*/i, '');
  title = title.replace(/^Buy\s+/i, '');
  title = title.replace(/\s*[-:|]?\s*(at|on)\s*Amazon\.in\.?$/i, '');

  // "Amazon Brand - X" is a fixed store label, not part of the product name
  title = title.replace(/^Amazon Brand\s*[-–—]\s*/i, '');

  // Drop a trailing parenthetical spec, e.g. "(XXL)", "(Pack of 2)"
  title = title.replace(/\s*\([^()]*\)\s*$/, '').trim();

  // A dash preceded by 4+ words usually starts marketing fluff ("... Top – Comfortable Everyday Wear").
  // A dash preceded by fewer words is likely a brand label ("Brand - Subbrand"), so leave it.
  const dashMatch = title.match(/\s[-–—]\s/);
  if (dashMatch) {
    const before = title.slice(0, dashMatch.index);
    if (before.trim().split(/\s+/).length >= 4) title = before.trim();
  }

  // Drop trailing comma-separated size/colour specs, e.g. ", Midnight Blue, Large"
  title = title.replace(/(,\s*[A-Za-z][A-Za-z\s]{0,20}){1,3}$/, '').trim();

  if (title.length > MAX_NAME_LENGTH) {
    title = title.slice(0, MAX_NAME_LENGTH).replace(/\s+\S*$/, '').trim();
  }

  return title || null;
}

// Helper to scrape product name from Amazon
async function getProductName(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = await res.text();
    const match = html.match(/<title>([^<]+)<\/title>/i);
    if (match) {
      const cleaned = cleanProductTitle(match[1]);
      if (cleaned) return cleaned;
    }
  } catch (e) {
    // Ignore fetch errors and return fallback
  }
  return "New Product";
}

async function run() {
  const lines = fs.readFileSync(txt_file, 'utf-8').split('\n').filter(l => l.trim().length > 0);
  console.log(`Found ${lines.length} products to process in Haul #${haul_no}...\n`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Split by the first space/tab
    const firstSpaceIndex = line.search(/\s/);
    if (firstSpaceIndex === -1) {
      console.error(`⚠️ Skipping line ${i+1}: Invalid format. Expected <link> <image_path>`);
      continue;
    }

    const amazon_link = line.substring(0, firstSpaceIndex).trim();
    const image_path = line.substring(firstSpaceIndex).trim();

    console.log(`\n--- Processing Product ${i+1}/${lines.length} ---`);
    console.log(`Link: ${amazon_link}`);
    console.log(`Image: ${image_path}`);

    if (!fs.existsSync(image_path)) {
      console.error(`❌ Image not found: ${image_path}. Skipping...`);
      continue;
    }

    try {
      // 1. Fetch Product Name
      console.log(`⏳ Fetching product name from Amazon...`);
      const product_name = await getProductName(amazon_link);
      console.log(`   Name: ${product_name}`);

      // 2. Compress + resize image (site only ever displays these as small thumbnails)
      const originalSize = fs.statSync(image_path).size;
      const compressedBuffer = await sharp(image_path)
        .resize({ width: 1000, withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
      console.log(`   Compressed: ${(originalSize / 1024).toFixed(0)}KB -> ${(compressedBuffer.length / 1024).toFixed(0)}KB`);

      // 3. Upload Image
      console.log(`⏳ Uploading image to Imgbb...`);
      const imageBase64 = compressedBuffer.toString('base64');
      const formData = new FormData();
      formData.append('key', IMGBB_API_KEY);
      formData.append('image', imageBase64);

      const imgbbRes = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData
      });
      if (!imgbbRes.ok) throw new Error("Imgbb API failed");
      const imgbbData = await imgbbRes.json();
      const imageUrl = imgbbData.data.url;
      console.log(`   Success: ${imageUrl}`);

      // 4. Send to Google Sheets
      console.log(`⏳ Sending to Google Sheets...`);
      const rowData = {
        haul_no,
        product_name,
        amazon_link,
        note: "",
        status: "published",
        image_url: imageUrl
      };

      const sheetRes = await fetch(SHEETS_WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify(rowData),
        headers: { 'Content-Type': 'application/json' },
        redirect: 'follow'
      });

      const sheetText = await sheetRes.text();
      if (sheetText.includes("error")) throw new Error("Sheets Webhook error: " + sheetText);

      console.log(`✅ Product ${i+1} added successfully!`);

    } catch (err) {
      console.error(`❌ FAILED on product ${i+1}: ${err.message}`);
    }
  }

  console.log(`\n🎉 All done! You can now clear ${txt_file}.\n`);
}

run();
