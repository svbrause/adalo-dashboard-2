#!/usr/bin/env node
/**
 * Resolves thumbnail image URLs for Slim Studio + Gravitas skincare catalogs.
 * Uses public Shopify products.json APIs (no scraping).
 *
 * Run: node scripts/fetch-provider-skincare-images.mjs
 */

const SHOPIFY_STORES = [
  { key: "hydrinity", base: "https://hydrinity.com" },
  { key: "oliviaquido", base: "https://oliviaquido.com" },
  { key: "cleopatra", base: "https://essenceofcleopatra.com" },
  { key: "primocyn", base: "https://primocyn.com" },
  { key: "skinade", base: "https://us.skinade.com" },
  { key: "gravitas", base: "https://www.gravitasmedspa.com" },
  { key: "violetgrey", base: "https://www.violetgrey.com" },
];

async function fetchAllProducts(base) {
  const all = [];
  let page = 1;
  while (true) {
    const url = `${base}/products.json?limit=250&page=${page}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) break;
    const data = await res.json();
    const products = data.products || [];
    if (products.length === 0) break;
    all.push(...products);
    if (products.length < 250) break;
    page++;
  }
  return all;
}

function norm(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findImage(products, ...needles) {
  const targets = needles.map(norm);
  for (const p of products) {
    const title = norm(p.title);
    if (targets.every((t) => title.includes(t))) {
      return { title: p.title, imageUrl: p.images?.[0]?.src, handle: p.handle };
    }
  }
  for (const p of products) {
    const title = norm(p.title);
    if (targets.some((t) => title.includes(t))) {
      return { title: p.title, imageUrl: p.images?.[0]?.src, handle: p.handle };
    }
  }
  return null;
}

/** Manual ISDIN handles on Violet Grey (retailer CDN mirrors official pack shots). */
const ISDIN_VG_HANDLES = {
  isdinActinica: "isdin-isdin-eryfotona-actinica-spf-50",
  isdinAgeless: "isdin-eryfotona-ageless-tinted-mineral-sunscreen-spf-50",
  isdinMelatonik: "isdin-melatonik-3-in-1-night-serum",
  isdinRetinol: "isdin-isdin-retinal-advanced",
  isdinMelaclear: "isdin-melaclear-advanced-serum",
  isdinHyaluronic: "isdin-hyaluronic-concentrate-serum",
  isdinAgeContourDay: "isdin-age-contour-cream",
  isdinAgeContourNight: "isdin-age-contour-night-cream",
  isdinVitalEyes: "isdin-vital-eyes-eye-cream",
};

async function fetchVioletGreyIsdin() {
  const out = {};
  for (const [key, handle] of Object.entries(ISDIN_VG_HANDLES)) {
    const url = `https://www.violetgrey.com/products/${handle}.json`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) {
      out[key] = { error: res.status, handle };
      continue;
    }
    const data = await res.json();
    out[key] = {
      title: data.product?.title,
      imageUrl: data.product?.images?.[0]?.src,
      handle,
    };
  }
  return out;
}

async function main() {
  const catalog = {};
  for (const { key, base } of SHOPIFY_STORES) {
    try {
      catalog[key] = await fetchAllProducts(base);
      console.error(`${key}: ${catalog[key].length} products`);
    } catch (e) {
      console.error(`${key}: ${e.message}`);
      catalog[key] = [];
    }
  }

  const h = catalog.hydrinity;
  const oq = catalog.oliviaquido;
  const cl = catalog.cleopatra;
  const pr = catalog.primocyn;
  const sk = catalog.skinade;
  const gv = catalog.gravitas;

  const isdin = await fetchVioletGreyIsdin();

  const map = {
    slimStudio: {
      ...Object.fromEntries(
        Object.entries(isdin).map(([k, v]) => [k, v.imageUrl || null]),
      ),
      hydrinityHaSerum: findImage(h, "restorative", "ha serum")?.imageUrl,
      hydrinityMasque: findImage(h, "ha", "masque")?.imageUrl,
      hydrinityHyacin: findImage(h, "hyacyn")?.imageUrl,
      hydrinityVivid: findImage(h, "vivid")?.imageUrl,
      hydrinityEncore: findImage(h, "encore")?.imageUrl,
      hydrinityKit: findImage(h, "restorative kit")?.imageUrl,
      skinade: findImage(sk, "30 day course")?.imageUrl,
    },
    gravitas: {
      skinVitalizingCleanser: findImage(gv, "skin vitalizing cleanser")?.imageUrl,
      skinVitalizingToner: findImage(gv, "skin vitalizing toner")?.imageUrl,
      luminousOilCleanser: findImage(gv, "luminous oil cleanser")?.imageUrl,
      oilControlCleanser: findImage(gv, "oil control cleanser")?.imageUrl,
      oilControlToner: findImage(gv, "oil control toner")?.imageUrl,
      powerhouseVitC: findImage(gv, "powerhouse")?.imageUrl,
      biomeBalance: findImage(gv, "biome balance")?.imageUrl,
      glassSkinSerum: findImage(gv, "glass skin")?.imageUrl,
      cellRepair: findImage(gv, "cell repair")?.imageUrl,
      silkySmoothPlus: findImage(gv, "silky smooth")?.imageUrl,
      exoluxCream: findImage(gv, "exolux")?.imageUrl,
      uvProtectTint: findImage(gv, "uv protect")?.imageUrl,
      matteZincSpf: findImage(gv, "matte tinted zinc")?.imageUrl,
      zincSpf: findImage(gv, "zinc uv defense")?.imageUrl,
      freshlookEye: findImage(gv, "freshlook")?.imageUrl,
      blemishCorrector: findImage(gv, "blemish corrector")?.imageUrl,
      acneEraseCream: findImage(gv, "acne erase")?.imageUrl,
      pumiceScrub: findImage(gv, "pumice scrub")?.imageUrl,
      sulfurMask: findImage(gv, "sulfur mask")?.imageUrl,
      pumpkinMask: findImage(gv, "pumpkin")?.imageUrl,
      cleansingMilk: findImage(oq, "cleansing milk")?.imageUrl,
      balancingToner: findImage(oq, "balancing toner")?.imageUrl,
      activeMoisturizer: findImage(oq, "active moisturizer")?.imageUrl,
      vitaminCSerum20: findImage(oq, "vitamin c serum 20")?.imageUrl,
      bhaEssence: findImage(oq, "bha exfoliating")?.imageUrl,
      broadSpectrumSpf50: findImage(oq, "broad spectrum sunscreen spf 50")?.imageUrl,
      secretPearl: findImage(oq, "secret pearl")?.imageUrl,
      secretRadiance: findImage(oq, "secret radiance")?.imageUrl,
      secretGold: findImage(oq, "secret gold")?.imageUrl,
      secretGlow: findImage(oq, "secret glow")?.imageUrl,
      beautyOil: findImage(oq, "beauty oil")?.imageUrl,
      ff1: findImage(oq, "ff1")?.imageUrl,
      ff2: findImage(oq, "ff2")?.imageUrl,
      youthSerumElixir: findImage(cl, "youth serum elixir")?.imageUrl,
      acneBlend: findImage(cl, "acne blend")?.imageUrl,
      primocynHydrogel: findImage(pr, "hydrogel", "6oz")?.imageUrl,
      primocynSolution: findImage(pr, "236ml")?.imageUrl,
      cetaphilWash: findImage(gv, "cetaphil")?.imageUrl,
      aquaphor: findImage(gv, "aquaphor")?.imageUrl,
      hydrocortisone: findImage(gv, "hydrocortisone")?.imageUrl,
      benadrylCream: findImage(gv, "benadryl")?.imageUrl,
      acneCream: findImage(oq, "acne cream")?.imageUrl,
      hydratingGel: findImage(oq, "hydrating gel")?.imageUrl,
    },
  };

  console.log(JSON.stringify(map, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
