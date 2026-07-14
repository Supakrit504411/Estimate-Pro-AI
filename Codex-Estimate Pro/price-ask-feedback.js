(function () {
  const STORAGE_KEY = "pea_price_ask_feedback_v1";
  const MAX_LOCAL = 500;

  function readAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("price ask feedback read failed", error);
      return [];
    }
  }

  function writeAll(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_LOCAL)));
  }

  function currentUserLabel() {
    return window.AuthSession?.getUsername?.()
      || window.AuthSession?.getUser?.()?.username
      || "anonymous";
  }

  function buildEntry(payload) {
    return {
      id: `paf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
      user: currentUserLabel(),
      verdict: payload.verdict === "ok" ? "ok" : "wrong",
      query: String(payload.query || ""),
      budgetType: payload.budgetType || "01.1",
      parseSource: payload.parseSource || "unknown",
      parseConfidence: payload.parseConfidence ?? null,
      confidenceLevel: payload.confidenceLevel || null,
      intent: payload.intent?.intent || payload.intentType || null,
      intentSnapshot: payload.intent || null,
      total: payload.total ?? null,
      note: String(payload.note || "").trim(),
      expected: String(payload.expected || "").trim(),
      glossaryVersion: window.PRICE_ASK_GLOSSARY?.version || null
    };
  }

  function logFeedback(payload) {
    const entry = buildEntry(payload || {});
    const entries = readAll();
    entries.unshift(entry);
    writeAll(entries);
    submitRemote(entry).catch(error => console.warn("feedback remote sync failed", error));
    return entry;
  }

  async function submitRemote(entry) {
    if (!window.ApiService?.submitPriceAskFeedback) return null;
    const config = window.APP_CONFIG || {};
    if (config.priceAskFeedbackEnabled === false) return null;
    return window.ApiService.submitPriceAskFeedback(entry);
  }

  function list(options = {}) {
    let entries = readAll();
    if (options.verdict && options.verdict !== "all") {
      entries = entries.filter(row => row.verdict === options.verdict);
    }
    if (options.limit) entries = entries.slice(0, options.limit);
    return entries;
  }

  function stats() {
    const entries = readAll();
    const wrong = entries.filter(row => row.verdict === "wrong").length;
    const ok = entries.filter(row => row.verdict === "ok").length;
    return { total: entries.length, wrong, ok };
  }

  function exportJson() {
    return JSON.stringify(readAll(), null, 2);
  }

  function exportCsv() {
    const entries = readAll();
    const headers = [
      "ts", "user", "verdict", "query", "budgetType", "parseSource",
      "parseConfidence", "intent", "total", "note", "expected"
    ];
    const lines = [headers.join(",")];
    entries.forEach(row => {
      lines.push(headers.map(key => {
        const value = row[key] == null ? "" : String(row[key]);
        return `"${value.replace(/"/g, '""')}"`;
      }).join(","));
    });
    return lines.join("\n");
  }

  function downloadText(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportJsonFile() {
    downloadText(
      `price_ask_feedback_${new Date().toISOString().slice(0, 10)}.json`,
      exportJson(),
      "application/json"
    );
  }

  function exportCsvFile() {
    downloadText(
      `price_ask_feedback_${new Date().toISOString().slice(0, 10)}.csv`,
      exportCsv(),
      "text/csv"
    );
  }

  function renderAdminSummaryHtml() {
    const { total, wrong, ok } = stats();
    const recentWrong = list({ verdict: "wrong", limit: 5 });
    const rows = recentWrong.length
      ? recentWrong.map(row => `
          <tr>
            <td>${escapeCell(row.ts)}</td>
            <td>${escapeCell(row.user)}</td>
            <td>${escapeCell(row.query)}</td>
            <td>${escapeCell(row.intent)}</td>
            <td>${escapeCell(row.note || row.expected || "-")}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="5" class="empty-state">ยังไม่มี feedback</td></tr>`;

    return `
      <div class="admin-feedback-stats">
        <span>ทั้งหมด ${total}</span>
        <span class="admin-feedback-ok">ตรง ${ok}</span>
        <span class="admin-feedback-wrong">ไม่ตรง ${wrong}</span>
      </div>
      <div class="admin-audit-toolbar">
        <button id="adminFeedbackExportJsonBtn" class="ghost-btn" type="button">Export JSON</button>
        <button id="adminFeedbackExportCsvBtn" class="ghost-btn" type="button">Export CSV</button>
      </div>
      <table class="admin-table admin-feedback-table">
        <thead>
          <tr><th>เวลา</th><th>User</th><th>คำถาม</th><th>Intent</th><th>หมายเหตุ</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function escapeCell(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function bindAdminPanel(root) {
    if (!root) return;
    root.querySelector("#adminFeedbackExportJsonBtn")
      ?.addEventListener("click", exportJsonFile);
    root.querySelector("#adminFeedbackExportCsvBtn")
      ?.addEventListener("click", exportCsvFile);
  }

  window.PriceAskFeedback = {
    STORAGE_KEY,
    logFeedback,
    submitRemote,
    list,
    stats,
    exportJson,
    exportCsv,
    exportJsonFile,
    exportCsvFile,
    renderAdminSummaryHtml,
    bindAdminPanel
  };
})();
