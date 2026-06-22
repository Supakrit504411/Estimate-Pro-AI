# สถาปัตยกรรมระบบ — PEA Estimation AI Pro

> อัปเดต: 2026-06-13 · Git: `89cef61`

## ภาพรวม

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (SPA)                                               │
│  index.html + app.js + survey.js + auth.js + services.js     │
└──────────────────────────┬──────────────────────────────────┘
                           │ POST/GET /api/gas?action=...
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Vercel Serverless — api/gas.js                              │
│  Proxy + CORS + GAS_WEB_APP_URL                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Google Apps Script (GAS.txt — deploy manual)                │
│  Routes: login, save-project, share-project, master-data…    │
└──────┬──────────────────┬──────────────────┬────────────────┘
       ▼                  ▼                  ▼
  Google Sheets      Google Drive       Gemini API
  (Config, BOQ,      (รูป scan)         (AI scan, parse price)
   Projects, Audit)
```

---

## Frontend Modules

| Module | บทบาท |
|--------|--------|
| `auth.js` | Login session (`sessionStorage`), RBAC tab visibility, `withAuthPayload()` |
| `services.js` | HTTP client ไป `/api/gas?action=…` |
| `app.js` | Tab router, BOQ CRUD, save/load project, history, share modal, admin, price ask UI |
| `survey.js` | Leaflet map, segment/pole/TR placement, estimate → budget import |
| `survey-project.js` | Data model โครงการสำรวจ, poleStats, setUsage, KML, SET lookup |
| `survey-presets.js` | Preset เสา/สาย/SET (generated) |
| `price-quote-engine.js` | Parse คำถามราคา (local) |
| `budget-formula.js` | สูตรค่าใช้จ่าย / 03.1 |

---

## Authentication & RBAC

1. User login → GAS `login` → ตรวจชีต **Config**
2. Session เก็บ `{ username, role, allowedSteps, aiAsk }`
3. ทุก API call ส่ง `username` ใน body (ผ่าน `AuthSession.withAuthPayload`)
4. GAS ตรวจสิทธิ์อีกครั้งฝั่ง server (view/manage/share)

**ข้อจำกัดปัจจุบัน:** ไม่มี JWT/session token — อาศัย username ใน payload (ควรพัฒนา token ในอนาคต)

---

## Project Ownership & Sharing

คอลัมน์ `Project_Database`:

| Col | Field | ความหมาย |
|-----|-------|----------|
| G | CreatedBy | เจ้าของ |
| H | SharedView | username ที่ดูได้ (comma) |
| I | SharedEdit | username ที่แก้ไขได้ |
| J | IsPublic | Y/N — ทุกคนในระบบเห็น |

กฎ:
- **Share** — เจ้าของหรือ admin
- **Edit/Delete** — เจ้าของ, admin, หรืออยู่ใน SharedEdit
- **View** — ตามกฎข้างต้น + SharedView + Public

Audit → ชีต `Project_Audit`

---

## AI Flow

| ฟีเจอร์ | Model (config) | ที่รัน |
|---------|----------------|--------|
| Scan BOM รูป/PDF | Gemini 2.5 Flash | GAS only |
| Parse คำถามราคา (fallback) | Gemini 3.1 Flash Lite | GAS only |

API keys อยู่ใน GAS เท่านั้น — ไม่ expose ใน frontend

---

## Survey Meta & SET (คอลัมน์ F)

`surveyMeta` JSON เก็บใน `Project_Database` col F ผ่าน `buildSurveyMetaV2()`:

| field | ใช้ทำอะไร |
|-------|-----------|
| `poleStats` | กล่องสรุปบนแผนที่ + ข้อมูลสำรวจใน PDF |
| `setUsage` | ตารางสรุป SET + จัดกลุ่ม BOQ |

Frontend: `app.js` → `buildGroupedDetailTableBodyHtml`, `resolveMaterialSetIds` (survey-project.js)

---

## Caching

- **Master data (ราคาวัสดุ):** `sessionStorage`, TTL 8 นาที (`masterDataCacheTtlMs`)
- **History / Admin:** in-memory cache ใน `app.js` state — invalidate เมื่อ save/share/delete

---

## External Services

| Service | ใช้เมื่อ |
|---------|----------|
| OSRM (`router.project-osrm.org`) | เส้นทางสายตามถนนในหน้าสำรวจ |
| Google Fonts | Orbitron + Sarabun |
| jsDelivr / cdnjs | SweetAlert2, Leaflet, xlsx, html2canvas |

---

## ไฟล์ที่ไม่อยู่ใน Git

| ไฟล์ | เหตุผล |
|------|--------|
| `GAS.txt` | Backend + Gemini keys + Spreadsheet ID |
| `.env.local` | `GAS_WEB_APP_URL` |

ดู [DEPLOYMENT.md](DEPLOYMENT.md) สำหรับขั้นตอน sync GAS
