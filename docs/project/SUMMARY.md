# PEA Estimation AI Pro 2026 — สรุปโปรเจกต์

> เอกสารสรุปฉบับย่อสำหรับทีมพัฒนาและผู้ที่ต้องการทำความเข้าใจโปรเจกต์อย่างรวดเร็ว

---

## ข้อมูลโปรเจกต์

| หัวข้อ | รายละเอียด |
|--------|------------|
| **ชื่อ** | PEA Estimation AI Pro 2026 |
| **Tagline** | ระบบประมาณการ "รู้ราคาใน 15 วินาที" |
| **องค์กร** | การไฟฟ้าส่วนภูมิภาค (PEA) |
| **หน่วยงาน** | กฟจ.นครพนม — ฝ่ายบริการและสัมพันธ์ลูกค้า |
| **ผู้พัฒนา** | นายศุภกฤษ ทะวัง ชผ.บส.กฟจ.นพ. |
| **โปรแกรม** | PEA Inno MOVE |
| **เวอร์ชัน** | 1.0 |

---

## วัตถุประสงค์

แอปพลิเคชันเว็บ mobile-first สำหรับประมาณการพัสดุไฟฟ้าและค่าแรงติดตั้ง กฟภ. โดย:

1. ใช้ **AI (Gemini 2.5 Flash)** อ่าน BOM จากรูปภาพ/PDF
2. แปลงเป็นรายการพัสดุ structured พร้อมจำนวน
3. ให้ผู้ใช้ตรวจสอบและเลือกค่าแรง (Human-in-the-Loop)
4. คำนวณงบ 4 ประเภทตามสูตร กฟภ. อัตโนมัติ
5. บันทึกโครงการใน Google Sheets + ไฟล์ใน Google Drive

---

## สถาปัตยกรรม Deploy

```
Frontend (Vercel) → Proxy (api/gas.js) → Backend (GAS) → Sheets + Drive + Gemini
```

| ชั้น | เทคโนโลยี |
|------|-----------|
| Frontend | HTML5 + CSS3 + Vanilla JS |
| Proxy | Vercel Serverless Function |
| Backend | Google Apps Script |
| AI | Gemini 2.5 Flash |
| Database | Google Sheets |
| Storage | Google Drive |

---

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ | บรรทัดโดยประมาณ |
|------|---------|----------------|
| `index.html` | UI shell (2 tabs) | ~167 |
| `styles.css` | Design system | — |
| `app.js` | State, UI, calculations | ~1,075 |
| `services.js` | API client (ApiService) | ~80 |
| `config.js` | Frontend config | ~17 |
| `api/gas.js` | Vercel proxy | ~52 |
| `GAS.txt` | GAS backend source | ~409 |

---

## API Routes (GAS Backend)

| Action | Method | หน้าที่ |
|--------|--------|---------|
| `health` | GET | Health check |
| `master-data` | GET | โหลดพัสดุ + ค่าแรง |
| `process-image-ai` | POST | Gemini OCR/extract BOM |
| `save-project` | POST | บันทึกโครงการ |
| `saved-projects` | GET | รายการโครงการ |
| `project-details` | POST | รายละเอียดพัสดุ |
| `verify-password` | POST | ตรวจรหัสแก้ไข/ลบ |
| `delete-project` | POST | ลบโครงการ |
| `line-intake` | POST | คิว LINE (future) |
| `line-search` | POST | ค้นหาโครงการ LINE |

---

## Google Sheets Schema

| Sheet | หน้าที่ |
|-------|---------|
| `2026-1` | Master พัสดุ (id, name, unit, matPrice, labPrice) |
| `ค่าแรง` | ตัวเลือกค่าแรงต่อรหัสพัสดุ |
| `Project_Database` | หัวโครงการ (id, date, name, total, imageUrls) |
| `Project_Details` | รายละเอียดพัสดุต่อโครงการ |
| `Settings` | รหัสผ่านแก้ไข/ลบ (B1) |
| `Line_Intake_Queue` | คิว LINE (future) |

---

## สูตรคำนวณงบ

```
M = Σ(ราคาพัสดุ × จำนวน)
L = Σ(ราคาแรง × จำนวน)
คุมงาน = L × 30%
ขนส่ง = M × 5%
เบ็ดเตล็ด = SubTotal × 5%
ดำเนินการ = (SubTotal + เบ็ดเตล็ด) × 5%
```

| งบ | Logic พิเศษ |
|----|-------------|
| 01.1 (PEA 100%) | สูตรมาตรฐาน |
| 02.1 (CUS 100%) | สูตรมาตรฐาน |
| 02.2 (CUS 100%) | + กำไร 30% |
| 03.1 (PEA 50%, CUS 50%) | ยอดสุดท้าย × 50% |

---

## AI Scan Logic

### Gemini Prompt Rules
- สกัด `id` = รหัสพัสดุทั้งก้อน (รองรับ or/slash/range ในช่องเดียว)
- สกัด `qty` = จากคอลัมน์ REQ'D ช่อง I เท่านั้น
- Output: JSON Array `[{"id":"...","qty":...}]`

### Client-side Parser
- `tokenizeAiId()` — แยก or, /, comma, space
- `expandAiToken()` — ขยาย range เช่น `1050010200-2`
- Match กับ master data → สร้าง AI Review Queue

### Human-in-the-Loop Rule
> **AI ห้ามเลือกค่าแรงอัตโนมัติ** — ผู้ใช้ต้องเลือก labor option เองทุกครั้ง

---

## ฟีเจอร์ที่เสร็จแล้ว

- [x] AI Scan BOM (รูป + PDF, multi-file)
- [x] AI Review Queue (batch review ใน modal เดียว)
- [x] Smart Material ID Parser (or/slash/range)
- [x] Multi-budget (4 ประเภทงบ)
- [x] Real-time budget calculation + breakdown
- [x] Manual search + labor selection
- [x] Save/Edit/Delete project (password protected)
- [x] Project history + search
- [x] Export Excel (.xlsx)
- [x] Google Drive file storage
- [x] Mobile-first responsive UI
- [x] Vercel + GAS deployment architecture
- [x] ปุ่มทางลัดพัสดุ (หม้อแปลง / เสา / สายไฟ)
- [x] โหมดสำรวจหน้างาน (แผนที่ + span + สร้าง BOM)

## ฟีเจอร์ที่ยังไม่เสร็จ

- [ ] Save-time validation layer
- [ ] Advanced history filters (date, budget type)
- [ ] Dashboard/reporting
- [ ] LINE webhook receiver จริง
- [ ] LINE search/reply formatting
- [ ] Security hardening (API key, password hash)
- [ ] Automated tests

---

## การ Deploy

### Vercel (Frontend)
- Push ไฟล์: `index.html`, `styles.css`, `app.js`, `services.js`, `config.js`, `api/gas.js`
- Env: `GAS_WEB_APP_URL`

### GAS (Backend)
- Copy `GAS.txt` → GAS Editor → Deploy Web App
- ตั้ง Script Properties: `GEMINI_API_KEY`, `SPREADSHEET_ID`, `FOLDER_ID`

### Config สำคัญ
```js
// config.js — ห้ามเปลี่ยน
apiBaseUrl: "/api/gas"
```

---

## ข้อควรระวังเมื่อแก้ไข

1. **ห้ามแก้สูตรงบ** โดยไม่ได้รับอนุมัติ
2. **ห้ามให้ AI เลือกค่าแรงอัตโนมัติ**
3. **ห้ามใส่ GAS URL ตรงใน config.js**
4. **ระวังเมื่อแก้ API routes** — ต้อง sync ทั้ง GAS + Vercel proxy
5. **แยก layer ชัดเจน** — UI (app.js) / Service (services.js) / Backend (GAS.txt)

---

## เอกสารที่เกี่ยวข้อง

| เอกสาร | เนื้อหา |
|--------|---------|
| [../README.md](../README.md) | เอกสารหลักโปรเจกต์ |
| [../technical/ARCHITECTURE.md](../technical/ARCHITECTURE.md) | สถาปัตยกรรม |
| [../technical/DEPLOYMENT.md](../technical/DEPLOYMENT.md) | คู่มือ deploy |
| [../pitch/INNOVATION_PITCH.md](../pitch/INNOVATION_PITCH.md) | เอกสาร pitching |
| [../roadmap/ROADMAP.md](../roadmap/ROADMAP.md) | แผนพัฒนาต่อยอด |

---

## Credit

Developed by **PEA Nakhon Phanom** — Customer Service and Relations Section  
(นายศุภกฤษ ทะวัง ชผ.บส.กฟจ.นพ.)

โครงการภายใต้ **PEA Inno MOVE** 2026
