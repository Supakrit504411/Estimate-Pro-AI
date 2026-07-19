(function () {
  const config = window.APP_CONFIG || {};
  const surveyConfig = config.survey || {};

  const presetsApi = window.SurveyPresetsApi || {};

  const SURVEY_SWAL_COMPACT = {
    width: "min(92vw, 380px)",
    customClass: { popup: "pea-swal-popup swal-survey-compact" }
  };

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
    sessionActive: false,
    mapReady: false,
    routedPaths: [],
    routedLegs: [],
    routeCache: {},
    isRebuilding: false,
    history: [],
    historyIndex: -1,
    attachFiles: [],
    surveyMeta: null,
    voltageType: null,
    phaseType: null,
    presetConfig: null,
    aimLine: null,
    surveyEstimateImported: false,
    surveyProjectSaved: false,
    defaults: {
      straight: { poleMaterialId: "", headMaterialId: "", cableMaterialId: "", ohgwSetId: "", ohgwInstall: false },
      curve: { poleMaterialId: "", headMaterialId: "", cableMaterialId: "", ohgwSetId: "", ohgwInstall: false }
    },
    segments: [],
    trInstalls: [],
    activeSegmentId: null
  };

  const projectApi = window.SurveyProject;

  let rebuildToken = 0;

  let els = {};

  function init() {
    cacheElements();
    initSystemSelectors();
    bindEvents();
    renderSegmentList();
    updateUiState();
  }

  function cacheElements() {
    els.mapEl = document.getElementById("surveyMap");
    els.mapShell = document.querySelector(".survey-map-shell");
    els.mapStatsOverlay = document.getElementById("surveyMapStatsOverlay");
    els.poleList = document.getElementById("surveyPoleList");
    els.prePanel = document.getElementById("surveyPrePanel");
    els.mapStage = document.getElementById("surveyMapStage");
    els.sidePanel = document.getElementById("surveySidePanel");
    els.layout = document.querySelector(".survey-layout");
    els.summary = document.getElementById("surveySummary");
    els.distanceLegs = document.getElementById("surveyDistanceLegs");
    els.modeHint = document.getElementById("surveyModeHint");
    els.sideTitle = document.getElementById("surveySideTitle");
    els.sideNote = document.getElementById("surveySideNote");
    els.beginBtn = document.getElementById("surveyBeginBtn");
    els.backBtn = document.getElementById("surveyBackBtn");
    els.forwardBtn = document.getElementById("surveyForwardBtn");
    els.gpsBtn = document.getElementById("surveyGpsBtn");
    els.spanControl = document.getElementById("surveySpanControl");
    els.fieldModeBtn = document.getElementById("surveyFieldModeBtn");
    els.startBtn = document.getElementById("surveyStartBtn");
    els.addPointBtn = document.getElementById("surveyAddPointBtn");
    els.curveInBtn = document.getElementById("surveyCurveInBtn");
    els.curveWaypointBtn = document.getElementById("surveyCurveWaypointBtn");
    els.curveOutBtn = document.getElementById("surveyCurveOutBtn");
    els.completeBtn = document.getElementById("surveyCompleteBtn");
    els.generateBtn = document.getElementById("surveyGenerateBtn");
    els.resetBtn = document.getElementById("surveyResetBtn");
    els.specActions = document.getElementById("surveySpecActions");
    els.defaultsPanel = document.getElementById("surveyDefaultsPanel");
    els.defaultSelects = document.querySelectorAll("[data-default-group]");
    els.systemPanel = document.getElementById("surveySystemPanel");
    els.voltageStep = document.getElementById("surveyVoltageStep");
    els.phaseStep = document.getElementById("surveyPhaseStep");
    els.voltageChoices = document.getElementById("surveyVoltageChoices");
    els.phaseChoices = document.getElementById("surveyPhaseChoices");
    els.voltageBadge = document.getElementById("surveyVoltageBadge");
    els.phaseBadge = document.getElementById("surveyPhaseBadge");
    els.voltageEdit = document.getElementById("surveyVoltageEdit");
    els.phaseEdit = document.getElementById("surveyPhaseEdit");
    els.fileInput = document.getElementById("surveyFileInput");
    els.attachBtn = document.getElementById("surveyAttachBtn");
    els.attachBtnMap = document.getElementById("surveyAttachBtnMap");
    els.attachList = document.getElementById("surveyAttachList");
    els.toolButtons = document.querySelectorAll("[data-survey-tool]");
    els.toolbar = document.getElementById("surveyToolbar");
    els.toolbarToggle = document.getElementById("surveyToolbarToggle");
    els.segmentList = document.getElementById("surveySegmentList");
    els.activeSegmentLabel = document.getElementById("surveyActiveSegment");
    els.addMvBtn = document.getElementById("surveyAddMvBtn");
    els.addLvBtn = document.getElementById("surveyAddLvBtn");
    els.trBtn = document.getElementById("surveyTrBtn");
    els.addLvFromTrBtn = document.getElementById("surveyAddLvFromTrBtn");
    els.mapAim = document.getElementById("surveyMapAim");
    els.mapAimDist = document.getElementById("surveyMapAimDist");
    els.placeAimBtn = document.getElementById("surveyPlaceAimBtn");
    els.tabMenuBtn = document.getElementById("surveyTabMenuBtn");
    els.exportKmlBtn = document.getElementById("surveyExportKmlBtn");
    els.exportKmlSideBtn = document.getElementById("surveyExportKmlSideBtn");
    els.saveProjectBtn = document.getElementById("surveySaveProjectBtn");
  }

  function bindEvents() {
    if (!els.mapEl) return;

    if (els.beginBtn) els.beginBtn.addEventListener("click", beginSurveySession);
    if (els.backBtn) els.backBtn.addEventListener("click", undoSurvey);
    if (els.forwardBtn) els.forwardBtn.addEventListener("click", redoSurvey);
    if (els.gpsBtn) els.gpsBtn.addEventListener("click", () => guardSpan(() => useCurrentLocation()));
    if (els.startBtn) els.startBtn.addEventListener("click", () => guardSpan(() => beginPlaceMode("start")));
    if (els.addPointBtn) els.addPointBtn.addEventListener("click", () => guardSpan(() => beginPlaceMode("control")));
    if (els.curveInBtn) els.curveInBtn.addEventListener("click", () => guardSpan(beginCurveIn));
    if (els.curveWaypointBtn) els.curveWaypointBtn.addEventListener("click", () => guardSpan(() => beginPlaceMode("curve_waypoint")));
    if (els.curveOutBtn) els.curveOutBtn.addEventListener("click", () => guardSpan(() => beginPlaceMode("curve_out")));
    if (els.spanControl) bindSpanControl();
    if (els.fieldModeBtn) {
      els.fieldModeBtn.addEventListener("click", toggleFieldMode);
      syncFieldModeUi();
    }
    els.completeBtn.addEventListener("click", () => { completeSurvey(); });
    els.generateBtn.addEventListener("click", generateEstimate);
    els.resetBtn.addEventListener("click", resetSurvey);

    document.querySelectorAll("[data-add-segment]").forEach(btn => {
      btn.addEventListener("click", () => handleAddSegmentClick(btn.dataset.addSegment));
    });
    if (els.addMvBtn) els.addMvBtn.addEventListener("click", () => handleAddSegmentClick("mv"));
    if (els.addLvBtn) els.addLvBtn.addEventListener("click", () => handleAddSegmentClick("lv"));
    if (els.trBtn) els.trBtn.addEventListener("click", () => beginPlaceMode("tr_pick"));
    if (els.addLvFromTrBtn) els.addLvFromTrBtn.addEventListener("click", () => addLvBranchFromTr());
    if (els.placeAimBtn) els.placeAimBtn.addEventListener("click", () => placeAtMapCenter());
    if (els.exportKmlBtn) els.exportKmlBtn.addEventListener("click", exportSurveyKml);
    if (els.exportKmlSideBtn) els.exportKmlSideBtn.addEventListener("click", exportSurveyKml);
    if (els.saveProjectBtn) {
      els.saveProjectBtn.addEventListener("click", () => {
        if (window.AppCore?.confirmSaveProject) {
          window.AppCore.confirmSaveProject({ fromSurvey: true, stayOnSurvey: true });
        }
      });
    }

    // กลุ่มปุ่มเพิ่มส่วน/TR: ยุบหลังผู้ใช้เลือกเครื่องมือ กดหัวข้อเพื่อกางใหม่
    const segTools = document.getElementById("surveySegTools");
    const segToolsToggle = document.getElementById("surveySegToolsToggle");
    if (segTools && segToolsToggle) {
      const setSegTools = open => {
        segTools.classList.toggle("is-collapsed", !open);
        segToolsToggle.setAttribute("aria-expanded", open ? "true" : "false");
        segToolsToggle.innerHTML = `<svg class="icon icon-sm" aria-hidden="true"><use href="#icon-plus"/></svg> เพิ่มส่วน / TR ${open ? "▾" : "▸"}`;
      };
      segToolsToggle.addEventListener("click", () => {
        setSegTools(segTools.classList.contains("is-collapsed"));
      });
      segTools.addEventListener("click", e => {
        if (e.target.closest("button")) setSegTools(false);
      });
      window.__surveySetSegTools = setSegTools;
    }

    if (els.toolbarToggle) {
      els.toolbarToggle.addEventListener("click", toggleMobileToolbar);
    }
    if (els.tabMenuBtn) {
      els.tabMenuBtn.addEventListener("click", () => {
        document.body.classList.toggle("survey-show-nav");
        collapseMobileToolbar();
      });
    }

    document.getElementById("appBottomNav")?.addEventListener("click", () => {
      document.body.classList.remove("survey-show-nav");
    });

    if (els.attachBtn) els.attachBtn.addEventListener("click", () => els.fileInput?.click());
    if (els.attachBtnMap) els.attachBtnMap.addEventListener("click", () => els.fileInput?.click());
    if (els.fileInput) els.fileInput.addEventListener("change", handleSurveyFileSelect);

    if (els.poleList) {
      els.poleList.addEventListener("change", handlePoleListChange);
    }

    if (els.defaultSelects) {
      els.defaultSelects.forEach(select => {
        if (select.tagName === "SELECT") {
          select.addEventListener("change", handleDefaultSelectChange);
        } else if (select.type === "checkbox") {
          select.addEventListener("change", handleDefaultCheckboxChange);
        }
      });
    }

    if (els.voltageChoices) {
      els.voltageChoices.querySelectorAll("[data-voltage]").forEach(btn => {
        btn.addEventListener("click", () => selectVoltage(btn.dataset.voltage));
      });
    }
    if (els.phaseChoices) {
      els.phaseChoices.querySelectorAll("[data-phase]").forEach(btn => {
        btn.addEventListener("click", () => selectPhase(btn.dataset.phase));
      });
    }
    if (els.voltageEdit) els.voltageEdit.addEventListener("click", editVoltageSelection);
    if (els.phaseEdit) els.phaseEdit.addEventListener("click", editPhaseSelection);
  }

  async function handleSurveyFileSelect(event) {
    const input = event.target;
    const files = Array.from(input.files || []);
    if (!files.length) return;

    if (!window.AppCore || !window.AppCore.addProjectFiles) {
      Swal.fire("ระบบไม่พร้อม", "ไม่สามารถแนบไฟล์ได้", "error");
      input.value = "";
      return;
    }

    try {
      const indices = await window.AppCore.addProjectFiles(files);
      files.forEach((file, i) => {
        state.attachFiles.push({
          name: file.name,
          type: file.type,
          listIndex: indices[i]
        });
      });
      renderAttachList();
      updateModeHint();
    } catch (error) {
      Swal.fire("แนบไฟล์ไม่สำเร็จ", error.message || "ลองใหม่อีกครั้ง", "error");
    }

    input.value = "";
  }

  function renderAttachList() {
    if (!els.attachList) return;

    if (!state.attachFiles.length) {
      els.attachList.innerHTML = "";
      return;
    }

    els.attachList.innerHTML = state.attachFiles.map((file, index) => `
      <div class="survey-attach-item">
        <span>${escapeHtml(file.name)}</span>
        <button type="button" class="ghost-btn" data-remove-attach="${index}">ลบ</button>
      </div>
    `).join("");

    els.attachList.querySelectorAll("[data-remove-attach]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.removeAttach);
        const file = state.attachFiles[idx];
        if (file && window.AppCore && window.AppCore.removeProjectFileAt) {
          window.AppCore.removeProjectFileAt(file.listIndex);
          state.attachFiles.forEach(item => {
            if (item.listIndex > file.listIndex) item.listIndex -= 1;
          });
        }
        state.attachFiles.splice(idx, 1);
        renderAttachList();
      });
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const DEFAULT_SPAN = 40;

  async function pickSpanSegmented({ title, text, presets, defaultValue }) {
    let picked = null;
    await Swal.fire({
      title,
      text,
      html: `
        <div class="span-segmented" role="group" aria-label="เลือก Span">
          ${presets.map(span => `
            <button type="button" class="span-seg-btn${Number(span) === Number(defaultValue) ? " is-selected" : ""}" data-span="${span}">
              ${span}<small>เมตร</small>
            </button>
          `).join("")}
        </div>
      `,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: "ยกเลิก",
      didOpen: popup => {
        popup.querySelectorAll("[data-span]").forEach(btn => {
          btn.addEventListener("click", () => {
            picked = Number(btn.dataset.span);
            Swal.close();
          });
        });
      }
    });
    return picked;
  }

  async function pickSpanOnStart() {
    const presets = surveyConfig.spanPresets || [15, 20, 40, 80];
    return pickSpanSegmented({
      title: "เลือก Span",
      text: "ระยะ Span ระหว่างเสา",
      presets,
      defaultValue: presets.includes(DEFAULT_SPAN) ? DEFAULT_SPAN : presets[0]
    });
  }

  async function promptProjectNameIfNeeded() {
    if (window.AppCore && window.AppCore.getProjectName()) return true;

    const { value, isDismissed } = await Swal.fire({
      title: "ชื่อโครงการ",
      text: "กรอกชื่อโครงการก่อนเริ่มสำรวจ (บันทึกร่วมกับแท็บสร้างงานใหม่)",
      input: "text",
      inputPlaceholder: "ระบุชื่อโครงการ / สถานที่ / งานที่ต้องการประมาณ",
      showCancelButton: true,
      confirmButtonText: "ยืนยัน",
      inputValidator: val => {
        if (!val || !val.trim()) return "กรุณากรอกชื่อโครงการ";
        return undefined;
      }
    });

    if (isDismissed || !value) return false;
    window.AppCore.setProjectName(value.trim());
    return true;
  }

  function refreshMapSize() {
    if (!state.map) return;
    state.map.invalidateSize({ pan: false });
  }

  function scheduleMapResize() {
    refreshMapSize();
    requestAnimationFrame(() => {
      refreshMapSize();
      requestAnimationFrame(refreshMapSize);
    });
    [120, 350, 700].forEach(ms => {
      setTimeout(refreshMapSize, ms);
    });
  }

  async function beginSurveySession() {
    const span = state.selectedSpan || DEFAULT_SPAN;

    const ready = await promptProjectNameIfNeeded();
    if (!ready) return;

    state.selectedSpan = span;
    const activeSeg = getActiveLineSegment();
    if (activeSeg) activeSeg.selectedSpan = span;

    state.sessionActive = true;
    state.placeMode = null;
    resetHistory();

    if (els.prePanel) els.prePanel.classList.add("hidden");
    if (els.mapStage) {
      els.mapStage.classList.remove("hidden");
      els.mapStage.classList.add("is-active");
    }
    if (els.sidePanel) els.sidePanel.classList.add("hidden");
    if (els.layout) els.layout.classList.remove("is-spec-mode");

    setMapActiveMode(true);
    collapseMobileToolbar();

    if (!state.mapReady) initMap();
    scheduleMapResize();

    renderSegmentList();
    updateActiveSegmentLabel();
    pushHistory();
    renderAll();
    updateModeHint();
  }

  function createSnapshot() {
    syncActiveSegmentToStore();
    return {
      segments: JSON.parse(JSON.stringify(state.segments)),
      trInstalls: JSON.parse(JSON.stringify(state.trInstalls)),
      activeSegmentId: state.activeSegmentId,
      controlPoints: JSON.parse(JSON.stringify(state.controlPoints)),
      poles: JSON.parse(JSON.stringify(state.poles)),
      routedPaths: JSON.parse(JSON.stringify(state.routedPaths)),
      routedLegs: JSON.parse(JSON.stringify(state.routedLegs)),
      routeCache: JSON.parse(JSON.stringify(state.routeCache)),
      defaults: JSON.parse(JSON.stringify(state.defaults)),
      selectedSpan: state.selectedSpan,
      voltageType: state.voltageType,
      phaseType: state.phaseType,
      placeMode: state.placeMode,
      pendingCurveSpan: state.pendingCurveSpan,
      phase: state.phase
    };
  }

  function resetHistory() {
    state.history = [];
    state.historyIndex = -1;
  }

  function pushHistory() {
    const snap = createSnapshot();
    if (state.historyIndex < state.history.length - 1) {
      state.history = state.history.slice(0, state.historyIndex + 1);
    }
    state.history.push(snap);
    if (state.history.length > 40) {
      state.history.shift();
    } else {
      state.historyIndex += 1;
    }
    updateHistoryButtons();
  }

  function restoreSnapshot(snap) {
    state.segments = JSON.parse(JSON.stringify(snap.segments || []));
    state.trInstalls = JSON.parse(JSON.stringify(snap.trInstalls || []));
    state.activeSegmentId = snap.activeSegmentId || null;
    state.controlPoints = JSON.parse(JSON.stringify(snap.controlPoints));
    state.poles = JSON.parse(JSON.stringify(snap.poles));
    state.routedPaths = JSON.parse(JSON.stringify(snap.routedPaths || []));
    state.routedLegs = JSON.parse(JSON.stringify(snap.routedLegs || []));
    state.routeCache = JSON.parse(JSON.stringify(snap.routeCache || {}));
    state.defaults = JSON.parse(JSON.stringify(snap.defaults || state.defaults));
    state.selectedSpan = snap.selectedSpan;
    state.voltageType = snap.voltageType;
    state.phaseType = snap.phaseType;
    state.presetConfig = state.voltageType && state.phaseType
      ? presetsApi.getConfig(state.voltageType, state.phaseType)
      : null;
    state.placeMode = snap.placeMode;
    state.pendingCurveSpan = snap.pendingCurveSpan;
    state.phase = snap.phase || "surveying";
    renderSegmentList();
    updateActiveSegmentLabel();
    renderAll();
    updateModeHint();
    updateToolbarActiveState();
  }

  function undoSurvey() {
    if (state.historyIndex <= 0) return;
    state.historyIndex -= 1;
    restoreSnapshot(state.history[state.historyIndex]);
  }

  function redoSurvey() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex += 1;
    restoreSnapshot(state.history[state.historyIndex]);
  }

  function updateHistoryButtons() {
    if (els.backBtn) els.backBtn.disabled = state.historyIndex <= 0;
    if (els.forwardBtn) els.forwardBtn.disabled = state.historyIndex >= state.history.length - 1;
  }

  function updateToolbarActiveState() {
    if (!els.toolButtons) return;
    els.toolButtons.forEach(btn => {
      const tool = btn.dataset.surveyTool;
      if (tool === "field_mode") return;
      if (!tool || tool === "back" || tool === "forward" || tool === "complete" || tool === "reset" || tool === "attach"
        || tool === "add_mv" || tool === "add_lv" || tool === "tr_pick" || tool === "add_lv_tr") {
        btn.classList.remove("is-active");
        return;
      }
      btn.classList.toggle("is-active", state.placeMode === tool);
    });
  }

  const FIELD_MODE_KEY = "pea_survey_field_mode_v1";
  const FIELD_LINE_COLORS = { mv: "#d50000", lv: "#0d47a1", tr: "#1b5e20" };

  function isFieldMode() {
    try {
      return localStorage.getItem(FIELD_MODE_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function toggleFieldMode() {
    const next = !isFieldMode();
    try {
      localStorage.setItem(FIELD_MODE_KEY, next ? "1" : "0");
    } catch (error) { /* localStorage unavailable */ }
    syncFieldModeUi();
    updateMapLayers();
  }

  function syncFieldModeUi() {
    const on = isFieldMode();
    document.body.classList.toggle("field-contrast", on);
    if (els.fieldModeBtn) {
      els.fieldModeBtn.classList.toggle("is-active", on);
      els.fieldModeBtn.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function bindSpanControl() {
    const presets = surveyConfig.spanPresets || [15, 20, 40, 80];
    els.spanControl.innerHTML = `
      <span class="survey-span-label">Span</span>
      ${presets.map(span => `
        <button type="button" class="survey-span-btn" data-span="${span}">${span}</button>
      `).join("")}
    `;
    els.spanControl.querySelectorAll("[data-span]").forEach(btn => {
      btn.addEventListener("click", () => {
        const span = Number(btn.dataset.span);
        state.selectedSpan = span;
        const activeSeg = getActiveLineSegment();
        if (activeSeg) activeSeg.selectedSpan = span;
        syncSpanControl();
        updateModeHint();
      });
    });
    syncSpanControl();
  }

  function syncSpanControl() {
    if (!els.spanControl) return;
    const current = Number(state.selectedSpan || DEFAULT_SPAN);
    els.spanControl.querySelectorAll("[data-span]").forEach(btn => {
      btn.classList.toggle("is-selected", Number(btn.dataset.span) === current);
    });
  }

  function updateModeHint() {
    if (!els.modeHint) return;
    syncSpanControl();

    if (!state.sessionActive) {
      els.modeHint.textContent = "กดเริ่มสำรวจเพื่อเข้าโหมดแผนที่ (Span เริ่มต้น 40 ม. ปรับได้บนแถบเครื่องมือ)";
      return;
    }

    if (state.isRebuilding) {
      els.modeHint.textContent = "กำลังคำนวณเสาตามเส้นถนนบนแผนที่...";
      return;
    }

    if (state.phase === "spec") {
      els.modeHint.textContent = "กรอกรายละเอียดแต่ละหมุดด้านล่าง / ด้านข้าง";
      return;
    }

    const attachNote = state.attachFiles.length
      ? ` | แนบไฟล์ ${state.attachFiles.length} รายการ`
      : "";

    if (!state.segments.length) {
      els.modeHint.textContent = "ยังไม่มีส่วนงาน — กด + MV / + LV บนแถบเครื่องมือก่อน จึงจะปักหมุดได้";
      updateToolbarActiveState();
      return;
    }

    if (!state.placeMode) {
      els.modeHint.textContent = `Span ${state.selectedSpan} ม. — แตะแผนที่เพื่อปักหมุด ระบบจะถามประเภทหมุด${attachNote}`;
      updateToolbarActiveState();
      return;
    }

    const hints = {
      start: "แตะแผนที่ปักหมุด 0 (เสา/จุดต่อระบบจำหน่ายเดิม)",
      control: `แตะแผนที่ปักหมุดถัดไป — วางเสาตามถนน (Span ${state.selectedSpan} ม.)`,
      curve_in: `แตะแผนที่ปักหมุดเข้าโค้ง (Span โค้ง ${state.pendingCurveSpan || 15} ม.)`,
      curve_out: "แตะแผนที่ปักหมุดออกโค้ง",
      curve_waypoint: "แตะแผนที่ปักจุดบนโค้งตามถนน/เส้นทางจริง",
      tr_pick: "แตะแผนที่หรือเสาที่สำรวจแล้ว เพื่อติด TR"
    };

    els.modeHint.textContent = (hints[state.placeMode] || "") + attachNote;
    updateToolbarActiveState();
    updateAimOverlay();
  }

  function isAimModeActive() {
    return Boolean(
      state.sessionActive
      && state.phase === "surveying"
      && (state.placeMode || getActiveLineSegment())
    );
  }

  function getAimReferencePoint() {
    if (state.placeMode === "start") {
      const seg = getActiveLineSegment();
      if (seg?.startFromTrInstallId) {
        const tr = state.trInstalls.find(t => t.id === seg.startFromTrInstallId);
        if (tr) return { lat: tr.lat, lng: tr.lng, label: "TR" };
      }
      return null;
    }
    if (state.controlPoints.length) {
      const last = state.controlPoints[state.controlPoints.length - 1];
      return { lat: last.lat, lng: last.lng, label: "หมุดล่าสุด" };
    }
    return null;
  }

  function removeAimLine() {
    if (state.aimLine) {
      state.aimLine.remove();
      state.aimLine = null;
    }
    if (state.aimSvg) state.aimSvg.style.display = "none";
  }

  // เส้นวัดระยะวาดเป็น SVG ในพิกัดหน้าจอทับ #surveyMap โดยตรง (ไม่ใช่ Leaflet layer)
  // ปลายเส้นจึงตรงกลางกากบาทเสมอ ไม่มี lag ตอน pan/zoom
  function ensureAimSvg() {
    if (state.aimSvg && state.aimSvg.isConnected) return state.aimSvg;
    const shell = els.mapEl?.parentElement;
    if (!shell) return null;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "survey-aim-line-svg");
    svg.style.cssText = "position:absolute;pointer-events:none;z-index:590;display:none;";
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("stroke", "#ff6b6b");
    line.setAttribute("stroke-width", "2");
    line.setAttribute("stroke-dasharray", "6 8");
    line.setAttribute("stroke-opacity", "0.9");
    svg.appendChild(line);
    shell.appendChild(svg);
    state.aimSvg = svg;
    return svg;
  }

  function drawAimLineScreen(ref) {
    const svg = ensureAimSvg();
    if (!svg || !state.map || !els.mapEl) return;
    const pt = state.map.latLngToContainerPoint([ref.lat, ref.lng]);
    const w = els.mapEl.clientWidth;
    const h = els.mapEl.clientHeight;
    svg.style.left = els.mapEl.offsetLeft + "px";
    svg.style.top = els.mapEl.offsetTop + "px";
    svg.style.width = w + "px";
    svg.style.height = h + "px";
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const line = svg.firstChild;
    line.setAttribute("x1", pt.x);
    line.setAttribute("y1", pt.y);
    line.setAttribute("x2", w / 2);
    line.setAttribute("y2", h / 2);
    svg.style.display = "";
  }

  function hideAimOverlay() {
    removeAimLine();
    if (els.mapAim) {
      els.mapAim.classList.add("hidden");
      els.mapAim.setAttribute("aria-hidden", "true");
    }
    if (els.mapAimDist) els.mapAimDist.classList.add("hidden");
    if (els.placeAimBtn) els.placeAimBtn.classList.add("hidden");
  }

  function updateAimOverlay() {
    const active = isAimModeActive();
    if (!active || !state.map) {
      hideAimOverlay();
      return;
    }

    if (els.mapAim) {
      els.mapAim.classList.remove("hidden");
      els.mapAim.setAttribute("aria-hidden", "false");
    }
    if (els.placeAimBtn) els.placeAimBtn.classList.remove("hidden");

    const center = state.map.getCenter();
    const ref = getAimReferencePoint();

    removeAimLine();
    if (ref) {
      const dist = distanceMeters(ref, { lat: center.lat, lng: center.lng });
      if (els.mapAimDist) {
        els.mapAimDist.textContent = `${Math.round(dist)} ม. จาก${ref.label ? ` ${ref.label}` : ""}`;
        els.mapAimDist.classList.remove("hidden");
      }
      drawAimLineScreen(ref);
    } else if (els.mapAimDist) {
      els.mapAimDist.textContent = "เลื่อนแผนที่ให้กากบาทตรงจุดปัก";
      els.mapAimDist.classList.remove("hidden");
    }
  }

  async function placeAtMapCenter() {
    if (!state.map || state.phase !== "surveying" || !state.sessionActive) return;
    const center = state.map.getCenter();
    if (state.placeMode === "tr_pick") {
      await handleTrMapClick({ lat: center.lat, lng: center.lng });
      return;
    }
    await handleMapClick({ latlng: center });
  }

  function sanitizeFilename(name) {
    return String(name || "PEA_Survey")
      .replace(/[<>:"/\\|?*]+/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "PEA_Survey";
  }

  function downloadTextFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function exportSurveyKml() {
    syncActiveSegmentToStore();
    const project = { segments: state.segments, trInstalls: state.trInstalls };
    const hasData = project.segments.some(s => (s.poles?.length || s.controlPoints?.length))
      || project.trInstalls.length;
    if (!hasData) {
      Swal.fire("ไม่มีข้อมูล", "สำรวจหรือติด TR ก่อนส่งออก KML", "info");
      return;
    }
    if (!projectApi?.buildProjectKml) {
      Swal.fire("ระบบไม่พร้อม", "ไม่พบตัวสร้าง KML", "error");
      return;
    }

    const projectName = window.AppCore?.getProjectName?.() || "PEA_Survey";
    const kml = projectApi.buildProjectKml(project, {
      projectName,
      description: `Survey export — ${new Date().toLocaleString("th-TH")}`
    });
    const filename = `${sanitizeFilename(projectName)}_survey.kml`;
    downloadTextFile(kml, filename, "application/vnd.google-earth.kml+xml");
    Swal.fire("ส่งออก KML แล้ว", filename, "success", { timer: 2200, showConfirmButton: false });
  }

  function getActiveLineSegment() {
    return state.segments.find(s => s.id === state.activeSegmentId && s.kind === "line") || null;
  }

  function syncActiveSegmentToStore() {
    const seg = getActiveLineSegment();
    if (!seg || !projectApi) return;
    projectApi.saveWorkspaceToSegment(seg, {
      controlPoints: state.controlPoints,
      poles: state.poles,
      routedPaths: state.routedPaths,
      routedLegs: state.routedLegs,
      routeCache: state.routeCache,
      defaults: state.defaults,
      selectedSpan: state.selectedSpan
    });
  }

  function loadActiveSegmentWorkspace() {
    const seg = getActiveLineSegment();
    if (!seg || !projectApi) {
      state.controlPoints = [];
      state.poles = [];
      state.routedPaths = [];
      state.routedLegs = [];
      state.routeCache = {};
      return;
    }
    projectApi.loadSegmentToWorkspace(seg, state);
    state.presetConfig = presetsApi.getConfig(seg.type, seg.phase);
    state.voltageType = seg.type;
    state.phaseType = seg.phase;
    refreshDefaultMaterialSelects();
  }

  function setActiveSegment(segmentId) {
    syncActiveSegmentToStore();
    state.activeSegmentId = segmentId;
    loadActiveSegmentWorkspace();
    renderSegmentList();
    updateActiveSegmentLabel();
    updateUiState();
    if (state.sessionActive) renderAll();
  }

  function updateActiveSegmentLabel() {
    if (!els.activeSegmentLabel) return;
    const seg = getActiveLineSegment();
    const trCount = state.trInstalls.length;
    els.activeSegmentLabel.textContent = seg
      ? `ส่วน: ${seg.label}`
      : trCount
        ? `TR ${trCount} จุด — เลือกส่วน MV/LV`
        : "ยังไม่มีส่วนงาน";
  }

  function renderSegmentList() {
    if (!els.segmentList) return;
    if (!state.segments.length && !state.trInstalls.length) {
      els.segmentList.innerHTML = `<div class="survey-empty">ยังไม่มีส่วนงาน — กด + MV / + LV / + TR</div>`;
      return;
    }
    const lineHtml = state.segments.filter(s => s.kind === "line").map(seg => `
      <button type="button" class="survey-segment-chip ${seg.id === state.activeSegmentId ? "is-active" : ""}" data-segment-id="${seg.id}">
        <span class="survey-segment-dot" style="background:${seg.color}"></span>
        ${escapeHtml(seg.label)} · ${seg.poles?.length || 0} หมุด
      </button>
    `).join("");
    const trHtml = state.trInstalls.map(tr => `
      <div class="survey-segment-chip is-tr-static">
        <span class="survey-segment-dot is-tr"></span>
        TR ${escapeHtml(tr.label || tr.id.slice(-4))}
      </div>
    `).join("");
    els.segmentList.innerHTML = lineHtml + trHtml;
    els.segmentList.querySelectorAll("[data-segment-id]").forEach(btn => {
      btn.addEventListener("click", () => setActiveSegment(btn.dataset.segmentId));
    });
  }

  async function pickPhaseForType(type) {
    const value = await window.AppCore.pickFromChoiceButtons({
      title: `${type.toUpperCase()} — เลือกเฟส`,
      options: { "1p": "1P", "3p": "3P" },
      selectedValue: type === "lv" ? "3p" : "1p"
    });
    return value || null;
  }

  async function handleAddSegmentClick(type) {
    if (type === "tr") {
      if (!state.sessionActive) {
        Swal.fire("เริ่มสำรวจก่อน", "กดเริ่มสำรวจ แล้วใช้ปุ่ม ติด TR บนแผนที่", "info");
        return;
      }
      beginPlaceMode("tr_pick");
      return;
    }
    const phase = await pickPhaseForType(type);
    if (!phase) return;
    let span = state.selectedSpan;
    if (!span) {
      span = await pickSpanOnStart();
      if (!span) return;
      state.selectedSpan = span;
    }
    if (!projectApi) return;
    const seg = projectApi.createLineSegment(
      type,
      phase,
      span,
      `${type.toUpperCase()} ${phase.toUpperCase()} #${state.segments.filter(s => s.type === type).length + 1}`
    );
    state.segments.push(seg);
    setActiveSegment(seg.id);
    showDefaultsPanel();
    renderSegmentList();
    if (state.sessionActive) {
      Swal.fire({
        toast: true,
        position: "top",
        icon: "success",
        title: `เพิ่ม ${seg.label} แล้ว — ปักจุดเริ่มได้`,
        timer: 1800,
        showConfirmButton: false
      });
    }
  }

  async function addLvBranchFromTr() {
    if (!state.trInstalls.length) {
      Swal.fire("ยังไม่มี TR", "ติด TR ก่อน แล้วค่อยเพิ่ม LV จาก TR", "info");
      return;
    }
    const options = {};
    state.trInstalls.forEach((tr, i) => {
      options[tr.id] = `TR ${i + 1} (${tr.label || "จุดแวนหม้อ"})`;
    });
    const { value: trId } = await Swal.fire({
      title: "LV ออกจาก TR",
      text: "เลือกจุด TR ที่จะเริ่มสาย LV",
      input: "select",
      inputOptions: options,
      showCancelButton: true
    });
    if (!trId) return;
    const phase = await pickPhaseForType("lv");
    if (!phase) return;
    let span = state.selectedSpan;
    if (!span) {
      span = await pickSpanOnStart();
      if (!span) return;
      state.selectedSpan = span;
    }
    const tr = state.trInstalls.find(t => t.id === trId);
    const branchNum = (tr.lvBranchSegmentIds?.length || 0) + 1;
    const seg = projectApi.createLineSegment("lv", phase, span, `LV ${phase.toUpperCase()} ← TR #${branchNum}`);
    seg.startFromTrInstallId = trId;
    if (!tr.lvBranchSegmentIds) tr.lvBranchSegmentIds = [];
    tr.lvBranchSegmentIds.push(seg.id);
    state.segments.push(seg);
    setActiveSegment(seg.id);
    showDefaultsPanel();
    renderSegmentList();
  }

  async function openTrInstallDialog(point, hostPoleId, segmentId) {
    const hostInfo = hostPoleId && projectApi
      ? projectApi.findPoleById({ segments: state.segments, trInstalls: state.trInstalls }, hostPoleId)
      : null;

    const isExisting = await window.AppCore.pickFromChoiceButtons({
      title: "ประเภทเสา TR Host",
      options: {
        surveyed: "เสาที่สำรวจไว้",
        existing: "เสาเดิมหน้างาน (ไม่นับเสาใน BOM)"
      },
      selectedValue: hostInfo ? "surveyed" : "existing"
    });
    if (!isExisting) return;

    const installType = await window.AppCore.pickFromChoiceButtons({
      title: "รูปแบบติดตั้ง",
      options: {
        singlePole: "แวนบนเสา (Single Pole)",
        platform: "แท่นหม้อ (Platform)"
      },
      selectedValue: "singlePole"
    });
    if (!installType) return;

    const phase = installType === "singlePole"
      ? await window.AppCore.pickFromChoiceButtons({
        title: "เฟส TR",
        options: { "1p": "1P", "3p": "3P" },
        selectedValue: "3p"
      })
      : "3p";
    if (!phase) return;

    const catalog = presetsApi.getTrInstallCatalog();
    const group = catalog?.[installType]?.[phase];
    const setOptions = {};
    presetsApi.getSetOptions(group?.setIds || []).forEach(s => { setOptions[s.id] = presetsApi.formatSetLabel(s); });
    const { value: trSetId } = await Swal.fire({
      title: "ชุด SET ติดตั้ง TR",
      input: "select",
      inputOptions: setOptions,
      inputValue: group?.defaultSetId,
      showCancelButton: true,
      ...SURVEY_SWAL_COMPACT
    });
    if (!trSetId) return;

    const txOptions = {};
    presetsApi.getTransformers(phase)
      .filter(t => !group?.transformerIds?.length || group.transformerIds.includes(t.id))
      .forEach(t => { txOptions[t.id] = `${t.id} — ${t.name}`; });
    const { value: transformerId } = await Swal.fire({
      title: "หม้อแปลง",
      input: "select",
      inputOptions: txOptions,
      showCancelButton: true,
      ...SURVEY_SWAL_COMPACT
    });
    if (!transformerId) return;

    const tr = projectApi.createTrInstall({
      hostPoleId: hostPoleId || "",
      segmentId: segmentId || hostInfo?.segment?.id || "",
      lat: point.lat,
      lng: point.lng,
      isExistingPole: isExisting === "existing",
      installType,
      phase,
      trSetId,
      transformerId,
      label: hostInfo ? `TR @ ${hostInfo.pole.label}` : "TR เสาเดิม"
    });
    state.trInstalls.push(tr);
    state.placeMode = null;
    renderSegmentList();
    renderAll();
    updateModeHint();
    Swal.fire("บันทึก TR", tr.label, "success", { timer: 1800, showConfirmButton: false });
  }

  async function handleTrMapClick(point) {
    await openTrInstallDialog(point, "", "");
    state.placeMode = null;
    updateModeHint();
  }

  function findPoleInProject(poleId) {
    syncActiveSegmentToStore();
    for (const seg of state.segments) {
      const pole = seg.poles?.find(p => p.id === poleId);
      if (pole) return { pole, segment: seg };
    }
    return null;
  }

  function applySpecsToProject() {
    syncActiveSegmentToStore();
    let appliedCount = 0;
    const activeId = state.activeSegmentId;

    state.segments.filter(s => s.kind === "line").forEach(seg => {
      if (!seg.poles?.length) return;
      projectApi.loadSegmentToWorkspace(seg, state);
      state.presetConfig = presetsApi.getConfig(seg.type, seg.phase);
      appliedCount += applyDefaultSpecs();
      applySpecialPoleSpecs();
      projectApi.saveWorkspaceToSegment(seg, {
        controlPoints: state.controlPoints,
        poles: state.poles,
        routedPaths: state.routedPaths,
        routedLegs: state.routedLegs,
        routeCache: state.routeCache,
        defaults: state.defaults,
        selectedSpan: state.selectedSpan
      });
    });

    if (activeId) {
      const seg = state.segments.find(s => s.id === activeId);
      if (seg) projectApi.loadSegmentToWorkspace(seg, state);
    }
    return appliedCount;
  }

  function initSystemSelectors() {
    updateSystemUi();
  }

  function getPresetConfig() {
    return state.presetConfig || presetsApi.getConfig(state.voltageType, state.phaseType);
  }

  function isSystemReady() {
    return Boolean(state.voltageType && state.phaseType && getPresetConfig());
  }

  function selectVoltage(voltage) {
    state.voltageType = voltage;
    state.phaseType = null;
    state.presetConfig = null;
    collapseVoltageStep(voltage);
    unlockPhaseStep();
    hideDefaultsPanel();
    updateSystemUi();
    updateUiState();
  }

  function selectPhase(phase) {
    if (!state.voltageType) return;
    state.phaseType = phase;
    state.presetConfig = presetsApi.getConfig(state.voltageType, phase);
    collapsePhaseStep(phase);
    refreshDefaultMaterialSelects();
    showDefaultsPanel();
    updateSystemUi();
    updateUiState();
  }

  function editVoltageSelection() {
    state.voltageType = null;
    state.phaseType = null;
    state.presetConfig = null;
    if (els.voltageStep) {
      els.voltageStep.classList.remove("is-collapsed");
      els.voltageChoices?.querySelectorAll(".survey-choice-btn").forEach(btn => btn.classList.remove("active"));
    }
    if (els.voltageBadge) els.voltageBadge.classList.add("hidden");
    if (els.voltageEdit) els.voltageEdit.classList.add("hidden");
    if (els.phaseStep) {
      els.phaseStep.classList.add("hidden", "is-locked");
      els.phaseStep.classList.remove("is-collapsed");
    }
    if (els.phaseBadge) els.phaseBadge.classList.add("hidden");
    if (els.phaseEdit) els.phaseEdit.classList.add("hidden");
    hideDefaultsPanel();
    updateSystemUi();
    updateUiState();
  }

  function editPhaseSelection() {
    state.phaseType = null;
    state.presetConfig = null;
    if (els.phaseStep) {
      els.phaseStep.classList.remove("is-collapsed", "is-locked");
      els.phaseChoices?.querySelectorAll(".survey-choice-btn").forEach(btn => btn.classList.remove("active"));
    }
    if (els.phaseBadge) els.phaseBadge.classList.add("hidden");
    if (els.phaseEdit) els.phaseEdit.classList.add("hidden");
    hideDefaultsPanel();
    updateSystemUi();
    updateUiState();
  }

  function collapseVoltageStep(voltage) {
    if (!els.voltageStep) return;
    els.voltageStep.classList.add("is-collapsed");
    els.voltageChoices?.querySelectorAll(".survey-choice-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.voltage === voltage);
    });
    if (els.voltageBadge) {
      els.voltageBadge.textContent = voltage.toUpperCase();
      els.voltageBadge.classList.remove("hidden");
    }
    if (els.voltageEdit) els.voltageEdit.classList.remove("hidden");
  }

  function unlockPhaseStep() {
    if (!els.phaseStep) return;
    els.phaseStep.classList.remove("hidden", "is-locked", "is-collapsed");
    els.phaseChoices?.querySelectorAll(".survey-choice-btn").forEach(btn => btn.classList.remove("active"));
    if (els.phaseBadge) els.phaseBadge.classList.add("hidden");
    if (els.phaseEdit) els.phaseEdit.classList.add("hidden");
  }

  function collapsePhaseStep(phase) {
    if (!els.phaseStep) return;
    els.phaseStep.classList.add("is-collapsed");
    els.phaseStep.classList.remove("is-locked");
    els.phaseChoices?.querySelectorAll(".survey-choice-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.phase === phase);
    });
    if (els.phaseBadge) {
      els.phaseBadge.textContent = phase.toUpperCase();
      els.phaseBadge.classList.remove("hidden");
    }
    if (els.phaseEdit) els.phaseEdit.classList.remove("hidden");
  }

  function showDefaultsPanel() {
    if (els.defaultsPanel) els.defaultsPanel.classList.remove("hidden");
  }

  function hideDefaultsPanel() {
    if (els.defaultsPanel) els.defaultsPanel.classList.add("hidden");
  }

  function updateSystemUi() {
    const config = getPresetConfig();
    document.querySelectorAll(".survey-ohgw-field").forEach(el => {
      el.classList.toggle("is-hidden", !config || !config.hasOhgw);
    });
  }

  function refreshDefaultMaterialSelects() {
    const config = getPresetConfig();
    if (!config) return;

    const poleCatalog = surveyConfig.poleCatalog || [];

    ["straight", "curve"].forEach(group => {
      const section = config[group];
      if (!section) return;

      const defs = section.defaults || {};
      state.defaults[group] = {
        poleMaterialId: defs.poleMaterialId || "",
        headMaterialId: defs.headMaterialId || "",
        cableMaterialId: defs.cableMaterialId || "",
        ohgwSetId: defs.ohgwSetId || "",
        ohgwInstall: Boolean(defs.ohgwInstall)
      };

      fillSelect(
        document.getElementById(`surveyDefault${group === "straight" ? "Straight" : "Curve"}Pole`),
        poleCatalog,
        defs.poleMaterialId,
        "-- เลือกเสา --",
        "pole"
      );
      fillSelect(
        document.getElementById(`surveyDefault${group === "straight" ? "Straight" : "Curve"}Head`),
        presetsApi.getSetOptions(section.headSetIds),
        defs.headMaterialId,
        "-- เลือกหัวเสา (ชุด Set) --",
        "set"
      );
      fillSelect(
        document.getElementById(`surveyDefault${group === "straight" ? "Straight" : "Curve"}Cable`),
        presetsApi.getCableOptions(config, group),
        defs.cableMaterialId,
        "-- เลือกสายไฟ --",
        "cable"
      );

      const ohgwSelect = document.getElementById(`surveyDefault${group === "straight" ? "Straight" : "Curve"}Ohgw`);
      fillSelect(
        ohgwSelect,
        presetsApi.getSetOptions(section.ohgwSetIds),
        defs.ohgwSetId,
        "-- เลือก OHGW (ชุด Set) --",
        "set"
      );
      if (ohgwSelect) ohgwSelect.disabled = !state.defaults[group].ohgwInstall;

      const ohgwCheck = document.getElementById(`surveyDefault${group === "straight" ? "Straight" : "Curve"}OhgwInstall`);
      if (ohgwCheck) ohgwCheck.checked = state.defaults[group].ohgwInstall;
    });
  }

  function fillSelect(select, catalog, selectedId, placeholder, kind) {
    if (!select) return;
    const options = [{ id: "", name: placeholder }].concat(catalog || []);
    select.innerHTML = options.map(item => {
      const label = kind === "set"
        ? presetsApi.formatSetLabel(item.id ? item : null) || item.name
        : kind === "cable"
          ? (item.id ? presetsApi.formatCableLabel(item) : item.name)
          : (item.id ? `${item.id} — ${item.name}` : item.name);
      const value = item.id || "";
      return `<option value="${value}" ${selectedId === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
    select.value = selectedId || "";
  }

  function handleDefaultSelectChange(event) {
    const select = event.target;
    const group = select.dataset.defaultGroup;
    const field = select.dataset.defaultField;
    if (!group || !field || !state.defaults[group]) return;
    state.defaults[group][field] = select.value;
  }

  function handleDefaultCheckboxChange(event) {
    const input = event.target;
    const group = input.dataset.defaultGroup;
    const field = input.dataset.defaultField;
    if (!group || !field || !state.defaults[group]) return;
    state.defaults[group][field] = input.checked;
    const ohgwSelect = document.getElementById(`surveyDefault${group === "straight" ? "Straight" : "Curve"}Ohgw`);
    if (ohgwSelect) ohgwSelect.disabled = !input.checked;
  }

  function resetDefaultMaterialSelects() {
    state.defaults.straight = { poleMaterialId: "", headMaterialId: "", cableMaterialId: "", ohgwSetId: "", ohgwInstall: false };
    state.defaults.curve = { poleMaterialId: "", headMaterialId: "", cableMaterialId: "", ohgwSetId: "", ohgwInstall: false };

    if (els.defaultSelects) {
      els.defaultSelects.forEach(el => {
        if (el.tagName === "SELECT") el.value = "";
        if (el.type === "checkbox") el.checked = false;
      });
    }
  }

  function resetSystemSelection() {
    state.voltageType = null;
    state.phaseType = null;
    state.presetConfig = null;
    if (els.voltageStep) els.voltageStep.classList.remove("is-collapsed");
    if (els.phaseStep) {
      els.phaseStep.classList.add("hidden", "is-locked");
      els.phaseStep.classList.remove("is-collapsed");
    }
    els.voltageChoices?.querySelectorAll(".survey-choice-btn").forEach(btn => btn.classList.remove("active"));
    els.phaseChoices?.querySelectorAll(".survey-choice-btn").forEach(btn => btn.classList.remove("active"));
    if (els.voltageBadge) els.voltageBadge.classList.add("hidden");
    if (els.phaseBadge) els.phaseBadge.classList.add("hidden");
    if (els.voltageEdit) els.voltageEdit.classList.add("hidden");
    if (els.phaseEdit) els.phaseEdit.classList.add("hidden");
    hideDefaultsPanel();
    updateSystemUi();
    updateUiState();
  }

  function getSetLabel(setId) {
    const setObj = presetsApi.getSet(setId);
    return setObj ? presetsApi.formatSetLabel(setObj) : setId;
  }

  function getWireMultiplier() {
    const config = getPresetConfig();
    return config?.wireMultiplier || 1;
  }

  function getSectionCatalogs(sectionKey) {
    const config = getPresetConfig();
    if (!config || !config[sectionKey]) {
      return { headSets: [], cables: [], ohgwSets: [] };
    }
    const section = config[sectionKey];
    return {
      headSets: presetsApi.getSetOptions(section.headSetIds),
      cables: presetsApi.getCableOptions(config, sectionKey),
      ohgwSets: presetsApi.getSetOptions(section.ohgwSetIds)
    };
  }

  function guardSpan(action) {
    if (!ensureSpanSelected()) return;
    action();
  }

  function onTabOpen() {
    if (state.sessionActive) {
      setMapActiveMode(state.phase === "surveying");
      if (!state.mapReady) initMap();
      else scheduleMapResize();
    } else {
      setMapActiveMode(false);
    }
    renderAll();
  }

  function setMapActiveMode(active) {
    const immersive = Boolean(active && state.sessionActive && state.phase === "surveying");
    document.body.classList.toggle("survey-map-active", immersive);
    if (!immersive) {
      document.body.classList.remove("survey-show-nav");
    }
    if (els.tabMenuBtn) {
      els.tabMenuBtn.classList.toggle("hidden", !immersive);
    }
    if (els.mapStage) {
      els.mapStage.classList.toggle("is-active", Boolean(active && state.sessionActive));
    }
  }

  function toggleMobileToolbar() {
    if (!els.toolbar || !els.toolbarToggle) return;
    const open = els.toolbar.classList.toggle("is-open-mobile");
    els.toolbarToggle.setAttribute("aria-expanded", open ? "true" : "false");
    els.toolbarToggle.textContent = open ? "เครื่องมือ ▴" : "เครื่องมือ ▾";
  }

  function collapseMobileToolbar() {
    if (!els.toolbar || !els.toolbarToggle) return;
    els.toolbar.classList.remove("is-open-mobile");
    els.toolbarToggle.setAttribute("aria-expanded", "false");
    els.toolbarToggle.textContent = "เครื่องมือ ▾";
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function buildSurveyMetaObject() {
    syncActiveSegmentToStore();

    if (projectApi) {
      const meta = projectApi.buildSurveyMetaV2(
        { segments: state.segments, trInstalls: state.trInstalls },
        { distanceMeters, presetsApi }
      );
      if (!meta.poleCount && !meta.trCount) return null;

      const allPoles = state.segments
        .filter(s => s.kind === "line")
        .flatMap(s => s.poles || []);
      const first = allPoles[0];
      const last = allPoles[allPoles.length - 1];

      return {
        ...meta,
        startLabel: first?.label || "หมุด 0",
        endLabel: last?.label || "",
        spanM: state.selectedSpan,
        voltageType: state.voltageType,
        phaseType: state.phaseType,
        systemLabel: getPresetConfig()?.label || "",
        wireMultiplier: getWireMultiplier()
      };
    }

    if (!state.poles.length) return null;

    const start = state.poles[0];
    const end = state.poles[state.poles.length - 1];
    const totalDist = state.poles.reduce((sum, pole, index) => {
      if (index === 0) return sum;
      return sum + distanceMeters(state.poles[index - 1], pole);
    }, 0);

    return {
      startLat: start.lat,
      startLng: start.lng,
      endLat: end.lat,
      endLng: end.lng,
      startLabel: start.label || "หมุด 0",
      endLabel: end.label || `หมุด ${end.number ?? state.poles.length - 1}`,
      poleCount: state.poles.length,
      totalDistanceM: Math.round(totalDist),
      spanM: state.selectedSpan,
      voltageType: state.voltageType,
      phaseType: state.phaseType,
      systemLabel: getPresetConfig()?.label || "",
      wireMultiplier: getWireMultiplier(),
      capturedAt: new Date().toISOString()
    };
  }

  function getSurveyMeta() {
    return state.surveyMeta || buildSurveyMetaObject();
  }

  function drawSurveyStatsOverlay(ctx, width, height, stats) {
    if (!stats) return;
    const rows = [
      ["เสาทางตรง", stats.straightRun ?? 0],
      ["เข้าโค้ง–ออกโค้ง", stats.curveEntryExit ?? 0],
      ["เสาภายในโค้ง", stats.curveInterior ?? 0],
      ["เสาต้นสุดท้าย", stats.endPoles ?? 0],
      ["ยึดโยง (Guy)", stats.guySets ?? 0]
    ];
    const boxW = Math.min(220, Math.max(188, width * 0.34));
    const headerH = 26;
    const rowH = 18;
    const pad = 10;
    const boxH = headerH + rows.length * rowH + pad;
    const x = width - boxW - 12;
    const y = 12;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = "rgba(255, 255, 255, 0.97)";
    ctx.strokeStyle = "#74045f";
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeRect(x, y, boxW, boxH);
    ctx.shadowColor = "transparent";

    ctx.font = "bold 12px Sarabun, Tahoma, sans-serif";
    ctx.fillStyle = "#74045f";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("สรุปเสา — แผนที่สำรวจ", x + pad, y + 8);

    ctx.font = "11px Sarabun, Tahoma, sans-serif";
    let rowY = y + headerH;
    rows.forEach(([label, value]) => {
      ctx.fillStyle = "#5a4f56";
      ctx.textAlign = "left";
      ctx.fillText(label, x + pad, rowY);
      ctx.fillStyle = "#1a1216";
      ctx.font = "bold 11px Sarabun, Tahoma, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(String(value), x + boxW - pad, rowY);
      ctx.font = "11px Sarabun, Tahoma, sans-serif";
      rowY += rowH;
    });
    ctx.restore();
  }

  function renderSurveyMapStatsOverlay(stats) {
    if (!els.mapStatsOverlay) return;
    if (!stats) {
      els.mapStatsOverlay.classList.add("hidden");
      els.mapStatsOverlay.innerHTML = "";
      return;
    }
    const rows = [
      ["เสาทางตรง", stats.straightRun ?? 0],
      ["เข้าโค้ง–ออกโค้ง", stats.curveEntryExit ?? 0],
      ["เสาภายในโค้ง", stats.curveInterior ?? 0],
      ["เสาต้นสุดท้าย", stats.endPoles ?? 0],
      ["ยึดโยง (Guy)", stats.guySets ?? 0]
    ];
    els.mapStatsOverlay.innerHTML = `
      <div class="survey-map-stats-title">สรุปเสา — แผนที่สำรวจ</div>
      <table class="survey-map-stats-table">
        ${rows.map(([label, value]) => `
          <tr><td>${label}</td><td>${value}</td></tr>
        `).join("")}
      </table>
    `;
  }

  function updateSurveyMapStatsOverlay() {
    const show = state.phase === "spec" && state.sessionActive;
    const stats = getSurveyPoleStatsForCapture();
    if (!show || !stats) {
      if (els.mapStatsOverlay) els.mapStatsOverlay.classList.add("hidden");
      return;
    }
    renderSurveyMapStatsOverlay(stats);
    els.mapStatsOverlay.classList.remove("hidden");
  }

  function getSurveyPoleStatsForCapture() {
    const project = { segments: state.segments, trInstalls: state.trInstalls };
    return projectApi?.computeSurveyPoleStats?.(project) || null;
  }

  // วาดเส้นทาง+หมุด+TR ลง canvas ด้วยพิกัดจาก latLngToContainerPoint โดยตรง
  // ใช้ทั้งใน fallback (scale 1) และทับภาพ html2canvas (scale ตามความละเอียดจริง)
  // เพราะ html2canvas เรนเดอร์ SVG overlay ของ Leaflet เพี้ยนตำแหน่ง
  function drawRouteOverlayOnCanvas(ctx, map, scale, offsetX, offsetY) {
    if (!map) return;
    const px = pt => ({ x: pt.x * scale + offsetX, y: pt.y * scale + offsetY });
    const project = { segments: state.segments, trInstalls: state.trInstalls };
    const lineSegs = project.segments.filter(s => s.kind === "line");

    lineSegs.forEach(seg => {
      const color = seg.color || projectApi?.SEGMENT_COLORS?.[seg.type] || "#71e8ff";
      const poles = seg.poles || [];

      if (poles.length > 1) {
        const pts = poles.map(p => px(map.latLngToContainerPoint([p.lat, p.lng])));
        ctx.strokeStyle = color;
        ctx.lineWidth = 3 * scale;
        ctx.setLineDash([8 * scale, 6 * scale]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      poles.forEach((pole, index) => {
        const pt = px(map.latLngToContainerPoint([pole.lat, pole.lng]));
        const isStart = pole.source === "start" || pole.number === 0;
        ctx.fillStyle = isStart ? "#f5c96a" : color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, (isStart ? 11 : 8) * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();
        ctx.fillStyle = "#03111f";
        ctx.font = `bold ${9 * scale}px Sarabun,sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(pole.number ?? index), pt.x, pt.y);
      });
    });

    (project.trInstalls || []).forEach(tr => {
      const pt = px(map.latLngToContainerPoint([tr.lat, tr.lng]));
      const r = 10 * scale;
      ctx.fillStyle = "#ff6b35";
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y - r);
      ctx.lineTo(pt.x + r, pt.y);
      ctx.lineTo(pt.x, pt.y + r);
      ctx.lineTo(pt.x - r, pt.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5 * scale;
      ctx.stroke();
      ctx.fillStyle = "#1a0a00";
      ctx.font = `bold ${8 * scale}px Sarabun,sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("TR", pt.x, pt.y);
    });
  }

  async function drawRouteCanvasFallback() {
    syncActiveSegmentToStore();
    const map = state.map;
    const width = els.mapEl?.clientWidth || 900;
    const height = els.mapEl?.clientHeight || 600;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0a1524";
    ctx.fillRect(0, 0, width, height);

    drawRouteOverlayOnCanvas(ctx, map, 1, 0, 0);

    const legendX = 10;
    let legendY = 14;
    ctx.font = "bold 10px Sarabun,sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText("Survey Map Legend", legendX, legendY);
    legendY += 14;

    const legendItems = [
      ...lineSegs.map(seg => ({
        color: seg.color || projectApi?.SEGMENT_COLORS?.[seg.type] || "#71e8ff",
        label: `${seg.label} (${seg.type?.toUpperCase()})`
      })),
      ...(project.trInstalls?.length ? [{ color: "#ff6b35", label: `TR × ${project.trInstalls.length}` }] : [])
    ];

    ctx.font = "9px Sarabun,sans-serif";
    legendItems.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX, legendY - 7, 14, 3);
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.fillText(item.label.slice(0, 36), legendX + 18, legendY - 4);
      legendY += 12;
    });

    const meta = buildSurveyMetaObject();
    if (meta) {
      ctx.fillStyle = "rgba(4, 11, 21, 0.82)";
      ctx.fillRect(8, height - 52, width - 16, 44);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "10px Sarabun,sans-serif";
      ctx.textAlign = "left";
      const summary = meta.version === 2
        ? `${meta.segmentCount || 0} ส่วน · ${meta.poleCount || 0} หมุด · TR ${meta.trCount || 0} · ${meta.totalDistanceM || 0} ม.`
        : `${meta.poleCount || 0} หมุด · ${meta.totalDistanceM || 0} ม.`;
      ctx.fillText(summary, 14, height - 34);
      if (meta.startLat != null) {
        ctx.fillText(
          `Start: ${Number(meta.startLat).toFixed(5)}, ${Number(meta.startLng).toFixed(5)}`,
          14,
          height - 18
        );
      }
    }

    drawSurveyStatsOverlay(ctx, width, height, meta?.poleStats || getSurveyPoleStatsForCapture());

    return canvas.toDataURL("image/png").split(",")[1];
  }

  async function captureSurveyMapImage() {
    syncActiveSegmentToStore();
    const latlngs = [];
    state.segments.filter(s => s.kind === "line").forEach(seg => {
      (seg.poles || []).forEach(pole => latlngs.push([pole.lat, pole.lng]));
    });
    state.trInstalls.forEach(tr => latlngs.push([tr.lat, tr.lng]));

    if (!state.map || !latlngs.length) return null;

    const bounds = L.latLngBounds(latlngs);
    scheduleMapResize();
    // เว้นขอบขวาบนมากขึ้น กันเส้น/หมุดไปซ้อนกล่อง "สรุปเสา" ที่มุมขวาบนของภาพ
    state.map.fitBounds(bounds, {
      paddingTopLeft: L.point(60, 150),
      paddingBottomRight: L.point(240, 60)
    });
    await delay(900);
    scheduleMapResize();

    // ซ่อนเส้น/หมุดของ Leaflet ระหว่าง capture — html2canvas วาด SVG overlay เพี้ยนตำแหน่ง
    // แล้วค่อยวาดเส้น+หมุดทับเองด้วยพิกัดที่ถูกต้องหลังได้ภาพพื้นแผนที่
    const leafletPanes = ["overlay-pane", "marker-pane", "shadow-pane"]
      .map(name => els.mapEl?.querySelector(`.leaflet-${name}`))
      .filter(Boolean);
    const hideEls = [els.toolbar, els.modeHint, els.toolbarToggle, els.mapAim, els.mapAimDist, els.placeAimBtn, ...leafletPanes].filter(Boolean);
    const prevDisplay = hideEls.map(el => el.style.display);
    hideEls.forEach(el => { el.style.display = "none"; });

    const stats = getSurveyPoleStatsForCapture();
    const hadStatsHidden = els.mapStatsOverlay?.classList.contains("hidden");
    if (stats && els.mapStatsOverlay) {
      renderSurveyMapStatsOverlay(stats);
      els.mapStatsOverlay.classList.remove("hidden");
    }

    const captureTarget = els.mapShell || els.mapEl;
    let base64 = null;
    if (window.html2canvas && captureTarget) {
      try {
        const canvas = await html2canvas(captureTarget, {
          useCORS: true,
          allowTaint: true,
          logging: false,
          scale: window.innerWidth < 720 ? 1.5 : 2
        });
        const ctx = canvas.getContext("2d");
        const scale = canvas.width / (captureTarget.clientWidth || canvas.width);
        const shellRect = captureTarget.getBoundingClientRect();
        const mapRect = els.mapEl.getBoundingClientRect();
        drawRouteOverlayOnCanvas(
          ctx,
          state.map,
          scale,
          (mapRect.left - shellRect.left) * scale,
          (mapRect.top - shellRect.top) * scale
        );
        if (stats) {
          drawSurveyStatsOverlay(ctx, canvas.width, canvas.height, stats);
        }
        base64 = canvas.toDataURL("image/png").split(",")[1];
      } catch (error) {
        console.warn("html2canvas failed", error);
      }
    }

    hideEls.forEach((el, index) => {
      el.style.display = prevDisplay[index] || "";
    });
    if (hadStatsHidden && els.mapStatsOverlay) {
      els.mapStatsOverlay.classList.add("hidden");
    } else {
      updateSurveyMapStatsOverlay();
    }

    if (!base64) {
      base64 = await drawRouteCanvasFallback();
    }

    return base64;
  }

  async function captureAndStoreSurveyArtifacts() {
    const meta = buildSurveyMetaObject();
    if (!meta) return;
    state.surveyMeta = meta;

    if (!window.AppCore || !window.AppCore.addProjectFileFromBase64) return;

    const mapBase64 = await captureSurveyMapImage();
    if (mapBase64) {
      window.AppCore.addProjectFileFromBase64(
        mapBase64,
        "image/png",
        `Survey_Map_${Date.now()}.png`
      );
    }
  }

  function getMapTileUrl(theme) {
    return theme === "light"
      ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  }

  const SATELLITE_TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

  function applyMapTheme() {
    if (!state.map || !window.L) return;
    if (state.tileLayer) {
      state.map.removeLayer(state.tileLayer);
    }
    if (state.baseMode === "satellite") {
      state.tileLayer = L.tileLayer(SATELLITE_TILE_URL, {
        attribution: "&copy; Esri World Imagery",
        maxZoom: 19
      }).addTo(state.map);
    } else {
      state.tileLayer = L.tileLayer(getMapTileUrl("light"), {
        attribution: "&copy; OpenStreetMap"
      }).addTo(state.map);
    }
  }

  function toggleMapFullscreen() {
    const shell = document.querySelector(".survey-map-shell");
    if (!shell) return;
    const active = shell.classList.toggle("is-fullscreen");
    document.body.classList.toggle("survey-fullscreen-active", active);
    const btn = document.getElementById("surveyMapFsBtn");
    if (btn) {
      btn.textContent = active ? "✕" : "⛶";
      btn.title = active ? "ออกจากเต็มจอ (Esc)" : "ขยายแผนที่เต็มจอ";
    }
    scheduleMapResize();
  }

  function toggleBaseLayer() {
    state.baseMode = state.baseMode === "satellite" ? "street" : "satellite";
    const btn = document.getElementById("surveyMapSatBtn");
    if (btn) btn.classList.toggle("is-active", state.baseMode === "satellite");
    applyMapTheme();
  }

  function addMapUtilityControls() {
    const utilControl = L.control({ position: "topleft" });
    utilControl.onAdd = () => {
      const div = L.DomUtil.create("div", "leaflet-bar survey-map-ctrl");
      div.innerHTML = ""
        + '<a href="#" id="surveyMapFsBtn" title="ขยายแผนที่เต็มจอ" role="button" aria-label="ขยายแผนที่เต็มจอ">⛶</a>'
        + '<a href="#" id="surveyMapSatBtn" title="สลับแผนที่ถนน/ดาวเทียม" role="button" aria-label="สลับภาพดาวเทียม">🛰</a>';
      L.DomEvent.disableClickPropagation(div);
      div.querySelector("#surveyMapFsBtn").addEventListener("click", event => {
        event.preventDefault();
        toggleMapFullscreen();
      });
      div.querySelector("#surveyMapSatBtn").addEventListener("click", event => {
        event.preventDefault();
        toggleBaseLayer();
      });
      return div;
    };
    utilControl.addTo(state.map);
    L.control.scale({ imperial: false, position: "bottomright" }).addTo(state.map);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && document.querySelector(".survey-map-shell.is-fullscreen")) {
        toggleMapFullscreen();
      }
    });
  }

  function initMap() {
    if (!window.L || !els.mapEl) return;
    const center = surveyConfig.defaultCenter || [17.4081, 104.7762];
    state.map = L.map(els.mapEl, { zoomControl: false }).setView(center, surveyConfig.defaultZoom || 15);
    L.control.zoom({ position: "bottomleft" }).addTo(state.map);
    applyMapTheme();
    addMapUtilityControls();
    state.map.on("click", handleMapClick);
    state.map.on("move", updateAimOverlay);
    state.map.on("moveend", updateAimOverlay);
    state.map.on("zoom", updateAimOverlay);
    state.map.on("zoomend", updateAimOverlay);
    state.mapReady = true;
  }

  function ensureProjectReady() {
    if (!window.AppCore || !window.AppCore.getProjectName()) {
      return promptProjectNameIfNeeded();
    }
    return Promise.resolve(true);
  }

  function ensureSpanSelected() {
    if (!state.selectedSpan) {
      Swal.fire({
        title: "เลือก Span ก่อน",
        text: "กรุณากดเริ่มสำรวจและเลือก Span ก่อนปักหมุด",
        icon: "warning",
        confirmButtonText: "เข้าใจแล้ว"
      });
      return false;
    }
    return true;
  }

  async function pickStartHeadType() {
    const config = getPresetConfig();
    const setIds = config?.startHeadSetIds || [];
    const options = {};
    presetsApi.getSetOptions(setIds).forEach(setObj => {
      options[setObj.id] = presetsApi.formatSetLabel(setObj);
    });

    if (!Object.keys(options).length) {
      Swal.fire("ไม่พบชุดหัวเสา", "กรุณาเลือกระบบ MV/LV ก่อนปักหมุด 0", "warning");
      return null;
    }

    const defaultId = state.voltageType === "mv" ? "20111" : "10024";
    const { value } = await Swal.fire({
      title: "หมุด 0 — จุดต่อระบบจำหน่ายเดิม",
      text: "เลือกชุดหัวเสา (ไม่ต้องเลือกขนาดเสา)",
      input: "select",
      inputOptions: options,
      inputValue: options[defaultId] ? defaultId : Object.keys(options)[0],
      showCancelButton: true,
      confirmButtonText: "ยืนยัน",
      cancelButtonText: "ยกเลิก"
    });

    return value || null;
  }

  async function pickCurveSpan() {
    const presets = surveyConfig.curveSpanPresets || [15, 20];
    return pickSpanSegmented({
      title: "เข้าโค้ง — เลือก Span",
      text: "ช่วงโค้งใช้ Span 15 หรือ 20 เมตรเท่านั้น",
      presets,
      defaultValue: presets[0]
    });
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
    const ready = await ensureProjectReady();
    if (!ready) return;
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
    beginPlaceMode("curve_in");
  }

  async function beginPlaceMode(mode) {
    const ready = await ensureProjectReady();
    if (!ready) return;

    if (mode === "tr_pick") {
      if (!state.sessionActive) {
        Swal.fire("เริ่มสำรวจก่อน", "กดเริ่มสำรวจก่อนติด TR", "info");
        return;
      }
      state.placeMode = "tr_pick";
      updateModeHint();
      return;
    }

    if (!getActiveLineSegment()) {
      Swal.fire("เพิ่มส่วนงาน", "กด + MV หรือ + LV เพื่อสร้างส่วนสำรวจก่อนปักหมุด", "info");
      return;
    }

    if (!getPresetConfig()) {
      Swal.fire("Preset ไม่พร้อม", "ส่วนงานที่เลือกยังไม่มีค่า preset", "warning");
      return;
    }

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
    }

    if (mode === "start" && state.controlPoints.length) {
      Swal.fire("มีหมุด 0 แล้ว", "กดเริ่มใหม่หากต้องการปักใหม่", "info");
      return;
    }

    state.placeMode = mode;
    updateModeHint();
  }

  function getAvailableRoles() {
    const roles = [];
    const hasStart = state.controlPoints.length > 0;
    const inCurve = Boolean(getCurveInPoint()) && !getCurveOutPoint();

    if (!hasStart) {
      roles.push("start");
      return roles;
    }
    if (!inCurve) {
      roles.push("control");
      roles.push("curve_in");
    } else {
      roles.push("curve_waypoint");
      roles.push("curve_out");
    }
    return roles;
  }

  const PIN_ICON_SVG = name => `<svg class="icon icon-md" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
  const PIN_ROLE_META = {
    start: { label: "ปักจุดเริ่ม (หมุด 0)", hint: "จุดต่อระบบจำหน่ายเดิม", icon: PIN_ICON_SVG("map-pin") },
    control: { label: "ปักทางตรง", hint: "วางเสาตามถนนด้วย Span ที่เลือก", icon: PIN_ICON_SVG("map-pin") },
    curve_in: { label: "ต้นเข้าโค้ง", hint: "เริ่มช่วงโค้ง (Span 15/20 ม.)", icon: PIN_ICON_SVG("redo") },
    curve_waypoint: { label: "จุดบนโค้ง", hint: "จุดกลางโค้งตามแนวถนนจริง", icon: PIN_ICON_SVG("map-pin") },
    curve_out: { label: "ต้นออกโค้ง", hint: "จบช่วงโค้ง กลับสู่ทางตรง", icon: PIN_ICON_SVG("undo") }
  };

  async function promptPinRole(roles) {
    if (!roles.length) return null;
    let picked = null;
    await Swal.fire({
      title: "หมุดนี้คืออะไร?",
      html: `
        <div class="pin-role-sheet">
          ${roles.map(role => {
            const meta = PIN_ROLE_META[role];
            return `
              <button type="button" class="pin-role-btn is-${role}" data-role="${role}">
                <span class="pin-role-icon">${meta.icon}</span>
                <span class="pin-role-text">
                  <strong>${meta.label}</strong>
                  <small>${meta.hint}</small>
                </span>
              </button>
            `;
          }).join("")}
        </div>
      `,
      position: "bottom",
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: "ยกเลิก",
      customClass: { popup: "pea-swal-sheet" },
      showClass: { popup: "pea-sheet-show" },
      hideClass: { popup: "pea-sheet-hide" },
      didOpen: popup => {
        popup.querySelectorAll("[data-role]").forEach(btn => {
          btn.addEventListener("click", () => {
            picked = btn.dataset.role;
            Swal.close();
          });
        });
      }
    });
    return picked;
  }

  async function placeControlPoint(role, point) {
    if (role === "start") {
      const activeSeg = getActiveLineSegment();
      if (activeSeg?.startFromTrInstallId) {
        const tr = state.trInstalls.find(t => t.id === activeSeg.startFromTrInstallId);
        if (tr) {
          point.lat = tr.lat;
          point.lng = tr.lng;
        }
      }
      const headSetId = await pickStartHeadType();
      if (!headSetId) return;
      state.controlPoints = [{
        id: makeId("ctrl"),
        lat: point.lat,
        lng: point.lng,
        role: "start",
        headSetId
      }];
    } else {
      const ctrl = {
        id: makeId("ctrl"),
        lat: point.lat,
        lng: point.lng,
        role,
        spanM: state.selectedSpan || DEFAULT_SPAN
      };

      if (role === "curve_in") {
        const curveSpan = state.pendingCurveSpan || await pickCurveSpan();
        if (!curveSpan) return;
        ctrl.curveSpan = curveSpan;
        state.pendingCurveSpan = null;
      }

      state.controlPoints.push(ctrl);
    }

    state.placeMode = null;
    await rebuildPolesFromControls();
    pushHistory();
    updateModeHint();
  }

  async function handleMapClick(event) {
    if (state.phase !== "surveying" || !state.sessionActive) return;

    const point = { lat: event.latlng.lat, lng: event.latlng.lng };

    if (state.placeMode === "tr_pick") {
      await handleTrMapClick(point);
      return;
    }

    if (!getActiveLineSegment()) {
      Swal.fire("เพิ่มส่วนงาน", "กด + MV หรือ + LV ก่อนปักหมุด", "info");
      state.placeMode = null;
      updateModeHint();
      return;
    }

    if (!getPresetConfig()) {
      Swal.fire("Preset ไม่พร้อม", "ส่วนงานที่เลือกยังไม่มีค่า preset", "warning");
      return;
    }

    // Tap-first: ถ้ากดปุ่มเครื่องมือค้างไว้ (legacy placeMode) ใช้ role นั้นเลย ไม่ถามซ้ำ
    const role = state.placeMode && state.placeMode !== "tr_pick"
      ? state.placeMode
      : await promptPinRole(getAvailableRoles());
    if (!role) return;

    await placeControlPoint(role, point);
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
      pushHistory();
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
      poles.push(makePole(start, "start", start.headSetId || start.headType || "", start.id));

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
    updateModeHint();
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
    const positions = interpolateAlongPath(pathPoints, toCtrl.spanM || state.selectedSpan);
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

    const headSetId = endCtrl.role === "start" ? (endCtrl.headSetId || endCtrl.headType || "") : "";
    poles.push(makePole(endCtrl, endRole, headSetId, endCtrl.id, endSection));
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

  function getSpecialPoleKind(pole) {
    if (pole.source === "end") return "end";
    if (pole.source === "curve_in" || pole.source === "curve_out") return "curve";
    return null;
  }

  function getSpecialPoleRule(kind) {
    const key = presetsApi.getConfigKey(state.voltageType, state.phaseType);
    return kind ? presetsApi.getSpecialPoleRule(key, kind) : null;
  }

  function getSpecialPoleRulesRoot() {
    const key = presetsApi.getConfigKey(state.voltageType, state.phaseType);
    return presetsApi.getSpecialPoleRules(key);
  }

  function markPoleSpecFilled(pole) {
    if (pole.source === "start") {
      pole.specFilled = Boolean(pole.headMaterialId && pole.cableMaterialId);
      return;
    }
    const specialKind = getSpecialPoleKind(pole);
    const baseFilled = Boolean(pole.poleMaterialId && pole.headMaterialId && pole.cableMaterialId);
    if (specialKind) {
      pole.specFilled = baseFilled && Boolean(pole.guySetId);
      return;
    }
    pole.specFilled = baseFilled;
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
      if (pole.source !== "start" && defs.headMaterialId && !pole.headMaterialId) {
        pole.headMaterialId = defs.headMaterialId;
        changed = true;
      }
      if (defs.cableMaterialId && !pole.cableMaterialId) {
        pole.cableMaterialId = defs.cableMaterialId;
        changed = true;
      }
      if (getPresetConfig()?.hasOhgw && defs.ohgwInstall && defs.ohgwSetId && !pole.ohgwSetId) {
        pole.ohgwSetId = defs.ohgwSetId;
        changed = true;
      }

      if (changed) appliedCount += 1;
      markPoleSpecFilled(pole);
    });

    return appliedCount;
  }

  function applySpecialPoleSpecs() {
    let appliedCount = 0;

    state.poles.forEach(pole => {
      const kind = getSpecialPoleKind(pole);
      const rule = getSpecialPoleRule(kind);
      if (!rule) return;

      let changed = false;

      if (rule.headDefault) {
        pole.headMaterialId = rule.headDefault;
        changed = true;
      }
      if (rule.ohgwDefault && getPresetConfig()?.hasOhgw) {
        pole.ohgwSetId = rule.ohgwDefault;
        changed = true;
      }
      if (rule.guyDefault && !pole.guySetId) {
        pole.guySetId = rule.guyDefault;
        changed = true;
      }
      if (rule.concrete) {
        pole.concreteMaterialId = rule.concrete.materialId;
        pole.concreteQty = rule.concrete.qty;
        changed = true;
      }
      if (kind === "end") {
        if (rule.groundingSetId) {
          pole.groundingSetId = rule.groundingSetId;
          changed = true;
        }
        if (rule.surgeSetId) {
          pole.surgeSetId = rule.surgeSetId;
          changed = true;
        }
        if (rule.surgeArresterId) {
          pole.surgeArresterId = rule.surgeArresterId;
          pole.surgeArresterQty = rule.surgeArresterQty || 0;
          changed = true;
        }
      }

      pole.specialKind = kind;
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

    // วางเสาทุกระยะ span เต็ม — ข้ามเฉพาะกรณีตกใกล้จุดปลายมาก (<1 ม.) กันเสาซ้อนกัน
    // (เดิมเว้น 30% ของ span ทำให้ปัก 48 ม. ที่ span 40 ไม่มีเสาที่ 40 ม.)
    while (nextAt < total - 1) {
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

  function makePole(point, source, headSetId = "", ctrlId = null, section = "straight") {
    const isStart = source === "start";
    return {
      id: makeId("pole"),
      ctrlId,
      lat: point.lat,
      lng: point.lng,
      source,
      section,
      headSetId: isStart ? headSetId : "",
      headMaterialId: isStart ? headSetId : "",
      poleMaterialId: "",
      cableMaterialId: "",
      ohgwSetId: "",
      guySetId: "",
      concreteMaterialId: "",
      concreteQty: 0,
      groundingSetId: "",
      surgeSetId: "",
      surgeArresterId: "",
      surgeArresterQty: 0,
      specialKind: "",
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
    const ready = await ensureProjectReady();
    if (!ready) return;
    if (!navigator.geolocation) {
      Swal.fire("ไม่รองรับ GPS", "อุปกรณ์นี้ไม่สามารถดึงตำแหน่งได้", "error");
      return;
    }

    const headSetId = await pickStartHeadType();
    if (!headSetId) return;

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
          headSetId
        }];
        state.placeMode = null;
        rebuildPolesFromControls().then(() => {
          pushHistory();
          updateModeHint();
        });
      },
      error => Swal.fire("GPS ไม่สำเร็จ", error.message || "ไม่สามารถดึงตำแหน่งได้", "error"),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  function projectCanComplete() {
    syncActiveSegmentToStore();
    const lineSegs = state.segments.filter(s => s.kind === "line");
    if (lineSegs.some(s => s.controlPoints.length >= 2)) return true;
    return state.trInstalls.length > 0;
  }

  function validateProjectBeforeComplete() {
    syncActiveSegmentToStore();
    const lineSegs = state.segments.filter(s => s.kind === "line");

    if (!lineSegs.some(s => s.controlPoints.length >= 2) && !state.trInstalls.length) {
      return "ยังไม่มีงาน — สำรวจอย่างน้อย 1 ส่วน MV/LV หรือติด TR";
    }

    for (const seg of lineSegs) {
      if (seg.controlPoints.length === 1) {
        return `${seg.label} มีแค่หมุดเริ่ม — เพิ่มหมุดถัดไปหรือลบส่วนนี้`;
      }
      const hasIn = seg.controlPoints.some(c => c.role === "curve_in");
      const hasOut = seg.controlPoints.some(c => c.role === "curve_out");
      if (hasIn && !hasOut) {
        return `${seg.label} ยังไม่มีจุดออกโค้ง`;
      }
    }
    return null;
  }

  async function completeSurvey() {
    if (!ensureSpanSelected()) return;

    const validationError = validateProjectBeforeComplete();
    if (validationError) {
      Swal.fire("ยังสำรวจไม่ครบ", validationError, "info");
      return;
    }

    Swal.fire({
      title: "กำลังบันทึกภาพแผนที่...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      await captureAndStoreSurveyArtifacts();
    } catch (error) {
      console.warn("survey map capture failed", error);
    }

    Swal.close();

    state.phase = "spec";
    state.placeMode = null;
    state.surveyEstimateImported = false;
    state.surveyProjectSaved = false;
    const appliedCount = applySpecsToProject();

    setMapActiveMode(false);
    collapseMobileToolbar();

    if (els.mapStage) els.mapStage.classList.add("is-spec");
    if (els.sidePanel) els.sidePanel.classList.remove("hidden");
    if (els.layout) els.layout.classList.add("is-spec-mode");
    if (els.specActions) els.specActions.classList.remove("hidden");

    scheduleMapResize();

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
    syncActiveSegmentToStore();
    updateMapLayers();
    renderPoleList();
    updateSummary();
    updateDistanceLegs();
    updateUiState();
    updateAimOverlay();
    updateSurveyMapStatsOverlay();
  }

  function updateUiState() {
    const surveying = state.phase === "surveying";
    const sessionActive = state.sessionActive;
    const hasActiveSeg = Boolean(getActiveLineSegment());
    const hasStart = state.controlPoints.length > 0;
    const hasCurveIn = Boolean(getCurveInPoint());
    const hasCurveOut = Boolean(getCurveOutPoint());
    const inCurve = isInsideCurveZone();
    const canComplete = sessionActive && surveying && projectCanComplete();

    if (els.startBtn) els.startBtn.disabled = !sessionActive || !surveying || !hasActiveSeg || hasStart;
    if (els.gpsBtn) els.gpsBtn.disabled = !sessionActive || !surveying || !hasActiveSeg || hasStart;
    if (els.addPointBtn) els.addPointBtn.disabled = !sessionActive || !surveying || !hasActiveSeg || !hasStart || inCurve;
    if (els.curveInBtn) els.curveInBtn.disabled = !sessionActive || !surveying || !hasActiveSeg || !hasStart || hasCurveIn;
    if (els.curveWaypointBtn) els.curveWaypointBtn.disabled = !sessionActive || !surveying || !hasActiveSeg || !inCurve;
    if (els.curveOutBtn) els.curveOutBtn.disabled = !sessionActive || !surveying || !hasActiveSeg || !hasCurveIn || hasCurveOut;
    if (els.completeBtn) els.completeBtn.disabled = !canComplete;
    if (els.backBtn) els.backBtn.disabled = !sessionActive || state.historyIndex <= 0;
    if (els.forwardBtn) els.forwardBtn.disabled = !sessionActive || state.historyIndex >= state.history.length - 1;

    if (els.beginBtn) {
      els.beginBtn.disabled = sessionActive;
    }

    if (els.generateBtn) {
      els.generateBtn.disabled = state.phase !== "spec" || !allSpecsFilled();
    }

    updateSurveyWorkflowUi();

    if (els.sideTitle) {
      els.sideTitle.textContent = state.phase === "spec" ? "กรอกรายละเอียดแต่ละหมุด" : "คู่มือสำรวจ";
    }
    if (els.sideNote) {
      els.sideNote.textContent = state.phase === "spec"
        ? "เลือกรหัสพัสดุจากรายการมาตรฐาน กฟภ. — แก้ไขเฉพาะหมุดที่ต้องการได้"
        : "ตั้งค่า Default / แนบรูปก่อนเริ่ม แล้วปักหมุดบนแผนที่";
    }
    if (els.exportKmlSideBtn) {
      els.exportKmlSideBtn.classList.toggle("hidden", state.phase !== "spec");
    }

    updateHistoryButtons();
    updateToolbarActiveState();
    updateModeHint();
  }

  function allSpecsFilled() {
    syncActiveSegmentToStore();
    const lineSegs = state.segments.filter(s => s.kind === "line");
    const withPoles = lineSegs.filter(s => s.poles?.length);
    if (!withPoles.length && state.trInstalls.length) return true;
    return withPoles.length > 0 && withPoles.every(seg => seg.poles.every(pole => pole.specFilled));
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

  function createTrIcon() {
    return L.divIcon({
      className: "survey-pin-wrap",
      html: `<div class="survey-pin is-tr">TR</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  }

  function updateMapLayers() {
    if (!state.map) return;

    syncActiveSegmentToStore();

    state.markers.forEach(m => m.remove());
    state.markers = [];
    state.polylines.forEach(p => p.remove());
    state.polylines = [];

    const activeId = state.activeSegmentId;

    const fieldMode = isFieldMode();

    state.segments.filter(s => s.kind === "line").forEach(seg => {
      const isActive = seg.id === activeId;
      const baseColor = seg.color || projectApi?.SEGMENT_COLORS?.[seg.type] || "#71e8ff";
      const color = fieldMode ? (FIELD_LINE_COLORS[seg.type] || baseColor) : baseColor;
      const lineOpacity = fieldMode ? (isActive ? 1 : 0.75) : (isActive ? 0.85 : 0.4);
      const weightBoost = fieldMode ? 2 : 0;

      // ไม่วาด routedPaths (แนวถนน OSRM) แยกอีกเส้น — ซ้อนกับเส้นแนวเสาจนดูเป็น 2 เส้น
      // เสาถูกวางตามแนวถนนอยู่แล้ว เส้นแนวเสาเส้นเดียวจึงสื่อครบ

      if ((seg.controlPoints || []).length > 1) {
        state.polylines.push(L.polyline(
          seg.controlPoints.map(c => [c.lat, c.lng]),
          { color: "#f5c96a", weight: 2, dashArray: "4 6", opacity: isActive ? 1 : 0.45 }
        ).addTo(state.map));
      }

      if ((seg.poles || []).length > 1) {
        state.polylines.push(L.polyline(
          seg.poles.map(p => [p.lat, p.lng]),
          { color, weight: 3 + weightBoost, dashArray: "6 8", opacity: lineOpacity }
        ).addTo(state.map));
      }

      (seg.poles || []).forEach(pole => {
        const marker = L.marker([pole.lat, pole.lng], {
          icon: createNumberIcon(pole.number, pole.source),
          draggable: isActive && state.phase === "surveying" && pole.source !== "auto" && pole.ctrlId,
          opacity: isActive ? 1 : 0.65
        }).addTo(state.map);

        marker.bindPopup(`<b>${pole.label}</b><br>${roleText(pole.source)}${pole.headMaterialId ? `<br>หัวเสา: ${escapeHtml(getSetLabel(pole.headMaterialId))}` : ""}`);

        if (state.phase === "surveying" && state.placeMode === "tr_pick") {
          marker.on("click", event => {
            L.DomEvent.stopPropagation(event);
            openTrInstallDialog({ lat: pole.lat, lng: pole.lng }, pole.id, seg.id);
          });
        } else if (isActive && state.phase === "surveying" && pole.ctrlId) {
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
              rebuildPolesFromControls().then(() => {
                pushHistory();
              });
            }
          });
        }

        state.markers.push(marker);
      });
    });

    state.trInstalls.forEach(tr => {
      const marker = L.marker([tr.lat, tr.lng], { icon: createTrIcon() }).addTo(state.map);
      const txName = presetsApi.getTransformers?.(tr.phase)?.find(t => t.id === tr.transformerId)?.name || tr.transformerId;
      marker.bindPopup(`<b>${escapeHtml(tr.label)}</b><br>SET ${tr.trSetId}<br>${escapeHtml(txName)}`);
      state.markers.push(marker);
    });
  }

  function renderSetOptions(sets, selectedId) {
    return (sets || []).map(setObj => `
      <option value="${setObj.id}" ${selectedId === setObj.id ? "selected" : ""}>${escapeHtml(presetsApi.formatSetLabel(setObj))}</option>
    `).join("");
  }

  function renderCableOptions(cables, selectedId) {
    return (cables || []).map(item => `
      <option value="${item.id}" ${selectedId === item.id ? "selected" : ""}>${escapeHtml(presetsApi.formatCableLabel(item))}</option>
    `).join("");
  }

  function renderCatalogOptions(catalog, selectedId) {
    return (catalog || []).map(item => `
      <option value="${item.id}" ${selectedId === item.id ? "selected" : ""}>${item.id} — ${item.name}</option>
    `).join("");
  }

  function getSectionCatalogsForConfig(config, sectionKey) {
    if (!config || !config[sectionKey]) {
      return { headSets: [], cables: [], ohgwSets: [] };
    }
    const section = config[sectionKey];
    return {
      headSets: presetsApi.getSetOptions(section.headSetIds),
      cables: presetsApi.getCableOptions(config, sectionKey),
      ohgwSets: presetsApi.getSetOptions(section.ohgwSetIds)
    };
  }

  function buildPoleSpecCardHtml(pole, seg, poleCatalog) {
    const config = presetsApi.getConfig(seg.type, seg.phase);
    const configKey = presetsApi.getConfigKey(seg.type, seg.phase);
    const isStart = pole.source === "start";
    const specialKind = getSpecialPoleKind(pole);
    const specialRule = specialKind ? presetsApi.getSpecialPoleRule(configKey, specialKind) : null;
    const sectionKey = isCurvePole(pole) ? "curve" : "straight";
    const catalogs = getSectionCatalogsForConfig(config, sectionKey);
    const headSets = isStart
      ? presetsApi.getSetOptions(config?.startHeadSetIds || [])
      : specialRule
        ? presetsApi.getSetOptions(specialRule.headSetIds || [])
        : catalogs.headSets;
    const ohgwSets = specialRule && config?.hasOhgw
      ? presetsApi.getSetOptions(specialRule.ohgwSetIds || [])
      : catalogs.ohgwSets;
    const guySets = specialRule ? presetsApi.getSetOptions(specialRule.guySetIds || []) : [];
    const headLabel = pole.headMaterialId ? getSetLabel(pole.headMaterialId) : "";
    const autoNotes = [];

    if (specialRule?.concrete?.materialId) {
      autoNotes.push(`คอนกรีต ${specialRule.concrete.materialId} × ${specialRule.concrete.qty}`);
    }
    if (specialKind === "end" && specialRule?.groundingSetId) {
      autoNotes.push(`Grounding SET ${specialRule.groundingSetId}`);
    }
    if (specialKind === "end" && specialRule?.surgeSetId) {
      autoNotes.push(`Surge SET ${specialRule.surgeSetId}`);
    }
    if (specialKind === "end" && specialRule?.surgeArresterId) {
      autoNotes.push(`Surge ${specialRule.surgeArresterId} × ${specialRule.surgeArresterQty}`);
    }

    return `
      <div class="survey-pole-card ${isStart ? "is-start" : ""} ${specialKind ? "is-special" : ""}" data-pole-id="${pole.id}" data-segment-id="${seg.id}">
        <div class="survey-pole-title">${pole.label} — ${roleText(pole.source)}${specialKind ? ` <span class="survey-tag">${specialKind === "end" ? "เสาต้นสุดท้าย" : "เสาโค้ง"}</span>` : ""}</div>
        ${isStart ? `<div class="survey-pole-meta">หัวเสาเริ่มต้น: ${escapeHtml(headLabel)} (กำหนดตอนปักหมุด 0)</div>` : `
        <div class="survey-field">
          <label>เสา (รหัสพัสดุ)</label>
          <select data-field="poleMaterialId" data-pole-id="${pole.id}" data-segment-id="${seg.id}">
            <option value="">-- เลือกเสา --</option>
            ${renderCatalogOptions(poleCatalog, pole.poleMaterialId)}
          </select>
        </div>`}
        <div class="survey-field">
          <label>หัวเสา (ชุด Set)</label>
          <select data-field="headMaterialId" data-pole-id="${pole.id}" data-segment-id="${seg.id}">
            <option value="">-- เลือกหัวเสา (ชุด Set) --</option>
            ${renderSetOptions(headSets, pole.headMaterialId)}
          </select>
        </div>
        ${specialRule ? `
        <div class="survey-field">
          <label>Guy (ชุด Set)</label>
          <select data-field="guySetId" data-pole-id="${pole.id}" data-segment-id="${seg.id}">
            <option value="">-- เลือก Guy --</option>
            ${renderSetOptions(guySets, pole.guySetId)}
          </select>
        </div>` : ""}
        <div class="survey-field">
          <label>สายไฟ (รหัสพัสดุ)</label>
          <select data-field="cableMaterialId" data-pole-id="${pole.id}" data-segment-id="${seg.id}">
            <option value="">-- เลือกสายไฟ --</option>
            ${renderCableOptions(catalogs.cables, pole.cableMaterialId)}
          </select>
        </div>
        ${config?.hasOhgw ? `
        <div class="survey-field">
          <label>OHGW (ชุด Set)</label>
          <select data-field="ohgwSetId" data-pole-id="${pole.id}" data-segment-id="${seg.id}">
            <option value="">-- ไม่ติดตั้ง --</option>
            ${renderSetOptions(ohgwSets, pole.ohgwSetId)}
          </select>
        </div>` : ""}
        ${autoNotes.length ? `<div class="survey-pole-meta survey-auto-spec">${autoNotes.map(n => escapeHtml(n)).join(" · ")}</div>` : ""}
      </div>
    `;
  }

  function renderPoleList() {
    if (!els.poleList) return;

    syncActiveSegmentToStore();
    const lineSegs = state.segments.filter(s => s.kind === "line");
    const totalPoles = lineSegs.reduce((n, s) => n + (s.poles?.length || 0), 0);

    if (!totalPoles && !state.trInstalls.length) {
      els.poleList.innerHTML = `<div class="survey-empty">1) เพิ่ม MV/LV/TR → 2) ปักหมุด 0 + หัวเสา → 3) ปักหมุดถัดไป</div>`;
      return;
    }

    if (state.phase === "surveying") {
      const active = getActiveLineSegment();
      const poles = active?.poles?.length ? active.poles : state.poles;
      if (!poles.length) {
        els.poleList.innerHTML = `<div class="survey-empty">เลือกส่วน MV/LV แล้วปักหมุดบนแผนที่</div>`;
        return;
      }
      const header = active
        ? `<div class="survey-segment-spec-head"><span class="survey-segment-dot" style="background:${active.color}"></span>${escapeHtml(active.label)}</div>`
        : "";
      els.poleList.innerHTML = header + poles.map(pole => `
        <div class="survey-pole-card ${pole.source === "start" ? "is-start" : ""}">
          <div class="survey-pole-title">${pole.label} — ${roleText(pole.source)}</div>
          <div class="survey-pole-meta">${pole.headMaterialId ? `หัวเสา: ${escapeHtml(getSetLabel(pole.headMaterialId))}` : "รอกรอกรายละเอียดหลังสำรวจเสร็จ"}</div>
        </div>
      `).join("");
      return;
    }

    const poleCatalog = surveyConfig.poleCatalog || [];
    let html = "";

    lineSegs.forEach(seg => {
      if (!seg.poles?.length) return;
      html += `<div class="survey-segment-spec-head"><span class="survey-segment-dot" style="background:${seg.color}"></span>${escapeHtml(seg.label)}</div>`;
      html += seg.poles.map(pole => buildPoleSpecCardHtml(pole, seg, poleCatalog)).join("");
    });

    state.trInstalls.forEach(tr => {
      const txName = presetsApi.getTransformers?.(tr.phase)?.find(t => t.id === tr.transformerId)?.name || tr.transformerId;
      html += `
        <div class="survey-tr-card">
          <div class="survey-pole-title"><span class="survey-segment-dot is-tr"></span> ${escapeHtml(tr.label)}</div>
          <div class="survey-pole-meta">SET ${tr.trSetId} · ${escapeHtml(txName)}${tr.isExistingPole ? " · เสาเดิม (ไม่นับเสา)" : ""}</div>
        </div>
      `;
    });

    els.poleList.innerHTML = html;
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

  function getBulkApplyGroup(pole) {
    if (!pole || pole.source === "start" || pole.source === "end" || pole.source === "control") return null;
    if (pole.source === "curve_in") return "curve_in";
    if (pole.source === "curve_out") return "curve_out";
    if (pole.source === "curve_waypoint") return "curve_interior";
    if (pole.source === "auto") return isCurvePole(pole) ? "curve_interior" : "straight";
    return null;
  }

  function canBulkApplyField(field, pole) {
    const group = getBulkApplyGroup(pole);
    if (!group) return false;
    if (field === "poleMaterialId") return pole.source !== "start";
    if (field === "headMaterialId") return true;
    if (field === "cableMaterialId") return true;
    if (field === "ohgwSetId") return true;
    if (field === "guySetId") return group === "curve_in" || group === "curve_out";
    return false;
  }

  function poleMatchesBulkGroup(pole, group, field) {
    return getBulkApplyGroup(pole) === group && canBulkApplyField(field, pole);
  }

  function forEachProjectPole(callback) {
    state.segments.filter(s => s.kind === "line").forEach(seg => {
      (seg.poles || []).forEach(pole => callback(pole, seg));
    });
  }

  function applyFieldToBulkGroup(group, field, value) {
    const touched = new Set();
    forEachProjectPole(pole => {
      if (!poleMatchesBulkGroup(pole, group, field)) return;
      if (touched.has(pole.id)) return;
      touched.add(pole.id);
      pole[field] = value;
      markPoleSpecFilled(pole);
    });
    return touched.size;
  }

  const BULK_GROUP_LABELS = {
    straight: "เสาทางตรง",
    curve_in: "เสาเข้าโค้ง",
    curve_out: "เสาออกโค้ง",
    curve_interior: "เสาภายในโค้ง"
  };

  async function askBulkApplyChoice(fieldLabel, group) {
    const groupLabel = BULK_GROUP_LABELS[group] || "เสาประเภทเดียวกัน";
    const result = await Swal.fire({
      title: "เปลี่ยนหลายต้น?",
      html: `ต้องการเปลี่ยน<strong>${fieldLabel}</strong> เฉพาะต้นนี้<br>หรือทุก<strong>${groupLabel}</strong> (ไม่รวมประเภทอื่น)?`,
      icon: "question",
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: `เปลี่ยนทั้งหมด (${groupLabel})`,
      denyButtonText: "เฉพาะต้นนี้",
      cancelButtonText: "ยกเลิก"
    });
    if (result.isConfirmed) return "all";
    if (result.isDenied) return "one";
    return null;
  }

  const POLE_FIELD_LABELS = {
    poleMaterialId: "ขนาด/รหัสเสา",
    headMaterialId: "หัวเสา (SET)",
    cableMaterialId: "สายไฟ",
    ohgwSetId: "OHGW",
    guySetId: "Guy (SET)"
  };

  async function handlePoleListChange(event) {
    if (state.phase !== "spec") return;
    const target = event.target;
    const poleId = target.dataset.poleId;
    const field = target.dataset.field;
    if (!poleId || !field) return;

    const found = findPoleInProject(poleId);
    if (!found) return;

    const newValue = target.value;
    const oldValue = found.pole[field];
    if (newValue === oldValue) return;

    const bulkGroup = getBulkApplyGroup(found.pole);
    if (bulkGroup && canBulkApplyField(field, found.pole)) {
      const choice = await askBulkApplyChoice(POLE_FIELD_LABELS[field] || field, bulkGroup);
      if (!choice) {
        target.value = oldValue || "";
        return;
      }
      if (choice === "all") {
        const count = applyFieldToBulkGroup(bulkGroup, field, newValue);
        renderPoleList();
        updateUiState();
        Swal.fire({
          icon: "success",
          title: "อัปเดตแล้ว",
          text: `เปลี่ยน${POLE_FIELD_LABELS[field] || field} ${count} ต้น (${BULK_GROUP_LABELS[bulkGroup]})`,
          timer: 1800,
          showConfirmButton: false
        });
        return;
      }
    }

    found.pole[field] = newValue;
    markPoleSpecFilled(found.pole);
    updateUiState();
  }

  function updateSummary() {
    if (!els.summary) return;

    syncActiveSegmentToStore();
    let totalDist = 0;
    let poleCount = 0;
    state.segments.filter(s => s.kind === "line").forEach(seg => {
      const poles = seg.poles || [];
      poleCount += poles.length;
      for (let i = 1; i < poles.length; i++) {
        totalDist += distanceMeters(poles[i - 1], poles[i]);
      }
    });
    const segCount = state.segments.filter(s => s.kind === "line").length;

    els.summary.innerHTML = `
      <span>ระยะรวม</span>
      <strong>${Math.round(totalDist)} ม.</strong>
      <span style="margin-top:6px;">${segCount} ส่วน · ${poleCount} หมุด · TR ${state.trInstalls.length}</span>
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

  function addSetToCounts(counts, setId, multiplier = 1) {
    const setObj = presetsApi.getSet(setId);
    if (!setObj) return;
    setObj.items.forEach(item => {
      const key = `mat:${item.id}`;
      counts[key] = (counts[key] || 0) + (item.qty * multiplier);
    });
  }

  function addMaterialToCounts(counts, materialId, qty) {
    if (!materialId || !qty) return;
    const key = `mat:${materialId}`;
    counts[key] = (counts[key] || 0) + qty;
  }

  function addLvIntervalSurges(counts) {
    const rules = getSpecialPoleRulesRoot();
    const intervalM = rules?.surgeIntervalM;
    const setId = rules?.intervalSurgeSetId;
    if (!intervalM || !setId) return;

    let traveled = 0;
    let nextAt = intervalM;

    for (let i = 1; i < state.poles.length; i++) {
      const seg = distanceMeters(state.poles[i - 1], state.poles[i]);
      while (traveled + seg >= nextAt) {
        addSetToCounts(counts, setId, 1);
        nextAt += intervalM;
      }
      traveled += seg;
    }
  }

  function buildBomLines() {
    syncActiveSegmentToStore();

    let counts = {};
    if (projectApi) {
      counts = projectApi.buildProjectBom(
        { segments: state.segments, trInstalls: state.trInstalls },
        {
          presetsApi,
          distanceMeters,
          getSpecialPoleKind,
          getSpecialPoleRule,
          getSpecialPoleRulesRoot
        }
      );
    } else {
      const wireMult = getWireMultiplier();
      state.poles.forEach((pole, index) => {
        if (pole.source !== "start" && pole.poleMaterialId) {
          addMaterialToCounts(counts, pole.poleMaterialId, 1);
        }
        if (pole.headMaterialId) addSetToCounts(counts, pole.headMaterialId, 1);
        if (index > 0 && pole.cableMaterialId) {
          const span = distanceMeters(state.poles[index - 1], pole);
          const key = `cable:${pole.cableMaterialId}`;
          counts[key] = (counts[key] || 0) + (span * wireMult);
        }
        if (pole.ohgwSetId) addSetToCounts(counts, pole.ohgwSetId, 1);
        if (pole.guySetId) addSetToCounts(counts, pole.guySetId, 1);
        if (pole.concreteMaterialId && pole.concreteQty) {
          addMaterialToCounts(counts, pole.concreteMaterialId, pole.concreteQty);
        }
        if (pole.groundingSetId) addSetToCounts(counts, pole.groundingSetId, 1);
        if (pole.surgeSetId) addSetToCounts(counts, pole.surgeSetId, 1);
        if (pole.surgeArresterId && pole.surgeArresterQty) {
          addMaterialToCounts(counts, pole.surgeArresterId, pole.surgeArresterQty);
        }
      });
      addLvIntervalSurges(counts);
    }

    const lines = [];
    Object.entries(counts).forEach(([key, qty]) => {
      const [, id] = key.split(":");
      const item = findMaterialById(id);
      const isCable = key.startsWith("cable:");
      lines.push({
        type: isCable ? "cable" : "mat",
        materialId: id,
        label: item ? `${id} ${item.name || ""}`.trim() : id,
        qty: isCable ? Math.ceil(qty) : (Math.round(qty * 100) / 100)
      });
    });
    return lines;
  }

  function findMaterialById(materialId) {
    const store = window.AppCore ? window.AppCore.getDataStore() : [];
    const idKey = String(materialId).trim();
    return store.find(item => String(item.id).trim() === idKey) || null;
  }

  function updateSurveyWorkflowUi() {
    if (!els.saveProjectBtn) return;
    const showSave = state.phase === "spec" && state.surveyEstimateImported && !state.surveyProjectSaved;
    els.saveProjectBtn.classList.toggle("hidden", !showSave);
    if (els.generateBtn && state.surveyEstimateImported) {
      els.generateBtn.disabled = true;
    }
  }

  function shouldWarnLeavingSurvey() {
    if (state.phase !== "spec" || state.surveyProjectSaved) return false;
    syncActiveSegmentToStore();
    return projectCanComplete();
  }

  async function confirmLeaveTab() {
    if (!shouldWarnLeavingSurvey()) return true;

    const text = state.surveyEstimateImported
      ? "ยังไม่ได้บันทึกโครงการ — รายการที่นำเข้างบจะไม่ถูกเก็บในประวัติ"
      : "สำรวจเสร็จแล้วแต่ยังไม่ได้สร้างรายการประมาณการหรือบันทึกโครงการ";

    const { isConfirmed } = await Swal.fire({
      title: "ออกจากหน้าสำรวจ?",
      text,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ออก (ไม่บันทึก)",
      cancelButtonText: "อยู่ต่อ"
    });

    if (!isConfirmed) return false;
    resetSurvey();
    return true;
  }

  function markProjectSaved() {
    state.surveyProjectSaved = true;
    updateSurveyWorkflowUi();
  }

  async function generateEstimate() {
    if (!allSpecsFilled()) {
      Swal.fire("กรอกไม่ครบ", "กรุณาเลือกรหัสพัสดุให้ครบทุกหมุด", "warning");
      return;
    }

    if (!window.AppCore?.pickOrCreateBudgetIndex) {
      Swal.fire("ระบบไม่พร้อม", "ไม่พบตัวจัดการงบ", "error");
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

    const budgetIndex = await window.AppCore.pickOrCreateBudgetIndex();
    if (budgetIndex === null) return;

    const reviewItems = ready.map(line => {
      const labor = line.item.laborOptions?.[0] || { desc: "ค่าแรงมาตรฐาน", price: line.item.labPrice };
      return {
        ...line.item,
        qty: line.qty,
        laborIndex: 0,
        labPrice: labor.price,
        laborDesc: labor.desc
      };
    });

    const escH = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    const buildReviewHtml = items => {
      const rows = items.map((entry, i) => {
        const laborOpts = entry.laborOptions || [];
        const laborCell = laborOpts.length > 1
          ? `<select class="staging-labor-select" data-ridx="${i}">${laborOpts.map((lo, li) =>
              `<option value="${li}" ${li === entry.laborIndex ? "selected" : ""}>${escH(lo.desc)} (${lo.price})</option>`
            ).join("")}</select>`
          : `<span>${escH(entry.laborDesc)}</span>`;
        const total = (entry.matPrice + entry.labPrice) * entry.qty;
        return `<tr>
          <td class="staging-no">${i + 1}</td>
          <td title="${escH(entry.id)}">${escH(entry.name)}</td>
          <td>${laborCell}</td>
          <td><input type="number" class="staging-qty-input" value="${entry.qty}" step="any" min="0.01" data-ridx="${i}"></td>
          <td class="rtotal">${total.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
          <td><button type="button" class="staging-remove" data-ridx="${i}">✕</button></td>
        </tr>`;
      }).join("");
      const grand = items.reduce((s,e) => s + (e.matPrice + e.labPrice) * e.qty, 0);
      return `<div class="staging-table-wrap"><table class="staging-table">
        <thead><tr><th class="staging-no">#</th><th>รายการ</th><th>ค่าแรง</th><th>จำนวน</th><th>รวม</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="4" style="text-align:right;font-weight:700;">รวมทั้งหมด</td><td class="rtotal" style="font-weight:700;">${grand.toLocaleString(undefined,{minimumFractionDigits:2})}</td><td></td></tr></tfoot>
      </table></div>`;
    };

    const { isConfirmed } = await Swal.fire({
      title: `ตรวจสอบรายการ (${reviewItems.length} รายการ)`,
      html: buildReviewHtml(reviewItems),
      width: "min(95vw, 750px)",
      showCancelButton: true,
      confirmButtonText: "ยืนยันเพิ่มทั้งหมด",
      cancelButtonText: "ยกเลิก",
      didOpen: () => {
        const popup = Swal.getPopup();
        popup.addEventListener("input", e => {
          const idx = e.target.dataset?.ridx !== undefined ? Number(e.target.dataset.ridx) : null;
          if (idx === null) return;
          if (e.target.classList.contains("staging-qty-input")) {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v) && v > 0) { reviewItems[idx].qty = v; popup.querySelector(".swal2-html-container").innerHTML = buildReviewHtml(reviewItems); }
          }
        });
        popup.addEventListener("change", e => {
          const idx = e.target.dataset?.ridx !== undefined ? Number(e.target.dataset.ridx) : null;
          if (idx === null) return;
          if (e.target.classList.contains("staging-labor-select")) {
            const li = Number(e.target.value);
            const labor = reviewItems[idx].laborOptions[li];
            if (labor) { reviewItems[idx].laborIndex = li; reviewItems[idx].labPrice = labor.price; reviewItems[idx].laborDesc = labor.desc; popup.querySelector(".swal2-html-container").innerHTML = buildReviewHtml(reviewItems); }
          }
        });
        popup.addEventListener("click", e => {
          if (e.target.classList.contains("staging-remove")) {
            const idx = Number(e.target.dataset.ridx);
            reviewItems.splice(idx, 1);
            popup.querySelector(".swal2-html-container").innerHTML = buildReviewHtml(reviewItems);
          }
        });
      }
    });

    if (!isConfirmed || !reviewItems.length) return;

    reviewItems.forEach(entry => {
      window.AppCore.addItemDirect(budgetIndex, entry);
    });
    window.AppCore.render();

    state.surveyEstimateImported = true;
    updateSurveyWorkflowUi();

    Swal.fire({
      title: "นำเข้าสำเร็จ",
      text: `เพิ่ม ${reviewItems.length} รายการเข้างบแล้ว — กด「บันทึกโครงการ」ด้านล่างเพื่อเก็บลงประวัติ`,
      icon: "success",
      timer: 3200,
      showConfirmButton: true,
      confirmButtonText: "เข้าใจแล้ว"
    });
  }

  function resetSurvey() {
    window.__surveySetSegTools?.(true);
    state.controlPoints = [];
    state.poles = [];
    state.segments = [];
    state.trInstalls = [];
    state.activeSegmentId = null;
    state.selectedSpan = null;
    state.placeMode = null;
    state.pendingCurveSpan = null;
    state.phase = "surveying";
    state.sessionActive = false;
    state.surveyMeta = null;
    state.surveyEstimateImported = false;
    state.surveyProjectSaved = false;
    state.voltageType = null;
    state.phaseType = null;
    state.presetConfig = null;
    state.attachFiles = [];
    state.routedPaths = [];
    state.routedLegs = [];
    state.routeCache = {};
    state.isRebuilding = false;
    resetHistory();
    state.markers.forEach(m => m.remove());
    state.markers = [];
    state.polylines.forEach(p => p.remove());
    state.polylines = [];

    if (els.prePanel) els.prePanel.classList.remove("hidden");
    if (els.mapStage) {
      els.mapStage.classList.add("hidden");
      els.mapStage.classList.remove("is-spec", "is-active");
    }
    if (els.sidePanel) els.sidePanel.classList.add("hidden");
    if (els.layout) els.layout.classList.remove("is-spec-mode");
    if (els.specActions) els.specActions.classList.add("hidden");

    setMapActiveMode(false);
    collapseMobileToolbar();
    hideAimOverlay();
    hideDefaultsPanel();

    resetDefaultMaterialSelects();
    resetSystemSelection();
    if (window.AppCore && window.AppCore.clearSurveyFiles) {
      window.AppCore.clearSurveyFiles();
    }
    renderAttachList();
    renderSegmentList();
    updateActiveSegmentLabel();
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

  window.addEventListener("pea-theme-change", () => {
    applyMapTheme();
  });

  window.SurveyModule = {
    onTabOpen,
    resetSurvey,
    getSurveyMeta,
    confirmLeaveTab,
    markProjectSaved
  };
})();
