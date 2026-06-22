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

ทำเสร็จแล้ว (ล่าสุด ~2026-06-13, ดู git log บน main):

Core / Auth / Share:
- Login + RBAC (Config sheet)
- แชร์ view/edit + Public + Audit log + Admin tab
- Timeline history (2-row cards, sort/filter)
- Fix share preConfirm → บันทึก user ถูกต้อง (re-share โครงการเก่าที่ว่าง)

BOQ / AI Scan:
- Quick pick + SET MV/TR/LV
- AI Scan Review Queue: ค้นหา master ด้วยมือเมื่อ AI ไม่มีรหัส, ปุ่ม「ข้ามรายการ」ต่อแถว

สำรวจหน้างาน (survey.js + survey-project.js):
- MV/LV/TR, OSRM, KML export (#surveyExportKmlBtn)
- กล่องสรุปสถิติเสา (มุมขวาบน) บนแผนที่ live + ใน PNG capture — โครงการเก่าต้องสำรวจเสร็จใหม่
- KML export: ปุ่ม「📍 ส่งออก KML」ใต้แผนที่ + มุมแผง spec (หลังกด「สำรวจเสร็จ」เท่านั้น)
- Bulk apply สเปกเสา (4 กลุ่ม): ทางตรง / เข้าโค้ง / ออกโค้ง / ภายในโค้ง — ดู docs/technical/SURVEY.md
- surveyMeta.setUsage → ประวัติ: คอลัมน์「ชุด SET」+ จัดกลุ่มรายการ + ตารางสรุป (ดู/แก้/PDF/Excel)

ถามราคา (Price Ask):
- Local NLU + Gemini fallback (label「AI Answer」)
- Glossary, confidence, feedback loop
- หม้อแปลง / manhole / เทโคน / pole-only queries
- LV ไม่ auto-default เป็น 3P → popup ถาม 1P/3P เมื่อไม่ระบุเฟส
- UI แบบ chat thread (priceAskThread) — clarification ยังใช้ Swal popup
- Export Excel/PDF, master cache 8 นาที
- Tests: node scripts/run-price-quote-tests.js → 169 passed

Theme / UI:
- Dark / Light / Auto theme (Phase 3 token migration เสร็จ)
- แผนที่สำรวจใช้ tile โหมด light เสมอ (อ่านง่าย)
- Dropdown/select contrast ปรับแล้ว

ยังไม่ทำ / งานถัดไปที่น่าทำ:
- Price Ask แบบ multi-turn chat ใน input box (ChatGPT-style) ~2–3 วัน
- Session token แทน username ใน payload
- Hash password ใน Config sheet
- Duplicate / Template โครงการ
- PWA / Offline, LINE OA webhook

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
