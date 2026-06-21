(function () {
  /**
   * Domain glossary — คำเรียกช่างไฟฟ้า → intent slots / materialId
   * แก้ไขไฟล์นี้เมื่อพบคำถามใหม่ (หรือ sync จาก feedback export)
   */
  window.PRICE_ASK_GLOSSARY = {
    version: 1,
    confidence: {
      clarifyBelow: 0.45,
      warnBelow: 0.62
    },
    units: {
      จุด: { slot: "qty", kind: "count" },
      ต้น: { slot: "poleCount", kind: "count" },
      เมตร: { slot: "distanceM", kind: "length" },
      ม: { slot: "distanceM", kind: "length" },
      ล้าน: { multiplier: 1000000 },
      แสน: { multiplier: 100000 },
      แส: { multiplier: 100000 }
    },
    voltageKeywords: {
      mv: ["แรงสูง", "mv", "22kv", "22 kv", "medium voltage"],
      lv: ["แรงต่ำ", "lv", "0.4", "0.4kv", "low voltage"]
    },
    phaseKeywords: {
      "1p": ["1p", "1 p", "1เฟส", "1 เฟส", "เฟสเดียว", "single phase"],
      "3p": ["3p", "3 p", "3เฟส", "3 เฟส", "สามเฟส", "three phase"]
    },
    scopeKeywords: {
      pole_only: [
        "อย่างเดียว",
        "ไม่พาดสาย",
        "ไม่ลากสาย",
        "ไม่เอาสาย",
        "ไม่เอาพาดสาย",
        "เฉพาะเสา",
        "แค่เสา",
        "วัสดุเสา"
      ],
      with_wire: ["พาดสาย", "ลากสาย", "ขยายเขต", "ขยายสาย", "ระยะทาง"]
    },
    intents: {
      concrete_only: {
        phrases: [
          "เทโคนเสา",
          "เทโคน เสา",
          "เทคอนเสา",
          "คอนเสา",
          "ฐานเสา",
          "เทโคนอย่างเดียว",
          "เทโคน x จุด"
        ],
        exclude: ["ขยายเขต", "ขยายสาย", "พาดสาย", "ระยะทาง"],
        intent: "material_only",
        materialKey: "concrete_mv",
        qtyFrom: ["จุด", "ต้น"]
      },
      budget_pole_count: {
        phrases: ["ได้กี่ต้น", "ปักได้กี่ต้น", "กี่ต้on", "งบพอกี่ต้น", "ทำได้กี่ต้น"],
        requires: ["มีเงิน", "งบ", "ล้าน", "แส", "บาท"],
        scope: "pole_only"
      },
      tr_budget_units: {
        phrases: [
          "กี่เครื่อง",
          "ได้กี่เครื่อง",
          "ขนาดสูงสุด",
          "ใหญ่สุด",
          "ใหญ่ที่สุด"
        ],
        requires: ["มีเงิน", "หม้อแปลง", "งบ", "ล้าน", "บาท"]
      },
      pole_material_only: {
        phrases: ["ไม่เอาหัวเสา", "ไม่รวมหัวเสา", "วัสดุเสาอย่างเดียว", "เสาอย่างเดียว"],
        assemblyMode: "pole_material"
      }
    },
    materials: {
      "9090010025": {
        category: "concrete",
        label: "เทโคน 1/3/5",
        aliases: ["เทโคน", "เทคอน", "คอนเสา", "ฐานเสา", "concrete", "เทโคนเสา", "anchor concrete"]
      },
      "9090010037": {
        category: "concrete",
        label: "เทโคน 1/2/4",
        aliases: ["เทโคนแพลต", "concrete platform", "9090010037"]
      },
      "1000010012": {
        category: "pole",
        heightM: 12.2,
        aliases: ["เสา 12.2", "เสา 12.20", "เสา12.2", "pole 12.2", "เสาแรงสูง 12"]
      },
      "1000010002": {
        category: "pole",
        heightM: 9,
        aliases: ["เสา 9", "เสา9", "pole 9", "เสาแรงต่ำ 9"]
      },
      "1000010013": {
        category: "pole",
        heightM: 14.3,
        aliases: ["เสา 14", "เสา 14.3", "pole 14"]
      },
      "1020050000": {
        category: "wire",
        aliases: ["สายหุ้ม", "aerial 50", "สาย aerial", "สาย mv หุ้ม"]
      },
      "1020020002": {
        category: "wire",
        aliases: ["สายเปลือย", "acsr", "สาย acsr"]
      }
    },
    categories: {
      pole: { label: "เสาไฟฟ้า" },
      concrete: { label: "เทโคน/ฐานเสา" },
      wire: { label: "สายไฟฟ้า" },
      transformer: { label: "หม้อแปลง" },
      set: { label: "ชุดประกอบ SET" }
    },
    goldenQueries: [
      {
        name: "concrete 10 จุด",
        query: "เทโคนเสา 10 จุด ราคาเท่าไร",
        budgetType: "02.1",
        expect: { intent: "material_only", qty: 10, materialId: "9090010025" }
      },
      {
        name: "budget 2M pole count",
        query: "มีเงิน 2 ล้านบาทจะปักเสาขนาด 12.20 เมตรอย่างเดียวไม่เอาพาดสายไฟได้กี่ต้น",
        budgetType: "02.1",
        expect: {
          intent: "budget_capacity",
          budgetBaht: 2000000,
          capacityMode: "poles",
          scope: "pole_only",
          poleHeightM: 12.2
        }
      },
      {
        name: "line lv 200m",
        query: "ขยายเขตแรงต่ำ ระยะทาง 200 เมตร 3 เฟส",
        budgetType: "01.1",
        expect: { intent: "pole_run", distanceM: 200, phase: "3p", needsClarification: false }
      },
      {
        name: "line mv needs clarify",
        query: "ขยายเขต 200 เมตร",
        budgetType: "01.1",
        expect: { intent: "pole_run", needsClarification: true }
      },
      {
        name: "tr budget 5M units",
        query: "มีเงิน 5,000,000 บาทติดหม้อแปลงขนาดสูงสุดได้กี่ kVA ได้กี่เครื่อง",
        budgetType: "02.2",
        expect: {
          intent: "tr_budget_check",
          budgetBaht: 5000000,
          wantsUnitCount: true,
          wantsMaxSize: true
        }
      }
    ]
  };
})();
