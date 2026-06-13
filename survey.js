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
    mapReady: false
  };

  let els = {};

  function init() {
    cacheElements();
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
    els.curveOutBtn = document.getElementById("surveyCurveOutBtn");
    els.completeBtn = document.getElementById("surveyCompleteBtn");
    els.generateBtn = document.getElementById("surveyGenerateBtn");
    els.resetBtn = document.getElementById("surveyResetBtn");
  }

  function bindEvents() {
    if (!els.mapEl) return;

    els.gpsBtn.addEventListener("click", useCurrentLocation);
    els.startBtn.addEventListener("click", () => beginPlaceMode("start"));
    els.addPointBtn.addEventListener("click", () => beginPlaceMode("control"));
    els.curveInBtn.addEventListener("click", beginCurveIn);
    els.curveOutBtn.addEventListener("click", () => beginPlaceMode("curve_out"));
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
      Swal.fire("เลือก Span ก่อน", "กรุณาเลือกระยะ Span ก่อนเริ่มปักหมุด", "warning");
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
      title: "หัวเสาจุดเริ่ม (ระบบจำหน่ายเดิม)",
      text: "เลือกประเภทหัวเสาที่จุดต่อไลน์",
      input: "select",
      inputOptions: options,
      inputValue: surveyConfig.startHeadTypes[0],
      showCancelButton: true,
      confirmButtonText: "ยืนยัน",
      cancelButtonText: "ยกเลิก"
    });

    return value || null;
  }

  async function beginCurveIn() {
    if (!ensureProjectReady() || !ensureSpanSelected()) return;
    if (!state.controlPoints.length) {
      Swal.fire("ยังไม่มีจุดเริ่ม", "ปักจุดเริ่มก่อนเข้าโค้ง", "info");
      return;
    }
    if (getCurveInPoint()) {
      Swal.fire("มีจุดเข้าโค้งแล้ว", "กรุณาปักจุดออกโค้งก่อนเพิ่มเข้าโค้งใหม่", "info");
      return;
    }

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

    if (!value) return;
    state.pendingCurveSpan = Number(value);
    beginPlaceMode("curve_in", `แตะแผนที่เพื่อปักหมุด "เข้าโค้ง" (Span โค้ง ${state.pendingCurveSpan} ม.)`);
  }

  function beginPlaceMode(mode, customHint) {
    if (!ensureProjectReady() || !ensureSpanSelected()) return;

    if (mode === "control" && !state.controlPoints.length) {
      Swal.fire("ยังไม่มีจุดเริ่ม", "ปักจุดเริ่มก่อน", "info");
      return;
    }

    if (mode === "curve_out") {
      if (!getCurveInPoint()) {
        Swal.fire("ยังไม่มีจุดเข้าโค้ง", "กดเข้าโค้งและปักหมุดก่อน", "info");
        return;
      }
      if (getCurveOutPoint()) {
        Swal.fire("มีจุดออกโค้งแล้ว", "ใช้ปักหมุดถัดไปสำหรับจุดสิ้นสุด", "info");
        return;
      }
      customHint = 'แตะแผนที่เพื่อปักหมุด "ออกโค้ง"';
    }

    if (mode === "start" && state.controlPoints.length) {
      Swal.fire("มีจุดเริ่มแล้ว", "กดเริ่มใหม่หากต้องการปักใหม่", "info");
      return;
    }

    state.placeMode = mode;
    const hints = {
      start: "แตะแผนที่เพื่อปักจุดเริ่ม (เสา/จุดต่อระบบจำหน่ายเดิม)",
      control: `แตะแผนที่ปักหมุดถัดไป — ระบบจะคำนวณเสาตาม Span ${state.selectedSpan} ม.`,
      curve_in: `แตะแผนที่ปักหมุด "เข้าโค้ง"`,
      curve_out: `แตะแผนที่ปักหมุด "ออกโค้ง"`
    };

    els.modeHint.textContent = customHint || hints[mode] || "";
    Swal.fire({
      title: customHint || hints[mode],
      icon: "info",
      timer: 2400,
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
        ctrl.curveSpan = state.pendingCurveSpan;
        state.pendingCurveSpan = null;
      }
      state.controlPoints.push(ctrl);
      state.placeMode = null;
    }

    rebuildPolesFromControls();
    renderAll();
  }

  function rebuildPolesFromControls() {
    const poles = [];

    for (let i = 0; i < state.controlPoints.length; i++) {
      const ctrl = state.controlPoints[i];
      const isFirst = i === 0;

      if (isFirst) {
        poles.push(makePole(ctrl, "start", ctrl.headType || "", ctrl.id));
        continue;
      }

      const prevCtrl = state.controlPoints[i - 1];
      const span = getSpanForSegment(prevCtrl, ctrl);
      const from = { lat: prevCtrl.lat, lng: prevCtrl.lng };
      const to = { lat: ctrl.lat, lng: ctrl.lng };
      const positions = interpolatePolePositions(from, to, span);

      positions.slice(1, -1).forEach(pos => {
        poles.push(makePole(pos, "auto"));
      });

      const endRole = ctrl.role === "curve_in" ? "curve_in"
        : ctrl.role === "curve_out" ? "curve_out"
          : i === state.controlPoints.length - 1 ? "end" : "control";

      const headType = ctrl.role === "start" ? ctrl.headType : "";
      poles.push(makePole(ctrl, endRole, headType, ctrl.id));
    }

    state.poles = renumberPoles(poles);
  }

  function getSpanForSegment(fromCtrl, toCtrl) {
    if (fromCtrl.role === "curve_in" && toCtrl.role === "curve_out") {
      return fromCtrl.curveSpan || 15;
    }
    return state.selectedSpan;
  }

  function interpolatePolePositions(from, to, spanM) {
    const distance = distanceMeters(from, to);
    if (distance < 1) return [from, to];

    const brng = bearing(from, to);
    const positions = [from];
    let d = spanM;

    while (d < distance - spanM * 0.35) {
      positions.push(destinationPoint(from.lat, from.lng, brng, d));
      d += spanM;
    }

    positions.push(to);
    return positions;
  }

  function makePole(point, source, headType = "", ctrlId = null) {
    return {
      id: makeId("pole"),
      ctrlId,
      lat: point.lat,
      lng: point.lng,
      source,
      headType,
      poleSize: "",
      cableType: "",
      specFilled: false
    };
  }

  function renumberPoles(poles) {
    return poles.map((pole, index) => ({
      ...pole,
      number: index + 1,
      label: `หมุด ${index + 1}`
    }));
  }

  function getCurveInPoint() {
    return state.controlPoints.find(c => c.role === "curve_in");
  }

  function getCurveOutPoint() {
    return state.controlPoints.find(c => c.role === "curve_out");
  }

  async function useCurrentLocation() {
    if (!ensureProjectReady() || !ensureSpanSelected()) return;
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
        renderAll();
      },
      error => Swal.fire("GPS ไม่สำเร็จ", error.message || "ไม่สามารถดึงตำแหน่งได้", "error"),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  function completeSurvey() {
    if (state.controlPoints.length < 2) {
      Swal.fire("ยังสำรวจไม่ครบ", "ต้องมีอย่างน้อยจุดเริ่มและจุดถัดไปอีก 1 จุด", "info");
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
    renderAll();

    Swal.fire({
      title: "สำรวจเสร็จสิ้น",
      text: "กรอกรายละเอียดเสา / หัวเสา / สายไฟ ของแต่ละหมุดด้านขวา",
      icon: "success",
      timer: 2600,
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
    const hasSpan = Boolean(state.selectedSpan);
    const hasStart = state.controlPoints.length > 0;
    const hasCurveIn = Boolean(getCurveInPoint());
    const hasCurveOut = Boolean(getCurveOutPoint());
    const canComplete = hasStart && state.controlPoints.length >= 2;

    if (els.startBtn) els.startBtn.disabled = !surveying || !hasSpan || hasStart;
    if (els.addPointBtn) els.addPointBtn.disabled = !surveying || !hasStart;
    if (els.curveInBtn) els.curveInBtn.disabled = !surveying || !hasStart || hasCurveIn;
    if (els.curveOutBtn) els.curveOutBtn.disabled = !surveying || !hasCurveIn || hasCurveOut;
    if (els.completeBtn) els.completeBtn.disabled = !surveying || !canComplete;
    if (els.generateBtn) {
      els.generateBtn.classList.toggle("hidden", state.phase !== "spec");
      els.generateBtn.disabled = state.phase !== "spec" || !allSpecsFilled();
    }
    if (els.gpsBtn) els.gpsBtn.disabled = !surveying || !hasSpan || hasStart;

    if (surveying && !hasSpan && els.modeHint) {
      els.modeHint.textContent = "เลือก Span ก่อน (บังคับ) แล้วปักจุดเริ่ม";
    }

    if (els.sideTitle) {
      els.sideTitle.textContent = state.phase === "spec" ? "กรอกรายละเอียดแต่ละหมุด" : "คู่มือสำรวจ";
    }
    if (els.sideNote) {
      els.sideNote.textContent = state.phase === "spec"
        ? "หมุดที่มีเลขกำกับ — ระบุเสา / หัวเสา / สายไฟ"
        : "ปักหมุดควบคุม ระบบคำนวณเสาตาม Span อัตโนมัติ";
    }
  }

  function allSpecsFilled() {
    return state.poles.length > 0 && state.poles.every(pole =>
      pole.poleSize && pole.headType && pole.cableType
    );
  }

  function createNumberIcon(number, source) {
    const classes = ["survey-pin"];
    if (source === "start") classes.push("is-start");
    if (source === "curve_in") classes.push("is-curve-in");
    if (source === "curve_out") classes.push("is-curve-out");
    if (source === "auto") classes.push("is-auto");

    return L.divIcon({
      className: "survey-pin-wrap",
      html: `<div class="${classes.join(" ")}">${number}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
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
        draggable: state.phase === "surveying" && pole.source !== "auto"
      }).addTo(state.map);

      const roleLabel = {
        start: "จุดเริ่ม (ระบบจำหน่ายเดิม)",
        control: "หมุดควบคุม",
        curve_in: "เข้าโค้ง",
        curve_out: "ออกโค้ง",
        end: "จุดสุดท้าย",
        auto: "เสาคำนวณอัตโนมัติ"
      }[pole.source] || "เสา";

      marker.bindPopup(`<b>หมุด ${pole.number}</b><br>${roleLabel}${pole.headType ? `<br>หัวเสา: ${pole.headType}` : ""}`);

      if (state.phase === "surveying" && pole.source !== "auto" && pole.ctrlId) {
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          const ctrl = state.controlPoints.find(c => c.id === pole.ctrlId);
          if (ctrl) {
            ctrl.lat = pos.lat;
            ctrl.lng = pos.lng;
            rebuildPolesFromControls();
            renderAll();
          }
        });
      }

      state.markers.push(marker);
    });

    if (state.poles.length > 1) {
      const line = L.polyline(
        state.poles.map(p => [p.lat, p.lng]),
        { color: "#71e8ff", weight: 3, dashArray: "6 8" }
      ).addTo(state.map);
      state.polylines.push(line);
    }
  }

  function renderPoleList() {
    if (!els.poleList) return;

    if (!state.poles.length) {
      els.poleList.innerHTML = `<div class="survey-empty">เลือก Span → ปักจุดเริ่ม + ระบุหัวเสา → ปักหมุดถัดไป</div>`;
      return;
    }

    if (state.phase === "surveying") {
      els.poleList.innerHTML = state.poles.map(pole => `
        <div class="survey-pole-card ${pole.source === "start" ? "is-start" : ""}">
          <div class="survey-pole-title">หมุด ${pole.number} — ${roleText(pole.source)}</div>
          <div class="survey-pole-meta">${pole.headType ? `หัวเสาเริ่มต้น: ${pole.headType}` : "รอกรอกรายละเอียดหลังสำรวจเสร็จ"}</div>
        </div>
      `).join("");
      return;
    }

    els.poleList.innerHTML = state.poles.map(pole => {
      const sizeOptions = (surveyConfig.poleSizes || []).map(size =>
        `<option value="${size}" ${pole.poleSize === size ? "selected" : ""}>${size}</option>`
      ).join("");

      const headOptions = (surveyConfig.poleHeadTypes || []).map(head =>
        `<option value="${head}" ${pole.headType === head ? "selected" : ""}>${head}</option>`
      ).join("");

      const cableOptions = (surveyConfig.cableTypes || []).map(cable =>
        `<option value="${cable}" ${pole.cableType === cable ? "selected" : ""}>${cable}</option>`
      ).join("");

      return `
        <div class="survey-pole-card" data-pole-id="${pole.id}">
          <div class="survey-pole-title">หมุด ${pole.number} — ${roleText(pole.source)}</div>
          <div class="survey-field">
            <label>ขนาดเสา</label>
            <select data-field="poleSize" data-pole-id="${pole.id}"><option value="">-- เลือก --</option>${sizeOptions}</select>
          </div>
          <div class="survey-field">
            <label>หัวเสา</label>
            <select data-field="headType" data-pole-id="${pole.id}"><option value="">-- เลือก --</option>${headOptions}</select>
          </div>
          <div class="survey-field">
            <label>สายไฟ</label>
            <select data-field="cableType" data-pole-id="${pole.id}"><option value="">-- เลือก --</option>${cableOptions}</select>
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
      pole.specFilled = Boolean(pole.poleSize && pole.headType && pole.cableType);
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
      <div class="survey-stat"><span>Span หลัก</span><strong>${state.selectedSpan ? state.selectedSpan + " ม." : "-"}</strong></div>
    `;
  }

  function updateDistanceLegs() {
    if (!els.distanceLegs) return;

    const curveIn = getCurveInPoint();
    const curveOut = getCurveOutPoint();
    const start = state.controlPoints[0];
    const end = state.controlPoints[state.controlPoints.length - 1];

    if (!curveIn || !curveOut || !start || !end || state.phase !== "spec") {
      els.distanceLegs.classList.add("hidden");
      els.distanceLegs.innerHTML = "";
      return;
    }

    const leg1 = distanceMeters(start, curveIn);
    const legCurve = distanceMeters(curveIn, curveOut);
    const leg2 = distanceMeters(curveOut, end);

    els.distanceLegs.classList.remove("hidden");
    els.distanceLegs.innerHTML = `
      <div class="distance-leg"><span>ต้นทาง → เข้าโค้ง</span><strong>${Math.round(leg1)} ม.</strong></div>
      <div class="distance-leg is-curve"><span>เข้าโค้ง → ออกโค้ง</span><strong>${Math.round(legCurve)} ม.</strong></div>
      <div class="distance-leg"><span>ออกโค้ง → จุดสุดท้าย</span><strong>${Math.round(leg2)} ม.</strong></div>
    `;
  }

  function buildBomLines() {
    const poleCounts = {};
    const headCounts = {};
    const cableLengths = {};

    state.poles.forEach((pole, index) => {
      const poleKey = pole.poleSize || surveyConfig.poleSizes[0];
      const headKey = pole.headType || "";
      poleCounts[poleKey] = (poleCounts[poleKey] || 0) + 1;
      headCounts[headKey] = (headCounts[headKey] || 0) + 1;

      if (index > 0) {
        const cableKey = pole.cableType || surveyConfig.cableTypes[0];
        const span = distanceMeters(state.poles[index - 1], pole);
        cableLengths[cableKey] = (cableLengths[cableKey] || 0) + span;
      }
    });

    const lines = [];
    Object.entries(poleCounts).forEach(([size, qty]) => {
      lines.push({ type: "pole", label: `เสา ${size}`, qty, keywords: (surveyConfig.materialKeywords.pole || {})[size] || ["เสา"] });
    });
    Object.entries(headCounts).forEach(([head, qty]) => {
      if (!head) return;
      lines.push({ type: "head", label: `หัวเสา ${head}`, qty, keywords: (surveyConfig.materialKeywords.head || {})[head] || ["หัวเสา"] });
    });
    Object.entries(cableLengths).forEach(([cable, meters]) => {
      lines.push({ type: "cable", label: `สายไฟ ${cable}`, qty: Math.ceil(meters), keywords: (surveyConfig.materialKeywords.cable || {})[cable] || ["สาย"] });
    });
    return lines;
  }

  function findMaterial(keywords) {
    const store = window.AppCore ? window.AppCore.getDataStore() : [];
    const terms = (keywords || []).map(term => term.toLowerCase());
    const hits = store.filter(item => {
      const hay = `${item.id} ${item.name}`.toLowerCase();
      return terms.every(term => hay.includes(term));
    });
    if (hits.length) return hits[0];
    const loose = store.filter(item => {
      const hay = `${item.id} ${item.name}`.toLowerCase();
      return terms.some(term => hay.includes(term));
    });
    return loose[0] || null;
  }

  async function generateEstimate() {
    if (!allSpecsFilled()) {
      Swal.fire("กรอกไม่ครบ", "กรุณากรอกเสา / หัวเสา / สายไฟ ทุกหมุด", "warning");
      return;
    }

    const budgets = window.AppCore ? window.AppCore.getBudgets() : [];
    if (!budgets.length) {
      Swal.fire("ยังไม่มีงบ", "ไปที่แท็บสร้างงานใหม่เพื่อเพิ่มงบก่อน", "info");
      return;
    }

    const bomLines = buildBomLines();
    const matched = bomLines.map(line => ({ ...line, item: findMaterial(line.keywords) }));
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
      Swal.fire("ไม่พบพัสดุ", "ไม่สามารถจับคู่กับ master data ได้", "error");
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
    state.markers.forEach(m => m.remove());
    state.markers = [];
    state.polylines.forEach(p => p.remove());
    state.polylines = [];
    if (els.spanBar) {
      els.spanBar.querySelectorAll("[data-span]").forEach(node => node.classList.remove("active"));
    }
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
