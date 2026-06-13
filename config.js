window.APP_CONFIG = {
  apiBaseUrl: "/api/gas",
  endpoints: {
    masterData: "master-data",
    processImageAI: "process-image-ai",
    saveProject: "save-project",
    getSavedProjects: "saved-projects",
    getProjectDetails: "project-details",
    verifyPassword: "verify-password",
    deleteProject: "delete-project",
    health: "health",
    lineIntake: "line-intake",
    lineSearch: "line-search"
  },
  lineBridgePath: "/api/line-webhook",

  quickCategories: {
    transformer: {
      label: "หม้อแปลง",
      icon: "⚡",
      keywords: ["หม้อแปลง", "transformer", "kva", "kVA", "แปลง"]
    },
    pole: {
      label: "เสา",
      icon: "🏗️",
      keywords: ["เสา", "pole", "คอนกรีต", "เหล็ก", "9 ม", "12 ม", "9ม", "12ม", "คอ."]
    },
    cable: {
      label: "สายไฟ",
      icon: "〰️",
      keywords: ["สาย", "cable", "aac", "xlpe", "cv", "อลูมิเนียม", "ทองแดง"]
    }
  },

  survey: {
    defaultCenter: [17.4081, 104.7762],
    defaultZoom: 15,
    spanPresets: [15, 20, 40, 80],
    poleSizes: ["9 ม.", "12 ม."],
    poleHeadTypes: ["คอนกรีต", "คอนเหล็ก", "Spacer แขวน", "อื่นๆ"],
    cableTypes: ["AAC 50", "AAC 95", "XLPE 50", "XLPE 95"],
    materialKeywords: {
      pole: {
        "9 ม.": ["เสา", "9"],
        "12 ม.": ["เสา", "12"]
      },
      head: {
        "คอนกรีต": ["หัวเสา", "คอนกรีต", "คอ."],
        "คอนเหล็ก": ["หัวเสา", "คอนเหล็ก", "คอ."],
        "Spacer แขวน": ["spacer", "แขวน", "สเปเซอร์"],
        "อื่นๆ": ["หัวเสา", "ยึด"]
      },
      cable: {
        "AAC 50": ["สาย", "aac", "50"],
        "AAC 95": ["สาย", "aac", "95"],
        "XLPE 50": ["สาย", "xlpe", "50"],
        "XLPE 95": ["สาย", "xlpe", "95"]
      }
    }
  }
};
