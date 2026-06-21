# เอกสารโปรเจกต์ — Index

## เริ่มต้น

| เอกสาร | เนื้อหา |
|--------|---------|
| [../README.md](../README.md) | Overview + quick start |
| [NEW_CHAT.md](NEW_CHAT.md) | Prompt เริ่มแชท Cursor ใหม่ |
| [CHANGELOG-NOTES.md](CHANGELOG-NOTES.md) | เหตุการณ์สำคัญ / bug ที่แก้แล้ว |

## Technical

| เนทาง | ไฟล์ |
|-------|------|
| สั้น (root) | [ARCHITECTURE.md](ARCHITECTURE.md), [DEPLOYMENT.md](DEPLOYMENT.md), [API.md](API.md), [CONFIG-SHEET.md](CONFIG-SHEET.md) |
| ละเอียด | [technical/ARCHITECTURE.md](technical/ARCHITECTURE.md), [technical/DEPLOYMENT.md](technical/DEPLOYMENT.md), [technical/SURVEY.md](technical/SURVEY.md) |

## Roadmap & Pitch

| ไฟล์ | หมายเหตุ |
|------|----------|
| [ROADMAP.md](ROADMAP.md) | **แนะนำอ่าน** — ข้อเสนอพัฒนา 2026-06-21 |
| [roadmap/ROADMAP.md](roadmap/ROADMAP.md) | Phase 1–3 แบบเดิม (survey-focused) |
| [pitch/INNOVATION_PITCH.md](pitch/INNOVATION_PITCH.md) | Pitch / innovation |
| [project/SUMMARY.md](project/SUMMARY.md) | สรุปโปรเจกต์ |

## ไฟล์ config

| ไฟล์ | หมายเหตุ |
|------|----------|
| `../.env.example` | Template Vercel env |
| `technical/env.example` | สำเนา/อ้างอิง |
| `../vercel.json` | Routing + headers |
| `../GAS.txt` | **Local only** — backend |

## Checklist ก่อน Deploy

1. Frontend → push GitHub → Vercel
2. GAS.txt → Apps Script → **New version** deploy
3. ทดสอบตาม [DEPLOYMENT.md](DEPLOYMENT.md)
