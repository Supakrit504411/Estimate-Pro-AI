# PEA Estimation AI Pro 2026

แอปประมาณการงานไฟฟ้า (PEA) สำหรับทีมงานภายใน — สร้าง BOQ, สำรวจหน้างานบนแผนที่, ถามราคา, แชร์โครงการ และ Admin Console

**Production:** https://estimate-pro-ai.vercel.app

> หมายเหตุ: `pro-ai.vercel.app` เป็นโปรเจกต์อื่น — ใช้ URL ด้านบนเท่านั้น  
**Repository:** https://github.com/Supakrit504411/Estimate-Pro-AI

---

## ฟีเจอร์หลัก

| แท็บ | ความสามารถ |
|------|------------|
| สร้างงานใหม่ | BOQ หลายประเภทงบ (01.1 / 02.1 / 02.2 / 03.1), Quick pick, AI Scan รูป BOM |
| ประวัติโครงการ | Timeline cards, ค้นหา/เรียง/กรอง, แชร์ view/edit, Public |
| สำรวจหน้างาน | Leaflet + OSRM, MV/LV/TR, KML export, นำเข้า BOQ |
| ถามราคา | Local engine + Gemini fallback, Export Excel/PDF |
| Admin | ผู้ใช้, โครงการทั้งหมด, Audit log (admin เท่านั้น) |

---

## Tech Stack

- **Frontend:** Vanilla JS, HTML, CSS (mobile-first)
- **Backend:** Google Apps Script → Google Sheets + Drive + Gemini
- **Proxy:** Vercel serverless (`api/gas.js`)
- **CDN:** SweetAlert2, Leaflet, SheetJS, html2canvas

---

## Quick Start (Developer)

```bash
# 1. Clone
git clone https://github.com/Supakrit504411/Estimate-Pro-AI.git
cd Estimate-Pro-AI

# 2. ตั้งค่า env (Vercel หรือ local)
cp .env.example .env.local
# แก้ GAS_WEB_APP_URL

# 3. Deploy GAS — copy GAS.txt ไป Apps Script Editor (ไฟล์นี้ไม่อยู่ใน git)
# 4. Push ขึ้น Vercel หรือ serve static 本地
```

รายละเอียดเต็ม → [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## เอกสาร

| ไฟล์ | เนื้อหา |
|------|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | สถาปัตยกรรมระบบ |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deploy Vercel + GAS |
| [docs/CONFIG-SHEET.md](docs/CONFIG-SHEET.md) | โครงสร้าง Google Sheets |
| [docs/API.md](docs/API.md) | GAS API endpoints |
| [docs/ROADMAP.md](docs/ROADMAP.md) | แนวทางพัฒนาต่อ / ข้อเสนอแนะ |
| [docs/CHANGELOG-NOTES.md](docs/CHANGELOG-NOTES.md) | บันทึกการแก้ไขสำคัญ (manual) |

---

## โครงสร้างโปรเจกต์

```
├── index.html          # Shell + login gate
├── app.js              # Tabs, BOQ, history, share, admin, price ask
├── auth.js             # Session + RBAC
├── config.js           # APP_CONFIG
├── services.js         # API client
├── survey.js           # Map survey UI
├── survey-project.js   # Survey data model
├── price-quote-*.js    # Price ask engine
├── api/gas.js          # Vercel → GAS proxy
├── scripts/            # Build presets, price tests
└── docs/               # เอกสาร (ใน git)
```

**ไม่อยู่ใน git:** `GAS.txt` (backend source + API keys), `.env*`

---

## License / Usage

โปรเจกต์ภายใน PEA — ใช้งานตามนโยบายองค์กร
