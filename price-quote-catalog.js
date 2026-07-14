(function () {
  /** รหัสเสาตามความสูง (เมตร) — อ้างอิง master ที่ใช้บ่อย */
  const POLE_BY_HEIGHT_M = {
    8: "1000010001",
    9: "1000010002",
    12: "1000010012",
    12.2: "1000010012",
    14: "1000010013",
    14.3: "1000010013",
    16: "1000010008",
    22: "1000010011"
  };

  const CONCRETE = {
    mv: { materialId: "9090010025", label: "CONCRETE 1/3/5" },
    lv: { materialId: "9090010025", qtyFactor: 0.6, label: "CONCRETE 1/3/5 (LV)" },
    platform: { materialId: "9090010037", label: "CONCRETE 1/2/4" }
  };

  /** หม้อแปลง kVA → รหัส Serie 0.416/0.24 (survey-presets ปัจจุบัน) */
  const TRANSFORMER_BY_KVA = {
    "1p": { 30: "1050000011" },
    "3p": {
      50: "1050010066",
      100: "1050010067",
      160: "1050010068",
      250: "1050010069",
      315: "1050010070",
      400: "1050010071",
      500: "1050010072",
      630: "1050010073",
      800: "1050010074",
      1000: "1050010075",
      1250: "1050010076",
      1500: "1050010077",
      2000: "1050010078"
    }
  };

  /** Serie 0.4/0.23 kV — ใช้เมื่อระบุใน query หรือ master เก่า */
  const TRANSFORMER_BY_KVA_LEGACY = {
    "1p": { 30: "1050000011" },
    "3p": {
      50: "1050010050",
      100: "1050010052",
      160: "1050010054",
      250: "1050010056",
      315: "1050010057",
      400: "1050010058",
      500: "1050010059",
      630: "1050010060",
      1000: "1050010061",
      1250: "1050010062",
      1500: "1050010063",
      2000: "1050010064"
    }
  };

  /** Default สำหรับถามราคาตามระยะทาง / ขยายเขต */
  const PRICE_QUOTE_DEFAULTS = {
    mv: {
      poleHeightM: 12,
      spanStraightM: 40,
      spanCurveM: 20,
      cableSizeSqMm: 50,
      cableType: "aerial",
      scope: "with_wire"
    },
    lv: {
      poleHeightM: 9,
      spanStraightM: 40,
      spanCurveM: 20,
      cableSizeSqMm: 50,
      scope: "with_wire"
    }
  };

  function set(id, name, items) {
    return {
      id,
      name,
      items: items.map(([mid, mname, unit, qty]) => ({
        id: mid,
        name: mname,
        unit,
        qty: Number(qty)
      }))
    };
  }

  /** SET ยึดโยง — จากข้อมูลที่ผู้ใช้ให้ (เสริมจาก survey-presets) */
  const GUY_SETS = {
    "23003": set("23003", "GY-22,DE SIZE 50 SQ.MM.", [
      ["1000040001", "ANCHOR,PLATE,REINFORCED CONCRETE 550X550X150 MM.", "ชิ้น", 1],
      ["1010100004", "WIRE,STEEL STRANDED 50/7 sq.mm.TIS.404", "ม.", 18],
      ["1010180100", "WASHER,PLAIN,SQUARE,LARGE 52x52x4.5 mm.", "ชิ้น", 1],
      ["1010210000", "ROD,ANCHOR,ROUND EYE M.16, 2,000 mm.LONG", "ชุด", 1],
      ["1010210201", "BOLT,STRAND EYE,SINGLE 45 DEGREE M.16x250 mm.", "ชุด", 1],
      ["1010210304", "THIMBLE,GUY,FOR STEEL WIRE 50-95 sq.mm.", "ชิ้น", 1],
      ["1010230000", "CLAMP,SINGLE U-BOLT,M.8 (WIRE ROPE CLIP)", "ชุด", 6],
      ["1030030103", "INSULATOR,STRAIN,TYPE D (CLASS 54-4)TIS.280", "ชิ้น", 2]
    ]),
    "23004": set("23004", "GY-22,DE SIZE 95 SQ.MM.", [
      ["1000040001", "ANCHOR,PLATE,REINFORCED CONCRETE 550X550X150 MM.", "ชิ้น", 1],
      ["1010100006", "WIRE,STEEL STRANDED 95 sq.mm.TIS.404", "ม.", 18],
      ["1010180100", "WASHER,PLAIN,SQUARE,LARGE 52x52x4.5 mm.", "ชิ้น", 1],
      ["1010210000", "ROD,ANCHOR,ROUND EYE M.16, 2,000 mm.LONG", "ชุด", 1],
      ["1010210201", "BOLT,STRAND EYE,SINGLE 45 DEGREE M.16x250 mm.", "ชุด", 1],
      ["1010210304", "THIMBLE,GUY,FOR STEEL WIRE 50-95 sq.mm.", "ชิ้น", 1],
      ["1010230001", "CLAMP,DOUBLE U-BOLT,M.16 (WIRE ROPE CLIP)", "ชุด", 4],
      ["1030030103", "INSULATOR,STRAIN,TYPE D (CLASS 54-4)TIS.280", "ชิ้น", 2]
    ]),
    "23005": set("23005", "DEADEND GUY GY-21 95 SQ.MM. ON 12.2 M. POLE", [
      ["1000040003", "ANCHOR, PLATE, REINFORCED CONCRETE 600 X 600 X 180 MM.", "ชิ้น", 1],
      ["1010100006", "WIRE,STEEL STRANDED 95 sq.mm.TIS.404", "ม.", 16],
      ["1010180100", "WASHER,PLAIN,SQUARE,LARGE 52x52x4.5 mm.", "ชิ้น", 1],
      ["1010210000", "ROD,ANCHOR,ROUND EYE M.16, 2,000 mm.LONG", "ชุด", 1],
      ["1010210201", "BOLT,STRAND EYE,SINGLE 45 DEGREE M.16x250 mm.", "ชุด", 1],
      ["1010210304", "THIMBLE,GUY,FOR STEEL WIRE 50-95 sq.mm.", "ชิ้น", 1],
      ["1010230001", "CLAMP,DOUBLE U-BOLT,M.16 (WIRE ROPE CLIP)", "ชุด", 4],
      ["1030030103", "INSULATOR,STRAIN,TYPE D (CLASS 54-4)TIS.280", "ชิ้น", 1]
    ]),
    "23006": set("23006", "DEADEND GUY GY-21 95 SQ.MM. ON 14.3 M. POLE", [
      ["1000040003", "ANCHOR, PLATE, REINFORCED CONCRETE 600 X 600 X 180 MM.", "ชิ้น", 1],
      ["1010100006", "WIRE,STEEL STRANDED 95 sq.mm.TIS.404", "ม.", 18],
      ["1010180100", "WASHER,PLAIN,SQUARE,LARGE 52x52x4.5 mm.", "ชิ้น", 1],
      ["1010210000", "ROD,ANCHOR,ROUND EYE M.16, 2,000 mm.LONG", "ชุด", 1],
      ["1010210202", "BOLT,STRAND EYE,SINGLE 45 DEGREE M.16X350 MM.", "ชุด", 1],
      ["1010210304", "THIMBLE,GUY,FOR STEEL WIRE 50-95 sq.mm.", "ชิ้น", 1],
      ["1010230001", "CLAMP,DOUBLE U-BOLT,M.16 (WIRE ROPE CLIP)", "ชุด", 4],
      ["1030030103", "INSULATOR,STRAIN,TYPE D (CLASS 54-4)TIS.280", "ชิ้น", 1]
    ])
  };

  const MV_CABLE_AERIAL = {
    50: "1020050000",
    95: "1020050001",
    120: "1020050002",
    150: "1020050003",
    185: "1020050004",
    240: "1020050005"
  };

  const MV_CABLE_BARE = {
    35: "1020020001",
    50: "1020020002",
    70: "1020020003",
    95: "1020020004",
    120: "1020020005",
    185: "1020020007"
  };

  const LV_CABLE = {
    25: "1020070000",
    35: "1020070001",
    50: "1020070002",
    70: "1020070003",
    95: "1020070004",
    120: "1020070005",
    150: "1020070006",
    185: "1020070007",
    240: "1020070008"
  };

  window.PRICE_QUOTE_CATALOG = {
    POLE_BY_HEIGHT_M,
    CONCRETE,
    TRANSFORMER_BY_KVA,
    TRANSFORMER_BY_KVA_LEGACY,
    PRICE_QUOTE_DEFAULTS,
    sets: GUY_SETS,
    MV_CABLE_AERIAL,
    MV_CABLE_BARE,
    LV_CABLE
  };
})();
