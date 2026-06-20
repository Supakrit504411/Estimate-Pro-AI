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
    login: "login",
    shareProject: "share-project",
    adminDashboard: "admin-dashboard",
    health: "health",
    lineIntake: "line-intake",
    lineSearch: "line-search",
    parsePriceQuery: "parse-price-query",
    driveFilePreviews: "drive-file-previews"
  },
  lineBridgePath: "/api/line-webhook",
  masterDataCacheTtlMs: 480000,

  /** คำถามที่พบบ่อย — หม้อแปลง + SET ติดตั้ง + เสา 12.20 ม. 1 ต้น */
  priceFaq: {
    "tr-install-30": {
      label: "ราคาติดตั้งหม้อแปลง 30 kVA",
      example: "ราคาติดตั้งหม้อแปลง 30 kVA",
      intent: {
        intent: "tr_install",
        kva: 30,
        phase: "1p",
        installType: "single_pole",
        includeTrSet: true,
        transformerId: "1050000011",
        trSetId: "40201",
        poleMaterialId: "1000010012",
        poleQty: 1,
        needsClarification: false
      }
    },
    "tr-install-50": {
      label: "ราคาติดตั้งหม้อแปลง 50 kVA",
      example: "ราคาติดตั้งหม้อแปลง 50 kVA",
      intent: {
        intent: "tr_install",
        kva: 50,
        phase: "3p",
        installType: "single_pole",
        includeTrSet: true,
        transformerId: "1050010066",
        trSetId: "40205",
        poleMaterialId: "1000010012",
        poleQty: 1,
        needsClarification: false
      }
    },
    "tr-install-100": {
      label: "ราคาติดตั้งหม้อแปลง 100 kVA",
      example: "ราคาติดตั้งหม้อแปลง 100 kVA",
      intent: {
        intent: "tr_install",
        kva: 100,
        phase: "3p",
        installType: "single_pole",
        includeTrSet: true,
        transformerId: "1050010067",
        trSetId: "40205",
        poleMaterialId: "1000010012",
        poleQty: 1,
        needsClarification: false
      }
    },
    "line-mv-200": {
      label: "ขยายเขต MV 200 ม.",
      example: "ขยายเขตแรงสูง ระยะทาง 200 เมตรกี่บาท",
      intent: {
        intent: "pole_run",
        distanceM: 200,
        voltage: "mv",
        scope: "with_wire"
      }
    },
    "line-lv-200": {
      label: "ขยายเขต LV 200 ม.",
      example: "ขยายเขตแรงต่ำ ระยะทาง 200 เมตรกี่บาท",
      intent: {
        intent: "pole_run",
        distanceM: 200,
        voltage: "lv",
        scope: "with_wire"
      }
    }
  },

  /** เปิด Gemini เฉพาะเมื่อ FAQ/local parse ไม่ได้ intent เลย (Swal จัดการ clarify) */
  priceAskUseGemini: true,

  /** ข้อมูลโมเดล Gemini — API key ตั้งใน GAS.txt เท่านั้น */
  gemini: {
    models: {
      flash: "gemini-2.5-flash",
      flashLite: "gemini-3.1-flash-lite"
    },
    routing: {
      parsePriceQuery: ["gemini-3.1-flash-lite", "gemini-2.5-flash"],
      processImageAI: ["gemini-2.5-flash", "gemini-3.1-flash-lite"]
    }
  },

  quickCategories: {
    transformer: {
      label: "หม้อแปลง",
      icon: "⚡",
      items: [
        { id: "1050000011", name: "TR., 30KVA,1P,22-0.48/0.24KV, SC" },
        { id: "1050010066", name: "TR.,50KVA,3P,22-0.416/0.24KV,DYN11, SC" },
        { id: "1050010067", name: "TR.,100KVA,3P,22-0.416/0.24KV,DYN11, SC" },
        { id: "1050010068", name: "TR.,160KVA,3P,22-0.416/0.24KV,DYN11, SC" },
        { id: "1050010069", name: "TR.,250KVA,3P,22-0.416/0.24KV,DYN11, SC" },
        { id: "1050010070", name: "TR.,315KVA,3P,22-0.416/0.24KV,DYN11, SC" },
        { id: "1050010071", name: "TR.,400KVA,3P,22-0.416/0.24KV,DYN11, SC" },
        { id: "1050010072", name: "TR.,500KVA,3P,22-0.416/0.24KV,DYN11, SC" },
        { id: "1050010073", name: "TR.,630KVA,3P,22-0.416/0.24KV,DYN11, SC" },
        { id: "1050010074", name: "TR.,800KVA,3P,22-0.416/0.24KV,DYN11, SC" },
        { id: "1050010075", name: "TR.,1000KVA,3P,22-0.416/0.24KV,DYN11, SC" },
        { id: "1050010076", name: "TR.,1250KVA,3P,22-0.416/0.24KV,DYN11, SC" },
        { id: "1050010077", name: "TR.,1500KVA,3P,22-0.416/0.24KV,DYN11, SC" },
        { id: "1050010078", name: "TR.,2000KVA,3P,22-0.416/0.24KV,DYN11, SC" }
      ]
    },
    pole: {
      label: "เสา",
      icon: "🏗️",
      items: [
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
      ]
    },
    cable: {
      label: "สายไฟ",
      icon: "〰️",
      items: [
        { id: "1020050000", name: "CABLE,AERIAL,AL 22 kV. 1x50 sq.mm." },
        { id: "1020050001", name: "CABLE,AERIAL,AL 22 kV. 1x95 sq.mm." },
        { id: "1020050002", name: "CABLE,AERIAL,AL 22 kV. 1x120 sq.mm." },
        { id: "1020050003", name: "CABLE,AERIAL,AL 22 KV. 1X150 SQ.MM." },
        { id: "1020050004", name: "CABLE,AERIAL,AL 22 kV. 1x185 sq.mm." },
        { id: "1020050005", name: "CABLE,AERIAL,AL 22 kV. 1x240 sq.mm." },
        { id: "1020020001", name: "CONDUCTOR,ACSR 35/6 sq.mm.TIS.86" },
        { id: "1020020002", name: "CONDUCTOR,ACSR 50/8 sq.mm.TIS.86" },
        { id: "1020020003", name: "CONDUCTOR,ACSR 70/12 SQ.MM.TIS.85" },
        { id: "1020020004", name: "CONDUCTOR,ACSR 95/15 sq.mm.TIS.86" },
        { id: "1020020005", name: "CONDUCTOR,ACSR 120/20 sq.mm.TIS.86" },
        { id: "1020020007", name: "CONDUCTOR,ACSR 185/30 sq.mm.TIS.86" },
        { id: "1020020008", name: "CONDUCTOR, ACSR 380/50 SQ.MM. TIS.86" },
        { id: "1020070000", name: "CABLE,AL,COMPACT STRANDED,PVC-INSULATED,750 V. 75 DEG.C, 25 DQ.MM. TIS.293" },
        { id: "1020070001", name: "CABLE,AL,COMPACT STRANDED,PVC-INSULATED,750 V. 75 DEG.C, 35 SQ.MM.TIS.293" },
        { id: "1020070002", name: "CABLE,AL,COMPACT STRANDED,PVC-INSULATED,750 V. 75 DEG.C, 50 SQ.MM. TIS.293" },
        { id: "1020070003", name: "CABLE,AL,COMPACT STRANDED,PVC-INSULATED,750 V. 75 DEG.C, 70 SQ.MM. TIS.293" },
        { id: "1020070004", name: "CABLE,AL,COMPACT STRANDED,PVC-INSULATED,750 V. 75 DEG.C, 95 SQ.MM. TIS.293" },
        { id: "1020070005", name: "CABLE,AL,COMPACT STRANDED,PVC-INSULATED,750 V. 75 DEG.C, 120 SQ.MM.TIS.293" },
        { id: "1020070006", name: "CABLE,AL,COMPACT STRANDED,PVC-INSULATED,750 V. 75 DEG.C, 150 SQ.MM. TIS.293" },
        { id: "1020070007", name: "CABLE,AL,COMPACT STRANDED,PVC-INSULATED,750 V. 75 DEG.C, 185 SQ.MM. TIS.293" },
        { id: "1020070008", name: "CABLE,AL,COMPACT STRANDED,PVC-INSULATED,750 V. 75 DEG.C, 240 SQ.MM. TIS.293" }
      ]
    },
    setMv: {
      label: "ชุด SET MV",
      icon: "📦",
      setSource: "mv"
    },
    setTr: {
      label: "ชุด SET TR",
      icon: "🔧",
      setSource: "tr"
    },
    setLv: {
      label: "ชุด SET LV",
      icon: "📦",
      setSource: "lv"
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
