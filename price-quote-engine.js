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

    return intent;
  }

  function parseQueryLocal(query, budgetType = "01.1") {
    const text = normalizeText(query);

    if (window.PriceQuotePole?.parsePoleQuery) {
      const poleIntent = window.PriceQuotePole.parsePoleQuery(query, budgetType);
      if (poleIntent) return poleIntent;
    }

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

    const tokens = text.split(/[\s,]+/).filter(token => token.length > 1);
    return {
      intent: "material_only",
      budgetType,
      items: [{ searchTerms: tokens.length ? tokens : [text], qty: 1 }],
      summary: query,
      needsClarification: false,
      source: "local"
    };
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
    parseQueryLocal,
    buildQuote,
    calculateQuoteTotal,
    findMasterItem,
    searchMaster,
    mergePoleIntent: (intent, answers) => (
      window.PriceQuotePole?.mergePoleParams?.(intent, answers) || intent
    )
  };
})();
