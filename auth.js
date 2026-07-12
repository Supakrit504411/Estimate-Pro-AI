(function () {
  const STORAGE_KEY = "pea_auth_session_v1";

  const TAB_ALIAS = {
    1: ["t1", "view1"],
    2: ["t2", "view2"],
    3: ["t3", "view3"],
    4: ["t4", "view4"],
    5: ["t5", "view5"]
  };

  function loadSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function saveSession(user) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      user,
      savedAt: Date.now()
    }));
  }

  window.AuthSession = {
    load() {
      return loadSession();
    },

    getUser() {
      return loadSession()?.user || null;
    },

    getUsername() {
      return this.getUser()?.username || "";
    },

    isLoggedIn() {
      return !!this.getUser()?.username;
    },

    isAdmin() {
      return String(this.getUser()?.role || "").toLowerCase() === "admin";
    },

    canUseAiAsk() {
      const user = this.getUser();
      if (!user) return false;
      return user.aiAsk !== false;
    },

    canAccessTab(tabNumber) {
      const tab = Number(tabNumber);
      if (tab === 5) return this.isAdmin();
      const user = this.getUser();
      if (!user) return false;
      const steps = Array.isArray(user.allowedSteps) ? user.allowedSteps : [1, 2, 3, 4];
      return steps.includes(tab);
    },

    save(user) {
      saveSession(user);
    },

    clear() {
      sessionStorage.removeItem(STORAGE_KEY);
    },

    applyRbacToDom() {
      const user = this.getUser();
      if (!user) return;

      const loginGate = document.getElementById("loginGate");
      const appMain = document.getElementById("appMain");
      if (loginGate) loginGate.classList.add("hidden");
      if (appMain) appMain.classList.remove("hidden");

      const userLabel = document.getElementById("authUserLabel");
      if (userLabel) {
        userLabel.textContent = user.displayName || user.username;
      }

      const roleLabel = document.getElementById("authRoleLabel");
      if (roleLabel) {
        roleLabel.textContent = user.role || "user";
      }

      Object.entries(TAB_ALIAS).forEach(([tabNumber, ids]) => {
        const allowed = this.canAccessTab(Number(tabNumber));
        ids.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.classList.toggle("auth-hidden", !allowed);
        });
        document.querySelectorAll(`[data-tab-nav="${tabNumber}"]`).forEach(btn => {
          btn.classList.toggle("auth-hidden", !allowed);
        });
      });

      document.querySelectorAll("[data-tab-nav='5']").forEach(btn => {
        btn.classList.toggle("auth-hidden", !this.isAdmin());
      });

      const aiSection = document.getElementById("aiSection");
      if (aiSection) {
        aiSection.classList.toggle("hidden", !this.canUseAiAsk());
      }
    },

    getDefaultTab() {
      return [1, 4, 3, 2, 5].find(tab => this.canAccessTab(tab)) || null;
    },

    withAuthPayload(payload) {
      const username = this.getUsername();
      return username ? { ...payload, username } : { ...payload };
    }
  };
})();
