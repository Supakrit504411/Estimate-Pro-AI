# Roadmap — PEA Estimation AI Pro 2026

> อัปเดต: 2026-06-13

---

## Phase 1: Core Features ✅ (เสร็จแล้ว)

| ฟีเจอร์ | สถานะ |
|---------|--------|
| AI Scan BOM (Gemini) | ✅ |
| Review Queue + ค่าแรง | ✅ |
| งบ 4 ประเภท | ✅ |
| บันทึก Sheets + Drive | ✅ |
| ประวัติ ดู/แก้ไข/ลบ | ✅ |
| ปุ่มทางลัด หม้อแปลง/เสา/สายไฟ | ✅ |
| แท็บสำรวจหน้างาน | ✅ |
| หมุด 0 + Span + OSRM | ✅ |
| เข้าโค้ง / ออกโค้ง | ✅ |
| Default พัสดุทางตรง/โค้ง | ✅ |
| **MV/LV + 1P/3P เลือกระบบ** | ✅ `b89550c` |
| **SET presets (72 ชุด) + OHGW** | ✅ `b89550c` |
| **Wire multiplier ตามเฟส** | ✅ |
| **Guy / Surge / Grounding — เสา end/curve** | ✅ `e7e3101` |
| **LV Surge ทุก 400 ม.** | ✅ `e7e3101` |
| แนบรูปหน้างาน (คอลัมน์ E) | ✅ |
| จับภาพแผนที่ + surveyMeta (คอลัมน์ F) | ✅ |
| UI มือถือ: แผนที่เต็มจอ + toolbar พับ | ✅ |
| แสดงรูปประวัติบนมือถือ (drive-file-previews) | ✅ |
| Undo/Redo สำรวจ | ✅ |
| **KML export เส้นทางสำรวจ** | ✅ `9c5e895` — ปุ่ม「ส่งออก KML」ใน spec phase |
| **กล่องสถิติเสาบนแผนที่ capture** | ✅ `9c5e895` — poleStats overlay |
| **Bulk apply สเปกเสา (4 กลุ่ม)** | ✅ `be6b67a` | ทางตรง / เข้าโค้ง / ออกโค้ง / ภายในโค้ง |
| **SET usage ใน surveyMeta + ประวัติ** | ✅ `9c5e895` |
| **แผนที่ tile light เสมอ** | ✅ `9c5e895` — ไม่ตาม dark theme |

---

## Phase 2: Stabilize & Secure (Q3 2026)

> ทำให้ระบบพร้อม pilot ในหน่วยงานจริง

### 2.1 Security
- [ ] ย้าย GEMINI_API_KEY → Script Properties
- [ ] Hash password แก้ไข/ลบ
- [ ] จำกัด CORS ให้เฉพาะ domain Vercel
- [ ] Rate limiting AI Scan

### 2.2 Validation
- [ ] ตรวจ payload ก่อน save (GAS + frontend)
- [ ] จำกัดขนาดไฟล์ upload
- [ ] ตรวจ SET id กับ master data ก่อน BOM

### 2.3 Pilot Test
- [ ] ทดลอง กฟจ.นครพนom 3 เดือน
- [ ] เก็บ feedback + bug log
- [ ] ทดสอบ field: MV 1P/3P + LV 1P/3P ครบ 4 config

### 2.4 History Enhancement
- [ ] กรองตามวันที่ / งบ
- [ ] Pagination

---

## Phase 3: Integration (Q4 2026)

### 3.1 LINE Messaging API
- ลูกค้าส่งรูป BOM → AI ตอบยอด
- เจ้าหน้าที่ค้นหาโครงการใน LINE

### 3.2 Export / Report
- PDF รายงานประมาณการ
- ส่งออก SAP (ถ้ามี API)

---

## Phase 4: Advanced Survey (อนาคต)

- [ ] Offline map cache
- [ ] แก้ไขหมุดทีละจุดในประวัติ
- [x] Export KML/KMZ เส้นทางสำรวจ ✅ `buildProjectKml()` + `#surveyExportKmlBtn`
- [ ] หลาย Span ในสำรวจเดียว
- [ ] เลือก Guy อัตโนมัติตามความสูงเสา
- [ ] UI แก้ special pole ใน history replay

---

## Known Issues / Tech Debt

| รายการ | หมายเหตุ |
|--------|----------|
| OSRM public API | อาจช้า/จำกัด — พิจารณา self-host |
| ไฟล์ > 4MB | drive-file-previews แสดงลิงก์แทน |
| GAS.txt manual deploy | ไม่มี CI สำหรับ backend |
| Password plain text | แก้ใน Phase 2 |
| survey-presets.js | ต้อง regenerate หลังแก้ scripts/ |
| โครงการเก่าไม่มี setUsage | save ก่อน `9c5e895` → ประวัติแสดง `—` ในคอลัมน์ SET |
