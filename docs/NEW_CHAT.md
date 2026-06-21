# เริ่มแชทใหม่ — Copy ข้อความด้านล่างไปวาง

> เปิด Chat ใหม่ (`Ctrl+L` → New Chat) แล้ว paste ทั้งบล็อกนี้  
> หรือพิมพ์: `@docs/NEW_CHAT.md อ่านแล้วช่วยทำงานต่อ`

---

## ข้อความสำหรับ Paste (เริ่มต้นที่บรรทัดถัดไป)

```
โปรเจกต์: PEA Estimation AI Pro 2026
Workspace: D:\9-WebApp2025\17-PEA Estimate\Codex-Estimate Pro
Production: https://estimate-pro-ai.vercel.app
GitHub: https://github.com/Supakrit504411/Estimate-Pro-AI

Local only (ห้าม push): GAS.txt, skill.md, .env*

Stack: Vanilla JS, Vercel, Google Apps Script, Gemini, Google Sheets, Drive, Leaflet, OSRM

ไฟล์หลัก:
- app.js — tabs, BOQ, history, share, admin, price ask, AI scan
- auth.js — login, RBAC, session
- survey.js — map survey, MV/LV/TR, KML, estimate → budget
- config.js, services.js, styles.css, index.html, api/gas.js
- GAS.txt — copy ไป Apps Script → Deploy version ใหม่ทุกครั้งที่แก้

เอกสาร (ใน git): README.md, docs/ — โดยเฉพาะ docs/ROADMAP.md, docs/DEPLOYMENT.md

Sheet Project_Database (10 cols):
- G=CreatedBy, H=SharedView, I=SharedEdit, J=IsPublic
- E=Drive URLs, F=surveyMeta JSON

GAS routes: login, save-project, saved-projects, share-project, share-users,
  admin-dashboard, master-data, process-image-ai, parse-price-query, drive-file-previews

ทำเสร็จแล้ว (ล่าสุด ~2026-06-21):
- Login + RBAC (Config sheet)
- แชร์ view/edit + Public + Audit log + Admin tab
- Timeline history (2-row cards, sort/filter)
- Fix share preConfirm → บันทึก user ถูกต้อง (re-share โครงการเก่าที่ว่าง)
- ถามราคา export Excel/PDF, master cache 8 นาที
- Quick pick + SET MV/TR/LV

กฎ:
- อ่าน docs/technical/SURVEY.md ก่อนแก้ survey
- preset → node scripts/build-survey-presets.js
- GAS แก้ใน GAS.txt local → user deploy เอง
- Frontend push GitHub → Vercel auto deploy
- commit docs ได้; อย่า commit GAS.txt / .env

งานถัดไปที่ต้องการ: [ใส่งานของคุณที่นี่]
```

---

## วิธีเปิดแชทใหม่ใน Cursor

1. **`Ctrl + L`** → Chat
2. **New Chat**
3. Paste ข้อความด้านบน หรือ `@docs/NEW_CHAT.md`
4. แก้ `งานถัดไปที่ต้องการ:`
5. ส่ง
