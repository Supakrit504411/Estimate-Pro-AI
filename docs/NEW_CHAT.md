# เริ่มแชทใหม่ — Copy ข้อความด้านล่างไปวาง

> เปิด Chat ใหม่ (`Ctrl+L` → New Chat) แล้ว paste ทั้งบล็อกนี้  
> หรือพิมพ์: `@docs/NEW_CHAT.md @skill.md อ่านแล้วช่วยทำงานต่อ`

---

## ข้อความสำหรับ Paste (เริ่มต้นที่บรรทัดถัดไป)

```
โปรเจกต์: PEA Estimation AI Pro 2026
Workspace: D:\9-WebApp2025\17-PEA Estimate\Codex-Estimate Pro
Production: https://pro-ai.vercel.app
GitHub (frontend): https://github.com/Supakrit504411/Estimate-Pro-AI

Local only (ห้าม push): GAS.txt, docs/, skill.md, README.md

Stack: Vanilla JS, Vercel, Google Apps Script, Gemini 2.5 Flash, Google Sheets, Google Drive

ไฟล์หลัก:
- app.js — AI, งบ, ประวัติ, save, viewDetail, historyRowCache
- survey.js — สำรวจ, MV/LV/1P/3P, SET BOM, Guy/Surge/Ground
- survey-presets.js — auto-generated (72 SET, configs, specialPoleRules)
- scripts/build-survey-presets.js + scripts/special-pole-data.js
- config.js, services.js, styles.css, index.html, api/gas.js
- GAS.txt — copy ไป Apps Script แล้ว Deploy version ใหม่ทุกครั้งที่แก้

Sheet Project_Database:
- A=ID, B=วันที่, C=ชื่อ, D=ยอดรวม
- E=ลิงก์ไฟล์ Drive (|) — AI scan, รูปหน้างาน, Survey_Map
- F=surveyMeta JSON — พิกัด, จำนวนหมุด, ระยะทาง, Span, voltageType, phaseType

Survey configs: mv1p, mv3p, lv1p, lv3p
- wireMultiplier: 2/3/2/4
- MV มี OHGW; LV ไม่มี
- หัวเสา = SET id → BOM expand items

เสาพิเศษ (specialPoleRules):
- end: Guy (เลือก), DE head, OHGW 25256 (MV), คอนกรีต, Grounding 20509 + Surge MV / SET 14001|14003 LV
- curve_in/out: Guy, DDE head, OHGW 25258 (MV)
- LV: Surge SET ทุก 400m ตามเส้นทาง (addLvIntervalSurges)

GAS API: save-project, saved-projects, project-details, drive-file-previews

ทำเสร็จแล้ว (2026-06-19):
- MV/LV survey workflow + SET presets + OHGW (b89550c)
- GUY/SURGE/GROUND special poles + LV 400m surge (e7e3101)
- โหมดสำรวจ OSRM, Default, จับภาพ Survey_Map, UI มือถือ
- ประวัติ: ปุ่ม "ดู", รูปมือถือผ่าน GAS proxy
- docs/ + skill.md อัปเดต

กฎ:
- อ่าน skill.md และ docs/technical/SURVEY.md ก่อนแก้ survey
- แก้ preset → scripts/ แล้ว node scripts/build-survey-presets.js
- GAS แก้ใน GAS.txt local → user deploy เอง
- Frontend push GitHub → Vercel auto deploy
- อย่า commit/push docs/GAS ถ้าไม่ได้สั่ง (docs local only)

งานถัดไปที่ต้องการ: [ใส่งานของคุณที่นี่]
```

---

## วิธีเปิดแชทใหม่ใน Cursor

1. กด **`Ctrl + L`** เปิด Chat
2. กด **`+`** หรือ **New Chat** มุมบน panel แชท
3. Paste ข้อความด้านบน (หรือพิมพ์ `@docs/NEW_CHAT.md`)
4. แก้บรรทัด `งานถัดไปที่ต้องการ:` ให้ชัดเจน
5. ส่ง

---

## แชทเก่า (อ้างอิง)

แชทเดิม: **MV/LV Survey + GUY/SURGE/GROUND** — ดูใน Chat History ได้
