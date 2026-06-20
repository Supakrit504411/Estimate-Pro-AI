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

  function detectScope(text) {
    if (/ปักเสาอย่างเดียว|เฉพาะเสา|ไม่พาดสาย|ไม่มีสาย|pole only/.test(text)) return "pole_only";
    if (/พาดสาย|ลากสาย|with wire|รวมสาย|ขยายเขต|ขยายสาย|ระยะทาง/.test(text)) return "with_wire";
    return null;
  }

  function detectCableType(text, voltage) {
    if (voltage !== "mv") return null;
    if (/เปลือย|acsr|bare|สายเปล/.test(text)) return "bare";
    if (/หุ้ม|aerial|xlpe|สายหุ้ม/.test(text)) return "aerial";
    return null;
  }

  function parsePoleHeight(text) {
    const patterns = [
      /(?:ปักเสา|ติดตั้งเสา|เสาขนาด)\s*(\d+(?:\.\d+)?)\s*(?:เมตร|ม\.|m\b)?/,
      /(?:เสา|pole)\s*(\d+(?:\.\d+)?)\s*(?:เมตร|ม\.|m\b)/,
      /(?:เสา|pole)\s*(\d+(?:\.\d+)?)/
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) return Number(m[1]);
    }
    return null;
  }

  function parseBudgetBaht(text) {
    const t = normalizeText(text);
    let m = t.match(/(\d+(?:\.\d+)?)\s*แส(?:นบาท|นบาท|น)?/);
    if (m) return Math.round(Number(m[1]) * 100000);
    m = t.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*บาท/);
    if (m) return Number(m[1].replace(/,/g, ""));
    m = t.match(/(?:มีเงิน|งบ|งบประมาณ)\s*(\d+(?:,\d{3})*)/);
    if (m) return Number(m[1].replace(/,/g, ""));
    return null;
  }

  function isBudgetCapacityQuery(text) {
    const t = normalizeText(text);
    if (!parseBudgetBaht(t)) return false;
    return /มีเงิน|งบ.*บาท|ได้กี่ต้น|กี่ต้น|กี่\s*ระยะ|ได้ระยะ|ทำได้กี่|ครอบคลุม|จะได้/.test(t);
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

  function parsePoleCount(text) {
    const m = text.match(/(\d+)\s*(?:ต้น|เสา(?!\s*(?:เมตร|ม\.|m\b)))/);
    if (m) return Number(m[1]);
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

  function parseBudgetCapacityQuery(query, budgetType = "01.1") {
    const text = normalizeText(query);
    if (!isBudgetCapacityQuery(text)) return null;

    const budgetBaht = parseBudgetBaht(text);
    const poleHeightM = parsePoleHeight(text);
    const voltage = detectVoltage(text);
    const phase = detectPhase(text);
    const scope = "with_wire";

    const intent = {
      intent: "budget_capacity",
      budgetType,
      budgetBaht,
      poleHeightM,
      voltage,
      phase,
      scope,
      cableSizeSqMm: 50,
      spanStraightM: DEFAULT_SPAN_M,
      spanCurveM: DEFAULT_CURVE_SPAN_M,
      summary: query,
      source: "local",
      clarificationType: "pole_run"
    };

    if (voltage) Object.assign(intent, applyLineDefaults(intent));
    if (phase) Object.assign(intent, applyPhaseDefaults(intent));

    const missing = buildClarificationFields(intent);
    intent.needsClarification = missing.length > 0;
    intent.clarificationFields = missing;
    intent.clarificationQuestion = buildClarificationQuestion(intent)
      || "ระบุ 1P/3P เพื่อคำนวณว่างบนี้ขยายเขตได้กี่เมตร/กี่ต้น";

    return intent;
  }

  function isPoleRunQuery(text) {
    const t = normalizeText(text);
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
          { value: "pole_only", label: "ปักเสาอย่างเดียว (เสา + หัวเสา + เงื่อนไขเสาพิเศษ)" },
          { value: "with_wire", label: "ปักเสา + พาดสายระหว่างเสา" }
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

    const budgetQuery = parseBudgetCapacityQuery(query, budgetType);
    if (budgetQuery) return budgetQuery;

    if (!isPoleRunQuery(text)) return null;

    const distanceM = parseDistanceM(text);
    const curveDistanceM = parseCurveDistanceM(text);
    const poleHeightM = parsePoleHeight(text);
    const poleCount = parsePoleCount(text);
    let voltage = detectVoltage(text);
    let phase = detectPhase(text);
    let scope = detectScope(text);
    const cableType = detectCableType(text, voltage);

    const intent = {
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
      summary: query,
      source: "local"
    };

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

  function mergePoleParams(intent, answers = {}) {
    let merged = { ...intent, ...answers };
    merged.intent = "pole_run";

    if (merged.voltage) merged = applyLineDefaults(merged);
    if (merged.phase) merged = applyPhaseDefaults(merged);

    if (merged.distanceM != null) {
      merged.distanceM = Number(merged.distanceM);
      merged.curveDistanceM = Math.max(0, Number(merged.curveDistanceM) || 0);
      merged.layout = computePoleLayout(merged.distanceM, {
        spanStraightM: merged.spanStraightM,
        spanCurveM: merged.spanCurveM,
        curveDistanceM: merged.curveDistanceM
      });
      merged.poleCount = merged.layout.totalPoles;
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

    if (headId) addSetToMap(lineMap, headId, 1, mergeLine, master);
    if (guySetId) addSetToMap(lineMap, guySetId, 1, mergeLine, master);
    if (rule.concrete?.materialId) {
      mergeLine(lineMap, rule.concrete.materialId, rule.concrete.qty || 1, "ติดตั้ง", master);
    }
    if (params.voltage === "mv") {
      if (rule.ohgwDefault) addSetToMap(lineMap, rule.ohgwDefault, 1, mergeLine, master);
      if (kind === "end" && rule.groundingSetId) {
        addSetToMap(lineMap, rule.groundingSetId, 1, mergeLine, master);
      }
      if (kind === "end" && rule.surgeArresterId) {
        mergeLine(lineMap, rule.surgeArresterId, rule.surgeArresterQty || 1, "ติดตั้ง", master);
      }
    } else if (rule.surgeSetId) {
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
      sections.push(
        `สรุป: ${voltageLabel} ${phaseLabel} · เสา ${params.poleHeightM} ม. · ${layout.totalPoles} ต้น` +
        (params.scope === "with_wire" ? ` · พาดสาย ~${params.spanStraightM} ม./ช่วง` : " · ปักเสาอย่างเดียว")
      );
    }

    if (layout.straightPoleCount > 0) {
      const rackNote = params.rackLabel ? ` · ${params.rackLabel}` : "";
      sections.push(
        `เสาทางตรง ${layout.straightPoleCount} ต้น: เสา ${poleId} + หัวเสา SET ${straightHeadId} (${getSetName(straightHeadId)})${rackNote}` +
        (params.voltage === "mv" && config?.hasOhgw && ohgwStraightId
          ? ` + OHGW SET ${ohgwStraightId}`
          : "")
      );
    }

    if (layout.curvePoleCount > 0 && curveRule) {
      sections.push(
        `เสาทางโค้ง ${layout.curvePoleCount} ต้น: เสา ${poleId} + หัวโค้ง SET ${curveHeadId} (${getSetName(curveHeadId)})` +
        ` + Guy SET ${resolveGuySetId(params.poleHeightM, configKey, curveRule)}` +
        ` + เทคอน ${curveRule.concrete?.materialId || "9090010025"} × ${curveRule.concrete?.qty || 1}` +
        (params.voltage === "mv" && curveRule.ohgwDefault ? ` + OHGW SET ${curveRule.ohgwDefault}` : "") +
        (params.voltage === "lv" && curveRule.surgeSetId ? "" : "")
      );
    }

    if (layout.endCount > 0 && endRule) {
      const extras = [
        `หัวเสาต้นสุดท้าย SET ${endHeadId} (${getSetName(endHeadId)})`,
        `ยึด Guy SET ${guySetId} (${getSetName(guySetId)})`,
        `เทคอนกรีต ${endRule.concrete?.materialId || "9090010025"} × ${endRule.concrete?.qty || 1}`
      ];
      if (params.voltage === "mv") {
        if (endRule.ohgwDefault) extras.push(`OHGW SET ${endRule.ohgwDefault}`);
        if (endRule.groundingSetId) extras.push(`GROUND SET ${endRule.groundingSetId}`);
        if (endRule.surgeArresterId) {
          extras.push(`SA ${endRule.surgeArresterId} × ${endRule.surgeArresterQty || 1}`);
        }
      } else if (endRule.surgeSetId) {
        extras.push(`Surge/ดักเสิร์จ SET ${endRule.surgeSetId}`);
      }
      sections.push(`เสาต้นสุดท้าย 1 ต้น: เสา ${poleId} + ${extras.join(" + ")}`);
    }

    if (params.scope === "with_wire" && layout.totalPoles > 1) {
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

    for (let i = 0; i < layout.straightPoleCount; i++) {
      add(poleId, 1);
      if (straightHeadId) addSetToMap(lineMap, straightHeadId, 1, mergeLine, master);
      if (params.voltage === "mv" && config?.hasOhgw && config?.straight?.defaults?.ohgwInstall) {
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

    if (params.scope === "with_wire" && layout.totalPoles > 1) {
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

    if (params.voltage === "lv" && params.distanceM) {
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
        scope: params.scope
      }
    };
  }

  function buildBudgetCapacityQuote(intent, master, mergeLine, calcTotal) {
    const params = mergePoleParams(intent, intent);
    if (params.needsClarification) {
      return { error: params.clarificationQuestion, needsClarification: true };
    }

    const budgetBaht = Number(params.budgetBaht);
    if (!budgetBaht || budgetBaht <= 0) {
      return { error: "ไม่พบงบประมาณในคำถาม — ลองระบุ เช่น มีเงิน 2 แสนบาท" };
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
        maxDistanceM: best.distanceM
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
    isPoleRunQuery,
    isLineExtensionQuery,
    isBudgetCapacityQuery,
    parseBudgetCapacityQuery,
    buildBudgetCapacityQuote,
    resolvePoleMaterialId,
    expandSetItems,
    applyLineDefaults,
    applyPhaseDefaults,
    applyVoltageDefaults
  };
})();
