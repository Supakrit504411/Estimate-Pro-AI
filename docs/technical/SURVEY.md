# โหมดสำรวจหน้างาน — คู่มือเทคนิค

> อ่านก่อนแก้ `survey.js`, `survey-project.js`, `styles.css` (survey section), หรือ `config.js` (survey)  
> **อัปเดต:** 2026-06-13 · Git: `89cef61`

---

## Workflow ผู้ใช้

```
0. เลือกระบบ (บังคับก่อนเริ่มสำรวจ)
   ├── MV / LV
   └── 1P / 3P
   → ตั้งค่า Default พัสดุ (เสา / หัวเสา SET / สาย / OHGW ถ้า MV)

1. แนบรูปหน้างาน (ไม่บังคับ) → คอลัมน์ E

2. [เริ่มสำรวจ]
   ├── เลือก Span (บังคับ)
   └── กรอกชื่อโครงการ (ถ้ายังไม่มี)

3. ปักหมุดบนแผนที่
   ├── ปักจุดเริ่ม (หมุด 0) + เลือกหัวเสาเริ่มต้น (SET)
   ├── ปักหมุดถัดไป / หมุดควบคุม
   └── เข้าโค้ง / จุดบนโค้ง / ออกโค้ง (ถ้ามี)

4. [สำรวจเสร็จ]
   ├── จับภาพแผนที่ → Survey_Map_*.png
   ├── applyDefaultSpecs() + applySpecialPoleSpecs()
   └── กรอก/ตรวจสอบสเปกแต่ละหมุด

5. [สร้างรายการประมาณการ] → expand SET → นำเข้าแท็บสร้างงาน

6. [บันทึกโครงการ] ที่แท็บสร้างงาน
```

---

## ระบบจำหน่าย (MV/LV × 1P/3P)

| Config key | คูณสาย | OHGW | Wire multiplier |
|------------|--------|------|-----------------|
| `mv1p` | MV 1 เฟส | ✅ | ×2 |
| `mv3p` | MV 3 เฟส | ✅ | ×3 |
| `lv1p` | LV 1 เฟส | ❌ | ×2 |
| `lv3p` | LV 3 เฟส | ❌ | ×4 |

- เลือก MV/LV ก่อน → แล้วเลือก 1P/3P (accordion UI)
- Default แยก **ทางตรง** / **ทางโค้ง** ต่อ config
- หัวเสา = **ชุด SET** (ไม่ใช่รหัสพัสดุเดี่ยว) — BOM จะ expand เป็นพัสดุย่อย

---

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | บทบาท |
|------|--------|
| `survey.js` | Logic สำรวจ, UI spec, BOM |
| `survey-presets.js` | SET definitions + configs + specialPoleRules (auto-generated) |
| `scripts/build-survey-presets.js` | สร้าง `survey-presets.js` |
| `scripts/special-pole-data.js` | Guy/Surge/Grounding SET + กฎเสาพิเศษ |
| `index.html` | `#view3`, MV/LV/1P/3P UI, แผนที่, toolbar |
| `styles.css` | `.survey-*`, `.is-special`, `.survey-tag` |
| `config.js` | `survey.poleCatalog`, OSRM, Span |

**Regenerate presets หลังแก้ data:**

```bash
node scripts/build-survey-presets.js
```

---

## SurveyPresetsApi

```javascript
SurveyPresetsApi.getConfig(voltage, phase)     // mv1p, mv3p, lv1p, lv3p
SurveyPresetsApi.getSet(setId)                 // SET → { id, name, items[] }
SurveyPresetsApi.getSetOptions(setIds)
SurveyPresetsApi.getCableOptions(config, "straight"|"curve")
SurveyPresetsApi.getSpecialPoleRules(configKey)
SurveyPresetsApi.getSpecialPoleRule(configKey, "end"|"curve")
```

**SET ปัจจุบัน:** 72 ชุด (รวม Guy, DE/DDE heads, OHGW DE, Grounding, Surge LV)

---

## State สำคัญ (survey.js)

```javascript
voltageType      // "mv" | "lv"
phaseType        // "1p" | "3p"
presetConfig     // config จาก SurveyPresetsApi
defaults         // { straight, curve } — pole/head/cable/ohgw
sessionActive
phase            // "surveying" | "spec"
poles[]          // หมุดที่คำนวณแล้ว
controlPoints[]
selectedSpan     // 15 | 20 | 40 | 80
surveyMeta
history[]        // undo/redo (max 40)
```

### pole object (spec phase)

```javascript
{
  source,           // start | end | curve_in | curve_out | auto | control
  section,          // straight | curve
  poleMaterialId,
  headMaterialId,   // SET id
  cableMaterialId,
  ohgwSetId,        // MV only
  guySetId,         // เสาพิเศษ — ผู้ใช้เลือก
  concreteMaterialId, concreteQty,
  groundingSetId,   // end MV — auto
  surgeSetId,       // end LV — auto
  surgeArresterId, surgeArresterQty,  // end MV — auto
  specialKind,      // "end" | "curve" | ""
  specFilled
}
```

---

## ปักหมุด

| ประเภท | source | หมายเหตุ |
|--------|--------|----------|
| หมุด 0 | `start` | ไม่เลือกขนาดเสา, มีหัวเสาเริ่มต้น (SET) |
| เสาอัตโนมัติ | `auto` | ตาม Span + OSRM |
| หมุดควบคุม | `control` | ปักเอง |
| เข้าโค้ง | `curve_in` | **เสาพิเศษ** — Guy + DDE |
| ออกโค้ง | `curve_out` | **เสาพิเศษ** — Guy + DDE |
| จุดสุดท้าย | `end` | **เสาพิเศษ** — Guy + DE + Grounding/Surge |

**OSRM:** `config.survey.useRoadRouting` + `osrmUrl`  
ถ้า OSRM ล้ม → fallback เส้นตรง

---

## เสาพิเศษ — GUY / SURGE / GROUNDING

กำหนดใน `scripts/special-pole-data.js` → `specialPoleRules`

### เสาต้นสุดท้าย (`end`)

| ระบบ | Guy (เลือก) | หัวเสา | OHGW | อื่นๆ (auto) |
|------|-------------|--------|------|--------------|
| MV 1P | 23085, 23007, 23008, 23084 | 20106, 20134 | 25256 | คอนกรีต ×1, Grounding 20509, Surge 1040000000 ×2 |
| MV 3P | เหมือน MV | 20213, 20234 | 25256 | คอนกรีต ×1, Grounding 20509, Surge ×3 |
| LV 1P | 13004–13054 | 10024, 10033 | — | คอนกรีต ×0.6, Surge SET 14001 |
| LV 3P | 13004–13054 | 10004, 10033 | — | คอนกรีต ×0.6, Surge SET 14003 |

### เข้าโค้ง / ออกโค้ง (`curve_in`, `curve_out`)

| ระบบ | Guy | หัวเสา DDE | OHGW (MV) |
|------|-----|------------|-----------|
| MV 1P | MV guy sets | 20103, 20137 | 25258 |
| MV 3P | MV guy sets | 20239, 20247 | 25258 |
| LV 1P | LV guy sets | 10062, 10072 | — |
| LV 3P | LV guy sets | 10052, 10072 | — |

### LV Surge ทุก 400 ม.

- คำนวณตามระยะสะสมบนเส้นทางหมุด
- LV 1P → SET **14001** ทุก 400 ม.
- LV 3P → SET **14003** ทุก 400 ม.
- **แยกจาก** Surge ที่เสาสุดท้าย

### ฟังก์ชันหลัก

```javascript
getSpecialPoleKind(pole)      // "end" | "curve" | null
applySpecialPoleSpecs()       // หลัง applyDefaultSpecs()
markPoleSpecFilled(pole)      // เสาพิเศษต้องมี guySetId
addLvIntervalSurges(counts)     // ใน buildBomLines()
```

---

## BOM จากสำรวจ

`buildBomLines()` รวม:

1. เสา (poleMaterialId) — ไม่นับหมุด 0
2. หัวเสา SET → expand items
3. สายไฟ × wireMultiplier × ระยะหมุด
4. OHGW SET (MV)
5. Guy SET (เสาพิเศษ)
6. คอนกรีต 9090010025
7. Grounding SET 20509 (MV end)
8. Surge SET 14001/14003 (LV end)
9. Surge 1040000000 (MV end)
10. LV interval surge ทุก 400 ม.

---

## UI มือถือ vs PC

| | มือถือ | PC |
|---|--------|-----|
| แผนที่ | `body.survey-map-active` เต็มจอ | สูง ~calc(100vh - 220px) |
| Toolbar | พับ — กด "เครื่องมือ ▾" | ลอยขวาแผนที่ |
| เสาพิเศษ | การ์ด `.is-special` + แท็ก | เหมือนกัน |

**CSS สำคัญ:**
- `.survey-pole-card.is-special` — ไฮไลต์เสา end/curve
- `.survey-tag` — ป้าย "เสาต้นสุดท้าย" / "เสาโค้ง"
- `.survey-auto-spec` — รายการ auto (คอนกรีต, grounding, surge)

---

## จับภาพแผนที่

เมื่อกด **สำรวจเสร็จ** (`captureAndStoreSurveyArtifacts`):

1. `fitBounds` ครอบทุกหมุด
2. ซ่อน toolbar ชั่วคราว
3. `html2canvas` บน `.survey-map-shell` (รวม DOM overlay)
4. fallback: วาดเส้นทางบน canvas (`drawRouteCanvasFallback`)
5. **วาดกล่องสถิติ** มุมขวาบน (`drawSurveyStatsOverlay`) + DOM `#surveyMapStatsOverlay` แสดง live ใน spec phase
6. เก็บใน `AppCore.addProjectFileFromBase64` → `Survey_Map_{timestamp}.png`

**หมายเหตุ:** แผนที่ใช้ OSM tile โหมด light เสมอ (`applyMapTheme`) แม้ app อยู่ dark theme

---

## Bulk apply สเปกเสา

เมื่อแก้ dropdown เสา/หัว/สาย/OHGW/Guy ใน spec phase ระบบถาม「เปลี่ยนทั้งหมด」หรือ「เฉพาะต้นนี้」**ตามกลุ่มประเภทเสา** (ไม่ข้ามประเภท):

| กลุ่ม | เสาที่รวม | ไม่รวม |
|------|-----------|--------|
| `straight` | เสา auto ทางตรง | เข้า/ออกโค้ง, ในโค้ง, เริ่ม, สุดท้าย |
| `curve_in` | เสาเข้าโค้งทุกต้น | ออกโค้ง, ในโค้ง, ทางตรง |
| `curve_out` | เสาออกโค้งทุกต้น | เข้าโค้ง, ในโค้ง, ทางตรง |
| `curve_interior` | จุดบนโค้ง + auto ใน section โค้ง | เข้า/ออกโค้ง, ทางตรง |

ฟังก์ชัน: `getBulkApplyGroup()`, `canBulkApplyField()`, `applyFieldToBulkGroup()`

**Guy (SET):** bulk ได้เฉพาะกลุ่ม `curve_in` หรือ `curve_out` แยกกัน

---

## KML Export

- ปุ่ม `#surveyExportKmlBtn`「📍 ส่งออก KML (GIS)」ใต้แผนที่
- ปุ่ม `#surveyExportKmlSideBtn` มุมขวาแผง spec
- **แสดงเฉพาะหลังกด「สำรวจเสร็จ」** (phase spec)
- `exportSurveyKml()` → `survey-project.js` `buildProjectKml()`

---

## surveyMeta ที่บันทึก (survey-project.js)

`buildSurveyMetaV2()` รวม:

| field | เนื้อหา |
|-------|---------|
| `poles`, `controlPoints`, `span`, `distance` | geometry |
| `voltageType`, `phaseType`, `configKey` | ระบบจำหน่าย |
| `poleStats` | สรุปจำนวนเสา/ระยะ (ใช้ overlay + ประวัติ) |
| `setUsage` | รายการ SET ที่ใช้ + qty (`collectSetUsageFromProject`) |

ประวัติ (`app.js`):
- `buildGroupedDetailTableBodyHtml()` — จัดกลุ่มแถวตาม SET + หัวกลุ่ม
- `sortDetailsForSetGrouping()` — เรียงรายการให้อยู่ติดกัน
- `resolveMaterialSetIds()` — lookup จาก `setUsage` + `buildGlobalMaterialSetLookup()`
- ครอบคลุม: ดู, แก้ไข (chip SET), Export PDF/Excel

---

## ข้อควรระวังเวลาแก้โค้ด

1. **อย่า** แก้ `survey-presets.js` ด้วยมือ — แก้ `scripts/` แล้ว run build
2. **อย่า** ใส่ JSON ยาวใน `onclick` — ใช้ cache pattern แบบ `historyRowCache`
3. **ต้อง** `invalidateSize()` หลัง show/hide map stage
4. เพิ่ม SET ใหม่ → `special-pole-data.js` หรือ `build-survey-presets.js` → regenerate
5. ทดสอบ 4 config: mv1p, mv3p, lv1p, lv3p + end + curve

---

## Export

```javascript
window.SurveyModule = {
  onTabOpen,
  resetSurvey,
  getSurveyMeta
};
```

`getSurveyMeta()` ถูกเรียกตอน `saveProject` ใน app.js

---

## Git commits อ้างอิง

| Commit | รายการ |
|--------|--------|
| `89cef61` | Hotfix app.js syntax (login blocked) |
| `bc7516a` | Map stats DOM overlay, SET grouping BOQ, KML side btn |
| `be6b67a` | Bulk apply 4 กลุ่ม |
| `9c5e895` | KML export UI, stats overlay, bulk pole (ทางตรง), setUsage, map light |
| `b89550c` | MV/LV workflow, SET presets, OHGW, wire multiplier |
| `e7e3101` | GUY/SURGE/GROUND special poles, LV 400m surge |
