# GAS API Reference

Base URL: `{GAS_WEB_APP_URL}?action={route}`  
Frontend เรียกผ่าน: `/api/gas?action={route}` (POST body JSON)

ทุก POST (ยกเว้น login) ควรมี `username` จาก session

---

## Auth

### `login` (POST)

```json
{ "username": "SR", "password": "***" }
```

Response:

```json
{
  "ok": true,
  "user": {
    "username": "SR",
    "role": "admin",
    "allowedSteps": [1,2,3,4,5],
    "aiAsk": true
  }
}
```

---

## Projects

### `save-project` (POST)

บันทึก/อัปเดต BOQ + รูป scan

### `saved-projects` (POST)

```json
{ "username": "SR" }
```

Returns: `Array<[id, date, name, total, images, surveyMeta, createdBy, sharedView, sharedEdit, isPublic]>`

### `project-details` (POST)

```json
{ "projectId": "PJ-...", "username": "SR" }
```

### `delete-project` (POST)

```json
{ "projectId": "PJ-...", "username": "SR", "password": "..." }
```

---

## Sharing

### `share-project` (POST)

```json
{
  "username": "SR",
  "projectId": "PJ-1781974951232",
  "sharedView": "user0202,user0303",
  "sharedEdit": "user0404",
  "isPublic": false
}
```

Response:

```json
{
  "status": "success",
  "sharedView": "user0202,user0303",
  "sharedEdit": "user0404",
  "isPublic": "N"
}
```

### `share-users` (POST)

รายชื่อ user active สำหรับ picker (ไม่รวมตัวเอง)

---

## Admin

### `admin-dashboard` (POST)

```json
{ "username": "admin_user" }
```

Returns: `{ users, projects, audit }` — admin only

---

## Master & AI

| Route | Method | หมายเหตุ |
|-------|--------|----------|
| `master-data` | GET | ราคาวัสดุ + labor options |
| `process-image-ai` | POST | base64 รูป → รายการ BOM |
| `parse-price-query` | POST | `{ query, budgetType }` |
| `drive-file-previews` | POST | preview รูป Drive |

---

## Utility

### `health` (GET)

```json
{ "ok": true, "route": "health" }
```

### `verify-password` (POST)

ตรวจรหัสลบ legacy

---

## LINE (configured, UI ยังไม่เชื่อม)

| Route | สถานะ |
|-------|--------|
| `line-intake` | Backend ready |
| `line-search` | Backend ready |
| `/api/line-webhook` | **ยังไม่มีไฟล์ proxy** |

---

## Error patterns

```json
{ "status": "error", "msg": "ข้อความภาษาไทย" }
{ "error": true, "msg": "..." }
```

HTTP 502 จาก Vercel proxy = GAS URL ผิด / GAS timeout
