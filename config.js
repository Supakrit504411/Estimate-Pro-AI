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
    curveSpanPresets: [15, 20],
    startHeadTypes: ["DE", "SP", "CCB", "CTB", "ป.ปลา", "สระอา"],
    useRoadRouting: true,
    osrmUrl: "https://router.project-osrm.org",

    poleCatalog: [
      { id: "1000010001", name: "POLE,CONCRETE, 8 M.LONG" },
      { id: "1000010002", name: "POLE,CONCRETE, 9 M.LONG" },
      { id: "1000010003", name: "POLE,CONCRETE 12 M.LONG,FOR 22 KV." },
      { id: "1000010004", name: "POLE,CONCRETE, 12 M.LONG" },
      { id: "1000010005", name: "POLE,CONCRETE 14 M.LONG,FOR 22 KV." },
      { id: "1000010006", name: "POLE,CONCRETE, 14 M. LONG" },
      { id: "1000010008", name: "POLE,CONCRETE, 16 M. LONG" },
      { id: "1000010011", name: "POLE,CONCRETE, 22 M. LONG" },
      { id: "1000010012", name: "POLE,CONCRETE, 12.20 M. LONG" },
      { id: "1000010013", name: "POLE,CONCRETE, 14.30 M. LONG" },
      { id: "1000010014", name: "POLE,CONCRETE, 9.30 M. LONG" }
    ],

    headCatalog: [
      { id: "1000110000", name: "CROSSARM,PRESTRESSED CONCRETE, 100X100X1,500 MM." },
      { id: "1000110001", name: "CROSSARM,PRESTRESSED CONCRETE,SPUN,H.T. 100X100X2,500 MM." },
      { id: "1000110002", name: "CROSSARM,PRESTRESSED CONCRETE,SPUN,H.T. 120X120X3,000 MM." },
      { id: "1000110003", name: "CROSSARM,PRESTRESSED CONCRETE,SPUN(FOR DEAD-ENDING) 120X120X2,000" },
      { id: "1000110004", name: "CROSSARM,PRESTRESSED CONCRETE,SPUN(FOR DEAD-ENDING) 120X120X2,50" }
    ],

    cableCatalog: [
      { id: "1020010000", name: "CONDUCTOR,AL.,BARE 25 SQ.MM.TIS.85" },
      { id: "1020010001", name: "CONDUCTOR,AL,BARE 35 sq.mm.TIS.85" },
      { id: "1020010002", name: "CONDUCTOR,AL,BARE 50/7 sq.mm.TIS.85" },
      { id: "1020010003", name: "CONDUCTOR,AL.BARE 70 SQ.MM.TIS.85" },
      { id: "1020010004", name: "CONDUCTOR,AL,BARE 95 sq.mm.TIS.85" },
      { id: "1020010005", name: "CONDUCTOR,AL,BARE 120 sq.mm.TIS.85" },
      { id: "1020010007", name: "CONDUCTOR,AL,BARE 185 sq.mm.TIS.85" },
      { id: "1020010008", name: "CONDUCTOR,AL.BARE 240 SQ.MM. TIS.85" },
      { id: "1020010009", name: "CONDUCTOR,AL,BARE,400 SQ.MM.TIS.85" },
      { id: "1020010010", name: "CONDUCTOR,AL.BARE 625 SQ.MM. TIS.85" },
      { id: "1020020001", name: "CONDUCTOR,ACSR 35/6 sq.mm.TIS.86" },
      { id: "1020020002", name: "CONDUCTOR,ACSR 50/8 sq.mm.TIS.86" },
      { id: "1020020003", name: "CONDUCTOR,ACSR 70/12 SQ.MM.TIS.85" },
      { id: "1020020004", name: "CONDUCTOR,ACSR 95/15 sq.mm.TIS.86" },
      { id: "1020020005", name: "CONDUCTOR,ACSR 120/20 sq.mm.TIS.86" },
      { id: "1020020007", name: "CONDUCTOR,ACSR 185/30 sq.mm.TIS.86" },
      { id: "1020020008", name: "CONDUCTOR, ACSR 380/50 SQ.MM. TIS.86" },
      { id: "1020030001", name: "CONDUCTOR,AL-ALLOY 35 sq.mm.TIS.725" },
      { id: "1020030002", name: "CONDUCTOR,AL-ALLOY 50/7 sq.mm.TIS.725" },
      { id: "1020030003", name: "CONDUCTOR,AL-ALLOY 70 SQ.MM.TIS.725" },
      { id: "1020030004", name: "CONDUCTOR,AL-ALLOY 95 sq.mm.TIS.725" },
      { id: "1020030005", name: "CONDUCTOR,ALUMINIUM-ALLOY 120 SQ.MM.TIS.725" },
      { id: "1020030007", name: "CONDUCTOR,ALUMINIUM-ALLOY 185 SQ.MM. TIS.725" },
      { id: "1020050000", name: "CABLE,AERIAL,AL 22 kV. 1x50 sq.mm." },
      { id: "1020050001", name: "CABLE,AERIAL,AL 22 kV. 1x95 sq.mm." },
      { id: "1020050002", name: "CABLE,AERIAL,AL 22 kV. 1x120 sq.mm." },
      { id: "1020050003", name: "CABLE,AERIAL,AL 22 KV. 1X150 SQ.MM." },
      { id: "1020050004", name: "CABLE,AERIAL,AL 22 kV. 1x185 sq.mm." },
      { id: "1020050005", name: "CABLE,AERIAL,AL 22 kV. 1x240 sq.mm." }
    ]
  }
};
