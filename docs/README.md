# เอกสารโปรเจกต์ — Index

> อัปเดต: 2026-06-13 · Git: `89cef61`

## สำหรับ Cursor Agent (อ่านก่อนลงมือ)

1. **`NEW_CHAT.md`** — paste เริ่มแชท + สรุปงานที่ทำแล้ว
2. **`technical/SURVEY.md`** — ก่อนแก้ survey.js / survey-project.js
3. **`CHANGELOG-NOTES.md`** — bug สำคัญ + commit อ้างอิง
4. **`ROADMAP.md`** — สถานะ + งานถัดไป

**ก่อน push:** `node --check app.js` · `node --check survey.js` · `node scripts/run-price-quote-tests.js`

**Local only (ไม่อยู่ใน git):** `skill.md` ที่ root workspace — skill สั้นสำหรับ agent; `GAS.txt`, `.env*`

---

## เริ่มต้น

| เอกสาร | เนื้อหา |
|--------|---------|
| [../README.md](../README.md) | Overview + quick start |
| [NEW_CHAT.md](NEW_CHAT.md) | **Prompt เริ่มแชท Cursor** — สรุปงานที่ทำแล้ว + งานถัดไป |
| [CHANGELOG-NOTES.md](CHANGELOG-NOTES.md) | เหตุการณ์สำคัญ / bug ที่แก้แล้ว (อัปเดต 2026-06-13) |

## Technical

| เนทาง | ไฟล์ |
|-------|------|
| สั้น (root) | [ARCHITECTURE.md](ARCHITECTURE.md), [DEPLOYMENT.md](DEPLOYMENT.md), [API.md](API.md), [CONFIG-SHEET.md](CONFIG-SHEET.md) |
| ละเอียด | [technical/ARCHITECTURE.md](technical/ARCHITECTURE.md), [technical/DEPLOYMENT.md](technical/DEPLOYMENT.md), [technical/SURVEY.md](technical/SURVEY.md) |

## Roadmap & Pitch

| ไฟล์ | หมายเหตุ |
|------|----------|
| [ROADMAP.md](ROADMAP.md) | **แนะนำอ่าน** — สถานะ + ข้อเสนอพัฒนา (2026-06-13) |
| [roadmap/ROADMAP.md](roadmap/ROADMAP.md) | Phase 1–4 แบบ survey-focused |
| [pitch/INNOVATION_PITCH.md](pitch/INNOVATION_PITCH.md) | Pitch / innovation |
| [project/SUMMARY.md](project/SUMMARY.md) | สรุปโปรเจกต์ |
| [archive/skill.md](archive/skill.md) | Redirect — อย่าใช้ archive เก่า |

## ไฟล์ local (นอก git)

| ไฟล์ | หมายเหตุ |
|------|----------|
| `../skill.md` | **Agent skill ฉบับสั้น** — อัปเดตคู่กับ docs |
| `../GAS.txt` | Backend source + deploy manual |
| `../.env*` | Vercel secrets |

## ไฟล์ config

| ไฟล์ | หมายเหตุ |
|------|----------|
| `../.env.example` | Template Vercel env |
| `technical/env.example` | สำเนา/อ้างอิง |
| `../vercel.json` | Routing + headers |
| `../GAS.txt` | **Local only** — backend |

## Checklist ก่อน Deploy

1. `node --check app.js` และ `node --check survey.js`
2. `node scripts/run-price-quote-tests.js` (169 tests)
3. Frontend → push GitHub → Vercel
4. GAS.txt → Apps Script → **New version** deploy
5. ทดสอบตาม [DEPLOYMENT.md](DEPLOYMENT.md)
