#!/usr/bin/env node
/**
 * Fetches all skincare products from The Treatment Skin Boutique (Shopify)
 * via the public products.json API. No scraping – uses JSON endpoints.
 *
 * Run: node scripts/fetch-treatment-boutique-products.mjs
 *
 * Output: JSON array of { name, productUrl, imageUrl } for use in treatmentBoutiqueProducts.ts
 *
 * Manual alternative (if you need a one-off list without running the script):
 * 1. Open https://shop.getthetreatment.com/collections/all-products
 * 2. Scroll to load all products (or use "Shop all" and note the product count).
 * 3. For each product: copy the title, then open the product page and copy the URL
 *    (e.g. .../products/handle) and the main image URL (right-click image → Copy image address).
 * 4. Build entries as { name, productUrl, imageUrl } and add to treatmentBoutiqueProducts.ts.
 * 5. Or export from Shopify Admin: Products → Export (CSV has "Title", "Handle", "Image Src").
 */

const BASE = "https://shop.getthetreatment.com";
const LIMIT = 250;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function fetchAllCollectionProducts(handle = "all-products") {
  const all = [];
  let page = 1;
  while (true) {
    const url = `${BASE}/collections/${handle}/products.json?limit=${LIMIT}&page=${page}`;
    const data = await fetchJson(url);
    const products = data.products || [];
    if (products.length === 0) break;
    all.push(...products);
    if (products.length < LIMIT) break;
    page++;
  }
  return all;
}

function isSkincare(product) {
  const type = (product.product_type || "").toLowerCase();
  const vendor = (product.vendor || "").toLowerCase();
  const title = (product.title || "").toLowerCase();
  if (type.includes("skin care") || type.includes("skincare")) return true;
  if (vendor.includes("skin") || vendor.includes("treatment") || vendor.includes("skinceuticals") || vendor.includes("g.m. collin") || vendor.includes("omnilux") || vendor.includes("plated") || vendor.includes("cosmedical")) return true;
  if (title.includes("moisturizer") || title.includes("serum") || title.includes("cleanser") || title.includes("spf") || title.includes("sunscreen") || title.includes("retinol") || title.includes("mask")) return true;
  return false;
}

function excludeProduct(product) {
  const title = (product.title || "").toLowerCase();
  const vendor = (product.vendor || "").toLowerCase();
  if (title.includes("candle")) return true;
  if (title.includes("lip gloss") && vendor.includes("lip gloss boss")) return true;
  return false;
}

function toEntry(p) {
  const title = (p.title || "").trim();
  const handle = (p.handle || "").trim();
  const productUrl = handle ? `${BASE}/products/${handle}` : "";
  const img = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;
  const imageUrl = img && img.src ? img.src : undefined;
  return { name: title, productUrl: productUrl || undefined, imageUrl };
}

async function main() {
  console.error("Fetching all products from collection all-products...");
  const products = await fetchAllCollectionProducts();
  console.error(`Fetched ${products.length} products.`);

  const skincare = products.filter((p) => isSkincare(p) && !excludeProduct(p));
  const entries = skincare.map(toEntry);

  console.error(`Filtered to ${entries.length} skincare products.`);
  console.log(JSON.stringify(entries, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
