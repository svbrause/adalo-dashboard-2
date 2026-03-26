# Post-Visit Blueprint — green screen video shot list (~100 specific clips)

Clinic-facing production brief. Each row is a **distinct vertical (9:16) green-screen talking-head (or presenter-led) clip** you can film in batches. Titles are written so they double as **patient-friendly module names** on the blueprint.

**How this ties to the app**

- The patient page ranks videos with **keyword overlap** against the plan text (`treatment`, `product`, `region`, `findings`). See `src/config/postVisitBlueprintVideos.ts` (`matchKeywords`).
- When a clip is ready: add an entry to `POST_VISIT_BLUEPRINT_VIDEOS` with `id`, file paths under `public/post-visit-blueprint/videos/`, and **`matchKeywords`** copied or refined from the column below.
- Align spoken words and on-screen lower-thirds with the **suggested keywords** so facial-analysis **findings** (e.g. “Nasolabial Folds”, “Crow's feet”) and plan rows (e.g. “Moxi Full Face”) reliably match.

**Naming files (suggested)**

- Slug: lowercase, hyphens, e.g. `neurotoxin-glabella-frown-lines.mp4`
- Poster: `posters/neurotoxin-glabella-frown-lines.jpg` (see `npm run extract:blueprint-posters`)

---

## 1. Neurotoxin (Botox / Dysport) — indication-specific

| # | Video concept (title) | Suggested `matchKeywords` |
|---|------------------------|---------------------------|
| 1 | Neurotoxin for glabella / “11” frown lines | `glabella`, `frown`, `11 lines`, `between brows`, `neurotoxin`, `botox`, `dysport` |
| 2 | Neurotoxin for forehead lines | `forehead`, `forehead wrinkles`, `horizontal lines`, `neurotoxin`, `botox`, `dysport` |
| 3 | Neurotoxin for crow’s feet | `crow`, `crow's feet`, `lateral`, `eye wrinkles`, `neurotoxin`, `botox`, `dysport` |
| 4 | Neurotoxin for bunny lines on the nose | `bunny lines`, `nose lines`, `scrunch`, `neurotoxin`, `botox` |
| 5 | Neurotoxin brow lift / brow positioning | `brow`, `brow lift`, `heavy lid`, `neurotoxin`, `botox` |
| 6 | Lip flip with neurotoxin | `lip flip`, `upper lip`, `gummy`, `neurotoxin`, `botox` |
| 7 | Neurotoxin for gummy smile | `gummy smile`, `smile`, `upper lip`, `neurotoxin`, `botox` |
| 8 | Masseter neurotoxin for jaw slimming | `masseter`, `jaw slim`, `wide jaw`, `neurotoxin`, `botox`, `dysport` |
| 9 | Neurotoxin for TMJ / jaw tension | `tmj`, `jaw tension`, `clench`, `masseter`, `neurotoxin` |
| 10 | Neurotoxin for platysmal neck bands | `platysmal`, `neck bands`, `neck lines`, `neurotoxin`, `botox` |
| 11 | Neurotoxin for chin dimpling (peau d’orange) | `chin`, `chin texture`, `dimple`, `neurotoxin`, `botox` |
| 12 | Neurotoxin for downturned mouth corners (DAO) | `dao`, `mouth corner`, `downturn`, `marionette`, `neurotoxin` |
| 13 | Neurotoxin for vertical lip lines (perioral rhytids) | `lip lines`, `smoker lines`, `perioral`, `neurotoxin`, `botox` |
| 14 | Neurotoxin for horizontal neck lines (“tech neck”) | `neck lines`, `necklace lines`, `tech neck`, `neurotoxin` |
| 15 | Underarm sweating — neurotoxin (hyperhidrosis) | `hyperhidrosis`, `sweating`, `underarm`, `botox sweating`, `neurotoxin` |
| 16 | What “units” mean — neurotoxin dosing in plain language | `units`, `botox`, `dysport`, `dosing`, `neurotoxin` |
| 17 | Botox vs Dysport — what patients notice | `botox`, `dysport`, `neurotoxin`, `difference` |
| 18 | Neurotoxin timeline — onset, peak, wear-off | `onset`, `wear off`, `touch up`, `neurotoxin`, `botox` |
| 19 | Before your visit — aspirin, alcohol, bruising | `bruise`, `before treatment`, `neurotoxin`, `injectable` |
| 20 | After neurotoxin — exercise, lying down, same-day tips | `aftercare`, `after botox`, `neurotoxin` |

---

## 2. Dermal filler — area / concern-specific

| # | Video concept (title) | Suggested `matchKeywords` |
|---|------------------------|---------------------------|
| 21 | Filler for nasolabial folds | `nasolabial`, `smile line`, `fold`, `filler`, `hyaluronic` |
| 22 | Filler for marionette lines | `marionette`, `mouth corner`, `jowl line`, `filler` |
| 23 | Filler for prejowl sulcus | `prejowl`, `jowl`, `sulcus`, `filler`, `jawline` |
| 24 | Lip filler — volume and shape | `lip`, `lip filler`, `volume`, `hyaluronic`, `filler` |
| 25 | Lip filler — border definition & hydration look | `lip border`, `dry lips`, `definition`, `filler`, `lip` |
| 26 | Chin filler — projection and balance | `chin`, `projection`, `retruded`, `profile`, `filler`, `volux` |
| 27 | Jawline filler — definition and contour | `jawline`, `jowl`, `contour`, `filler`, `volux` |
| 28 | Cheek filler — midface volume | `cheek`, `midface`, `mid cheek`, `flattening`, `filler`, `voluma` |
| 29 | Tear trough / under-eye hollows — filler overview | `tear trough`, `under eye`, `hollow`, `filler` |
| 30 | Temple filler — hollowing | `temple`, `hollow`, `temporal`, `filler` |
| 31 | Hand filler — volume and veins | `hand`, `hands`, `veins`, `volume`, `filler` |
| 32 | Earlobe filler — support for earrings | `earlobe`, `lobe`, `filler` |
| 33 | Filler for acne scars (selected types) | `acne scar`, `scar`, `texture`, `filler` |
| 34 | Skinvive — skin-quality injectable (hyaluronic microdroplet) | `skinvive`, `skin quality`, `glow`, `hydration`, `injectable` |
| 35 | Filler dissolver — why hyaluronidase exists | `dissolver`, `hyaluronidase`, `reverse`, `filler` |
| 36 | Filler vs biostimulator — simple decision frame | `filler`, `sculptra`, `radiesse`, `biostim`, `volume` |
| 37 | Bruising after filler — what helps | `bruise`, `arnica`, `aftercare`, `filler` |
| 38 | Voluma — midface product positioning (use your approved claims) | `voluma`, `cheek`, `midface`, `filler` |
| 39 | Volux — jaw/chin structure (use your approved claims) | `volux`, `jawline`, `chin`, `filler` |
| 40 | Radiesse — structural support & contour | `radiesse`, `jawline`, `chin`, `hands`, `filler` |

---

## 3. Biostimulators (collagen stimulators)

| # | Video concept (title) | Suggested `matchKeywords` |
|---|------------------------|---------------------------|
| 41 | Sculptra — gradual collagen rebuilding | `sculptra`, `collagen`, `biostim`, `series`, `vial` |
| 42 | Sculptra — treatment series expectations | `sculptra`, `sessions`, `series`, `biostim` |
| 43 | Radiesse — lifting and structure beyond hyaluronic | `radiesse`, `caha`, `structure`, `biostim` |
| 44 | Biostimulator aftercare — massage when advised | `aftercare`, `massage`, `sculptra`, `radiesse` |

---

## 4. Energy — Moxi / BBL / combo (2025 Laser list)

| # | Video concept (title) | Suggested `matchKeywords` |
|---|------------------------|---------------------------|
| 45 | Moxi — full face texture & early photoaging | `moxi`, `full face`, `texture`, `laser`, `resurfac` |
| 46 | Moxi — neck | `moxi`, `neck`, `laser`, `crepey` |
| 47 | Moxi — chest / décolleté | `moxi`, `chest`, `decollete`, `laser` |
| 48 | Moxi — hands | `moxi`, `hands`, `laser`, `sun` |
| 49 | BBL — full face pigment & sun damage | `bbl`, `broadband`, `pigment`, `sun damage`, `ipl` |
| 50 | BBL — redness & vascular tone | `bbl`, `redness`, `vascular`, `rosacea`, `ipl` |
| 51 | BBL — neck | `bbl`, `neck`, `ipl` |
| 52 | BBL — chest | `bbl`, `chest`, `ipl` |
| 53 | BBL — hands | `bbl`, `hands`, `ipl` |
| 54 | BBL — arms | `bbl`, `arms`, `upper arms`, `forearms`, `ipl` |
| 55 | BBL — legs | `bbl`, `legs`, `thigh`, `ipl` |
| 56 | BBL — back | `bbl`, `back`, `ipl` |
| 57 | BBL — spot treatment | `bbl`, `spot`, `ipl` |
| 58 | Moxi + BBL same day — why we combine | `moxi`, `bbl`, `combo`, `stack`, `broadband` |
| 59 | Moxi or BBL series — packages & spacing | `moxi`, `bbl`, `3pk`, `series`, `package` |
| 60 | Post-laser skincare — SPF and gentle routine | `spf`, `after laser`, `moxi`, `bbl`, `sun` |

---

## 5. Sofwave (2025 Sofwave section)

| # | Video concept (title) | Suggested `matchKeywords` |
|---|------------------------|---------------------------|
| 61 | Sofwave — full face skin tightening | `sofwave`, `full face`, `tighten`, `ultrasound` |
| 62 | Sofwave — lower face & jowl | `sofwave`, `lower face`, `jowl`, `ultrasound` |
| 63 | Sofwave — neck | `sofwave`, `neck`, `ultrasound` |
| 64 | Sofwave — brow area | `sofwave`, `brow`, `ultrasound` |
| 65 | Sofwave + filler timing — order of operations | `sofwave`, `filler`, `timing`, `same month` |

---

## 6. Ultherapy (2025 Ultherapy section)

| # | Video concept (title) | Suggested `matchKeywords` |
|---|------------------------|---------------------------|
| 66 | Ultherapy — full face lifting | `ultherapy`, `full face`, `lift`, `ultrasound` |
| 67 | Ultherapy — lower face | `ultherapy`, `lower face`, `jowl` |
| 68 | Ultherapy — neck | `ultherapy`, `neck`, `lift` |
| 69 | Ultherapy — brow | `ultherapy`, `brow`, `lift` |
| 70 | Ultherapy vs Sofwave — high-level patient education | `ultherapy`, `sofwave`, `difference`, `tighten` |

---

## 7. Chemical peels (2025 Chemical Peel section)

| # | Video concept (title) | Suggested `matchKeywords` |
|---|------------------------|---------------------------|
| 71 | Brightening lactic peel — face | `lactic`, `brightening`, `peel`, `full face` |
| 72 | Jessner peel — face | `jessner`, `peel`, `full face` |
| 73 | Jessner peel — face, neck & chest | `jessner`, `neck`, `chest`, `peel` |
| 74 | Jessner peel — back (body) | `jessner`, `back`, `peel`, `body` |
| 75 | Sal-X Plus acne peel — face | `sal-x`, `acne`, `peel`, `face` |
| 76 | Sal-X Plus acne peel — back | `sal-x`, `acne`, `back`, `peel` |
| 77 | Cosmelan MD — melasma & pigment program | `cosmelan`, `melasma`, `pigment`, `md peel` |
| 78 | Chemical peel downtime — peeling timeline | `peel`, `downtime`, `peeling`, `flake` |
| 79 | Pre-peel prep — sun avoidance & products | `peel`, `prep`, `sun`, `retin` |

---

## 8. Microneedling & PRFM (2025 Medical Spa section)

| # | Video concept (title) | Suggested `matchKeywords` |
|---|------------------------|---------------------------|
| 80 | Microneedling — collagen induction (face) | `microneedling`, `collagen`, `texture`, `pore` |
| 81 | PRFM microneedling — glow & recovery | `prfm`, `microneedling`, `growth factor`, `glow` |
| 82 | PRFM add-on — neck or chest with microneedling | `prfm`, `neck`, `chest`, `add-on`, `microneedling` |
| 83 | Microneedling — acne scars | `microneedling`, `acne scar`, `texture` |
| 84 | PRFM hair restoration — scalp overview | `prfm`, `hair`, `restoration`, `scalp` |
| 85 | PRFM injections — facial (non-microneedling) | `prfm`, `injection`, `facial` |

---

## 9. Kybella & targeted body

| # | Video concept (title) | Suggested `matchKeywords` |
|---|------------------------|---------------------------|
| 86 | Kybella — submental fullness | `kybella`, `submental`, `double chin`, `fat` |
| 87 | Kybella — swelling curve & multiple sessions | `kybella`, `swelling`, `series`, `submental` |

---

## 10. Skincare & in-office facials (Facial Services → Skincare chapter)

| # | Video concept (title) | Suggested `matchKeywords` |
|---|------------------------|---------------------------|
| 88 | Acne facial — in-office | `acne facial`, `acne`, `facial`, `skincare` |
| 89 | Calming facial — redness-prone skin | `calming`, `sensitive`, `facial`, `skincare` |
| 90 | Signature / maintenance facial | `signature facial`, `facial`, `maintenance`, `skincare` |
| 91 | Glass Skin facial | `glass skin`, `facial`, `glow`, `skincare` |
| 92 | Dermaplaning — what it is & aftercare | `dermaplaning`, `peach fuzz`, `exfoliat`, `facial` |
| 93 | Dermasweep — exfoliation & infusion | `dermasweep`, `exfoliat`, `infusion`, `facial` |
| 94 | At-home medical-grade routine — cleanser to SPF | `skincare`, `routine`, `spf`, `vitamin c`, `retin` |
| 95 | Retinoids — starting slow & irritation | `retin`, `tretinoin`, `irritation`, `skincare` |
| 96 | Daily SPF — photoaging prevention | `spf`, `sunscreen`, `sun damage`, `skincare` |

---

## 11. Cross-cutting & assessment-finding hooks

These help when the plan or **facial analysis findings** name the concern but the modality varies.

| # | Video concept (title) | Suggested `matchKeywords` |
|---|------------------------|---------------------------|
| 97 | Under-eye area — filler vs energy vs skincare | `under eye`, `hollow`, `wrinkle`, `dark`, `bag` |
| 98 | Jowls — energy vs filler vs biostimulator | `jowl`, `jawline`, `lift`, `tighten`, `filler` |
| 99 | Dark spots — BBL vs peel vs Cosmelan | `dark spot`, `pigment`, `sun spot`, `bbl`, `cosmelan` |
| 100 | Fine lines vs volume loss — how we choose | `fine lines`, `volume`, `wrinkle`, `filler`, `laser` |
| 101 | Pronox / comfort options for anxious patients | `pronox`, `anxiety`, `comfort`, `nitrous` |
| 102 | Spider vein treatment (face/legs) — overview | `spider vein`, `vein`, `vascular` |

---

## 12. Tier S — optional product-specific clips (boutique catalog)

**Source of truth for names in the plan:** `src/components/modals/DiscussedTreatmentsModal/treatmentBoutiqueProducts.ts` (`TREATMENT_BOUTIQUE_SKINCARE`). When a plan row has `treatment: Skincare` and `product` set to one of these strings, keyword matching can surface the right clip.

**How to use this tier**

- **Do not** feel obligated to film all rows — treat this as a **pick list**. Start with bestsellers or products you reference in `RECOMMENDED_PRODUCTS_BY_CONTEXT` in `constants.ts`.
- **`matchKeywords`:** include substrings patients/staff actually type or that appear in the stored `product` field (often the full Shopify title). Add brand + short product nickname + key ingredients seen on the label.
- **Slug example:** `skinceuticals-c-e-ferulic.mp4` (see naming in the intro).

The **“Other”** retail row is omitted — there is no single product string to match.

### The Treatment (house line)

| ID | Video concept (title) | Suggested `matchKeywords` |
|----|------------------------|---------------------------|
| S-1 | Don’t Be A Flake Moisturizer | `don't be a flake`, `flake`, `restorative`, `moisturizer`, `the treatment`, `skincare` |
| S-2 | Dream Lover moisturizer | `dream lover`, `firming`, `anti-aging moisturizer`, `the treatment`, `skincare` |
| S-3 | Glycolic Acid Gel Pads | `glycolic`, `gel pads`, `exfoliating pads`, `the treatment`, `skincare` |
| S-4 | Last Call Cleansing Oil | `last call`, `cleansing oil`, `makeup remover`, `the treatment`, `skincare` |
| S-5 | Let’s Get Physical Tinted SPF 44 | `let's get physical`, `tinted spf`, `spf 44`, `sunscreen`, `the treatment`, `skincare` |
| S-6 | On The Daily SPF 45 | `on the daily`, `spf 45`, `daily sunscreen`, `the treatment`, `skincare` |
| S-7 | Sleep Tight Night Cream | `sleep tight`, `night cream`, `anti-aging night`, `the treatment`, `skincare` |
| S-8 | TreatMINT Cooling Clay Mask | `treatmint`, `cooling clay`, `clay mask`, `the treatment`, `skincare` |

### SkinCeuticals

| ID | Video concept (title) | Suggested `matchKeywords` |
|----|------------------------|---------------------------|
| S-9 | A.G.E. Advanced Eye Cream | `a.g.e. advanced eye`, `age advanced eye`, `eye cream`, `skinceuticals`, `skincare` |
| S-10 | A.G.E. Interrupter Advanced | `a.g.e. interrupter`, `age interrupter`, `wrinkles`, `firmness`, `skinceuticals` |
| S-11 | Advanced RGN-6 | `advanced rgn`, `rgn-6`, `regenerative`, `skinceuticals` |
| S-12 | Antioxidant Lip Repair | `antioxidant lip repair`, `lip repair`, `skinceuticals` |
| S-13 | AOX Eye Gel | `aox eye gel`, `dark circles`, `puffiness`, `skinceuticals` |
| S-14 | Biocellulose Restorative Mask | `biocellulose`, `sheet mask`, `restorative mask`, `skinceuticals` |
| S-15 | Blemish + Age Defense | `blemish + age`, `blemish age defense`, `salicylic`, `acne`, `aging`, `skinceuticals` |
| S-16 | C E Ferulic | `c e ferulic`, `ce ferulic`, `vitamin c`, `ferulic`, `antioxidant`, `skinceuticals` |
| S-17 | Cell Cycle Catalyst | `cell cycle catalyst`, `resurfacing`, `radiance`, `skinceuticals` |
| S-18 | Clarifying Clay Mask | `clarifying clay`, `clay mask`, `oil control`, `skinceuticals` |
| S-19 | Daily Moisture | `daily moisture`, `lightweight moisturizer`, `skinceuticals` |
| S-20 | Discoloration Defense | `discoloration defense`, `dark spots`, `uneven tone`, `skinceuticals` |
| S-21 | Emollience | `emollience`, `dry skin`, `moisturizer`, `skinceuticals` |
| S-22 | Epidermal Repair | `epidermal repair`, `compromised skin`, `sensitive`, `post-procedure`, `skinceuticals` |
| S-23 | Equalizing Toner | `equalizing toner`, `alcohol-free toner`, `skinceuticals` |
| S-24 | Eye Balm | `eye balm`, `mature`, `dry eye`, `skinceuticals` |
| S-25 | Gentle Cleanser | `gentle cleanser`, `cream cleanser`, `sensitive`, `skinceuticals` |
| S-26 | Glycolic 10 Renew Overnight | `glycolic 10`, `renew overnight`, `night serum`, `skinceuticals` |
| S-27 | Hyaluronic Acid Intensifier (H.A.) | `hyaluronic acid intensifier`, `h.a. intensifier`, `ha intensifier`, `hydrating serum`, `skinceuticals` |
| S-28 | Hydra Balm | `hydra balm`, `balm`, `dehydrated`, `skinceuticals` |
| S-29 | Hydrating B5 Gel | `hydrating b5`, `b5 gel`, `vitamin b5`, `skinceuticals` |
| S-30 | Hydrating B5 Mask | `hydrating b5 mask`, `b5 mask`, `skinceuticals` |
| S-31 | LHA Cleanser | `lha cleanser`, `acne-prone`, `congested`, `skinceuticals` |
| S-32 | LHA Toner | `lha toner`, `clogged pores`, `skinceuticals` |
| S-33 | Metacell Renewal B3 | `metacell`, `renewal b3`, `niacinamide`, `brightening`, `skinceuticals` |
| S-34 | Micro-Exfoliating Scrub | `micro-exfoliating scrub`, `face scrub`, `skinceuticals` |
| S-35 | P-Tiox (glass skin serum) | `p-tiox`, `ptiox`, `glass skin`, `peptide`, `skinceuticals` |
| S-36 | Phloretin CF | `phloretin cf`, `phloretin`, `environmental`, `uneven tone`, `skinceuticals` |
| S-37 | Phyto A+ Brightening Treatment | `phyto a+`, `phyto a plus`, `brightening`, `gel moisturizer`, `skinceuticals` |
| S-38 | Phyto Corrective Essence Mist | `phyto corrective essence`, `essence mist`, `redness`, `skinceuticals` |
| S-39 | Phyto Corrective Gel | `phyto corrective gel`, `soothing`, `redness`, `skinceuticals` |
| S-40 | Phyto Corrective Masque | `phyto corrective masque`, `phyto mask`, `skinceuticals` |
| S-41 | Purifying Cleanser | `purifying cleanser`, `oily`, `acne-prone`, `skinceuticals` |
| S-42 | Redness Neutralizer | `redness neutralizer`, `redness-prone`, `skinceuticals` |
| S-43 | Renew Overnight (Dry) | `renew overnight`, `night cream`, `dry`, `dehydrated`, `skinceuticals` |
| S-44 | Replenishing Cleanser | `replenishing cleanser`, `hydrating wash`, `skinceuticals` |
| S-45 | Resveratrol B E | `resveratrol b e`, `resveratrol`, `nighttime antioxidant`, `skinceuticals` |
| S-46 | Retexturing Activator | `retexturing activator`, `texture`, `refine`, `skinceuticals` |
| S-47 | Retinol 0.3% | `retinol 0.3`, `retinol`, `skinceuticals` |
| S-48 | Retinol 0.5% | `retinol 0.5`, `retinol`, `skinceuticals` |
| S-49 | Retinol 1.0% | `retinol 1.0`, `retinol 1`, `skinceuticals` |
| S-50 | Serum 10 AOX | `serum 10`, `aox`, `10% vitamin c`, `skinceuticals` |
| S-51 | Silymarin CF | `silymarin cf`, `silymarin`, `oily`, `acne-prone`, `skinceuticals` |
| S-52 | Simply Clean | `simply clean`, `foaming cleanser`, `skinceuticals` |
| S-53 | Soothing Cleanser | `soothing cleanser`, `irritated`, `skinceuticals` |
| S-54 | Tripeptide-R Neck Repair | `tripeptide-r`, `neck repair`, `neck`, `decolletage`, `skinceuticals` |
| S-55 | Triple Lipid Restore 2:4:2 | `triple lipid restore`, `2:4:2`, `barrier`, `ceramide`, `skinceuticals` |

### G.M. Collin

| ID | Video concept (title) | Suggested `matchKeywords` |
|----|------------------------|---------------------------|
| S-56 | GM Collin Daily Ceramide Comfort | `daily ceramide comfort`, `ceramide`, `capsules`, `gm collin`, `g.m. collin`, `skincare` |
| S-57 | GM Collin Essential Oil Complex | `essential oil complex`, `gm collin`, `g.m. collin`, `skincare` |
| S-58 | GM Collin Hydramucine Hydrating Mist | `hydramucine`, `hydrating mist`, `gm collin`, `skincare` |
| S-59 | GM Collin Rosa Sea Gel-Cream | `rosa sea`, `gel-cream`, `redness`, `gm collin`, `skincare` |
| S-60 | GM Collin Sensiderm Cleansing Milk | `sensiderm`, `cleansing milk`, `sensitive`, `gm collin`, `skincare` |

### Devices & advanced topicals

| ID | Video concept (title) | Suggested `matchKeywords` |
|----|------------------------|---------------------------|
| S-61 | Omnilux Contour Face (LED) | `omnilux`, `contour face`, `led`, `light therapy`, `skincare` |
| S-62 | Plated Intense Exosomes | `plated`, `intense exosomes`, `exosomes`, `skincare` |

---

## Count

- **102** core concepts (sections 1–11) — drop any that don’t fit brand/medical-legal review.
- **62** optional **Tier S** product modules (section 12) — film selectively; catalog syncs with `treatmentBoutiqueProducts.ts`.

---

## Production batching (suggested shoot days)

1. **Neurotoxin day** — rows 1–20  
2. **Filler + biostim day** — rows 21–44  
3. **Laser day (Moxi/BBL)** — rows 45–60  
4. **Sofwave + Ultherapy** — rows 61–70  
5. **Peels** — rows 71–79  
6. **Microneedling / PRFM / Kybella** — rows 80–87  
7. **Facials + skincare education** — rows 88–96  
8. **Cross-cutting + misc** — rows 97–102  
9. **Optional: Tier S retail** — pick high-velocity SKUs from section 12 (can be many short reads on one shoot day)

---

## Compliance

- Scripts must follow your **medical director / legal** standards (no guaranteed outcomes, use “may,” “can help,” etc.).
- Product names (**Botox**, **Dysport**, **Juvederm** family, **Voluma**, **Volux**, **Radiesse**, **Sculptra**, **Skinvive**, **Kybella**, device names) — use only as permitted by your agreements and labeling.
- **OTC / cosmetic retail (Tier S):** follow brand guidelines (SkinCeuticals, G.M. Collin, Omnilux, Plated, house line); avoid drug claims unless appropriate for the product class and your review process.

---

## After filming

1. Export **MP4 H.264** (+ optional MOV), add to `public/post-visit-blueprint/videos/`.  
2. Append entries to `POST_VISIT_BLUEPRINT_VIDEOS` in `src/config/postVisitBlueprintVideos.ts`.  
3. Run `npm run extract:blueprint-posters` and commit posters under `posters/`.
