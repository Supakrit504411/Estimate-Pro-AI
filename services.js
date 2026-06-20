(function () {
  const config = window.APP_CONFIG || {};

  function buildGasUrl(action) {
    const base = (config.apiBaseUrl || "").replace(/\/+$/, "");
    if (!base) {
      throw new Error("APP_CONFIG.apiBaseUrl is not configured");
    }
    return `${base}?action=${encodeURIComponent(action)}`;
  }

  async function request(action, payload, method = "POST") {
    const url = buildGasUrl(action);
    const options = {
      method,
      headers: {
        "Content-Type": "application/json"
      }
    };

    if (method !== "GET") {
      options.body = JSON.stringify(payload || {});
    }

    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new Error(typeof data === "string" ? data : data.message || "Request failed");
    }

    return data;
  }

  window.ApiService = {
    getMasterData() {
      return request(config.endpoints.masterData, null, "GET");
    },

    processImageAI(base64Data, contentType) {
      return request(config.endpoints.processImageAI, { base64Data, contentType });
    },

    saveProject(payload) {
      return request(config.endpoints.saveProject, payload);
    },

    getSavedProjects() {
      return request(config.endpoints.getSavedProjects, null, "GET");
    },

    getProjectDetails(projectId) {
      return request(config.endpoints.getProjectDetails, { projectId });
    },

    verifyPassword(password) {
      return request(config.endpoints.verifyPassword, { password });
    },

    deleteProject(projectId, password) {
      return request(config.endpoints.deleteProject, { projectId, password });
    },

    health() {
      return request(config.endpoints.health, null, "GET");
    },

    lineIntake(payload) {
      return request(config.endpoints.lineIntake, payload);
    },

    lineSearch(query) {
      return request(config.endpoints.lineSearch, { query });
    },

    parsePriceQuery(query, budgetType) {
      return request(config.endpoints.parsePriceQuery, { query, budgetType });
    },

    getDriveFilePreviews(fileIds) {
      return request(config.endpoints.driveFilePreviews, { fileIds });
    }
  };
})();
