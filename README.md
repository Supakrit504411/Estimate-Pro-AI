# PEA Estimation AI Pro

เว็บแอปประมาณการงานก่อสร้างระบบจำหน่ายไฟฟ้า (กฟภ.) — สร้าง BOQ จากการสำรวจหน้างานบนแผนที่, สแกน BOM จากรูปถ่ายด้วย AI, ถามราคาพัสดุแบบแชท และเก็บประวัติโครงการพร้อมระบบแชร์สิทธิ์

พัฒนาโดย กฟจ.นครพนม — แผนกบริการลูกค้าและสัมพันธ์ (นายศุภกฤษ ทะวัง)

## ฟีเจอร์หลัก

- **สำรวจหน้างานบนแผนที่ (Leaflet)** — แตะแผนที่เพื่อปักหมุด ระบบถามประเภทหมุดเป็น bottom sheet, วางเสาอัตโนมัติทุกระยะ Span (ค่าเริ่มต้น 40 ม. ปรับ 15/20/40/80 ได้ระหว่างสำรวจ), รองรับช่วงโค้ง, ติดตั้งหม้อแปลง (TR), แยกส่วนงาน MV/LV, เส้นทางวางเสาตามถนนจริงผ่าน OSRM routing, โหมดกลางแจ้ง (high-contrast) สำหรับงานกลางแดด
- **ภาพแผนที่สำรวจอัตโนมัติ** — เมื่อกด "สำรวจเสร็จ" ระบบวาดภาพแผนที่+แนวเสา+สรุปเสาเป็น PNG เก็บเข้า Google Drive พร้อมโครงการ (วาดเองทั้งใบจาก tiles — ไม่ใช้ html2canvas)
- **AI Scan BOM** — ถ่ายรูปเอกสาร BOM → ได้รายการพัสดุพร้อมรหัส จับคู่ master data พร้อมไฮไลต์ระดับความมั่นใจ (เขียว/เหลือง/แดง)
- **ถาม AI (ราคาพัสดุ)** — NLU ภาษาไทย ตอบราคาพัสดุ/ชุด SET พร้อมรหัส, export Excel/PDF
- **ประวัติโครงการ + แชร์** — ค้นหา/กรอง/เรียงลำดับ, คลิกรายการเพื่อดูแผนที่สำรวจแบบ modal, แชร์ให้ผู้ใช้อื่นแบบกำหนดสิทธิ์ ดู/แก้ไข หรือเปิด Public
- **Login ผ่าน LINE (LIFF)** หรือรหัสผ่าน, สิทธิ์ผู้ใช้กำหนดจากชีต Config
- **ธีมสว่าง (ค่าเริ่มต้น) / มืด / ตามระบบ** — ดีไซน์สไตล์แอปธนาคาร: สีม่วง PEA `#74045f` สีเดียว การ์ดขาวเงานุ่มบนพื้นเทา

## สถาปัตยกรรม

- **Frontend**: Vanilla JavaScript SPA — ไม่มี framework, ไม่มี bundler, ไฟล์ระดับ root คือตัวจริง
- **Backend**: Google Apps Script (GAS) + Google Sheets เป็นฐานข้อมูล, ไฟล์เก็บใน Google Drive — เรียกผ่าน proxy ([api/gas.js](api/gas.js) บน Vercel serverless)
- **Deploy**: push ขึ้น GitHub `main` → Vercel auto-deploy (https://pro-ai.vercel.app)
- **Libraries (CDN)**: Leaflet 1.9.4, SweetAlert2 v11, SheetJS, LINE LIFF SDK

### ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|---|---|
| [index.html](index.html) | โครงหน้าเดียว ทุก view + SVG icon sprite + Swal mixin + theme bootstrap |
| [app.js](app.js) | แกนหลัก: งบประมาณ, AI scan, ประวัติ/แชร์, รายงาน, `window.AppCore` / `window.AppActions` |
| [survey.js](survey.js) | สำรวจหน้างานทั้งหมด: แผนที่, ปักหมุด, วางเสา, TR, capture ภาพ |
| [styles.css](styles.css) | สไตล์ทั้งแอป — token 2 ธีมอยู่หัวไฟล์, กติกา: **เพิ่ม rule ใหม่ต่อท้ายไฟล์เท่านั้น** |
| [theme.js](theme.js) | สลับธีม + localStorage `pea_theme_v1` |
| [price-ask-nlu.js](price-ask-nlu.js) / [price-quote-engine.js](price-quote-engine.js) | NLU + เครื่องคิดราคา |
| [survey-presets.js](survey-presets.js) | ชุด SET / หัวเสา / TR ตามมาตรฐาน กฟภ. |
| [budget-formula.js](budget-formula.js) | สูตรงบ 01.1 / 02.1 / 02.2 / 03.1 |

> โฟลเดอร์ `Codex-Estimate Pro/` เป็น backup เก่า (gitignore แล้ว) — **ห้ามแก้ไฟล์ในนั้น**

## การพัฒนา

```bash
# dev server (root ของ repo)
npx http-server -p 8080 -c-1

# ทดสอบ (ต้องผ่าน 169 ข้อ ก่อน commit ทุกครั้ง)
node scripts/run-price-quote-tests.js

# ตรวจ syntax
node --check app.js && node --check survey.js
```

หมายเหตุ: รัน local จะต่อ GAS backend ไม่ได้ (dialog "ไม่สามารถโหลดข้อมูลหลักได้" เป็นเรื่องปกติ) — ฟีเจอร์ที่ต้องใช้ master data / Drive ต้องทดสอบบน Vercel

**Cache-busting**: ทุกครั้งที่แก้ JS/CSS ให้ bump เวอร์ชัน `?v=YYYYMMDDx` ใน [index.html](index.html) (ทั้ง `<script>` และ `<link>` styles.css) ไม่งั้นผู้ใช้อาจได้ไฟล์เก่าจาก cache
