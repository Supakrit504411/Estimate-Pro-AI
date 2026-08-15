(function () {
  const appConfig = window.APP_CONFIG || {};

  const state = {
    dataStore: [],
    budgets: [],
    historyCache: null,
    historyRowCache: {},
    adminCache: null,
    shareUserList: null,
    currentJobId: null,
    currentFileUrl: "",
    tempFileList: [],
    aiReviewQueue: [],
    activeSurveyMeta: null,
    staging: {}
  };

  let lastPriceQuote = null;
  let lastPriceAskContext = null;
  let priceAskThread = [];
  let appBootstrapped = false;

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    bindLoginEvents();
    initLoginBackground();
    if (window.AuthSession?.isLoggedIn()) {
      await bootstrapApp();
      return;
    }
    initLineLogin();
  }

  function bindLoginEvents() {
    const form = document.getElementById("loginForm");
    const logoutBtn = document.getElementById("logoutBtn");
    form?.addEventListener("submit", handleLoginSubmit);
    logoutBtn?.addEventListener("click", handleLogout);

    document.getElementById("lineLoginBtn")?.addEventListener("click", handleLineLoginClick);

    const toggle = document.getElementById("passwordLoginToggle");
    toggle?.addEventListener("click", () => {
      const collapsed = form?.classList.toggle("login-form-collapsed");
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.textContent = collapsed ? "เข้าสู่ระบบด้วยรหัสผ่าน ▾" : "เข้าสู่ระบบด้วยรหัสผ่าน ▴";
      if (!collapsed) document.getElementById("loginUsername")?.focus();
    });
  }

  /* ============================================================
     LINE Login (LIFF) — default login method
     ============================================================ */

  function getLiffId() {
    return String(appConfig.line?.liffId || "").trim();
  }

  function setLineLoginHint(text, isError) {
    const hint = document.getElementById("lineLoginHint");
    if (!hint) return;
    hint.textContent = text || "";
    hint.classList.toggle("hidden", !text);
    hint.classList.toggle("is-error", !!isError);
  }

  async function initLineLogin() {
    const liffId = getLiffId();
    const btn = document.getElementById("lineLoginBtn");
    if (!liffId || !window.liff) {
      if (btn) btn.disabled = true;
      setLineLoginHint("LINE Login ยังไม่พร้อม — ใช้รหัสผ่านด้านล่างแทน", false);
      return;
    }
    try {
      await liff.init({ liffId });
      // กลับมาจากหน้า LINE authorize → เข้าระบบต่ออัตโนมัติ
      if (liff.isLoggedIn()) {
        await completeLineLogin();
      }
    } catch (error) {
      console.warn("LIFF init failed:", error);
      if (btn) btn.disabled = true;
      setLineLoginHint("เริ่มต้น LINE Login ไม่สำเร็จ — ใช้รหัสผ่านแทน", true);
    }
  }

  async function handleLineLoginClick() {
    const liffId = getLiffId();
    if (!liffId || !window.liff) {
      setLineLoginHint("ยังไม่ได้ตั้งค่า LIFF ID ใน config.js", true);
      return;
    }
    try {
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }
      await completeLineLogin();
    } catch (error) {
      setLineLoginHint(error.message || "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ", true);
    }
  }

  async function completeLineLogin() {
    const btn = document.getElementById("lineLoginBtn");
    if (btn) btn.disabled = true;
    setLineLoginHint("กำลังตรวจสอบบัญชี LINE...", false);
    try {
      const accessToken = liff.getAccessToken();
      if (!accessToken) throw new Error("ไม่พบ LINE access token — ลองใหม่อีกครั้ง");
      const result = await window.ApiService.lineLogin(accessToken);
      if (!result?.ok || !result.user) {
        // ถูก block → บังคับ logout ออกจาก LIFF เพื่อไม่วน auto-login
        if (result?.blocked && liff.isLoggedIn()) liff.logout();
        throw new Error(result?.message || "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ");
      }
      window.AuthSession.save(result.user);
      setLineLoginHint("", false);
      await bootstrapApp();
    } catch (error) {
      setLineLoginHint(error.message || "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ", true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* ============================================================
     Login background — futuristic particle field (PEA gold/magenta)
     ============================================================ */

  function initLoginBackground() {
    const canvas = document.getElementById("loginBgCanvas");
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    const COLORS = ["rgba(199,145,27,", "rgba(116,4,95,"];
    let particles = [];
    let rafId = null;

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const count = Math.min(70, Math.floor(canvas.width * canvas.height / 18000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.8 + 0.6,
        c: COLORS[Math.random() < 0.6 ? 0 : 1]
      }));
    }

    function step() {
      const gate = document.getElementById("loginGate");
      if (!gate || gate.classList.contains("hidden")) {
        rafId = null;
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const LINK = 110;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c + "0.8)";
        ctx.fill();
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = p.c + (0.16 * (1 - dist / LINK)).toFixed(3) + ")";
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }
      rafId = requestAnimationFrame(step);
    }

    resize();
    window.addEventListener("resize", resize);
    rafId = requestAnimationFrame(step);
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

    Swal.fire({
      title: "กำลังเข้าสู่ระบบ...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const result = await window.ApiService.login(username, password);
      if (!result?.ok || !result.user) {
        throw new Error(result?.message || "เข้าสู่ระบบไม่สำเร็จ");
      }
      window.AuthSession.save(result.user);
      Swal.close();
      await bootstrapApp();
    } catch (error) {
      Swal.close();
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
    try {
      if (window.liff?.isLoggedIn?.()) liff.logout();
    } catch (error) { /* liff ยังไม่ init — ข้ามได้ */ }
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
    refreshImpactStats();
  }

  async function refreshImpactStats() {
    try {
      if (!state.historyCache) {
        state.historyCache = await window.ApiService.getSavedProjects();
      }
      updateImpactStrip(state.historyCache || []);
    } catch (error) {
      console.warn("Impact stats skipped:", error);
    }
  }

  function updateImpactStrip(rows) {
    const strip = document.getElementById("impactStrip");
    if (!strip) return;
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      strip.classList.add("hidden");
      return;
    }
    const projectCount = list.length;
    const grandSum = list.reduce((sum, row) => sum + (parseFloat(row[3]) || 0), 0);
    const surveyCount = list.filter(row => {
      const meta = String(row[5] || "");
      return meta && meta !== "{}" && meta !== "null";
    }).length;
    // ประมาณ 45 นาที/โครงการ ที่ประหยัดได้เทียบกับการพิมพ์ BOM ด้วยมือ
    const hoursSaved = Math.round(projectCount * 45 / 60);
    strip.innerHTML = `
      <div class="impact-hero">
        <span class="impact-hero-label">ประมาณการรวม</span>
        <span class="impact-hero-value">${grandSum.toLocaleString(undefined, { maximumFractionDigits: 0 })} <small>บาท</small></span>
        <div class="impact-hero-meta">
          <span>${projectCount.toLocaleString()} โครงการ</span>
          <span>${surveyCount.toLocaleString()} มีแผนที่สำรวจ</span>
          <span>ประหยัด ~${hoursSaved.toLocaleString()} ชม.</span>
        </div>
      </div>
    `;
    strip.classList.remove("hidden");
  }

  function renderPriceFaqChips() {
    if (!els.priceAskChips) return;
    const faq = appConfig.priceFaq || {};
    els.priceAskChips.innerHTML = Object.entries(faq).map(([id, entry]) => `
      <button type="button" class="price-ask-chip" data-faq-id="${escapeHtml(id)}">${escapeHtml(entry.label)}</button>
    `).join("");
  }

  function initScrollCompactHeader() { /* removed — header stays fixed height */ }

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
    els.histSort = document.getElementById("histSort");
    els.histMineOnly = document.getElementById("histMineOnly");
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
    els.adminAuditSearch = document.getElementById("adminAuditSearch");
    els.adminAuditAction = document.getElementById("adminAuditAction");
    els.adminAuditExportBtn = document.getElementById("adminAuditExportBtn");
    els.adminPriceAskFeedback = document.getElementById("adminPriceAskFeedback");
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
    els.histSort?.addEventListener("change", filterHistory);
    els.histMineOnly?.addEventListener("change", filterHistory);
    els.histContent?.addEventListener("click", handleHistoryClick);
    els.reloadAdminBtn?.addEventListener("click", () => {
      state.adminCache = null;
      fetchAdminDashboard();
    });
    els.adminAuditSearch?.addEventListener("input", renderAdminAuditFromCache);
    els.adminAuditAction?.addEventListener("change", renderAdminAuditFromCache);
    els.adminAuditExportBtn?.addEventListener("click", exportAdminAuditCsv);
    els.budgetButtons.forEach(button => {
      button.addEventListener("click", () => addBudget(button.dataset.budgetType));
    });

    els.budgetSpace.addEventListener("click", handleBudgetSpaceClick);
    els.budgetSpace.addEventListener("input", handleBudgetSpaceInput);
    els.budgetSpace.addEventListener("change", handleStagingEvent);

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
        if (event.target.closest("[data-action='price-feedback-ok']")) {
          handlePriceAskFeedback("ok");
        }
        if (event.target.closest("[data-action='price-feedback-wrong']")) {
          handlePriceAskFeedback("wrong");
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
          state.dataStore = window.PriceAskNlu?.enrichMasterStore
            ? window.PriceAskNlu.enrichMasterStore(cached.data)
            : cached.data;
          return;
        }
      } catch (error) {
        console.warn("master cache read failed", error);
      }
    }

    try {
      const raw = await window.ApiService.getMasterData();
      state.dataStore = window.PriceAskNlu?.enrichMasterStore
        ? window.PriceAskNlu.enrichMasterStore(raw)
        : raw;
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
    if (els.priceAskInput) els.priceAskInput.value = "";
    els.priceAskResult.classList.remove("hidden");

    const displayQuery = query || (faqId ? (appConfig.priceFaq?.[faqId]?.label || faqId) : "");
    if (displayQuery) {
      if (!priceAskThread.length || priceAskThread[priceAskThread.length - 1]?.text !== displayQuery) {
        appendPriceAskMessage("user", displayQuery);
      }
    }

    els.priceAskResult.innerHTML = `${renderPriceAskThreadHtml()}
      <div class="price-ask-loading">
        <span class="price-ask-typing"><i></i><i></i><i></i></span>
        <span>AI กำลังวิเคราะห์ราคา...</span>
        <div class="price-ask-skeleton">
          <div class="price-ask-shimmer" style="width:82%"></div>
          <div class="price-ask-shimmer" style="width:64%"></div>
          <div class="price-ask-shimmer" style="width:73%"></div>
        </div>
      </div>`;

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

    if (query && intent) {
      const preferred = window.PriceQuoteEngine.preferLocalTrInstallIntent(
        query,
        budgetType,
        intent,
        parseSource
      );
      intent = preferred.intent;
      parseSource = preferred.parseSource;
    }

    if (intent && query) {
      intent = window.PriceQuoteEngine.sanitizeIntent(intent, query);
    }

    if (!intent) {
      els.priceAskResult.innerHTML = `
        <div class="price-ask-error">
          <strong>ไม่เข้าใจคำถาม</strong>
          <p>ลองกดปุ่ม「คำถามที่พบบ่อย」ด้านล่างก่อน (แนะนำตอน demo) หรือระบุ kVA / รหัสพัสดุให้ชัด เช่น 「หม้อแปลง 100 kVA」</p>
        </div>
      `;
      els.priceAskBtn.disabled = false;
      lastPriceAskContext = null;
      return;
    }

    if (intent.source === "glossary") parseSource = "glossary";

    let quote = window.PriceQuoteEngine.buildQuote(intent, state.dataStore);

    if (!quote.ok && quote.needsClarification && quote.clarificationType === "pole_run") {
      appendPriceAskMessage("assistant", quote.question || "ช่วยระบุรายละเอียดงานเสาเพิ่มเติม");
      const clarifiedIntent = await promptPriceClarification(quote.intent, quote.question, "pole_run");
      if (clarifiedIntent) {
        intent = clarifiedIntent;
        quote = window.PriceQuoteEngine.buildQuote(intent, state.dataStore);
      }
    }

    if (!quote.ok && quote.needsClarification && quote.clarificationType === "tr_install") {
      appendPriceAskMessage("assistant", quote.question || "ช่วยระบุขนาดหม้อแปลง");
      const clarifiedIntent = await promptPriceClarification(quote.intent, quote.question, "tr_install");
      if (clarifiedIntent) {
        intent = clarifiedIntent;
        quote = window.PriceQuoteEngine.buildQuote(intent, state.dataStore);
      }
    }

    if (!quote.ok && quote.needsClarification && quote.clarificationType === "material_pick") {
      appendPriceAskMessage("assistant", quote.question || "ช่วยเลือกรายการพัสดu");
      const clarifiedIntent = await promptPriceClarification(quote.intent, quote.question, "material_pick");
      if (clarifiedIntent) {
        intent = clarifiedIntent;
        quote = window.PriceQuoteEngine.buildQuote(intent, state.dataStore);
      }
    }

    lastPriceQuote = quote;
    lastPriceAskContext = {
      query: query || quote.query || "",
      budgetType,
      parseSource,
      intent
    };
    if (quote.ok) {
      appendPriceAskMessage("assistant", `รวม ${quote.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท (งบ ${quote.budgetType})`);
    }
    renderPriceAskResult(quote, parseSource);
    els.priceAskBtn.disabled = false;
  }

  function appendPriceAskMessage(role, text) {
    if (!text) return;
    priceAskThread.push({ role, text: String(text), at: Date.now() });
    if (priceAskThread.length > 12) priceAskThread = priceAskThread.slice(-12);
  }

  function renderPriceAskThreadHtml() {
    if (!priceAskThread.length) return "";
    return `
      <div class="price-ask-chat">
        ${priceAskThread.map(msg => `
          <div class="price-ask-chat-bubble is-${msg.role === "user" ? "user" : "assistant"}">
            <span class="price-ask-chat-role">${msg.role === "user" ? "คุณ" : "AI"}</span>
            <p>${escapeHtml(msg.text)}</p>
          </div>
        `).join("")}
      </div>
    `;
  }

  async function promptPriceClarification(intent, question, type) {
    const fields = type === "tr_install"
      ? (window.PriceQuoteEngine.buildTrClarificationFields?.(intent) || intent.clarificationFields || [])
      : type === "material_pick"
        ? (window.PriceQuoteEngine.buildMaterialClarificationFields?.(intent) || intent.clarificationFields || [])
        : (window.PriceQuotePole?.buildClarificationFields?.(intent) || intent.clarificationFields || []);

    if (!fields.length) {
      if (type === "tr_install") {
        return window.PriceQuoteEngine.mergeTrIntent(intent, {});
      }
      if (type === "material_pick") {
        return window.PriceQuoteEngine.mergeMaterialIntent(intent, {});
      }
      return window.PriceQuoteEngine.mergePoleIntent(intent, {});
    }

    const fieldHtml = fields.map(field => {
      const dv = field.defaultValue || "";
      const options = (field.options || []).map(opt => `
        <option value="${escapeHtml(opt.value)}" ${String(opt.value) === String(dv) ? "selected" : ""}>${escapeHtml(opt.label)}</option>
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

    // Inline clarification bubble ใน chat thread (แทน Swal popup)
    const answers = await new Promise(resolve => {
      if (!els.priceAskResult) { resolve(null); return; }
      els.priceAskResult.classList.remove("hidden");
      els.priceAskResult.innerHTML = `
        ${renderPriceAskThreadHtml()}
        <div class="price-ask-chat">
          <div class="price-ask-chat-bubble is-assistant price-clarify-inline" id="priceClarifyInline">
            <span class="price-ask-chat-role">AI</span>
            <div class="price-clarify-form">${fieldHtml}</div>
            <p id="priceClarifyError" class="price-clarify-inline-error hidden" role="alert"></p>
            <div class="price-clarify-inline-actions">
              <button type="button" id="priceClarifyConfirm" class="primary-btn price-clarify-confirm">คำนวณราคา</button>
              <button type="button" id="priceClarifyCancel" class="ghost-btn price-clarify-cancel">ยกเลิก</button>
            </div>
          </div>
        </div>
      `;
      document.getElementById("priceClarifyInline")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      document.getElementById("priceClarifyConfirm")?.addEventListener("click", () => {
        const collected = {};
        for (const field of fields) {
          const el = document.getElementById(`price-clarify-${field.key}`);
          const value = el?.value || "";
          if (!value) {
            const errEl = document.getElementById("priceClarifyError");
            if (errEl) {
              errEl.textContent = `กรุณาเลือก: ${field.label}`;
              errEl.classList.remove("hidden");
            }
            return;
          }
          collected[field.key] = field.key === "kva" ? Number(value) : value;
        }
        resolve(collected);
      });
      document.getElementById("priceClarifyCancel")?.addEventListener("click", () => resolve(null));
    });

    if (!answers) return null;

    const answerSummary = fields
      .map(field => {
        const chosen = (field.options || []).find(opt => String(opt.value) === String(answers[field.key]));
        return `${field.label}: ${chosen?.label ?? answers[field.key]}`;
      })
      .join(" · ");
    if (answerSummary) appendPriceAskMessage("user", answerSummary);

    if (type === "tr_install") {
      return window.PriceQuoteEngine.mergeTrIntent(intent, answers);
    }
    if (type === "material_pick") {
      return window.PriceQuoteEngine.mergeMaterialIntent(intent, answers);
    }
    return window.PriceQuoteEngine.mergePoleIntent(intent, answers);
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
    const rows = window.BudgetFormula.getBudgetBreakdownRows(totals, budgetType);

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
    if (parseSource === "glossary") return "พจนานุกรม";
    if (parseSource === "local") return "ระบบ";
    if (parseSource === "gemini-lite" || parseSource === "gemini") return "AI Answer";
    return "ระบบ";
  }

  function renderPriceAskConfidenceBadge(intent) {
    if (!intent || intent.parseConfidence == null) return "";
    const level = intent.confidenceLevel || "medium";
    const pct = Math.round(Number(intent.parseConfidence) * 100);
    const label = level === "high"
      ? "มั่นใจสูง"
      : (level === "medium" ? "ควรตรวจสอบ" : "มั่นใจต่ำ");
    return `<span class="price-ask-confidence price-ask-confidence-${level}" title="${escapeHtml((intent.confidenceReasons || []).join(", "))}">${label} ${pct}%</span>`;
  }

  function renderPriceAskFeedbackBar() {
    return `
      <div class="price-ask-feedback">
        <span class="price-ask-feedback-label">ผลลัพธ์ตรงกับที่ต้องการไหม?</span>
        <button class="ghost-btn price-ask-feedback-btn" type="button" data-action="price-feedback-ok">ตรง</button>
        <button class="ghost-btn price-ask-feedback-btn price-ask-feedback-wrong" type="button" data-action="price-feedback-wrong">ไม่ตรง</button>
      </div>
    `;
  }

  async function handlePriceAskFeedback(verdict) {
    const ctx = lastPriceAskContext;
    const quote = lastPriceQuote;
    if (!ctx?.query || !window.PriceAskFeedback?.logFeedback) return;

    if (verdict === "wrong") {
      const result = await Swal.fire({
        title: "ช่วยบอกเพิ่มเติม",
        html: `<p class="price-ask-feedback-swalsub">คำถาม: ${escapeHtml(ctx.query)}</p>`,
        input: "textarea",
        inputPlaceholder: "ควรได้คำตอบแบบไหน? (เช่น เทโคน 10 จุดอย่างเดียว ไม่รวมเสา)",
        showCancelButton: true,
        confirmButtonText: "ส่ง feedback",
        cancelButtonText: "ยกเลิก"
      });
      if (!result.isConfirmed) return;

      window.PriceAskFeedback.logFeedback({
        verdict: "wrong",
        query: ctx.query,
        budgetType: ctx.budgetType,
        parseSource: ctx.parseSource,
        parseConfidence: ctx.intent?.parseConfidence,
        confidenceLevel: ctx.intent?.confidenceLevel,
        intent: ctx.intent,
        total: quote?.total,
        note: result.value || ""
      });

      Swal.fire("บันทึกแล้ว", "ขอบคุณ — ทีมจะนำไปปรับพจนานุกรมและชุดทดสอบ", "success");
      renderAdminPriceAskFeedback();
      return;
    }

    window.PriceAskFeedback.logFeedback({
      verdict: "ok",
      query: ctx.query,
      budgetType: ctx.budgetType,
      parseSource: ctx.parseSource,
      parseConfidence: ctx.intent?.parseConfidence,
      confidenceLevel: ctx.intent?.confidenceLevel,
      intent: ctx.intent,
      total: quote?.total
    });

    Swal.fire({ icon: "success", title: "ขอบคุณ", text: "บันทึก feedback แล้ว", timer: 1400, showConfirmButton: false });
    renderAdminPriceAskFeedback();
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
    if (bundle.type === "budget_capacity" && bundle.capacityMode === "poles") {
      return `<div class="price-ask-bundle">งบ ${Number(bundle.budgetBaht).toLocaleString()} บาท → ปักเสาได้ ~${bundle.poleCount} ต้น (วัสดุเสาอย่างเดียว)</div>`;
    }
    if (bundle.type === "budget_capacity") {
      return `<div class="price-ask-bundle">งบ ${Number(bundle.budgetBaht).toLocaleString()} บาท → ขยายได้ ~${bundle.maxDistanceM} ม. · ${bundle.poleCount} ต้น</div>`;
    }
    if (bundle.type === "tr_budget_check") {
      const cls = bundle.budgetVerdict === "short" ? " price-ask-verdict-short" : " price-ask-verdict-ok";
      const label = `หม้อแปลง ${bundle.kva} kVA ${String(bundle.phase || "").toUpperCase()}`;
      if (bundle.fixedKvaUnits && bundle.maxUnits >= 1) {
        return `<div class="price-ask-bundle${cls}">✓ งบ ${Number(bundle.budgetBaht).toLocaleString()} บาท → ${label} · ติดตั้งได้ ~${bundle.maxUnits} เครื่อง (~${Math.round(bundle.perUnitTotal).toLocaleString()} บาท/เครื่อง)</div>`;
      }
      if (bundle.wantsUnitCount && bundle.wantsMaxSize && bundle.maxUnits > 1) {
        return `<div class="price-ask-bundle${cls}">✓ งบ ${Number(bundle.budgetBaht).toLocaleString()} บาท → สูงสุด ${bundle.kva} kVA · ติดตั้งได้ ~${bundle.maxUnits} เครื่อง (~${Math.round(bundle.perUnitTotal).toLocaleString()} บาท/เครื่อง)</div>`;
      }
      if (bundle.budgetVerdict === "enough") {
        return `<div class="price-ask-bundle${cls}">✓ งบพอ: ${label} (~${Math.round(bundle.targetTotal).toLocaleString()} บาท/เครื่อง) · เหลือ ~${Math.round(bundle.budgetDelta).toLocaleString()} บาท</div>`;
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
          : (quote.clarificationType === "material_pick"
            ? `<p class="price-ask-clarify-hint">มีหลายรหัสใน master — เลือกจากรายการ หรือระบุรุ่นในประโยค เช่น 「manhole 2T-1」</p>`
            : ""));
      els.priceAskResult.innerHTML = `
        ${renderPriceAskThreadHtml()}
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
      || (quote.bundle?.bundleNote
        ? `<div class="price-ask-bundle price-ask-bundle-note">${escapeHtml(quote.bundle.bundleNote)}</div>`
        : "")
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
      ${renderPriceAskThreadHtml()}
      <div id="priceAskExportRoot" class="price-ask-export-root">
      <div class="price-ask-summary">
        <div class="price-ask-summary-top">
          <span class="price-ask-source">${formatPriceAskSource(parseSource)} · งบ ${escapeHtml(quote.budgetType)}</span>
          ${renderPriceAskConfidenceBadge(quote.intent)}
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
      ${renderPriceAskFeedbackBar()}
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
    XLSX.writeFile(wb, `ถาม_AI_${safeName}.xlsx`);
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

    return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>ถาม AI</title>
      <style>
        body { font-family: Sarabun, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 20px; margin: 0 0 8px; }
        .meta { color: #444; font-size: 13px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; vertical-align: top; }
        th { background: #f3f3f3; }
        .total { margin-top: 12px; font-size: 16px; font-weight: 700; text-align: right; }
      </style></head><body>
      <h1>ผลการถาม AI</h1>
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
    priceAskThread = [];
    if (els.priceAskInput) els.priceAskInput.value = "";
    if (els.priceAskResult) {
      els.priceAskResult.classList.remove("hidden");
      els.priceAskResult.innerHTML = `
        <div class="price-ask-chat">
          <div class="price-ask-chat-bubble is-assistant"><p>สวัสดีครับ! ผมช่วยหาราคาพัสดุ รหัสวัสดุ หรือชุด SET ได้เลยครับ</p></div>
        </div>
      `;
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
      title: "ออกจากหน้าถาม AI?",
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
    /* scroll-compact removed */

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

  // ตัวเลือกน้อย — แสดงเป็นปุ่มกดเลือกได้ทันทีแทน dropdown
  function pickFromChoiceButtons({ title, text, options, selectedValue }) {
    const escAttr = value => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const buttons = Object.entries(options).map(([value, label]) => `
      <button type="button" class="swal-choice-btn ${String(value) === String(selectedValue) ? "is-selected" : ""}" data-choice="${escAttr(value)}">
        ${escapeHtml(label)}
      </button>
    `).join("");
    return new Promise(resolve => {
      Swal.fire({
        title,
        html: `${text ? `<p class="swal-choice-text">${escapeHtml(text)}</p>` : ""}<div class="swal-choice-list">${buttons}</div>`,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: "ยกเลิก",
        customClass: { popup: "pea-swal-popup" },
        didOpen: () => {
          Swal.getPopup().querySelectorAll(".swal-choice-btn").forEach(btn => {
            btn.addEventListener("click", () => {
              // resolve ก่อน close — willClose/dismiss จะมาทีหลังและกลายเป็น no-op
              resolve(btn.dataset.choice);
              Swal.close();
            });
          });
        }
      }).then(result => {
        if (result.isDismissed) resolve(undefined);
      });
    });
  }

  async function pickOrCreateBudgetIndex() {
    if (state.budgets.length === 1) return 0;

    if (state.budgets.length > 1) {
      const budgetOptions = {};
      state.budgets.forEach((budget, index) => { budgetOptions[index] = `งบ ${budget.type}`; });
      const budgetIndex = await pickFromChoiceButtons({
        title: "เลือกงบที่จะนำเข้า",
        options: budgetOptions
      });
      if (budgetIndex === undefined) return null;
      return Number(budgetIndex);
    }

    const ready = await ensureProjectNameForBudget();
    if (!ready) return null;

    const budgetType = await pickFromChoiceButtons({
      title: "สร้างงบใหม่",
      text: "ยังไม่มีงบในโครงการ — เลือกประเภทงบเพื่อเริ่มนำเข้ารายการ",
      options: BUDGET_TYPE_OPTIONS,
      selectedValue: "01.1"
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
    const newType = await pickFromChoiceButtons({
      title: "เปลี่ยนประเภทงบ",
      options: BUDGET_TYPE_OPTIONS,
      selectedValue: state.budgets[index].type
    });

    if (newType) {
      state.budgets[index].type = window.BudgetFormula.normalizeBudgetType(newType);
      render();
    }
  }

  function render() {
    const allDetails = state.budgets.flatMap(budget =>
      budget.items.map(item => ({ ...item, type: item.type || budget.type }))
    );
    const displaySurveyMeta = state.activeSurveyMeta
      ? mergeDisplayMeta(state.activeSurveyMeta, allDetails)
      : null;
    const setSummaryHtml = displaySurveyMeta?.setUsage?.length
      ? buildSetAwareDisplayTableHtml(allDetails, displaySurveyMeta, {
        title: "รายละเอียดพัสดุ / ชุด SET (สำหรับกรอกโปรแกรม)"
      })
      : (state.activeSurveyMeta ? buildSetUsageSummaryHtml(state.activeSurveyMeta) : "");
    els.budgetSpace.innerHTML = `${setSummaryHtml}${state.budgets.map((budget, bIdx) => `
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

        <div id="staging-${bIdx}" class="staging-container hidden"></div>

        <div class="item-list">
          ${budget.items.length ? sortDetailsForSetGrouping(budget.items, displaySurveyMeta).map(({ item, setIds, primarySet, originalIndex }) => `
            <div class="item-row ${primarySet ? "is-set-item" : ""} ${setIds.length && primarySet ? "is-set-grouped" : ""}">
              <div class="item-main" data-action="edit-qty" data-budget-index="${bIdx}" data-item-index="${originalIndex}">
                <div class="item-name">${item.name}</div>
                <div class="item-sub">
                  <span class="qty-chip">QTY ${formatQty(item.qty)}</span>
                  <span class="type-chip">${item.id}</span>
                  ${setIds.length ? `<span class="set-chip">SET ${setIds.join(", ")}</span>` : ""}
                  <span>${item.laborDesc || "ค่าแรงมาตรฐาน"}</span>
                </div>
              </div>
              <div class="item-total">
                ${Number(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span class="danger-link" data-action="remove-item" data-budget-index="${bIdx}" data-item-index="${originalIndex}">ลบรายการ</span>
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
    `).join("")}`;

    updateGrandTotal();
    state.budgets.forEach((_, bIdx) => renderStagingTable(bIdx));
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
        case "staging-confirm":
          confirmStaging(budgetIndex);
          return;
        case "staging-clear":
          clearStaging(budgetIndex);
          return;
        default:
          break;
      }
    }

    const resultItem = event.target.closest(".res-item");
    if (resultItem) {
      const budgetIndex = Number(resultItem.dataset.budgetIndex);
      if (resultItem.dataset.setId) {
        const setEntry = { id: resultItem.dataset.setId, name: "", isSet: true };
        document.querySelectorAll(".res-box").forEach(b => { b.style.display = "none"; });
        addSetToStaging(budgetIndex, setEntry);
        return;
      }
      const item = JSON.parse(resultItem.dataset.item);
      addToStaging(budgetIndex, item);
      return;
    }

    handleStagingEvent(event);
  }

  function handleBudgetSpaceInput(event) {
    const budgetIndex = event.target.dataset.searchInput;
    if (budgetIndex !== undefined) {
      findItems(event.target, Number(budgetIndex));
      return;
    }
    handleStagingEvent(event);
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
      laborIndex: 0,
      manualSearch: "",
      targetBudgetIndex: state.budgets.length - 1
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
    const total = state.aiReviewQueue.length;
    const autoMatched = state.aiReviewQueue.filter(entry => entry.selectedItemId).length;
    const pct = total ? Math.round(autoMatched * 100 / total) : 0;
    return `
      <div class="queue-confidence-bar">
        <div class="queue-confidence-label">
          AI จับคู่อัตโนมัติ <strong>${autoMatched}/${total}</strong> รายการ (${pct}%)
        </div>
        <div class="queue-confidence-track"><div class="queue-confidence-fill" style="width:${pct}%"></div></div>
        <div class="queue-conf-legend">
          <span class="queue-conf-dot is-high"></span> จับคู่แล้ว — สแกนผ่านได้
          <span class="queue-conf-dot is-mid"></span> ต้องเลือกจากตัวเลือก
          <span class="queue-conf-dot is-low"></span> ต้องค้นหาเอง
        </div>
      </div>
      <div class="queue-note">
        AI ช่วยอ่านเฉพาะรหัสพัสดุและจำนวน — ถ้าอ่านไม่เจอให้<strong>ค้นหาและเลือกพัสดุเอง</strong>จากช่องค้นหา (ไม่ต้องยกเลิกแล้วสแกนใหม่)
      </div>
      <div class="queue-list">
        ${state.aiReviewQueue.map((entry, index) => buildQueueRowHtml(entry, index)).join("")}
      </div>
    `;
  }

  function buildQueueRowHtml(entry, index) {
    const selectedItem = getQueueSelectedItem(entry);
    const laborOptions = selectedItem ? selectedItem.laborOptions : [];
    const matchOptions = entry.matchedItems || [];

    const confClass = entry.selectedItemId
      ? "is-conf-high"
      : (entry.matchedItems || []).length
        ? "is-conf-mid"
        : "is-conf-low";

    return `
      <div class="queue-row ${confClass}" data-queue-row="${index}">
        <div class="queue-topline">
          <div class="queue-badge">#${index + 1}</div>
          <div class="queue-source">${escapeHtml(entry.sourceName || "AI Scan")}</div>
          ${entry.selectedItemId
            ? `<span class="queue-match-badge is-auto">✓ จับคู่อัตโนมัติ</span>`
            : (entry.matchedItems || []).length
              ? `<span class="queue-match-badge is-pick">เลือกจาก ${(entry.matchedItems || []).length} ตัวเลือก</span>`
              : `<span class="queue-match-badge is-manual">ค้นหาเอง</span>`}
          <button type="button" class="queue-skip-btn" data-queue-action="skip" data-queue-index="${index}">ข้ามรายการ</button>
        </div>
        <div class="queue-grid">
          <div class="queue-field">
            <label>รหัสที่ AI อ่านได้</label>
            <div class="queue-raw-id">${escapeHtml(entry.rawId || "-")}</div>
          </div>
          <div class="queue-field queue-field-wide">
            <label>พัสดุ${matchOptions.length ? " (จับคู่จาก AI)" : ""}</label>
            ${matchOptions.length ? `
              <select class="queue-select" data-queue-role="item" data-queue-index="${index}">
                <option value="">เลือกจากรายการที่จับคู่ได้</option>
                ${matchOptions.map(item => `
                  <option value="${escapeHtml(item.id)}" ${entry.selectedItemId === item.id ? "selected" : ""}>
                    ${escapeHtml(item.id)} - ${escapeHtml(item.name)}
                  </option>
                `).join("")}
              </select>
            ` : ""}
            <input
              class="queue-search"
              type="search"
              data-queue-role="search"
              data-queue-index="${index}"
              placeholder="พิมพ์รหัสหรือชื่อพัสดุ (อย่างน้อย 2 ตัวอักษร)"
              value="${escapeHtml(entry.manualSearch || "")}"
              autocomplete="off"
            />
            <div class="queue-search-box" data-queue-index="${index}"></div>
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
            <input class="queue-input" type="number" step="any" min="0" data-queue-role="qty" data-queue-index="${index}" value="${entry.qty}">
          </div>
          <div class="queue-field">
            <label>เพิ่มเข้า budget</label>
            <select class="queue-select" data-queue-role="budget" data-queue-index="${index}">
              ${state.budgets.map((budget, budgetIndex) => `
                <option value="${budgetIndex}" ${budgetIndex === (Number.isInteger(entry.targetBudgetIndex) ? entry.targetBudgetIndex : state.budgets.length - 1) ? "selected" : ""}>
                  Budget ${budget.type}
                </option>
              `).join("")}
            </select>
          </div>
        </div>
        ${selectedItem
          ? `<div class="queue-item-name">${escapeHtml(selectedItem.name)}</div>`
          : `<div class="queue-warning">ยังไม่ได้เลือกพัสดุ — ค้นหาจาก master หรือเลือกจากรายการจับคู่</div>`}
      </div>
    `;
  }

  function searchMasterItems(query, limit = 80) {
    const value = String(query || "").trim().toLowerCase();
    if (value.length < 2) return [];
    const terms = value.split(/\s+/).filter(Boolean);
    return state.dataStore.filter(item =>
      terms.every(term => `${item.id} ${item.name}`.toLowerCase().includes(term))
    ).slice(0, limit);
  }

  function renderQueueSearchResults(index, query) {
    const popup = Swal.getHtmlContainer();
    if (!popup) return;
    const box = popup.querySelector(`.queue-search-box[data-queue-index="${index}"]`);
    if (!box) return;
    const hits = searchMasterItems(query);
    if (!query || query.trim().length < 2) {
      box.innerHTML = "";
      box.style.display = "none";
      return;
    }
    box.innerHTML = hits.length
      ? hits.map(item => `
          <button type="button" class="queue-search-hit" data-queue-action="pick" data-queue-index="${index}" data-item-id="${escapeHtml(item.id)}">
            <strong>${escapeHtml(item.id)}</strong>
            <span>${escapeHtml(item.name)}</span>
          </button>
        `).join("")
      : `<div class="queue-search-empty">ไม่พบพัสดุ — ลองพิมพ์รหัสหรือคำในชื่อ</div>`;
    box.style.display = "block";
  }

  function bindQueueEvents(popup) {
    popup.querySelectorAll("[data-queue-role]").forEach(element => {
      element.addEventListener("change", handleQueueFieldChange);
      element.addEventListener("input", handleQueueFieldChange);
    });

    popup.querySelectorAll("[data-queue-action]").forEach(element => {
      element.addEventListener("click", handleQueueAction);
    });
  }

  function handleQueueAction(event) {
    const action = event.currentTarget.dataset.queueAction;
    const index = Number(event.currentTarget.dataset.queueIndex);
    if (action === "skip") {
      state.aiReviewQueue.splice(index, 1);
      if (!state.aiReviewQueue.length) {
        Swal.close();
        state.aiReviewQueue = [];
        Swal.fire("ไม่มีรายการเหลือ", "ยกเลิก review queue แล้ว", "info");
        return;
      }
      rerenderQueueModal();
      return;
    }

    if (action === "pick") {
      const itemId = event.currentTarget.dataset.itemId;
      const entry = state.aiReviewQueue[index];
      const item = state.dataStore.find(row => row.id === itemId);
      if (!entry || !item) return;
      entry.selectedItemId = item.id;
      entry.laborIndex = 0;
      if (!entry.matchedItems.some(row => row.id === item.id)) {
        entry.matchedItems.push(item);
      }
      rerenderQueueModal();
    }
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

    if (role === "search") {
      entry.manualSearch = event.target.value;
      renderQueueSearchResults(index, event.target.value);
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

      if (!Number.isFinite(entry.qty) || entry.qty <= 0) {
        Swal.showValidationMessage(`กรุณาระบุจำนวนที่มากกว่า 0 สำหรับพัสดุ ${selectedItem.id}`);
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
    if (!entry?.selectedItemId) return null;
    const fromMatched = (entry.matchedItems || []).find(item => item.id === entry.selectedItemId);
    if (fromMatched) return fromMatched;
    return state.dataStore.find(item => item.id === entry.selectedItemId) || null;
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
      if (voltage === "lv" && Array.isArray(presets.lvExtraSets)) {
        presets.lvExtraSets.forEach(id => ids.add(id));
      }
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
      showConfirmButton: true,
      confirmButtonText: "เสร็จสิ้น",
      showCloseButton: true,
      didOpen: () => {
        const popup = Swal.getPopup();
        const filterInput = popup.querySelector("#quickPickFilter");
        const resultsBox = popup.querySelector("#quickPickResults");
        const itemMap = new Map(hits.map(item => [item.id, item]));

        const pickedIds = new Set();
        const handlePick = async (item, btnEl) => {
          if (item.isSet) {
            Swal.close();
            addSetToStaging(budgetIndex, item);
            return;
          }
          const master = findMasterItem(item.id);
          if (master) {
            addToStaging(budgetIndex, master);
            pickedIds.add(item.id);
            if (btnEl) {
              btnEl.classList.add("picked");
              btnEl.insertAdjacentHTML("beforeend", '<span class="pick-check">✓</span>');
            }
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
          if (item) handlePick(item, button);
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

    const terms = value.split(" ");
    const hits = state.dataStore.filter(item =>
      terms.every(term => `${item.id} ${item.name}`.toLowerCase().includes(term))
    );

    const setHits = [];
    const setsMap = window.SURVEY_PRESETS?.sets;
    if (setsMap) {
      for (const [id, s] of Object.entries(setsMap)) {
        if (terms.every(term => `${id} ${s.name}`.toLowerCase().includes(term))) {
          setHits.push(s);
        }
      }
    }

    const setHtml = setHits.slice(0, 20).map(s => `
      <div class="res-item is-set-result" data-budget-index="${budgetIndex}" data-set-id="${escapeHtml(s.id)}">
        <b>SET ${s.id}</b><br>${s.name}
      </div>
    `).join("");

    box.innerHTML = setHtml + hits.slice(0, 100).map(item => `
      <div class="res-item" data-budget-index="${budgetIndex}" data-item='${escapeHtml(JSON.stringify(item))}'>
        <b>${item.id}</b><br>${item.name}
      </div>
    `).join("");
    box.style.display = "block";
  }

  function getStagingList(budgetIndex) {
    if (!state.staging[budgetIndex]) state.staging[budgetIndex] = [];
    return state.staging[budgetIndex];
  }

  function addToStaging(budgetIndex, item, qty = 1) {
    document.querySelectorAll(".res-box").forEach(box => { box.style.display = "none"; });
    const list = getStagingList(budgetIndex);
    const defaultLabor = item.laborOptions?.[0] || { desc: "ค่าแรงมาตรฐาน", price: item.labPrice };
    list.push({
      _uid: Date.now() + Math.random(),
      ...item,
      qty: parseFloat(qty) || 1,
      laborIndex: 0,
      labPrice: defaultLabor.price,
      laborDesc: defaultLabor.desc
    });
    renderStagingTable(budgetIndex);
  }

  function addSetToStaging(budgetIndex, setEntry) {
    const setObj = window.SurveyPresetsApi?.getSet?.(setEntry.id)
      || window.SURVEY_PRESETS?.sets?.[String(setEntry.id)];
    if (!setObj?.items?.length) {
      Swal.fire("ไม่พบชุด SET", `ไม่พบรายการในชุด ${setEntry.id}`, "warning");
      return;
    }
    const lines = window.SurveyPresetsApi?.expandTrSetItems?.(setObj.id, {}) || setObj.items;
    let added = 0;
    const missing = [];
    lines.forEach(line => {
      const master = findMasterItem(line.id);
      if (!master) { missing.push(line.id); return; }
      addToStaging(budgetIndex, master, parseFloat(line.qty) || 1);
      added++;
    });
    if (!added) {
      Swal.fire("ไม่สามารถเพิ่มชุด SET", missing.length ? `ไม่พบราคา master ของรหัส: ${missing.slice(0, 5).join(", ")}` : "ไม่มีรายการในชุดนี้", "warning");
    } else if (missing.length) {
      Swal.fire("เพิ่มชุด SET แล้ว", `เพิ่ม ${added} รายการ — ไม่พบราคา master สำหรับ ${missing.length} รหัส`, "info");
    }
  }

  function renderStagingTable(budgetIndex) {
    const container = document.getElementById(`staging-${budgetIndex}`);
    if (!container) return;
    const list = getStagingList(budgetIndex);
    if (!list.length) {
      container.innerHTML = "";
      container.classList.add("hidden");
      return;
    }
    container.classList.remove("hidden");
    const rows = list.map((entry, i) => {
      const laborOpts = entry.laborOptions || [];
      const laborSelect = laborOpts.length > 1
        ? `<select class="staging-labor-select" data-staging-idx="${i}">${laborOpts.map((lo, li) =>
            `<option value="${li}" ${li === entry.laborIndex ? "selected" : ""}>${escapeHtml(lo.desc)} (${lo.price})</option>`
          ).join("")}</select>`
        : `<span class="staging-labor-fixed">${escapeHtml(entry.laborDesc)}</span>`;
      const lineTotal = (entry.matPrice + entry.labPrice) * entry.qty;
      return `<tr>
        <td class="staging-name" title="${escapeHtml(entry.id)}">${escapeHtml(entry.name)}</td>
        <td class="staging-labor">${laborSelect}</td>
        <td class="staging-qty"><input type="number" class="staging-qty-input" value="${entry.qty}" step="any" min="0.01" data-staging-idx="${i}"></td>
        <td class="staging-total">${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td><button type="button" class="staging-remove" data-staging-idx="${i}">✕</button></td>
      </tr>`;
    }).join("");
    const grandTotal = list.reduce((s, e) => s + (e.matPrice + e.labPrice) * e.qty, 0);
    container.innerHTML = `
      <div class="staging-header">
        <span>รายการที่เลือก (${list.length} รายการ)</span>
        <span class="staging-grand-total">รวม ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
      </div>
      <div class="staging-table-wrap">
        <table class="staging-table">
          <thead><tr><th>รายการ</th><th>ค่าแรง</th><th>จำนวน</th><th>รวม</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="staging-actions">
        <button type="button" class="staging-confirm-btn" data-action="staging-confirm" data-budget-index="${budgetIndex}">✓ ยืนยันเพิ่ม ${list.length} รายการ</button>
        <button type="button" class="staging-clear-btn" data-action="staging-clear" data-budget-index="${budgetIndex}">ล้างทั้งหมด</button>
      </div>`;
  }

  function handleStagingEvent(event) {
    const target = event.target;
    const idx = target.dataset?.stagingIdx !== undefined ? Number(target.dataset.stagingIdx) : null;
    const stagingContainer = target.closest("[id^='staging-']");
    if (!stagingContainer) return;
    const budgetIndex = Number(stagingContainer.id.replace("staging-", ""));
    const list = getStagingList(budgetIndex);

    if (target.classList.contains("staging-qty-input") && idx !== null) {
      const val = parseFloat(target.value);
      if (Number.isFinite(val) && val > 0) {
        list[idx].qty = val;
        renderStagingTable(budgetIndex);
      }
      return;
    }
    if (target.classList.contains("staging-labor-select") && idx !== null) {
      const li = Number(target.value);
      const labor = list[idx].laborOptions[li];
      if (labor) {
        list[idx].laborIndex = li;
        list[idx].labPrice = labor.price;
        list[idx].laborDesc = labor.desc;
        renderStagingTable(budgetIndex);
      }
      return;
    }
    if (target.classList.contains("staging-remove") && idx !== null) {
      list.splice(idx, 1);
      renderStagingTable(budgetIndex);
      return;
    }
  }

  function confirmStaging(budgetIndex) {
    const list = getStagingList(budgetIndex);
    if (!list.length) return;
    list.forEach(entry => {
      state.budgets[budgetIndex].items.push({
        ...entry,
        total: (entry.matPrice + entry.labPrice) * entry.qty
      });
    });
    state.staging[budgetIndex] = [];
    render();
  }

  function clearStaging(budgetIndex) {
    state.staging[budgetIndex] = [];
    renderStagingTable(budgetIndex);
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

  // GAS ตอบกลับหลายรูปแบบเมื่อผิดพลาด (บางกรณีเป็นหน้า HTML ขออนุญาต Google ที่ได้ HTTP 200)
  // ถ้าไม่ตรวจให้ชัด จะขึ้น "บันทึกสำเร็จ" แล้วล้าง state ทิ้งทั้งที่ยังไม่ได้เขียนลงชีต
  function assertSaveSucceeded(result) {
    if (result == null) {
      throw new Error("เซิร์ฟเวอร์ไม่ตอบกลับ — ยังไม่ได้บันทึก");
    }
    if (typeof result !== "object") {
      console.error("saveProject: unexpected response", result);
      throw new Error(
        "เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ (อาจเป็นหน้าขออนุญาตของ Google) — ยังไม่ได้บันทึก"
      );
    }
    if (result.status === "error" || result.error || result.blocked) {
      throw new Error(result.msg || result.message || "บันทึกไม่สำเร็จ");
    }
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
      assertSaveSucceeded(result);
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
    state.activeSurveyMeta = null;
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
      const rows = await window.ApiService.getSavedProjects();
      // GAS คืน [] ทั้งตอนไม่มีข้อมูลและตอน error — ถ้าไม่ใช่ array แปลว่าอ่านไม่สำเร็จจริง
      // อย่าปล่อยให้ขึ้น "ยังไม่มีประวัติโครงการ" เพราะทำให้เข้าใจผิดว่าบันทึกไม่ติด
      if (!Array.isArray(rows)) {
        console.error("getSavedProjects: unexpected response", rows);
        throw new Error(
          (rows && (rows.msg || rows.message)) ||
          "เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ (อาจเป็นหน้าขออนุญาตของ Google)"
        );
      }
      state.historyCache = rows;
      await loadShareUserList();
      renderHistory(rows);
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

  function parseUserList(value) {
    return String(value || "")
      .split(/[,;|/\s]+/)
      .map(part => part.trim())
      .filter(Boolean);
  }

  function userInShareList(listValue, username) {
    const me = String(username || "").trim().toLowerCase();
    if (!me) return false;
    return parseUserList(listValue).some(name => name.toLowerCase() === me);
  }

  async function loadShareUserList(force = false) {
    if (!force && state.shareUserList) return state.shareUserList;
    try {
      const res = await window.ApiService.getShareUsers();
      if (res?.error) throw new Error(res.msg || "โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
      state.shareUserList = res.users || [];
    } catch (error) {
      console.warn("share users load failed", error);
      state.shareUserList = state.shareUserList || [];
    }
    return state.shareUserList;
  }

  function getShareCoverageStatus(cached, shareUsers) {
    const isPublic = /^(Y|YES|TRUE|1|ใช้งาน)$/i.test(String(cached?.isPublic || ""));
    if (isPublic) {
      return { complete: true, remaining: [], coveredCount: shareUsers.length, total: shareUsers.length };
    }

    const viewSet = new Set(parseUserList(cached?.sharedView).map(u => u.toLowerCase()));
    const editSet = new Set(parseUserList(cached?.sharedEdit).map(u => u.toLowerCase()));
    const remaining = (shareUsers || []).filter(user => {
      const key = user.username.toLowerCase();
      return !viewSet.has(key) && !editSet.has(key);
    });

    return {
      complete: shareUsers.length === 0 ? true : remaining.length === 0,
      remaining,
      coveredCount: shareUsers.length - remaining.length,
      total: shareUsers.length
    };
  }

  // ผู้ใช้ที่สมัครผ่าน LINE มี username เป็น LINE userId (U + hex 32 ตัว) อ่านไม่รู้เรื่อง
  // — ใช้ชื่อโปรไฟล์ถ้า backend ส่งมา ไม่งั้นย่อเป็น "ผู้ใช้ LINE (…ท้าย 6 ตัว)"
  function formatShareUserName(user) {
    const display = user?.displayName || user?.name || user?.nickname;
    if (display) return String(display);
    const username = String(user?.username || "");
    if (/^U[0-9a-f]{30,}$/i.test(username)) {
      return `ผู้ใช้ LINE (…${username.slice(-6)})`;
    }
    return username;
  }

  function buildSharePickerHtml(cached, shareUsers, coverage) {
    const viewSet = new Set(parseUserList(cached.sharedView).map(u => u.toLowerCase()));
    const editSet = new Set(parseUserList(cached.sharedEdit).map(u => u.toLowerCase()));
    const isPublic = /^(Y|YES|TRUE|1|ใช้งาน)$/i.test(String(cached.isPublic || ""));

    const rows = (shareUsers || []).map(user => {
      const key = user.username.toLowerCase();
      const viewChecked = (viewSet.has(key) || editSet.has(key)) ? "checked" : "";
      const editChecked = editSet.has(key) ? "checked" : "";
      return `
        <div class="share-user-row">
          <span class="share-user-name" title="${escapeHtml(user.username)}">${escapeHtml(formatShareUserName(user))}</span>
          <span class="share-user-role">${escapeHtml(user.role || "user")}</span>
          <label class="share-user-check">
            <input type="checkbox" class="share-cb-view" data-user="${escapeHtml(user.username)}" ${viewChecked}>
            <span>ดู</span>
          </label>
          <label class="share-user-check">
            <input type="checkbox" class="share-cb-edit" data-user="${escapeHtml(user.username)}" ${editChecked}>
            <span>แก้ไข</span>
          </label>
        </div>
      `;
    }).join("");

    const remainingHint = coverage.remaining.length
      ? `<p class="share-remaining">ยังไม่ได้แชร์: ${coverage.remaining.map(u => escapeHtml(formatShareUserName(u))).join(", ")}</p>`
      : `<p class="share-remaining share-remaining-done">แชร์ครบทุกผู้ใช้แล้ว</p>`;

    return `
      <div class="share-form share-picker">
        <p class="share-label">เลือกผู้ใช้จากชีต Config (ติ๊กสิทธิ์ ดู / แก้ไข)</p>
        <div class="share-user-grid">${rows || `<div class="share-empty">ไม่มีผู้ใช้อื่นในระบบ</div>`}</div>
        ${shareUsers.length ? remainingHint : ""}
        <label class="share-check">
          <input id="sharePublic" type="checkbox" ${isPublic ? "checked" : ""}>
          เปิดให้ทุกคนในระบบเห็น (Public)
        </label>
      </div>
    `;
  }

  function collectSharePickerValues(popup) {
    const viewUsers = [];
    const editUsers = [];
    popup.querySelectorAll(".share-cb-view:checked").forEach(input => {
      if (input.dataset.user) viewUsers.push(input.dataset.user);
    });
    popup.querySelectorAll(".share-cb-edit:checked").forEach(input => {
      if (input.dataset.user) {
        editUsers.push(input.dataset.user);
        if (!viewUsers.includes(input.dataset.user)) viewUsers.push(input.dataset.user);
      }
    });
    return {
      sharedView: viewUsers.join(","),
      sharedEdit: editUsers.join(","),
      isPublic: popup.querySelector("#sharePublic")?.checked === true
    };
  }

  function resetSwalActionState(popup) {
    if (!popup) return;
    popup.classList.remove("swal2-loading");
    popup.removeAttribute("data-loading");
    popup.removeAttribute("aria-busy");
    const actions = popup.querySelector(".swal2-actions");
    actions?.classList.remove("swal2-loading");
    const loader = popup.querySelector(".swal2-loader");
    if (loader) loader.style.display = "none";
    const confirmBtn = popup.querySelector(".swal2-confirm");
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.style.removeProperty("display");
    }
    const cancelBtn = popup.querySelector(".swal2-cancel");
    if (cancelBtn) cancelBtn.disabled = false;
  }

  function wireSharePickerEvents(popup) {
    popup.querySelectorAll(".share-cb-edit").forEach(editBox => {
      editBox.addEventListener("change", () => {
        if (!editBox.checked) return;
        const viewBox = popup.querySelector(`.share-cb-view[data-user="${CSS.escape(editBox.dataset.user || "")}"]`);
        if (viewBox) viewBox.checked = true;
      });
    });
    popup.querySelectorAll(".share-cb-view").forEach(viewBox => {
      viewBox.addEventListener("change", () => {
        if (viewBox.checked) return;
        const editBox = popup.querySelector(`.share-cb-edit[data-user="${CSS.escape(viewBox.dataset.user || "")}"]`);
        if (editBox) editBox.checked = false;
      });
    });
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

  function getHistoryCardAccentClass(row, shareFields) {
    const me = window.AuthSession?.getUsername?.() || "";
    const createdBy = String(row[6] || "");
    const isPublic = /^(Y|YES|TRUE|1|ใช้งาน)$/i.test(String(shareFields.isPublic || ""));

    if (createdBy && createdBy === me) return "history-accent-own";
    if (userInShareList(shareFields.sharedEdit, me)) return "history-accent-edit";
    if (isPublic) return "history-accent-public";
    if (userInShareList(shareFields.sharedView, me) || shareFields.sharedView || shareFields.sharedEdit) {
      return "history-accent-shared";
    }
    return "history-accent-legacy";
  }

  function parseHistoryDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return 0;
    const ts = Date.parse(raw);
    return Number.isFinite(ts) ? ts : 0;
  }

  function sortAndFilterHistoryData(data) {
    const term = (els.histSearch?.value || "").toLowerCase();
    const sort = els.histSort?.value || "newest";
    const mineOnly = els.histMineOnly?.checked === true;
    const me = window.AuthSession?.getUsername?.() || "";

    let rows = Array.isArray(data) ? [...data] : [];

    if (mineOnly && me) {
      rows = rows.filter(row => String(row[6] || "") === me);
    }
    if (term) {
      rows = rows.filter(row => String(row[2] || "").toLowerCase().includes(term));
    }

    rows.sort((a, b) => {
      if (sort === "oldest") {
        return parseHistoryDate(a[1]) - parseHistoryDate(b[1]);
      }
      if (sort === "amount-desc") {
        return parseFloat(b[3] || 0) - parseFloat(a[3] || 0);
      }
      if (sort === "amount-asc") {
        return parseFloat(a[3] || 0) - parseFloat(b[3] || 0);
      }
      return parseHistoryDate(b[1]) - parseHistoryDate(a[1]);
    });

    return rows;
  }

  function handleHistoryClick(event) {
    const shareBtn = event.target.closest("[data-action='share-project']");
    if (shareBtn) {
      shareBtn.closest(".history-more")?.removeAttribute("open");
      askShare(shareBtn.dataset.projectId);
      return;
    }

    const moreSummary = event.target.closest(".history-more summary");
    if (moreSummary) {
      const current = moreSummary.closest(".history-more");
      els.histContent.querySelectorAll(".history-more[open]").forEach(el => {
        if (el !== current) el.removeAttribute("open");
      });
    }
  }

  async function askShare(projectId) {
    const cached = state.historyRowCache[projectId] || {};
    if (!canShareHistoryProject(cached)) {
      Swal.fire("ไม่มีสิทธิ์", "เฉพาะเจ้าของโครงการเท่านั้นที่แชร์ได้", "warning");
      return;
    }

    Swal.fire({
      title: "กำลังโหลดรายชื่อ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    let shareUsers = [];
    try {
      shareUsers = await loadShareUserList();
    } finally {
      Swal.close();
      Swal.hideLoading();
    }

    const coverage = getShareCoverageStatus(cached, shareUsers);

    if (coverage.complete && !shareUsers.length) {
      Swal.fire("ไม่มีผู้ใช้อื่น", "ใน Config มีเพียงบัญชีของคุณ", "info");
      return;
    }

    const html = buildSharePickerHtml(cached, shareUsers, coverage);

    const shareDialog = await Swal.fire({
      title: "แชร์โครงการ",
      html,
      width: "min(100%, 440px)",
      showCancelButton: true,
      showLoaderOnConfirm: false,
      confirmButtonText: coverage.complete ? "อัปเดตการแชร์" : "บันทึกการแชร์",
      cancelButtonText: "ยกเลิก",
      didOpen: () => {
        const popup = Swal.getPopup();
        resetSwalActionState(popup);
        wireSharePickerEvents(popup);
      },
      preConfirm: () => collectSharePickerValues(Swal.getPopup())
    });

    if (!shareDialog.isConfirmed) return;

    const picked = shareDialog.value || {};

    Swal.fire({
      title: "กำลังบันทึก...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const result = await window.ApiService.shareProject({
        projectId,
        sharedView: picked.sharedView || "",
        sharedEdit: picked.sharedEdit || "",
        isPublic: picked.isPublic === true
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
    updateImpactStrip(data);
    const rows = sortAndFilterHistoryData(data);

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

    if (!rows.length) {
      els.histContent.innerHTML = `
        <div class="empty-state">
          <div>ไม่พบโครงการตามเงื่อนไขที่เลือก</div>
          <div style="font-size:12px;">ลองเปลี่ยนคำค้นหา หรือยกเลิกตัวกรอง "ของฉันเท่านั้น"</div>
        </div>
      `;
      return;
    }

    els.histContent.innerHTML = `
      <div class="history-list">
        ${rows.map((row, index) => {
      const dateDisplay = safeDateDisplay(row[1]);
      const projectId = String(row[0] || "");
      const shareFields = parseHistoryShareFields(row);
      state.historyRowCache[projectId] = {
        name: String(row[2] || ""),
        imgStr: String(row[4] || ""),
        surveyMetaStr: String(row[5] || ""),
        createdBy: String(row[6] || ""),
        grandTotal: parseFloat(row[3] || 0),
        dateDisplay: safeDateDisplay(row[1]),
        sharedView: shareFields.sharedView,
        sharedEdit: shareFields.sharedEdit,
        isPublic: shareFields.isPublic
      };
      const cached = state.historyRowCache[projectId];
      const canManage = canManageHistoryProject(cached);
      const canShare = canShareHistoryProject(cached);
      const coverage = getShareCoverageStatus(cached, state.shareUserList || []);
      const accentClass = getHistoryCardAccentClass(row, shareFields);
      const shareBtn = canShare
        ? (coverage.complete
          ? `<button class="action-btn" type="button" data-action="share-project" data-project-id="${escapeHtml(projectId)}" title="จัดการสิทธิ์แชร์">จัดการแชร์</button>`
          : `<button class="action-btn" type="button" data-action="share-project" data-project-id="${escapeHtml(projectId)}" title="ยังไม่ได้แชร์ ${coverage.remaining.length} คน">แชร์ (${coverage.remaining.length})</button>`)
        : "";
      const viewBtn = `<button class="action-btn" type="button" onclick="window.AppActions.viewDetail('${escapeJs(projectId)}')">ดู</button>`;
      const editBtn = canManage
        ? `<button class="action-btn" type="button" onclick="window.AppActions.askEdit('${escapeJs(projectId)}')">แก้ไข</button>`
        : "";
      const deleteBtn = canManage
        ? `<button class="action-btn danger" type="button" onclick="window.AppActions.askDel('${escapeJs(projectId)}')">ลบ</button>`
        : "";
      const shareSummary = canShare && coverage.total
        ? `<span class="history-share-chip">${coverage.complete ? "แชร์ครบ" : `แชร์แล้ว ${coverage.coveredCount}/${coverage.total}`}</span>`
        : "";
      const actionButtons = [viewBtn, shareBtn, editBtn, deleteBtn].filter(Boolean).join("");
      return `
        <article class="history-card ${accentClass}" data-project-id="${escapeHtml(projectId)}">
          <div class="history-row history-row-main history-map-trigger" role="button" tabindex="0" title="คลิกเพื่อดูแผนที่สำรวจ" onclick="window.AppActions.previewSurveyMap('${escapeJs(projectId)}')">
            <span class="history-index">${index + 1}</span>
            <div class="history-main-body">
              <h3 class="history-name">${escapeHtml(row[2])}</h3>
              <div class="history-meta">
                <span class="status-chip">${escapeHtml(dateDisplay)}</span>
                <span class="type-chip">ID ${escapeHtml(projectId)}</span>
                ${getHistoryAccessBadge(row, shareFields)}
                ${shareSummary}
              </div>
            </div>
          </div>
          <div class="history-row history-row-actions">
            <div class="history-amount">
              ${parseFloat(row[3] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
            </div>
            <div class="history-actions history-actions-inline">
              ${actionButtons}
            </div>
            <details class="history-more">
              <summary class="history-more-btn" aria-label="เมนูเพิ่มเติม">⋮</summary>
              <div class="history-more-menu">
                ${actionButtons}
              </div>
            </details>
          </div>
        </article>
      `;
    }).join("")}
      </div>
    `;
  }

  function parseAuditDetailObject(detailStr) {
    if (!detailStr) return null;
    try {
      const parsed = JSON.parse(detailStr);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function formatAuditDetailHtml(entry) {
    const parsed = parseAuditDetailObject(entry.detail);
    const action = String(entry.action || "").toLowerCase();

    if (action === "share" && parsed) {
      const viewUsers = parseUserList(parsed.sharedView);
      const editUsers = parseUserList(parsed.sharedEdit);
      const isPublic = /^(Y|YES|TRUE|1|ใช้งาน)$/i.test(String(parsed.isPublic || ""));
      const parts = [];
      if (viewUsers.length) {
        parts.push(`<span class="audit-badge audit-badge-view">ดู: ${viewUsers.map(u => escapeHtml(u)).join(", ")}</span>`);
      }
      if (editUsers.length) {
        parts.push(`<span class="audit-badge audit-badge-edit">แก้: ${editUsers.map(u => escapeHtml(u)).join(", ")}</span>`);
      }
      if (isPublic) {
        parts.push(`<span class="audit-badge audit-badge-public">Public</span>`);
      }
      if (!parts.length) {
        parts.push(`<span class="audit-muted">ไม่มีผู้ใช้ / ว่าง</span>`);
      }
      return `<div class="audit-detail-badges">${parts.join("")}</div>`;
    }

    if (action === "delete" && parsed?.name) {
      return `<span class="audit-muted">ลบ: ${escapeHtml(parsed.name)}</span>`;
    }

    if (parsed) {
      return `<code class="audit-raw">${escapeHtml(JSON.stringify(parsed))}</code>`;
    }

    return `<span class="audit-muted">${escapeHtml(entry.detail || "-")}</span>`;
  }

  function getAdminAuditFilters() {
    return {
      search: (els.adminAuditSearch?.value || "").trim().toLowerCase(),
      action: els.adminAuditAction?.value || "all"
    };
  }

  function filterAdminAuditRows(audit, filters) {
    return (audit || []).filter(entry => {
      if (filters.action !== "all" && String(entry.action || "").toLowerCase() !== filters.action) {
        return false;
      }
      if (filters.search) {
        const haystack = [
          entry.timestamp,
          entry.username,
          entry.action,
          entry.projectId,
          entry.detail
        ].join(" ").toLowerCase();
        if (!haystack.includes(filters.search)) return false;
      }
      return true;
    });
  }

  function renderAdminAuditTable(audit) {
    if (!els.adminAudit) return;

    const filters = getAdminAuditFilters();
    const rows = filterAdminAuditRows(audit, filters);

    els.adminAudit.innerHTML = rows.length
      ? `<table class="admin-table admin-audit-table"><thead><tr><th>เวลา</th><th>User</th><th>Action</th><th>Project</th><th>Detail</th></tr></thead><tbody>${
          rows.map(entry => `
            <tr>
              <td class="audit-time">${escapeHtml(safeDateDisplay(entry.timestamp))}</td>
              <td>${escapeHtml(entry.username || "-")}</td>
              <td><span class="audit-action audit-action-${escapeHtml(String(entry.action || "").toLowerCase())}">${escapeHtml(entry.action || "-")}</span></td>
              <td class="audit-project">${escapeHtml(entry.projectId || "-")}</td>
              <td class="audit-detail">${formatAuditDetailHtml(entry)}</td>
            </tr>
          `).join("")
        }</tbody></table>`
      : `<div class="empty-state">ไม่พบ audit ตามเงื่อนไข</div>`;
  }

  function renderAdminAuditFromCache() {
    if (!state.adminCache) return;
    renderAdminAuditTable(state.adminCache.audit || []);
  }

  function exportAdminAuditCsv() {
    if (!state.adminCache?.audit?.length) {
      Swal.fire("ไม่มีข้อมูล", "ยังไม่มี audit log", "info");
      return;
    }

    const rows = filterAdminAuditRows(state.adminCache.audit, getAdminAuditFilters());
    if (!rows.length) {
      Swal.fire("ไม่มีข้อมูล", "ไม่พบรายการตามตัวกรอง", "info");
      return;
    }

    const sheetRows = rows.map(entry => ({
      Timestamp: entry.timestamp || "",
      Username: entry.username || "",
      Action: entry.action || "",
      ProjectId: entry.projectId || "",
      Detail: entry.detail || ""
    }));

    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit");
    XLSX.writeFile(wb, `Project_Audit_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function buildBudgetBreakdownPrintHtml(details) {
    const grouped = {};
    (details || []).forEach(detail => {
      const type = window.BudgetFormula.normalizeBudgetType(detail.type);
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(enrichDetailLineWithMaster(detail));
    });

    return Object.entries(grouped).map(([type, items]) => {
      const totals = window.BudgetFormula.computeBudgetTotalsFromItems(items, type);
      const rows = window.BudgetFormula.getBudgetBreakdownRows(totals, type);

      return `
        <section class="report-section">
          <h2>สรุปงบ ${escapeHtml(type)}</h2>
          <table class="table-kv table-compact">
            <tbody>
              ${rows.map(([label, amount]) => `
                <tr><td class="kv-label">${escapeHtml(label)}</td><td class="num kv-value">${formatBudgetAmount(amount)}</td></tr>
              `).join("")}
              <tr class="total-row"><td class="kv-label"><strong>สุทธิ (${escapeHtml(type)})</strong></td><td class="num kv-value"><strong>${formatBudgetAmount(totals.total)}</strong></td></tr>
            </tbody>
          </table>
        </section>
      `;
    }).join("");
  }

  function buildSurveyMetaPrintHtml(surveyMetaStr) {
    if (!surveyMetaStr) return "";
    try {
      const meta = JSON.parse(surveyMetaStr);
      if (!meta || meta.startLat == null) return "";
      const poleCount = meta.poleCount ?? "-";
      const totalDistanceM = meta.totalDistanceM ?? "-";
      const spanM = meta.spanM ?? meta.segments?.find(seg => seg.spanM)?.spanM ?? "-";
      const stats = meta.poleStats;
      const statsRows = stats ? `
              <tr><td class="kv-label">เสาทางตรง</td><td class="kv-value">${stats.straightRun ?? 0} ต้น</td></tr>
              <tr><td class="kv-label">เข้า/ออกโค้ง</td><td class="kv-value">${stats.curveEntryExit ?? 0} ต้น</td></tr>
              <tr><td class="kv-label">เสาภายในโค้ง</td><td class="kv-value">${stats.curveInterior ?? 0} ต้น</td></tr>
              <tr><td class="kv-label">เสาต้นสุดท้าย</td><td class="kv-value">${stats.endPoles ?? 0} ต้น</td></tr>
              <tr><td class="kv-label">จุดต่อเดิม (ไม่ตั้งใหม่)</td><td class="kv-value">${stats.startPoles ?? 0} ต้น</td></tr>
              <tr><td class="kv-label">ยึดโยง (Guy)</td><td class="kv-value">${stats.guySets ?? 0} ชุด</td></tr>
      ` : "";
      const setUsageHtml = "";
      return `
        <section class="report-section">
          <h2>ข้อมูลสำรวจ</h2>
          <table class="table-kv table-compact">
            <tbody>
              <tr><td class="kv-label">จุดเริ่ม</td><td class="kv-value">${Number(meta.startLat).toFixed(6)}, ${Number(meta.startLng).toFixed(6)}</td></tr>
              <tr><td class="kv-label">จุดสิ้นสุด</td><td class="kv-value">${Number(meta.endLat).toFixed(6)}, ${Number(meta.endLng).toFixed(6)}</td></tr>
              <tr><td class="kv-label">หมุด / ระยะ / Span</td><td class="kv-value">${poleCount} หมุด · ${totalDistanceM} ม. · Span ${spanM} ม.</td></tr>
              ${statsRows}
            </tbody>
          </table>
        </section>
        ${setUsageHtml}
      `;
    } catch (error) {
      return "";
    }
  }

  function collectReportMediaItems(imgStr, previews) {
    const urls = imgStr ? imgStr.split("|").filter(Boolean) : [];
    const sorted = [...urls].sort((a, b) => {
      const aMap = /Survey_Map/i.test(a);
      const bMap = /Survey_Map/i.test(b);
      if (aMap && !bMap) return -1;
      if (!aMap && bMap) return 1;
      return 0;
    });

    let siteIndex = 0;
    return sorted.map(url => {
      const fileId = extractDriveFileId(url);
      const preview = fileId && previews ? previews[fileId] : null;
      const fileName = preview?.name ? String(preview.name) : "";
      const isSurveyMap = /Survey_Map/i.test(url) || /Survey_Map/i.test(fileName);
      const label = isSurveyMap
        ? "แผนที่สำรวจ (ปักหมุด)"
        : `รูป/ไฟล์หน้างาน ${++siteIndex}`;

      if (preview?.base64 && preview.mime?.startsWith("image/")) {
        return {
          label,
          dataUrl: `data:${preview.mime};base64,${preview.base64}`
        };
      }
      return null;
    }).filter(Boolean);
  }

  function buildReportMediaPrintHtml(imgStr, previews) {
    const items = collectReportMediaItems(imgStr, previews);
    if (!items.length) return "";

    return `
      <section class="report-section report-media">
        <h2>รูป/แผนที่หน้างาน</h2>
        <div class="report-media-grid">
          ${items.map(item => `
            <figure class="report-media-item">
              <figcaption>${escapeHtml(item.label)}</figcaption>
              <img src="${item.dataUrl}" alt="${escapeHtml(item.label)}">
            </figure>
          `).join("")}
        </div>
      </section>
    `;
  }

  function computeProjectGrandTotal(details, fallbackTotal) {
    const parsedFallback = parseFloat(fallbackTotal);
    if (Number.isFinite(parsedFallback) && parsedFallback > 0) return parsedFallback;

    const grouped = {};
    (details || []).forEach(detail => {
      const type = window.BudgetFormula.normalizeBudgetType(detail.type);
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(enrichDetailLineWithMaster(detail));
    });

    return Object.entries(grouped).reduce((sum, [type, items]) => {
      const totals = window.BudgetFormula.computeBudgetTotalsFromItems(items, type);
      return sum + (totals.total || 0);
    }, 0);
  }

  function buildProjectReportPrintHtml(options) {
    const {
      name,
      projectId,
      dateDisplay,
      createdBy,
      details,
      surveyMetaStr,
      previews,
      imgStr,
      grandTotal
    } = options;

    let surveyMeta = null;
    if (surveyMetaStr) {
      try {
        surveyMeta = JSON.parse(surveyMetaStr);
      } catch (error) {
        surveyMeta = null;
      }
    }

    const lineRows = buildGroupedDetailTableBodyHtml(details, mergeDisplayMeta(surveyMeta, details), {
      includeBudget: true,
      includeTotal: true
    });

    const mediaHtml = buildReportMediaPrintHtml(imgStr, previews);

    return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>${escapeHtml(name)}</title>
      <style>
        @page { margin: 16mm; }
        body { font-family: Sarabun, sans-serif; padding: 0; color: #111; font-size: 12px; line-height: 1.45; }
        h1 { font-size: 22px; margin: 0 0 6px; }
        h2 { font-size: 15px; margin: 0 0 8px; color: #333; }
        .report-meta { color: #555; margin-bottom: 18px; font-size: 13px; }
        .report-grand { margin: 16px 0 20px; padding: 12px 14px; border: 2px solid #333; text-align: right; font-size: 18px; font-weight: 700; }
        .report-section { margin-bottom: 18px; page-break-inside: avoid; }
        table { border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #ccc; padding: 5px 7px; vertical-align: top; }
        th { background: #f3f3f3; }
        .table-kv {
          width: auto;
          max-width: 420px;
          table-layout: fixed;
        }
        .table-kv .kv-label {
          width: 108px;
          white-space: nowrap;
          padding: 3px 8px 3px 6px;
        }
        .table-kv .kv-value {
          width: auto;
          padding: 3px 6px;
        }
        .table-compact th,
        .table-compact td {
          padding: 3px 6px;
          font-size: 10px;
          line-height: 1.35;
        }
        .table-boq {
          width: auto;
          max-width: 100%;
          table-layout: auto;
          font-size: 10px;
        }
        .table-boq th,
        .table-boq td {
          padding: 3px 5px;
          line-height: 1.35;
          vertical-align: top;
        }
        .table-boq .col-type-label,
        .table-boq .col-id,
        .table-boq .col-qty,
        .table-boq .col-total {
          width: 1%;
          white-space: nowrap;
        }
        .table-boq .col-name {
          max-width: 220px;
          white-space: normal;
          word-wrap: break-word;
          overflow-wrap: anywhere;
        }
        .detail-set-row td {
          background: #f0e8ef;
        }
        .detail-set-row .set-aware-type,
        .detail-set-row .set-aware-code {
          color: #74045f;
          font-weight: 700;
        }
        .detail-set-item-row td {
          background: #faf6fb;
        }
        .detail-set-item-row .set-aware-type {
          color: #8b5a82;
          font-size: 10px;
        }
        .detail-set-item-row .set-aware-code,
        .detail-set-item-row .set-aware-name {
          padding-left: 10px;
        }
        .detail-set-item-row .set-aware-name::before {
          content: "↳ ";
          color: #999;
        }
        .detail-set-group-start:not(:first-child) td {
          border-top: 2px solid #d8b8d0;
        }
        .detail-set-section-row td {
          background: #f3f3f3;
          color: #555;
          font-weight: 700;
          font-size: 10px;
        }
        .detail-material-row td {
          background: #fff;
        }
        .detail-set-group-row td {
          background: #f0e8ef;
          font-size: 10px;
          font-weight: 700;
          color: #74045f;
        }
        .detail-set-group-row.is-ungrouped td {
          background: #f7f7f7;
          color: #666;
        }
        .detail-set-item-row td {
          background: #fcfafc;
        }
        .detail-set-group-note {
          font-weight: 400;
          color: #555;
          margin-left: 6px;
        }
        .total-row td { background: #fafafa; }
        .report-media-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .report-media-item {
          margin: 0;
          page-break-inside: avoid;
        }
        .report-media-item figcaption {
          margin: 0 0 4px;
          font-size: 11px;
          font-weight: 700;
          color: #444;
        }
        .report-media-item img {
          width: 100%;
          max-height: 360px;
          object-fit: contain;
          border: 1px solid #ccc;
        }
        .report-footer { margin-top: 24px; font-size: 10px; color: #777; text-align: center; }
      </style></head><body>
      <h1>${escapeHtml(name)}</h1>
      <div class="report-meta">
        รหัสโครงการ: ${escapeHtml(projectId || "-")}<br>
        วันที่: ${escapeHtml(dateDisplay || "-")} · เจ้าของ: ${escapeHtml(createdBy || "-")}<br>
        ออกรายงาน: ${escapeHtml(new Date().toLocaleString("th-TH"))}
      </div>
      ${buildSurveyMetaPrintHtml(surveyMetaStr)}
      ${mediaHtml}
      ${buildBudgetBreakdownPrintHtml(details)}
      <section class="report-section">
        <h2>รายการพัสดุ / ชุด SET</h2>
        <p style="margin:0 0 8px;font-size:10px;color:#555;">แต่ละชุด SET ตามด้วยรายการพัสดุในชุด — กรอกรหัสชุดแล้วจะได้พัสดุตามรายการด้านล่าง</p>
        <table class="table-boq">
          <colgroup>
            <col class="col-no">
            <col class="col-type">
            <col class="col-type-label">
            <col class="col-id">
            <col class="col-name">
            <col class="col-qty">
            <col class="col-total">
          </colgroup>
          <thead><tr><th>#</th><th>งบ</th><th>ประเภท</th><th>รหัส</th><th>รายการ</th><th>จำนวน</th><th>รวม</th></tr></thead>
          <tbody>${lineRows}</tbody>
        </table>
      </section>
      <div class="report-grand">ยอดรวมโครงการ ${formatBudgetAmount(grandTotal)} บาท</div>
      <div class="report-footer">PEA Estimation AI Pro — รายงาน BOQ และสำรวจ</div>
      </body></html>`;
  }

  async function exportProjectReportPdf(projectId) {
    const cached = state.historyRowCache[projectId] || {};
    const name = cached.name || projectId;
    const imgStr = cached.imgStr || "";
    const surveyMetaStr = cached.surveyMetaStr || "";

    Swal.fire({
      title: "กำลังเตรียม PDF...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const details = await window.ApiService.getProjectDetails(projectId);
      if (details?.error) {
        Swal.fire("ไม่มีสิทธิ์", details.msg || "ไม่สามารถดูโครงการนี้ได้", "warning");
        return;
      }
      if (!Array.isArray(details) || !details.length) {
        Swal.fire("ไม่พบข้อมูล", "ไม่พบรายละเอียดพัสดุ", "warning");
        return;
      }

      const urls = imgStr ? imgStr.split("|").filter(Boolean) : [];
      const previews = await fetchDrivePreviews(urls);
      const grandTotal = computeProjectGrandTotal(details, cached.grandTotal);

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        Swal.fire("ไม่สามารถเปิดหน้าพิมพ์", "อนุญาต pop-up แล้วลองใหม่", "warning");
        return;
      }

      Swal.close();
      printWindow.document.write(buildProjectReportPrintHtml({
        name,
        projectId,
        dateDisplay: cached.dateDisplay || "",
        createdBy: cached.createdBy || "",
        details,
        surveyMetaStr,
        previews,
        imgStr,
        grandTotal
      }));
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 400);
    } catch (error) {
      console.error(error);
      Swal.fire("สร้าง PDF ไม่สำเร็จ", error.message || "เกิดข้อผิดพลาด", "error");
    }
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
    renderAdminAuditTable(audit);
    renderAdminPriceAskFeedback();
  }

  function renderAdminPriceAskFeedback() {
    if (!els.adminPriceAskFeedback || !window.PriceAskFeedback?.renderAdminSummaryHtml) return;
    els.adminPriceAskFeedback.innerHTML = window.PriceAskFeedback.renderAdminSummaryHtml();
    window.PriceAskFeedback.bindAdminPanel(els.adminPriceAskFeedback);
  }

  function filterHistory() {
    if (!state.historyCache) return;
    renderHistory(state.historyCache);
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
      const html = buildDetailHtml(details, imgStr, name, surveyMetaStr, previews, id);
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

  function buildMaterialSetLabel(materialId, meta) {
    const ids = resolveMaterialSetIds(materialId, meta);
    return ids.length ? ids.join(", ") : "—";
  }

  function getSetComponentMaterialIds(meta, details) {
    const setUsage = resolveDisplaySetUsage(meta, details);
    if (!setUsage.length) return new Set();
    const api = window.SurveyPresetsApi;
    const lookup = window.SurveyProject?.buildMaterialSetLookup?.(setUsage, api) || {};
    return new Set(Object.keys(lookup).map(id => String(id).trim()).filter(Boolean));
  }

  function resolveDisplaySetUsage(meta, details) {
    if (meta?.setUsage?.length) return meta.setUsage;
    if (window.SurveyProject?.inferSetUsageFromDetails) {
      return window.SurveyProject.inferSetUsageFromDetails(details, window.SurveyPresetsApi);
    }
    return [];
  }

  function mergeDisplayMeta(meta, details) {
    const setUsage = resolveDisplaySetUsage(meta, details);
    if (!setUsage.length) return meta || null;
    return { ...(meta || {}), setUsage };
  }

  function buildSetAwareDisplayRows(details, meta) {
    const displayMeta = mergeDisplayMeta(meta, details);
    const setUsage = displayMeta?.setUsage || [];
    const normalizedDetails = (details || []).map(item => ({
      ...item,
      id: String(item.id || "").trim(),
      name: String(item.name || ""),
      qty: parseFloat(item.qty) || 0,
      total: parseFloat(item.total) || 0,
      type: String(item.type || "")
    }));

    if (!setUsage.length) {
      return normalizedDetails.map(item => ({
        rowType: "material",
        code: item.id,
        name: item.name,
        qty: item.qty,
        budgetType: item.type,
        total: item.total,
        setId: ""
      }));
    }

    const componentIds = getSetComponentMaterialIds(displayMeta, normalizedDetails);
    const rows = [];
    const api = window.SurveyPresetsApi;

    setUsage.forEach(entry => {
      const setId = String(entry.setId || "").trim();
      if (!setId) return;
      const setQty = parseFloat(entry.qty) || 0;
      const setName = entry.name || getSetDisplayName(setId, displayMeta);

      rows.push({
        rowType: "set",
        code: setId,
        name: setName,
        qty: setQty,
        budgetType: "",
        total: null,
        setId
      });

      const setObj = api?.getSet?.(setId);
      const setItems = setObj?.items || [];
      if (setItems.length) {
        setItems.forEach(item => {
          const matId = String(item.id || "").trim();
          if (!matId) return;
          const perSetQty = parseFloat(item.qty) || 0;
          const totalQty = perSetQty * setQty;
          rows.push({
            rowType: "set-item",
            code: matId,
            name: item.name || matId,
            qty: totalQty,
            qtyPerSet: perSetQty,
            budgetType: "",
            total: null,
            setId
          });
        });
      } else {
        normalizedDetails
          .filter(item => resolveMaterialSetIds(item.id, displayMeta).includes(setId))
          .forEach(item => {
            rows.push({
              rowType: "set-item",
              code: item.id,
              name: item.name,
              qty: item.qty,
              budgetType: item.type,
              total: item.total,
              setId
            });
          });
      }
    });

    const standaloneMap = new Map();
    normalizedDetails.forEach(item => {
      if (!item.id || componentIds.has(item.id)) return;
      const key = `${item.type}::${item.id}`;
      if (!standaloneMap.has(key)) {
        standaloneMap.set(key, {
          rowType: "material",
          code: item.id,
          name: item.name,
          qty: 0,
          budgetType: item.type,
          total: 0,
          setId: ""
        });
      }
      const row = standaloneMap.get(key);
      row.qty += item.qty;
      row.total += item.total;
    });

    const standaloneRows = [...standaloneMap.values()].sort((a, b) => a.code.localeCompare(b.code));
    if (standaloneRows.length) {
      rows.push({
        rowType: "section",
        code: "",
        name: "พัสดุเดี่ยว (นอกชุด SET — เสา สาย หม้อแปลง ฯลฯ)",
        qty: "",
        budgetType: "",
        total: null,
        setId: ""
      });
      standaloneRows.forEach(row => rows.push(row));
    }

    return rows;
  }

  function getRowTypeLabel(rowType) {
    if (rowType === "set") return "ชุด SET";
    if (rowType === "set-item") return "ใน SET";
    if (rowType === "section") return "";
    return "พัสดุ";
  }

  function getDisplayRowClass(row) {
    if (row.rowType === "set") return "detail-set-row detail-set-group-start";
    if (row.rowType === "set-item") return "detail-set-item-row detail-set-group-member";
    if (row.rowType === "section") return "detail-set-section-row";
    return "detail-material-row";
  }

  function resolveMaterialSetIds(materialId, meta) {
    const api = window.SurveyPresetsApi;
    if (window.SurveyProject?.resolveMaterialSetIds) {
      return window.SurveyProject.resolveMaterialSetIds(materialId, meta?.setUsage, api);
    }
    const lookup = window.SurveyProject?.buildMaterialSetLookup?.(meta?.setUsage || [], api) || {};
    return lookup[String(materialId).trim()] || [];
  }

  function getSetDisplayName(setId, meta) {
    const fromUsage = meta?.setUsage?.find(entry => String(entry.setId) === String(setId));
    if (fromUsage?.name) return fromUsage.name;
    const setObj = window.SurveyPresetsApi?.getSet?.(setId);
    return setObj?.name || setObj?.label || setId;
  }

  function sortDetailsForSetGrouping(details, meta) {
    return [...(details || [])].map((item, originalIndex) => {
      const setIds = resolveMaterialSetIds(item.id, meta);
      const primarySet = setIds[0] || "";
      return { item, setIds, primarySet, originalIndex };
    }).sort((a, b) => {
      if (a.primarySet && !b.primarySet) return -1;
      if (!a.primarySet && b.primarySet) return 1;
      if (a.primarySet !== b.primarySet) return a.primarySet.localeCompare(b.primarySet);
      return String(a.item.id).localeCompare(String(b.item.id));
    });
  }

  function getDetailTableColSpan(options = {}) {
    let cols = 5;
    if (options.includeBudget) cols += 1;
    if (options.includeTotal) cols += 1;
    return cols;
  }

  function buildGroupedDetailTableBodyHtml(details, meta, options = {}) {
    const includeBudget = Boolean(options.includeBudget);
    const includeTotal = Boolean(options.includeTotal);
    const displayRows = buildSetAwareDisplayRows(details, meta);
    let html = "";
    let rowNum = 0;

    displayRows.forEach(row => {
      if (row.rowType === "section") {
        const colSpan = getDetailTableColSpan({ includeBudget, includeTotal });
        html += `
          <tr class="${getDisplayRowClass(row)}">
            <td colspan="${colSpan}">${escapeHtml(row.name)}</td>
          </tr>
        `;
        return;
      }

      rowNum += 1;
      const rowClass = getDisplayRowClass(row);
      const qtyLabel = row.qty === "" ? "" : escapeHtml(formatQty(row.qty));
      const typeLabel = getRowTypeLabel(row.rowType);
      html += `
        <tr class="${rowClass}"${row.setId ? ` data-set-id="${escapeHtml(row.setId)}"` : ""}>
          <td>${rowNum}</td>
          ${includeBudget ? `<td>${escapeHtml(row.budgetType || "—")}</td>` : ""}
          <td class="set-aware-type">${escapeHtml(typeLabel)}</td>
          <td class="set-aware-code">${row.rowType === "set-item" ? escapeHtml(row.code) : `<strong>${escapeHtml(row.code)}</strong>`}</td>
          <td class="set-aware-name">${escapeHtml(row.name)}</td>
          <td class="set-aware-qty">${qtyLabel}</td>
          ${includeTotal ? `<td class="num set-aware-total">${row.rowType === "set" || row.rowType === "set-item" ? "—" : formatBudgetAmount(row.total || 0)}</td>` : ""}
        </tr>
      `;
    });

    return html;
  }

  function buildSetAwareDisplayTableHtml(details, meta, options = {}) {
    const title = options.title || "รายละเอียดพัสดุ / ชุด SET";
    const includeBudget = Boolean(options.includeBudget);
    const includeTotal = Boolean(options.includeTotal);
    const displayRows = buildSetAwareDisplayRows(details, meta);
    if (!displayRows.length) return "";

    const budgetHead = includeBudget ? "<th>งบ</th>" : "";
    const totalHead = includeTotal ? "<th>รวม</th>" : "";

    return `
      <div class="survey-set-box set-aware-display-box">
        <strong>${escapeHtml(title)}</strong>
        <p class="section-note set-aware-display-note">แต่ละชุด SET ตามด้วยรายการพัสดุในชุด — กรอกรหัสชุด SET ในโปรแกรมประมาณการแล้วจะได้พัสดุตามรายการด้านล่าง · ส่วน「พัสดุเดี่ยว」คือรายการที่กรอกเป็นรหัสพัสดุโดยตรง</p>
        <table class="detail-table set-aware-display-table">
          <thead>
            <tr>
              <th>#</th>
              ${budgetHead}
              <th>ประเภท</th>
              <th>รหัส</th>
              <th>รายการ</th>
              <th>จำนวน</th>
              ${totalHead}
            </tr>
          </thead>
          <tbody>
            ${buildGroupedDetailTableBodyHtml(details, meta, { includeBudget, includeTotal })}
          </tbody>
        </table>
      </div>
    `;
  }

  function buildEditSetSummaryHtml(meta) {
    const allDetails = state.budgets.flatMap(budget =>
      budget.items.map(item => ({ ...item, type: item.type || budget.type }))
    );
    if (!meta?.setUsage?.length) return buildSetUsageSummaryHtml(meta);
    return buildSetAwareDisplayTableHtml(allDetails, meta, {
      title: "รายละเอียดพัสดุ / ชุด SET (สำหรับกรอกโปรแกรม)"
    });
  }

  function buildSetUsageSummaryHtml(meta) {
    if (!meta?.setUsage?.length) return "";
    const rows = meta.setUsage.map(entry => `
      <tr>
        <td><strong>${escapeHtml(entry.setId)}</strong></td>
        <td>${escapeHtml(entry.name || entry.setId)}</td>
        <td style="text-align:center;">${entry.qty}</td>
      </tr>
    `).join("");
    return `
      <div class="survey-set-box">
        <strong>ชุด SET ในโครงการ</strong>
        <table class="detail-table survey-set-table">
          <thead><tr><th>รหัส SET</th><th>รายการ</th><th>จำนวนชุด</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
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
    const stats = meta.poleStats;
    const statsHtml = stats ? `
      <br>เสาทางตรง: ${stats.straightRun} · เข้า/ออกโค้ง: ${stats.curveEntryExit} · ในโค้ง: ${stats.curveInterior} · ต้นสุดท้าย: ${stats.endPoles} · จุดต่อเดิม: ${stats.startPoles ?? 0} · Guy: ${stats.guySets}
    ` : "";

    return `
      <div class="survey-meta-box">
        <strong>ข้อมูลเส้นทางสำรวจ</strong><br>
        จุดเริ่ม (${escapeHtml(startLabel)}): ${Number(meta.startLat).toFixed(6)}, ${Number(meta.startLng).toFixed(6)}<br>
        จุดสิ้นสุด (${escapeHtml(endLabel)}): ${Number(meta.endLat).toFixed(6)}, ${Number(meta.endLng).toFixed(6)}<br>
        หมุดทั้งหมด: ${poleCount} | ระยะรวม: ${totalDistanceM} ม. | Span: ${spanM} ม.${statsHtml}
      </div>
    `;
  }

  function buildDetailHtml(details, imgStr, name, surveyMetaStr, previews, projectId) {
    let surveyMetaHtml = "";
    let surveyMeta = null;
    let displayMeta = null;
    if (surveyMetaStr) {
      try {
        surveyMeta = JSON.parse(surveyMetaStr);
        displayMeta = mergeDisplayMeta(surveyMeta, details);
        surveyMetaHtml = buildSurveyMetaDetailHtml(surveyMeta);
      } catch (error) {
        console.warn("survey meta parse failed", error);
      }
    }
    if (!displayMeta) {
      displayMeta = mergeDisplayMeta(null, details);
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
      ${displayMeta?.setUsage?.length ? `<p class="set-aware-display-note">แต่ละชุด SET ตามด้วยรายการพัสดุในชุด — กรอกรหัสชุดแล้วจะได้พัสดุตามรายการด้านล่าง${displayMeta.setUsage.some(entry => entry.inferred) ? " (ตรวจจับชุด SET จากรายการพัสดุ)" : ""}</p>` : ""}
      <table class="detail-table set-aware-display-table">
        <thead>
          <tr>
            <th>#</th>
            <th>ประเภท</th>
            <th>รหัส</th>
            <th>รายการ</th>
            <th>จำนวน</th>
          </tr>
        </thead>
        <tbody>
          ${buildGroupedDetailTableBodyHtml(details, displayMeta)}
        </tbody>
      </table>
      <div class="detail-export-actions">
        <button class="primary-btn" type="button" onclick="window.AppActions.exportToExcel('${escapeJs(name)}', '${safePayload}', '${escapeJs(projectId)}')">Export Excel</button>
        <button class="ghost-btn" type="button" onclick="window.AppActions.exportProjectReportPdf('${escapeJs(projectId)}')">Export PDF รายงาน</button>
      </div>
    `;
  }

  function exportToExcel(name, encodedDetails, projectId) {
    const details = JSON.parse(decodeURIComponent(encodedDetails));
    let surveyMeta = null;
    const metaStr = state.historyRowCache?.[projectId]?.surveyMetaStr;
    if (metaStr) {
      try { surveyMeta = JSON.parse(metaStr); } catch (error) { surveyMeta = null; }
    }
    const displayMeta = mergeDisplayMeta(surveyMeta, details);
    const data = [];
    let rowNum = 0;
    buildSetAwareDisplayRows(details, displayMeta).forEach(row => {
      if (row.rowType === "section") {
        data.push({
          "ลำดับ": "",
          "ประเภท": "",
          "รหัสชุด SET": "",
          "รหัส": "",
          "รายการ": row.name,
          "จำนวน": "",
          "งบ": "",
          "รวม": ""
        });
        return;
      }
      rowNum += 1;
      data.push({
        "ลำดับ": rowNum,
        "ประเภท": getRowTypeLabel(row.rowType),
        "รหัสชุด SET": row.setId || "—",
        "รหัส": row.code,
        "รายการ": row.name,
        "จำนวน": row.qty === "" ? "" : row.qty,
        "งบ": row.budgetType || "—",
        "รวม": row.rowType === "set" || row.rowType === "set-item" ? "—" : row.total
      });
    });
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

      const cached = state.historyRowCache[id] || {};
      state.activeSurveyMeta = null;
      if (cached.surveyMetaStr) {
        try {
          state.activeSurveyMeta = JSON.parse(cached.surveyMetaStr);
        } catch (error) {
          state.activeSurveyMeta = null;
        }
      }

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

  // Modal กลางจอแสดง "แผนที่สำรวจ (ปักหมุด)" เมื่อคลิกรายการประวัติ
  // ให้เห็นภาพรวมก่อนตัดสินใจ ดู/แชร์/แก้ไข
  async function previewSurveyMap(projectId) {
    const cached = state.historyRowCache?.[projectId];
    if (!cached) return;

    const urls = (cached.imgStr || "").split("|").filter(Boolean);
    if (!urls.length) {
      Swal.fire({
        title: cached.name || "โครงการ",
        text: "โครงการนี้ไม่มีแผนที่สำรวจ (ยังไม่ได้ปักหมุดบนแผนที่)",
        icon: "info",
        customClass: { popup: "pea-swal-popup" }
      });
      return;
    }

    if (!cached.mapPreviewDataUrl) {
      Swal.fire({
        title: "กำลังโหลดแผนที่สำรวจ...",
        allowOutsideClick: false,
        customClass: { popup: "pea-swal-popup" },
        didOpen: () => Swal.showLoading()
      });
      // URL ของ Drive ไม่มีชื่อไฟล์ — ต้องดึง preview มาก่อนแล้วดูชื่อไฟล์ (Survey_Map)
      // เช่นเดียวกับหน้า "ดู" รายละเอียด
      const previews = await fetchDrivePreviews(urls);
      let found = null;
      for (const url of urls) {
        const fileId = extractDriveFileId(url);
        const preview = fileId ? previews[fileId] : null;
        const name = preview?.name ? String(preview.name) : "";
        if (!preview?.base64 || !preview.mime?.startsWith("image/")) continue;
        if (/Survey_Map/i.test(url) || /Survey_Map/i.test(name)) {
          found = preview;
          break;
        }
      }
      if (!found) {
        const hasSurvey = cached.surveyMetaStr && cached.surveyMetaStr !== "{}" && cached.surveyMetaStr !== "null";
        Swal.fire({
          title: cached.name || "โครงการ",
          text: hasSurvey
            ? "โหลดรูปแผนที่จาก Drive ไม่สำเร็จ — ลองกด \"ดู\" เพื่อเปิดรายละเอียดเต็มแทน"
            : "โครงการนี้ไม่มีแผนที่สำรวจ (ยังไม่ได้ปักหมุดบนแผนที่)",
          icon: hasSurvey ? "warning" : "info",
          customClass: { popup: "pea-swal-popup" }
        });
        return;
      }
      cached.mapPreviewDataUrl = `data:${found.mime};base64,${found.base64}`;
    }

    Swal.fire({
      title: escapeHtml(cached.name || "แผนที่สำรวจ"),
      html: `
        <div class="history-map-modal">
          <img src="${cached.mapPreviewDataUrl}" alt="แผนที่สำรวจ (ปักหมุด)">
          <p class="history-map-caption">แผนที่สำรวจ (ปักหมุด) · ${escapeHtml(cached.dateDisplay || "")}</p>
        </div>
      `,
      width: "min(94vw, 900px)",
      showConfirmButton: true,
      confirmButtonText: "ดูรายละเอียดโครงการ",
      showCancelButton: true,
      cancelButtonText: "ปิด",
      customClass: { popup: "pea-swal-popup" }
    }).then(result => {
      if (result.isConfirmed) viewDetail(projectId);
    });
  }

  window.AppActions = {
    viewDetail,
    previewSurveyMap,
    exportToExcel,
    exportProjectReportPdf,
    askEdit,
    askDel,
    askShare
  };

  window.AppCore = {
    pickFromChoiceButtons,
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
    getProjectFileList: () => state.tempFileList,
    getProjectFileCount:() => state.tempFileList.length,
    addItemWithLabor: (budgetIndex, item, qty) => addToStaging(budgetIndex, item, qty),
    addItemDirect: (budgetIndex, item) => {
      state.budgets[budgetIndex].items.push({
        ...item,
        total: (item.matPrice + item.labPrice) * item.qty
      });
    },
    pickOrCreateBudgetIndex,
    confirmSaveProject: options => confirmSave(options),
    addBudgetType: type => addBudget(type),
    switchToCreateTab: () => switchTab(1),
    switchToTab: n => switchTab(n),
    render
  };
})();
