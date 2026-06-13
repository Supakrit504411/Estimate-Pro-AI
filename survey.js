(function () {
  const config = window.APP_CONFIG || {};
  const surveyConfig = config.survey || {};

  const state = {
    map: null,
    markers: [],
    polylines: [],
    controlPoints: [],
    poles: [],
    selectedSpan: null,
    placeMode: null,
    pendingCurveSpan: null,
    phase: "surveying",
    mapReady: false,
    routedPaths: [],
    routedLegs: [],
    routeCache: {},
    isRebuilding: false,
    defaults: {
      straight: { poleMaterialId: "", headMaterialId: "", cableMaterialId: "" },
      curve: { poleMaterialId: "", headMaterialId: "", cableMaterialId: "" }
    }
  };

  let rebuildToken = 0;

  let els = {};

  function init() {
    cacheElements();
    initDefaultMaterialSelects();
    bindEvents();
    updateUiState();
  }

  function cacheElements() {
    els.mapEl = document.getElementById("surveyMap");
    els.poleList = document.getElementById("surveyPoleList");
    els.spanBar = document.getElementById("surveySpanBar");
    els.summary = document.getElementById("surveySummary");
    els.distanceLegs = document.getElementById("surveyDistanceLegs");
    els.modeHint = document.getElementById("surveyModeHint");
    els.sideTitle = document.getElementById("surveySideTitle");
    els.sideNote = document.getElementById("surveySideNote");
    els.gpsBtn = document.getElementById("surveyGpsBtn");
    els.startBtn = document.getElementById("surveyStartBtn");
    els.addPointBtn = document.getElementById("surveyAddPointBtn");
    els.curveInBtn = document.getElementById("surveyCurveInBtn");
    els.curveWaypointBtn = document.getElementById("surveyCurveWaypointBtn");
    els.curveOutBtn = document.getElementById("surveyCurveOutBtn");
    els.completeBtn = document.getElementById("surveyCompleteBtn");
    els.generateBtn = document.getElementById("surveyGenerateBtn");
    els.resetBtn = document.getElementById("surveyResetBtn");
    els.defaultsPanel = document.getElementById("surveyDefaultsPanel");
    els.defaultSelects = document.querySelectorAll("[data-default-group]");
  }

  function bindEvents() {
    if (!els.mapEl) return;

    els.gpsBtn.addEventListener("click", () => guardSpan(() => useCurrentLocation()));
    els.startBtn.addEventListener("click", () => guardSpan(() => beginPlaceMode("start")));
    els.addPointBtn.addEventListener("click", () => guardSpan(() => beginPlaceMode("control")));
    els.curveInBtn.addEventListener("click", () => guardSpan(beginCurveIn));
    els.curveWaypointBtn.addEventListener("click", () => guardSpan(() => beginPlaceMode("curve_waypoint")));
    els.curveOutBtn.addEventListener("click", () => guardSpan(() => beginPlaceMode("curve_out")));
    els.completeBtn.addEventListener("click", completeSurvey);
    els.generateBtn.addEventListener("click", generateEstimate);
    els.resetBtn.addEventListener("click", resetSurvey);

    if (els.spanBar) {
      els.spanBar.addEventListener("click", event => {
        const btn = event.target.closest("[data-span]");
        if (!btn || state.phase !== "surveying") return;
        state.selectedSpan = Number(btn.dataset.span);
        els.spanBar.querySelectorAll("[data-span]").forEach(node => {
          node.classList.toggle("active", node === btn);
        });
        updateUiState();
      });
    }

    if (els.poleList) {
      els.poleList.addEventListener("change", handlePoleListChange);
    }

    if (els.defaultSelects) {
      els.defaultSelects.forEach(select => {
        select.addEventListener("change", handleDefaultSelectChange);
      });
    }
  }

  function initDefaultMaterialSelects() {
    const poleCatalog = surveyConfig.poleCatalog || [];
    const headCatalog = surveyConfig.headCatalog || [];
    const cableCatalog = surveyConfig.cableCatalog || [];

    const configs = [
      { id: "surveyDefaultStraightPole", catalog: poleCatalog, placeholder: "-- เลือกเสา (ทางตรง) --" },
      { id: "surveyDefaultStraightHead", catalog: headCatalog, placeholder: "-- เลือกหัวเสา (ทางตรง) --" },
      { id: "surveyDefaultStraightCable", catalog: cableCatalog, placeholder: "-- เลือกสายไฟ (ทางตรง) --" },
      { id: "surveyDefaultCurvePole", catalog: poleCatalog, placeholder: "-- เลือกเสา (ทางโค้ง) --" },
      { id: "surveyDefaultCurveHead", catalog: headCatalog, placeholder: "-- เลือกหัวเสา (ทางโค้ง) --" },
      { id: "surveyDefaultCurveCable", catalog: cableCatalog, placeholder: "-- เลือกสายไฟ (ทางโค้ง) --" }
    ];

    configs.forEach(({ id, catalog, placeholder }) => {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = `<option value="">${placeholder}</option>${renderCatalogOptions(catalog, "")}`;
    });
  }

  function handleDefaultSelectChange(event) {
    const select = event.target;
    const group = select.dataset.defaultGroup;
    const field = select.dataset.defaultField;
    if (!group || !field || !state.defaults[group]) return;
    state.defaults[group][field] = select.value;
  }

  function resetDefaultMaterialSelects() {
    state.defaults.straight = { poleMaterialId: "", headMaterialId: "", cableMaterialId: "" };
    state.defaults.curve = { poleMaterialId: "", headMaterialId: "", cableMaterialId: "" };

    if (els.defaultSelects) {
      els.defaultSelects.forEach(select => {
        select.value = "";
      });
    }
  }

  function guardSpan(action) {
    if (!ensureSpanSelected()) return;
    action();
  }

  function onTabOpen() {
    if (!state.mapReady) initMap();
    else state.map.invalidateSize();
    renderAll();
  }

  function initMap() {
    if (!window.L || !els.mapEl) return;
    const center = surveyConfig.defaultCenter || [17.4081, 104.7762];
    state.map = L.map(els.mapEl, { zoomControl: true }).setView(center, surveyConfig.defaultZoom || 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(state.map);
    state.map.on("click", handleMapClick);
    state.mapReady = true;
  }

  function ensureProjectReady() {
    if (!window.AppCore || !window.AppCore.getProjectName()) {
      Swal.fire("กรุณากรอกชื่อโครงการก่อน", "ไปที่แท็บสร้างงานใหม่เพื่อระบุชื่อโครงการ", "info");
      return false;
    }
    return true;
  }

  function ensureSpanSelected() {
    if (!state.selectedSpan) {
      Swal.fire({
        title: "เลือก Span ก่อน",
        text: "กรุณาเลือกระยะ Span (15/20/40/80 ม.) ก่อนเริ่มสำรวจ",
        icon: "warning",
        confirmButtonText: "เข้าใจแล้ว"
      });
      return false;
    }
    return true;
  }

  async function pickStartHeadType() {
    const options = {};
    (surveyConfig.startHeadTypes || []).forEach(type => {
      options[type] = type;
    });

    const { value } = await Swal.fire({
      title: "หมุด 0 — จุดต่อระบบจำหน่ายเดิม",
      text: "เลือกประเภทหัวเสา (ไม่ต้องเลือกขนาดเสา)",
      input: "select",
      inputOptions: options,
      inputValue: surveyConfig.startHeadTypes[0],
      showCancelButton: true,
      confirmButtonText: "ยืนยัน",
      cancelButtonText: "ยกเลิก"
    });

    return value || null;
  }

  async function pickCurveSpan() {
    const options = {};
    (surveyConfig.curveSpanPresets || [15, 20]).forEach(span => {
      options[span] = `${span} เมตร`;
    });

    const { value } = await Swal.fire({
      title: "เข้าโค้ง — เลือก Span",
      text: "ช่วงโค้งใช้ Span 15 หรือ 20 เมตรเท่านั้น",
      input: "select",
      inputOptions: options,
      inputValue: "15",
      showCancelButton: true
    });

    return value ? Number(value) : null;
  }

  async function askConvertToCurveIn(ctrl) {
    const pole = state.poles.find(p => p.ctrlId === ctrl.id);
    const label = pole?.label || "หมุดสุดท้าย";

    const { isConfirmed } = await Swal.fire({
      title: "เปลี่ยนเป็นเข้าโค้ง?",
      text: `${label} — ต้องการใช้เป็นจุด "เข้าโค้ง" หรือไม่`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ใช่ เข้าโค้ง",
      cancelButtonText: "ไม่ ใช้ปกติ"
    });

    if (!isConfirmed) return false;

    const curveSpan = await pickCurveSpan();
    if (!curveSpan) return false;

    ctrl.role = "curve_in";
    ctrl.curveSpan = curveSpan;
    return true;
  }

  async function beginCurveIn() {
    if (!ensureProjectReady()) return;
    if (!state.controlPoints.length) {
      Swal.fire("ยังไม่มีจุดเริ่ม", "ปักหมุด 0 ก่อนเข้าโค้ง", "info");
      return;
    }
    if (getCurveInPoint()) {
      Swal.fire("มีจุดเข้าโค้งแล้ว", "ใช้จุดบนโค้งหรือออกโค้งต่อ", "info");
      return;
    }

    const curveSpan = await pickCurveSpan();
    if (!curveSpan) return;

    state.pendingCurveSpan = curveSpan;
    beginPlaceMode("curve_in", `แตะแผนที่ปักหมุด "เข้าโค้ง" (Span โค้ง ${curveSpan} ม.)`);
  }

  function beginPlaceMode(mode, customHint) {
    if (!ensureProjectReady()) return;

    if (mode === "control" && !state.controlPoints.length) {
      Swal.fire("ยังไม่มีหมุด 0", "ปักจุดเริ่มก่อน", "info");
      return;
    }

    if (mode === "curve_waypoint") {
      if (!getCurveInPoint()) {
        Swal.fire("ยังไม่มีจุดเข้าโค้ง", "กดเข้าโค้งก่อนปักจุดบนโค้ง", "info");
        return;
      }
      if (getCurveOutPoint()) {
        Swal.fire("ออกโค้งแล้ว", "ใช้ปักหมุดถัดไปสำหรับช่วงปกติ", "info");
        return;
      }
      customHint = "แตะแผนที่ปักจุดบนเส้นโค้ง (ช่วยให้เสาตามสภาพหน้างานจริง)";
    }

    if (mode === "curve_out") {
      if (!getCurveInPoint()) {
        Swal.fire("ยังไม่มีจุดเข้าโค้ง", "กดเข้าโค้งก่อน", "info");
        return;
      }
      if (getCurveOutPoint()) {
        Swal.fire("มีจุดออกโค้งแล้ว", "ใช้ปักหมุดถัดไปสำหรับจุดสิ้นสุด", "info");
        return;
      }
      customHint = 'แตะแผนที่ปักหมุด "ออกโค้ง"';
    }

    if (mode === "start" && state.controlPoints.length) {
      Swal.fire("มีหมุด 0 แล้ว", "กดเริ่มใหม่หากต้องการปักใหม่", "info");
      return;
    }

    state.placeMode = mode;
    const hints = {
      start: "แตะแผนที่ปักหมุด 0 (เสา/จุดต่อระบบจำหน่ายเดิม)",
      control: `แตะแผนที่ปักหมุดถัดไป — ระบบวางเสาตามถนนบนแผนที่ (Span ${state.selectedSpan} ม.)`,
      curve_in: "แตะแผนที่ปักหมุดเข้าโค้ง",
      curve_out: "แตะแผนที่ปักหมุดออกโค้ง",
      curve_waypoint: "แตะแผนที่ปักจุดบนโค้งตามถนน/เส้นทางจริง"
    };

    if (els.modeHint) els.modeHint.textContent = customHint || hints[mode] || "";
    Swal.fire({
      title: customHint || hints[mode],
      icon: "info",
      timer: 2600,
      showConfirmButton: false
    });
  }

  async function handleMapClick(event) {
    if (state.phase !== "surveying" || !state.placeMode) return;

    const point = { lat: event.latlng.lat, lng: event.latlng.lng };

    if (state.placeMode === "start") {
      const headType = await pickStartHeadType();
      if (!headType) return;
      state.controlPoints = [{
        id: makeId("ctrl"),
        lat: point.lat,
        lng: point.lng,
        role: "start",
        headType
      }];
      state.placeMode = null;
    } else {
      const role = state.placeMode;
      const ctrl = {
        id: makeId("ctrl"),
        lat: point.lat,
        lng: point.lng,
        role
      };

      if (role === "curve_in") {
        ctrl.curveSpan = state.pendingCurveSpan || 15;
        state.pendingCurveSpan = null;
      }

      state.controlPoints.push(ctrl);
      state.placeMode = null;
    }

    rebuildPolesFromControls();
  }

  async function handleControlMarkerClick(pole) {
    if (state.phase !== "surveying" || getCurveInPoint()) return;
    if (!pole.ctrlId) return;

    const ctrl = state.controlPoints.find(c => c.id === pole.ctrlId);
    if (!ctrl || ctrl.role !== "control") return;

    const lastCtrl = state.controlPoints[state.controlPoints.length - 1];
    if (ctrl.id !== lastCtrl.id) return;

    const converted = await askConvertToCurveIn(ctrl);
    if (converted) {
      markPoleAsCurveIn(ctrl);
      renderAll();
      updateUiState();
    }
  }

  function markPoleAsCurveIn(ctrl) {
    const pole = state.poles.find(p => p.ctrlId === ctrl.id);
    if (pole) {
      pole.source = "curve_in";
      pole.section = "curve";
    }
    state.poles = renumberPoles(state.poles);
  }

  function clonePole(pole) {
    return { ...pole };
  }

  function findPoleIndexByCtrlId(ctrlId) {
    return state.poles.findIndex(p => p.ctrlId === ctrlId);
  }

  function getPreservedPrefixBeforeCurveIn() {
    const curveInControlIdx = state.controlPoints.findIndex(c => c.role === "curve_in");
    if (curveInControlIdx <= 0) return null;

    const curveInCtrl = state.controlPoints[curveInControlIdx];
    const splitIdx = findPoleIndexByCtrlId(curveInCtrl.id);
    if (splitIdx < 0) return null;

    const prefix = state.poles.slice(0, splitIdx + 1).map(clonePole);
    prefix[splitIdx].source = "curve_in";
    prefix[splitIdx].section = "curve";
    return { prefix, curveInControlIdx };
  }

  async function rebuildPolesFromControls() {
    const token = ++rebuildToken;
    const poles = [];
    state.routedPaths = [];
    state.routedLegs = [];
    state.routeCache = {};

    if (!state.controlPoints.length) {
      state.poles = [];
      state.isRebuilding = false;
      renderAll();
      return;
    }

    state.isRebuilding = true;
    updateRebuildHint();
    renderAll();

    try {
      const preserved = getPreservedPrefixBeforeCurveIn();

      if (preserved) {
        const { prefix, curveInControlIdx } = preserved;
        const poles = [...prefix];
        await rebuildFromCurveIn(poles, curveInControlIdx, token);
        if (token !== rebuildToken) return;
        state.poles = renumberPoles(poles);
        return;
      }

      const start = state.controlPoints[0];
      poles.push(makePole(start, "start", start.headType || "", start.id));

      let i = 1;
      while (i < state.controlPoints.length) {
        const curveInIdx = findNextRoleIndex(i, "curve_in");

        if (curveInIdx === -1) {
          while (i < state.controlPoints.length) {
            await appendStraightSegment(poles, i - 1, i);
            if (token !== rebuildToken) return;
            i++;
          }
          break;
        }

        while (i < curveInIdx) {
          await appendStraightSegment(poles, i - 1, i);
          if (token !== rebuildToken) return;
          i++;
        }

        const curveOutIdx = findNextRoleIndex(curveInIdx + 1, "curve_out");
        if (curveOutIdx === -1) {
          await appendStraightSegment(poles, i - 1, curveInIdx);
          if (token !== rebuildToken) return;
          i = curveInIdx + 1;
          continue;
        }

        const pathCtrls = state.controlPoints.slice(curveInIdx, curveOutIdx + 1);
        const curveSpan = pathCtrls[0].curveSpan || 15;
        await appendPathSegment(poles, pathCtrls, curveSpan, curveInIdx, curveOutIdx);
        if (token !== rebuildToken) return;
        i = curveOutIdx + 1;
      }

      state.poles = renumberPoles(poles);
    } finally {
      if (token === rebuildToken) {
        state.isRebuilding = false;
        renderAll();
      }
    }
  }

  function updateRebuildHint() {
    if (!els.modeHint || !state.isRebuilding) return;
    els.modeHint.textContent = "กำลังคำนวณเสาตามเส้นถนนบนแผนที่...";
  }

  function routeCacheKey(points) {
    return points.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
  }

  async function fetchRoutePath(anchorPoints) {
    if (anchorPoints.length < 2) return anchorPoints.slice();

    const useRouting = surveyConfig.useRoadRouting !== false;
    if (!useRouting) return anchorPoints.slice();

    const key = routeCacheKey(anchorPoints);
    if (state.routeCache[key]) return state.routeCache[key];

    const coords = anchorPoints.map(p => `${p.lng},${p.lat}`).join(";");
    const base = (surveyConfig.osrmUrl || "https://router.project-osrm.org").replace(/\/$/, "");
    const url = `${base}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OSRM ${res.status}`);
      const data = await res.json();
      if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates?.length) {
        throw new Error(data.message || "no route");
      }

      const path = data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      state.routeCache[key] = path;
      return path;
    } catch (error) {
      console.warn("Road routing fallback to straight line:", error);
      return anchorPoints.slice();
    }
  }

  async function rebuildFromCurveIn(poles, curveInControlIdx, token) {
    const curveOutIdx = findNextRoleIndex(curveInControlIdx + 1, "curve_out");
    const tailAfterCurveIn = state.controlPoints.slice(curveInControlIdx + 1);

    if (curveOutIdx === -1) {
      if (!tailAfterCurveIn.length) return;

      const pathCtrls = [
        state.controlPoints[curveInControlIdx],
        ...tailAfterCurveIn
      ];
      const curveSpan = state.controlPoints[curveInControlIdx].curveSpan || 15;
      await appendPathSegmentSkipFirst(
        poles,
        pathCtrls,
        curveSpan,
        curveInControlIdx,
        curveInControlIdx + tailAfterCurveIn.length
      );
      if (token !== rebuildToken) return;
      return;
    }

    const pathCtrls = state.controlPoints.slice(curveInControlIdx, curveOutIdx + 1);
    const curveSpan = pathCtrls[0].curveSpan || 15;
    await appendPathSegmentSkipFirst(poles, pathCtrls, curveSpan, curveInControlIdx, curveOutIdx);
    if (token !== rebuildToken) return;

    let i = curveOutIdx + 1;
    while (i < state.controlPoints.length) {
      await appendStraightSegment(poles, i - 1, i);
      if (token !== rebuildToken) return;
      i++;
    }
  }

  async function appendPathSegmentSkipFirst(poles, pathCtrls, spanM, fromIdx, toIdx) {
    const anchors = pathCtrls.map(c => ({ lat: c.lat, lng: c.lng }));
    const pathPoints = await fetchRoutePath(anchors);
    state.routedPaths.push(pathPoints);
    state.routedLegs.push({ fromIdx, toIdx, path: pathPoints });
    const positions = interpolateAlongPath(pathPoints, spanM);
    const lastCtrl = pathCtrls[pathCtrls.length - 1];

    positions.slice(1, -1).forEach(pos => {
      poles.push(makePole(pos, "auto", "", null, "curve"));
    });

    poles.push(makePole(lastCtrl, resolveEndRole(lastCtrl, pathCtrls), "", lastCtrl.id, "curve"));
  }

  async function appendStraightSegment(poles, fromIdx, toIdx) {
    const fromCtrl = state.controlPoints[fromIdx];
    const toCtrl = state.controlPoints[toIdx];
    const anchors = [
      { lat: fromCtrl.lat, lng: fromCtrl.lng },
      { lat: toCtrl.lat, lng: toCtrl.lng }
    ];
    const pathPoints = await fetchRoutePath(anchors);
    state.routedPaths.push(pathPoints);
    state.routedLegs.push({ fromIdx, toIdx, path: pathPoints });
    const positions = interpolateAlongPath(pathPoints, state.selectedSpan);
    appendPositions(poles, positions, toCtrl, null, "straight");
  }

  async function appendPathSegment(poles, pathCtrls, spanM, fromIdx, toIdx) {
    const anchors = pathCtrls.map(c => ({ lat: c.lat, lng: c.lng }));
    const pathPoints = await fetchRoutePath(anchors);
    state.routedPaths.push(pathPoints);
    state.routedLegs.push({ fromIdx, toIdx, path: pathPoints });
    const positions = interpolateAlongPath(pathPoints, spanM);
    const lastCtrl = pathCtrls[pathCtrls.length - 1];
    appendPositions(poles, positions, lastCtrl, pathCtrls, "curve");
  }

  function findNextRoleIndex(fromIdx, role) {
    for (let i = fromIdx; i < state.controlPoints.length; i++) {
      if (state.controlPoints[i].role === role) return i;
    }
    return -1;
  }

  function appendPositions(poles, positions, endCtrl, pathCtrls, section = "straight") {
    const endRole = resolveEndRole(endCtrl, pathCtrls);
    const endSection = isCurveSource(endRole) ? "curve" : section;

    positions.slice(1, -1).forEach(pos => {
      poles.push(makePole(pos, "auto", "", null, section));
    });

    const headType = endCtrl.role === "start" ? endCtrl.headType : "";
    poles.push(makePole(endCtrl, endRole, headType, endCtrl.id, endSection));
  }

  function isCurveSource(source) {
    return source === "curve_in" || source === "curve_out" || source === "curve_waypoint";
  }

  function isCurvePole(pole) {
    return pole.section === "curve" || isCurveSource(pole.source);
  }

  function getDefaultsForPole(pole) {
    return isCurvePole(pole) ? state.defaults.curve : state.defaults.straight;
  }

  function markPoleSpecFilled(pole) {
    if (pole.source === "start") {
      pole.specFilled = Boolean(pole.headMaterialId && pole.cableMaterialId);
      return;
    }
    pole.specFilled = Boolean(pole.poleMaterialId && pole.headMaterialId && pole.cableMaterialId);
  }

  function applyDefaultSpecs() {
    let appliedCount = 0;

    state.poles.forEach(pole => {
      const defs = getDefaultsForPole(pole);
      let changed = false;

      if (pole.source !== "start" && defs.poleMaterialId && !pole.poleMaterialId) {
        pole.poleMaterialId = defs.poleMaterialId;
        changed = true;
      }
      if (defs.headMaterialId && !pole.headMaterialId) {
        pole.headMaterialId = defs.headMaterialId;
        changed = true;
      }
      if (defs.cableMaterialId && !pole.cableMaterialId) {
        pole.cableMaterialId = defs.cableMaterialId;
        changed = true;
      }

      if (changed) appliedCount += 1;
      markPoleSpecFilled(pole);
    });

    return appliedCount;
  }

  function resolveEndRole(ctrl, pathCtrls) {
    if (ctrl.role === "curve_in") return "curve_in";
    if (ctrl.role === "curve_out") return "curve_out";
    if (ctrl.role === "curve_waypoint") return "curve_waypoint";
    if (ctrl.role === "start") return "start";
    const idx = state.controlPoints.indexOf(ctrl);
    if (idx === state.controlPoints.length - 1) return "end";
    return "control";
  }

  function interpolateAlongPath(points, spanM) {
    if (!points.length) return [];
    if (points.length === 1) return [points[0]];

    const total = pathTotalDistance(points);
    if (total < 1) return [points[0], points[points.length - 1]];

    const result = [points[0]];
    let nextAt = spanM;

    while (nextAt < total - spanM * 0.3) {
      result.push(pointAtPathDistance(points, nextAt));
      nextAt += spanM;
    }

    result.push(points[points.length - 1]);
    return result;
  }

  function pathTotalDistance(points) {
    let sum = 0;
    for (let i = 1; i < points.length; i++) {
      sum += distanceMeters(points[i - 1], points[i]);
    }
    return sum;
  }

  function pointAtPathDistance(points, targetDist) {
    let traveled = 0;
    for (let i = 1; i < points.length; i++) {
      const segLen = distanceMeters(points[i - 1], points[i]);
      if (traveled + segLen >= targetDist) {
        const remain = targetDist - traveled;
        const brng = bearing(points[i - 1], points[i]);
        return destinationPoint(points[i - 1].lat, points[i - 1].lng, brng, remain);
      }
      traveled += segLen;
    }
    return points[points.length - 1];
  }

  function makePole(point, source, headType = "", ctrlId = null, section = "straight") {
    return {
      id: makeId("pole"),
      ctrlId,
      lat: point.lat,
      lng: point.lng,
      source,
      section,
      headType,
      poleMaterialId: "",
      headMaterialId: "",
      cableMaterialId: "",
      specFilled: false
    };
  }

  function renumberPoles(poles) {
    let num = 0;
    return poles.map(pole => {
      if (pole.source === "start") {
        return { ...pole, number: 0, label: "หมุด 0" };
      }
      num += 1;
      return { ...pole, number: num, label: `หมุด ${num}` };
    });
  }

  function getCurveInPoint() {
    return state.controlPoints.find(c => c.role === "curve_in");
  }

  function getCurveOutPoint() {
    return state.controlPoints.find(c => c.role === "curve_out");
  }

  function isInsideCurveZone() {
    return Boolean(getCurveInPoint()) && !getCurveOutPoint();
  }

  async function useCurrentLocation() {
    if (!ensureProjectReady()) return;
    if (!navigator.geolocation) {
      Swal.fire("ไม่รองรับ GPS", "อุปกรณ์นี้ไม่สามารถดึงตำแหน่งได้", "error");
      return;
    }

    const headType = await pickStartHeadType();
    if (!headType) return;

    Swal.fire({ title: "กำลังดึง GPS...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    navigator.geolocation.getCurrentPosition(
      position => {
        Swal.close();
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        if (state.map) state.map.setView([point.lat, point.lng], 17);

        state.controlPoints = [{
          id: makeId("ctrl"),
          lat: point.lat,
          lng: point.lng,
          role: "start",
          headType
        }];
        state.placeMode = null;
        rebuildPolesFromControls();
      },
      error => Swal.fire("GPS ไม่สำเร็จ", error.message || "ไม่สามารถดึงตำแหน่งได้", "error"),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  function completeSurvey() {
    if (!ensureSpanSelected()) return;

    if (state.controlPoints.length < 2) {
      Swal.fire("ยังสำรวจไม่ครบ", "ต้องมีอย่างน้อยหมุด 0 และหมุดถัดไปอีก 1 จุด", "info");
      return;
    }

    const curveIn = getCurveInPoint();
    const curveOut = getCurveOutPoint();
    if (curveIn && !curveOut) {
      Swal.fire("ยังไม่มีจุดออกโค้ง", "กรุณาปักหมุดออกโค้งก่อนสำรวจเสร็จ", "warning");
      return;
    }

    state.phase = "spec";
    state.placeMode = null;
    const appliedCount = applyDefaultSpecs();
    renderAll();

    const defaultHint = appliedCount > 0
      ? `เติมค่า Default ให้ ${appliedCount} หมุดแล้ว — ตรวจสอบ/แก้ไขรายหมุดได้`
      : "กรอกรายละเอียดเสา / หัวเสา / สายไฟ ของแต่ละหมุด (หมุด 0 ไม่ต้องเลือกขนาดเสา)";

    Swal.fire({
      title: "สำรวจเสร็จสิ้น",
      text: defaultHint,
      icon: "success",
      timer: 2800,
      showConfirmButton: false
    });
  }

  function renderAll() {
    updateMapLayers();
    renderPoleList();
    updateSummary();
    updateDistanceLegs();
    updateUiState();
  }

  function updateUiState() {
    const surveying = state.phase === "surveying";
    const hasStart = state.controlPoints.length > 0;
    const hasCurveIn = Boolean(getCurveInPoint());
    const hasCurveOut = Boolean(getCurveOutPoint());
    const inCurve = isInsideCurveZone();
    const canComplete = hasStart && state.controlPoints.length >= 2;

    if (els.startBtn) els.startBtn.disabled = !surveying || hasStart;
    if (els.gpsBtn) els.gpsBtn.disabled = !surveying || hasStart;
    if (els.addPointBtn) els.addPointBtn.disabled = !surveying || !hasStart || inCurve;
    if (els.curveInBtn) els.curveInBtn.disabled = !surveying || !hasStart || hasCurveIn;
    if (els.curveWaypointBtn) els.curveWaypointBtn.disabled = !surveying || !inCurve;
    if (els.curveOutBtn) els.curveOutBtn.disabled = !surveying || !hasCurveIn || hasCurveOut;
    if (els.completeBtn) els.completeBtn.disabled = !surveying || !canComplete;

    if (els.generateBtn) {
      els.generateBtn.classList.toggle("hidden", state.phase !== "spec");
      els.generateBtn.disabled = state.phase !== "spec" || !allSpecsFilled();
    }

    if (surveying && !state.selectedSpan && els.modeHint) {
      els.modeHint.textContent = "⚠️ เลือก Span ก่อน (บังคับ) แล้วปักหมุด 0";
    }

    if (els.defaultsPanel) {
      els.defaultsPanel.classList.toggle("hidden", !surveying || !state.selectedSpan);
    }

    if (els.sideTitle) {
      els.sideTitle.textContent = state.phase === "spec" ? "กรอกรายละเอียดแต่ละหมุด" : "คู่มือสำรวจ";
    }
    if (els.sideNote) {
      els.sideNote.textContent = state.phase === "spec"
        ? "เลือกรหัสพัสดุจากรายการมาตรฐาน กฟภ. — แก้ไขเฉพาะหมุดที่ต้องการได้"
        : "ตั้งค่า Default พัสดุได้หลังเลือก Span แล้วเริ่มปักหมุด";
    }
  }

  function allSpecsFilled() {
    return state.poles.length > 0 && state.poles.every(pole => {
      if (pole.source === "start") {
        return pole.headMaterialId && pole.cableMaterialId;
      }
      return pole.poleMaterialId && pole.headMaterialId && pole.cableMaterialId;
    });
  }

  function createNumberIcon(number, source) {
    const classes = ["survey-pin"];
    if (source === "start") classes.push("is-start", "is-zero");
    if (source === "curve_in") classes.push("is-curve-in");
    if (source === "curve_out") classes.push("is-curve-out");
    if (source === "curve_waypoint") classes.push("is-curve-in");
    if (source === "auto") classes.push("is-auto");

    return L.divIcon({
      className: "survey-pin-wrap",
      html: `<div class="${classes.join(" ")}">${number}</div>`,
      iconSize: source === "start" ? [30, 30] : [28, 28],
      iconAnchor: source === "start" ? [15, 15] : [14, 14]
    });
  }

  function updateMapLayers() {
    if (!state.map) return;

    state.markers.forEach(m => m.remove());
    state.markers = [];
    state.polylines.forEach(p => p.remove());
    state.polylines = [];

    state.poles.forEach(pole => {
      const marker = L.marker([pole.lat, pole.lng], {
        icon: createNumberIcon(pole.number, pole.source),
        draggable: state.phase === "surveying" && pole.source !== "auto" && pole.ctrlId
      }).addTo(state.map);

      marker.bindPopup(`<b>${pole.label}</b><br>${roleText(pole.source)}${pole.headType ? `<br>หัวเสา: ${pole.headType}` : ""}`);

      if (state.phase === "surveying" && pole.ctrlId) {
        marker.on("click", event => {
          L.DomEvent.stopPropagation(event);
          handleControlMarkerClick(pole);
        });
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          const ctrl = state.controlPoints.find(c => c.id === pole.ctrlId);
          if (ctrl) {
            ctrl.lat = pos.lat;
            ctrl.lng = pos.lng;
            state.routeCache = {};
            rebuildPolesFromControls();
          }
        });
      }

      state.markers.push(marker);
    });

    state.routedPaths.forEach(path => {
      if (path.length < 2) return;
      const routeLine = L.polyline(
        path.map(p => [p.lat, p.lng]),
        { color: "#3ecf6e", weight: 5, opacity: 0.55 }
      ).addTo(state.map);
      state.polylines.push(routeLine);
    });

    if (state.controlPoints.length > 1) {
      const ctrlLine = L.polyline(
        state.controlPoints.map(c => [c.lat, c.lng]),
        { color: "#f5c96a", weight: 2, dashArray: "4 6" }
      ).addTo(state.map);
      state.polylines.push(ctrlLine);
    }

    if (state.poles.length > 1) {
      const poleLine = L.polyline(
        state.poles.map(p => [p.lat, p.lng]),
        { color: "#71e8ff", weight: 3, dashArray: "6 8" }
      ).addTo(state.map);
      state.polylines.push(poleLine);
    }
  }

  function renderCatalogOptions(catalog, selectedId) {
    return (catalog || []).map(item => `
      <option value="${item.id}" ${selectedId === item.id ? "selected" : ""}>${item.id} — ${item.name}</option>
    `).join("");
  }

  function renderPoleList() {
    if (!els.poleList) return;

    if (!state.poles.length) {
      els.poleList.innerHTML = `<div class="survey-empty">1) เลือก Span → 2) ปักหมุด 0 + หัวเสา → 3) ปักหมุดถัดไป</div>`;
      return;
    }

    if (state.phase === "surveying") {
      els.poleList.innerHTML = state.poles.map(pole => `
        <div class="survey-pole-card ${pole.source === "start" ? "is-start" : ""}">
          <div class="survey-pole-title">${pole.label} — ${roleText(pole.source)}</div>
          <div class="survey-pole-meta">${pole.headType ? `หัวเสา: ${pole.headType}` : "รอกรอกรายละเอียดหลังสำรวจเสร็จ"}</div>
        </div>
      `).join("");
      return;
    }

    const poleCatalog = surveyConfig.poleCatalog || [];
    const headCatalog = surveyConfig.headCatalog || [];
    const cableCatalog = surveyConfig.cableCatalog || [];

    els.poleList.innerHTML = state.poles.map(pole => {
      const isStart = pole.source === "start";
      const headDefault = pole.headType || "";

      return `
        <div class="survey-pole-card ${isStart ? "is-start" : ""}" data-pole-id="${pole.id}">
          <div class="survey-pole-title">${pole.label} — ${roleText(pole.source)}</div>
          ${isStart ? `<div class="survey-pole-meta">หัวเสาเริ่มต้น: ${headDefault} (กำหนดตอนปักหมุด 0)</div>` : `
          <div class="survey-field">
            <label>เสา (รหัสพัสดุ)</label>
            <select data-field="poleMaterialId" data-pole-id="${pole.id}">
              <option value="">-- เลือกเสา --</option>
              ${renderCatalogOptions(poleCatalog, pole.poleMaterialId)}
            </select>
          </div>`}
          <div class="survey-field">
            <label>หัวเสา (รหัสพัสดุ)</label>
            <select data-field="headMaterialId" data-pole-id="${pole.id}">
              <option value="">-- เลือกหัวเสา --</option>
              ${renderCatalogOptions(headCatalog, pole.headMaterialId)}
            </select>
          </div>
          <div class="survey-field">
            <label>สายไฟ (รหัสพัสดุ)</label>
            <select data-field="cableMaterialId" data-pole-id="${pole.id}">
              <option value="">-- เลือกสายไฟ --</option>
              ${renderCatalogOptions(cableCatalog, pole.cableMaterialId)}
            </select>
          </div>
        </div>
      `;
    }).join("");
  }

  function roleText(source) {
    return {
      start: "จุดเริ่ม (ระบบจำหน่าย)",
      control: "หมุดควบคุม",
      curve_in: "เข้าโค้ง",
      curve_out: "ออกโค้ง",
      curve_waypoint: "จุดบนโค้ง",
      end: "จุดสุดท้าย",
      auto: "เสาคำนวณอัตโนมัติ"
    }[source] || "เสา";
  }

  function handlePoleListChange(event) {
    if (state.phase !== "spec") return;
    const target = event.target;
    const poleId = target.dataset.poleId;
    const field = target.dataset.field;
    if (!poleId || !field) return;

    const pole = state.poles.find(item => item.id === poleId);
    if (pole) {
      pole[field] = target.value;
      markPoleSpecFilled(pole);
      updateUiState();
    }
  }

  function updateSummary() {
    if (!els.summary) return;

    const totalDist = state.poles.reduce((sum, pole, index) => {
      if (index === 0) return sum;
      return sum + distanceMeters(state.poles[index - 1], pole);
    }, 0);

    els.summary.innerHTML = `
      <div class="survey-stat"><span>หมุดทั้งหมด</span><strong>${state.poles.length}</strong></div>
      <div class="survey-stat"><span>หมุดควบคุม</span><strong>${state.controlPoints.length}</strong></div>
      <div class="survey-stat"><span>ระยะรวม</span><strong>${Math.round(totalDist)} ม.</strong></div>
      <div class="survey-stat"><span>Span หลัก</span><strong>${state.selectedSpan ? state.selectedSpan + " ม." : "ยังไม่เลือก"}</strong></div>
    `;
  }

  function getControlPathDistance(fromIdx, toIdx) {
    const routed = state.routedLegs
      .filter(leg => leg.fromIdx >= fromIdx && leg.toIdx <= toIdx)
      .reduce((sum, leg) => sum + pathTotalDistance(leg.path), 0);
    if (routed > 0) return routed;

    const slice = state.controlPoints.slice(fromIdx, toIdx + 1).map(c => ({ lat: c.lat, lng: c.lng }));
    return pathTotalDistance(slice);
  }

  function updateDistanceLegs() {
    if (!els.distanceLegs) return;

    const curveInIdx = state.controlPoints.findIndex(c => c.role === "curve_in");
    const curveOutIdx = state.controlPoints.findIndex(c => c.role === "curve_out");

    if (curveInIdx === -1 || curveOutIdx === -1 || state.phase !== "spec") {
      els.distanceLegs.classList.add("hidden");
      els.distanceLegs.innerHTML = "";
      return;
    }

    const leg1 = getControlPathDistance(0, curveInIdx);
    const legCurve = getControlPathDistance(curveInIdx, curveOutIdx);
    const leg2 = getControlPathDistance(curveOutIdx, state.controlPoints.length - 1);

    els.distanceLegs.classList.remove("hidden");
    els.distanceLegs.innerHTML = `
      <div class="distance-leg"><span>หมุด 0 → เข้าโค้ง</span><strong>${Math.round(leg1)} ม.</strong></div>
      <div class="distance-leg is-curve"><span>เข้าโค้ง → ออกโค้ง</span><strong>${Math.round(legCurve)} ม.</strong></div>
      <div class="distance-leg"><span>ออกโค้ง → จุดสุดท้าย</span><strong>${Math.round(leg2)} ม.</strong></div>
    `;
  }

  function buildBomLines() {
    const counts = {};

    state.poles.forEach((pole, index) => {
      if (pole.source !== "start" && pole.poleMaterialId) {
        const key = `pole:${pole.poleMaterialId}`;
        counts[key] = (counts[key] || 0) + 1;
      }
      if (pole.headMaterialId) {
        const key = `head:${pole.headMaterialId}`;
        counts[key] = (counts[key] || 0) + 1;
      }
      if (index > 0 && pole.cableMaterialId) {
        const span = distanceMeters(state.poles[index - 1], pole);
        const key = `cable:${pole.cableMaterialId}`;
        counts[key] = (counts[key] || 0) + span;
      }
    });

    const lines = [];
    Object.entries(counts).forEach(([key, qty]) => {
      const [type, id] = key.split(":");
      const catalog = type === "pole" ? surveyConfig.poleCatalog
        : type === "head" ? surveyConfig.headCatalog
          : surveyConfig.cableCatalog;
      const item = (catalog || []).find(c => c.id === id);
      lines.push({
        type,
        materialId: id,
        label: item ? `${id} ${item.name}` : id,
        qty: type === "cable" ? Math.ceil(qty) : qty
      });
    });
    return lines;
  }

  function findMaterialById(materialId) {
    const store = window.AppCore ? window.AppCore.getDataStore() : [];
    const idKey = String(materialId).trim();
    return store.find(item => String(item.id).trim() === idKey) || null;
  }

  async function generateEstimate() {
    if (!allSpecsFilled()) {
      Swal.fire("กรอกไม่ครบ", "กรุณาเลือกรหัสพัสดุให้ครบทุกหมุด", "warning");
      return;
    }

    const budgets = window.AppCore ? window.AppCore.getBudgets() : [];
    if (!budgets.length) {
      Swal.fire("ยังไม่มีงบ", "ไปที่แท็บสร้างงานใหม่เพื่อเพิ่มงบก่อน", "info");
      return;
    }

    const bomLines = buildBomLines();
    const matched = bomLines.map(line => ({
      ...line,
      item: findMaterialById(line.materialId)
    }));
    const missing = matched.filter(line => !line.item);

    if (missing.length) {
      const list = missing.map(line => `• ${line.label}`).join("<br>");
      const proceed = await Swal.fire({
        title: "บางรายการไม่พบใน master",
        html: `${list}<br><br>ดำเนินการต่อกับรายการที่พบ?`,
        icon: "warning",
        showCancelButton: true
      });
      if (!proceed.isConfirmed) return;
    }

    const ready = matched.filter(line => line.item);
    if (!ready.length) {
      Swal.fire("ไม่พบพัสดุ", "ไม่สามารถจับคู่รหัสพัสดุกับ master data ได้", "error");
      return;
    }

    const budgetOptions = {};
    budgets.forEach((budget, index) => { budgetOptions[index] = `งบ ${budget.type}`; });

    const { value: budgetIndex } = await Swal.fire({
      title: "เลือกงบที่จะนำเข้า",
      input: "select",
      inputOptions: budgetOptions,
      showCancelButton: true
    });
    if (budgetIndex === undefined) return;

    for (const line of ready) {
      await window.AppCore.addItemWithLabor(Number(budgetIndex), line.item, line.qty);
    }

    Swal.fire("นำเข้าสำเร็จ", "รายการจากการสำรวจถูกเพิ่มเข้างบแล้ว", "success");
    window.AppCore.switchToCreateTab();
  }

  function resetSurvey() {
    state.controlPoints = [];
    state.poles = [];
    state.selectedSpan = null;
    state.placeMode = null;
    state.pendingCurveSpan = null;
    state.phase = "surveying";
    state.routedPaths = [];
    state.routedLegs = [];
    state.routeCache = {};
    state.isRebuilding = false;
    state.markers.forEach(m => m.remove());
    state.markers = [];
    state.polylines.forEach(p => p.remove());
    state.polylines = [];
    if (els.spanBar) {
      els.spanBar.querySelectorAll("[data-span]").forEach(node => node.classList.remove("active"));
    }
    resetDefaultMaterialSelects();
    renderAll();
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function bearing(from, to) {
    const lat1 = from.lat * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;
    const dLng = (to.lng - from.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function destinationPoint(lat, lng, bearingDeg, distanceM) {
    const R = 6371000;
    const brng = bearingDeg * Math.PI / 180;
    const lat1 = lat * Math.PI / 180;
    const lng1 = lng * Math.PI / 180;
    const d = distanceM / R;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: lat2 * 180 / Math.PI, lng: lng2 * 180 / Math.PI };
  }

  function distanceMeters(a, b) {
    const R = 6371000;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  document.addEventListener("DOMContentLoaded", init);

  window.SurveyModule = { onTabOpen, resetSurvey };
})();
