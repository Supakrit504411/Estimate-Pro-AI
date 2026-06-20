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
vm.createContext(sandbox);

load("budget-formula.js");
load("price-quote-catalog.js");
load("price-quote-pole.js");
load("price-quote-engine.js");

const Engine = sandbox.window.PriceQuoteEngine;
const Pole = sandbox.window.PriceQuotePole;

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

console.log(`\n--- สรุป: ${passed} passed, ${failed} failed ---`);
process.exit(failed > 0 ? 1 : 0);
