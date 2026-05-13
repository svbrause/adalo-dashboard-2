import fs from "fs";

const quizPath = new URL("../../src/data/skinTypeQuiz.ts", import.meta.url);
const boutiquePath = new URL(
  "../../src/components/modals/DiscussedTreatmentsModal/treatmentBoutiqueProducts.ts",
  import.meta.url,
);

const quizSrc = fs.readFileSync(quizPath, "utf8");
const boutiqueSrc = fs.readFileSync(boutiquePath, "utf8");

const start = quizSrc.indexOf("export const SKIN_TYPE_TO_PRODUCTS");
const end = quizSrc.indexOf("export const RECOMMENDED_PRODUCT_REASONS");
if (start < 0 || end < 0) throw new Error("Could not find SKIN_TYPE_TO_PRODUCTS block");
const block = quizSrc.slice(start, end);
/** @type {Set<string>} */
const names = new Set();
for (const m of block.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
  const s = JSON.parse(`"${m[1].replace(/\\(.)/g, "$1")}"`);
  if (s.includes("|") && s.length > 30) names.add(s);
}

/** @type {Array<{name:string,productUrl?:string,imageUrl?:string,price?:string}>} */
const products = [];
const re = /\{\s*\n\s*name:\s*"((?:[^"\\]|\\.)*)"/g;
let m;
const starts = [];
while ((m = re.exec(boutiqueSrc)) !== null) {
  const raw = m[1];
  const name = JSON.parse(`"${raw.replace(/\\(.)/g, "$1")}"`);
  starts.push({ name, idx: m.index });
}

for (let i = 0; i < starts.length; i++) {
  const { name } = starts[i];
  if (!names.has(name)) continue;
  const slice = boutiqueSrc.slice(
    starts[i].idx,
    i + 1 < starts.length ? starts[i + 1].idx : boutiqueSrc.length,
  );
  const urlM = slice.match(/productUrl:\s*"([^"]*)"/);
  const imgM = slice.match(/imageUrl:\s*"([^"]*)"/);
  const priceM = slice.match(/price:\s*"([^"]*)"/);
  products.push({
    name,
    productUrl: urlM?.[1],
    imageUrl: imgM?.[1],
    price: priceM?.[1],
  });
}

for (const n of names) {
  if (!products.some((p) => p.name === n)) {
    console.error("Missing boutique row for quiz product:", n);
  }
}

const outDir = new URL("../ConsumerSkincare/Resources/", import.meta.url);
fs.mkdirSync(outDir, { recursive: true });
/** @type {Record<string,string[]>} */
const bySkin = {};
const gems = [
  "opal",
  "pearl",
  "jade",
  "quartz",
  "amber",
  "moonstone",
  "turquoise",
  "diamond",
];
for (const g of gems) {
  const re = new RegExp(
    "\\b" + g + "\\b:\\s*\\[([\\s\\S]*?)\\]\\s*,?",
    "m",
  );
  const mm = block.match(re);
  if (!mm) {
    console.warn("No block for", g);
    continue;
  }
  const inner = mm[1];
  const arr = [];
  for (const m of inner.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    const s = JSON.parse(`"${m[1]}"`);
    if (s.includes("|")) arr.push(s);
  }
  bySkin[g] = arr;
}

fs.writeFileSync(
  new URL("boutique-for-quiz.json", outDir),
  JSON.stringify(products, null, 2),
);
fs.writeFileSync(
  new URL("recommended-by-skin-type.json", outDir),
  JSON.stringify(bySkin, null, 2),
);
console.log("Wrote", products.length, "products to boutique-for-quiz.json");
console.log(
  "Wrote recommended-by-skin-type.json with",
  Object.keys(bySkin).length,
  "skin types",
);
