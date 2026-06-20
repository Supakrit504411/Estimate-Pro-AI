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
    const m = normalizeText(query).match(/(\d+)\s*kva/);
    return m ? Number(m[1]) : null;
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

  function parseBudgetBahtFromQuery(query) {
    return window.PriceQuotePole?.parseBudgetBaht?.(query) ?? null;
  }

  function isTrBudgetQuery(query) {
    const text = normalizeText(query);
    if (!parseBudgetBahtFromQuery(query)) return false;
    if (!window.PriceQuotePole?.isTransformerBudgetQuery?.(text)) return false;
    return /มีเงิน|งบ|พอไหม|เงินพอ|ทำได้ไหม|ขาด|เกิน|ได้ไหม|ทำได้/.test(text);
  }

  function parseTrBudgetQuery(query, budgetType = "01.1") {
    if (!isTrBudgetQuery(query)) return null;

    const text = normalizeText(query);
    const budgetBaht = parseBudgetBahtFromQuery(query);
    const kva = extractKvaFromQuery(query);
    const phase = /1p|1 p|single|เฟสเดียว|1\s*เฟส/.test(text)
      ? "1p"
      : (/3p|3 p|three|3\s*เฟส/.test(text) ? "3p" : null);

    return {
      intent: "tr_budget_check",
      budgetType,
      budgetBaht,
      kva,
      phase,
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

    let candidates = TR_BUDGET_PRESETS.map(preset => ({ ...preset }));
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
    const bestFit = fitting.length ? fitting[fitting.length - 1] : null;
    const selected = intent.kva ? priced.find(item => item.kva === intent.kva) || priced[0] : (bestFit || cheapest);
    const budgetDelta = budgetBaht - selected.total;
    const enough = budgetDelta >= 0;
    const label = `หม้อแปลง ${selected.kva} kVA ${selected.phase.toUpperCase()}`;

    let verdict;
    if (intent.kva) {
      verdict = enough
        ? `✓ งบพอ: ${label} ประมาณ ${Math.round(selected.total).toLocaleString()} บาท — เหลือ buffer ~${Math.round(budgetDelta).toLocaleString()} บาท`
        : `✗ งบไม่พอ: ${label} ประมาณ ${Math.round(selected.total).toLocaleString()} บาท — ขาด ~${Math.round(-budgetDelta).toLocaleString()} บาท`;
    } else if (bestFit) {
      verdict = `✓ งบพอ — ติดตั้งได้สูงสุด ${bestFit.kva} kVA ${bestFit.phase.toUpperCase()} ประมาณ ${Math.round(bestFit.total).toLocaleString()} บาท` +
        (fitting.length > 1 ? ` (ขั้นต่ำ ${cheapest.kva} kVA ${cheapest.phase.toUpperCase()} ~${Math.round(cheapest.total).toLocaleString()} บาท)` : "");
    } else {
      verdict = `✗ งบไม่พอ — ติดตั้งขั้นต่ำ ${cheapest.kva} kVA ${cheapest.phase.toUpperCase()} ประมาณ ${Math.round(cheapest.total).toLocaleString()} บาท — ขาด ~${Math.round(cheapest.total - budgetBaht).toLocaleString()} บาท`;
    }

    const displayItem = intent.kva ? selected : (bestFit || cheapest);
    const breakdown = [
      verdict,
      `งบที่ถาม: ${budgetBaht.toLocaleString()} บาท · ประมาณการใช้ ${Math.round(displayItem.total).toLocaleString()} บาท`
    ];

    if (!intent.kva && fitting.length) {
      breakdown.push(`ติดตั้งได้ในงบนี้: ${fitting.map(item => `${item.kva} kVA ${item.phase.toUpperCase()} (~${Math.round(item.total).toLocaleString()} บาท)`).join(" · ")}`);
    }

    return {
      lines: displayItem.lines,
      breakdown,
      bundle: {
        type: "tr_budget_check",
        budgetBaht,
        budgetVerdict: enough ? "enough" : "short",
        budgetDelta: intent.kva ? budgetDelta : (bestFit ? budgetBaht - bestFit.total : budgetBaht - cheapest.total),
        targetTotal: displayItem.total,
        kva: displayItem.kva,
        phase: displayItem.phase,
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
      if (hasDistance) {
        result.scope = result.scope === "pole_only" ? result.scope : "with_wire";
        delete result.poleCount;
      }

      const fields = window.PriceQuotePole?.buildClarificationFields?.(result) || [];
      const missing = [];

      if (result.intent === "budget_capacity" && !(budgetBaht > 0)) {
        missing.push("งบประมาณ");
      }
      if (hasDistance || result.scope === "with_wire" || result.intent === "budget_capacity") {
        if (!result.voltage) missing.push("แรงดัน (MV/LV)");
        if (!result.phase) missing.push("ระบบเฟส (1P/3P)");
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
      result.trSetId = result.trSetId || resolveDefaultTrSetId(
        result.installType || "single_pole",
        phase,
        kva
      );
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
    const isInstall = /ติดตั้ง|install/.test(text);
    const isTransformer = TRANSFORMER_KWS.some(kw => text.includes(kw))
      || intent.intent === "tr_install"
      || Boolean(intent.kva || intent.transformerId);

    if (isTransformer && kva) {
      const phase = /1p|1 p|single|เฟสเดียว/.test(text) ? "1p" : (intent.phase || "3p");
      const series = detectTransformerSeries(query);
      const transformer = findTransformerByKva(kva, phase, series);
      if (transformer) {
        intent.kva = kva;
        intent.phase = transformer.phase;
        intent.transformerId = transformer.id;
        intent.includeTrSet = isInstall;
        intent.intent = isInstall ? "tr_install" : "material_only";
        if (isInstall) {
          intent.installType = intent.installType || "single_pole";
          intent.trSetId = intent.trSetId || resolveDefaultTrSetId(
            intent.installType,
            transformer.phase,
            kva
          );
        } else {
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

    return validateIntent(intent, query);
  }

  function parseQueryLocal(query, budgetType = "01.1") {
    const text = normalizeText(query);

    if (window.PriceQuotePole?.parsePoleQuery) {
      const poleIntent = window.PriceQuotePole.parsePoleQuery(query, budgetType);
      if (poleIntent) return poleIntent;
    }

    const trBudgetIntent = parseTrBudgetQuery(query, budgetType);
    if (trBudgetIntent) return trBudgetIntent;

    const kvaMatch = text.match(/(\d+)\s*kva/);
    const kva = kvaMatch ? Number(kvaMatch[1]) : null;
    const isTransformer = TRANSFORMER_KWS.some(kw => text.includes(kw));
    const isInstall = /ติดตั้ง|install/.test(text);

    if (isTransformer && kva) {
      const phase = /1p|1 p|single|เฟสเดียว/.test(text) ? "1p" : "3p";
      const series = detectTransformerSeries(query);
      const installType = /platform|ยก|แพลต/.test(text) ? "platform" : "single_pole";
      const transformer = findTransformerByKva(kva, phase, series);
      return {
        intent: isInstall ? "tr_install" : "material_only",
        budgetType,
        kva,
        phase,
        installType,
        includeTrSet: isInstall,
        transformerId: transformer?.id || null,
        trSetId: resolveDefaultTrSetId(installType, phase, kva),
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
    mergeTrIntent,
    buildQuote,
    calculateQuoteTotal,
    findMasterItem,
    searchMaster,
    mergePoleIntent: (intent, answers) => (
      window.PriceQuotePole?.mergePoleParams?.(intent, answers) || intent
    )
  };
})();
