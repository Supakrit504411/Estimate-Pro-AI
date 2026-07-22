(function () {
  const BUDGET_TYPES = ["01.1", "02.1", "02.2", "03.1"];
  const TRANSFORMER_KWS = ["หม้อแปลง", "transformer", "แปล", "tr."];

  function normalizeText(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function findMasterItem(master, materialId) {
    const id = String(materialId || "").trim();
    return master.find(item => String(item.id) === id) || null;
  }

  function pickLaborOption(item, laborHint) {
    const options = item.laborOptions || [];
    if (!options.length) {
      return { desc: "ค่าแรงมาตรฐาน", price: item.labPrice || 0 };
    }
    const hint = normalizeText(laborHint);
    if (hint) {
      const matched = options.find(opt => normalizeText(opt.desc).includes(hint));
      if (matched) return matched;
    }
    return options[0];
  }

  function calculateQuoteTotal(lines, budgetType) {
    let material = 0;
    let labor = 0;

    lines.forEach(line => {
      material += line.matPrice * line.qty;
      labor += line.labPrice * line.qty;
    });

    const formula = window.BudgetFormula?.computeBudgetTotals
      ? window.BudgetFormula.computeBudgetTotals(material, labor, budgetType)
      : null;

    if (formula) return formula;

    const supervision = labor * 0.3;
    const transport = material * 0.05;
    const subtotal = material + labor + supervision + transport;
    const misc = subtotal * 0.05;
    const overhead = (subtotal + misc) * 0.05;
    const preFinal = subtotal + misc + overhead;
    const profit = budgetType === "02.2" ? preFinal * 0.3 : 0;
    let total = preFinal + profit;
    if (budgetType === "03.1") total *= 0.5;

    return {
      material,
      labor,
      supervision,
      transport,
      misc,
      overhead,
      profit,
      preFinal,
      total
    };
  }

  function findTransformerByKva(kva, phaseHint, seriesHint) {
    const phase = phaseHint || "3p";
    const catalog = window.PRICE_QUOTE_CATALOG || {};
    const useLegacy = seriesHint === "legacy";
    const map = useLegacy
      ? catalog.TRANSFORMER_BY_KVA_LEGACY
      : catalog.TRANSFORMER_BY_KVA;
    const fromCatalog = map?.[phase]?.[kva];
    if (fromCatalog) {
      return { id: fromCatalog, kva, phase, series: useLegacy ? "legacy" : "current" };
    }

    const api = window.SurveyPresetsApi;
    const list = api?.getTransformers?.() || window.SURVEY_PRESETS?.transformers || [];
    if (!list.length) return null;

    const exact = list.find(item => item.kva === kva && item.phase === phase);
    if (exact) return exact;

    const samePhase = list
      .filter(item => item.phase === phase)
      .sort((a, b) => Math.abs(a.kva - kva) - Math.abs(b.kva - kva));
    return samePhase[0] || null;
  }

  function detectTransformerSeries(query) {
    const text = normalizeText(query || "");
    if (/0\.4\/0\.23|0\.4-0\.23|105001005|serie\s*เก่า|legacy/.test(text)) return "legacy";
    if (/0\.416|0\.416\/0\.24|105001006|serie\s*ใหม่/.test(text)) return "current";
    return "current";
  }

  function normalizeInstallType(value) {
    return value === "platform" ? "platform" : "singlePole";
  }

  function resolveDefaultTrSetId(installType, phase, kva) {
    const catalog = window.SurveyPresetsApi?.getTrInstallCatalog?.()
      || window.SURVEY_PRESETS?.trInstallCatalog;
    if (!catalog) return null;

    const key = normalizeInstallType(installType);
    const group = catalog[key]?.[phase || "3p"];
    if (!group) return null;

    if (group.defaultSetId) return group.defaultSetId;
    return (group.setIds || [])[0] || null;
  }

  function isTrInstallLanguage(text) {
    return wantsTrInstallSet(text);
  }

  function wantsTrInstallSet(text) {
    const t = normalizeText(text);
    return /ติดตั้ง|install|ประเมินราคา|ราคาติดตั้ง|ชุดติดตั้ง|ชุดประกอบ|รวมชุด|พร้อมชุด|อุปกรณ์ประกอบ|อุปกรณ์ครบ|พร้อมอุปกรณ์|รวมอุปกรณ์|assembly|แอสเซมบลี|\bset\b|tr\.?\s*inst|ชุด\s*\d{5}/.test(t);
  }

  function inferPhaseFromQuery(text, kva, fallback) {
    const t = normalizeText(text);
    if (/1p|1 p|single|เฟสเดียว|1\s*เฟส/.test(t)) return "1p";
    if (/3p|3 p|three|สามเฟส|3\s*เฟส/.test(t)) return "3p";
    if (kva === 30) return "1p";
    return fallback || "3p";
  }

  function resolveTrInstallTypeForKva(kva, phase, series, queryText) {
    const text = normalizeText(queryText || "");
    if (/platform|ยก|แพลต|แพลตฟอร์ม/.test(text)) return "platform";
    if (/single\s*pole|เสาเดี่ยว|single_pole/.test(text)) return "singlePole";

    const catalog = window.SurveyPresetsApi?.getTrInstallCatalog?.()
      || window.SURVEY_PRESETS?.trInstallCatalog;
    const normalizedPhase = phase || (kva === 30 ? "1p" : "3p");
    const transformer = findTransformerByKva(kva, normalizedPhase, series);
    if (catalog && transformer?.id) {
      const inSingle = catalog.singlePole?.[normalizedPhase]?.transformerIds?.includes(transformer.id);
      const inPlatform = catalog.platform?.[normalizedPhase]?.transformerIds?.includes(transformer.id);
      if (inSingle && inPlatform) {
        return kva >= 315 ? "platform" : "singlePole";
      }
      if (inPlatform) return "platform";
      if (inSingle) return "singlePole";
    }
    return kva >= 315 ? "platform" : "singlePole";
  }

  function applyTrInstallDefaults(intent, query) {
    const kva = Number(intent.kva);
    if (!kva) return intent;

    const phase = inferPhaseFromQuery(query || intent.summary || "", kva, intent.phase);
    const series = detectTransformerSeries(query || intent.summary || "");
    const installType = resolveTrInstallTypeForKva(kva, phase, series, query || intent.summary || "");

    intent.phase = phase;
    intent.installType = installType;
    intent.includeTrSet = intent.includeTrSet !== false;
    intent.trSetId = intent.trSetId || resolveDefaultTrSetId(installType, phase, kva);

    if (normalizeInstallType(installType) === "singlePole") {
      intent.poleMaterialId = intent.poleMaterialId || "1000010012";
      intent.poleQty = Number(intent.poleQty) || 1;
    } else {
      delete intent.poleMaterialId;
      intent.poleQty = 0;
    }
    return intent;
  }

  function preferLocalTrInstallIntent(query, budgetType, intent, parseSource) {
    const aiWeak = !intent
      || intent.intent === "material_only"
      || parseSource === "gemini"
      || parseSource === "gemini-lite";

    const local = parseQueryLocal(query, budgetType);
    if (local) {
      const localSanitized = sanitizeIntent(local, query);
      const localStrong = localSanitized?.intent === "tr_install" && localSanitized.includeTrSet !== false;
      if (localStrong && aiWeak) {
        return { intent: localSanitized, parseSource: localSanitized.source || "local" };
      }
    }

    if (intent && query && aiWeak) {
      const coerced = sanitizeIntent({ ...intent, summary: query }, query);
      if (coerced?.intent === "tr_install" && coerced.includeTrSet !== false) {
        return { intent: coerced, parseSource: "local" };
      }
    }

    return { intent, parseSource };
  }

  function searchMaster(master, terms, limit = 12) {
    const tokens = (terms || [])
      .map(normalizeText)
      .filter(Boolean);
    if (!tokens.length) return [];

    return master
      .map(item => {
        const hay = normalizeText(`${item.id} ${item.name}`);
        const score = tokens.reduce((acc, token) => acc + (hay.includes(token) ? 1 : 0), 0);
        return { item, score };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(entry => entry.item);
  }

  function searchMasterByKeyword(master, keyword, limit = 50) {
    const token = normalizeText(keyword);
    if (!token) return [];
    return (master || [])
      .filter(item => normalizeText(`${item.id} ${item.name}`).includes(token))
      .slice(0, limit);
  }

  function getMaterialKeywordDefs() {
    return window.PRICE_ASK_GLOSSARY?.materialKeywords || {};
  }

  function detectMaterialSearchKeyword(text) {
    const t = normalizeText(text);
    let best = null;
    Object.entries(getMaterialKeywordDefs()).forEach(([key, def]) => {
      const terms = [key, ...(def.searchTerms || [])];
      terms.forEach(term => {
        const normalized = normalizeText(term);
        if (!normalized || !t.includes(normalized)) return;
        if (!best || normalized.length > best.matchLength) {
          best = { key, def, matchLength: normalized.length };
        }
      });
    });
    return best;
  }

  function collectMaterialCandidates(master, materialKey, def) {
    const terms = [materialKey, ...(def?.searchTerms || [])];
    const seen = new Set();
    const results = [];
    terms.forEach(term => {
      searchMasterByKeyword(master, term, 80).forEach(item => {
        if (seen.has(item.id)) return;
        seen.add(item.id);
        results.push(item);
      });
    });
    return results.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  function queryNarrowsToSingleMaterial(text, candidates) {
    const t = normalizeText(text);
    const narrowed = (candidates || []).filter(item => {
      const hay = normalizeText(`${item.id} ${item.name}`);
      const tokens = hay.split(/[^a-z0-9./-]+/).filter(tok =>
        tok.length >= 3
        && !["manhole", "with", "pile", "ib1"].includes(tok)
      );
      return tokens.some(tok => t.includes(tok));
    });
    return narrowed.length === 1 ? narrowed[0] : null;
  }

  function buildMaterialClarificationFields(intent) {
    const candidates = intent.materialCandidates || [];
    return [{
      key: "materialId",
      label: "เลือกรายการพัสดุ",
      type: "select",
      options: candidates.map(item => ({
        value: String(item.id),
        label: `${item.id} — ${item.name}`
      }))
    }];
  }

  function mergeMaterialIntent(intent, answers = {}) {
    const materialId = String(answers.materialId || intent.items?.[0]?.materialId || "").trim();
    return sanitizeIntent({
      ...intent,
      intent: "material_only",
      items: [{
        materialId,
        qty: Number(intent.items?.[0]?.qty) || 1,
        laborHint: intent.items?.[0]?.laborHint || intent.laborHint || "ติดตั้ง"
      }],
      userConfirmedMaterialId: true,
      needsClarification: false,
      clarificationType: null,
      clarificationFields: [],
      clarificationQuestion: null,
      materialCandidates: null
    }, intent.summary || "");
  }

  function resolveMaterialAmbiguity(intent, master, query) {
    if (!intent || intent.intent !== "material_only" || !master?.length) return intent;
    if (intent.userConfirmedMaterialId && intent.items?.[0]?.materialId) return intent;

    const text = normalizeText(query || intent.summary || "");
    const keywordHit = intent.materialSearchKey
      ? { key: intent.materialSearchKey, def: getMaterialKeywordDefs()[intent.materialSearchKey] }
      : detectMaterialSearchKeyword(text);

    let candidates = intent.materialCandidates?.length
      ? intent.materialCandidates
      : (keywordHit ? collectMaterialCandidates(master, keywordHit.key, keywordHit.def) : []);

    if (!candidates.length && intent.items?.[0]?.searchTerms?.length) {
      candidates = searchMaster(master, intent.items[0].searchTerms, 50);
    }

    if (!candidates.length) return intent;

    const narrowed = queryNarrowsToSingleMaterial(text, candidates);
    if (narrowed) {
      intent.items = [{
        materialId: narrowed.id,
        qty: Number(intent.items?.[0]?.qty) || 1,
        laborHint: intent.items?.[0]?.laborHint || intent.laborHint || "ติดตั้ง"
      }];
      intent.materialSearchKey = keywordHit?.key || intent.materialSearchKey || null;
      intent.needsClarification = false;
      intent.bundleNote = candidates.length > 1
        ? `ระบุจากคำถาม → ${narrowed.id} (มี ${candidates.length} แบบใน master)`
        : null;
      return intent;
    }

    if (candidates.length === 1) {
      intent.items = [{
        materialId: candidates[0].id,
        qty: Number(intent.items?.[0]?.qty) || 1,
        laborHint: intent.items?.[0]?.laborHint || intent.laborHint || "ติดตั้ง"
      }];
      intent.needsClarification = false;
      return intent;
    }

    const presetId = intent.items?.[0]?.materialId;
    if (presetId && candidates.some(item => String(item.id) === String(presetId)) && !keywordHit) {
      return intent;
    }

    intent.needsClarification = true;
    intent.clarificationType = "material_pick";
    intent.materialCandidates = candidates;
    intent.materialSearchKey = keywordHit?.key || intent.materialSearchKey || null;
    intent.clarificationFields = buildMaterialClarificationFields(intent);
    intent.clarificationQuestion = `พบ ${keywordHit?.def?.label || keywordHit?.key || "พัสดุ"} ${candidates.length} แบบใน master — เลือกรายการที่ต้องการ (ไม่เดาให้อัตโนมัติ)`;
    return intent;
  }

  function mergeLineMap(lineMap, materialId, qty, laborHint, master) {
    const item = findMasterItem(master, materialId);
    if (!item) return;

    const labor = pickLaborOption(item, laborHint);
    const key = `${materialId}::${labor.desc}`;
    const existing = lineMap.get(key);
    if (existing) {
      existing.qty += qty;
      return;
    }

    lineMap.set(key, {
      materialId: item.id,
      name: item.name,
      unit: item.unit,
      qty,
      matPrice: item.matPrice,
      labPrice: labor.price,
      laborDesc: labor.desc,
      lineTotal: (item.matPrice + labor.price) * qty
    });
  }

  function buildTrInstallLines(intent, master) {
    const kva = Number(intent.kva);
    const phase = intent.phase || (kva >= 50 ? "3p" : "1p");
    const installType = normalizeInstallType(intent.installType);
    const transformer = intent.transformerId
      ? { id: intent.transformerId }
      : findTransformerByKva(kva, phase, intent.transformerSeries);

    if (!transformer?.id) {
      return { error: `ไม่พบหม้อแปลง ${kva || "?"} kVA (${phase}) ใน catalog` };
    }

    const setId = intent.trSetId || resolveDefaultTrSetId(installType, phase, kva);
    const setObj = window.SurveyPresetsApi?.getSet?.(setId)
      || window.SURVEY_PRESETS?.sets?.[setId];

    const lineMap = new Map();
    mergeLineMap(lineMap, transformer.id, 1, intent.laborHint || "ติดตั้ง", master);

    if (intent.includeTrSet !== false && setObj?.items?.length) {
      setObj.items.forEach(entry => {
        mergeLineMap(lineMap, entry.id, Number(entry.qty) || 1, intent.laborHint || "ติดตั้ง", master);
      });
    }

    if (intent.poleMaterialId) {
      mergeLineMap(
        lineMap,
        intent.poleMaterialId,
        Number(intent.poleQty) || 1,
        intent.laborHint || "ติดตั้ง",
        master
      );
    }

    (intent.extraItems || []).forEach(entry => {
      if (!entry.materialId) return;
      mergeLineMap(
        lineMap,
        entry.materialId,
        Number(entry.qty) || 1,
        entry.laborHint || intent.laborHint || "ติดตั้ง",
        master
      );
    });

    const lines = Array.from(lineMap.values()).map(line => ({
      ...line,
      lineTotal: (line.matPrice + line.labPrice) * line.qty
    }));

    const missing = lines.filter(line => !findMasterItem(master, line.materialId));
    return {
      lines,
      transformerId: transformer.id,
      trSetId: setId,
      trSetName: setObj?.name || "",
      poleMaterialId: intent.poleMaterialId || null,
      poleQty: intent.poleMaterialId ? (Number(intent.poleQty) || 1) : 0,
      missingCount: missing.length
    };
  }

  function buildMaterialLines(intent, master) {
    const lineMap = new Map();

    (intent.items || []).forEach(entry => {
      if (entry.materialId) {
        mergeLineMap(
          lineMap,
          entry.materialId,
          Number(entry.qty) || 1,
          entry.laborHint || intent.laborHint,
          master
        );
        return;
      }

      const hits = searchMaster(master, entry.searchTerms || [], 1);
      if (hits[0]) {
        mergeLineMap(
          lineMap,
          hits[0].id,
          Number(entry.qty) || 1,
          entry.laborHint || intent.laborHint,
          master
        );
      }
    });

    return {
      lines: Array.from(lineMap.values()).map(line => ({
        ...line,
        lineTotal: (line.matPrice + line.labPrice) * line.qty
      }))
    };
  }

  function getFaqCatalog() {
    return (window.APP_CONFIG && window.APP_CONFIG.priceFaq) || {};
  }

  function buildIntentFromFaq(faqId, budgetType = "01.1") {
    const faq = getFaqCatalog()[faqId];
    if (!faq?.intent) return null;
    return {
      ...JSON.parse(JSON.stringify(faq.intent)),
      budgetType,
      summary: faq.example || faq.label,
      source: "faq",
      faqId
    };
  }

  function matchFaqByQuery(query, budgetType = "01.1") {
    const text = normalizeText(query);
    const catalog = getFaqCatalog();
    let best = null;
    let bestScore = 0;

    Object.entries(catalog).forEach(([id, faq]) => {
      const candidates = [faq.label, faq.example, ...(faq.aliases || [])]
        .filter(Boolean)
        .map(normalizeText);
      candidates.forEach(sample => {
        if (!sample || !text) return;
        if (text === sample || text.includes(sample) || sample.includes(text)) {
          const score = sample.length;
          if (score > bestScore) {
            bestScore = score;
            best = id;
          }
        }
      });
    });

    return best ? buildIntentFromFaq(best, budgetType) : null;
  }

  function extractKvaFromQuery(query) {
    const t = normalizeText(query);
    let m = t.match(/(\d+(?:\.\d+)?)\s*kva/);
    if (m) return Number(m[1]);

    const known = new Set();
    const catalog = window.PRICE_QUOTE_CATALOG?.TRANSFORMER_BY_KVA || {};
    Object.values(catalog).forEach(phaseMap => {
      Object.keys(phaseMap || {}).forEach(kva => known.add(Number(kva)));
    });

    const contextual = t.match(
      /(?:หม้อแปลง|แปลงไฟ|ติดหม้อแปลง|ติดตั้งหม้อแปลง|แปลง)\s*(\d+(?:\.\d+)?)(?!\s*(?:ล้าน|แส|บาท|เมตร|ม\.|m\b|ต้น|จุด))/ 
    );
    if (contextual) {
      const kva = Number(contextual[1]);
      if (known.size ? known.has(kva) : kva >= 15 && kva <= 5000) return kva;
    }
    return null;
  }

  const TR_BUDGET_PRESETS = [
    {
      kva: 30,
      phase: "1p",
      installType: "single_pole",
      transformerId: "1050000011",
      trSetId: "40201",
      poleMaterialId: "1000010012",
      poleQty: 1
    },
    {
      kva: 50,
      phase: "3p",
      installType: "single_pole",
      transformerId: "1050010066",
      trSetId: "40205",
      poleMaterialId: "1000010012",
      poleQty: 1
    },
    {
      kva: 100,
      phase: "3p",
      installType: "single_pole",
      transformerId: "1050010067",
      trSetId: "40205",
      poleMaterialId: "1000010012",
      poleQty: 1
    }
  ];

  function buildTrBudgetCandidates(intent) {
    const catalog = window.PRICE_QUOTE_CATALOG?.TRANSFORMER_BY_KVA || {};
    const fromCatalog = [];

    ["1p", "3p"].forEach(phase => {
      Object.entries(catalog[phase] || {}).forEach(([kvaRaw, transformerId]) => {
        const kva = Number(kvaRaw);
        if (!kva || !transformerId) return;
        fromCatalog.push({
          kva,
          phase,
          installType: intent.installType || "single_pole",
          transformerId,
          trSetId: resolveDefaultTrSetId(intent.installType || "single_pole", phase, kva),
          poleMaterialId: intent.poleMaterialId || "1000010012",
          poleQty: Number(intent.poleQty) || 1
        });
      });
    });

    const base = fromCatalog.length ? fromCatalog : TR_BUDGET_PRESETS.map(preset => ({ ...preset }));
    let candidates = base.sort((a, b) => a.kva - b.kva || a.phase.localeCompare(b.phase));

    if (intent.phase) {
      candidates = candidates.filter(item => item.phase === intent.phase);
    }
    if (intent.kva) {
      const series = detectTransformerSeries(intent.summary || "");
      const transformer = findTransformerByKva(intent.kva, intent.phase || "3p", series);
      candidates = [{
        kva: intent.kva,
        phase: intent.phase || transformer?.phase || (intent.kva >= 50 ? "3p" : "1p"),
        installType: intent.installType || "single_pole",
        transformerId: transformer?.id || intent.transformerId || null,
        trSetId: intent.trSetId || resolveDefaultTrSetId(
          intent.installType || "single_pole",
          intent.phase || "3p",
          intent.kva
        ),
        poleMaterialId: intent.poleMaterialId || "1000010012",
        poleQty: Number(intent.poleQty) || 1
      }];
    }

    return candidates;
  }

  function parseBudgetBahtFromQuery(query) {
    return window.PriceQuotePole?.parseBudgetBaht?.(query) ?? null;
  }

  function isTrBudgetQuery(query) {
    const text = normalizeText(query);
    if (!parseBudgetBahtFromQuery(query)) return false;
    if (!window.PriceQuotePole?.isTransformerBudgetQuery?.(text)) return false;
    return /มีเงิน|มีงบ|งบ|พอไหม|เงินพอ|ทำได้ไหม|ขาด|เกิน|ได้ไหม|ทำได้|ได้กี่|กี่ kva|กี่เครื่อง|สูงสุด/.test(text);
  }

  function parseTrBudgetQuery(query, budgetType = "01.1") {
    if (!isTrBudgetQuery(query)) return null;

    const text = normalizeText(query);
    const budgetBaht = parseBudgetBahtFromQuery(query);
    const kva = extractKvaFromQuery(query);
    const phase = /1p|1 p|single|เฟสเดียว|1\s*เฟส/.test(text)
      ? "1p"
      : (/3p|3 p|three|3\s*เฟส/.test(text) ? "3p" : null);
    const wantsUnitCount = /กี่เครื่อง|กี่\s*ตัว|กี่\s*ตู้|ได้กี่เครื่อง|จำนวน.*เครื่อง/.test(text);
    const wantsMaxSize = !kva && /สูงสุด|ใหญ่สุด|max|ขนาดใหญ่|ใหญ่ที่สุด|ขนาดสูงสุด/.test(text);

    return {
      intent: "tr_budget_check",
      budgetType,
      budgetBaht,
      kva,
      phase,
      wantsUnitCount,
      wantsMaxSize,
      includeTrSet: true,
      installType: "single_pole",
      summary: query,
      needsClarification: false,
      source: "local"
    };
  }

  function buildTrBudgetQuote(intent, master) {
    const budgetBaht = Number(intent.budgetBaht);
    const budgetType = BUDGET_TYPES.includes(intent.budgetType) ? intent.budgetType : "01.1";
    if (!budgetBaht || budgetBaht <= 0) {
      return { error: "ไม่พบงบประมาณในคำถาม — ลองระบุ เช่น มีเงิน 50,000 บาท" };
    }

    let candidates = buildTrBudgetCandidates(intent);

    const priced = candidates.map(preset => {
      const trIntent = {
        ...intent,
        ...preset,
        intent: "tr_install",
        includeTrSet: true,
        budgetType
      };
      const trResult = buildTrInstallLines(trIntent, master);
      if (trResult.error || !trResult.lines?.length) return null;
      const totals = calculateQuoteTotal(trResult.lines, budgetType);
      return {
        ...preset,
        trResult,
        lines: trResult.lines,
        total: totals.total
      };
    }).filter(Boolean).sort((a, b) => a.total - b.total);

    if (!priced.length) {
      return { error: "ไม่พบรายการหม้อแปลงที่คำนวณได้ — ลองระบุ kVA เช่น 50 kVA" };
    }

    const fitting = priced.filter(item => item.total <= budgetBaht);
    const cheapest = priced[0];
    const bestFit = fitting.length
      ? fitting.slice().sort((a, b) => b.kva - a.kva || b.total - a.total)[0]
      : null;
    const selected = intent.kva
      ? priced.find(item => item.kva === intent.kva && (!intent.phase || item.phase === intent.phase))
        || priced.find(item => item.kva === intent.kva)
        || priced[0]
      : (bestFit || cheapest);

    if (!selected) {
      return { error: "ไม่พบรายการหม้อแปลงที่คำนวณได้ — ลองระบุ kVA เช่น 50 kVA" };
    }

    const perUnitTotal = selected.total;
    const budgetDelta = budgetBaht - perUnitTotal;
    const enough = perUnitTotal <= budgetBaht;
    const fixedKvaUnits = Boolean(intent.kva && intent.wantsUnitCount);
    const maxKvaUnits = Boolean(!intent.kva && (intent.wantsUnitCount || intent.wantsMaxSize) && bestFit);

    let maxUnits = 1;
    let usedBudget = perUnitTotal;
    let remainingBudget = budgetDelta;

    if (fixedKvaUnits && enough) {
      maxUnits = Math.max(1, Math.floor(budgetBaht / perUnitTotal));
      usedBudget = maxUnits * perUnitTotal;
      remainingBudget = budgetBaht - usedBudget;
    } else if (maxKvaUnits && bestFit?.total > 0) {
      maxUnits = Math.floor(budgetBaht / bestFit.total);
      usedBudget = maxUnits * bestFit.total;
      remainingBudget = budgetBaht - usedBudget;
    }

    const displayItem = fixedKvaUnits || intent.kva ? selected : (bestFit || cheapest);
    const breakdown = [
      `งบที่ถาม: ${budgetBaht.toLocaleString()} บาท · ประมาณการใช้ ${Math.round(displayItem.total).toLocaleString()} บาท/เครื่อง`
    ];

    if (fixedKvaUnits && maxUnits > 0) {
      breakdown.push(`สรุป: ${maxUnits} × ${selected.kva} kVA ${selected.phase.toUpperCase()} = ความจุรวม ~${(maxUnits * selected.kva).toLocaleString()} kVA`);
    } else if (maxKvaUnits && maxUnits > 1) {
      breakdown.push(
        `ความจุรวมสูงสุด ~${(maxUnits * bestFit.kva).toLocaleString()} kVA (${maxUnits} × ${bestFit.kva} kVA ${bestFit.phase.toUpperCase()})`
      );
    }

    if (!intent.kva && fitting.length) {
      const preview = fitting
        .slice()
        .sort((a, b) => b.kva - a.kva)
        .slice(0, 6)
        .reverse()
        .map(item => `${item.kva} kVA ${item.phase.toUpperCase()} (~${Math.round(item.total).toLocaleString()} บาท/เครื่อง)`);
      breakdown.push(`ขนาดที่ติดตั้งได้ในงบนี้ (ต่อเครื่อง): ${preview.join(" · ")}`);
    }

    return {
      lines: displayItem.lines,
      breakdown,
      bundle: {
        type: "tr_budget_check",
        budgetBaht,
        budgetVerdict: enough ? "enough" : "short",
        budgetDelta: fixedKvaUnits || intent.kva ? remainingBudget : (bestFit ? budgetBaht - bestFit.total : budgetBaht - cheapest.total),
        targetTotal: displayItem.total,
        kva: displayItem.kva,
        phase: displayItem.phase,
        maxUnits,
        perUnitTotal: displayItem.total,
        usedBudget,
        remainingBudget,
        fixedKvaUnits,
        wantsMaxSize: Boolean(intent.wantsMaxSize),
        wantsUnitCount: Boolean(intent.wantsUnitCount),
        transformerId: displayItem.trResult.transformerId,
        trSetId: displayItem.trResult.trSetId,
        trSetName: displayItem.trResult.trSetName,
        poleMaterialId: displayItem.trResult.poleMaterialId,
        poleQty: displayItem.trResult.poleQty,
        fittingOptions: fitting.map(item => ({
          kva: item.kva,
          phase: item.phase,
          total: item.total
        }))
      }
    };
  }

  function buildTrClarificationFields(intent) {
    const fields = [];
    if (!intent.kva) {
      fields.push({
        key: "kva",
        label: "ขนาดหม้อแปลง",
        type: "select",
        options: [
          { value: "30", label: "30 kVA (1 เฟส)" },
          { value: "50", label: "50 kVA (3 เฟส)" },
          { value: "100", label: "100 kVA (3 เฟส)" },
          { value: "160", label: "160 kVA (3 เฟส)" },
          { value: "250", label: "250 kVA (3 เฟส)" }
        ]
      });
    }
    const kva = Number(intent.kva);
    if (kva && kva !== 30 && !intent.phase) {
      fields.push({
        key: "phase",
        label: "ระบบเฟส",
        type: "select",
        options: [
          { value: "3p", label: "3 เฟส (3P)" }
        ]
      });
    }
    if (kva === 30 && !intent.phase) {
      intent.phase = "1p";
    }
    return fields;
  }

  function mergeTrIntent(intent, answers = {}) {
    const kva = Number(answers.kva || intent.kva);
    const phase = answers.phase
      || intent.phase
      || (kva === 30 ? "1p" : "3p");
    const merged = {
      ...intent,
      intent: "tr_install",
      kva,
      phase,
      includeTrSet: intent.includeTrSet !== false,
      installType: answers.installType || intent.installType || "single_pole",
      summary: intent.summary || ""
    };
    return sanitizeIntent(merged, merged.summary);
  }

  function validateIntent(intent, query) {
    if (!intent) return null;

    const result = { ...intent };
    const distanceM = Number(result.distanceM);
    const hasDistance = Number.isFinite(distanceM) && distanceM > 0;
    const budgetBaht = Number(result.budgetBaht);

    if (result.intent === "pole_run" || result.intent === "budget_capacity") {
      if (window.PriceQuotePole?.inferVoltagePhaseDefaults) {
        Object.assign(result, window.PriceQuotePole.inferVoltagePhaseDefaults(result));
      }
      if (hasDistance) {
        result.scope = result.scope === "pole_only" ? result.scope : "with_wire";
        if (!result.poleCount) delete result.poleCount;
      }

      const fields = window.PriceQuotePole?.buildClarificationFields?.(result) || [];
      const missing = [];

      if (result.intent === "budget_capacity" && !(budgetBaht > 0)) {
        missing.push("งบประมาณ");
      }
      if (hasDistance || result.scope === "with_wire"
        || (result.intent === "budget_capacity" && result.capacityMode !== "poles")) {
        if (!result.voltage) missing.push("แรงดัน (MV/LV)");
        if (!result.phase) missing.push("ระบบเฟส (1P/3P)");
      } else if (result.intent === "budget_capacity" && result.capacityMode === "poles" && !result.poleHeightM) {
        missing.push("ความสูงเสา (เมตร)");
      }
      if (result.intent === "pole_run" && !hasDistance && !result.poleHeightM && !(Number(result.poleCount) > 0)) {
        missing.push("ระยะทาง (เมตร) หรือจำนวนเสา");
      }
      if (result.voltage === "mv" && result.scope === "with_wire" && !result.cableType && hasDistance) {
        result.cableType = result.cableType || "aerial";
      }

      if (fields.length || missing.length) {
        result.needsClarification = true;
        result.clarificationType = "pole_run";
        result.clarificationFields = fields.length
          ? fields
          : (window.PriceQuotePole?.buildClarificationFields?.(result) || []);
        result.clarificationQuestion = window.PriceQuotePole?.buildClarificationQuestion?.(result)
          || (missing.length ? `กรุณาระบุ: ${missing.join(" · ")}` : "กรุณาระบุรายละเอียดงานเสา");
      } else {
        result.needsClarification = false;
        result.clarificationQuestion = null;
        result.clarificationFields = [];
      }
      return result;
    }

    if (result.intent === "tr_install") {
      const kva = Number(result.kva) || extractKvaFromQuery(query);
      if (!kva) {
        result.needsClarification = true;
        result.clarificationType = "tr_install";
        result.clarificationFields = buildTrClarificationFields(result);
        result.clarificationQuestion = "ระบุขนาดหม้อแปลง (kVA) เพื่อประมาณราคาติดตั้ง";
        return result;
      }

      const phase = result.phase || (kva === 30 ? "1p" : "3p");
      const series = detectTransformerSeries(query || result.summary || "");
      const transformer = findTransformerByKva(kva, phase, series);
      result.kva = kva;
      result.phase = phase;

      if (!transformer?.id) {
        result.needsClarification = true;
        result.clarificationType = "tr_install";
        result.clarificationFields = buildTrClarificationFields({ ...result, kva: null });
        result.clarificationQuestion = `ไม่พบหม้อแปลง ${kva} kVA ใน catalog — เลือกขนาดอื่น`;
        return result;
      }

      result.transformerId = transformer.id;
      applyTrInstallDefaults(result, query || result.summary || "");
      result.needsClarification = false;
      result.clarificationQuestion = null;
      result.clarificationFields = [];
      return result;
    }

    if (result.intent === "tr_budget_check") {
      if (!(budgetBaht > 0)) {
        result.needsClarification = true;
        result.clarificationQuestion = "ไม่พบงบประมาณในคำถาม — ลองระบุ เช่น มีเงิน 50,000 บาท";
        return result;
      }
      result.needsClarification = false;
      return result;
    }

    if (result.intent === "material_only") {
      const hasItem = (result.items || []).some(item => item.materialId || item.searchTerms?.length);
      if (!hasItem) {
        result.needsClarification = true;
        result.clarificationQuestion = "ระบุรหัสพัสดุหรือคำค้นให้ชัด เช่น หม้อแปลง 100 kVA";
        return result;
      }
      result.needsClarification = false;
      return result;
    }

    if (result.intent === "unknown" || !result.intent) {
      result.needsClarification = true;
      result.clarificationQuestion = result.clarificationQuestion
        || "ไม่เข้าใจประเภทงาน — ลองระบุ kVA / ระยะทาง / รหัสพัสดุ";
      return result;
    }

    if (result.needsClarification) {
      result.clarificationQuestion = result.clarificationQuestion || "กรุณาระบุรายละเอียดเพิ่มเติม";
    }
    return result;
  }

  function sanitizeIntent(intent, query) {
    if (!intent) return intent;

    const text = normalizeText(query);
    const kva = extractKvaFromQuery(query) ?? intent.kva;
    const isInstall = isTrInstallLanguage(text)
      || wantsTrInstallSet(text)
      || intent.intent === "tr_install"
      || intent.includeTrSet === true;
    const isTransformer = TRANSFORMER_KWS.some(kw => text.includes(kw))
      || intent.intent === "tr_install"
      || Boolean(intent.kva || intent.transformerId);

    const protectedIntent = ["tr_budget_check", "budget_capacity", "pole_run"].includes(intent.intent);

    if (isTransformer && kva && !protectedIntent) {
      const phase = inferPhaseFromQuery(text, kva, intent.phase);
      const series = detectTransformerSeries(query);
      const transformer = findTransformerByKva(kva, phase, series);
      if (transformer) {
        intent.kva = kva;
        intent.phase = transformer.phase;
        intent.transformerId = transformer.id;
        intent.intent = isInstall ? "tr_install" : "material_only";
        if (isInstall) {
          intent.includeTrSet = true;
          applyTrInstallDefaults(intent, query);
        } else {
          intent.includeTrSet = false;
          intent.items = [{ materialId: transformer.id, qty: 1, laborHint: "ติดตั้ง" }];
        }
        intent.needsClarification = false;
        intent.clarificationQuestion = null;
      }
    }

    if (intent.transformerId && kva) {
      const series = detectTransformerSeries(query);
      const tr = findTransformerByKva(kva, intent.phase || "3p", series);
      if (tr && tr.id !== intent.transformerId) {
        intent.transformerId = tr.id;
        if (intent.items?.length === 1 && intent.items[0].materialId) {
          intent.items[0].materialId = tr.id;
        }
      }
    }

    if (window.PriceQuotePole?.enrichPoleIntentFromQuery) {
      intent = window.PriceQuotePole.enrichPoleIntentFromQuery(intent, query);
    }

    let result = validateIntent(intent, query);
    if (window.PriceAskNlu?.applyConfidenceGate) {
      result = window.PriceAskNlu.applyConfidenceGate(result, query);
    }
    return result;
  }

  function parseQueryLocal(query, budgetType = "01.1") {
    const text = normalizeText(query);

    const glossaryIntent = window.PriceAskNlu?.tryGlossaryIntent?.(query, budgetType);
    if (glossaryIntent) return glossaryIntent;

    if (window.PriceQuotePole?.parsePoleQuery) {
      const poleIntent = window.PriceQuotePole.parsePoleQuery(query, budgetType);
      if (poleIntent) return poleIntent;
    }

    const trBudgetIntent = parseTrBudgetQuery(query, budgetType);
    if (trBudgetIntent) return trBudgetIntent;

    const kvaMatch = text.match(/(\d+(?:\.\d+)?)\s*kva/);
    const kva = extractKvaFromQuery(query) || (kvaMatch ? Number(kvaMatch[1]) : null);
    const isTransformer = TRANSFORMER_KWS.some(kw => text.includes(kw)) || (kva && /kva|หม้อ|transformer|\btr\b/.test(text));
    const isInstall = isTrInstallLanguage(text);
    const isPriceQuery = /ราคา|กี่บาท|เท่าไร|เท่าไหร่|ประเมิน|estimate|cost|price/.test(text);

    if (kva && (isTransformer || isInstall || isPriceQuery)) {
      const phase = inferPhaseFromQuery(text, kva);
      const series = detectTransformerSeries(query);
      const installType = resolveTrInstallTypeForKva(kva, phase, series, query);
      const transformer = findTransformerByKva(kva, phase, series);
      const wantsInstall = wantsTrInstallSet(text);
      return {
        intent: wantsInstall ? "tr_install" : "material_only",
        budgetType,
        kva,
        phase,
        installType,
        includeTrSet: wantsInstall,
        transformerId: transformer?.id || null,
        trSetId: wantsInstall ? resolveDefaultTrSetId(installType, phase, kva) : null,
        poleMaterialId: wantsInstall && normalizeInstallType(installType) === "singlePole" ? "1000010012" : undefined,
        poleQty: wantsInstall && normalizeInstallType(installType) === "singlePole" ? 1 : 0,
        items: transformer ? [{ materialId: transformer.id, qty: 1, laborHint: "ติดตั้ง" }] : [],
        summary: query,
        needsClarification: !transformer,
        clarificationQuestion: transformer ? null : `ไม่พบหม้อแปลง ${kva} kVA — ลองระบุ kVA อื่นหรือ 1P/3P`,
        source: "local"
      };
    }

    const materialIdMatch = text.match(/\b(\d{10})\b/);
    if (materialIdMatch) {
      return {
        intent: "material_only",
        budgetType,
        items: [{ materialId: materialIdMatch[1], qty: 1, laborHint: "ติดตั้ง" }],
        summary: query,
        needsClarification: false,
        source: "local"
      };
    }

    const materialHit = detectMaterialSearchKeyword(text);
    if (materialHit && isPriceQuery) {
      return {
        intent: "material_only",
        budgetType,
        materialSearchKey: materialHit.key,
        items: [{
          qty: 1,
          laborHint: "ติดตั้ง",
          searchTerms: [materialHit.key, ...(materialHit.def.searchTerms || [])]
        }],
        summary: query,
        needsClarification: false,
        source: "local"
      };
    }

    return null;
  }

  function buildQuote(intent, master) {
    if (!intent) {
      return {
        ok: false,
        needsClarification: true,
        question: "กรุณาระบุรายละเอียดเพิ่มเติม"
      };
    }

    if (intent.needsClarification && intent.clarificationType === "pole_run") {
      return {
        ok: false,
        needsClarification: true,
        clarificationType: "pole_run",
        clarificationFields: intent.clarificationFields || [],
        question: intent.clarificationQuestion || "กรุณาระบุรายละเอียดเพิ่มเติม",
        intent
      };
    }

    if (intent.needsClarification && intent.clarificationType === "tr_install") {
      return {
        ok: false,
        needsClarification: true,
        clarificationType: "tr_install",
        clarificationFields: intent.clarificationFields || [],
        question: intent.clarificationQuestion || "กรุณาระบุขนาดหม้อแปลง",
        intent
      };
    }

    if (intent.intent === "material_only") {
      intent = resolveMaterialAmbiguity(intent, master, intent.summary);
    }

    if (intent.needsClarification && intent.clarificationType === "material_pick") {
      return {
        ok: false,
        needsClarification: true,
        clarificationType: "material_pick",
        clarificationFields: intent.clarificationFields || buildMaterialClarificationFields(intent),
        question: intent.clarificationQuestion || "กรุณาเลือกรายการพัสดุ",
        intent
      };
    }

    if (intent.needsClarification) {
      return {
        ok: false,
        needsClarification: true,
        question: intent?.clarificationQuestion || "กรุณาระบุรายละเอียดเพิ่มเติม",
        intent
      };
    }

    const budgetType = BUDGET_TYPES.includes(intent.budgetType) ? intent.budgetType : "01.1";
    let lines = [];
    let bundle = null;
    let poleBreakdown = null;

    if (intent.intent === "budget_capacity" && window.PriceQuotePole?.buildBudgetCapacityQuote) {
      const capResult = window.PriceQuotePole.buildBudgetCapacityQuote(
        intent,
        master,
        mergeLineMap,
        calculateQuoteTotal
      );
      if (capResult.needsClarification || capResult.error) {
        return {
          ok: false,
          needsClarification: Boolean(capResult.needsClarification),
          clarificationType: capResult.needsClarification ? "pole_run" : undefined,
          question: capResult.error || intent.clarificationQuestion,
          intent
        };
      }
      lines = capResult.lines;
      bundle = capResult.bundle;
      poleBreakdown = capResult.breakdown;
    } else if (intent.intent === "tr_budget_check") {
      const trBudgetResult = buildTrBudgetQuote(intent, master);
      if (trBudgetResult.error) {
        return { ok: false, error: trBudgetResult.error, intent };
      }
      lines = trBudgetResult.lines;
      bundle = trBudgetResult.bundle;
      poleBreakdown = trBudgetResult.breakdown;
    } else if (intent.intent === "pole_run" && window.PriceQuotePole?.buildPoleRunLines) {
      const poleResult = window.PriceQuotePole.buildPoleRunLines(intent, master, mergeLineMap);
      if (poleResult.needsClarification || poleResult.error) {
        return {
          ok: false,
          needsClarification: Boolean(poleResult.needsClarification),
          clarificationType: poleResult.needsClarification ? "pole_run" : undefined,
          question: poleResult.error || intent.clarificationQuestion,
          intent
        };
      }
      lines = poleResult.lines;
      bundle = poleResult.bundle;
      poleBreakdown = poleResult.breakdown;
    } else if (intent.intent === "tr_install") {
      const trResult = buildTrInstallLines(intent, master);
      if (trResult.error) {
        return { ok: false, error: trResult.error, intent };
      }
      lines = trResult.lines;
      bundle = {
        type: "tr_install",
        transformerId: trResult.transformerId,
        trSetId: trResult.trSetId,
        trSetName: trResult.trSetName,
        poleMaterialId: trResult.poleMaterialId,
        poleQty: trResult.poleQty,
        missingCount: trResult.missingCount
      };
    } else {
      const materialResult = buildMaterialLines(intent, master);
      lines = materialResult.lines;
      if (intent.intent === "material_only") {
        bundle = {
          type: "material_only",
          materialSearchKey: intent.materialSearchKey || null,
          alternateCount: intent.materialCandidates?.length || null,
          bundleNote: intent.bundleNote || null
        };
      }
    }

    if (!lines.length) {
      return {
        ok: false,
        error: "ไม่พบรายการที่จับคู่กับ master data ได้",
        intent
      };
    }

    const unmatched = lines.filter(line => !findMasterItem(master, line.materialId));
    const breakdownTotals = calculateQuoteTotal(lines, budgetType);

    return {
      ok: true,
      query: intent.summary || "",
      budgetType,
      intent: intent.intent,
      source: intent.source || "ai",
      bundle,
      poleBreakdown,
      lines,
      breakdown: breakdownTotals,
      total: breakdownTotals.total,
      disclaimer: "ราคาอ้างอิงอัตรามาตรฐานจาก master data — ไม่รวมเงื่อนไขหน้างานจริง",
      unmatchedCount: unmatched.length
    };
  }

  window.PriceQuoteEngine = {
    BUDGET_TYPES,
    getFaqCatalog,
    buildIntentFromFaq,
    matchFaqByQuery,
    sanitizeIntent,
    validateIntent,
    parseQueryLocal,
    parseTrBudgetQuery,
    buildTrBudgetQuote,
    buildTrClarificationFields,
    buildMaterialClarificationFields,
    mergeTrIntent,
    mergeMaterialIntent,
    resolveMaterialAmbiguity,
    buildQuote,
    preferLocalTrInstallIntent,
    calculateQuoteTotal,
    findMasterItem,
    searchMaster,
    mergePoleIntent: (intent, answers) => (
      window.PriceQuotePole?.mergePoleParams?.(intent, answers) || intent
    )
  };
})();
