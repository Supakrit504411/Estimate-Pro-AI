(function () {
  const glossary = () => window.PRICE_ASK_GLOSSARY || {};

  function normalizeText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function textIncludesPhrase(text, phrase) {
    const p = normalizeText(phrase);
    if (!p) return false;
    if (p.includes(" x ")) {
      const re = new RegExp(p.replace(/\s*x\s*/g, "\\s*\\d+\\s*"), "i");
      return re.test(text);
    }
    return text.includes(p);
  }

  function hasAnyKeyword(text, keywords) {
    return (keywords || []).some(kw => text.includes(normalizeText(kw)));
  }

  function parseQtyFromText(text, slots) {
    for (const slot of slots || ["จุด", "ต้น"]) {
      const m = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${escapeRegExp(slot)}`));
      if (m) return Number(m[1]);
    }
    const bare = text.match(/(?:x|×)\s*(\d+)/);
    if (bare) return Number(bare[1]);
    return null;
  }

  function buildMaterialIndex() {
    const g = glossary();
    const index = [];
    Object.entries(g.materials || {}).forEach(([materialId, meta]) => {
      (meta.aliases || []).forEach(alias => {
        index.push({
          materialId,
          alias: normalizeText(alias),
          meta
        });
      });
      index.push({
        materialId,
        alias: normalizeText(materialId),
        meta
      });
    });
    index.sort((a, b) => b.alias.length - a.alias.length);
    return index;
  }

  let materialIndexCache = null;

  function getMaterialIndex() {
    if (!materialIndexCache) materialIndexCache = buildMaterialIndex();
    return materialIndexCache;
  }

  function findMaterialMatches(text) {
    const t = normalizeText(text);
    const matches = [];
    const seen = new Set();

    getMaterialIndex().forEach(entry => {
      if (!entry.alias || seen.has(entry.materialId)) return;
      if (t.includes(entry.alias)) {
        seen.add(entry.materialId);
        matches.push({
          materialId: entry.materialId,
          alias: entry.alias,
          category: entry.meta.category,
          heightM: entry.meta.heightM,
          label: entry.meta.label
        });
      }
    });
    return matches;
  }

  function findIntentMatches(text) {
    const t = normalizeText(text);
    const matches = [];
    Object.entries(glossary().intents || {}).forEach(([key, def]) => {
      const phraseHit = (def.phrases || []).some(p => textIncludesPhrase(t, p));
      if (!phraseHit) return;
      if ((def.exclude || []).some(ex => t.includes(normalizeText(ex)))) return;
      if ((def.requires || []).length && !def.requires.some(r => t.includes(normalizeText(r)))) return;
      matches.push({ key, ...def });
    });
    return matches;
  }

  function extractHints(query) {
    const text = normalizeText(query);
    const g = glossary();
    return {
      text,
      materialMatches: findMaterialMatches(text),
      intentMatches: findIntentMatches(text),
      hasVoltageKeyword: hasAnyKeyword(text, [...(g.voltageKeywords?.mv || []), ...(g.voltageKeywords?.lv || [])]),
      hasPhaseKeyword: hasAnyKeyword(text, [...(g.phaseKeywords?.["1p"] || []), ...(g.phaseKeywords?.["3p"] || [])]),
      scopePoleOnly: hasAnyKeyword(text, g.scopeKeywords?.pole_only || []),
      scopeWithWire: hasAnyKeyword(text, g.scopeKeywords?.with_wire || [])
    };
  }

  function resolveMaterialKey(materialKey) {
    const g = glossary();
    if (materialKey === "concrete_mv") return g.materials?.["9090010025"]?.category ? "9090010025" : "9090010025";
    return materialKey;
  }

  function tryGlossaryIntent(query, budgetType = "01.1") {
    const text = normalizeText(query);
    const hints = extractHints(query);
    const concreteDef = (glossary().intents || {}).concrete_only;

    if (concreteDef && hints.intentMatches.some(m => m.key === "concrete_only")) {
      const qty = parseQtyFromText(text, concreteDef.qtyFrom) || 1;
      const materialId = resolveMaterialKey(concreteDef.materialKey) || "9090010025";
      return {
        intent: "material_only",
        budgetType,
        items: [{ materialId, qty, laborHint: "ติดตั้ง" }],
        summary: query,
        needsClarification: false,
        source: "glossary",
        parseConfidenceBoost: 0.2,
        glossaryMatch: "concrete_only"
      };
    }

    const isPoleJob = /ปักเสา|ติดตั้งเสา|หัวเสา|ไม่เอาหัว|ขยายเขต|กี่ต้น|\d+\s*ต้น|พาดสาย|ลากสาย/.test(text);
    const singleMaterial = hints.materialMatches.length === 1
      && !hints.scopeWithWire
      && !isPoleJob
      && !/kva|หม้อแปลง/.test(text);
    if (singleMaterial && /ราคา|กี่บาท|เท่าไร|เท่าไหร่|cost|price/.test(text)) {
      const match = hints.materialMatches[0];
      const qty = parseQtyFromText(text, ["จุด", "ต้น", "ชิ้น", "อัน"]) || 1;
      return {
        intent: "material_only",
        budgetType,
        items: [{ materialId: match.materialId, qty, laborHint: "ติดตั้ง" }],
        summary: query,
        needsClarification: false,
        source: "glossary",
        parseConfidenceBoost: 0.15,
        glossaryMatch: `material:${match.materialId}`
      };
    }

    return null;
  }

  function enrichMasterItem(item) {
    if (!item?.id) return item;
    const meta = glossary().materials?.[item.id];
    if (!meta) return item;

    const keywords = new Set();
    (meta.aliases || []).forEach(a => keywords.add(a));
    if (meta.label) keywords.add(meta.label);
    if (item.name) keywords.add(String(item.name).toLowerCase());

    return {
      ...item,
      category: meta.category || item.category,
      heightM: meta.heightM ?? item.heightM,
      keywordsTh: Array.from(keywords),
      searchText: Array.from(keywords).join(" ")
    };
  }

  function enrichMasterStore(master) {
    return (master || []).map(enrichMasterItem);
  }

  function searchMaterials(query, master, limit = 8) {
    const text = normalizeText(query);
    const hits = findMaterialMatches(text);
    if (!master?.length) return hits.slice(0, limit);

    const byId = new Map(master.map(row => [String(row.id), row]));
    return hits
      .map(hit => {
        const row = byId.get(hit.materialId);
        return row
          ? { ...hit, name: row.name, matPrice: row.matPrice, labPrice: row.labPrice }
          : hit;
      })
      .slice(0, limit);
  }

  function computeConfidence(intent, query, hints) {
    const g = glossary();
    let score = 0.52;
    const reasons = [];

    if (intent.source === "glossary") {
      score += 0.22;
      reasons.push("glossary");
    } else if (intent.source === "local" || intent.source === "faq") {
      score += 0.12;
      reasons.push("local");
    } else if (intent.source === "gemini-lite" || intent.source === "gemini") {
      score -= 0.18;
      reasons.push("ai_fallback");
    }

    if (hints?.intentMatches?.length) {
      score += 0.08;
      reasons.push("intent_phrase");
    }
    if (hints?.materialMatches?.length === 1) {
      score += 0.06;
      reasons.push("material_match");
    }
    if (hints?.hasVoltageKeyword) {
      score += 0.1;
      reasons.push("voltage_explicit");
    }
    if (hints?.hasPhaseKeyword) {
      score += 0.08;
      reasons.push("phase_explicit");
    }

    if (intent.intent === "material_only" && intent.items?.[0]?.materialId) {
      score += 0.18;
      reasons.push("material_intent");
    }

    if (intent.intent === "pole_run") {
      const hasDistance = Number(intent.distanceM) > 0;
      const hasPole = Number(intent.poleHeightM) > 0 && Number(intent.poleCount) > 0;
      if (hasDistance && intent.voltage && intent.phase) {
        score += 0.15;
        reasons.push("line_complete");
      }
      if (hasPole && intent.scope === "pole_only") {
        score += 0.12;
        reasons.push("pole_spec");
      }
      if (intent.voltage && !hints?.hasVoltageKeyword && hasDistance) {
        score -= 0.12;
        reasons.push("inferred_voltage");
      }
    }

    if (intent.intent === "budget_capacity") {
      if (Number(intent.budgetBaht) > 0) {
        score += 0.1;
        reasons.push("budget_parsed");
      }
      if (intent.capacityMode === "poles" && Number(intent.poleHeightM) > 0) {
        score += 0.12;
        reasons.push("pole_budget");
      }
    }

    if (intent.needsClarification) {
      score -= 0.25;
      reasons.push("needs_clarify");
    }

    if (Number(intent.parseConfidenceBoost) > 0) {
      score += intent.parseConfidenceBoost;
    }

    score = Math.max(0, Math.min(1, score));
    return { score, reasons, level: confidenceLevel(score) };
  }

  function confidenceLevel(score) {
    const warnBelow = glossary().confidence?.warnBelow ?? 0.62;
    const clarifyBelow = glossary().confidence?.clarifyBelow ?? 0.45;
    if (score >= warnBelow) return "high";
    if (score >= clarifyBelow) return "medium";
    return "low";
  }

  function applyConfidenceGate(intent, query) {
    if (!intent) return intent;
    const hints = extractHints(query);
    const { score, reasons, level } = computeConfidence(intent, query, hints);
    const merged = {
      ...intent,
      parseConfidence: score,
      confidenceLevel: level,
      confidenceReasons: reasons,
      nluHints: {
        materialMatches: hints.materialMatches.map(m => m.materialId),
        intentMatches: hints.intentMatches.map(m => m.key)
      }
    };

    const clarifyBelow = glossary().confidence?.clarifyBelow ?? 0.45;
    const shouldForceClarify = score < clarifyBelow
      && !merged.needsClarification
      && (merged.intent === "pole_run" || merged.intent === "budget_capacity")
      && merged.scope === "with_wire"
      && Number(merged.distanceM) > 0
      && (!merged.voltage || !merged.phase);

    if (shouldForceClarify) {
      merged.needsClarification = true;
      merged.clarificationType = "pole_run";
      merged.lowConfidence = true;
      merged.clarificationQuestion = merged.clarificationQuestion
        || "ระบบไม่มั่นใจในความหมายคำถาม — กรุณาระบุ MV/LV และ 1P/3P ให้ชัด";
    }

    return merged;
  }

  function getGoldenQueries() {
    return glossary().goldenQueries || [];
  }

  function resetMaterialIndex() {
    materialIndexCache = null;
  }

  window.PriceAskNlu = {
    glossary,
    normalizeText,
    extractHints,
    tryGlossaryIntent,
    findMaterialMatches,
    findIntentMatches,
    searchMaterials,
    enrichMasterItem,
    enrichMasterStore,
    computeConfidence,
    applyConfidenceGate,
    getGoldenQueries,
    resetMaterialIndex
  };
})();
