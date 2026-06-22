# สรุปโปรเจกต์ — PEA Estimation AI Pro 2026

> เอกสารฉบับย่อสำหรับทีมพัฒนาและผู้บริหาร  
> อัปเดต: 2026-06-13

---

## ปัญหาที่แก้

| ปัญหาเดิม | วิธีแก้ของระบบ |
|-----------|----------------|
| พิมพ์รหัสพัสดุจาก BOM ด้วยมือ 30–60 นาที | AI อ่าน BOM ใน ~15 วินาที |
| สูตรงบ 4 ประเภทคำนวณเอง | คำนวณอัตโนมัติตามงบที่เลือก |
| สำรวจหน้างานแล้วกลับมาประมาณการซ้ำ | สำรวจ + สร้าง BOM ครั้งเดียวจบ |
| ไม่รู้ว่าปักหมุดจากไหนไปไหน | ภาพแผนที่ + Lat/Long ในประวัติ |
| ลืม Guy/Surge/Ground ที่เสา end/curve | ระบบเติมอัตโนมัติตามมาตรฐาน กฟภ. |

---

## Tech Stack

| ชั้น | เทคโนโลยี |
|------|-----------|
| Frontend | Vanilla JS, Leaflet, html2canvas, SweetAlert2 |
| Hosting | Vercel |
| Backend | Google Apps Script |
| AI | Gemini 2.5 Flash (+ 3.1 Flash Lite fallback สำหรับ scan) |
| Database | Google Sheets |
| Files | Google Drive |

---

## 3 แท็บหลัก

```
[สร้างงานใหม่]  [สำรวจหน้างาน]  [ประวัติโครงการ]  [ถามราคา]
      │                │                  │              │
   AI Scan         MV/LV/TR + แผนที่      ดู/แก้/ลบ      NLU + Gemini
   Review Queue    KML export             SET summary    Export Excel/PDF
   งบ 4 ประเภท      SET → BOM              แชร์/Public
   บันทึก           Guy/Surge/Ground
```

---

## โหมดสำรวจ (สรุป)

| ขั้น | รายละเอียด |
|------|------------|
| เลือกระบบ | MV/LV → 1P/3P |
| Default | เสา, หัว SET, สาย, OHGW (MV) แยกตรง/โค้ง |
| ปักหมุด | Span + OSRM + เข้า/ออกโค้ง |
| เสาพิเศษ | end + curve → Guy, DE/DDE, Grounding, Surge |
| LV | Surge SET ทุก 400 ม. |
| BOM | expand SET 72 ชุด → รายการพัสดุ |

ดูรายละเอียด → [technical/SURVEY.md](../technical/SURVEY.md)

---

## ข้อมูลที่บันทึกต่อโครงการ

### ชีต `Project_Database`

| คอลัมน์ | เก็บอะไร |
|---------|----------|
| A | Project ID (`PJ-xxxxx`) |
| B | วันที่ |
| C | ชื่อโครงการ |
| D | ยอดรวม |
| E | ลิงก์ไฟล์ Drive ทั้งหมด (คั่น `\|`) |
| F | surveyMeta JSON (พิกัด, ระยะทาง, Span, ระบบ MV/LV, setUsage, poleStats) |

**ไฟล์ในคอลัมน์ E อาจรวม:**
1. ไฟล์ AI Scan (รูป/PDF BOM)
2. รูปหน้างานที่แนบตอนสำรวจ
3. ภาพแผนที่ `Survey_Map_*.png`

### ชีต `Project_Details`
- รายการพัสดุรายโครงการ (รหัส, ชื่อ, จำนวน, งบ, ค่าแรง)

---

## จุดเด่น Pitch

| ฟีเจอร์ | มุม Pitch |
|---------|-----------|
| AI Scan BOM | ลดเวลาจากชั่วโมง → วินาที |
| ปุ่มทางลัดพัสดุ | พัสดุที่ใช้บ่อย กดปุ๊บได้เลย |
| โหมดสำรวจ MV/LV | มาตรฐาน กฟภ. ครบ — SET, Guy, Surge |
| ต้นทุน ~0 บาท | ไม่ต้องซื้อ server |

---

## สถานะปัจจุบัน

- **Phase 1:** ✅ เสร็จ — BOQ, AI Scan, สำรวจ MV/LV/TR, KML, SET summary, ถามราคา, แชร์, Admin
- **Phase 1.5 (UX):** ✅ Dark/Light theme, Price Ask chat thread, scan queue manual pick, bulk pole apply
- **Phase 2:** Security, Validation, Pilot (ดู [roadmap/ROADMAP.md](../roadmap/ROADMAP.md))
- **Tests:** 169 price-quote cases (`node scripts/run-price-quote-tests.js`)

**Git ล่าสุด:** `9c5e895` on `main`  
**Production:** https://estimate-pro-ai.vercel.app
