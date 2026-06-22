# บันทึกการเปลี่ยนแปลงสำคัญ (Manual)

> Git history มี commit ละเอียด — ไฟล์นี้สรุป **เหตุการณ์และผลกระทบ** ที่ทีมควรรู้

---

## 2026-06-13 (ต่อ 3) — Hotfix login (Critical)

### app.js syntax error ทำให้ login ไม่ได้

- **อาการ:** กรอก username/password ถูก แต่เข้าระบบไม่ได้ / ปุ่ม login ไม่ทำงาน
- **สาเหตุ:** `render()` ใน `app.js` ปิด template literal ไม่ครบ (`Missing } in template expression`) จาก commit SET grouping
- **Commit แก้:** `89cef61`
- **บทเรียน:** รัน `node --check app.js` ก่อน push ทุกครั้ง

### SET grouping + map overlay + KML visibility

- **Commit:** `bc7516a`
- DOM `#surveyMapStatsOverlay`, จัดกลุ่ม BOQ ตาม SET (ดู/แก้/PDF/Excel), ปุ่ม KML ใน side panel

---

## 2026-06-13 (ต่อ 2) — แก้ visibility ฟีเจอร์สำรวจ + SET grouping

### แผนที่ capture — กล่องสรุปเสามุมขวาบน (มองเห็นชัด)

- **แก้:** DOM overlay บนแผนที่ (`#surveyMapStatsOverlay`) + วาดซ้ำลง PNG ตอน capture; จับภาพจาก `.survey-map-shell`
- **แสดง:** เสาทางตรง / เข้า-ออกโค้ง / ในโค้ง / ต้นสุดท้าย / Guy
- **หมายเหตุ:** โครงการเก่าต้องสำรวจเสร็จใหม่เพื่อได้ภาพที่มีกล่องสรุป

### ตาราง BOQ — จัดกลุ่มตามชุด SET

- **เพิ่ม:** คอลัมน์「ชุด SET」+ แถวหัวกลุ่ม SET + เรียงรายการให้อยู่ติดกัน
- **ครอบคลุม:** ดู (ประวัติ), แก้ไข (chip SET + ตารางสรุป), Export Excel/PDF
- **lookup:** จาก `surveyMeta.setUsage` + reverse index จาก presets ทั้งหมด

### KML export — ปุ่มมองเห็นง่ายขึ้น

- **ที่อยู่:** ใต้แผนที่ + มุมแผง spec (`#surveyExportKmlSideBtn`)
- **Commit:** `bc7516a`

---

## 2026-06-13 (ต่อ) — Bulk apply แยกกลุ่มประเภทเสา

### สำรวจ — Bulk apply ครบ 4 กลุ่ม (ทางตรง / เข้าโค้ง / ออกโค้ง / ภายในโค้ง)

- **เดิม:** ถาม「เปลี่ยนทั้งหมด」ได้เฉพาะเสา auto ทางตรง
- **ใหม่:** แยก bulk ตามประเภท — `straight`, `curve_in`, `curve_out`, `curve_interior` (รวม Guy SET สำหรับเข้า/ออกโค้ง)
- **ฟังก์ชัน:** `getBulkApplyGroup()`, `applyFieldToBulkGroup()` ใน `survey.js`
- **GAS deploy ต้องทำ:** ไม่
- **Commit:** `be6b67a`

---

## 2026-06-13 — Sprint นำเสนอ (Presentation prep)

### AI Scan Review Queue — เลือก master ด้วยมือ

- **อาการ:** AI อ่าน BOM แล้วไม่มีรหัส → ติดค้าง ไม่สามารถดำเนินต่อ
- **แก้:** ช่องค้นหา master ต่อแถว + ปุ่ม「ข้ามรายการ」
- **Commit:** `9c5e895`
- **GAS deploy ต้องทำ:** ไม่

### สำรวจ — กล่องสถิติบนแผนที่ + SET summary ในประวัติ

- **ฟีเจอร์:** `computeSurveyPoleStats()` วาด overlay มุมขวาบนตอน capture; `setUsage` ใน surveyMeta → คอลัมน์「ชุด SET」+ ตารางสรุปใน detail
- **หมายเหตุ:** โครงการเก่าที่ save ก่อน fix อาจไม่มี `setUsage` (แสดง `—`)
- **Commit:** `9c5e895`

### สำรวจ — Bulk apply สเปกเสาทางตรง (รุ่นแรก)

- **ฟีเจอร์:** เปลี่ยนเสา/หัว/สาย/OHGW บนเสา auto ทางตรง → Swal ถาม「เปลี่ยนทั้งหมด」vs「เฉพาะต้นนี้」
- **Commit:** `9c5e895`
- **หมายเหตุ:** ขยายเป็น 4 กลุ่มใน commit ถัดไป — ดูหัวข้อ「Bulk apply แยกกลุ่มประเภทเสา」ด้านบน

### ถามราคา — LV phase clarification + chat thread

- **แก้:** LV query ไม่ auto-default 3P → ถาม 1P/3P ผ่าน popup
- **เพิ่ม:** UI แบบ chat bubble (`priceAskThread`); transformer/manhole/budget capacity
- **Tests:** 169 cases (`run-price-quote-tests.js`)
- **Commit:** `9c5e895`, `a691edd`, `394b797`, `e3cac94`

### Theme — Dark/Light/Auto + แผนที่ light เสมอ

- **Commit:** `394b797`, `a691edd`, `9c5e895`
- **หมายเหตุ:** แผนที่ survey ไม่ตาม dark theme — ออกแบบให้อ่านง่ายในหน้างาน

---

## 2026-06-21

### แก้การแชร์ไม่บันทึก user (Critical)

- **อาการ:** การ์ดแสดง `แชร์แล้ว 0/4`, Audit เป็น `sharedView:"", sharedEdit:""`
- **สาเหตุ:** ใช้ `isConfirmed` (boolean) แทน `shareDialog.value` จาก SweetAlert `preConfirm`
- **Commit:** `f9b3030`
- **Action ที่ต้องทำ:** Re-share โครงการที่แชร์ก่อนวันที่ fix

### แก้ Share modal spinner ค้าง

- **Commit:** `36bd5a6`
- Reset Swal loading state, CSS ซ่อน loader

### Timeline History UI

- **Commit:** `95291c9`
- 2-row cards, sort/filter, mobile ⋮ menu

---

## 2026-06 (ก่อนหน้า)

### Login + RBAC + Share system

- Config sheet: Username, Password, Role, AllowedSteps, Active, AI-ASK
- Project columns: CreatedBy, SharedView, SharedEdit, IsPublic
- Admin tab + Project_Audit

### GAS getRange bug

- **อาการ:** แชร์ error "data has 1 but range has 27"
- **แก้:** `getDbRowRange_` / `writeDbRowValues_` — ใช้ numRows=1 ไม่ใช่ endRow

### Quick picks + SET MV/TR/LV

- Dropdown หม้อแปลง/เสา/สาย + ชุด SET

---

## Template สำหรับบันทึกใหม่

```markdown
## YYYY-MM-DD

### หัวข้อ

- **อาการ:**
- **สาเหตุ:**
- **Commit:**
- **GAS deploy ต้องทำ:** ใช่/ไม่
- **Action user:**
```
