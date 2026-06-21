# คู่มือ Deploy — Vercel + Google Apps Script

## สิ่งที่ต้องมี

- บัญชี GitHub + Vercel (เชื่อม repo แล้ว)
- Google Spreadsheet + Apps Script project
- ไฟล์ `GAS.txt` ในเครื่อง (ไม่ push git)

---

## 1. Google Apps Script

### ขั้นตอน

1. เปิด [Google Apps Script](https://script.google.com) → โปรเจกต์ที่ผูก Spreadsheet
2. **Copy เนื้อหาทั้งหมดจาก `GAS.txt`** วางแทน Code.gs
3. ตั้งค่าในไฟล์:
   - `SPREADSHEET_ID`
   - `FOLDER_ID` (Drive สำหรับรูป scan)
   - `GEMINI_API_KEY` / `GEMINI_API_KEY_LITE`
4. **Deploy → New deployment → Web app**
   - Execute as: Me
   - Who has access: Anyone (หรือ Anyone with Google account ตามนโยบาย)
5. Copy **Web app URL** → ใช้เป็น `GAS_WEB_APP_URL`

### Deploy ใหม่เมื่อไหร่

ทุกครั้งที่แก้ `GAS.txt` แล้วต้องการให้ production ใช้โค้ดใหม่:

1. วางโค้ดใน Editor
2. **Deploy → Manage deployments → Edit → New version → Deploy**

### ชีตที่ระบบสร้าง/ใช้อัตโนมัติ

| Sheet | หน้าที่ |
|-------|---------|
| Config | Users, RBAC |
| 2026-1 | Master ราคาวัสดุ |
| ค่าแรง | Labor options |
| Project_Database | สรุปโครงการ |
| Project_Details | รายการ BOQ |
| Project_Audit | บันทึก share/delete |
| Settings | รหัสลบ legacy (B1) |

---

## 2. Vercel

### Environment Variables

| Key | ค่า |
|-----|-----|
| `GAS_WEB_APP_URL` | URL จาก GAS Web app deploy |

ตั้งที่: Vercel Project → Settings → Environment Variables

### Deploy

- Push ขึ้น `main` → Vercel auto-deploy
- Frontend static + `api/gas.js` serverless

### Local test (optional)

```bash
# ติดตั้ง Vercel CLI
npm i -g vercel
vercel dev
```

สร้าง `.env.local` จาก `.env.example`

---

## 3. Checklist หลัง Deploy

- [ ] เปิด `/api/gas?action=health` → `{ ok: true }`
- [ ] Login ด้วย user ในชีต Config
- [ ] บันทึกโครงการทดสอบ → ปรากฏใน History
- [ ] แชร์ให้ user อื่น → การ์ดแสดง `แชร์แล้ว N/M` + Audit log มี username
- [ ] AI Scan (ถ้า AI-ASK = Y)
- [ ] สำรวจหน้างาน + export KML

---

## 4. Rollback

| ชั้น | วิธี |
|------|------|
| Frontend | Vercel → Deployments → Promote ก่อนหน้า |
| GAS | Manage deployments → เลือก version เก่า |

---

## 5. ข้อควรระวัง

- **อย่า commit** `GAS.txt` หรือ `.env` ที่มี key จริง
- GAS URL เปลี่ยนทุกครั้งที่สร้าง deployment ใหม่ (ไม่ใช่ new version) — อัปเดต Vercel env ด้วย
- Quota Gemini / GAS execution — ตรวจ [Google Cloud Console](https://console.cloud.google.com)
