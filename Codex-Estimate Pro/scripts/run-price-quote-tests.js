#!/usr/bin/env node
/**
 * Self-test สำหรับ Price Ask — รันด้วย: node scripts/run-price-quote-tests.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");

function load(relativePath) {
  const code = fs.readFileSync(path.join(root, relativePath), "utf8");
  vm.runInContext(code, sandbox, { filename: relativePath });
}

const sandbox = {
  window: {},
  console,
  localStorage: {
    store: {},
    getItem(key) { return this.store[key] ?? null; },
    setItem(key, value) { this.store[key] = String(value); },
    removeItem(key) { delete this.store[key]; }
  },
  SurveyPresetsApi: {
    getConfig: () => ({ wireMultiplier: 4 }),
    getConfigKey: (v, p) => `${v}${p}`,
    getSet: () => null,
    getSpecialPoleRules: () => null,
    getTrInstallCatalog: () => null,
    getTransformers: () => []
  },
  SURVEY_PRESETS: { sets: {}, transformers: [] },
  APP_CONFIG: { priceFaq: {} }
};
sandbox.window = sandbox;
sandbox.window.localStorage = sandbox.localStorage;
vm.createContext(sandbox);

load("budget-formula.js");
load("price-quote-catalog.js");
load("survey-presets.js");
load("price-ask-glossary.js");
load("price-ask-nlu.js");
load("price-quote-pole.js");
load("price-quote-engine.js");
load("price-ask-feedback.js");

const Engine = sandbox.window.PriceQuoteEngine;
const Pole = sandbox.window.PriceQuotePole;
const Nlu = sandbox.window.PriceAskNlu;
const Feedback = sandbox.window.PriceAskFeedback;
const Glossary = sandbox.window.PRICE_ASK_GLOSSARY;

let passed = 0;
let failed = 0;

function assert(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function runCase(name, fn) {
  console.log(`\n${name}`);
  try {
    fn();
  } catch (error) {
    failed += 1;
    console.error(`  ✗ threw: ${error.message}`);
  }
}

runCase("parseQueryLocal — ขยายเขต LV 200m 3P", () => {
  const q = "ขยายเขตแรงต่ำ ระยะทาง 200 เมตร 3 เฟส";
  const intent = Engine.sanitizeIntent(Engine.parseQueryLocal(q, "01.1"), q);
  assert("intent pole_run", intent.intent === "pole_run");
  assert("distanceM=200", Number(intent.distanceM) === 200);
  assert("phase 3p", intent.phase === "3p");
  assert("no clarification", intent.needsClarification === false);
});

runCase("enrich — Gemini JSON ไม่มี distance แต่คำถามมี 200m", () => {
  const q = "ปักเสาแรงต่ำ 9 เมตร ระยะทาง 200 เมตร 3 เฟส";
  const aiIntent = {
    intent: "pole_run",
    budgetType: "02.1",
    poleHeightM: 9,
    voltage: "lv",
    phase: "3p",
    scope: "pole_only",
    poleCount: 1,
    summary: "ประมาณ 5 ต้น ระยะ 200 ม.",
    needsClarification: false,
    source: "gemini-lite"
  };
  const intent = Engine.sanitizeIntent(aiIntent, q);
  assert("distanceM filled", Number(intent.distanceM) === 200);
  assert("scope with_wire", intent.scope === "with_wire");
  assert("valid to quote", intent.needsClarification === false);
});

runCase("validate — งานเสาไม่มี MV/LV ต้อง clarify", () => {
  const q = "ขยายเขต 200 เมตร";
  const intent = Engine.sanitizeIntent(Engine.parseQueryLocal(q, "01.1"), q);
  assert("needs clarification", intent.needsClarification === true);
  assert("pole_run type", intent.clarificationType === "pole_run");
});

runCase("tr_install — ไม่มี kVA ต้อง clarify", () => {
  const q = "ติดตั้งหม้อแปลง กี่บาท";
  const intent = Engine.sanitizeIntent({ intent: "tr_install", budgetType: "01.1", summary: q }, q);
  assert("needs clarification", intent.needsClarification === true);
  assert("tr_install type", intent.clarificationType === "tr_install");
  assert("has kva field", (intent.clarificationFields || []).some(f => f.key === "kva"));
});

runCase("tr_budget — มีเงิน 50k หม้อแปลง", () => {
  const q = "มีเงิน 50,000 บาท จะติดตั้งหม้อแปลงได้ไหม";
  const intent = Engine.sanitizeIntent(Engine.parseQueryLocal(q, "02.1"), q);
  assert("tr_budget_check", intent.intent === "tr_budget_check");
  assert("budget 50000", Number(intent.budgetBaht) === 50000);
  assert("ready", intent.needsClarification === false);
});

runCase("tr_budget — 5M max kVA + กี่เครื่อง", () => {
  const q = "มีเงิน 5,000,000 บาทติดหม้อแปลงขนาดสูงสุดได้กี่ kVA ได้กี่เครื่อง";
  const intent = Engine.sanitizeIntent(Engine.parseQueryLocal(q, "02.2"), q);
  assert("tr_budget_check", intent.intent === "tr_budget_check");
  assert("budget 5M", Number(intent.budgetBaht) === 5000000);
  assert("wants units", intent.wantsUnitCount === true);

  const catalog = sandbox.window.PRICE_QUOTE_CATALOG?.TRANSFORMER_BY_KVA || {};
  const master = [{ id: "1000010012", name: "POLE", unit: "ต้น", matPrice: 8000, labPrice: 3000 }];
  Object.entries(catalog["1p"] || {}).forEach(([kva, id]) => {
    master.push({ id, name: `TR ${kva} 1P`, unit: "ตู้", matPrice: Number(kva) * 1500, labPrice: 40000 });
  });
  Object.entries(catalog["3p"] || {}).forEach(([kva, id]) => {
    master.push({ id, name: `TR ${kva} 3P`, unit: "ตู้", matPrice: Number(kva) * 1500, labPrice: 40000 });
  });

  const quote = Engine.buildQuote(intent, master);
  assert("quote ok", quote.ok === true);
  assert("max kva > 100", Number(quote.bundle?.kva) > 100);
  assert("multiple units or large tr", Number(quote.bundle?.maxUnits) >= 1);
  const breakdownText = Array.isArray(quote.poleBreakdown) ? quote.poleBreakdown.join(" ") : "";
  assert("mentions units", /เครื่อง/.test(breakdownText));
});

runCase("tr_budget — 5M หม้อแปลง 30 กี่เครื่อง", () => {
  const q = "มีงบ 5 ล้านบาท ติดหม้อแปลง 30 ได้กี่เครื่อง";
  const intent = Engine.sanitizeIntent(Engine.parseQueryLocal(q, "01.1"), q);
  assert("tr_budget_check", intent.intent === "tr_budget_check");
  assert("budget 5M", Number(intent.budgetBaht) === 5000000);
  assert("kva 30", Number(intent.kva) === 30);
  assert("wants units", intent.wantsUnitCount === true);
  assert("not max size", intent.wantsMaxSize !== true);

  const catalog = sandbox.window.PRICE_QUOTE_CATALOG?.TRANSFORMER_BY_KVA || {};
  const master = [{ id: "1000010012", name: "POLE", unit: "ต้น", matPrice: 8000, labPrice: 3000 }];
  Object.entries(catalog["1p"] || {}).forEach(([kva, id]) => {
    master.push({ id, name: `TR ${kva} 1P`, unit: "ตู้", matPrice: Number(kva) * 1500, labPrice: 40000 });
  });
  Object.entries(catalog["3p"] || {}).forEach(([kva, id]) => {
    master.push({ id, name: `TR ${kva} 3P`, unit: "ตู้", matPrice: Number(kva) * 1500, labPrice: 40000 });
  });

  const quote = Engine.buildQuote(intent, master);
  assert("quote ok", quote.ok === true);
  assert("kva 30 not 2000", Number(quote.bundle?.kva) === 30);
  assert("many units", Number(quote.bundle?.maxUnits) > 2);
  assert("fixed kva mode", quote.bundle?.fixedKvaUnits === true);
  const breakdownText = Array.isArray(quote.poleBreakdown) ? quote.poleBreakdown.join(" ") : "";
  assert("no 2000 kVA", !/2000\s*kva/i.test(breakdownText));
  assert("mentions 30 kVA", /30\s*kva/i.test(breakdownText));
});

runCase("tr_install — 315 kVA platform + SET 40212", () => {
  const q = "ประเมินราคาติดตั้งหม้อแปลงขนาด 315 kVA (ระบบ 3 เฟส) พร้อมอุปกรณ์ประกอบ";
  const intent = Engine.sanitizeIntent(Engine.parseQueryLocal(q, "02.2"), q);
  assert("tr_install", intent.intent === "tr_install");
  assert("kva 315", Number(intent.kva) === 315);
  assert("platform", intent.installType === "platform");
  assert("set 40212", intent.trSetId === "40212");
  assert("include set", intent.includeTrSet === true);

  const setObj = sandbox.window.SurveyPresetsApi.getSet("40212");
  const master = [{ id: "1000010012", name: "POLE", unit: "ต้น", matPrice: 8000, labPrice: 3000 }];
  master.push({ id: "1050010070", name: "TR315", unit: "ตู้", matPrice: 516300, labPrice: 11059 });
  (setObj?.items || []).forEach(entry => {
    master.push({
      id: entry.id,
      name: `ITEM ${entry.id}`,
      unit: "ชิ้น",
      matPrice: 500,
      labPrice: 50
    });
  });

  const quote = Engine.buildQuote(intent, master);
  assert("quote ok", quote.ok === true);
  assert("many lines", quote.lines.length > 10);
  assert("has tr set bundle", quote.bundle?.trSetId === "40212");
  assert("not transformer only", quote.lines.length > 1);
});

runCase("preferLocalTrInstall — Gemini material_only → local install", () => {
  const q = "ประเมินราคาติดตั้งหม้อแปลง 315 kVA 3 เฟส";
  const aiIntent = {
    intent: "material_only",
    budgetType: "02.2",
    items: [{ materialId: "1050010070", qty: 1, laborHint: "ติดตั้ง" }],
    summary: q,
    source: "gemini-lite"
  };
  const preferred = Engine.preferLocalTrInstallIntent(q, "02.2", aiIntent, "gemini-lite");
  assert("upgraded", preferred.intent.intent === "tr_install");
  assert("platform", preferred.intent.installType === "platform");
  assert("local source", preferred.parseSource === "local");
});

runCase("tr_install — 50 kVA คำพ้องชุดติดตั้ง", () => {
  const cases = [
    ["ชุดติดตั้ง", "หม้อแปลง 50 + ชุดติดตั้งราคาเท่าไร"],
    ["อุปกรณ์ประกอบ", "หม้อแปลง 50 + อุปกรณ์ประกอบ ราคาเท่าไร"],
    ["พร้อมชุดประกอบ", "หม้อแปลง 50 kVA พร้อมชุดประกอบ ราคาเท่าไร"],
    ["รวมอุปกรณ์", "หม้อแปลง 50 kVA รวมอุปกรณ์ ราคาเท่าไร"],
    ["SET", "หม้อแปลง 50 kVA + SET ราคา"]
  ];

  cases.forEach(([label, q]) => {
    const intent = Engine.sanitizeIntent(Engine.parseQueryLocal(q, "02.2"), q);
    assert(`${label} → tr_install`, intent.intent === "tr_install");
    assert(`${label} → set 40205`, intent.trSetId === "40205");
    assert(`${label} → singlePole`, intent.installType === "singlePole");
    assert(`${label} → includeTrSet`, intent.includeTrSet === true);
  });

  const aiIntent = {
    intent: "material_only",
    budgetType: "02.2",
    items: [{ materialId: "1050010066", qty: 1, laborHint: "ติดตั้ง" }],
    summary: "หม้อแปลง 50 kVA พร้อมชุดประกอบ ราคาเท่าไร",
    source: "gemini-lite"
  };
  const preferred = Engine.preferLocalTrInstallIntent(
    "หม้อแปลง 50 kVA พร้อมชุดประกอบ ราคาเท่าไร",
    "02.2",
    aiIntent,
    "gemini-lite"
  );
  assert("gemini coerce tr_install", preferred.intent.intent === "tr_install");
  assert("gemini coerce 40205", preferred.intent.trSetId === "40205");
});

runCase("manhole — หลายแบบใน master ต้องให้เลือก", () => {
  const master = [
    { id: "9020010001", name: "MANHOLE 2T-1 WITH PILE IB1-020/34009", unit: "ชุด", matPrice: 165200, labPrice: 62885 },
    { id: "9020010002", name: "MANHOLE 2T-2 WITH PILE IB1-020/34010", unit: "ชุด", matPrice: 170000, labPrice: 60000 },
    { id: "9020010003", name: "MANHOLE 3T-1 WITH PILE", unit: "ชุด", matPrice: 180000, labPrice: 65000 }
  ];
  const q = "ขอราคา manhole";
  const intent = Engine.sanitizeIntent(Engine.parseQueryLocal(q, "02.2"), q);
  assert("local material", intent.intent === "material_only");
  assert("search key", intent.materialSearchKey === "manhole");

  const blocked = Engine.buildQuote(intent, master);
  assert("needs pick", blocked.ok === false);
  assert("material_pick", blocked.clarificationType === "material_pick");
  assert("3 candidates", (blocked.intent?.materialCandidates || []).length === 3);

  const picked = Engine.mergeMaterialIntent(blocked.intent, { materialId: "9020010002" });
  const quote = Engine.buildQuote(picked, master);
  assert("quote ok", quote.ok === true);
  assert("picked id", quote.lines[0]?.materialId === "9020010002");

  const specific = Engine.sanitizeIntent(Engine.parseQueryLocal("ขอราคา manhole 2t-2", "02.2"), "ขอราคา manhole 2t-2");
  const autoQuote = Engine.buildQuote(specific, master);
  assert("auto narrow ok", autoQuote.ok === true);
  assert("auto narrow id", autoQuote.lines[0]?.materialId === "9020010002");
});

runCase("budget_capacity — 100k + 300m LV 3P", () => {
  const q = "มีเงิน 1 แสนบาท ขยายเขตแรงต่ำ 300 เมตร 3 เฟส พอไหม";
  const intent = Engine.sanitizeIntent(Engine.parseQueryLocal(q, "01.1"), q);
  assert("budget_capacity", intent.intent === "budget_capacity");
  assert("target 300m", Number(intent.targetDistanceM) === 300);
  assert("phase 3p", intent.phase === "3p");
  assert("ready", intent.needsClarification === false);
});

runCase("parseQueryLocal — คำถามกว้างๆ คืน null (ให้ Gemini)", () => {
  const intent = Engine.parseQueryLocal("ราคาพวงโยงชุดนี้เท่าไหร่ครับ", "01.1");
  assert("returns null", intent === null);
});

runCase("mergeTrIntent — เลือก 50 kVA", () => {
  const merged = Engine.mergeTrIntent(
    { intent: "tr_install", budgetType: "01.1", summary: "ติดตั้งหม้อแปลง" },
    { kva: 50 }
  );
  assert("kva 50", merged.kva === 50);
  assert("phase 3p", merged.phase === "3p");
  assert("has transformerId", Boolean(merged.transformerId));
  assert("ready", merged.needsClarification === false);
});

runCase("layout — 200m → 6 ต้น (span 40m)", () => {
  const layout = Pole.computePoleLayout(200, { spanStraightM: 40 });
  assert("6 poles", layout.totalPoles === 6);
});

runCase("pole material only — 12.20m 1 ต้น ไม่เอาหัวเสา", () => {
  const q = "ปักเสา 12.20 อย่างเดียวจำนวน 1 ต้น ไม่เอาหัวเสา ราคากี่บาท";
  const intent = Engine.sanitizeIntent(Engine.parseQueryLocal(q, "02.1"), q);
  assert("pole_run", intent.intent === "pole_run");
  assert("scope pole_only", intent.scope === "pole_only");
  assert("assembly pole_material", intent.assemblyMode === "pole_material");
  assert("includeHead false", intent.includeHead === false);
  assert("poleCount 1", Number(intent.poleCount) === 1);
  assert("height 12.2", Number(intent.poleHeightM) === 12.2);

  const master = [{ id: "1000010012", name: "POLE 12.20", unit: "ต้น", matPrice: 1000, labPrice: 500 }];
  const quote = Engine.buildQuote(
    Engine.mergePoleIntent(intent, { voltage: "mv", phase: "3p" }),
    master
  );
  assert("quote ok", quote.ok === true);
  assert("single pole line", quote.lines.length === 1);
  assert("pole id", quote.lines[0].materialId === "1000010012");
  const breakdownText = Array.isArray(quote.breakdown)
    ? quote.breakdown.join(" ")
    : String(quote.breakdown || "");
  assert("no set in breakdown", !breakdownText.includes("หัวเสา SET"));
});

runCase("pole + concrete — เสา 12.2 + เทโคน", () => {
  const q = "ปักเสา 12.2 ม. 1 ต้น พร้อมเทโคน ไม่เอาหัวเสา";
  const intent = Engine.sanitizeIntent(Engine.parseQueryLocal(q, "02.1"), q);
  assert("pole_concrete", intent.assemblyMode === "pole_concrete");
  assert("includeConcrete", intent.includeConcrete === true);
});

runCase("budget formula — 02.2 includes profit", () => {
  const totals = sandbox.window.BudgetFormula.computeBudgetTotals(100000, 8000, "2.2");
  assert("normalize type", totals.budgetType === "02.2");
  assert("profit > 0", totals.profit > 0);
  assert("total > preFinal", totals.total > totals.preFinal);
});

runCase("budget formula — 01.1 no profit", () => {
  const totals = sandbox.window.BudgetFormula.computeBudgetTotals(100000, 8000, "01.1");
  assert("no profit", totals.profit === 0);
});

runCase("concrete only — เทโคนเสา 10 จุด", () => {
  const q = "เทโคนเสา 10 จุด ราคาเท่าไร";
  const intent = Engine.sanitizeIntent(Engine.parseQueryLocal(q, "02.1"), q);
  assert("material_only", intent.intent === "material_only");
  assert("qty 10", intent.items?.[0]?.qty === 10);
  assert("concrete id", intent.items?.[0]?.materialId === "9090010025");
  assert("no clarification", intent.needsClarification === false);
  assert("not pole_run", intent.intent !== "pole_run");
});

runCase("budget 2M — เสา 12.2m อย่างเดียว ได้กี่ต้น", () => {
  const q = "มีเงิน 2 ล้านบาทจะปักเสาขนาด 12.20 เมตรอย่างเดียวไม่เอาพาดสายไฟได้กี่ต้น";
  const intent = Engine.sanitizeIntent(Engine.parseQueryLocal(q, "02.1"), q);
  assert("budget_capacity", intent.intent === "budget_capacity");
  assert("budget 2M", Number(intent.budgetBaht) === 2000000);
  assert("capacityMode poles", intent.capacityMode === "poles");
  assert("scope pole_only", intent.scope === "pole_only");
  assert("assembly pole_material", intent.assemblyMode === "pole_material");
  assert("height 12.2", Number(intent.poleHeightM) === 12.2);
  assert("no clarification", intent.needsClarification === false);

  const polePrice = 8000;
  const poleLab = 3000;
  const master = [{ id: "1000010012", name: "POLE 12.20", unit: "ต้น", matPrice: polePrice, labPrice: poleLab }];
  const quote = Engine.buildQuote(intent, master);
  assert("quote ok", quote.ok === true);
  assert("many poles", (quote.bundle?.poleCount || 0) > 100);
  const breakdownText = Array.isArray(quote.poleBreakdown)
    ? quote.poleBreakdown.join(" ")
    : String(quote.poleBreakdown || "");
  assert("no wire line", !/102005|สายหุ้ม|สายเปล/.test(breakdownText));
  assert("no concrete", !breakdownText.includes("เทโคน"));
});

runCase("parseBudgetBaht — ล้าน และ แสน", () => {
  assert("2 ล้าน", Pole.parseBudgetBaht("มีเงิน 2 ล้านบาท") === 2000000);
  assert("1.5 ล้าน", Pole.parseBudgetBaht("งบ 1.5 ล้าน") === 1500000);
  assert("1 แสน", Pole.parseBudgetBaht("มีเงิน 1 แสนบาท") === 100000);
});

runCase("glossary — เทโคน match", () => {
  const hints = Nlu.extractHints("เทโคนเสา 10 จุด");
  assert("material concrete", hints.materialMatches.some(m => m.materialId === "9090010025"));
  assert("intent concrete_only", hints.intentMatches.some(m => m.key === "concrete_only"));
});

runCase("glossary — enrich master keywords", () => {
  const enriched = Nlu.enrichMasterItem({ id: "9090010025", name: "CONCRETE 1/3/5" });
  assert("has keywordsTh", Array.isArray(enriched.keywordsTh) && enriched.keywordsTh.includes("เทโคน"));
  assert("category concrete", enriched.category === "concrete");
});

runCase("LV 1 pole with wire — must clarify phase", () => {
  const q = "ขยายเขตเสาแรงต่ำ 1 ต้on พร้อมพาดสายกี่บาท";
  const intent = Engine.sanitizeIntent(Engine.parseQueryLocal(q, "02.1"), q);
  assert("needs clarify", intent.needsClarification === true);
  assert("pole_run", intent.intent === "pole_run");
  assert("lv voltage", intent.voltage === "lv");
  assert("no auto phase", !intent.phase);
});

runCase("confidence — line lv explicit high", () => {
  const q = "ขยายเขตแรงต่ำ ระยะทาง 200 เมตร 3 เฟส";
  const intent = Engine.sanitizeIntent(Engine.parseQueryLocal(q, "01.1"), q);
  assert("has confidence", typeof intent.parseConfidence === "number");
  assert("high or medium", ["high", "medium"].includes(intent.confidenceLevel));
});

runCase("feedback — log wrong + stats", () => {
  sandbox.localStorage.removeItem(Feedback.STORAGE_KEY);
  Feedback.logFeedback({ verdict: "wrong", query: "ทดสอบ", note: "ควรเป็นเทโคน" });
  const stats = Feedback.stats();
  assert("wrong count", stats.wrong === 1);
  assert("list has entry", Feedback.list().length === 1);
});

runCase("golden queries — จาก glossary", () => {
  (Glossary.goldenQueries || []).forEach(caseDef => {
    const intent = Engine.sanitizeIntent(
      Engine.parseQueryLocal(caseDef.query, caseDef.budgetType),
      caseDef.query
    );
    const exp = caseDef.expect || {};
    Object.entries(exp).forEach(([key, value]) => {
      if (key === "qty") {
        assert(`${caseDef.name} qty`, intent.items?.[0]?.qty === value);
        return;
      }
      if (key === "materialId") {
        assert(`${caseDef.name} materialId`, intent.items?.[0]?.materialId === value);
        return;
      }
      assert(`${caseDef.name} ${key}`, intent[key] === value, `got ${intent[key]}`);
    });
  });
});

console.log(`\n--- สรุป: ${passed} passed, ${failed} failed ---`);
process.exit(failed > 0 ? 1 : 0);
