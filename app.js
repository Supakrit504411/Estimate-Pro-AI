(function () {
  const appConfig = window.APP_CONFIG || {};

  const state = {
    dataStore: [],
    budgets: [],
    historyCache: null,
    historyRowCache: {},
    adminCache: null,
    currentJobId: null,
    currentFileUrl: "",
    tempFileList: [],
    aiReviewQueue: []
  };

  let lastPriceQuote = null;
  let appBootstrapped = false;

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    bindLoginEvents();
    if (window.AuthSession?.isLoggedIn()) {
      await bootstrapApp();
    }
  }

  function bindLoginEvents() {
    const form = document.getElementById("loginForm");
    const logoutBtn = document.getElementById("logoutBtn");
    form?.addEventListener("submit", handleLoginSubmit);
    logoutBtn?.addEventListener("click", handleLogout);
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    const usernameInput = document.getElementById("loginUsername");
    const passwordInput = document.getElementById("loginPassword");
    const errorEl = document.getElementById("loginError");
    const submitBtn = document.getElementById("loginSubmitBtn");

    const username = usernameInput?.value.trim() || "";
    const password = passwordInput?.value || "";
    if (!username || !password) return;

    if (errorEl) errorEl.classList.add("hidden");
    if (submitBtn) submitBtn.disabled = true;

    try {
      const result = await window.ApiService.login(username, password);
      if (!result?.ok || !result.user) {
        throw new Error(result?.message || "เข้าสู่ระบบไม่สำเร็จ");
      }
      window.AuthSession.save(result.user);
      await bootstrapApp();
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message || "เข้าสู่ระบบไม่สำเร็จ";
        errorEl.classList.remove("hidden");
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function handleLogout() {
    window.AuthSession?.clear();
    state.historyCache = null;
    location.reload();
  }

  async function bootstrapApp() {
    if (!window.AuthSession?.isLoggedIn()) return;
    window.AuthSession.applyRbacToDom();
    if (!appBootstrapped) {
      bindEvents();
      appBootstrapped = true;
    }
    const defaultTab = window.AuthSession.getDefaultTab?.() || 1;
    document.querySelectorAll("[data-tab-nav]").forEach(btn => {
      btn.classList.toggle("is-active", Number(btn.dataset.tabNav) === defaultTab);
    });
    await loadMasterData();
    checkInput();
    renderPriceFaqChips();
    initScrollCompactHeader();
    switchTab(defaultTab);
  }

  function renderPriceFaqChips() {
    if (!els.priceAskChips) return;
    const faq = appConfig.priceFaq || {};
    els.priceAskChips.innerHTML = Object.entries(faq).map(([id, entry]) => `
      <button type="button" class="price-ask-chip" data-faq-id="${escapeHtml(id)}">${escapeHtml(entry.label)}</button>
    `).join("");
  }

  function initScrollCompactHeader() {
    const mq = window.matchMedia("(max-width: 720px)");
    let compact = false;

    const apply = () => {
      if (!mq.matches) {
        compact = false;
        document.body.classList.remove("is-scroll-compact");
        return;
      }
      document.body.classList.toggle("is-scroll-compact", compact);
    };

    let ticking = false;
    window.addEventListener("scroll", () => {
      if (!mq.matches) return;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const y = window.scrollY;
          if (!compact && y > 80) compact = true;
          else if (compact && y < 28) compact = false;
          apply();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    mq.addEventListener("change", () => {
      compact = false;
      apply();
    });
    apply();
  }

  function cacheElements() {
    els.t1 = document.getElementById("t1");
    els.t2 = document.getElementById("t2");
    els.t3 = document.getElementById("t3");
    els.t4 = document.getElementById("t4");
    els.t5 = document.getElementById("t5");
    els.view1 = document.getElementById("view1");
    els.view2 = document.getElementById("view2");
    els.view3 = document.getElementById("view3");
    els.view4 = document.getElementById("view4");
    els.view5 = document.getElementById("view5");
    els.pjName = document.getElementById("pjName");
    els.aiSection = document.getElementById("aiSection");
    els.aiFile = document.getElementById("aiFile");
    els.scanBtn = document.getElementById("scanBtn");
    els.saveProjectBtn = document.getElementById("saveProjectBtn");
    els.reloadHistoryBtn = document.getElementById("reloadHistoryBtn");
    els.histSearch = document.getElementById("histSearch");
    els.histContent = document.getElementById("histContent");
    els.budgetSpace = document.getElementById("budgetSpace");
    els.saveZone = document.getElementById("saveZone");
    els.grandText = document.getElementById("grandText");
    els.budgetCount = document.getElementById("budgetCount");
    els.formTitle = document.getElementById("formTitle");
    els.budgetButtons = Array.from(document.querySelectorAll("[data-budget-type]"));
    els.priceAskInput = document.getElementById("priceAskInput");
    els.priceAskBudget = document.getElementById("priceAskBudget");
    els.priceAskBtn = document.getElementById("priceAskBtn");
    els.priceAskResult = document.getElementById("priceAskResult");
    els.priceAskChips = document.getElementById("priceAskChips");
    els.reloadAdminBtn = document.getElementById("reloadAdminBtn");
    els.adminUsers = document.getElementById("adminUsers");
    els.adminProjects = document.getElementById("adminProjects");
    els.adminAudit = document.getElementById("adminAudit");
  }

  function bindEvents() {
    els.t1?.addEventListener("click", () => switchTab(1));
    els.t2?.addEventListener("click", () => switchTab(2));
    if (els.t3) els.t3.addEventListener("click", () => switchTab(3));
    if (els.t4) els.t4.addEventListener("click", () => switchTab(4));
    if (els.t5) els.t5.addEventListener("click", () => switchTab(5));
    document.querySelectorAll("[data-tab-nav]").forEach(btn => {
      btn.addEventListener("click", () => switchTab(Number(btn.dataset.tabNav)));
    });
    els.pjName?.addEventListener("input", checkInput);
    els.scanBtn?.addEventListener("click", () => els.aiFile.click());
    els.aiFile?.addEventListener("change", event => handleAIUpload(event.target));
    els.saveProjectBtn?.addEventListener("click", confirmSave);
    els.reloadHistoryBtn?.addEventListener("click", () => {
      state.historyCache = null;
      fetchHistory();
    });
    els.histSearch?.addEventListener("input", filterHistory);
    els.histContent?.addEventListener("click", handleHistoryClick);
    els.reloadAdminBtn?.addEventListener("click", () => {
      state.adminCache = null;
      fetchAdminDashboard();
    });
    els.budgetButtons.forEach(button => {
      button.addEventListener("click", () => addBudget(button.dataset.budgetType));
    });

    els.budgetSpace.addEventListener("click", handleBudgetSpaceClick);
    els.budgetSpace.addEventListener("input", handleBudgetSpaceInput);

    if (els.priceAskBtn) {
      els.priceAskBtn.addEventListener("click", handlePriceAsk);
      els.priceAskInput?.addEventListener("keydown", event => {
        if (event.key === "Enter") handlePriceAsk();
      });
      els.priceAskChips?.addEventListener("click", event => {
        const chip = event.target.closest("[data-faq-id]");
        if (!chip || !els.priceAskInput) return;
        const faq = (appConfig.priceFaq || {})[chip.dataset.faqId];
        if (faq?.example) els.priceAskInput.value = faq.example;
        handlePriceAsk(chip.dataset.faqId);
      });
      els.priceAskResult?.addEventListener("click", event => {
        if (event.target.closest("[data-action='import-price-quote']")) {
          importPriceQuoteToBudget();
        }
        if (event.target.closest("[data-action='export-price-excel']")) {
          exportPriceAskExcel();
        }
        if (event.target.closest("[data-action='export-price-pdf']")) {
          exportPriceAskPdf();
        }
      });
    }
  }

  const MASTER_CACHE_KEY = "pea_master_cache_v1";

  function getMasterCacheTtlMs() {
    const ttl = Number(appConfig.masterDataCacheTtlMs);
    return Number.isFinite(ttl) && ttl > 0 ? ttl : 480000;
  }

  async function loadMasterData(force = false) {
    if (!force) {
      try {
        const cached = JSON.parse(sessionStorage.getItem(MASTER_CACHE_KEY) || "null");
        if (cached?.data && Date.now() - cached.savedAt < getMasterCacheTtlMs()) {
          state.dataStore = cached.data;
          return;
        }
      } catch (error) {
        console.warn("master cache read failed", error);
      }
    }

    try {
      state.dataStore = await window.ApiService.getMasterData();
      sessionStorage.setItem(MASTER_CACHE_KEY, JSON.stringify({
        data: state.dataStore,
        savedAt: Date.now()
      }));
    } catch (error) {
      state.dataStore = [];
      console.error(error);
      Swal.fire(
        "ไม่สามารถโหลดข้อมูลหลักได้",
        error.message || "กรุณาตรวจสอบ API backend ของ GAS",
        "error"
      );
    }
  }

  function checkInput() {
    const ready = els.pjName.value.trim().length > 0;
    els.budgetButtons.forEach(button => {
      button.disabled = !ready;
    });
    els.aiSection.classList.toggle("hidden", !ready);
  }

  async function handlePriceAsk(faqId = null) {
    if (!window.PriceQuoteEngine) {
      Swal.fire("ระบบไม่พร้อม", "ไม่พบ PriceQuoteEngine", "error");
      return;
    }

    const query = els.priceAskInput?.value.trim() || "";
    const budgetType = els.priceAskBudget?.value || "01.1";

    if (!query && !faqId) {
      Swal.fire("พิมพ์คำถาม", "เลือกคำถามที่พบบ่อย หรือพิมพ์ เช่น หม้อแปลง 100 kVA กี่บาท", "info");
      return;
    }

    if (!state.dataStore.length) {
      await loadMasterData();
    }
    if (!state.dataStore.length) {
      Swal.fire("ไม่มี master data", "โหลดราคาพัสดุไม่สำเร็จ", "error");
      return;
    }

    els.priceAskBtn.disabled = true;
    els.priceAskResult.classList.remove("hidden");
    els.priceAskResult.innerHTML = `<div class="price-ask-loading">กำลังคำนวณราคา...</div>`;

    let intent = null;
    let parseSource = "faq";

    if (faqId) {
      intent = window.PriceQuoteEngine.buildIntentFromFaq(faqId, budgetType);
    }
    if (!intent && query) {
      intent = window.PriceQuoteEngine.matchFaqByQuery(query, budgetType);
    }
    if (!intent && query) {
      intent = window.PriceQuoteEngine.parseQueryLocal(query, budgetType);
      parseSource = "local";
    }

    if (intent && query) {
      intent = window.PriceQuoteEngine.sanitizeIntent(intent, query);
    }

    const useGemini = appConfig.priceAskUseGemini === true
      && window.AuthSession?.canUseAiAsk?.() !== false;
    if (useGemini && query && !intent) {
      try {
        const aiResponse = await window.ApiService.parsePriceQuery(query, budgetType);
        if (!aiResponse.error) {
          intent = window.PriceQuoteEngine.sanitizeIntent(aiResponse.intent || aiResponse, query);
          parseSource = aiResponse.source === "gemini-lite" ? "gemini-lite" : "gemini";
        }
      } catch (error) {
        console.warn("Price AI optional fallback:", error);
      }
    }

    if (!intent) {
      els.priceAskResult.innerHTML = `
        <div class="price-ask-error">
          <strong>ไม่เข้าใจคำถาม</strong>
          <p>ลองเลือกจาก「คำถามที่พบบ่อย」ด้านล่าง หรือระบุ kVA / รหัสพัสดุให้ชัด เช่น 「หม้อแปลง 100 kVA」</p>
        </div>
      `;
      els.priceAskBtn.disabled = false;
      return;
    }

    let quote = window.PriceQuoteEngine.buildQuote(intent, state.dataStore);

    if (!quote.ok && quote.needsClarification && quote.clarificationType === "pole_run") {
      const clarifiedIntent = await promptPriceClarification(quote.intent, quote.question, "pole_run");
      if (clarifiedIntent) {
        intent = clarifiedIntent;
        quote = window.PriceQuoteEngine.buildQuote(intent, state.dataStore);
      }
    }

    if (!quote.ok && quote.needsClarification && quote.clarificationType === "tr_install") {
      const clarifiedIntent = await promptPriceClarification(quote.intent, quote.question, "tr_install");
      if (clarifiedIntent) {
        intent = clarifiedIntent;
        quote = window.PriceQuoteEngine.buildQuote(intent, state.dataStore);
      }
    }

    lastPriceQuote = quote;
    renderPriceAskResult(quote, parseSource);
    els.priceAskBtn.disabled = false;
  }

  async function promptPriceClarification(intent, question, type) {
    const fields = type === "tr_install"
      ? (window.PriceQuoteEngine.buildTrClarificationFields?.(intent) || intent.clarificationFields || [])
      : (window.PriceQuotePole?.buildClarificationFields?.(intent) || intent.clarificationFields || []);

    if (!fields.length) {
      if (type === "tr_install") {
        return window.PriceQuoteEngine.mergeTrIntent(intent, {});
      }
      return window.PriceQuoteEngine.mergePoleIntent(intent, {});
    }

    const fieldHtml = fields.map(field => {
      const options = (field.options || []).map(opt => `
        <option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>
      `).join("");
      return `
        <label class="price-clarify-field">
          <span>${escapeHtml(field.label)}</span>
          <select id="price-clarify-${escapeHtml(field.key)}" class="price-clarify-select">
            <option value="">— เลือก —</option>
            ${options}
          </select>
        </label>
      `;
    }).join("");

    const result = await Swal.fire({
      title: type === "tr_install" ? "ระบุหม้อแปลง" : "ระบุรายละเอียดงานเสา",
      html: `
        <p class="price-clarify-intro">${escapeHtml(question || "")}</p>
        <div class="price-clarify-form">${fieldHtml}</div>
      `,
      showCancelButton: true,
      confirmButtonText: "คำนวณราคา",
      cancelButtonText: "ยกเลิก",
      focusConfirm: false,
      preConfirm: () => {
        const answers = {};
        for (const field of fields) {
          const el = document.getElementById(`price-clarify-${field.key}`);
          const value = el?.value || "";
          if (!value) {
            Swal.showValidationMessage(`กรุณาเลือก: ${field.label}`);
            return false;
          }
          answers[field.key] = field.key === "kva" ? Number(value) : value;
        }
        return answers;
      }
    });

    if (!result.isConfirmed || !result.value) return null;
    if (type === "tr_install") {
      return window.PriceQuoteEngine.mergeTrIntent(intent, result.value);
    }
    return window.PriceQuoteEngine.mergePoleIntent(intent, result.value);
  }

  async function promptPoleClarification(intent, question) {
    return promptPriceClarification(intent, question, "pole_run");
  }

  function formatBudgetAmount(value) {
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function renderBudgetBreakdownRowsHtml(totals, budgetType, options = {}) {
    const type = window.BudgetFormula.normalizeBudgetType(budgetType);
    const rowClass = options.rowClass || "calc-row";
    const rows = [
      ["พัสดุ", totals.material],
      ["แรง", totals.labor],
      ["คุมงาน 30%", totals.supervision],
      ["ขนส่ง 5%", totals.transport],
      ["\u0e40\u0e1a\u0e2d\u0e40\u0e34\u0e25\u0e32\u0e34 5%", totals.misc],
      ["ดำเนินการ 5%", totals.overhead]
    ];
    if (type === "02.2") {
      rows.push(["กำไร 30%", totals.profit]);
    }

    const body = rows.map(([label, amount]) => `
      <div class="${rowClass}">
        <span>${label}</span>
        <span>${formatBudgetAmount(amount)}</span>
      </div>
    `).join("");

    if (!options.showTotal) return body;

    return `
      ${body}
      <div class="total-row">
        <span>สุทธิ (${type})</span>
        <span>${formatBudgetAmount(totals.total)}</span>
      </div>
    `;
  }

  function enrichDetailLineWithMaster(detail) {
    const idKey = String(detail.id || "").trim();
    const master = state.dataStore.find(item => String(item.id).trim() === idKey);
    return {
      ...detail,
      matPrice: master?.matPrice || 0,
      labPrice: parseFloat(detail.labPrice) || master?.labPrice || 0,
      qty: parseFloat(detail.qty) || 0
    };
  }

  function buildSavedBudgetBreakdownHtml(details) {
    const grouped = {};
    (details || []).forEach(detail => {
      const type = window.BudgetFormula.normalizeBudgetType(detail.type);
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(enrichDetailLineWithMaster(detail));
    });

    const blocks = Object.entries(grouped).map(([type, items]) => {
      const totals = window.BudgetFormula.computeBudgetTotalsFromItems(items, type);
      return `
        <div class="detail-budget-block">
          <div class="detail-budget-title">สรุปงบ ${type}</div>
          ${renderBudgetBreakdownRowsHtml(totals, type, { showTotal: true })}
        </div>
      `;
    });

    return blocks.length
      ? `<div class="detail-budget-wrap">${blocks.join("")}</div>`
      : "";
  }

  function formatPriceAskSource(parseSource) {
    if (parseSource === "faq") return "คู่มือ";
    if (parseSource === "gemini-lite") return "AI 3.1 Lite";
    if (parseSource === "gemini") return "AI 2.5";
    return "ระบบ";
  }

  function renderBudgetVerdictBundle(bundle) {
    if (!bundle) return "";
    if (bundle.type === "budget_capacity" && bundle.targetDistanceM) {
      const cls = bundle.budgetVerdict === "short" ? " price-ask-verdict-short" : " price-ask-verdict-ok";
      if (bundle.budgetVerdict === "enough") {
        return `<div class="price-ask-bundle${cls}">✓ งบพอ: ระยะ ${bundle.targetDistanceM} ม. (~${Math.round(bundle.targetTotal).toLocaleString()} บาท) · เหลือ ~${Math.round(bundle.budgetDelta).toLocaleString()} บาท</div>`;
      }
      const maxNote = bundle.maxDistanceM
        ? ` · ขยายได้สูงสุด ~${bundle.maxDistanceM} ม.`
        : "";
      return `<div class="price-ask-bundle${cls}">✗ งบไม่พอ: ระยะ ${bundle.targetDistanceM} ม. (~${Math.round(bundle.targetTotal).toLocaleString()} บาท) · ขาด ~${Math.round(-bundle.budgetDelta).toLocaleString()} บาท${maxNote}</div>`;
    }
    if (bundle.type === "budget_capacity") {
      return `<div class="price-ask-bundle">งบ ${Number(bundle.budgetBaht).toLocaleString()} บาท → ขยายได้ ~${bundle.maxDistanceM} ม. · ${bundle.poleCount} ต้น</div>`;
    }
    if (bundle.type === "tr_budget_check") {
      const cls = bundle.budgetVerdict === "short" ? " price-ask-verdict-short" : " price-ask-verdict-ok";
      const label = `หม้อแปลง ${bundle.kva} kVA ${String(bundle.phase || "").toUpperCase()}`;
      if (bundle.budgetVerdict === "enough") {
        return `<div class="price-ask-bundle${cls}">✓ งบพอ: ${label} (~${Math.round(bundle.targetTotal).toLocaleString()} บาท) · เหลือ ~${Math.round(bundle.budgetDelta).toLocaleString()} บาท</div>`;
      }
      return `<div class="price-ask-bundle${cls}">✗ งบไม่พอ: ${label} (~${Math.round(bundle.targetTotal).toLocaleString()} บาท) · ขาด ~${Math.round(-bundle.budgetDelta).toLocaleString()} บาท</div>`;
    }
    return "";
  }

  function renderPriceAskResult(quote, parseSource) {
    if (!els.priceAskResult) return;

    if (!quote.ok) {
      const clarifyHint = quote.clarificationType === "pole_run"
        ? `<p class="price-ask-clarify-hint">ระบบต้องการข้อมูลเพิ่ม — ลองถามใหม่หรือระบุ MV/LV, 1P/3P ในประโยคเดียว</p>`
        : (quote.clarificationType === "tr_install"
          ? `<p class="price-ask-clarify-hint">ระบุ kVA ในประโยค เช่น 「ติดตั้งหม้อแปลง 50 kVA」หรือเลือกจากคำถามที่พบบ่อย</p>`
          : "");
      els.priceAskResult.innerHTML = `
        <div class="price-ask-error">
          <div class="price-ask-summary-top">
            <span class="price-ask-source">${formatPriceAskSource(parseSource)} · งบ ${escapeHtml(quote.intent?.budgetType || els.priceAskBudget?.value || "01.1")}</span>
          </div>
          <strong>ยังประมาณราคาไม่ได้</strong>
          <p>${escapeHtml(quote.question || quote.error || "ลองระบุ kVA / รหัสพัสดุ / ประเภทงานให้ชัดขึ้น")}</p>
          ${clarifyHint}
        </div>
      `;
      return;
    }

    const bundleNote = renderBudgetVerdictBundle(quote.bundle)
      || (quote.bundle?.trSetName
      ? `<div class="price-ask-bundle">ชุดติดตั้ง: ${escapeHtml(quote.bundle.trSetId)} — ${escapeHtml(quote.bundle.trSetName)}${
          quote.bundle.poleMaterialId
            ? ` · เสา ${escapeHtml(quote.bundle.poleMaterialId)} × ${quote.bundle.poleQty || 1} ต้น (12.20 ม.)`
            : ""
        }</div>`
      : (quote.bundle?.type === "pole_run"
        ? `<div class="price-ask-bundle">${
            quote.bundle.distanceM
              ? `ระยะ ${quote.bundle.distanceM} ม. · ${quote.bundle.poleCount} ต้น (${quote.bundle.straightCount} ตรง${quote.bundle.curveCount ? ` + ${quote.bundle.curveCount} โค้ง` : ""} + ${quote.bundle.endCount} ปลายทาง)`
              : `เสา ${quote.bundle.poleHeightM} ม. · ${quote.bundle.poleCount} ต้น · ${quote.bundle.straightCount} ทางตรง + ${quote.bundle.endCount} ต้นสุดท้าย`
          }</div>`
        : ""));

    const poleBreakdownHtml = Array.isArray(quote.poleBreakdown) && quote.poleBreakdown.length
      ? `<ul class="price-ask-pole-breakdown">${quote.poleBreakdown.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
      : "";

    const lineRows = quote.lines.map(line => `
      <tr>
        <td>${escapeHtml(line.materialId)}</td>
        <td>${escapeHtml(line.name)}</td>
        <td class="num">${line.qty}</td>
        <td class="num">${line.lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join("");

    els.priceAskResult.innerHTML = `
      <div id="priceAskExportRoot" class="price-ask-export-root">
      <div class="price-ask-summary">
        <div class="price-ask-summary-top">
          <span class="price-ask-source">${formatPriceAskSource(parseSource)} · งบ ${escapeHtml(quote.budgetType)}</span>
          <span class="price-ask-total">${quote.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
        </div>
        <p class="price-ask-query">${escapeHtml(quote.query || "")}</p>
        ${bundleNote}
        ${poleBreakdownHtml}
      </div>
      <div class="price-ask-breakdown calc-box">
        ${renderBudgetBreakdownRowsHtml(quote.breakdown, quote.budgetType)}
      </div>
      <div class="price-ask-table-wrap">
        <table class="price-ask-table">
          <thead>
            <tr><th>รหัส</th><th>รายการ</th><th>จำนวน</th><th>รวม</th></tr>
          </thead>
          <tbody>${lineRows}</tbody>
        </table>
      </div>
      <p class="price-ask-disclaimer">${escapeHtml(quote.disclaimer)}</p>
      </div>
      <div class="price-ask-actions">
        <button class="ghost-btn" type="button" data-action="export-price-excel">Export Excel</button>
        <button class="ghost-btn" type="button" data-action="export-price-pdf">Export PDF</button>
        <button class="primary-btn price-ask-import" type="button" data-action="import-price-quote">เพิ่มเข้างบประมาณการ</button>
      </div>
    `;
  }

  function exportPriceAskExcel() {
    const quote = lastPriceQuote;
    if (!quote?.ok || !quote.lines?.length) return;

    const rows = quote.lines.map((line, index) => ({
      "ลำดับ": index + 1,
      "รหัสพัสดุ": line.materialId,
      "รายการ": line.name,
      "จำนวน": line.qty,
      "รวม": line.lineTotal
    }));

    rows.push({
      "ลำดับ": "",
      "รหัสพัสดุ": "",
      "รายการ": "รวมทั้งสิ้น",
      "จำนวน": "",
      "รวม": quote.total
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PriceAsk");
    const safeName = (quote.query || "price_ask").slice(0, 40).replace(/[\\/:*?"<>|]/g, "_");
    XLSX.writeFile(wb, `ถามราคา_${safeName}.xlsx`);
  }

  function buildPriceAskPrintHtml(quote) {
    const lineRows = quote.lines.map((line, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(line.materialId)}</td>
        <td>${escapeHtml(line.name)}</td>
        <td style="text-align:right">${line.qty}</td>
        <td style="text-align:right">${line.lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join("");

    return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>ถามราคา</title>
      <style>
        body { font-family: Sarabun, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 20px; margin: 0 0 8px; }
        .meta { color: #444; font-size: 13px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; vertical-align: top; }
        th { background: #f3f3f3; }
        .total { margin-top: 12px; font-size: 16px; font-weight: 700; text-align: right; }
      </style></head><body>
      <h1>ผลการถามราคา</h1>
      <div class="meta">งบ ${escapeHtml(quote.budgetType)} · ${escapeHtml(quote.query || "")}</div>
      <table>
        <thead><tr><th>#</th><th>รหัส</th><th>รายการ</th><th>จำนวน</th><th>รวม</th></tr></thead>
        <tbody>${lineRows}</tbody>
      </table>
      <div class="total">รวม ${quote.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</div>
      </body></html>`;
  }

  function exportPriceAskPdf() {
    const quote = lastPriceQuote;
    if (!quote?.ok || !quote.lines?.length) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      Swal.fire("ไม่สามารถเปิดหน้าพิมพ์", "อนุญาต pop-up แล้วลองใหม่", "warning");
      return;
    }

    printWindow.document.write(buildPriceAskPrintHtml(quote));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 350);
  }

  async function importPriceQuoteToBudget() {
    const quote = lastPriceQuote;
    if (!quote?.ok || !quote.lines?.length) return;

    if (!els.pjName.value.trim()) {
      const ready = await ensureProjectNameForBudget();
      if (!ready) return;
    }

    let budgetIndex = state.budgets.findIndex(b => b.type === quote.budgetType);
    if (budgetIndex < 0) {
      addBudget(quote.budgetType);
      budgetIndex = state.budgets.length - 1;
    }

    quote.lines.forEach(line => {
      state.budgets[budgetIndex].items.push({
        id: line.materialId,
        name: line.name,
        qty: line.qty,
        matPrice: line.matPrice,
        labPrice: line.labPrice,
        laborDesc: line.laborDesc,
        total: line.lineTotal
      });
    });

    render();
    resetPriceAskDraft();
    switchTab(1);
    Swal.fire(
      "เพิ่มเข้างบแล้ว",
      `นำ ${quote.lines.length} รายการเข้างบ ${quote.budgetType} เรียบร้อย`,
      "success"
    );
  }

  function hasCreateJobDraft() {
    if (els.pjName?.value.trim()) return true;
    if (state.budgets.some(budget => budget.items.length > 0)) return true;
    if (state.tempFileList?.length) return true;
    if (state.aiReviewQueue?.length) return true;
    return false;
  }

  function hasPriceAskDraft() {
    if (lastPriceQuote?.ok) return true;
    if (els.priceAskInput?.value.trim()) return true;
    return false;
  }

  function resetCreateJobDraft() {
    state.budgets = [];
    state.currentJobId = null;
    state.currentFileUrl = "";
    state.tempFileList = [];
    state.aiReviewQueue = [];
    if (els.pjName) els.pjName.value = "";
    if (els.formTitle) els.formTitle.innerText = "Your Project";
    render();
    checkInput();
  }

  function resetPriceAskDraft() {
    lastPriceQuote = null;
    if (els.priceAskInput) els.priceAskInput.value = "";
    if (els.priceAskResult) {
      els.priceAskResult.classList.add("hidden");
      els.priceAskResult.innerHTML = "";
    }
  }

  async function confirmLeaveCreateTab() {
    if (!hasCreateJobDraft()) return true;

    const { isConfirmed } = await Swal.fire({
      title: "ออกจากหน้าสร้างงาน?",
      text: "ยังมีข้อมูลที่กรอกไว้ — ออกจากหน้านี้จะไม่บันทึกรายการงบและไฟล์ที่แนบ",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ออก (ไม่บันทึก)",
      cancelButtonText: "อยู่ต่อ"
    });

    if (!isConfirmed) return false;
    resetCreateJobDraft();
    return true;
  }

  async function confirmLeavePriceAskTab() {
    if (!hasPriceAskDraft()) return true;

    const { isConfirmed } = await Swal.fire({
      title: "ออกจากหน้าถามราคา?",
      text: "ยังมีคำถามหรือผลลัพธ์ราคาที่ยังไม่ได้นำเข้างบ — ออกจากหน้านี้จะล้างผลลัพธ์",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ออก (ล้างผลลัพธ์)",
      cancelButtonText: "อยู่ต่อ"
    });

    if (!isConfirmed) return false;
    resetPriceAskDraft();
    return true;
  }

  async function switchTab(n) {
    if (window.AuthSession && !window.AuthSession.canAccessTab(n)) {
      Swal.fire("ไม่มีสิทธิ์", "บัญชีนี้ไม่สามารถเข้าแท็บนี้ได้", "warning");
      return;
    }

    const onSurvey = els.view3 && !els.view3.classList.contains("hidden");
    if (onSurvey && n !== 3 && window.SurveyModule?.confirmLeaveTab) {
      const ok = await window.SurveyModule.confirmLeaveTab();
      if (!ok) return;
    }

    const onCreate = !els.view1.classList.contains("hidden");
    if (onCreate && n !== 1) {
      const ok = await confirmLeaveCreateTab();
      if (!ok) return;
    }

    const onPriceAsk = els.view4 && !els.view4.classList.contains("hidden");
    if (onPriceAsk && n !== 4) {
      const ok = await confirmLeavePriceAskTab();
      if (!ok) return;
    }

    els.view1.classList.toggle("hidden", n !== 1);
    els.view2.classList.toggle("hidden", n !== 2);
    if (els.view3) els.view3.classList.toggle("hidden", n !== 3);
    if (els.view4) els.view4.classList.toggle("hidden", n !== 4);
    if (els.view5) els.view5.classList.toggle("hidden", n !== 5);
    els.t1.classList.toggle("active", n === 1);
    els.t2.classList.toggle("active", n === 2);
    if (els.t3) els.t3.classList.toggle("active", n === 3);
    if (els.t4) els.t4.classList.toggle("active", n === 4);
    if (els.t5) els.t5.classList.toggle("active", n === 5);
    document.querySelectorAll("[data-tab-nav]").forEach(btn => {
      btn.classList.toggle("is-active", Number(btn.dataset.tabNav) === n);
    });
    if (n === 2) fetchHistory();
    if (n === 5) fetchAdminDashboard();
    if (n !== 3) {
      document.body.classList.remove("survey-map-active");
    }
    window.scrollTo({ top: 0, behavior: "auto" });
    document.body.classList.remove("is-scroll-compact");

    if (n === 3 && window.SurveyModule) window.SurveyModule.onTabOpen();
  }

  const BUDGET_TYPE_OPTIONS = {
    "01.1": "งบ 01.1 (PEA 100%)",
    "02.1": "งบ 02.1 (CUS 100%)",
    "02.2": "งบ 02.2 (CUS 100%)",
    "03.1": "งบ 03.1 (PEA 50% + CUS 50%)"
  };

  async function ensureProjectNameForBudget() {
    if (els.pjName.value.trim()) return true;
    const { value, isDismissed } = await Swal.fire({
      title: "ชื่อโครงการ",
      text: "กรอกชื่อโครงการก่อนเพิ่มงบ",
      input: "text",
      inputPlaceholder: "ระบุชื่อโครงการ / สถานที่",
      showCancelButton: true,
      inputValidator: val => {
        if (!val || !val.trim()) return "กรุณากรอกชื่อโครงการ";
        return undefined;
      }
    });
    if (isDismissed || !value) return false;
    els.pjName.value = value.trim();
    checkInput();
    return true;
  }

  async function pickOrCreateBudgetIndex() {
    if (state.budgets.length === 1) return 0;

    if (state.budgets.length > 1) {
      const budgetOptions = {};
      state.budgets.forEach((budget, index) => { budgetOptions[index] = `งบ ${budget.type}`; });
      const { value: budgetIndex } = await Swal.fire({
        title: "เลือกงบที่จะนำเข้า",
        input: "select",
        inputOptions: budgetOptions,
        showCancelButton: true
      });
      if (budgetIndex === undefined) return null;
      return Number(budgetIndex);
    }

    const ready = await ensureProjectNameForBudget();
    if (!ready) return null;

    const { value: budgetType } = await Swal.fire({
      title: "สร้างงบใหม่",
      text: "ยังไม่มีงบในโครงการ — เลือกประเภทงบเพื่อเริ่มนำเข้ารายการ",
      input: "select",
      inputOptions: BUDGET_TYPE_OPTIONS,
      inputValue: "01.1",
      showCancelButton: true,
      confirmButtonText: "สร้างงบ"
    });
    if (!budgetType) return null;

    addBudget(budgetType);
    return state.budgets.length - 1;
  }

  function addBudget(type) {
    state.budgets.push({
      type: window.BudgetFormula.normalizeBudgetType(type),
      items: [],
      total: 0
    });
    render();
  }

  async function changeBudgetType(index) {
    const { value: newType } = await Swal.fire({
      title: "เปลี่ยนประเภทงบ",
      input: "select",
      inputOptions: {
        "01.1": "งบ 01.1",
        "02.1": "งบ 02.1",
        "02.2": "งบ 02.2",
        "03.1": "งบ 03.1"
      },
      inputValue: state.budgets[index].type,
      showCancelButton: true
    });

    if (newType) {
      state.budgets[index].type = window.BudgetFormula.normalizeBudgetType(newType);
      render();
    }
  }

  function render() {
    els.budgetSpace.innerHTML = state.budgets.map((budget, bIdx) => `
      <div class="budget-card">
        <div class="budget-top">
          <div>
            <div class="budget-code" data-action="change-type" data-budget-index="${bIdx}">BUDGET TYPE ${budget.type}</div>
            <p class="section-note" style="margin-top:6px;">แตะที่รหัสงบเพื่อเปลี่ยนประเภทได้ทันที</p>
          </div>
          <div class="budget-tools">
            <button class="mini-btn" type="button" data-action="duplicate-budget" data-budget-index="${bIdx}">คัดลอก</button>
            <button class="mini-btn" type="button" data-action="remove-budget" data-budget-index="${bIdx}" style="color:#ffd7df;border-color:rgba(255,107,138,0.22);">ลบ</button>
          </div>
        </div>

        <div class="budget-search">
          <div class="quick-pick-row">
            ${renderQuickPickButtons(bIdx)}
          </div>
          <input type="text" placeholder="ค้นหารหัสหรือชื่อพัสดุ..." data-search-input="${bIdx}">
          <div id="box-${bIdx}" class="res-box"></div>
        </div>

        <div class="item-list">
          ${budget.items.length ? budget.items.map((item, iIdx) => `
            <div class="item-row">
              <div class="item-main" data-action="edit-qty" data-budget-index="${bIdx}" data-item-index="${iIdx}">
                <div class="item-name">${item.name}</div>
                <div class="item-sub">
                  <span class="qty-chip">QTY ${formatQty(item.qty)}</span>
                  <span class="type-chip">${item.id}</span>
                  <span>${item.laborDesc || "ค่าแรงมาตรฐาน"}</span>
                </div>
              </div>
              <div class="item-total">
                ${Number(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span class="danger-link" data-action="remove-item" data-budget-index="${bIdx}" data-item-index="${iIdx}">ลบรายการ</span>
              </div>
            </div>
          `).join("") : `
            <div class="empty-state">
              <div>ยังไม่มีรายการในงบนี้</div>
              <div style="font-size:12px;">พิมพ์ค้นหาพัสดุหรือใช้ AI Scan เพื่อเพิ่มรายการได้ทันที</div>
            </div>
          `}
        </div>

        <div class="calc-box">${calcBudget(bIdx)}</div>
      </div>
    `).join("");

    updateGrandTotal();
  }

  function handleBudgetSpaceClick(event) {
    const actionEl = event.target.closest("[data-action]");
    if (actionEl) {
      const budgetIndex = Number(actionEl.dataset.budgetIndex);
      const itemIndex = actionEl.dataset.itemIndex !== undefined ? Number(actionEl.dataset.itemIndex) : null;

      switch (actionEl.dataset.action) {
        case "quick-pick":
          openQuickPicker(budgetIndex, actionEl.dataset.category);
          return;
        case "change-type":
          changeBudgetType(budgetIndex);
          return;
        case "duplicate-budget":
          duplicateBudget(budgetIndex);
          return;
        case "remove-budget":
          removeBudget(budgetIndex);
          return;
        case "edit-qty":
          editQty(budgetIndex, itemIndex);
          return;
        case "remove-item":
          removeItem(budgetIndex, itemIndex);
          return;
        default:
          break;
      }
    }

    const resultItem = event.target.closest(".res-item");
    if (resultItem) {
      const budgetIndex = Number(resultItem.dataset.budgetIndex);
      const item = JSON.parse(resultItem.dataset.item);
      hideAndAsk(budgetIndex, item);
    }
  }

  function handleBudgetSpaceInput(event) {
    const budgetIndex = event.target.dataset.searchInput;
    if (budgetIndex !== undefined) {
      findItems(event.target, Number(budgetIndex));
    }
  }

  function duplicateBudget(index) {
    const source = state.budgets[index];
    state.budgets.push({
      type: source.type,
      items: source.items.map(item => ({ ...item })),
      total: source.total
    });
    render();
  }

  function removeBudget(index) {
    state.budgets.splice(index, 1);
    render();
  }

  function removeItem(budgetIndex, itemIndex) {
    state.budgets[budgetIndex].items.splice(itemIndex, 1);
    render();
  }

  async function handleAIUpload(input) {
    if (!input.files.length) return;

    if (window.AuthSession && !window.AuthSession.canUseAiAsk()) {
      Swal.fire("ไม่มีสิทธิ์", "บัญชีนี้ไม่สามารถใช้ AI Scan ได้", "warning");
      input.value = "";
      return;
    }

    if (state.budgets.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "กรุณาเลือกประเภทงบก่อน",
        text: "เลือกงบอย่างน้อย 1 รายการก่อนเริ่มสแกน AI เพื่อให้ระบบจัดกลุ่มข้อมูลได้ถูกต้อง"
      });
      input.value = "";
      return;
    }

    const files = Array.from(input.files);
    const queueDraft = [];
    Swal.fire({
      title: "AI กำลังประมวลผล...",
      text: "ระบบกำลังอ่านรหัสวัสดุและจำนวนจากไฟล์ที่เลือกเพื่อเตรียมเข้า review queue",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    let processedCount = 0;

    for (const file of files) {
      const base64 = await readFileAsBase64(file);
      state.tempFileList.push({ base64, type: file.type });

      try {
        const aiItems = await window.ApiService.processImageAI(base64, file.type);
        if (Array.isArray(aiItems)) {
          for (const ai of aiItems) {
            queueDraft.push(buildQueueEntry(ai, file.name));
          }
        } else if (aiItems && aiItems.error) {
          Swal.fire("AI Scan มีปัญหา", aiItems.msg || "ไม่สามารถอ่านข้อมูลได้", "error");
        }
      } catch (error) {
        console.error(error);
        Swal.fire("AI Scan มีปัญหา", error.message || "ไม่สามารถอ่านข้อมูลได้", "error");
      } finally {
        processedCount++;
        if (processedCount === files.length) {
          Swal.close();
          state.aiReviewQueue = queueDraft;
          if (state.aiReviewQueue.length) {
            await openAIReviewQueue();
          } else {
            Swal.fire("ไม่พบรายการจาก AI", "ระบบไม่พบข้อมูลพัสดุที่นำไปตรวจต่อได้", "info");
          }
          render();
        }
      }
    }

    input.value = "";
  }

  function buildQueueEntry(ai, sourceName) {
    const rawId = String(ai.id || "").trim();
    const matchedItems = resolveAiCandidates(rawId);
    const selectedItem = matchedItems.length === 1 ? matchedItems[0] : null;

    return {
      rawId,
      qty: parseFloat(ai.qty) || 0,
      sourceName: sourceName || "",
      matchedItems,
      selectedItemId: selectedItem ? selectedItem.id : "",
      laborIndex: 0
    };
  }

  function resolveAiCandidates(rawId) {
    const matches = [];
    const seen = new Set();

    function pushMatch(item) {
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        matches.push(item);
      }
    }

    tokenizeAiId(rawId).forEach(token => {
      expandAiToken(token).forEach(candidateId => {
        pushMatch(state.dataStore.find(item => item.id === candidateId));
      });
    });

    return matches;
  }

  function tokenizeAiId(rawId) {
    return String(rawId || "")
      .replace(/\s+OR\s+/gi, " ")
      .replace(/\s+or\s+/g, " ")
      .replace(/[\/,]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  function expandAiToken(token) {
    const cleanToken = String(token || "").trim();
    if (!cleanToken) return [];

    if (!cleanToken.includes("-")) {
      return [cleanToken];
    }

    const rangeMatch = cleanToken.match(/^(\d+)-(\d+)$/);
    if (!rangeMatch) {
      return [cleanToken];
    }

    const startStr = rangeMatch[1];
    const endStr = rangeMatch[2];
    const startNum = parseInt(startStr, 10);
    if (Number.isNaN(startNum)) {
      return [cleanToken];
    }

    let endNum;
    if (endStr.length < startStr.length) {
      const prefix = startStr.slice(0, startStr.length - endStr.length);
      endNum = parseInt(prefix + endStr, 10);
    } else {
      endNum = parseInt(endStr, 10);
    }

    if (Number.isNaN(endNum) || endNum < startNum) {
      return [startStr];
    }

    const expanded = [];
    for (let current = startNum; current <= endNum; current++) {
      expanded.push(String(current));
    }
    return expanded;
  }

  async function openAIReviewQueue() {
    let keepEditing = true;

    while (keepEditing) {
      const { value, isConfirmed, dismiss } = await Swal.fire({
        title: "AI Review Queue",
        width: "96%",
        html: buildQueueReviewHtml(),
        confirmButtonText: "ยืนยันนำเข้า",
        cancelButtonText: "ยกเลิกทั้งหมด",
        showCancelButton: true,
        focusConfirm: false,
        didOpen: popup => {
          bindQueueEvents(popup);
        },
        preConfirm: () => validateQueueBeforeImport()
      });

      if (!isConfirmed) {
        if (dismiss === Swal.DismissReason.cancel) {
          state.aiReviewQueue = [];
        }
        return;
      }

      importQueueItems(value);
      state.aiReviewQueue = [];
      keepEditing = false;
      Swal.fire("นำเข้ารายการสำเร็จ", "ระบบเพิ่มรายการจาก AI review queue เรียบร้อยแล้ว", "success");
    }
  }

  function buildQueueReviewHtml() {
    return `
      <div class="queue-note">
        AI ช่วยอ่านเฉพาะรหัสพัสดุและจำนวน จากนั้นให้ผู้ใช้ตรวจและเลือกค่าแรงเองก่อนเพิ่มเข้า budget
      </div>
      <div class="queue-list">
        ${state.aiReviewQueue.map((entry, index) => {
          const selectedItem = getQueueSelectedItem(entry);
          const laborOptions = selectedItem ? selectedItem.laborOptions : [];

          return `
            <div class="queue-row">
              <div class="queue-topline">
                <div class="queue-badge">#${index + 1}</div>
                <div class="queue-source">${escapeHtml(entry.sourceName || "AI Scan")}</div>
              </div>
              <div class="queue-grid">
                <div class="queue-field">
                  <label>รหัสที่ AI อ่านได้</label>
                  <div class="queue-raw-id">${escapeHtml(entry.rawId || "-")}</div>
                </div>
                <div class="queue-field">
                  <label>พัสดุ</label>
                  <select class="queue-select" data-queue-role="item" data-queue-index="${index}">
                    <option value="">เลือกพัสดุ</option>
                    ${entry.matchedItems.map(item => `
                      <option value="${escapeHtml(item.id)}" ${entry.selectedItemId === item.id ? "selected" : ""}>
                        ${escapeHtml(item.id)} - ${escapeHtml(item.name)}
                      </option>
                    `).join("")}
                  </select>
                </div>
                <div class="queue-field">
                  <label>ค่าแรง</label>
                  <select class="queue-select" data-queue-role="labor" data-queue-index="${index}" ${selectedItem ? "" : "disabled"}>
                    ${laborOptions.length ? laborOptions.map((labor, laborIndex) => `
                      <option value="${laborIndex}" ${Number(entry.laborIndex) === laborIndex ? "selected" : ""}>
                        ${escapeHtml(labor.desc)} (แรง: ${formatMoney(labor.price)})
                      </option>
                    `).join("") : `<option value="">เลือกพัสดุก่อน</option>`}
                  </select>
                </div>
                <div class="queue-field">
                  <label>จำนวน</label>
                  <input class="queue-input" type="number" step="any" data-queue-role="qty" data-queue-index="${index}" value="${entry.qty}">
                </div>
                <div class="queue-field">
                  <label>เพิ่มเข้า budget</label>
                  <select class="queue-select" data-queue-role="budget" data-queue-index="${index}">
                    ${state.budgets.map((budget, budgetIndex) => `
                      <option value="${budgetIndex}" ${budgetIndex === state.budgets.length - 1 ? "selected" : ""}>
                        Budget ${budget.type}
                      </option>
                    `).join("")}
                  </select>
                </div>
              </div>
              ${selectedItem ? `<div class="queue-item-name">${escapeHtml(selectedItem.name)}</div>` : `<div class="queue-warning">ระบบยังจับคู่พัสดุไม่สำเร็จ กรุณาเลือกพัสดุก่อนนำเข้า</div>`}
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function bindQueueEvents(popup) {
    popup.querySelectorAll("[data-queue-role]").forEach(element => {
      element.addEventListener("change", handleQueueFieldChange);
      element.addEventListener("input", handleQueueFieldChange);
    });
  }

  function handleQueueFieldChange(event) {
    const index = Number(event.target.dataset.queueIndex);
    const role = event.target.dataset.queueRole;
    const entry = state.aiReviewQueue[index];
    if (!entry) return;

    if (role === "item") {
      entry.selectedItemId = event.target.value;
      entry.laborIndex = 0;
      rerenderQueueModal();
      return;
    }

    if (role === "labor") {
      entry.laborIndex = Number(event.target.value || 0);
      return;
    }

    if (role === "qty") {
      entry.qty = parseFloat(event.target.value) || 0;
      return;
    }

    if (role === "budget") {
      entry.targetBudgetIndex = Number(event.target.value || 0);
    }
  }

  function rerenderQueueModal() {
    const popup = Swal.getHtmlContainer();
    if (!popup) return;
    popup.innerHTML = buildQueueReviewHtml();
    bindQueueEvents(popup);
  }

  function validateQueueBeforeImport() {
    const prepared = state.aiReviewQueue.map(entry => {
      const selectedItem = getQueueSelectedItem(entry);
      if (!selectedItem) {
        Swal.showValidationMessage(`มีรายการที่ยังไม่ได้เลือกพัสดุ: ${entry.rawId || "-"}`);
        return null;
      }

      if (!Number.isFinite(entry.qty) || entry.qty < 0) {
        Swal.showValidationMessage(`จำนวนไม่ถูกต้องสำหรับพัสดุ ${selectedItem.id}`);
        return null;
      }

      const laborIndex = Number(entry.laborIndex) || 0;
      const labor = selectedItem.laborOptions[laborIndex];
      if (!labor) {
        Swal.showValidationMessage(`กรุณาเลือกค่าแรงสำหรับพัสดุ ${selectedItem.id}`);
        return null;
      }

      const targetBudgetIndex = Number.isInteger(entry.targetBudgetIndex) ? entry.targetBudgetIndex : state.budgets.length - 1;
      return {
        selectedItem,
        labor,
        qty: entry.qty,
        targetBudgetIndex
      };
    });

    if (prepared.some(item => !item)) {
      return false;
    }

    return prepared;
  }

  function importQueueItems(preparedItems) {
    preparedItems.forEach(({ selectedItem, labor, qty, targetBudgetIndex }) => {
      const budget = state.budgets[targetBudgetIndex];
      if (!budget) return;

      budget.items.push({
        ...selectedItem,
        qty,
        labPrice: labor.price,
        laborDesc: labor.desc,
        total: (selectedItem.matPrice + labor.price) * qty
      });
    });
    render();
  }

  function getQueueSelectedItem(entry) {
    return entry.matchedItems.find(item => item.id === entry.selectedItemId) || null;
  }

  function renderQuickPickButtons(budgetIndex) {
    const categories = appConfig.quickCategories || {};
    return Object.entries(categories).map(([key, category]) => `
      <button
        class="quick-pick-btn"
        type="button"
        data-action="quick-pick"
        data-budget-index="${budgetIndex}"
        data-category="${key}"
      >
        <span class="quick-pick-icon">${category.icon || "•"}</span>
        <span>${category.label}</span>
      </button>
    `).join("");
  }

  function filterByCategory(items, keywords) {
    const terms = (keywords || []).map(term => term.toLowerCase());
    return items.filter(item => {
      const hay = `${item.id} ${item.name}`.toLowerCase();
      return terms.some(term => hay.includes(term));
    });
  }

  function collectSetIdsFromObject(obj, bucket) {
    if (!obj || typeof obj !== "object") return;
    Object.entries(obj).forEach(([key, value]) => {
      if (key === "setIds" || key.endsWith("SetIds")) {
        (Array.isArray(value) ? value : []).forEach(id => bucket.add(String(id)));
      } else if (value && typeof value === "object") {
        collectSetIdsFromObject(value, bucket);
      }
    });
  }

  function getQuickPickSetItems(setSource) {
    const presets = window.SURVEY_PRESETS;
    const api = window.SurveyPresetsApi;
    if (!presets || !api) return [];

    const ids = new Set();
    if (setSource === "tr") {
      collectSetIdsFromObject(presets.trInstallCatalog, ids);
    } else {
      const voltage = setSource === "mv" ? "mv" : "lv";
      Object.values(presets.configs || {}).forEach(config => {
        if (config.voltage === voltage) collectSetIdsFromObject(config, ids);
      });
      Object.entries(presets.specialPoleRules || {}).forEach(([key, rules]) => {
        if (key.startsWith(voltage)) collectSetIdsFromObject(rules, ids);
      });
    }

    return [...ids]
      .map(id => api.getSet(id))
      .filter(Boolean)
      .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }))
      .map(set => ({ id: set.id, name: set.name, isSet: true }));
  }

  function resolveQuickPickItems(category) {
    if (category.setSource) return getQuickPickSetItems(category.setSource);
    if (Array.isArray(category.items) && category.items.length) return category.items;
    return filterByCategory(state.dataStore, category.keywords || []);
  }

  function findMasterItem(itemId) {
    const idKey = String(itemId).trim();
    return state.dataStore.find(item => String(item.id).trim() === idKey) || null;
  }

  async function addSetToBudget(budgetIndex, setEntry) {
    const setObj = window.SurveyPresetsApi?.getSet?.(setEntry.id)
      || window.SURVEY_PRESETS?.sets?.[String(setEntry.id)];
    if (!setObj?.items?.length) {
      Swal.fire("ไม่พบชุด SET", `ไม่พบรายการในชุด ${setEntry.id}`, "warning");
      return;
    }

    const { value: qty } = await Swal.fire({
      title: "จำนวนชุด SET",
      text: `${setObj.id} — ${setObj.name}`,
      input: "number",
      inputAttributes: { step: "any", min: "0.01" },
      inputValue: 1,
      showCancelButton: true
    });

    if (qty === undefined || qty === "") return;
    const multiplier = parseFloat(qty);
    if (!Number.isFinite(multiplier) || multiplier <= 0) return;

    const lines = window.SurveyPresetsApi?.expandTrSetItems?.(setObj.id, {})
      || setObj.items;
    let added = 0;
    const missing = [];

    lines.forEach(line => {
      const master = findMasterItem(line.id);
      if (!master) {
        missing.push(line.id);
        return;
      }
      const lineQty = (parseFloat(line.qty) || 1) * multiplier;
      const labor = master.laborOptions?.[0];
      state.budgets[budgetIndex].items.push({
        ...master,
        qty: lineQty,
        labPrice: labor?.price ?? master.labPrice,
        laborDesc: labor?.desc || "ค่าแรงมาตรฐาน",
        total: (master.matPrice + (labor?.price ?? master.labPrice)) * lineQty
      });
      added += 1;
    });

    if (added) {
      render();
      if (missing.length) {
        Swal.fire(
          "เพิ่มชุด SET แล้ว",
          `เพิ่ม ${added} รายการ — ไม่พบราคา master สำหรับ ${missing.length} รหัส`,
          "info"
        );
      }
      return;
    }

    Swal.fire(
      "ไม่สามารถเพิ่มชุด SET",
      missing.length
        ? `ไม่พบราคา master ของรหัส: ${missing.slice(0, 5).join(", ")}`
        : "ไม่มีรายการในชุดนี้",
      "warning"
    );
  }

  async function openQuickPicker(budgetIndex, categoryKey) {
    const category = (appConfig.quickCategories || {})[categoryKey];
    if (!category) return;

    const hits = resolveQuickPickItems(category);
    if (!hits.length) {
      Swal.fire(
        "ไม่พบรายการ",
        category.setSource
          ? `ไม่พบชุด SET หมวด "${category.label}" — ตรวจสอบว่าโหลด survey-presets.js แล้ว`
          : `ไม่พบพัสดุหมวด "${category.label}" ใน master data`,
        "info"
      );
      return;
    }

    const listHtml = `
      <div class="quick-pick-list">
        <input id="quickPickFilter" class="quick-pick-filter" placeholder="กรองรายการ ${category.label}...">
        <div id="quickPickResults" class="quick-pick-results">
          ${hits.slice(0, 120).map(item => `
            <button type="button" class="quick-pick-item" data-item-id="${escapeHtml(item.id)}" data-is-set="${item.isSet ? "1" : "0"}">
              <strong>${escapeHtml(item.id)}</strong>
              <span>${escapeHtml(item.name)}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `;

    await Swal.fire({
      title: `${category.icon || ""} เลือก${category.label}`,
      html: listHtml,
      width: "min(100%, 420px)",
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: () => {
        const popup = Swal.getPopup();
        const filterInput = popup.querySelector("#quickPickFilter");
        const resultsBox = popup.querySelector("#quickPickResults");
        const itemMap = new Map(hits.map(item => [item.id, item]));

        const handlePick = async item => {
          Swal.close();
          if (item.isSet) {
            await addSetToBudget(budgetIndex, item);
            return;
          }
          const master = findMasterItem(item.id);
          if (master) {
            hideAndAsk(budgetIndex, master);
            return;
          }
          Swal.fire(
            "ไม่พบราคา",
            `รหัส ${item.id} ยังไม่มีใน master data — ไม่สามารถคำนวณราคาได้`,
            "warning"
          );
        };

        popup.addEventListener("click", event => {
          const button = event.target.closest(".quick-pick-item");
          if (!button) return;
          const item = itemMap.get(button.dataset.itemId);
          if (item) handlePick(item);
        });

        filterInput.addEventListener("input", () => {
          const value = filterInput.value.trim().toLowerCase();
          const filtered = hits.filter(item => {
            const hay = `${item.id} ${item.name}`.toLowerCase();
            return !value || hay.includes(value);
          }).slice(0, 120);

          resultsBox.innerHTML = filtered.map(item => `
            <button type="button" class="quick-pick-item" data-item-id="${escapeHtml(item.id)}" data-is-set="${item.isSet ? "1" : "0"}">
              <strong>${escapeHtml(item.id)}</strong>
              <span>${escapeHtml(item.name)}</span>
            </button>
          `).join("") || `<div class="quick-pick-empty">ไม่พบรายการที่ตรงกับคำค้น</div>`;
        });
      }
    });
  }

  function findItems(input, budgetIndex) {
    const value = input.value.trim().toLowerCase();
    const box = document.getElementById(`box-${budgetIndex}`);

    if (value.length < 2) {
      box.style.display = "none";
      return;
    }

    const hits = state.dataStore.filter(item =>
      value.split(" ").every(term => `${item.id} ${item.name}`.toLowerCase().includes(term))
    );

    box.innerHTML = hits.slice(0, 100).map(item => `
      <div class="res-item" data-budget-index="${budgetIndex}" data-item='${escapeHtml(JSON.stringify(item))}'>
        <b>${item.id}</b><br>${item.name}
      </div>
    `).join("");
    box.style.display = "block";
  }

  async function hideAndAsk(budgetIndex, item, defaultQty = null) {
    document.querySelectorAll(".res-box").forEach(box => {
      box.style.display = "none";
    });

    let selectedLaborPrice = item.labPrice;
    let selectedLaborDesc = item.laborOptions[0].desc;

    if (item.laborOptions.length > 1) {
      const options = {};
      item.laborOptions.forEach((labor, index) => {
        options[index] = `${labor.desc} (แรง: ${labor.price})`;
      });

      const { value: laborIndex } = await Swal.fire({
        title: "เลือกลักษณะการติดตั้ง",
        text: item.name,
        input: "select",
        inputOptions: options,
        showCancelButton: true
      });

      if (laborIndex === undefined) return;
      selectedLaborPrice = item.laborOptions[laborIndex].price;
      selectedLaborDesc = item.laborOptions[laborIndex].desc;
    }

    const { value: qty } = await Swal.fire({
      title: "ระบุจำนวน",
      text: `${item.name} [${selectedLaborDesc}]`,
      input: "number",
      inputAttributes: { step: "any" },
      inputValue: defaultQty !== null ? defaultQty : 1,
      showCancelButton: true
    });

    if (qty !== undefined && qty !== "") {
      state.budgets[budgetIndex].items.push({
        ...item,
        qty: parseFloat(qty),
        labPrice: selectedLaborPrice,
        laborDesc: selectedLaborDesc,
        total: (item.matPrice + selectedLaborPrice) * parseFloat(qty)
      });
      render();
    }
  }

  function calcBudget(index) {
    const budget = state.budgets[index];
    budget.type = window.BudgetFormula.normalizeBudgetType(budget.type);
    const totals = window.BudgetFormula.computeBudgetTotalsFromItems(budget.items, budget.type);
    budget.total = totals.total;
    return renderBudgetBreakdownRowsHtml(totals, budget.type, { showTotal: true });
  }

  function updateGrandTotal() {
    const sum = state.budgets.reduce((acc, budget) => acc + budget.total, 0);
    els.grandText.innerText = `${sum.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท`;
    els.budgetCount.innerText = state.budgets.length;
    els.saveZone.classList.toggle("hidden", state.budgets.length === 0);
  }

  function confirmSave(options = {}) {
    return Swal.fire({
      title: "บันทึกโครงการ?",
      text: "ระบบจะบันทึกรายการงบ วัสดุ และไฟล์สแกนทั้งหมดของโครงการนี้",
      icon: "question",
      showCancelButton: true
    }).then(result => {
      if (result.isConfirmed) {
        return saveProject(options);
      }
      return false;
    });
  }

  async function saveProject(options = {}) {
    if (!els.pjName.value.trim()) {
      const ready = await ensureProjectNameForBudget();
      if (!ready) return false;
    }
    if (!state.budgets.length) {
      Swal.fire("ยังไม่มีรายการงบ", "สร้างรายการประมาณการก่อนบันทึกโครงการ", "info");
      return false;
    }

    Swal.fire({
      title: "กำลังบันทึก...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const payload = {
      projectId: state.currentJobId,
      pjName: els.pjName.value,
      budgets: state.budgets,
      grandTotal: state.budgets.reduce((acc, budget) => acc + budget.total, 0),
      fileList: state.tempFileList,
      existingImageUrl: state.currentFileUrl,
      surveyMeta: window.SurveyModule && window.SurveyModule.getSurveyMeta
        ? window.SurveyModule.getSurveyMeta()
        : null
    };

    try {
      const result = await window.ApiService.saveProject(payload);
      if (result?.status === "error") {
        throw new Error(result.msg || "บันทึกไม่สำเร็จ");
      }
      await Swal.fire("สำเร็จ", "บันทึกโครงการเรียบร้อย", "success");

      if (options.fromSurvey) {
        window.SurveyModule?.markProjectSaved?.();
        state.currentJobId = null;
        state.currentFileUrl = "";
        state.tempFileList = [];
        state.budgets = [];
        els.pjName.value = "";
        els.formTitle.innerText = "Project Control";
        state.historyCache = null;
        render();
        checkInput();
        window.SurveyModule?.resetSurvey?.();
        if (options.stayOnSurvey) {
          switchTab(3);
        } else {
          switchTab(2);
        }
        return true;
      }

      resetForm();
      return true;
    } catch (error) {
      console.error(error);
      Swal.fire("บันทึกไม่สำเร็จ", error.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล", "error");
      return false;
    }
  }

  function resetForm() {
    state.currentJobId = null;
    state.currentFileUrl = "";
    state.tempFileList = [];
    state.budgets = [];
    els.pjName.value = "";
    els.formTitle.innerText = "Project Control";
    if (window.SurveyModule && window.SurveyModule.resetSurvey) {
      window.SurveyModule.resetSurvey();
    }
    state.historyCache = null;
    render();
    checkInput();
    switchTab(2);
  }

  async function fetchHistory() {
    if (state.historyCache) {
      renderHistory(state.historyCache);
      return;
    }

    els.histContent.innerHTML = `
      <div class="empty-state">
        <div class="hero-orb empty-orb">SYNC</div>
        <div>กำลังโหลดข้อมูลประวัติโครงการ...</div>
      </div>
    `;

    try {
      state.historyCache = await window.ApiService.getSavedProjects();
      renderHistory(state.historyCache || []);
    } catch (error) {
      console.error(error);
      els.histContent.innerHTML = `
        <div class="empty-state">
          <div>ไม่สามารถโหลดประวัติโครงการได้</div>
          <div style="font-size:12px;">${escapeHtml(error.message || "กรุณาตรวจสอบการเชื่อมต่อ")}</div>
        </div>
      `;
    }
  }

  function parseHistoryShareFields(row) {
    const sharedView = String(row[7] || "");
    if (row.length >= 10) {
      return {
        sharedView,
        sharedEdit: String(row[8] || ""),
        isPublic: String(row[9] || "")
      };
    }
    return {
      sharedView,
      sharedEdit: "",
      isPublic: String(row[8] || "")
    };
  }

  function userInShareList(listValue, username) {
    const me = String(username || "").trim().toLowerCase();
    if (!me) return false;
    return String(listValue || "")
      .split(/[,;|/\s]+/)
      .map(part => part.trim().toLowerCase())
      .filter(Boolean)
      .includes(me);
  }

  function canManageHistoryProject(cached) {
    const me = window.AuthSession?.getUsername?.() || "";
    if (!me) return false;
    if (window.AuthSession?.isAdmin?.()) return true;
    if (cached?.createdBy && cached.createdBy === me) return true;
    return userInShareList(cached?.sharedEdit, me);
  }

  function canShareHistoryProject(cached) {
    const me = window.AuthSession?.getUsername?.() || "";
    if (!me) return false;
    if (window.AuthSession?.isAdmin?.()) return true;
    return cached?.createdBy === me;
  }

  function getHistoryAccessBadge(row, shareFields) {
    const me = window.AuthSession?.getUsername?.() || "";
    const createdBy = String(row[6] || "");
    const isPublic = /^(Y|YES|TRUE|1|ใช้งาน)$/i.test(String(shareFields.isPublic || ""));

    if (createdBy && createdBy === me) {
      return `<span class="history-badge history-badge-own">ของฉัน</span>`;
    }
    if (userInShareList(shareFields.sharedEdit, me)) {
      return `<span class="history-badge history-badge-edit">แชร์แก้ไข</span>`;
    }
    if (isPublic) {
      return `<span class="history-badge history-badge-public">สาธารณะ</span>`;
    }
    if (shareFields.sharedView || shareFields.sharedEdit) {
      return `<span class="history-badge history-badge-shared">แชร์ดู</span>`;
    }
    if (createdBy) {
      return `<span class="history-badge">${escapeHtml(createdBy)}</span>`;
    }
    return `<span class="history-badge">legacy</span>`;
  }

  function handleHistoryClick(event) {
    const shareBtn = event.target.closest("[data-action='share-project']");
    if (!shareBtn) return;
    askShare(shareBtn.dataset.projectId);
  }

  async function askShare(projectId) {
    const cached = state.historyRowCache[projectId] || {};
    if (!canShareHistoryProject(cached)) {
      Swal.fire("ไม่มีสิทธิ์", "เฉพาะเจ้าของโครงการเท่านั้นที่แชร์ได้", "warning");
      return;
    }

    const isPublic = /^(Y|YES|TRUE|1|ใช้งาน)$/i.test(String(cached.isPublic || ""));
    const html = `
      <div class="share-form">
        <label class="share-label" for="shareViewUsers">แชร์ดู (View) — คั่นด้วย comma</label>
        <input id="shareViewUsers" class="quick-pick-filter" value="${escapeHtml(cached.sharedView || "")}" placeholder="user1, user2">
        <label class="share-label" for="shareEditUsers">แชร์แก้ไข (Edit) — คั่นด้วย comma</label>
        <input id="shareEditUsers" class="quick-pick-filter" value="${escapeHtml(cached.sharedEdit || "")}" placeholder="user3, user4">
        <label class="share-check">
          <input id="sharePublic" type="checkbox" ${isPublic ? "checked" : ""}>
          เปิดให้ทุกคนในระบบเห็น (Public)
        </label>
      </div>
    `;

    const { isConfirmed } = await Swal.fire({
      title: "แชร์โครงการ",
      html,
      showCancelButton: true,
      confirmButtonText: "บันทึก",
      cancelButtonText: "ยกเลิก",
      preConfirm: () => {
        const popup = Swal.getPopup();
        return {
          sharedView: popup.querySelector("#shareViewUsers")?.value || "",
          sharedEdit: popup.querySelector("#shareEditUsers")?.value || "",
          isPublic: popup.querySelector("#sharePublic")?.checked === true
        };
      }
    });

    if (!isConfirmed) return;

    Swal.fire({
      title: "กำลังบันทึก...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const result = await window.ApiService.shareProject({
        projectId,
        sharedView: isConfirmed.sharedView,
        sharedEdit: isConfirmed.sharedEdit,
        isPublic: isConfirmed.isPublic
      });
      if (result.status !== "success") {
        throw new Error(result.msg || "แชร์ไม่สำเร็จ");
      }
      state.historyCache = null;
      await fetchHistory();
      Swal.fire("สำเร็จ", "อัปเดตการแชร์เรียบร้อย", "success");
    } catch (error) {
      Swal.fire("แชร์ไม่สำเร็จ", error.message || "เกิดข้อผิดพลาด", "error");
    }
  }

  function renderHistory(data) {
    state.historyRowCache = {};

    if (!data.length) {
      els.histContent.innerHTML = `
        <div class="empty-state">
          <div class="hero-orb empty-orb">ZERO</div>
          <div>ยังไม่มีประวัติโครงการ</div>
          <div style="font-size:12px;">เมื่อบันทึกโครงการแล้ว รายการจะมาแสดงที่หน้านี้อัตโนมัติ</div>
        </div>
      `;
      return;
    }

    els.histContent.innerHTML = data.map(row => {
      const dateDisplay = safeDateDisplay(row[1]);
      const projectId = String(row[0] || "");
      const shareFields = parseHistoryShareFields(row);
      state.historyRowCache[projectId] = {
        name: String(row[2] || ""),
        imgStr: String(row[4] || ""),
        surveyMetaStr: String(row[5] || ""),
        createdBy: String(row[6] || ""),
        sharedView: shareFields.sharedView,
        sharedEdit: shareFields.sharedEdit,
        isPublic: shareFields.isPublic
      };
      const cached = state.historyRowCache[projectId];
      const canManage = canManageHistoryProject(cached);
      const canShare = canShareHistoryProject(cached);
      const manageActions = canShare
        ? `<button class="action-btn" type="button" data-action="share-project" data-project-id="${escapeHtml(projectId)}">แชร์</button>`
        : "";
      const editActions = canManage
        ? `
              <button class="action-btn" type="button" onclick="window.AppActions.askEdit('${escapeJs(projectId)}')">แก้ไข</button>
              <button class="action-btn danger" type="button" onclick="window.AppActions.askDel('${escapeJs(projectId)}')">ลบ</button>
            `
        : "";
      return `
        <div class="history-card">
          <div class="history-top">
            <div style="min-width:0;">
              <h3 class="history-name">${escapeHtml(row[2])}</h3>
              <div class="history-meta">
                <span class="status-chip">${escapeHtml(dateDisplay)}</span>
                <span class="type-chip">ID ${escapeHtml(projectId)}</span>
                ${getHistoryAccessBadge(row, shareFields)}
              </div>
              <div class="history-amount">
                ${parseFloat(row[3] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
              </div>
            </div>
            <div class="history-actions">
              <button class="action-btn" type="button" onclick="window.AppActions.viewDetail('${escapeJs(projectId)}')">ดู</button>
              ${manageActions}
              ${editActions}
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  async function fetchAdminDashboard() {
    if (!window.AuthSession?.isAdmin?.()) return;

    if (state.adminCache) {
      renderAdminDashboard(state.adminCache);
      return;
    }

    const loadingHtml = `<div class="empty-state"><div>กำลังโหลด Admin Console...</div></div>`;
    if (els.adminUsers) els.adminUsers.innerHTML = loadingHtml;

    try {
      const data = await window.ApiService.getAdminDashboard();
      if (data?.error) throw new Error(data.msg || "โหลด admin ไม่สำเร็จ");
      state.adminCache = data;
      renderAdminDashboard(data);
    } catch (error) {
      console.error(error);
      const errHtml = `<div class="empty-state"><div>${escapeHtml(error.message || "โหลด admin ไม่สำเร็จ")}</div></div>`;
      if (els.adminUsers) els.adminUsers.innerHTML = errHtml;
    }
  }

  function renderAdminDashboard(data) {
    if (!els.adminUsers || !els.adminProjects || !els.adminAudit) return;

    const users = data.users || [];
    els.adminUsers.innerHTML = users.length
      ? `<table class="admin-table"><thead><tr><th>User</th><th>Role</th><th>Steps</th><th>Active</th><th>AI</th></tr></thead><tbody>${
          users.map(user => `
            <tr>
              <td>${escapeHtml(user.username)}</td>
              <td>${escapeHtml(user.role)}</td>
              <td>${escapeHtml((user.allowedSteps || []).join(","))}</td>
              <td>${user.active ? "Y" : "N"}</td>
              <td>${user.aiAsk ? "Y" : "N"}</td>
            </tr>
          `).join("")
        }</tbody></table>`
      : `<div class="empty-state">ไม่มีผู้ใช้ในชีต Config</div>`;

    const projects = data.projects || [];
    els.adminProjects.innerHTML = projects.length
      ? `<table class="admin-table"><thead><tr><th>ID</th><th>ชื่อ</th><th>เจ้าของ</th><th>View</th><th>Edit</th><th>Public</th><th>รวม</th></tr></thead><tbody>${
          projects.map(project => `
            <tr>
              <td>${escapeHtml(project.projectId)}</td>
              <td>${escapeHtml(project.name)}</td>
              <td>${escapeHtml(project.createdBy || "-")}</td>
              <td>${escapeHtml(project.sharedView || "-")}</td>
              <td>${escapeHtml(project.sharedEdit || "-")}</td>
              <td>${/^(Y|YES|TRUE|1)$/i.test(String(project.isPublic || "")) ? "Y" : "N"}</td>
              <td class="num">${parseFloat(project.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join("")
        }</tbody></table>`
      : `<div class="empty-state">ไม่มีโครงการ</div>`;

    const audit = data.audit || [];
    els.adminAudit.innerHTML = audit.length
      ? `<table class="admin-table"><thead><tr><th>เวลา</th><th>User</th><th>Action</th><th>Project</th><th>Detail</th></tr></thead><tbody>${
          audit.map(entry => `
            <tr>
              <td>${escapeHtml(safeDateDisplay(entry.timestamp))}</td>
              <td>${escapeHtml(entry.username)}</td>
              <td>${escapeHtml(entry.action)}</td>
              <td>${escapeHtml(entry.projectId)}</td>
              <td>${escapeHtml(entry.detail)}</td>
            </tr>
          `).join("")
        }</tbody></table>`
      : `<div class="empty-state">ยังไม่มี audit log</div>`;
  }

  function filterHistory() {
    const term = els.histSearch.value.toLowerCase();
    const cards = els.histContent.querySelectorAll(".history-card");
    cards.forEach(card => {
      const title = (card.querySelector(".history-name")?.innerText || "").toLowerCase();
      card.style.display = title.includes(term) ? "" : "none";
    });
  }

  async function viewDetail(id) {
    const cached = state.historyRowCache[id] || {};
    const name = cached.name || id;
    const imgStr = cached.imgStr || "";
    const surveyMetaStr = cached.surveyMetaStr || "";

    Swal.fire({
      title: "กำลังโหลด...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const details = await window.ApiService.getProjectDetails(id);
      if (details?.error) {
        Swal.fire("ไม่มีสิทธิ์", details.msg || "ไม่สามารถดูโครงการนี้ได้", "warning");
        return;
      }
      if (!Array.isArray(details) || !details.length) {
        Swal.fire("ไม่พบข้อมูล", "ไม่พบรายละเอียดพัสดุในโครงการนี้", "warning");
        return;
      }
      const urls = imgStr ? imgStr.split("|").filter(Boolean) : [];
      const previews = await fetchDrivePreviews(urls);
      const html = buildDetailHtml(details, imgStr, name, surveyMetaStr, previews);
      Swal.fire({
        title: name,
        html,
        width: window.innerWidth < 720 ? "94%" : "min(920px, 95%)",
        customClass: { popup: "pea-swal-popup swal-detail", htmlContainer: "pea-swal-body swal-detail-body" },
        confirmButtonText: "ปิด"
      });
    } catch (error) {
      console.error(error);
      Swal.fire("โหลดข้อมูลไม่สำเร็จ", error.message || "เกิดข้อผิดพลาด", "error");
    }
  }

  function extractDriveFileId(url) {
    const match = String(url || "").match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  function normalizeDriveViewUrl(url) {
    const fileId = extractDriveFileId(url);
    if (!fileId) return String(url || "");
    return `https://drive.google.com/file/d/${fileId}/view`;
  }

  function buildDriveThumbnailUrl(fileId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1200`;
  }

  function buildDriveDirectImageUrl(fileId) {
    return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
  }

  async function fetchDrivePreviews(urls) {
    const fileIds = [...new Set(
      (urls || []).map(extractDriveFileId).filter(Boolean)
    )];
    if (!fileIds.length || !window.ApiService.getDriveFilePreviews) {
      return {};
    }

    try {
      const previews = await window.ApiService.getDriveFilePreviews(fileIds);
      return previews && typeof previews === "object" ? previews : {};
    } catch (error) {
      console.warn("drive previews failed", error);
      return {};
    }
  }

  function buildMediaItemHtml(url, label, preview) {
    const fileId = extractDriveFileId(url);
    const viewUrl = (preview && preview.viewUrl) || normalizeDriveViewUrl(url);
    const safeLabel = escapeHtml(label);
    const safeViewUrl = escapeHtml(viewUrl);
    const fileName = preview && preview.name ? String(preview.name) : "";
    const isSurveyMap = /Survey_Map/i.test(fileName) || /Survey_Map/i.test(label);

    if (preview && preview.base64 && preview.mime && preview.mime.indexOf("image/") === 0) {
      const dataUrl = `data:${preview.mime};base64,${preview.base64}`;
      return `
        <div class="media-item">
          <p class="media-item-label">${isSurveyMap ? "แผนที่สำรวจ (ปักหมุด)" : safeLabel}</p>
          <a href="${safeViewUrl}" target="_blank" rel="noopener noreferrer" class="media-preview-link">
            <img class="media-preview-img" src="${dataUrl}" alt="${safeLabel}">
          </a>
          <div class="media-item-actions">
            <a href="${safeViewUrl}" target="_blank" rel="noopener noreferrer" class="media-open-link">เปิดแยกใน Drive</a>
          </div>
        </div>
      `;
    }

    if (preview && preview.mime === "application/pdf") {
      return `
        <div class="media-item">
          <p class="media-item-label">${safeLabel}</p>
          <div class="media-fallback is-visible">
            <p>ไฟล์ PDF — แตะเพื่อเปิดดู</p>
            <a href="${safeViewUrl}" target="_blank" rel="noopener noreferrer" class="media-open-link">เปิด PDF ใน Google Drive</a>
          </div>
        </div>
      `;
    }

    if (preview && preview.tooLarge) {
      return `
        <div class="media-item">
          <p class="media-item-label">${safeLabel}</p>
          <div class="media-fallback is-visible">
            <p>ไฟล์มีขนาดใหญ่ — เปิดดูใน Google Drive</p>
            <a href="${safeViewUrl}" target="_blank" rel="noopener noreferrer" class="media-open-link">เปิดใน Google Drive</a>
          </div>
        </div>
      `;
    }

    if (!fileId) {
      return `
        <div class="media-item">
          <p class="media-item-label">${safeLabel}</p>
          <a href="${safeViewUrl}" target="_blank" rel="noopener noreferrer" class="media-open-link">เปิดไฟล์</a>
        </div>
      `;
    }

    const thumbUrl = escapeHtml(buildDriveThumbnailUrl(fileId));
    const directUrl = escapeHtml(buildDriveDirectImageUrl(fileId));

    return `
      <div class="media-item">
        <p class="media-item-label">${safeLabel}</p>
        <div class="media-preview-wrap">
          <a href="${safeViewUrl}" target="_blank" rel="noopener noreferrer" class="media-preview-link">
            <img
              class="media-preview-img"
              src="${thumbUrl}"
              alt="${safeLabel}"
              loading="lazy"
              onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='${directUrl}';}else{this.closest('.media-preview-wrap').classList.add('has-fallback');}"
            >
          </a>
          <div class="media-fallback">
            <p>ไม่สามารถแสดงตัวอย่างบนอุปกรณ์นี้ได้</p>
            <a href="${safeViewUrl}" target="_blank" rel="noopener noreferrer" class="media-open-link">เปิดใน Google Drive</a>
          </div>
        </div>
        <div class="media-item-actions">
          <a href="${safeViewUrl}" target="_blank" rel="noopener noreferrer" class="media-open-link">เปิดแยกใน Drive</a>
        </div>
      </div>
    `;
  }

  function buildSurveyMetaDetailHtml(meta) {
    if (!meta || meta.startLat == null) return "";

    const poleCount = meta.poleCount ?? "-";
    const totalDistanceM = meta.totalDistanceM ?? "-";
    const spanM = meta.spanM
      ?? meta.segments?.find(seg => seg.spanM)?.spanM
      ?? "-";
    const startLabel = meta.startLabel || "หมุด 0";
    const endLabel = meta.endLabel || (poleCount !== "-" ? `หมุด ${Math.max(0, Number(poleCount) - 1)}` : "-");

    return `
      <div class="survey-meta-box">
        <strong>ข้อมูลเส้นทางสำรวจ</strong><br>
        จุดเริ่ม (${escapeHtml(startLabel)}): ${Number(meta.startLat).toFixed(6)}, ${Number(meta.startLng).toFixed(6)}<br>
        จุดสิ้นสุด (${escapeHtml(endLabel)}): ${Number(meta.endLat).toFixed(6)}, ${Number(meta.endLng).toFixed(6)}<br>
        หมุดทั้งหมด: ${poleCount} | ระยะรวม: ${totalDistanceM} ม. | Span: ${spanM} ม.
      </div>
    `;
  }

  function buildDetailHtml(details, imgStr, name, surveyMetaStr, previews) {
    let surveyMetaHtml = "";
    if (surveyMetaStr) {
      try {
        const meta = JSON.parse(surveyMetaStr);
        surveyMetaHtml = buildSurveyMetaDetailHtml(meta);
      } catch (error) {
        console.warn("survey meta parse failed", error);
      }
    }

    const urls = imgStr ? imgStr.split("|") : [];
    const sortedUrls = [...urls].sort((a, b) => {
      const aMap = /Survey_Map/i.test(a);
      const bMap = /Survey_Map/i.test(b);
      if (aMap && !bMap) return -1;
      if (!aMap && bMap) return 1;
      return 0;
    });
    let mediaHtml = '<div class="media-gallery">';

    if (!sortedUrls.length) {
      mediaHtml += "<p>ไม่มีไฟล์แนบ</p>";
    } else {
      sortedUrls.forEach((url, index) => {
        const fileId = extractDriveFileId(url);
        const preview = fileId && previews ? previews[fileId] : null;
        const fileName = preview && preview.name ? String(preview.name) : "";
        const isSurveyMap = /Survey_Map/i.test(url) || /Survey_Map/i.test(fileName);
        const label = isSurveyMap ? "แผนที่สำรวจ (ปักหมุด)" : `ไฟล์ที่ ${index + 1}`;
        mediaHtml += buildMediaItemHtml(url, label, preview);
      });
    }

    mediaHtml += "</div>";
    const safePayload = encodeURIComponent(JSON.stringify(details));

    return `
      ${surveyMetaHtml}
      ${buildSavedBudgetBreakdownHtml(details)}
      ${mediaHtml}
      <table class="detail-table">
        <thead>
          <tr>
            <th>#</th>
            <th>รหัสพัสดุ</th>
            <th>รายการ</th>
            <th>จำนวน</th>
          </tr>
        </thead>
        <tbody>
          ${details.map((item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(String(item.id))}</td>
              <td>${escapeHtml(String(item.name))}</td>
              <td style="text-align:center;">${escapeHtml(String(item.qty))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <button class="primary-btn" style="margin-top:14px;" type="button" onclick="window.AppActions.exportToExcel('${escapeJs(name)}', '${safePayload}')">Export Excel</button>
    `;
  }

  function exportToExcel(name, encodedDetails) {
    const details = JSON.parse(decodeURIComponent(encodedDetails));
    const data = details.map((item, index) => ({
      "ลำดับ": index + 1,
      "รหัสพัสดุ": item.id,
      "รายการ": item.name,
      "จำนวน": item.qty,
      "งบ": item.type,
      "รวม": item.total
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Materials");
    XLSX.writeFile(wb, `รายการพัสดุ_${name}.xlsx`);
  }

  async function askEdit(id) {
    const cached = state.historyRowCache[id] || {};
    if (!canManageHistoryProject(cached)) {
      Swal.fire("ไม่มีสิทธิ์", "เฉพาะเจ้าของโครงการเท่านั้นที่แก้ไขได้", "warning");
      return;
    }

    const name = cached.name || "";
    const img = cached.imgStr || "";
    await editJob(id, name, img);
  }

  async function editJob(id, name, img) {
    Swal.fire({
      title: "ดึงข้อมูล...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const details = await window.ApiService.getProjectDetails(id);
      if (details?.error) {
        Swal.fire("ไม่มีสิทธิ์", details.msg || "ไม่สามารถดูโครงการนี้ได้", "warning");
        return;
      }
      if (!Array.isArray(details) || !details.length) {
        Swal.fire("ไม่พบข้อมูล", "ไม่พบรายละเอียดพัสดุในโครงการนี้", "warning");
        return;
      }

      state.currentJobId = id;
      state.currentFileUrl = img;
      els.pjName.value = name;
      els.formTitle.innerText = `Edit Mode : ${name}`;

      state.budgets = [];
      const grouped = {};

      details.forEach(detail => {
        const typeKey = window.BudgetFormula.normalizeBudgetType(detail.type);
        const idKey = String(detail.id).trim();
        if (!grouped[typeKey]) grouped[typeKey] = [];

        const master = state.dataStore.find(item => String(item.id).trim() === idKey);
        if (master) {
          grouped[typeKey].push({
            ...master,
            qty: parseFloat(detail.qty) || 0,
            labPrice: parseFloat(detail.labPrice) || master.labPrice,
            laborDesc: detail.laborDesc || "ค่าแรงมาตรฐาน",
            total: parseFloat(detail.total) || 0
          });
        }
      });

      for (const type in grouped) {
        state.budgets.push({
          type: window.BudgetFormula.normalizeBudgetType(type),
          items: grouped[type],
          total: 0
        });
      }

      switchTab(1);
      render();
      checkInput();
      Swal.close();
    } catch (error) {
      console.error(error);
      Swal.fire("ดึงข้อมูลไม่สำเร็จ", error.message || "เกิดข้อผิดพลาด", "error");
    }
  }

  async function askDel(id) {
    const cached = state.historyRowCache[id] || {};
    if (!canManageHistoryProject(cached)) {
      Swal.fire("ไม่มีสิทธิ์", "เฉพาะเจ้าของโครงการเท่านั้นที่ลบได้", "warning");
      return;
    }

    const needsAdminPassword = !cached.createdBy && window.AuthSession?.isAdmin?.();
    let password = "";

    if (needsAdminPassword) {
      const { value } = await Swal.fire({
        title: "รหัสผ่าน admin",
        input: "password",
        showCancelButton: true
      });
      if (!value) return;
      password = value;
    } else {
      const { isConfirmed } = await Swal.fire({
        title: "ลบโครงการ?",
        text: "การลบไม่สามารถย้อนกลับได้",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "ลบทันที",
        cancelButtonText: "ยกเลิก"
      });
      if (!isConfirmed) return;
    }

    Swal.fire({
      title: "กำลังลบ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const result = await window.ApiService.deleteProject(id, password);
      if (result.status === "success") {
        Swal.fire({
          title: "สำเร็จ",
          text: "ลบโครงการเรียบร้อยแล้ว",
          icon: "success",
          timer: 1500,
          showConfirmButton: false
        });
        state.historyCache = null;
        fetchHistory();
      } else {
        Swal.fire("ลบไม่สำเร็จ", result.msg || "รหัสผ่านไม่ถูกต้อง", "error");
      }
    } catch (error) {
      console.error(error);
      Swal.fire("ลบไม่สำเร็จ", error.message || "เกิดข้อผิดพลาด", "error");
    }
  }

  async function editQty(budgetIndex, itemIndex) {
    const item = state.budgets[budgetIndex].items[itemIndex];
    const { value: newQty } = await Swal.fire({
      title: "แก้ไขจำนวน",
      text: item.name,
      input: "number",
      inputAttributes: { step: "any" },
      inputValue: item.qty,
      showCancelButton: true,
      confirmButtonText: "ตกลง",
      cancelButtonText: "ยกเลิก"
    });

    if (newQty !== undefined && newQty !== "" && newQty !== null) {
      const qtyNum = parseFloat(newQty);
      state.budgets[budgetIndex].items[itemIndex].qty = qtyNum;
      state.budgets[budgetIndex].items[itemIndex].total = (item.matPrice + item.labPrice) * qtyNum;
      render();
    }
  }

  function readFileAsBase64(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = event => resolve(event.target.result.split(",")[1]);
      reader.readAsDataURL(file);
    });
  }

  function safeDateDisplay(value) {
    try {
      const date = new Date(value);
      return isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("th-TH");
    } catch (error) {
      return String(value);
    }
  }

  function formatQty(value) {
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeJs(text) {
    return String(text)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');
  }

  window.AppActions = {
    viewDetail,
    exportToExcel,
    askEdit,
    askDel,
    askShare
  };

  window.AppCore = {
    getDataStore: () => state.dataStore,
    getBudgets: () => state.budgets,
    getProjectName: () => els.pjName.value.trim(),
    setProjectName: name => {
      els.pjName.value = String(name || "").trim();
      checkInput();
    },
    addProjectFiles: async (files, source = "survey") => {
      const list = Array.from(files || []);
      const indices = [];
      for (const file of list) {
        const base64 = await readFileAsBase64(file);
        const entry = { base64, type: file.type, name: file.name, source };
        state.tempFileList.push(entry);
        indices.push(state.tempFileList.length - 1);
      }
      return indices;
    },
    removeProjectFileAt: index => {
      if (index >= 0 && index < state.tempFileList.length) {
        state.tempFileList.splice(index, 1);
      }
    },
    addProjectFileFromBase64: (base64, mime, name) => {
      state.tempFileList.push({
        base64,
        type: mime,
        name,
        source: "survey"
      });
    },
    getSurveyMeta: () => (window.SurveyModule && window.SurveyModule.getSurveyMeta
      ? window.SurveyModule.getSurveyMeta()
      : null),
    clearSurveyFiles: () => {
      state.tempFileList = state.tempFileList.filter(file => file.source !== "survey");
    },
    getProjectFileCount: () => state.tempFileList.length,
    addItemWithLabor: (budgetIndex, item, qty) => hideAndAsk(budgetIndex, item, qty),
    pickOrCreateBudgetIndex,
    confirmSaveProject: options => confirmSave(options),
    addBudgetType: type => addBudget(type),
    switchToCreateTab: () => switchTab(1),
    switchToTab: n => switchTab(n),
    render
  };
})();
