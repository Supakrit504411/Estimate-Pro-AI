# เอกสารโปรเจกต์ — Index

| เอกสาร | อ่านเมื่อ |
|--------|-----------|
| [../README.md](../README.md) | เริ่มต้น / overview |
| [ARCHITECTURE.md](ARCHITECTURE.md) | เข้าใจโครงสร้างระบบ |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deploy Vercel + GAS |
| [CONFIG-SHEET.md](CONFIG-SHEET.md) | ตั้งค่า Google Sheets |
| [API.md](API.md) | GAS endpoints |
| [ROADMAP.md](ROADMAP.md) | แผนพัฒนา / ข้อเสนอแนะ |
| [CHANGELOG-NOTES.md](CHANGELOG-NOTES.md) | บันทึกเหตุการณ์สำคัญ |

## ไฟล์อื่นที่เกี่ยวข้อง

| ไฟล์ | หมายเหตุ |
|------|----------|
| `../.env.example` | Template env Vercel |
| `../vercel.json` | Routing + security headers |
| `../GAS.txt` | **Local only** — backend source |

## ก่อน Deploy ทุกครั้ง

1. แก้โค้ด frontend → push GitHub → Vercel auto
2. แก้ `GAS.txt` → copy ไป Apps Script → **New version** deploy
3. ทดสอบตาม checklist ใน [DEPLOYMENT.md](DEPLOYMENT.md)
