(function () {
  const DEFAULT_SPAN_M = 40;
  const DEFAULT_CURVE_SPAN_M = 20;

  function normalizeText(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function getCatalog() {
    return window.PRICE_QUOTE_CATALOG || {};
  }

  function getPresetsApi() {
    return window.SurveyPresetsApi || null;
  }

  function getSystemDefaults(voltage) {
    return getCatalog().PRICE_QUOTE_DEFAULTS?.[voltage] || {};
  }

  function resolvePoleMaterialId(heightM) {
    const map = getCatalog().POLE_BY_HEIGHT_M || {};
    const h = Number(heightM);
    if (map[h]) return map[h];

    const keys = Object.keys(map).map(Number).sort((a, b) => a - b);
    let best = keys[0];
    keys.forEach(k => {
      if (Math.abs(k - h) < Math.abs(best - h)) best = k;
    });
    return map[best] || "1000010012";
  }

  function resolveGuySetId(poleHeightM, configKey, rule) {
    const endRule = rule || getPresetsApi()?.getSpecialPoleRules?.(configKey)?.end;
    if (!endRule) return null;

    const h = Number(poleHeightM) || 12;
    if (configKey.startsWith("mv")) {
      if (h >= 14) return endRule.guySetIds?.includes("23008") ? "23008" : endRule.guyDefault;
      if (h >= 12 && endRule.guySetIds?.includes("23007")) return "23007";
      return endRule.guyDefault || "23007";
    }
    return endRule.guyDefault || null;
  }

  function expandSetItems(setId) {
    const id = String(setId || "").trim();
    if (!id) return [];

    const fromPresets = getPresetsApi()?.getSet?.(id);
    if (fromPresets?.items?.length) return fromPresets.items;

    const fromCatalog = getCatalog().sets?.[id];
    if (fromCatalog?.items?.length) return fromCatalog.items;

    const rootSet = window.SURVEY_PRESETS?.sets?.[id];
    return rootSet?.items || [];
  }

  function getSetName(setId) {
    return getPresetsApi()?.getSet?.(setId)?.name
      || getCatalog().sets?.[setId]?.name
      || window.SURVEY_PRESETS?.sets?.[setId]?.name
      || setId;
  }

  function addSetToMap(lineMap, setId, qty, mergeLine, master) {
    expandSetItems(setId).forEach(entry => {
      mergeLine(lineMap, entry.id, (Number(entry.qty) || 1) * qty, "ติดตั้ง", master);
    });
  }

  function computePoleLayout(distanceM, options = {}) {
    const spanStraight = Number(options.spanStraightM) || DEFAULT_SPAN_M;
    const spanCurve = Number(options.spanCurveM) || DEFAULT_CURVE_SPAN_M;
    const curveDist = Math.max(0, Number(options.curveDistanceM) || 0);
    const totalDist = Math.max(0, Number(distanceM) || 0);
    const straightDist = Math.max(0, totalDist - curveDist);

    const straightSpans = straightDist > 0 ? Math.ceil(straightDist / spanStraight) : 0;
    const curveSpans = curveDist > 0 ? Math.ceil(curveDist / spanCurve) : 0;
    const totalSpans = straightSpans + curveSpans;
    const totalPoles = totalSpans > 0 ? totalSpans + 1 : 1;
    const curvePoleCount = curveSpans;
    const endCount = totalPoles > 1 ? 1 : 0;
    const straightPoleCount = Math.max(0, totalPoles - endCount - curvePoleCount);

    return {
      distanceM: totalDist,
      curveDistanceM: curveDist,
      straightDistanceM: straightDist,
      spanStraightM: spanStraight,
      spanCurveM: spanCurve,
      straightSpans,
      curveSpans,
      totalSpans,
      totalPoles,
      straightPoleCount,
      curvePoleCount,
      endCount
    };
  }

  function applyPoleTypeOverride(layout, poleType) {
    if (!poleType || !layout) return;
    if (poleType === "end" && layout.endCount === 0) {
      layout.endCount = 1;
      layout.straightPoleCount = Math.max(0, layout.totalPoles - layout.endCount - layout.curvePoleCount);
    } else if (poleType === "curve" && layout.curvePoleCount === 0) {
      layout.curvePoleCount = 1;
      layout.straightPoleCount = Math.max(0, layout.totalPoles - layout.endCount - layout.curvePoleCount);
    }
  }

  function computePoleCountLayout(poleCount) {
    const count = Math.max(1, Number(poleCount) || 1);
    return {
      totalPoles: count,
      straightPoleCount: count > 1 ? count - 1 : 1,
      curvePoleCount: 0,
      endCount: count > 1 ? 1 : 0,
      distanceM: null,
      curveDistanceM: 0
    };
  }

  function detectVoltage(text) {
    if (/lv|แรงต่ำ|0\.4\s*kv|400\s*v|380\s*v|ขยายเขตแรงต่ำ|ขยาย.*แรงต่ำ/.test(text)) return "lv";
    if (/mv|แรงสูง|22\s*kv|22kv|medium|ขยายเขตแรงสูง|ขยาย.*แรงสูง/.test(text)) return "mv";
    return null;
  }

  function detectPhase(text) {
    if (/1\s*p|1p|single|เฟสเดียว|1\s*เฟส/.test(text)) return "1p";
    if (/3\s*p|3p|three|3\s*เฟส/.test(text)) return "3p";
    return null;
  }

  const CONCRETE_WORD = "เทโคน";
  const CONCRETE_RE = /(?:เทโคน|เทคอน|คอนกรีต|concrete)/;
  const CONCRETE_NEG_RE = /ไม่(?:เอา|รวม|ใส่|ต้อง).*(?:เทโคน|เทคอน|คอน)/;

  const NEGATION_PREFIX = /ไม่(?:เอา|รวม|ใส่|ต้อง(?:การ)?|มี|ใช้)/;
  const EXCLUSION_MAP = [
    { keys: ["excludeGuy"],      words: /สายยึดโยง|ยึดโยง|สายโยง|guy|anchor/ },
    { keys: ["excludeConcrete"], words: /เทโคน|เทคอน|คอนกรีต|concrete/ },
    { keys: ["excludeOhgw"],     words: /ohgw|โอเอชจี|สายล่อฟ้า|ล่อฟ้า/ },
    { keys: ["excludeSurge"],    words: /ดักเสิร์จ|surge|เสิร์จ|ล่อฟ้า|arrester/ },
    { keys: ["excludeHead"],     words: /หัวเสา|head/ },
    { keys: ["excludeWire"],     words: /พาดสาย|สายไฟ|ลากสาย|สาย(?!ยึด|โยง|ล่อ)/ },
  ];

  function parseExclusions(text) {
    const t = normalizeText(text);
    const result = {};
    const negParts = t.split(NEGATION_PREFIX).slice(1);
    for (const part of negParts) {
      const snippet = part.slice(0, 40);
      for (const rule of EXCLUSION_MAP) {
        if (rule.words.test(snippet)) {
          for (const k of rule.keys) result[k] = true;
        }
      }
    }
    if (/(?:ไม่|no)\s*guy|without\s*guy/i.test(t)) result.excludeGuy = true;
    if (/without\s*(?:head|concrete|ohgw|surge|wire)/i.test(t)) {
      if (/without\s*head/i.test(t)) result.excludeHead = true;
      if (/without\s*concrete/i.test(t)) result.excludeConcrete = true;
      if (/without\s*ohgw/i.test(t)) result.excludeOhgw = true;
      if (/without\s*surge/i.test(t)) result.excludeSurge = true;
      if (/without\s*wire/i.test(t)) result.excludeWire = true;
    }
    return result;
  }

  function detectPoleType(text) {
    if (/ต้นสุดท้าย|เสาสุดท้าย|ปลายทาง|เสาปลายทาง|end\s*pole|สุดท้าย/.test(text)) return "end";
    if (/โค้ง|เข้าโค้ง|ออกโค้ง|curve/.test(text)) return "curve";
    return null;
  }

  function detectExcludeGuy(text) {
    return parseExclusions(text).excludeGuy === true;
  }

  function detectScope(text) {
    if (/ไม่พาดสาย|ไม่มีสาย|ไม่ลากสาย|ไม่.*(?:พาด|ลาก).*สาย|pole only/.test(text) || parseExclusions(text).excludeWire) {
      return "pole_only";
    }
    if (/อย่างเดียว|เฉพาะเสา|แค่เสา|เสาอย่างเดียว|ปักเสา.*อย่างเดียว|อย่างเดียว.*(?:ไม่|ไม่เอา)/.test(text)) {
      return "pole_only";
    }
    if (/พาดสาย|ลากสาย|with wire|รวมสาย|ขยายเขต|ขยายสาย|ระยะทาง/.test(text)) return "with_wire";
    return null;
  }

  function parseAssemblyOptions(text) {
    const t = normalizeText(text);
    const wantsConcrete = CONCRETE_RE.test(t) && !CONCRETE_NEG_RE.test(t);
    const rejectsHead = /ไม่(?:เอา|รวม|ใส่|ต้อง|มี).*หัว(?:เสา)?|without head|no head/.test(t);
    const materialOnly = rejectsHead
      || /(?:แค่|เฉพาะ|วัสดุ)\s*เสา|เสา(?:อย่าง)?เดียว(?!\s*(?:\+|และ|พร้อม))/.test(t)
      || (/อย่างเดียว/.test(t) && rejectsHead);

    const poleOnlyInstall = /อย่างเดียว|ไม่(?:เอา|พาด|ลาก).*สาย|ไม่พาดสาย|ไม่มีสาย/.test(t)
      && !/ขยายเขต|ระยะทาง|ขยายสาย/.test(t);

    if (materialOnly && wantsConcrete) {
      return {
        assemblyMode: "pole_concrete",
        includeHead: false,
        includeOhgw: false,
        includeConcrete: true
      };
    }
    if (materialOnly) {
      return {
        assemblyMode: "pole_material",
        includeHead: false,
        includeOhgw: false,
        includeConcrete: false
      };
    }
    if (poleOnlyInstall && !wantsConcrete) {
      return {
        assemblyMode: "pole_material",
        includeHead: false,
        includeOhgw: false,
        includeConcrete: false
      };
    }
    if (wantsConcrete && /(?:เสา|pole)/.test(t) && !poleOnlyInstall) {
      return {
        assemblyMode: "pole_concrete",
        includeHead: true,
        includeOhgw: true,
        includeConcrete: true
      };
    }
    return {
      assemblyMode: "full",
      includeHead: true,
      includeOhgw: true,
      includeConcrete: false
    };
  }

  function applyAssemblyOptions(intent, text) {
    const opts = parseAssemblyOptions(text);
    const merged = { ...intent, ...opts };
    if (opts.assemblyMode !== "full" || opts.includeHead === false) {
      merged.scope = "pole_only";
    }
    return merged;
  }

  function resolveConcreteForParams(params) {
    const catalogConcrete = getCatalog().CONCRETE || {};
    const byVoltage = catalogConcrete[params.voltage] || catalogConcrete.mv || {};
    const qty = Number(byVoltage.qty ?? byVoltage.qtyFactor ?? 1);
    return {
      materialId: byVoltage.materialId || "9090010025",
      qty: Number.isFinite(qty) && qty > 0 ? qty : 1
    };
  }

  function detectCableType(text, voltage) {
    if (voltage !== "mv") return null;
    if (/เปลือย|acsr|bare|สายเปล/.test(text)) return "bare";
    if (/หุ้ม|aerial|xlpe|สายหุ้ม/.test(text)) return "aerial";
    return null;
  }

  function parsePointCount(text) {
    const m = text.match(/(\d+)\s*จุด/);
    return m ? Number(m[1]) : null;
  }

  function parsePoleCount(text) {
    const pointCount = parsePointCount(text);
    if (pointCount) return pointCount;
    const m = text.match(/(\d+)\s*(?:ต้น|เสา(?!\s*(?:เมตร|ม\.|m\b)))/);
    if (m) return Number(m[1]);
    const approx = text.match(/(?:ประมาณ|ใช้|ต้องใช้|จำนวน)\s*(?:เสา[^0-9]*)?(\d+)\s*ต้น/);
    if (approx) return Number(approx[1]);
    return null;
  }

  function parsePoleHeight(text) {
    if (/(\d+(?:\.\d+)?)\s*(?:จุด|ต้น)/.test(text)) {
      const countAsHeight = text.match(/(?:เสา|pole)\s*(\d+(?:\.\d+)?)\s*(?:จุด|ต้น)/);
      if (countAsHeight) return null;
    }

    const patterns = [
      /ปักเสาขนาด\s*(\d+(?:\.\d+)?)\s*(?:เมตร|ม\.|m\b)?/,
      /(?:ปักเสา|ติดตั้งเสา|เสาขนาด)\s*(\d+(?:\.\d+)?)\s*(?:เมตร|ม\.|m\b)?/,
      /(?:เสา|pole)\s*(\d+(?:\.\d+)?)\s*(?:เมตร|ม\.|m\b)/,
      /(?:เสา|pole)\s*(\d+(?:\.\d+)?)(?!\s*(?:จุด|ต้น))/
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) return Number(m[1]);
    }
    return null;
  }

  function isConcreteOnlyQuery(text) {
    const t = normalizeText(text);
    if (!CONCRETE_RE.test(t)) return false;
    if (/ขยายเขต|ขยายสาย|ลากสาย|ระยะทาง|พาดสาย|span|เมตร|ม\./.test(t)) return false;
    if (/(\d+)\s*จุด/.test(t)) return true;
    if (/เทโคน\s*เสา|เทโคนเสา|คอน.*?เสา|เสา.*?เทโคน/.test(t)) return true;
    if (CONCRETE_RE.test(t) && parsePoleCount(t) && !parsePoleHeight(t)) return true;
    return false;
  }

  function parseConcreteOnlyQuery(query, budgetType = "01.1") {
    const text = normalizeText(query);
    if (!isConcreteOnlyQuery(text)) return null;

    const qty = parsePointCount(text) || parsePoleCount(text) || 1;
    const concrete = resolveConcreteForParams({ voltage: "mv" });

    return {
      intent: "material_only",
      budgetType,
      items: [{ materialId: concrete.materialId, qty, laborHint: "ติดตั้ง" }],
      summary: query,
      needsClarification: false,
      source: "local",
      quoteNote: `${CONCRETE_WORD} ${concrete.materialId} × ${qty} จุด (วัสดุอย่างเดียว — ไม่รวมเสา/หัวเสา/สาย)`
    };
  }

  function isTransformerBudgetQuery(text) {
    const t = normalizeText(text);
    return /หม้อแปลง|transformer|แปลงไฟ|\btr\b/.test(t)
      && !/ขยายเขต|ขยายสาย|ลากสาย|ระยะทาง/.test(t);
  }

  function isBudgetCapacityQuery(text) {
    const t = normalizeText(text);
    if (!parseBudgetBaht(t)) return false;
    if (isTransformerBudgetQuery(t)) return false;
    return /มีเงิน|งบ|พอไหม|เงินพอ|ทำได้ไหม|ขาด|เกิน|ได้กี่ต้น|กี่ต้น|กี่\s*ระยะ|ได้ระยะ|ทำได้กี่|ครอบคลุม|จะได้|อยากได้/.test(t);
  }

  function parseDistanceM(text) {
    const labeled = text.match(/(?:ระยะทาง|ระยะ|distance|ยาว)\s*(\d+(?:\.\d+)?)\s*(?:เมตร|ม\.|m\b)?/);
    if (labeled) return Number(labeled[1]);

    const poleHeight = parsePoleHeight(text);
    if (poleHeight != null && !/(?:ระยะทาง|ระยะ)\s*\d/.test(text)) {
      return null;
    }

    if (/ขยายเขต|ขยายสาย|ลากสาย|ระยะทาง/.test(text)) {
      const m = text.match(/(\d+(?:\.\d+)?)\s*(?:เมตร|ม\.|m\b)/);
      if (m) return Number(m[1]);
    }
    return null;
  }

  function parseBudgetBaht(text) {
    const t = normalizeText(text);
    let m = t.match(/(\d+(?:\.\d+)?)\s*ล้าน(?:บาท)?/);
    if (m) return Math.round(Number(m[1]) * 1000000);
    m = t.match(/(\d+(?:\.\d+)?)\s*แส(?:นบาท|n)?/);
    if (m) return Math.round(Number(m[1]) * 100000);
    m = t.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*บาท/);
    if (m) return Number(m[1].replace(/,/g, ""));
    m = t.match(/(?:มีเงิน|มีงบ|งบ|งบประมาณ)\s*(\d+(?:,\d{3})*(?:\.\d+)?)/);
    if (m) return Number(m[1].replace(/,/g, ""));
    return null;
  }

  function parseCurveDistanceM(text) {
    const m = text.match(/(?:ทางโค้ง|โค้ง|curve)\s*(\d+(?:\.\d+)?)\s*(?:เมตร|ม\.|m\b)?/);
    return m ? Number(m[1]) : 0;
  }

  function isLineExtensionQuery(text) {
    const t = normalizeText(text);
    if (isBudgetCapacityQuery(t)) return true;
    return /ขยายเขต|ขยายสาย|ลากสาย|ระยะทาง|extension|line extension/.test(t)
      || (parseDistanceM(t) != null && !parsePoleCount(t));
  }

  function inferVoltagePhaseDefaults(intent) {
    const merged = { ...intent };
    const height = Number(merged.poleHeightM);
    const summaryText = normalizeText(merged.summary || "");
    if (!merged.voltage) {
      if (height >= 12 || /แรงสูง|\bmv\b|22\s*kv/.test(summaryText)) {
        merged.voltage = "mv";
      } else if ((height > 0 && height <= 9) || /แรงต่ำ|\blv\b|0\.4/.test(summaryText)) {
        merged.voltage = "lv";
      }
    }
    if (!merged.phase && merged.voltage === "mv") {
      merged.phase = "3p";
    }
    return merged;
  }

  function parseBudgetCapacityQuery(query, budgetType = "01.1") {
    const text = normalizeText(query);
    if (!isBudgetCapacityQuery(text)) return null;

    const budgetBaht = parseBudgetBaht(text);
    const targetDistanceM = parseDistanceM(text);
    const poleHeightM = parsePoleHeight(text);
    let voltage = detectVoltage(text);
    let phase = detectPhase(text);
    const wantsPoleCount = /(?:ได้|ทำได้|ปักได้).*?กี่ต้น|กี่ต้น(?:\s|$|\?)/.test(text);
    const poleOnly = /อย่างเดียว|ไม่(?:เอา|พาด|ลาก).*สาย|ไม่พาดสาย|ไม่มีสาย|เฉพาะเสา|แค่เสา/.test(text);
    const scope = poleOnly ? "pole_only" : "with_wire";
    const capacityMode = wantsPoleCount && poleOnly && !targetDistanceM ? "poles" : "distance";

    let intent = applyAssemblyOptions({
      intent: "budget_capacity",
      budgetType,
      budgetBaht,
      targetDistanceM,
      poleHeightM,
      voltage,
      phase,
      scope,
      capacityMode,
      cableSizeSqMm: 50,
      spanStraightM: DEFAULT_SPAN_M,
      spanCurveM: DEFAULT_CURVE_SPAN_M,
      summary: query,
      source: "local",
      clarificationType: "pole_run"
    }, text);

    intent = inferVoltagePhaseDefaults(intent);

    if (voltage) Object.assign(intent, applyLineDefaults(intent));
    if (phase) Object.assign(intent, applyPhaseDefaults(intent));

    const missing = buildClarificationFields(intent);
    intent.needsClarification = missing.length > 0;
    intent.clarificationFields = missing;
    intent.clarificationQuestion = buildClarificationQuestion(intent)
      || (capacityMode === "poles"
        ? "ระบุความสูงเสา (เมตร) เพื่อคำนวณว่างบนี้ปักเสาได้กี่ต้น"
        : "ระบุ 1P/3P เพื่อคำนวณว่างบนี้ขยายเขตได้กี่เมตร/กี่ต้น");

    return intent;
  }

  function isPoleRunQuery(text) {
    const t = normalizeText(text);
    if (isConcreteOnlyQuery(t)) return false;
    if (isLineExtensionQuery(t)) return true;
    if (/ปักเสา|ติดตั้งเสา|เสาทาง|เสาต้นทาง|pole run|pole line/.test(t)) return true;
    if (/เสา/.test(t) && parsePoleCount(t) >= 2) return true;
    if (/เสา/.test(t) && parsePoleHeight(t) && parsePoleCount(t) >= 1) return true;
    return false;
  }

  function applyLineDefaults(intent) {
    const voltage = intent.voltage;
    if (!voltage) return { ...intent };

    const sys = getSystemDefaults(voltage);
    const merged = { ...intent, voltage };

    if (!merged.poleHeightM) merged.poleHeightM = sys.poleHeightM;
    if (!merged.spanStraightM) merged.spanStraightM = sys.spanStraightM || DEFAULT_SPAN_M;
    if (!merged.spanCurveM) merged.spanCurveM = sys.spanCurveM || DEFAULT_CURVE_SPAN_M;
    if (!merged.cableSizeSqMm) merged.cableSizeSqMm = sys.cableSizeSqMm || 50;
    if (!merged.scope) merged.scope = sys.scope || "with_wire";
    if (voltage === "mv" && merged.scope === "with_wire" && !merged.cableType) {
      merged.cableType = sys.cableType || "aerial";
    }
    return merged;
  }

  function applyPhaseDefaults(intent) {
    const merged = { ...intent };
    if (!merged.phase || !merged.voltage) return merged;

    const config = getPresetsApi()?.getConfig?.(merged.voltage, merged.phase);
    merged.wireMultiplier = config?.wireMultiplier || (merged.voltage === "lv"
      ? (merged.phase === "1p" ? 2 : 4)
      : (merged.phase === "1p" ? 2 : 3));

    if (merged.voltage === "lv") {
      merged.straightHeadOverride = config?.straight?.defaults?.headMaterialId
        || (merged.phase === "1p" ? "10021" : "10001");
      merged.rackLabel = merged.phase === "1p" ? "Rack 2" : "Rack 4";
    } else {
      merged.straightHeadOverride = null;
      merged.rackLabel = null;
    }
    return merged;
  }

  function applyVoltageDefaults(intent) {
    return applyPhaseDefaults(applyLineDefaults(intent));
  }

  function buildClarificationFields(intent) {
    const fields = [];
    if (!intent.voltage) {
      fields.push({
        key: "voltage",
        label: "ระบบแรงดัน",
        type: "select",
        options: [
          { value: "mv", label: "MV แรงสูง (22 kV)" },
          { value: "lv", label: "LV แรงต่ำ (0.4 kV)" }
        ]
      });
    }
    if (!intent.phase) {
      fields.push({
        key: "phase",
        label: "ระบบเฟส",
        type: "select",
        options: [
          { value: "1p", label: "1 เฟส (1P) — LV: Rack 2, สาย ×2 · MV: สาย ×2" },
          { value: "3p", label: "3 เฟส (3P) — LV: Rack 4, สาย ×4 · MV: สาย ×3" }
        ]
      });
    }
    if (!intent.scope && !intent.distanceM) {
      fields.push({
        key: "scope",
        label: "ขอบเขตงาน",
        type: "select",
        options: [
          { value: "pole_only", label: "ปักเสา (ไม่พาดสาย) — เสา + หัวเสา + เงื่อนไขเสาพิเศษ" },
          { value: "with_wire", label: "ปักเสา + พาดสายระหว่างเสา" }
        ]
      });
    }
    if (intent.assemblyMode === "full" && intent.scope === "pole_only" && !intent.distanceM) {
      fields.push({
        key: "assemblyMode",
        label: "ขอบเขตวัสดุ",
        type: "select",
        options: [
          { value: "full", label: "ครบชุด (เสา + หัวเสา SET + OHGW ตามระบบ)" },
          { value: "pole_material", label: "แค่วัสดุเสา (ไม่รวมหัวเสา / OHGW / สาย)" },
          { value: "pole_concrete", label: `เสา + ${CONCRETE_WORD} (ไม่รวมหัวเสา / สาย)` }
        ]
      });
    }
    if (intent.scope === "with_wire" && intent.voltage === "mv" && !intent.cableType && !intent.distanceM) {
      fields.push({
        key: "cableType",
        label: "ชนิดสาย MV",
        type: "select",
        options: [
          { value: "aerial", label: "สายหุ้ม Aerial (102005xxxx)" },
          { value: "bare", label: "สายเปลือย ACSR (102002xxxx)" }
        ]
      });
    }
    return fields;
  }

  function buildClarificationQuestion(intent) {
    if (intent.distanceM != null) {
      if (!intent.voltage) return "ระบุว่าเป็นงาน MV แรงสูง หรือ LV แรงต่ำ";
      if (!intent.phase) return "ระบบ 1 เฟส (1P) หรือ 3 เฟส (3P)? — LV 1P ใช้ Rack 2 (สาย ×2), LV 3P ใช้ Rack 4 (สาย ×4)";
      return null;
    }
    const parts = [];
    if (!intent.voltage) parts.push("ระบบ MV แรงสูง หรือ LV แรงต่ำ");
    if (!intent.phase) parts.push("1 เฟส หรือ 3 เฟส");
    if (!intent.scope) parts.push("ปักเสาอย่างเดียว หรือรวมพาดสาย");
    if (intent.voltage === "mv" && intent.scope === "with_wire" && !intent.cableType) {
      parts.push("สายหุ้มหรือสายเปลือย");
    }
    return parts.length ? `กรุณาระบุ: ${parts.join(" · ")}` : null;
  }

  function parsePoleQuery(query, budgetType = "01.1") {
    const text = normalizeText(query);

    const concreteOnly = parseConcreteOnlyQuery(query, budgetType);
    if (concreteOnly) return concreteOnly;

    const budgetQuery = parseBudgetCapacityQuery(query, budgetType);
    if (budgetQuery) return budgetQuery;

    if (!isPoleRunQuery(text)) return null;

    const distanceM = parseDistanceM(text);
    const curveDistanceM = parseCurveDistanceM(text);
    const poleHeightM = parsePoleHeight(text);
    const poleCount = parsePoleCount(text);
    let voltage = detectVoltage(text);
    let phase = detectPhase(text);
    const phaseExplicit = Boolean(phase);
    const voltageExplicit = Boolean(voltage);
    let scope = detectScope(text);
    const cableType = detectCableType(text, voltage);

    const exclusions = parseExclusions(text);
    const poleType = detectPoleType(text);

    let intent = applyAssemblyOptions({
      intent: "pole_run",
      budgetType,
      distanceM,
      curveDistanceM,
      poleHeightM,
      poleCount,
      voltage,
      phase,
      scope,
      cableType,
      cableSizeSqMm: 50,
      spanStraightM: DEFAULT_SPAN_M,
      spanCurveM: DEFAULT_CURVE_SPAN_M,
      ...exclusions,
      poleType: poleType || undefined,
      summary: query,
      source: "local"
    }, text);

    intent = inferVoltagePhaseDefaults(intent);
    intent.phaseExplicit = phaseExplicit;
    intent.voltageExplicit = voltageExplicit;
    if (intent.voltage === "lv" && !phaseExplicit) {
      intent.phase = null;
    }
    if (!voltage) voltage = intent.voltage;
    if (!phase) phase = intent.phase;

    if (distanceM != null && voltage) {
      Object.assign(intent, applyLineDefaults(intent));
      if (phase) Object.assign(intent, applyPhaseDefaults(intent));
    }

    const missing = buildClarificationFields(intent);
    const needHeight = !distanceM && !poleHeightM && !poleCount;
    intent.needsClarification = missing.length > 0 || needHeight;
    intent.clarificationType = "pole_run";
    intent.clarificationFields = missing;
    intent.clarificationQuestion = needHeight
      ? "ระบุความสูงเสาและจำนวนต้น หรือระยะทาง เช่น ขยายเขตแรงสูง 200 เมตร"
      : buildClarificationQuestion(intent);

    return intent;
  }

  function enrichPoleIntentFromQuery(intent, query) {
    if (!intent) return intent;
    if (intent.intent !== "pole_run" && intent.intent !== "budget_capacity") return intent;

    const sources = [query, intent.summary].filter(Boolean);
    let localDistance = null;
    let localPoleCount = null;
    let localHeight = null;
    let localVoltage = null;
    let localPhase = null;
    let localScope = null;
    let localCableType = null;
    let explicitPoleOnly = false;
    let assemblyFromText = null;

    let localExclusions = {};
    let localPoleType = null;

    sources.forEach(text => {
      const t = normalizeText(text);
      localDistance = localDistance ?? parseDistanceM(t);
      localPoleCount = localPoleCount ?? parsePoleCount(t);
      localHeight = localHeight ?? parsePoleHeight(t);
      localVoltage = localVoltage ?? detectVoltage(t);
      localPhase = localPhase ?? detectPhase(t);
      localScope = localScope ?? detectScope(t);
      assemblyFromText = assemblyFromText || parseAssemblyOptions(t);
      if (/ปักเสาอย่างเดียว|อย่างเดียว|เฉพาะเสา|แค่เสา|ไม่พาดสาย|ไม่มีสาย|pole only/.test(t)) {
        explicitPoleOnly = true;
      }
      Object.assign(localExclusions, parseExclusions(t));
      if (!localPoleType) localPoleType = detectPoleType(t);
      if (!localCableType && localVoltage) {
        localCableType = detectCableType(t, localVoltage);
      }
    });

    const merged = { ...intent };
    if (localDistance != null && !(Number(merged.distanceM) > 0)) merged.distanceM = localDistance;
    if (localPoleCount != null && !(Number(merged.poleCount) > 1)) merged.poleCount = localPoleCount;
    if (localHeight != null && !merged.poleHeightM) merged.poleHeightM = localHeight;
    if (localVoltage && !merged.voltage) merged.voltage = localVoltage;
    if (localPhase && !merged.phase) merged.phase = localPhase;
    if (localCableType && !merged.cableType) merged.cableType = localCableType;

    const span = Number(merged.spanStraightM) || DEFAULT_SPAN_M;
    if (!(Number(merged.distanceM) > 0) && Number(merged.poleCount) >= 2) {
      merged.distanceM = (Number(merged.poleCount) - 1) * span;
    }

    if (explicitPoleOnly) {
      merged.scope = "pole_only";
    } else if (Number(merged.distanceM) > 0) {
      merged.scope = "with_wire";
    } else if (localScope && !merged.scope) {
      merged.scope = localScope;
    }

    if (assemblyFromText) {
      Object.assign(merged, assemblyFromText);
      if (assemblyFromText.assemblyMode !== "full") merged.scope = "pole_only";
    }
    Object.assign(merged, localExclusions);
    if (localPoleType && !merged.poleType) merged.poleType = localPoleType;

    if (merged.voltage) Object.assign(merged, applyLineDefaults(merged));
    if (merged.phase) Object.assign(merged, applyPhaseDefaults(merged));

    if (merged.intent === "pole_run") {
      const missing = buildClarificationFields(merged);
      merged.needsClarification = missing.length > 0;
      merged.clarificationType = "pole_run";
      merged.clarificationFields = missing;
      merged.clarificationQuestion = missing.length
        ? buildClarificationQuestion(merged)
        : null;
    } else if (merged.intent === "budget_capacity") {
      const missing = buildClarificationFields(merged);
      merged.needsClarification = missing.length > 0;
      merged.clarificationType = "pole_run";
      merged.clarificationFields = missing;
      merged.clarificationQuestion = missing.length
        ? (buildClarificationQuestion(merged) || merged.clarificationQuestion)
        : null;
    }

    merged.summary = query || merged.summary;
    return merged;
  }

  function mergePoleParams(intent, answers = {}) {
    let merged = inferVoltagePhaseDefaults({ ...intent, ...answers });
    merged.intent = "pole_run";

    if (merged.voltage) merged = applyLineDefaults(merged);
    if (merged.phase) merged = applyPhaseDefaults(merged);

    const distanceM = Number(merged.distanceM);
    const explicitPoleCount = Number(merged.poleCount);
    if (Number.isFinite(distanceM) && distanceM > 0) {
      merged.distanceM = distanceM;
      merged.curveDistanceM = Math.max(0, Number(merged.curveDistanceM) || 0);
      if (Number.isFinite(explicitPoleCount) && explicitPoleCount >= 1) {
        merged.poleCount = explicitPoleCount;
        merged.layout = computePoleCountLayout(explicitPoleCount);
        merged.layout.distanceM = distanceM;
      } else {
        merged.layout = computePoleLayout(merged.distanceM, {
          spanStraightM: merged.spanStraightM,
          spanCurveM: merged.spanCurveM,
          curveDistanceM: merged.curveDistanceM
        });
        merged.poleCount = merged.layout.totalPoles;
      }
      merged.scope = "with_wire";
    } else {
      merged.poleHeightM = Number(merged.poleHeightM || parsePoleHeight(intent.summary || ""))
        || getSystemDefaults(merged.voltage).poleHeightM
        || 12;
      merged.poleCount = Math.max(1, Number(merged.poleCount) || 1);
      merged.layout = computePoleCountLayout(merged.poleCount);
      merged.spanStraightM = Number(merged.spanStraightM) || DEFAULT_SPAN_M;
      if (!merged.scope) merged.scope = "pole_only";
    }

    if (merged.poleType && merged.layout) {
      applyPoleTypeOverride(merged.layout, merged.poleType);
    }

    merged.spanCurveM = Number(merged.spanCurveM) || DEFAULT_CURVE_SPAN_M;
    merged.cableSizeSqMm = Number(merged.cableSizeSqMm) || 50;

    if (merged.voltage === "mv" && merged.scope === "with_wire" && !merged.cableType) {
      merged.cableType = "aerial";
    }

    merged.clarificationFields = buildClarificationFields(merged);
    merged.needsClarification = merged.clarificationFields.length > 0;
    merged.clarificationQuestion = merged.needsClarification
      ? buildClarificationQuestion(merged)
      : null;
    return merged;
  }

  function resolveCableMaterialId(voltage, cableType, sizeSqMm, config) {
    const size = Number(sizeSqMm) || 50;
    if (voltage === "lv") {
      const lvMap = getCatalog().LV_CABLE || {};
      return lvMap[size] || config?.straight?.defaults?.cableMaterialId || "1020070002";
    }
    if (cableType === "bare") {
      const bareMap = getCatalog().MV_CABLE_BARE || {};
      return bareMap[size] || "1020020002";
    }
    const aerialMap = getCatalog().MV_CABLE_AERIAL || {};
    return aerialMap[size] || config?.straight?.defaults?.cableMaterialId || "1020050000";
  }

  function resolveStraightHeadId(params, config) {
    if (params.straightHeadOverride) return params.straightHeadOverride;
    return config?.straight?.defaults?.headMaterialId || config?.straight?.headSetIds?.[0];
  }

  function resolveCurveHeadId(params, config, curveRule) {
    return curveRule?.headDefault || config?.curve?.defaults?.headMaterialId || config?.curve?.headSetIds?.[0];
  }

  function addSpecialPoleExtras(lineMap, params, rule, mergeLine, master, kind) {
    if (!rule) return;
    const configKey = getPresetsApi()?.getConfigKey?.(params.voltage, params.phase)
      || `${params.voltage}${params.phase}`;
    const guySetId = resolveGuySetId(params.poleHeightM, configKey, rule);
    const headId = kind === "curve"
      ? resolveCurveHeadId(params, params.config, rule)
      : (rule.headDefault || rule.headSetIds?.[0]);

    if (headId && !params.excludeHead) addSetToMap(lineMap, headId, 1, mergeLine, master);
    if (guySetId && !params.excludeGuy) addSetToMap(lineMap, guySetId, 1, mergeLine, master);
    if (rule.concrete?.materialId && !params.excludeConcrete) {
      mergeLine(lineMap, rule.concrete.materialId, rule.concrete.qty || 1, "ติดตั้ง", master);
    }
    if (params.voltage === "mv") {
      if (rule.ohgwDefault && !params.excludeOhgw) addSetToMap(lineMap, rule.ohgwDefault, 1, mergeLine, master);
      if (kind === "end" && rule.groundingSetId) {
        addSetToMap(lineMap, rule.groundingSetId, 1, mergeLine, master);
      }
      if (kind === "end" && rule.surgeArresterId && !params.excludeSurge) {
        mergeLine(lineMap, rule.surgeArresterId, rule.surgeArresterQty || 1, "ติดตั้ง", master);
      }
    } else if (rule.surgeSetId && !params.excludeSurge) {
      addSetToMap(lineMap, rule.surgeSetId, 1, mergeLine, master);
    }
  }

  function addLvIntervalSurges(lineMap, distanceM, rules, mergeLine, master) {
    const intervalM = rules?.surgeIntervalM;
    const setId = rules?.intervalSurgeSetId;
    if (!intervalM || !setId || distanceM <= intervalM) return;
    const count = Math.floor(distanceM / intervalM);
    for (let i = 0; i < count; i++) {
      addSetToMap(lineMap, setId, 1, mergeLine, master);
    }
  }

  function buildPoleRunBreakdown(params) {
    const layout = params.layout || computePoleCountLayout(params.poleCount);
    const api = getPresetsApi();
    const config = api?.getConfig?.(params.voltage, params.phase);
    const configKey = api?.getConfigKey?.(params.voltage, params.phase) || `${params.voltage}${params.phase}`;
    const rules = api?.getSpecialPoleRules?.(configKey);
    const endRule = rules?.end;
    const curveRule = rules?.curve;

    params.config = config;
    const poleId = resolvePoleMaterialId(params.poleHeightM);
    const straightHeadId = resolveStraightHeadId(params, config);
    const curveHeadId = resolveCurveHeadId(params, config, curveRule);
    const endHeadId = endRule?.headDefault || endRule?.headSetIds?.[0];
    const guySetId = resolveGuySetId(params.poleHeightM, configKey, endRule);
    const ohgwStraightId = config?.straight?.defaults?.ohgwSetId;
    const assemblyMode = params.assemblyMode || "full";
    const includeHead = params.includeHead !== false && !params.excludeHead && assemblyMode !== "pole_material" && assemblyMode !== "pole_concrete";
    const includeOhgw = params.includeOhgw !== false && !params.excludeOhgw && assemblyMode === "full";
    const includeConcrete = params.includeConcrete === true || assemblyMode === "pole_concrete";
    const materialOnly = assemblyMode === "pole_material" || assemblyMode === "pole_concrete";

    const sections = [];
    const voltageLabel = params.voltage === "mv" ? "MV แรงสูง" : "LV แรงต่ำ";
    const phaseLabel = params.phase === "1p" ? "1P" : "3P";
    const defaultsNote = params.distanceM != null
      ? ` (default: เสา ${params.poleHeightM} ม. · span ตรง ${layout.spanStraightM || params.spanStraightM} ม. · span โค้ง ${layout.spanCurveM || params.spanCurveM} ม. · สาย ${params.cableSizeSqMm} sq.mm.)`
      : "";

    if (params.distanceM != null) {
      sections.push(
        `สรุป: ${voltageLabel} ${phaseLabel} · ระยะทาง ${params.distanceM} ม.` +
        (layout.curveDistanceM > 0 ? ` (ทางโค้ง ${layout.curveDistanceM} ม.)` : " (ทางตรงทั้งหมด)") +
        ` · ${layout.totalPoles} ต้น${defaultsNote}`
      );
    } else {
      const scopeNote = params.scope === "with_wire"
        ? ` · พาดสาย ~${params.spanStraightM} ม./ช่วง`
        : (materialOnly ? " · วัสดุเสา (ไม่รวมหัวเสา/สาย)" : " · ปักเสา (ไม่พาดสาย)");
      sections.push(
        `สรุป: ${voltageLabel} ${phaseLabel} · เสา ${params.poleHeightM} ม. · ${layout.totalPoles} ต้น${scopeNote}`
      );
    }

    if (materialOnly) {
      const concrete = includeConcrete ? resolveConcreteForParams(params) : null;
      const parts = [`เสา ${poleId} × ${layout.totalPoles} ต้น`];
      if (concrete) parts.push(`${CONCRETE_WORD} ${concrete.materialId} × ${concrete.qty * layout.totalPoles}`);
      sections.push(`${parts.join(" + ")} (ไม่รวมหัวเสา SET / OHGW / Guy / สาย)`);
    } else if (layout.straightPoleCount > 0) {
      const rackNote = params.rackLabel ? ` · ${params.rackLabel}` : "";
      const straightParts = [`เสา ${poleId}`];
      if (includeHead && straightHeadId) straightParts.push(`หัวเสา SET ${straightHeadId} (${getSetName(straightHeadId)})${rackNote}`);
      if (includeOhgw && params.voltage === "mv" && config?.hasOhgw && ohgwStraightId) straightParts.push(`OHGW SET ${ohgwStraightId}`);
      sections.push(`เสาทางตรง ${layout.straightPoleCount} ต้น: ${straightParts.join(" + ")}`);
    }

    if (!materialOnly && layout.curvePoleCount > 0 && curveRule) {
      const curveParts = [`เสา ${poleId}`];
      if (!params.excludeHead) curveParts.push(`หัวโค้ง SET ${curveHeadId} (${getSetName(curveHeadId)})`);
      if (!params.excludeGuy) curveParts.push(`Guy SET ${resolveGuySetId(params.poleHeightM, configKey, curveRule)}`);
      if (!params.excludeConcrete && curveRule.concrete?.materialId) curveParts.push(`${CONCRETE_WORD} ${curveRule.concrete.materialId} × ${curveRule.concrete?.qty || 1}`);
      if (!params.excludeOhgw && params.voltage === "mv" && curveRule.ohgwDefault) curveParts.push(`OHGW SET ${curveRule.ohgwDefault}`);
      sections.push(`เสาทางโค้ง ${layout.curvePoleCount} ต้น: ${curveParts.join(" + ")}`);
    }

    if (!materialOnly && layout.endCount > 0 && endRule) {
      const extras = [];
      if (!params.excludeHead) extras.push(`หัวเสาต้นสุดท้าย SET ${endHeadId} (${getSetName(endHeadId)})`);
      if (!params.excludeGuy && guySetId) extras.push(`ยึด Guy SET ${guySetId} (${getSetName(guySetId)})`);
      if (!params.excludeConcrete) extras.push(`${CONCRETE_WORD} ${endRule.concrete?.materialId || "9090010025"} × ${endRule.concrete?.qty || 1}`);
      if (params.voltage === "mv") {
        if (!params.excludeOhgw && endRule.ohgwDefault) extras.push(`OHGW SET ${endRule.ohgwDefault}`);
        if (endRule.groundingSetId) extras.push(`GROUND SET ${endRule.groundingSetId}`);
        if (!params.excludeSurge && endRule.surgeArresterId) {
          extras.push(`SA ${endRule.surgeArresterId} × ${endRule.surgeArresterQty || 1}`);
        }
      } else if (!params.excludeSurge && endRule.surgeSetId) {
        extras.push(`Surge/ดักเสิร์จ SET ${endRule.surgeSetId}`);
      }
      sections.push(`เสาต้นสุดท้าย 1 ต้น: เสา ${poleId}${extras.length ? " + " + extras.join(" + ") : ""}`);
    }

    if (params.scope === "with_wire" && (layout.totalPoles > 1 || params.distanceM > 0)) {
      const cableId = resolveCableMaterialId(params.voltage, params.cableType, params.cableSizeSqMm, config);
      const wireMult = params.wireMultiplier || config?.wireMultiplier || 1;
      const dist = params.distanceM != null
        ? params.distanceM
        : (layout.totalPoles - 1) * params.spanStraightM;
      const totalM = dist * wireMult;
      const cableLabel = params.voltage === "mv"
        ? (params.cableType === "bare" ? "สายเปลือย ACSR" : "สายหุ้ม Aerial")
        : "สาย LV";
      sections.push(
        `สาย ${cableLabel} ${params.cableSizeSqMm} sq.mm. (${cableId}): ~${totalM} ม.` +
        ` (ระยะ ${dist} ม. × ${wireMult})`
      );
    }

    if (params.voltage === "lv" && params.distanceM > 400 && rules?.intervalSurgeSetId) {
      const surgeCount = Math.floor(params.distanceM / (rules.surgeIntervalM || 400));
      sections.push(`ดักเสิร์จระหว่างทาง SET ${rules.intervalSurgeSetId} × ${surgeCount} จุด (ทุก ${rules.surgeIntervalM || 400} ม.)`);
    }

    sections.push("หมายเหตุ: ปรับเพิ่ม/ลดรายการในงบประมาณได้หลังนำเข้า");

    return {
      sections,
      layout,
      poleId,
      straightHeadId,
      curveHeadId,
      endHeadId,
      guySetId,
      config,
      configKey,
      endRule,
      curveRule
    };
  }

  function buildPoleRunLines(intent, master, mergeLine) {
    const params = mergePoleParams(intent, intent);
    if (params.needsClarification) {
      return { error: params.clarificationQuestion, needsClarification: true };
    }

    const breakdown = buildPoleRunBreakdown(params);
    const lineMap = new Map();
    const add = (materialId, qty, hint) => mergeLine(lineMap, materialId, qty, hint || "ติดตั้ง", master);

    const {
      layout,
      poleId,
      straightHeadId,
      config,
      endRule,
      curveRule
    } = breakdown;

    const assemblyMode = params.assemblyMode || "full";
    const includeHead = params.includeHead !== false && !params.excludeHead && assemblyMode !== "pole_material" && assemblyMode !== "pole_concrete";
    const includeOhgw = params.includeOhgw !== false && !params.excludeOhgw && assemblyMode === "full";
    const includeConcrete = params.includeConcrete === true || assemblyMode === "pole_concrete";
    const materialOnly = assemblyMode === "pole_material" || assemblyMode === "pole_concrete";

    if (materialOnly) {
      add(poleId, layout.totalPoles);
      if (includeConcrete) {
        const concrete = resolveConcreteForParams(params);
        add(concrete.materialId, concrete.qty * layout.totalPoles);
      }
    } else {
      for (let i = 0; i < layout.straightPoleCount; i++) {
        add(poleId, 1);
        if (includeHead && straightHeadId) addSetToMap(lineMap, straightHeadId, 1, mergeLine, master);
        if (includeOhgw && params.voltage === "mv" && config?.hasOhgw && config?.straight?.defaults?.ohgwInstall) {
          const ohgwId = config.straight.defaults.ohgwSetId;
          if (ohgwId) addSetToMap(lineMap, ohgwId, 1, mergeLine, master);
        }
      }

      for (let i = 0; i < layout.curvePoleCount; i++) {
        add(poleId, 1);
        addSpecialPoleExtras(lineMap, params, curveRule, mergeLine, master, "curve");
      }

      if (layout.endCount > 0 && endRule) {
        add(poleId, 1);
        addSpecialPoleExtras(lineMap, params, endRule, mergeLine, master, "end");
      }
    }

    if (params.scope === "with_wire" && (layout.totalPoles > 1 || params.distanceM > 0)) {
      const cableId = resolveCableMaterialId(
        params.voltage,
        params.cableType,
        params.cableSizeSqMm,
        config
      );
      const wireMult = params.wireMultiplier || config?.wireMultiplier || 1;
      const dist = params.distanceM != null
        ? params.distanceM
        : (layout.totalPoles - 1) * params.spanStraightM;
      add(cableId, dist * wireMult);
    }

    if (params.voltage === "lv" && params.distanceM && !params.excludeSurge) {
      const rulesRoot = getPresetsApi()?.getSpecialPoleRules?.(breakdown.configKey);
      addLvIntervalSurges(lineMap, params.distanceM, rulesRoot, mergeLine, master);
    }

    const lines = Array.from(lineMap.values()).map(line => ({
      ...line,
      lineTotal: (line.matPrice + line.labPrice) * line.qty
    }));

    return {
      lines,
      breakdown: breakdown.sections,
      bundle: {
        type: "pole_run",
        poleCount: layout.totalPoles,
        straightCount: layout.straightPoleCount,
        curveCount: layout.curvePoleCount,
        endCount: layout.endCount,
        distanceM: params.distanceM,
        poleHeightM: params.poleHeightM,
        voltage: params.voltage,
        phase: params.phase,
        scope: params.scope,
        assemblyMode: params.assemblyMode || "full"
      }
    };
  }

  function buildBudgetCapacityQuote(intent, master, mergeLine, calcTotal) {
    const params = inferVoltagePhaseDefaults(mergePoleParams(intent, intent));
    if (params.needsClarification) {
      return { error: params.clarificationQuestion, needsClarification: true };
    }

    const budgetBaht = Number(params.budgetBaht);
    if (!budgetBaht || budgetBaht <= 0) {
      return { error: "ไม่พบงบประมาณในคำถาม — ลองระบุ เช่น มีเงิน 2 แสนบาท หรือ 2 ล้านบาท" };
    }

    if (params.capacityMode === "poles" && params.scope === "pole_only") {
      if (!params.poleHeightM) {
        return {
          error: "ระบุความสูงเสา (เมตร) เพื่อคำนวณว่างบนี้ปักเสาได้กี่ต้น",
          needsClarification: true
        };
      }

      let lo = 0;
      let hi = 500000;
      let best = null;

      while (lo <= hi) {
        const mid = Math.max(1, Math.floor((lo + hi) / 2));
        const testParams = mergePoleParams(
          {
            ...params,
            poleCount: mid,
            distanceM: undefined,
            scope: "pole_only",
            assemblyMode: params.assemblyMode || "pole_material",
            includeHead: params.includeHead === true,
            includeConcrete: false
          },
          { poleCount: mid }
        );
        const result = buildPoleRunLines(testParams, master, mergeLine);
        if (!result.lines?.length) {
          hi = mid - 1;
          continue;
        }
        const total = calcTotal(result.lines, params.budgetType).total;
        if (total <= budgetBaht) {
          best = { poleCount: mid, total, result, testParams };
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      if (!best) {
        return {
          error: `งบ ${budgetBaht.toLocaleString()} บาท ไม่เพียงพอสำหรับเสา ${params.poleHeightM} ม. แม้ 1 ต้น`
        };
      }

      const layout = best.testParams.layout || computePoleCountLayout(best.poleCount);
      const perPoleTotal = best.total / best.poleCount;
      const breakdown = [
        `งบที่ถาม: ${budgetBaht.toLocaleString()} บาท · ประมาณการใช้ ${Math.round(best.total).toLocaleString()} บาท`,
        `ตอบ: ปักเสา ${params.poleHeightM} ม. (วัสดุเสาอย่างเดียว ไม่พาดสาย) ได้สูงสุด ~${best.poleCount} ต้น` +
          ` (~${Math.round(perPoleTotal).toLocaleString()} บาท/ต้น · เหลือ buffer ~${Math.round(budgetBaht - best.total).toLocaleString()} บาท)`,
        ...(best.result.breakdown || [])
      ];

      return {
        lines: best.result.lines,
        breakdown,
        bundle: {
          ...best.result.bundle,
          type: "budget_capacity",
          capacityMode: "poles",
          budgetBaht,
          estimatedTotal: best.total,
          poleCount: layout.totalPoles,
          perPoleTotal
        }
      };
    }

    let lo = 0;
    let hi = 50000;
    let best = null;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const testParams = mergePoleParams({ ...params, distanceM: mid }, { distanceM: mid });
      const result = buildPoleRunLines(testParams, master, mergeLine);
      if (!result.lines?.length) {
        hi = mid - 1;
        continue;
      }
      const total = calcTotal(result.lines, params.budgetType).total;
      if (total <= budgetBaht) {
        best = { distanceM: mid, total, result, testParams };
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    const targetDistanceM = Number(params.targetDistanceM);
    const hasTarget = targetDistanceM > 0;

    if (hasTarget) {
      const targetParams = mergePoleParams({ ...params, distanceM: targetDistanceM }, { distanceM: targetDistanceM });
      const targetResult = buildPoleRunLines(targetParams, master, mergeLine);
      if (!targetResult.lines?.length) {
        return { error: targetResult.error || "คำนวณระยะทางที่ระบุไม่ได้ — ตรวจสอบ MV/LV และ 1P/3P" };
      }

      const targetTotal = calcTotal(targetResult.lines, params.budgetType).total;
      const budgetDelta = budgetBaht - targetTotal;
      const enough = budgetDelta >= 0;
      const targetLayout = targetParams.layout || computePoleLayout(targetDistanceM);
      const verdict = enough
        ? `✓ งบพอ: ระยะ ${targetDistanceM} ม. ประมาณ ${Math.round(targetTotal).toLocaleString()} บาท — เหลือ buffer ~${Math.round(budgetDelta).toLocaleString()} บาท`
        : `✗ งบไม่พอ: ระยะ ${targetDistanceM} ม. ประมาณ ${Math.round(targetTotal).toLocaleString()} บาท — ขาด ~${Math.round(-budgetDelta).toLocaleString()} บาท`;

      const breakdown = [
        verdict,
        `งบที่ถาม: ${budgetBaht.toLocaleString()} บาท · ประมาณการใช้ ${Math.round(targetTotal).toLocaleString()} บาท`,
        `ระยะที่ถาม: ${targetDistanceM} ม. · ${targetLayout.totalPoles} ต้น` +
          ` (${targetLayout.straightPoleCount} ทางตรง + ${targetLayout.endCount} ปลายทาง` +
          `${targetLayout.curvePoleCount ? ` + ${targetLayout.curvePoleCount} โค้ง` : ""})`
      ];

      if (!enough && best) {
        const maxLayout = best.testParams.layout || computePoleLayout(best.distanceM);
        breakdown.push(
          `ด้วยงบนี้ขยายได้สูงสุด ~${best.distanceM} ม. · ${maxLayout.totalPoles} ต้น` +
            ` (ประมาณ ${Math.round(best.total).toLocaleString()} บาท)`
        );
      }

      breakdown.push(...(targetResult.breakdown || []));

      return {
        lines: targetResult.lines,
        breakdown,
        bundle: {
          ...targetResult.bundle,
          type: "budget_capacity",
          budgetBaht,
          targetDistanceM,
          targetTotal,
          budgetVerdict: enough ? "enough" : "short",
          budgetDelta,
          estimatedTotal: targetTotal,
          maxDistanceM: best?.distanceM ?? null,
          poleCount: targetLayout.totalPoles
        }
      };
    }

    if (!best) {
      return {
        error: `งบ ${budgetBaht.toLocaleString()} บาท ไม่เพียงพอสำหรับงานขยายเขต LV/MV ขั้นต่ำ (เสา + หัวเสา + สาย)`
      };
    }

    const layout = best.testParams.layout || computePoleLayout(best.distanceM);
    const breakdown = [
      `งบที่ถาม: ${budgetBaht.toLocaleString()} บาท · ประมาณการใช้ ${Math.round(best.total).toLocaleString()} บาท`,
      `ตอบ: ขยายเขตได้สูงสุด ~${best.distanceM} ม. · ${layout.totalPoles} ต้น` +
        ` (${layout.straightPoleCount} ทางตรง + ${layout.endCount} ปลายทาง` +
        `${layout.curvePoleCount ? ` + ${layout.curvePoleCount} โค้ง` : ""})`,
      ...(best.result.breakdown || [])
    ];

    return {
      lines: best.result.lines,
      breakdown,
      bundle: {
        ...best.result.bundle,
        type: "budget_capacity",
        budgetBaht,
        estimatedTotal: best.total,
        maxDistanceM: best.distanceM,
        poleCount: layout.totalPoles
      }
    };
  }

  window.PriceQuotePole = {
    DEFAULT_SPAN_M,
    DEFAULT_CURVE_SPAN_M,
    parsePoleQuery,
    mergePoleParams,
    computePoleLayout,
    buildPoleRunBreakdown,
    buildPoleRunLines,
    buildClarificationFields,
    enrichPoleIntentFromQuery,
    isPoleRunQuery,
    isLineExtensionQuery,
    isBudgetCapacityQuery,
    isTransformerBudgetQuery,
    parseBudgetBaht,
    parseBudgetCapacityQuery,
    parseAssemblyOptions,
    applyAssemblyOptions,
    resolveConcreteForParams,
    parseConcreteOnlyQuery,
    parsePointCount,
    isConcreteOnlyQuery,
    inferVoltagePhaseDefaults,
    buildBudgetCapacityQuote,
    resolvePoleMaterialId,
    expandSetItems,
    applyLineDefaults,
    applyPhaseDefaults,
    applyVoltageDefaults,
    parseExclusions
  };
})();
