# คู่มือ Deploy — PEA Estimation AI Pro 2026

---

## ภาพรวม

```
GitHub → Vercel (Frontend + Proxy) → GAS Web App (Backend)
```

**ลำดับที่ถูกต้อง:** Deploy GAS ก่อน → ได้ URL → ตั้งค่า Vercel → Push GitHub

---

## 1. Deploy Google Apps Script

1. เปิด https://script.google.com → โปรเจกต์เดิม (หรือสร้างใหม่)
2. คัดลอกโค้ดจาก **`GAS.txt`** (local) วางทับ editor
3. ตั้งค่า:
   ```javascript
   const GEMINI_API_KEY = "your-key";
   const SPREADSHEET_ID = "10hqvSXt-_XtEnIk619I3bIJhpOLx9YpOyyCugh0NXD8";
   const FOLDER_ID = "1_BjHxP6tXS6mRMbQgQwV3qOJzSTo8r8t";
   ```
4. **Deploy** → New deployment → Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
5. คัดลอก URL:
   ```
   https://script.google.com/macros/s/XXXX/exec
   ```
6. ทดสอบ:
   ```
   .../exec?action=health
   ```
   ต้องได้ `{"ok":true,...}`

### หลังอัปเดต GAS (สำคัญ)

ทุกครั้งที่แก้ `GAS.txt` ต้อง **Deploy → Manage deployments → Edit → New version → Deploy**

ฟีเจอร์ที่ต้อง deploy ล่าสุด:
- คอลัมน์ F (`surveyMeta`) ใน `saveProject` / `getSavedProjects`
- API `drive-file-previews` (แสดงรูปบนมือถือ)
- ใช้ชื่อไฟล์จาก `fileData.name` (เช่น `Survey_Map_*.png`)

---

## 2. Deploy Vercel (Frontend)

1. Push โค้ดขึ้น GitHub: https://github.com/Supakrit504411/Estimate-Pro-AI
2. Vercel → Import repo
3. Environment Variable:
   ```
   GAS_WEB_APP_URL = https://script.google.com/macros/s/XXXX/exec
   ```
4. Deploy → ได้ URL เช่น `https://pro-ai.vercel.app`

### ไฟล์ที่ขึ้น GitHub

```
index.html, app.js, survey.js, survey-presets.js, scripts/, services.js, config.js, styles.css, api/gas.js, .gitignore
```

> หลังแก้ `scripts/special-pole-data.js` หรือ `scripts/build-survey-presets.js`  
> รัน `node scripts/build-survey-presets.js` แล้ว commit `survey-presets.js` ด้วย

### ไฟล์ที่ไม่ขึ้น GitHub

```
GAS.txt, docs/, README.md, skill.md
```

---

## 3. อัปเดต Production

### Frontend
```powershell
git add app.js survey.js survey-presets.js scripts/ styles.css index.html config.js
git commit -m "feat: ..."
git push origin main
```
Vercel deploy อัตโนมัติ (~1–2 นาที)

### Backend
1. แก้ `GAS.txt` local
2. Copy → Apps Script Editor
3. Deploy version ใหม่

---

## 4. Checklist หลัง Deploy

- [ ] `?action=health` ตอบ OK
- [ ] แท็บสร้างงาน → AI Scan ทำงาน
- [ ] สำรวจหน้างาน → แผนที่แสดง (มือถือ + PC)
- [ ] สำรวจหน้างาน → เลือก MV/LV + 1P/3P ได้
- [ ] สำรวจเสร็จ → มี Survey_Map ในไฟล์แนบ
- [ ] สำรวจเสร็จ → เสา end/curve มี Guy + spec พิเศษ
- [ ] สร้างรายการประมาณการ → SET expand + LV surge 400m (ถ้า LV)
- [ ] บันทึกโครงการ → คอลัมน์ E, F ใน Sheet
- [ ] ประวัติ → ดู → แสดงรูป (มือถือด้วย)
- [ ] Hard refresh (`Ctrl+Shift+R`) ถ้า cache เก่า

---

## 5. Troubleshooting

| อาการ | สาเหตุที่เป็นไปได้ | แก้ |
|-------|-------------------|-----|
| แผนที่ไม่แสดง | CSS layout / Leaflet size | อัปเดต `styles.css` + `survey.js` |
| ปุ่ม "ดู" ไม่ทำงาน | JSON คอลัมน์ F ใน onclick | ใช้ `historyRowCache` (app.js) |
| รูปไม่ขึ้นมือถือ | Drive block iframe/thumbnail | Deploy GAS `drive-file-previews` |
| surveyMeta ว่าง | GAS ยังไม่ deploy คอลัมน์ F | Deploy GAS ใหม่ |
| AI ไม่ทำงาน | GEMINI_API_KEY ผิด/quota | ตรวจ GAS + Google AI Studio |
