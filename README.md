# PEA Estimation AI Pro 2026

> ระบบประมาณการพัสดุและค่าแรงไฟฟ้า กฟภ. — **"รู้ราคาใน 15 วินาที"**

แอปเว็บ mobile-first สำหรับประมาณการงานไฟฟ้า กฟภ. ด้วย AI, ปุ่มทางลัดพัสดุยอดนิยม และโหมดสำรวจหน้างาน

## เริ่มต้นใช้งาน

```bash
# Deploy บน Vercel + ตั้งค่า
GAS_WEB_APP_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

ดูคู่มือ deploy → [docs/technical/DEPLOYMENT.md](docs/technical/DEPLOYMENT.md)

## โครงสร้างโปรเจกต์

```
Codex-Estimate Pro/
├── index.html          # UI
├── app.js              # Logic หลัก + ปุ่มทางลัด
├── survey.js           # โหมดสำรวจหน้างาน
├── services.js         # API client
├── config.js           # Configuration
├── styles.css
├── api/gas.js          # Vercel proxy
├── GAS.txt             # Backend source
└── docs/               # เอกสารทั้งหมด
    ├── README.md
    ├── project/
    ├── technical/
    ├── pitch/
    └── roadmap/
```

## เอกสาร

| เอกสาร | ลิงก์ |
|--------|------|
| เอกสารหลัก | [docs/README.md](docs/README.md) |
| สรุปโปรเจกต์ | [docs/project/SUMMARY.md](docs/project/SUMMARY.md) |
| สถาปัตยกรรม | [docs/technical/ARCHITECTURE.md](docs/technical/ARCHITECTURE.md) |
| Deploy | [docs/technical/DEPLOYMENT.md](docs/technical/DEPLOYMENT.md) |
| Pitching | [docs/pitch/INNOVATION_PITCH.md](docs/pitch/INNOVATION_PITCH.md) |
| Roadmap | [docs/roadmap/ROADMAP.md](docs/roadmap/ROADMAP.md) |

---

Developed by **PEA Nakhon Phanom** — Customer Service and Relations Section  
(นายศุภกฤษ ทะวัง ชผ.บส.กฟจ.นพ.) · **PEA Inno MOVE** 2026
