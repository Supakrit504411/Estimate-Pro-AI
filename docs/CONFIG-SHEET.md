# โครงสร้าง Google Sheets

> อัปเดต: 2026-06-13

Spreadsheet ID ตั้งใน `GAS.txt` → `SPREADSHEET_ID`

---

## Config (Users & RBAC)

| Column | ชื่อ | ตัวอย่าง | หมายเหตุ |
|--------|------|----------|----------|
| A | Username | `SR` | ไม่ซ้ำ |
| B | Password | `***` | plain text — **ควร hash ในอนาคต** |
| C | Role | `admin` / `user` | admin เห็น tab 5 |
| D | AllowedSteps | `1,2,3,4` หรือ `create,history,survey,price` | `5` หรือ `admin` = Admin tab |
| E | Active | `Y` / `N` | ปิดบัญชี |
| F | AI-ASK | `Y` / `N` | เปิด Gemini scan + price fallback |

**AllowedSteps aliases:** create=1, history=2, survey=3, price=4, admin=5

---

## Project_Database

| Col | Header | ตัวอย่าง |
|-----|--------|----------|
| A | ProjectID | `PJ-1781974951232` |
| B | Date | วันที่บันทึก |
| C | Name | ชื่อโครงการ |
| D | GrandTotal | ยอดรวม |
| E | ImageURLs | URL รูป (pipe `\|`) |
| F | SurveyMeta | JSON — ดูรายละเอียดด้านล่าง |
| G | CreatedBy | username เจ้าของ |
| H | SharedView | `user0202,user0303` |
| I | SharedEdit | `user0404` |
| J | IsPublic | `Y` / `N` |

### SurveyMeta (col F) — fields สำคัญ

| field | เนื้อหา |
|-------|---------|
| `poleStats` | สรุปเสา (ทางตรง, โค้ง, Guy ฯลฯ) — ใช้ overlay แผนที่ |
| `setUsage` | รายการ SET + qty — ใช้จัดกลุ่ม BOQ |
| `startLat/Lng`, `endLat/Lng` | พิกัด |
| `poleCount`, `totalDistanceM`, `spanM` | สถิติเส้นทาง |

โครงการ save ก่อน ~2026-06-13 อาจไม่มี `setUsage` / `poleStats`

---

## Project_Details

| Col | ความหมาย |
|-----|----------|
| A | ProjectID |
| B+ | รายการ BOQ (รหัส, ชื่อ, จำนวน, ราคา, ประเภทงบ …) |

---

## Project_Audit

| Col | ความหมาย |
|-----|----------|
| A | Timestamp |
| B | Username |
| C | Action (`share`, `delete`, …) |
| D | ProjectId |
| E | Detail (JSON string) |

ตัวอย่าง share detail ที่ถูกต้อง:

```json
{"sharedView":"user0202,user0303","sharedEdit":"user0404","isPublic":"N"}
```

---

## 2026-1 (Master วัสดุ)

| Col | ความหมาย |
|-----|----------|
| B | รหัสวัสดุ |
| C | ชื่อ |
| D | หน่วย |
| E | ราคาวัสดุ |
| F | ค่าแรง default |

---

## ค่าแรง

| Col | ความหมาย |
|-----|----------|
| A | รหัสวัสดุ |
| C | คำอธิบายประเภทแรงงาน |
| E | ราคา |

---

## Settings

| Cell | ใช้เมื่อ |
|------|----------|
| B1 | รหัสผ่านลบโครงการ legacy (verify-password) |

---

## การ migrate จาก schema เก่า

โครงการเก่าที่มีแค่ `SharedWith` (col H เดียว) — ระบบใหม่ใช้ SharedView / SharedEdit / IsPublic แยกคอลัมน์

แนะนำ:
1. เพิ่ม header คอลัมน์ I, J ถ้ายังไม่มี
2. ย้ายค่า SharedWith เก่า → SharedView
3. แชร์ใหม่ผ่าน UI เพื่อ normalize
