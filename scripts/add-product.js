import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { exec } from 'child_process';
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
  console.error("❌ Usage: npm run add-product <haul_no> <notepad_file.txt>");
  console.error("Example: npm run add-product 4 list.txt");
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
    if (!res.ok) return "New Product"; // blocked/error pages have titles like "403 Forbidden"
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

// Where Gemini images are picked up from: the Downloads folder (where the Gemini
// app saves "Gemini_Generated_Image_*.png") plus any images dropped into uploads/.
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const DONE_DIR = path.resolve('uploads', 'done');
const MAX_PICKER_IMAGES = 40;

function listCandidateImages() {
  const sources = [
    { dir: process.env.IMAGE_FOLDER || path.join(os.homedir(), 'Downloads'), match: /^Gemini_Generated_Image/i },
    { dir: path.resolve('uploads'), match: /./ },
  ];
  const files = [];
  for (const { dir, match } of sources) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!IMAGE_EXT.test(name) || !match.test(name)) continue;
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isFile()) files.push({ path: full, mtime: stat.mtimeMs });
    }
  }
  return files;
}

// Each line is "<link>" (image picked automatically) or "<link> <image_path>" (explicit image)
function parseLines(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const sp = line.search(/\s/);
    return sp === -1
      ? { amazon_link: line, image_path: null, auto: true }
      : { amazon_link: line.slice(0, sp), image_path: line.slice(sp).trim(), auto: false };
  });
}

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function pickerPage(products, images) {
  const thumbs = images.map((img, j) =>
    `<button type="button" class="thumb" data-img="${j}"><img src="/img/${j}" loading="lazy" alt=""><span>${escapeHtml(img.label)}</span></button>`
  ).join('');
  const rows = products.map((p, i) => `
    <section class="row" data-row="${i}">
      <h2>${i + 1}. ${escapeHtml(p.name)}</h2>
      <a href="${escapeHtml(p.link)}" target="_blank" rel="noopener">${escapeHtml(p.link)}</a>
      <div class="strip">${thumbs}</div>
    </section>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pick product images</title>
<style>
  :root{--bg:#FDFBF7;--fg:#3A261C;--muted:#8B786D;--accent:#D16244;--card:#fff;--line:#EAE6DF}
  @media (prefers-color-scheme:dark){:root{--bg:#1f1814;--fg:#f3ebe4;--muted:#b4a59b;--card:#2a211c;--line:#3d322b}}
  body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.4 system-ui,sans-serif;padding:16px 16px 96px}
  h1{font-size:20px;margin:0 0 4px} p.hint{color:var(--muted);margin:0 0 16px}
  .row{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:14px}
  .row.done{border-color:var(--accent)}
  .row h2{font-size:16px;margin:0} .row>a{color:var(--muted);font-size:12px;word-break:break-all}
  .strip{display:flex;gap:10px;overflow-x:auto;padding:10px 0 4px}
  .thumb{flex:0 0 auto;width:120px;border:3px solid transparent;border-radius:12px;padding:0;background:none;cursor:pointer;color:var(--muted);font-size:11px}
  .thumb img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:9px;display:block;background:var(--line)}
  .thumb.sel{border-color:var(--accent)} .thumb.taken{opacity:.3}
  .bar{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-top:1px solid var(--line);padding:12px 16px;display:flex;gap:12px;align-items:center;justify-content:space-between}
  button.go{background:var(--accent);color:#fff;border:0;border-radius:10px;padding:10px 18px;font-size:15px;cursor:pointer}
  button.go:disabled{opacity:.4;cursor:default}
</style></head><body>
<h1>Pick the final image for each product</h1>
<p class="hint">Newest images first. Images you don't pick stay where they are.</p>
${rows}
<div class="bar"><span id="status"></span><button class="go" id="go" disabled>Upload</button></div>
<script>
  const total = ${products.length}, picks = {};
  const status = document.getElementById('status'), go = document.getElementById('go');
  function render() {
    const used = new Set(Object.values(picks));
    document.querySelectorAll('.row').forEach(row => {
      const r = row.dataset.row;
      row.classList.toggle('done', r in picks);
      row.querySelectorAll('.thumb').forEach(t => {
        t.classList.toggle('sel', picks[r] === t.dataset.img);
        t.classList.toggle('taken', used.has(t.dataset.img) && picks[r] !== t.dataset.img);
      });
    });
    const n = Object.keys(picks).length;
    status.textContent = n + ' of ' + total + ' picked';
    go.disabled = n < total;
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('.thumb'); if (!t) return;
    const r = t.closest('.row').dataset.row;
    if (picks[r] === t.dataset.img) delete picks[r]; else picks[r] = t.dataset.img;
    render();
  });
  go.onclick = async () => {
    go.disabled = true;
    await fetch('/submit', { method: 'POST', body: JSON.stringify(picks) });
    document.body.innerHTML = '<h1>Got it — uploading now.</h1><p class="hint">You can close this tab and watch the terminal.</p>';
  };
  render();
</script></body></html>`;
}

// Open a local page where each product gets its image clicked from the recent
// Gemini downloads — so extra attempts and download order don't matter.
async function pickImages(entries) {
  const needed = entries.filter(e => e.auto);
  if (needed.length === 0) return true;

  const explicit = new Set(entries.filter(e => !e.auto).map(e => path.resolve(e.image_path)));
  const images = listCandidateImages()
    .filter(f => !explicit.has(path.resolve(f.path)))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, MAX_PICKER_IMAGES)
    .map(f => ({ ...f, label: new Date(f.mtime).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) }));

  if (images.length < needed.length) {
    console.error(`❌ Found only ${images.length} image(s) for ${needed.length} link(s).`);
    console.error(`   Download the Gemini images to your Downloads folder (or put them in uploads/) and try again.`);
    return false;
  }

  const html = pickerPage(needed.map(e => ({ name: e.product_name, link: e.amazon_link })), images);

  const picks = await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const imgMatch = req.url.match(/^\/img\/(\d+)$/);
        if (req.method === 'GET' && req.url === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
        } else if (req.method === 'GET' && imgMatch && images[+imgMatch[1]]) {
          const thumb = await sharp(images[+imgMatch[1]].path).resize({ width: 300 }).jpeg({ quality: 70 }).toBuffer();
          res.writeHead(200, { 'Content-Type': 'image/jpeg' }).end(thumb);
        } else if (req.method === 'POST' && req.url === '/submit') {
          let body = '';
          for await (const chunk of req) body += chunk;
          res.writeHead(200).end('ok');
          server.close();
          resolve(JSON.parse(body));
        } else {
          res.writeHead(404).end();
        }
      } catch (err) {
        res.writeHead(500).end();
        console.error(`   Picker error: ${err.message}`);
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${server.address().port}/`;
      console.log(`🖼️  Pick the images in your browser: ${url}`);
      console.log(`   (waiting for you to click Upload...)`);
      openInBrowser(url);
    });
  });

  needed.forEach((e, i) => { e.image_path = images[+picks[i]].path; });
  return true;
}

function openInBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, err => { if (err) console.log(`   Couldn't open the browser — open the link above yourself.`); });
}

// Move an auto-picked image out of the way so it is never reused for another product
function archiveImage(image_path) {
  fs.mkdirSync(DONE_DIR, { recursive: true });
  const dest = path.join(DONE_DIR, `${Date.now()}-${path.basename(image_path)}`);
  try {
    fs.renameSync(image_path, dest);
  } catch {
    fs.copyFileSync(image_path, dest); // rename fails across drives (e.g. C: Downloads -> O: project)
    fs.unlinkSync(image_path);
  }
}

async function run() {
  const entries = parseLines(fs.readFileSync(txt_file, 'utf-8'));
  console.log(`Found ${entries.length} products to process in Haul #${haul_no}...\n`);

  // Fetch names up front so the picker can show which product is which
  console.log(`⏳ Fetching product names from Amazon...`);
  await Promise.all(entries.map(async e => { e.product_name = await getProductName(e.amazon_link); }));

  if (!(await pickImages(entries))) process.exit(1);

  for (let i = 0; i < entries.length; i++) {
    const { amazon_link, image_path, auto, product_name } = entries[i];

    console.log(`\n--- Processing Product ${i+1}/${entries.length} ---`);
    console.log(`Link: ${amazon_link}`);
    console.log(`Image: ${image_path}`);

    if (!fs.existsSync(image_path)) {
      console.error(`❌ Image not found: ${image_path}. Skipping...`);
      continue;
    }

    try {
      // 1. Product name (fetched before the picker)
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

      if (auto) archiveImage(image_path);
      console.log(`✅ Product ${i+1} added successfully!`);

    } catch (err) {
      console.error(`❌ FAILED on product ${i+1}: ${err.message}`);
    }
  }

  console.log(`\n🎉 All done! You can now clear ${txt_file}.\n`);
}

run();
