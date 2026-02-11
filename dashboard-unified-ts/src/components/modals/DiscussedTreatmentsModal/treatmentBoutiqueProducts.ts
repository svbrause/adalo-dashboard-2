/**
 * Skincare products from The Treatment Skin Boutique (https://shop.getthetreatment.com/).
 * Used in the treatment plan when "Skincare" is selected.
 *
 * To refresh the list from the live store, run:
 *   node scripts/fetch-treatment-boutique-products.mjs
 * That script uses Shopify’s public products.json API (no scraping). Paste or merge the
 * output into this file, or re-run and update RECOMMENDED_PRODUCTS_BY_CONTEXT in constants.ts
 * to match any new product names.
 */

export interface TreatmentBoutiqueProduct {
  name: string;
  imageUrl?: string;
  productUrl?: string;
}

/** All skincare products from The Treatment Skin Boutique – name, image, product page URL */
export const TREATMENT_BOUTIQUE_SKINCARE: TreatmentBoutiqueProduct[] = [
  /* The Treatment */
  {
    name: "The Treatment Don't Be A Flake Moisturizer – Restorative Antioxidant Cream for Glowing Skin",
    productUrl: "https://shop.getthetreatment.com/products/the-treatment-dont-be-a-flake-moisturizer",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/squalane-moisturizer.png?v=1767819940",
  },
  {
    name: "The Treatment Dream Lover | Firming & Anti-Aging Moisturizer",
    productUrl: "https://shop.getthetreatment.com/products/the-treatment-dream-lover-moisturizer",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/lipochrome.png?v=1767820006",
  },
  {
    name: "The Treatment Glycolic Acid Gel Pads | Exfoliating Pads for Smoother, Brighter Skin",
    productUrl: "https://shop.getthetreatment.com/products/glycolic-gel-pads",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/exfoliating-face-pads.jpg?v=1762541166",
  },
  {
    name: "The Treatment Last Call Cleansing Oil | Gentle Makeup Remover & Hydrating Cleanser",
    productUrl: "https://shop.getthetreatment.com/products/last-call-cleansing-oil",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/best-cleansing-oil.jpg?v=1762542533",
  },
  {
    name: "The Treatment Let's Get Physical Tinted SPF 44 | Lightweight Tinted Sunscreen with Broad Spectrum Protection",
    productUrl: "https://shop.getthetreatment.com/products/lets-get-physical-tinted-spf-44",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/tinted-sunscreen.png?v=1762992852",
  },
  {
    name: "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection",
    productUrl: "https://shop.getthetreatment.com/products/the-treatment-daily-brightening-uv-defense-spf-45",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/lightweight-sunscreen-1.jpg?v=1762993050",
  },
  {
    name: "The Treatment Sleep Tight Moisturizer | Intensive Anti-Aging Night Cream",
    productUrl: "https://shop.getthetreatment.com/products/the-treatment-sleep-tight-moisturizer",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/best-nighttime-face-cream_7d76f59a-496b-45d8-b9e9-8ee62b52b97d.png?v=1767819815",
  },
  {
    name: "The TreatMINT Cooling Clay Mask | Detoxifying & Refreshing Face Mask for Clear Skin",
    productUrl: "https://shop.getthetreatment.com/products/mint-cooling-clay-mask",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/peel-off-face-mask-1.jpg?v=1762994015",
  },
  /* SkinCeuticals */
  {
    name: "SkinCeuticals A.G.E. Advanced Eye Cream | Nourishing Pre-Cleanse for Radiant, Balanced Skin Anti-Aging Treatment for Wrinkles & Puffiness",
    productUrl: "https://shop.getthetreatment.com/products/a-g-e-advanced-eye",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/anti-wrinkle-eye-cream.png?v=1767813879",
  },
  {
    name: "SkinCeuticals A.G.E. Interrupter Advanced | Anti-Aging Cream for Wrinkles & Loss of Firmness",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-a-g-e-interrupter-anti-aging-cream",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/anti-wrinkle-cream.png?v=1767814020",
  },
  {
    name: "SkinCeuticals Advanced RGN‑6 | Regenerative Anti-Aging Cream",
    productUrl: "https://shop.getthetreatment.com/products/advanced-rgn-6",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/Screenshot_2025-04-14_at_9.34.20_AM.png?v=1744648680",
  },
  {
    name: "SkinCeuticals Antioxidant Lip Repair | Nourishing Lip Treatment",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-antioxidant-lip-repair",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/lip-treatment.png?v=1762466886",
  },
  {
    name: "SkinCeuticals AOX Eye Gel | Antioxidant Eye Treatment for Dark Circles & Puffiness",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-aox-eye-gel",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/eye-serum.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Biocellulose Restorative Mask | Hydrating & Repairing Sheet Mask for Radiant Skin",
    productUrl: "https://shop.getthetreatment.com/products/biocellulose-restorative-mask",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/skinceuticals-biocellulose-mask.png?v=1762466887",
  },
  {
    name: "SkinCeuticals Blemish + Age Defense | Targeted Serum for Acne and Signs of Aging",
    productUrl: "https://shop.getthetreatment.com/products/https-the-treatment-skin-boutique-myshopify-com-products-blemish-age-defense",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/salicylic-acid-serum.png?v=1762466887",
  },
  {
    name: "SkinCeuticals C E Ferulic | Antioxidant Vitamin C Serum for Brightening & Anti-Aging",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-c-e-ferulic-vitamin-c-serum",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/ce-ferulic.png?v=1762466889",
  },
  {
    name: "SkinCeuticals Cell Cycle Catalyst | Resurfacing Serum for Radiance & Skin Renewal",
    productUrl: "https://shop.getthetreatment.com/products/cell-cycle-catalyst",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/exfoliating-serum.png?v=1762466886",
  },
  {
    name: "Skinceuticals Clarifying Clay Mask | Detoxifying Face Mask for Oil Control",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-clarifying-clay-mask",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/clarifying-clay-mask.png?v=1762466889",
  },
  {
    name: "SkinCeuticals Daily Moisture | Lightweight Hydrating Moisturizer for All Skin Types",
    productUrl: "https://shop.getthetreatment.com/products/https-the-treatment-skin-boutique-myshopify-com-products-daily-moisture",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/lightweight-moisturizer-for-oily-skin.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Discoloration Defense | Targeted Serum for Dark Spots & Uneven Skin Tone",
    productUrl: "https://shop.getthetreatment.com/products/https-the-treatment-skin-boutique-myshopify-com-products-discoloration-defense",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/discoloration-correcting-serum.png?v=1762466888",
  },
  {
    name: "SkinCeuticals Emollience | Hydrating Moisturizer for Normal to Dry Skin",
    productUrl: "https://shop.getthetreatment.com/products/https-the-treatment-skin-boutique-myshopify-com-products-emollience",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/non-comedogenic-emollients.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Epidermal Repair | Calming Therapeutic Treatment for Compromised or Sensitive Skin",
    productUrl: "https://shop.getthetreatment.com/products/https-the-treatment-skin-boutique-myshopify-com-products-epidermal-repair",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/epidermal-repair.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Equalizing Toner | Alcohol-Free Toner for Balanced, Refreshed Skin",
    productUrl: "https://shop.getthetreatment.com/products/https-the-treatment-skin-boutique-myshopify-com-products-equalizing-toner",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/exfoliating-toner.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Eye Balm | Rich Anti-Aging Eye Cream for Mature, Dry Skin",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-eye-balm",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/eye-balm.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Gentle Cleanser | Soothing Cream Cleanser for Dry & Sensitive Skin",
    productUrl: "https://shop.getthetreatment.com/products/https-the-treatment-skin-boutique-myshopify-com-products-gentle-cleanser",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/ceramide-cleanser.png?v=1762466889",
  },
  {
    name: "SkinCeuticals Glycolic 10 Renew Overnight | Exfoliating Night Serum for Smoother, Radiant Skin",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-glycolic-10-renew-overnight",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/night-cream.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Hyaluronic Acid Intensifier | Multi-Glycan Hydrating Serum for Plump & Smooth Skin",
    productUrl: "https://shop.getthetreatment.com/products/hyaluronic-acid-intensifier-ha-copy",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/hyaluronic-acid-serum.jpg?v=1763144452",
  },
  {
    name: "SkinCeuticals Hydra Balm | Intensive Moisturizing Balm for Compromised, Dry & Dehydrated Skin",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-hydra-balm",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/aloe-vera-lip-balm.png?v=1762466889",
  },
  {
    name: "SkinCeuticals Hydrating B5 Gel | Lightweight Moisturizer with Vitamin B5 for Deep Skin Hydration",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-hydrating-b5-gel",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/ha-serum.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Hydrating B5 Mask | Nourishing Face Mask with Vitamin B5 for Intense Moisture",
    productUrl: "https://shop.getthetreatment.com/products/hydrating-b5-mask",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/hydrating-mask-for-skin.png?v=1762466886",
  },
  {
    name: "SkinCeuticals LHA Cleanser | Exfoliating Face Wash for Acne-Prone & Congested Skin",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-lha-gel-cleanser",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/gentle-blackhead-cleanser.png?v=1762466886",
  },
  {
    name: "SkinCeuticals LHA Toner | Exfoliating Toner for Clogged Pores & Dead Skin Cell Removal",
    productUrl: "https://shop.getthetreatment.com/products/https-the-treatment-skin-boutique-myshopify-com-products-lha-cleanser",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/glycolic-acid-toner.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Metacell Renewal B3 | Brightening & Anti-Aging Serum with Vitamin B3",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-meatcell-renewal-b3",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/brightening-serum.png?v=1762466888",
  },
  {
    name: "SkinCeuticals Micro-Exfoliating Scrub | Gentle Face Scrub for Smooth & Radiant Skin",
    productUrl: "https://shop.getthetreatment.com/products/https-the-treatment-skin-boutique-myshopify-com-products-micro-exfoliating-scrub",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/face-scrub-for-sensitive-skin.png?v=1762466886",
  },
  {
    name: "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair",
    productUrl: "https://shop.getthetreatment.com/products/p-tiox",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/peptide-serum.png?v=1762466887",
  },
  {
    name: "SkinCeuticals Phloretin CF | Antioxidant Serum for Environmental Damage & Uneven Skin Tone",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-phloretin-cf",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/Phloretin-CF-with-Ferulic-Acid-SkinCeuticals_Award_Seals.webp?v=1764179925",
  },
  {
    name: "SkinCeuticals Phyto A+ Brightening Treatment | Lightweight Gel Moisturizer for Dull, Uneven Skin",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-phyto-a-brightening-treatment-lightweight-gel",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/phyto-corrective-gel_2.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Phyto Corrective Essence Mist | Hydrating & Soothing Face Mist for Redness and Sensitivity",
    productUrl: "https://shop.getthetreatment.com/products/phyto-a-brightening-treatment",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/toner-for-face.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Phyto Corrective Gel | Soothing Hydrating Serum for Redness & Sensitive Skin",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-phyto-corrective-gel",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/phyto-corrective-gel.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Phyto Corrective Masque | Soothing Hydrating Mask for Redness & Sensitive Skin",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-phyto-corrective-masque",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/phyto-corrective-mask.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Purifying Cleanser | Deep Cleansing Face Wash for Oily & Acne-Prone Skin",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-purifying-cleanser",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/cleansing-gel.png?v=1762466888",
  },
  {
    name: "SkinCeuticals Redness Neutralizer | Soothing Serum for Sensitive & Redness-Prone Skin",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-redness-neutralizer",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/face-serum.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Renew Overnight | Intensive Night Cream for Dry & Dehydrated Skin",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-renew-overnight-cream",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/nighttime-moisturizer.jpg?v=1762470715",
  },
  {
    name: "SkinCeuticals Replenishing Cleanser | Hydrating Face Wash for Dry & Sensitive Skin",
    productUrl: "https://shop.getthetreatment.com/products/https-the-treatment-skin-boutique-myshopify-com-products-replenishing-cleanser",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/makeup-removal-cleanser.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Resveratrol B E | Nighttime Antioxidant Serum with Pure Resveratrol 1%",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-reversatrol-b-e",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/antioxidant-serum.png?v=1763144335",
  },
  {
    name: "SkinCeuticals Retexturing Activator | Exfoliating Serum for Smoother, Refined Skin Texture",
    productUrl: "https://shop.getthetreatment.com/products/https-the-treatment-skin-boutique-myshopify-com-products-re-texturing-activator",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/exfoliating-face-scrub.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Retinol 0.3% | Anti-Aging Serum for Wrinkles & Skin Renewal",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-retinol-0-3",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/skinceuticals-retinol-0.3.png?v=1762466887",
  },
  {
    name: "SkinCeuticals Retinol 0.5% | Anti-Aging Serum for Wrinkles & Skin Renewal",
    productUrl: "https://shop.getthetreatment.com/products/https-the-treatment-skin-boutique-myshopify-com-products-retinol-0-5",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/retinol.png?v=1762466887",
  },
  {
    name: "SkinCeuticals Retinol 1.0% | Anti-Aging Serum for Wrinkles & Skin Renewal",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-retinol-1-0",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/retinol-1.png?v=1762466887",
  },
  {
    name: "SkinCeuticals Serum 10 AOX | Antioxidant Serum with 10% Vitamin C for Brightening & Protection",
    productUrl: "https://shop.getthetreatment.com/products/serum-10-aox",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/vitamin-C-serum.png?v=1762466887",
  },
  {
    name: "SkinCeuticals Silymarin CF | Antioxidant Serum for Oily & Acne-Prone Skin",
    productUrl: "https://shop.getthetreatment.com/products/silymarin-cf",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/silymarin-cf.png?v=1762466887",
  },
  {
    name: "SkinCeuticals Simply Clean | Gentle Foaming Cleanser for All Skin Types",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-simply-clean-gentle-foaming-cleanser",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/foaming-cleanser-gel.png?v=1762468825",
  },
  {
    name: "SkinCeuticals Soothing Cleanser | Gentle Face Wash for Sensitive & Irritated Skin",
    productUrl: "https://shop.getthetreatment.com/products/soothing-cleanser",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/face-cleanser-for-sensitive-skin.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Tripeptide-R Neck Repair | Firming & Anti-Aging Treatment for Neck & Décolletage",
    productUrl: "https://shop.getthetreatment.com/products/tripeptide-r-neck-repair",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/tripeptide.png?v=1762466886",
  },
  {
    name: "SkinCeuticals Triple Lipid Restore 2:4:2 | Anti-Aging Moisturizer for Skin Barrier Repair & Hydration",
    productUrl: "https://shop.getthetreatment.com/products/skinceuticals-triple-lipid-restore-2-4-2",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/ceramide-moisturizer.png?v=1767812922",
  },
  /* G.M. Collin */
  {
    name: "GM Collin Daily Ceramide Comfort | Nourishing Skin Barrier Capsules for Hydration & Repair (20 Ct.)",
    productUrl: "https://shop.getthetreatment.com/products/gm-collin-daily-ceramide-comfort-20-capsules",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/gm-collin-cerumide-comfort.jpg?v=1762992664",
  },
  {
    name: "GM Collin Essential Oil Complex | Nourishing Blend for Calm, Hydrated, Glowing Skin",
    productUrl: "https://shop.getthetreatment.com/products/essential-oil-complex",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/salicylic-acid-toner.jpg?v=1762541166",
  },
  {
    name: "GM Collin Hydramucine Hydrating Mist | Refreshing Toner for Radiant, Glowy Skin",
    productUrl: "https://shop.getthetreatment.com/products/gm-collin-hydramucine-hydrating-mist",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/hydrating-toner.jpg?v=1762541166",
  },
  {
    name: "GM Collin Rosa Sea Gel-Cream | Soothing Moisturizer for Redness & Inflammation",
    productUrl: "https://shop.getthetreatment.com/products/rose-sea-gel-cream",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/oil-free-face-moisturizer.jpg?v=1762541166",
  },
  {
    name: "GM Collin Sensiderm Cleansing Milk | Gentle Cleanser for Sensitive & Irritated Skin",
    productUrl: "https://shop.getthetreatment.com/products/sensiderm-cleansing-milk",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/gentle-cleanser.jpg?v=1762541166",
  },
  /* Omnilux */
  {
    name: "Omnilux Contour Face | LED Light Therapy Device for Skin Rejuvenation",
    productUrl: "https://shop.getthetreatment.com/products/omnilux-contour-face",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/omnilux.jpg?v=1762543943",
  },
  /* Plated */
  {
    name: "Plated Intense Exosomes | Advanced Serum for Skin Repair & Rejuvenation",
    productUrl: "https://shop.getthetreatment.com/products/intense-exosomes",
    imageUrl: "https://cdn.shopify.com/s/files/1/2640/6190/files/plated-exosomes.jpg?v=1762541166",
  },
  { name: "Other" },
];
