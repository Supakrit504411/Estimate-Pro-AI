(function () {
  const config = window.APP_CONFIG || {};
  const surveyConfig = config.survey || {};

  const state = {
    map: null,
    markers: [],
    polyline: null,
    poles: [],
    selectedSpan: 20,
    placeMode: null,
    mapReady: false
  };

  let els = {};

  function init() {
    cacheElements();
    bindEvents();
  }

  function cacheElements() {
    els.mapEl = document.getElementById("surveyMap");
    els.poleList = document.getElementById("surveyPoleList");
    els.spanBar = document.getElementById("surveySpanBar");
    els.summary = document.getElementById("surveySummary");
    els.gpsBtn = document.getElementById("surveyGpsBtn");
    els.startBtn = document.getElementById("surveyStartBtn");
    els.addPoleBtn = document.getElementById("surveyAddPoleBtn");
    els.resetBtn = document.getElementById("surveyResetBtn");
    els.generateBtn = document.getElementById("surveyGenerateBtn");
  }

  function bindEvents() {
    if (!els.mapEl) return;

    els.gpsBtn.addEventListener("click", useCurrentLocation);
    els.startBtn.addEventListener("click", () => setPlaceMode("start"));
    els.addPoleBtn.addEventListener("click", () => setPlaceMode("next"));
    els.resetBtn.addEventListener("click", resetSurvey);
    els.generateBtn.addEventListener("click", generateEstimate);

    if (els.spanBar) {
      els.spanBar.addEventListener("click", event => {
        const btn = event.target.closest("[data-span]");
        if (!btn) return;
        state.selectedSpan = Number(btn.dataset.span);
        els.spanBar.querySelectorAll("[data-span]").forEach(node => {
          node.classList.toggle("active", node === btn);
        });
      });
    }

    if (els.poleList) {
      els.poleList.addEventListener("change", handlePoleListChange);
    }
  }

  function onTabOpen() {
    if (!state.mapReady) {
      initMap();
    } else {
      state.map.invalidateSize();
    }
    renderPoleList();
    updateSummary();
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

  function setPlaceMode(mode) {
    if (!window.AppCore || !window.AppCore.getProjectName()) {
      Swal.fire("กรุณากรอกชื่อโครงการก่อน", "ไปที่แท็บสร้างงานใหม่เพื่อระบุชื่อโครงการ", "info");
      return;
    }

    if (mode === "next" && state.poles.length === 0) {
      Swal.fire("ยังไม่มีจุดเริ่ม", "กดปักจุดเริ่มหรือใช้ GPS ก่อน", "info");
      return;
    }

    state.placeMode = mode;
    const label = mode === "start"
      ? "แตะแผนที่เพื่อปักจุดเริ่ม (เสาระบบจำหน่าย)"
      : `แตะทิศทางบนแผนที่ — ระบบจะวางเสาถัดไปห่าง ${state.selectedSpan} ม.`;
    Swal.fire({ title: label, icon: "info", timer: 2200, showConfirmButton: false });
  }

  function handleMapClick(event) {
    if (!state.placeMode) return;

    const point = { lat: event.latlng.lat, lng: event.latlng.lng };

    if (state.placeMode === "start") {
      resetMarkersOnly();
      addPole({
        lat: point.lat,
        lng: point.lng,
        label: "เสา A (ระบบจำหน่าย)",
        isStart: true,
        poleSize: "",
        headType: "",
        cableType: surveyConfig.cableTypes[0]
      });
      state.placeMode = null;
    } else if (state.placeMode === "next") {
      const lastPole = state.poles[state.poles.length - 1];
      const brng = bearing(lastPole, point);
      const dest = destinationPoint(lastPole.lat, lastPole.lng, brng, state.selectedSpan);
      const label = `เสา ${String.fromCharCode(65 + state.poles.length)}`;

      addPole({
        lat: dest.lat,
        lng: dest.lng,
        label,
        isStart: false,
        poleSize: surveyConfig.poleSizes[0],
        headType: surveyConfig.poleHeadTypes[0],
        cableType: surveyConfig.cableTypes[0]
      });
      state.placeMode = null;
    }

    renderPoleList();
    updateMapLayers();
    updateSummary();
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      Swal.fire("ไม่รองรับ GPS", "อุปกรณ์นี้ไม่สามารถดึงตำแหน่งได้", "error");
      return;
    }

    Swal.fire({ title: "กำลังดึง GPS...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    navigator.geolocation.getCurrentPosition(
      position => {
        Swal.close();
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        if (state.map) {
          state.map.setView([point.lat, point.lng], 17);
        }

        resetMarkersOnly();
        addPole({
          lat: point.lat,
          lng: point.lng,
          label: "เสา A (ระบบจำหน่าย)",
          isStart: true,
          poleSize: "",
          headType: "",
          cableType: surveyConfig.cableTypes[0]
        });
        state.placeMode = null;
        renderPoleList();
        updateMapLayers();
        updateSummary();
      },
      error => {
        Swal.fire("GPS ไม่สำเร็จ", error.message || "ไม่สามารถดึงตำแหน่งได้", "error");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  function addPole(pole) {
    state.poles.push({
      id: `pole-${Date.now()}-${state.poles.length}`,
      ...pole
    });
  }

  function resetMarkersOnly() {
    state.poles = [];
    state.markers.forEach(marker => marker.remove());
    state.markers = [];
    if (state.polyline) {
      state.polyline.remove();
      state.polyline = null;
    }
  }

  function resetSurvey() {
    resetMarkersOnly();
    state.placeMode = null;
    renderPoleList();
    updateSummary();
  }

  function updateMapLayers() {
    if (!state.map) return;

    state.markers.forEach(marker => marker.remove());
    state.markers = [];

    state.poles.forEach((pole, index) => {
      const marker = L.marker([pole.lat, pole.lng], {
        draggable: !pole.isStart
      }).addTo(state.map);

      marker.bindPopup(`<b>${pole.label}</b>${pole.isStart ? "<br>จุดเริ่มระบบจำหน่าย" : ""}`);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        pole.lat = pos.lat;
        pole.lng = pos.lng;
        updateMapLayers();
        updateSummary();
      });

      state.markers.push(marker);

      if (index > 0) {
        const prev = state.poles[index - 1];
        const dist = distanceMeters(prev, pole);
        marker.setPopupContent(`<b>${pole.label}</b><br>span ~${Math.round(dist)} ม.`);
      }
    });

    if (state.polyline) state.polyline.remove();
    if (state.poles.length > 1) {
      state.polyline = L.polyline(
        state.poles.map(p => [p.lat, p.lng]),
        { color: "#71e8ff", weight: 3, dashArray: "6 8" }
      ).addTo(state.map);
    }
  }

  function renderPoleList() {
    if (!els.poleList) return;

    if (!state.poles.length) {
      els.poleList.innerHTML = `
        <div class="survey-empty">
          ปักจุดเริ่มจากเสาระบบจำหน่าย แล้วเลือก span เพื่อวางเสาถัดไป
        </div>
      `;
      return;
    }

    els.poleList.innerHTML = state.poles.map(pole => {
      if (pole.isStart) {
        return `
          <div class="survey-pole-card is-start">
            <div class="survey-pole-title">${pole.label}</div>
            <div class="survey-pole-meta">จุดเริ่มต้น — ไม่ต้องเลือก spec เสา</div>
          </div>
        `;
      }

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
          <div class="survey-pole-title">${pole.label}</div>
          <div class="survey-field">
            <label>ขนาดเสา</label>
            <select data-field="poleSize" data-pole-id="${pole.id}">${sizeOptions}</select>
          </div>
          <div class="survey-field">
            <label>หัวเสา</label>
            <select data-field="headType" data-pole-id="${pole.id}">${headOptions}</select>
          </div>
          <div class="survey-field">
            <label>สายไฟ (ช่วงถัดไป)</label>
            <select data-field="cableType" data-pole-id="${pole.id}">${cableOptions}</select>
          </div>
        </div>
      `;
    }).join("");
  }

  function handlePoleListChange(event) {
    const target = event.target;
    const poleId = target.dataset.poleId;
    const field = target.dataset.field;
    if (!poleId || !field) return;

    const pole = state.poles.find(item => item.id === poleId);
    if (pole) {
      pole[field] = target.value;
      updateSummary();
    }
  }

  function updateSummary() {
    if (!els.summary) return;

    const workPoles = state.poles.filter(p => !p.isStart);
    const totalSpan = state.poles.reduce((sum, pole, index) => {
      if (index === 0) return sum;
      return sum + distanceMeters(state.poles[index - 1], pole);
    }, 0);

    els.summary.innerHTML = `
      <div class="survey-stat"><span>จุดทั้งหมด</span><strong>${state.poles.length}</strong></div>
      <div class="survey-stat"><span>เสาใหม่</span><strong>${workPoles.length}</strong></div>
      <div class="survey-stat"><span>ระยะรวม</span><strong>${Math.round(totalSpan)} ม.</strong></div>
      <div class="survey-stat"><span>Span ที่เลือก</span><strong>${state.selectedSpan} ม.</strong></div>
    `;
  }

  function buildBomLines() {
    const poleCounts = {};
    const headCounts = {};
    const cableLengths = {};

    state.poles.forEach((pole, index) => {
      if (!pole.isStart) {
        const poleKey = pole.poleSize || surveyConfig.poleSizes[0];
        const headKey = pole.headType || surveyConfig.poleHeadTypes[0];
        poleCounts[poleKey] = (poleCounts[poleKey] || 0) + 1;
        headCounts[headKey] = (headCounts[headKey] || 0) + 1;
      }

      if (index > 0) {
        const cableKey = pole.cableType || surveyConfig.cableTypes[0];
        const span = distanceMeters(state.poles[index - 1], pole);
        cableLengths[cableKey] = (cableLengths[cableKey] || 0) + span;
      }
    });

    const lines = [];

    Object.entries(poleCounts).forEach(([size, qty]) => {
      lines.push({
        type: "pole",
        label: `เสา ${size}`,
        qty,
        keywords: (surveyConfig.materialKeywords.pole || {})[size] || ["เสา"]
      });
    });

    Object.entries(headCounts).forEach(([head, qty]) => {
      lines.push({
        type: "head",
        label: `หัวเสา ${head}`,
        qty,
        keywords: (surveyConfig.materialKeywords.head || {})[head] || ["หัวเสา"]
      });
    });

    Object.entries(cableLengths).forEach(([cable, meters]) => {
      lines.push({
        type: "cable",
        label: `สายไฟ ${cable}`,
        qty: Math.ceil(meters),
        keywords: (surveyConfig.materialKeywords.cable || {})[cable] || ["สาย"]
      });
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
    const budgets = window.AppCore ? window.AppCore.getBudgets() : [];
    if (!budgets.length) {
      Swal.fire("ยังไม่มีงบ", "ไปที่แท็บสร้างงานใหม่เพื่อเพิ่มงบก่อน", "info");
      return;
    }

    const workPoles = state.poles.filter(p => !p.isStart);
    if (!workPoles.length) {
      Swal.fire("ยังไม่มีเสาใหม่", "เพิ่มเสาอย่างน้อย 1 จุดหลังจุดเริ่ม", "info");
      return;
    }

    const bomLines = buildBomLines();
    const matched = bomLines.map(line => ({
      ...line,
      item: findMaterial(line.keywords)
    }));

    const missing = matched.filter(line => !line.item);
    if (missing.length) {
      const list = missing.map(line => `• ${line.label}`).join("<br>");
      const proceed = await Swal.fire({
        title: "บางรายการไม่พบใน master",
        html: `${list}<br><br>ต้องการดำเนินการต่อกับรายการที่พบเท่านั้น?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "ดำเนินการต่อ",
        cancelButtonText: "ยกเลิก"
      });
      if (!proceed.isConfirmed) return;
    }

    const ready = matched.filter(line => line.item);
    if (!ready.length) {
      Swal.fire("ไม่พบพัสดุ", "ไม่สามารถจับคู่กับ master data ได้", "error");
      return;
    }

    const budgetOptions = {};
    budgets.forEach((budget, index) => {
      budgetOptions[index] = `งบ ${budget.type}`;
    });

    const { value: budgetIndex } = await Swal.fire({
      title: "เลือกงบที่จะนำเข้า",
      input: "select",
      inputOptions: budgetOptions,
      showCancelButton: true
    });

    if (budgetIndex === undefined) return;

    Swal.fire({
      title: "กำลังนำเข้ารายการ...",
      html: "ระบบจะให้เลือกค่าแรงทีละรายการ",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    for (const line of ready) {
      Swal.close();
      await window.AppCore.addItemWithLabor(Number(budgetIndex), line.item, line.qty);
    }

    Swal.fire("นำเข้าสำเร็จ", "รายการจากการสำรวจถูกเพิ่มเข้างบแล้ว", "success");
    window.AppCore.switchToCreateTab();
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
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
    );
    const lng2 = lng1 + Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
    return { lat: lat2 * 180 / Math.PI, lng: lng2 * 180 / Math.PI };
  }

  function distanceMeters(a, b) {
    const R = 6371000;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  document.addEventListener("DOMContentLoaded", init);

  window.SurveyModule = {
    onTabOpen,
    resetSurvey
  };
})();
