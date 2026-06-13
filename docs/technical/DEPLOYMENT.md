# คู่มือ Deploy — PEA Estimation AI Pro 2026

## สิ่งที่ต้องเตรียม

| รายการ | รายละเอียด |
|--------|------------|
| Google Account | บัญชี Google Workspace ของ กฟภ. |
| Google Sheet | Spreadsheet สำหรับ master data + project records |
| Google Drive Folder | โฟลเดอร์เก็บไฟล์สแกน BOM |
| Gemini API Key | จาก [Google AI Studio](https://aistudio.google.com/) |
| GitHub Account | สำหรับ version control |
| Vercel Account | สำหรับ hosting (ฟรี tier เพียงพอ) |

---

## ขั้นตอนที่ 1: เตรียม Google Sheets

### 1.1 สร้าง Spreadsheet

1. สร้าง Google Spreadsheet ใหม่
2. คัดลอก Spreadsheet ID จาก URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
   ```

### 1.2 สร้าง Sheets ตาม Schema

#### Sheet: `2026-1` (Master Materials)

| Row 1 (Header) | B: รหัสพัสดุ | C: ชื่อ | D: หน่วย | E: ราคาพัสดุ | F: ราคาแรง |
|----------------|-------------|---------|----------|-------------|-----------|
| Row 2+ | ข้อมูลพัสดุ | ... | ... | ... | ... |

#### Sheet: `ค่าแรง` (Labor Options)

| Row 1 (Header) | A: รหัสพัสดุ | B: (ว่าง) | C: รายละเอียดแรง | D: (ว่าง) | E: ราคา |
|----------------|-------------|----------|-----------------|----------|--------|

> หนึ่งรหัสพัสดุสามารถมีหลายแถว (หลายตัวเลือกค่าแรง)

#### Sheet: `Project_Database`

| A: Project ID | B: Date | C: Project Name | D: Grand Total | E: Image URLs |
|--------------|---------|-----------------|----------------|---------------|

#### Sheet: `Project_Details`

| A: Project ID | B: Budget Type | C: Material ID | D: Name | E: Qty | F: Total | G: Labor Desc | H: Labor Price |
|--------------|----------------|----------------|---------|--------|----------|---------------|----------------|

#### Sheet: `Settings`

| A1: Edit Password | B1: `your-password-here` |

---

## ขั้นตอนที่ 2: เตรียม Google Drive

1. สร้างโฟลเดอร์ใน Google Drive สำหรับเก็บไฟล์สแกน
2. คัดลอก Folder ID จาก URL:
   ```
   https://drive.google.com/drive/folders/FOLDER_ID
   ```
3. ตั้งค่า sharing: ผู้พัฒนา GAS ต้องมีสิทธิ์เขียน

---

## ขั้นตอนที่ 3: Deploy Google Apps Script

### 3.1 สร้างโปรเจกต์ GAS

1. เปิด [script.google.com](https://script.google.com)
2. สร้างโปรเจกต์ใหม่ → ตั้งชื่อ "PEA Estimation AI Backend"
3. ลบโค้ด default → คัดลอกเนื้อหาทั้งหมดจาก `GAS.txt`

### 3.2 ตั้งค่า Constants

**วิธีที่แนะนำ (Script Properties):**

```javascript
// แทนที่ constants ด้วย:
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const FOLDER_ID = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
```

ตั้งค่าใน: Project Settings → Script Properties

| Property | Value |
|----------|-------|
| `GEMINI_API_KEY` | API key จาก Google AI Studio |
| `SPREADSHEET_ID` | ID ของ Spreadsheet |
| `FOLDER_ID` | ID ของ Drive folder |

### 3.3 Deploy Web App

1. คลิก **Deploy** → **New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. คลิก **Deploy**
6. **คัดลอก Web App URL** — จะใช้เป็น `GAS_WEB_APP_URL`

### 3.4 ทดสอบ Backend

เปิด browser ไปที่:
```
https://script.google.com/macros/s/YOUR_ID/exec?action=health
```

ควรได้ response:
```json
{"ok":true,"route":"health","method":"GET","date":"..."}
```

---

## ขั้นตอนที่ 4: Deploy Frontend (Vercel)

### 4.1 Push โค้ดไป GitHub

```bash
git init
git add index.html styles.css app.js services.js config.js api/
git commit -m "Initial commit: PEA Estimation AI Pro 2026"
git remote add origin https://github.com/YOUR_ORG/pea-estimation-ai.git
git push -u origin main
```

### 4.2 เชื่อม Vercel

1. เปิด [vercel.com](https://vercel.com) → Import Git Repository
2. เลือก repo ที่ push ไว้
3. Framework Preset: **Other** (ไม่มี build step)
4. Root Directory: `/` (default)

### 4.3 ตั้งค่า Environment Variables

ใน Vercel Dashboard → Settings → Environment Variables:

| Name | Value | Environment |
|------|-------|-------------|
| `GAS_WEB_APP_URL` | `https://script.google.com/macros/s/XXXX/exec` | Production, Preview, Development |

### 4.4 Deploy

คลิก **Deploy** → รอ build เสร็จ → ได้ URL เช่น `https://pea-estimation-ai.vercel.app`

### 4.5 ทดสอบ Frontend

1. เปิด URL ที่ได้
2. ตรวจสอบว่า master data โหลดได้ (Tab สร้างงานใหม่)
3. ทดสอบ AI scan ด้วยรูป BOM
4. ทดสอบบันทึกโครงการ
5. ตรวจสอบ Tab ประวัติ

---

## ขั้นตอนที่ 5: ตรวจสอบหลัง Deploy

### Checklist

- [ ] Health check API ตอบกลับ `ok: true`
- [ ] Master data โหลดได้ (พัสดุแสดงใน autocomplete)
- [ ] AI scan อ่าน BOM ได้ (ทดสอบด้วยรูปจริง)
- [ ] AI Review Queue แสดงผลถูกต้อง
- [ ] คำนวณงบ 4 ประเภทถูกต้อง
- [ ] บันทึกโครงการ → ข้อมูลปรากฏใน Sheets
- [ ] ไฟล์สแกนอัปโหลดไป Drive
- [ ] ประวัติโครงการแสดงผล
- [ ] แก้ไข/ลบด้วย password ทำงาน
- [ ] Export Excel ดาวน์โหลดได้
- [ ] UI responsive บนมือถือ

---

## การอัปเดตโค้ด

### อัปเดต Frontend

```bash
git add .
git commit -m "Update: description"
git push
# Vercel auto-deploy
```

### อัปเดต Backend (GAS)

1. แก้โค้ดใน GAS Editor
2. Deploy → **Manage deployments** → Edit → **New version**
3. ไม่ต้องเปลี่ยน `GAS_WEB_APP_URL` (URL เดิม)

---

## Troubleshooting

| ปัญหา | สาเหตุที่เป็นไปได้ | วิธีแก้ |
|-------|-------------------|---------|
| Master data ว่าง | SPREADSHEET_ID ผิด หรือ sheet name ไม่ตรง | ตรวจ sheet name `2026-1` |
| AI scan error | Gemini API key หมดอายุ/quota | ตรวจ API key + quota |
| บันทึกไม่ได้ | GAS ไม่มีสิทธิ์เขียน Sheet/Drive | ตรวจ permission + re-authorize |
| CORS error | ใส่ GAS URL ตรงใน config.js | ใช้ `/api/gas` proxy เท่านั้น |
| 502 Bad Gateway | GAS_WEB_APP_URL ผิด | ตรวจ env variable ใน Vercel |
| ภาษาไทยเพี้ยน | Encoding ไม่ถูกต้อง | ตรวจ UTF-8 ในทุกไฟล์ |
| Password ไม่ผ่าน | Settings sheet ไม่มี หรือ B1 ว่าง | ตรวจ sheet `Settings` cell B1 |

---

## โครงสร้างไฟล์ที่ Vercel ต้องมี

```
repo-root/
├── index.html
├── styles.css
├── app.js
├── services.js
├── config.js
└── api/
    └── gas.js
```

> ไฟล์ `.md` และ `GAS.txt` ไม่จำเป็นต้อง deploy แต่แนะนำเก็บใน repo
