# บันทึกการเปลี่ยนแปลงสำคัญ (Manual)

> Git history มี commit ละเอียด — ไฟล์นี้สรุป **เหตุการณ์และผลกระทบ** ที่ทีมควรรู้

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
