# สถาปัตยกรรม — PEA Estimation AI Pro 2026

> อัปเดต: 2026-06-13 · Git: `89cef61`

---

## Data Flow

```
[Browser / Mobile]
       │
       ▼
[Vercel Frontend]  index.html, app.js, survey.js
       │
       ▼
[api/gas.js]  proxy  →  GAS_WEB_APP_URL?action=...
       │
       ▼
[Google Apps Script]  GAS.txt (local source)
       ├── Gemini API (AI Scan)
       ├── Google Sheets (master + projects)
       └── Google Drive (ไฟล์โครงการ)
```

---

## API Endpoints

| action | Method | หน้าที่ |
|--------|--------|---------|
| `health` | GET | ตรวจสอบ GAS ทำงาน |
| `master-data` | GET | รายการพัสดุ + ค่าแรง |
| `process-image-ai` | POST | AI อ่าน BOM |
| `save-project` | POST | บันทึกโครงการ |
| `saved-projects` | GET | รายการประวัติ |
| `project-details` | POST | รายการพัสดุต่อโครงการ |
| `verify-password` | POST | ตรวจรหัสแก้ไข/ลบ |
| `delete-project` | POST | ลบโครงการ |
| `drive-file-previews` | POST | ดึงไฟล์ Drive เป็น base64 (มือถือ) |
| `line-intake` | POST | คิว LINE (Phase 3) |
| `line-search` | POST | ค้นหาโครงการ LINE |

### drive-file-previews

```json
// Request
{ "fileIds": ["1wSdGlKGUMXupnYhanIeiBO3bsej4MDWk"] }

// Response
{
  "1wSdGlKGUMXupnYhanIeiBO3bsej4MDWk": {
    "fileId": "...",
    "name": "Survey_Map_123.png",
    "mime": "image/png",
    "base64": "...",
    "viewUrl": "https://drive.google.com/file/d/.../view"
  }
}
```

---

## Google Sheets Schema

### Project_Database

| Col | Field | ตัวอย่าง |
|-----|-------|---------|
| A | projectId | PJ-1781420576983 |
| B | date | 2026-06-14 |
| C | pjName | 2026-06-14_02 |
| D | grandTotal | 125000.50 |
| E | imageUrls | `url1\|url2` |
| F | surveyMeta | `{"startLat":17.41,...}` |

### surveyMeta (คอลัมน์ F)

```json
{
  "startLat": 17.415362,
  "startLng": 104.777432,
  "endLat": 17.419391,
  "endLng": 104.774210,
  "startLabel": "หมุด 0",
  "endLabel": "หมุด 20",
  "poleCount": 21,
  "totalDistanceM": 643,
  "spanM": 40,
  "voltageType": "mv",
  "phaseType": "1p",
  "systemLabel": "MV 1P",
  "wireMultiplier": 2,
  "capturedAt": "2026-06-14T07:01:57.947Z"
}
```

### Project_Details

| Col | Field |
|-----|-------|
| A | projectId |
| B | budgetType |
| C | materialId |
| D | materialName |
| E | qty |
| F | total |
| G | laborDesc |
| H | labPrice |

---

## Frontend Modules

| ไฟล์ | ความรับผิดชอบ |
|------|----------------|
| `app.js` | State, AI queue, budgets, save, history, SET grouping, price ask |
| `survey.js` | แผนที่, MV/LV, bulk apply, stats overlay, KML, OSRM, capture |
| `survey-project.js` | poleStats, setUsage, buildProjectKml, SET lookup |
| `survey-presets.js` | SET definitions (72), configs, specialPoleRules |
| `scripts/build-survey-presets.js` | Generator สำหรับ survey-presets.js |
| `scripts/special-pole-data.js` | Guy/Surge/Grounding data + rules |
| `services.js` | `window.ApiService` — fetch wrapper |
| `config.js` | endpoints, quickCategories, survey pole catalog |

### historyRowCache (app.js)

ปุ่ม "ดู" ส่งแค่ `projectId` — ข้อมูล E/F เก็บใน `state.historyRowCache`  
**เหตุผล:** JSON ในคอลัมน์ F มี `"` ทำให้ `onclick` HTML พัง

---

## Survey Architecture

```
surveyPrePanel
  ├── เลือก MV/LV + 1P/3P
  ├── Default พัสดุ (straight/curve)
  └── [เริ่มสำรวจ] → surveyMapStage
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
    Leaflet Map      surveyToolbar      surveySidePanel
    OSRM routing     (มือถือ: พับ)      spec phase: SET + Guy
```

- **Presets:** `SurveyPresetsApi` — configs mv1p/mv3p/lv1p/lv3p
- **Special poles:** `specialPoleRules` — end, curve_in/out
- **BOM:** expand SET items + wire multiplier + LV 400m surge
- **OSRM:** `config.survey.osrmUrl` — วางเสาตามเส้นถนน
- **Capture:** html2canvas + fallback canvas → `Survey_Map_*.png`
- **Immersive mobile:** `body.survey-map-active` — แผนที่เต็มจอ

---

## ไฟล์ GitHub vs Local

| ไฟล์ | GitHub | หมายเหตุ |
|------|--------|----------|
| app.js, survey.js, survey-presets.js, ... | ✅ | Production frontend |
| GAS.txt | ❌ | Copy ไป Apps Script เอง |
| docs/ | ❌ | เอกสาร local |
| skill.md | ❌ | แนวทาง AI Agent |
