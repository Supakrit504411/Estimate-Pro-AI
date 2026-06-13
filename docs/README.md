# PEA Estimation AI Pro 2026

> ระบบประมาณการพัสดุและค่าแรงไฟฟ้า กฟภ. ด้วย AI — **"รู้ราคาใน 15 วินาที"**

[![PEA Inno MOVE](https://img.shields.io/badge/PEA-Inno%20MOVE-71e8ff?style=flat-square)](.)
[![Gemini AI](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-8f6bff?style=flat-square)](.)
[![Stack](https://img.shields.io/badge/Stack-Vanilla%20JS%20%2B%20GAS-f5c96a?style=flat-square)](.)

---

## ภาพรวม | Overview

**PEA Estimation AI Pro 2026** เป็นแอปพลิเคชันเว็บสำหรับเจ้าหน้าที่ การไฟฟ้าส่วนภูมิภาค (PEA) ในการประมาณการค่าพัสดุไฟฟ้าและค่าแรงติดตั้ง โดยใช้ **Google Gemini AI** อ่าน BOM (Bill of Materials) จากรูปภาพหรือ PDF แล้วคำนวณงบประมาณตามประเภทงบมาตรฐานของ กฟภ. อัตโนมัติ

| หัวข้อ | รายละเอียด |
|--------|------------|
| **องค์กร** | การไฟฟ้าส่วนภูมิภาค (PEA) |
| **หน่วยงานพัฒนา** | กฟจ.นครพนม — ฝ่ายบริการและสัมพันธ์ลูกค้า |
| **ผู้พัฒนา** | นายศุภกฤษ ทะวัง ชผ.บส.กฟจ.นพ. |
| **โปรแกรม** | PEA Inno MOVE (นวัตกรรมภายใน กฟภ.) |
| **เวอร์ชัน** | 1.0 (2026) |

---

## ปัญหาที่แก้ไข | Problem Statement

เจ้าหน้าที่ กฟภ. ต้องประมาณการค่าพัสดุและค่าแรงจาก BOM เป็นประจำ กระบวนการเดิมมีข้อจำกัด:

- **ใช้เวลานาน** — พิมพ์รหัสพัสดุและจำนวนด้วยมือจากเอกสาร BOM
- **เสี่ยงผิดพลาด** — รหัสพัสดุซับซ้อน (or, slash, range) ทำให้พิมพ์ผิดได้ง่าย
- **สูตรงบหลากหลาย** — งบ 01.1 / 02.1 / 02.2 / 03.1 มีสูตรคำนวณต่างกัน
- **ไม่มีระบบกลาง** — ข้อมูลกระจัดกระจาย ไม่มีประวัติโครงการรวมศูนย์

---

## วิธีแก้ไข | Solution

```
ถ่ายรูป BOM → AI อ่านรหัสพัสดุ+จำนวน → ผู้ใช้ตรวจสอบ+เลือกค่าแรง → คำนวณงบอัตโนมัติ → บันทึกโครงการ
```

| ขั้นตอน | เทคโนโลยี | ผลลัพธ์ |
|---------|-----------|---------|
| สแกน BOM | Gemini 2.5 Flash (Multimodal AI) | ดึง Mat. No. + Qty อัตโนมัติ |
| ตรวจสอบ | AI Review Queue (Human-in-the-Loop) | ผู้ใช้ยืนยันก่อนนำเข้างบ |
| คำนวณ | สูตรงบ กฟภ. 4 ประเภท | ยอดประมาณการ real-time |
| จัดเก็บ | Google Sheets + Drive | ประวัติโครงการ + ไฟล์แนบ |

---

## ฟีเจอร์หลัก | Key Features

- **AI Scan BOM** — รองรับรูปภาพและ PDF หลายไฟล์พร้อมกัน
- **AI Review Queue** — ตรวจสอบผล AI ทั้งหมดใน modal เดียวก่อนนำเข้า
- **Smart Material ID Parser** — รองรับ `or`, `/`, range (`1050010200-2`), multi-ID
- **Multi-Budget** — สร้างหลายงบในโครงการเดียว (01.1, 02.1, 02.2, 03.1)
- **คำนวณงบ Real-time** — แสดง breakdown พัสดุ/แรง/คุมงาน/ขนส่ง/เบ็ดเตล็ด/ดำเนินการ/กำไร
- **ค้นหาพัสดุ Manual** — Autocomplete จาก master data
- **เลือกค่าแรง Manual** — Human-in-the-loop สำหรับทุกรายการ
- **บันทึก/แก้ไข/ลบโครงการ** — พร้อม password protection
- **ประวัติโครงการ** — ค้นหา, ดูรายละเอียด, preview ไฟล์ Drive
- **Export Excel** — ส่งออก `.xlsx` ด้วย SheetJS
- **Mobile-First UI** — ใช้งานบนมือถือหน้างานได้ทันที
- **ปุ่มทางลัดพัสดุ** — หม้อแปลง / เสา / สายไฟ กดปุ๊บเลือกได้เลย
- **โหมดสำรวจหน้างาน** — ปักหมุดตาม span + สร้าง BOM อัตโนมัติ

---

## Tech Stack

| ชั้น | เทคโนโลยี |
|------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| UI Library | SweetAlert2 v11 |
| Export | SheetJS (xlsx) v0.18.5 |
| Hosting | Vercel (Static + Serverless) |
| API Proxy | Vercel Function (`api/gas.js`) |
| Backend | Google Apps Script (GAS) |
| AI | Google Gemini 2.5 Flash |
| Database | Google Sheets |
| File Storage | Google Drive |

---

## โครงสร้างโปรเจกต์ | Project Structure

```
Codex-Estimate Pro/
├── index.html
├── app.js
├── survey.js           # โหมดสำรวจหน้างาน
├── services.js
├── config.js
├── styles.css
├── api/gas.js
├── GAS.txt
├── README.md           # จุดเริ่มต้น (ลิงก์ไป docs/)
└── docs/
    ├── README.md       # เอกสารหลัก (ไฟล์นี้)
    ├── project/SUMMARY.md
    ├── technical/
    │   ├── ARCHITECTURE.md
    │   ├── DEPLOYMENT.md
    │   └── env.example
    ├── pitch/INNOVATION_PITCH.md
    └── roadmap/ROADMAP.md
```

---

## เริ่มต้นใช้งาน | Quick Start

### 1. Deploy Frontend (Vercel)

```bash
# Push โค้ดไป GitHub แล้วเชื่อม Vercel
# ตั้งค่า Environment Variable:
GAS_WEB_APP_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

### 2. Deploy Backend (Google Apps Script)

1. เปิด [Google Apps Script](https://script.google.com)
2. สร้างโปรเจกต์ใหม่ → คัดลอกโค้ดจาก `GAS.txt`
3. ตั้งค่า Script Properties (แนะนำแทน hardcode):
   - `GEMINI_API_KEY`
   - `SPREADSHEET_ID`
   - `FOLDER_ID`
4. Deploy → New deployment → Web app → Execute as: Me → Access: Anyone
5. คัดลอก URL ไปใส่ใน `GAS_WEB_APP_URL` ของ Vercel

### 3. เตรียม Google Sheets

สร้าง Spreadsheet พร้อม sheets:

| Sheet | หน้าที่ |
|-------|---------|
| `2026-1` | Master พัสดุ (Col B=id, C=name, D=unit, E=matPrice, F=labPrice) |
| `ค่าแรง` | ตัวเลือกค่าแรง (Col A=matId, C=desc, E=price) |
| `Project_Database` | หัวโครงการ |
| `Project_Details` | รายละเอียดพัสดุ |
| `Settings` | รหัสผ่านแก้ไข/ลบ (Cell B1) |

รายละเอียดเพิ่มเติม → [technical/DEPLOYMENT.md](./technical/DEPLOYMENT.md)

---

## สูตรคำนวณงบ | Budget Formula

```
M = Σ (ราคาพัสดุ × จำนวน)
L = Σ (ราคาแรง × จำนวน)
คุมงาน     = L × 30%
ขนส่ง      = M × 5%
เบ็ดเตล็ด   = SubTotal × 5%
ดำเนินการ   = (SubTotal + เบ็ดเตล็ด) × 5%
กำไร 30%   = เฉพาะงบ 02.2
ลด 50%     = เฉพาะงบ 03.1
```

| งบ | คำอธิบาย | Logic พิเศษ |
|----|----------|-------------|
| 01.1 | PEA 100% | สูตรมาตรฐาน |
| 02.1 | CUS 100% | สูตรมาตรฐาน |
| 02.2 | CUS 100% | + กำไร 30% |
| 03.1 | PEA 50%, CUS 50% | ยอดสุดท้าย × 50% |

---

## API Endpoints

| Action | Method | คำอธิบาย |
|--------|--------|----------|
| `health` | GET | Health check |
| `master-data` | GET | โหลด master พัสดุ + ค่าแรง |
| `process-image-ai` | POST | Gemini OCR/extract BOM |
| `save-project` | POST | บันทึกโครงการ |
| `saved-projects` | GET | รายการโครงการ |
| `project-details` | POST | รายละเอียดพัสดุ |
| `verify-password` | POST | ตรวจรหัสแก้ไข/ลบ |
| `delete-project` | POST | ลบโครงการ |
| `line-intake` | POST | คิว LINE (future) |
| `line-search` | POST | ค้นหาโครงการสำหรับ LINE |

---

## เอกสารเพิ่มเติม | Documentation

| เอกสาร | เนื้อหา |
|--------|---------|
| [project/SUMMARY.md](./project/SUMMARY.md) | สรุปโปรเจกต์ฉบับย่อ |
| [technical/ARCHITECTURE.md](./technical/ARCHITECTURE.md) | สถาปัตยกรรมและ data flow |
| [technical/DEPLOYMENT.md](./technical/DEPLOYMENT.md) | คู่มือ deploy ทีละขั้น |
| [pitch/INNOVATION_PITCH.md](./pitch/INNOVATION_PITCH.md) | เอกสาร pitching นวัตกรรม |
| [roadmap/ROADMAP.md](./roadmap/ROADMAP.md) | แผนพัฒนาต่อยอด |

---

## ข้อควรระวัง | Important Notes

- **ห้ามแก้สูตรงบ** โดยไม่ได้รับอนุมัติจากหน่วยงาน — สูตรสะท้อนนโยบาย กฟภ.
- **AI ห้ามเลือกค่าแรงอัตโนมัติ** — ผู้ใช้ต้องเลือก labor option เองทุกครั้ง
- **API Key** — ย้าย Gemini API Key ไป Script Properties ก่อน production
- **config.js** — ใช้ `apiBaseUrl: "/api/gas"` เสมอ ห้ามใส่ GAS URL ตรงๆ

---

## License & Credit

Developed by **PEA Nakhon Phanom** — Customer Service and Relations Section  
(นายศุภกฤษ ทะวัง ชผ.บส.กฟจ.นพ.)

โครงการภายใต้ **PEA Inno MOVE** — นวัตกรรมเพื่อยกระดับการให้บริการ กฟภ.
