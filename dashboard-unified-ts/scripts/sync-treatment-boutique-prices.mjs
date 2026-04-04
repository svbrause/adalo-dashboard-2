#!/usr/bin/env node
/**
 * Updates `price` fields in treatmentBoutiqueProducts.ts from Shopify products.json
 * (same store as fetch-treatment-boutique-products.mjs).
 *
 * Primary match: product handle from `productUrl` …/products/{handle} (avoids title/apostrophe drift).
 *
 * Run from repo root:
 *   node scripts/sync-treatment-boutique-prices.mjs
 *   node scripts/sync-treatment-boutique-prices.mjs --dry-run
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const TS_PATH = path.join(
  REPO_ROOT,
  "src/components/modals/DiscussedTreatmentsModal/treatmentBoutiqueProducts.ts",
);

const BASE = "https://shop.getthetreatment.com";
const LIMIT = 250;

const dryRun = process.argv.includes("--dry-run");

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

function shopifyPrice(p) {
  const v = p.variants?.[0]?.price;
  if (v == null || v === "") return null;
  return `$${Number(v).toFixed(2)}`;
}

function normPrice(s) {
  if (s == null || s === "") return null;
  const n = Number.parseFloat(String(s).replace(/^\$/, ""));
  if (Number.isNaN(n)) return null;
  return `$${n.toFixed(2)}`;
}

function replaceFirstPriceInSlice(slice, newPrice) {
  const priceMatch = slice.match(/\n(\s*price:\s*)"([^"]*)"/);
  if (!priceMatch) return { slice, changed: false };
  const oldRaw = priceMatch[2];
  if (normPrice(oldRaw) === normPrice(newPrice)) return { slice, changed: false };
  const newSlice =
    slice.slice(0, priceMatch.index) +
    `\n${priceMatch[1]}"${newPrice}"` +
    slice.slice(priceMatch.index + priceMatch[0].length);
  return { slice: newSlice, changed: true, from: oldRaw, to: newPrice };
}

async function main() {
  console.error("Fetching Shopify products…");
  const products = await fetchAllCollectionProducts();
  const handleToPrice = new Map();
  for (const p of products) {
    const h = (p.handle || "").trim();
    const pr = shopifyPrice(p);
    if (!pr || !h) continue;
    handleToPrice.set(h, pr);
  }
  console.error(`Loaded ${handleToPrice.size} product handles with prices.`);

  let ts = fs.readFileSync(TS_PATH, "utf8");
  const report = { byHandle: [], urlNoMatch: [] };

  const productUrlRe =
    /productUrl:\s*"https:\/\/shop\.getthetreatment\.com\/products\/([a-z0-9-]+)"/g;
  const replacements = [];
  let m;
  while ((m = productUrlRe.exec(ts)) !== null) {
    const handle = m[1];
    const blockStart = m.index;
    const rest = ts.slice(blockStart);
    const nextEntry = rest.match(/\n  \{\n    name:/);
    const blockEnd = nextEntry ? blockStart + nextEntry.index : ts.length;
    const block = ts.slice(blockStart, blockEnd);
    const shopPrice = handleToPrice.get(handle);
    if (!shopPrice) {
      report.urlNoMatch.push(handle);
      continue;
    }
    const { slice, changed, from, to } = replaceFirstPriceInSlice(block, shopPrice);
    if (!changed) continue;
    replacements.push({
      start: blockStart,
      end: blockEnd,
      newBlock: slice,
      handle,
      from,
      to,
    });
  }

  replacements.sort((a, b) => b.start - a.start);
  for (const r of replacements) {
    ts = ts.slice(0, r.start) + r.newBlock + ts.slice(r.end);
    report.byHandle.push(`${r.handle}: ${normPrice(r.from)} → ${r.to}`);
  }

  console.error("\n--- Summary ---");
  console.error(`Updated by product URL handle: ${report.byHandle.length}`);
  for (const line of report.byHandle) console.error(`  ${line}`);
  if (report.urlNoMatch.length)
    console.error(
      `Handles in TS not found on Shopify (fix productUrl or add redirect in Shopify): ${[...new Set(report.urlNoMatch)].join(", ")}`,
    );

  if (!dryRun && report.byHandle.length > 0) {
    fs.writeFileSync(TS_PATH, ts, "utf8");
    console.error(`\nWrote ${TS_PATH}`);
  } else if (dryRun && report.byHandle.length > 0) {
    console.error("\nDry run: no file written.");
  } else {
    console.error("\nNo price changes needed.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
