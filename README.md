# PEA Estimation AI Pro 2026

> อัปเดตเอกสาร: 2026-06-13 · Git: `89cef61`

แอปประมาณการงานไฟฟ้า (PEA) สำหรับทีมงานภายใน — สร้าง BOQ, สำรวจหน้างานบนแผนที่, ถามราคา, แชร์โครงการ และ Admin Console

**Production:** https://estimate-pro-ai.vercel.app

> หมายเหตุ: `pro-ai.vercel.app` เป็นโปรเจกต์อื่น — ใช้ URL ด้านบนเท่านั้น  
**Repository:** https://github.com/Supakrit504411/Estimate-Pro-AI

---

## ฟีเจอร์หลัก

| แท็บ | ความสามารถ |
|------|------------|
| สร้างงานใหม่ | BOQ หลายประเภทงบ, Quick pick, AI Scan + Review Queue (ค้นหา master / ข้ามแถว) |
| ประวัติโครงการ | Timeline cards, ค้นหา/เรียง/กรอง, แชร์ view/edit, Public, ตาราง SET summary |
| สำรวจหน้างาน | Leaflet + OSRM, MV/LV/TR, KML export, bulk pole apply (4 กลุ่ม), stats overlay บนแผนที่ |
| ถามราคา | NLU + Gemini (AI Answer), chat thread, LV phase clarify, Export Excel/PDF |
| Theme | Dark / Light / Auto (แผนที่ survey ใช้ tile light เสมอ) |
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
# 4. ทดสอบ + syntax check ก่อน push
node --check app.js
node --check survey.js
node scripts/run-price-quote-tests.js   # 169 tests
# 5. Push ขึ้น Vercel
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
| [docs/ROADMAP.md](docs/ROADMAP.md) | แนวทางพัฒนาต่อ / สถานะล่าสุด |
| [docs/NEW_CHAT.md](docs/NEW_CHAT.md) | Prompt เริ่มแชท Cursor + สรุปงานที่ทำแล้ว |
| [docs/CHANGELOG-NOTES.md](docs/CHANGELOG-NOTES.md) | บันทึกการแก้ไขสำคัญ (manual) |
| [docs/README.md](docs/README.md) | **Index เอกสารทั้งหมด** สำหรับ Cursor Agent |

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
