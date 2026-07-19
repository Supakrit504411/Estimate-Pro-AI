# CLAUDE.md — คู่มือสำหรับ AI/นักพัฒนาที่มาแก้โค้ดต่อ

ภาพรวมโปรเจกต์อ่านที่ [README.md](README.md) — ไฟล์นี้เก็บกติกาและกับดักที่เรียนรู้มาแล้วด้วยเลือดเนื้อ

## กติกาหลัก

1. **ไฟล์ระดับ root คือตัวจริง** — `Codex-Estimate Pro/` เป็น backup (gitignore) ห้ามแก้
2. **หลังแก้ app.js/survey.js ทุกครั้ง**: `node --check <file>` + `node scripts/run-price-quote-tests.js` ต้องได้ 169 passed
3. **แก้ JS/CSS แล้วต้อง bump `?v=`** ใน index.html (script ทุกตัว + styles.css) — ผู้ใช้เคยได้ไฟล์เก่าจาก cache จนคิดว่าบั๊กไม่ถูกแก้มาแล้ว
4. **styles.css: เพิ่ม rule ใหม่ต่อท้ายไฟล์เท่านั้น** ห้าม reorder ของเดิม — cascade ของไฟล์นี้พึ่งลำดับ มี override เป็นชั้นๆ ท้ายไฟล์ (Bank-style redesign เป็นชั้นล่าสุด)
5. commit message ภาษาอังกฤษ conventional (`fix(survey): ...`), push ขึ้น `main` → Vercel auto-deploy
6. `.gitignore` บล็อค `*.png` — asset ที่ตั้งใจ commit ต้องอยู่ `assets/` (มีข้อยกเว้น `!assets/*.png` แล้ว)

## ภาษาดีไซน์ (Bank-style — ผู้ใช้เกลียด "AI slop")

- **สีม่วง PEA `#74045f` ทึบสีเดียว** — ห้าม gradient ตกแต่ง, ห้ามทอง/cyan/ชมพูเพิ่ม (เขียว/แดง/เหลือง = สถานะเท่านั้น)
- ฟอนต์ Sarabun ทุกที่ (Orbitron ถูกถอดแล้ว), โลโก้ = ข้อความ + badge "AI" ม่วงเล็ก
- การ์ด: ขาว ไร้ขอบ เงานุ่ม radius 14px / ปุ่ม radius 10px / pill 999px — สามขนาดนี้เท่านั้น
- ไอคอน: SVG sprite ใน index.html (`<svg class="icon icon-sm"><use href="#icon-xxx"/></svg>`) — **ห้าม emoji ใน UI**
- ข้อความ UI เป็นภาษาไทย (หัวข้ออังกฤษถูกแปลหมดแล้ว)
- Light theme: พื้น `#f4f4f6` การ์ดขาว / Dark: charcoal `#131217` — token อยู่หัว styles.css

## กับดักที่เจอมาแล้ว (อย่าทำซ้ำ)

### แผนที่ / Leaflet
- **ห้ามใช้ html2canvas กับแผนที่** — มันจัดการ transform ของ Leaflet pane เพี้ยน (ต่างกันตาม DPR/อุปกรณ์) ภาพ capture ใช้ `drawMapCaptureCanvas()` ใน survey.js: วาด tiles จาก `getBoundingClientRect` + เส้น/หมุดจาก `latLngToContainerPoint` — พิกัดหน้าจอชุดเดียวกัน ตรงกันเสมอ (tiles OSM/Carto รองรับ CORS ผ่าน `fetch` + `createImageBitmap`)
- **Polyline บนแผนที่ต้องส่ง `renderer: getLineRenderer()`** (L.canvas) — SVG renderer คือต้นเหตุภาพ capture เพี้ยนในอดีต
- **Leaflet cache ขนาด container ตอน init** — มี ResizeObserver เรียก `invalidateSize()` ใน `initMap` แล้ว ห้ามถอด ไม่งั้นปักหมุดไม่ตรงกากบาทเมื่อ layout ขยับ
- เส้นวัดระยะ (aim line) เป็น SVG พิกัดหน้าจอวาดเองใน `drawAimLineScreen` (ไม่ใช่ Leaflet layer) และต้องถูกซ่อนตอน capture
- กากบาท/ป้ายระยะถูกตรึงที่กึ่งกลาง `#surveyMap` ด้วย JS ใน `updateAimOverlay`
- `interpolateAlongPath`: วางเสาทุก span เต็ม เว้นเฉพาะตกใกล้ปลาย <1 ม. (เคยใช้ 30% ของ span แล้วผู้ใช้ทัก 48 ม. @ span 40 ได้เสาเดียว)

### SweetAlert2
- Swal ถูก mixin class `pea-swal-*` ไว้ใน index.html — dialog เลือกจากตัวเลือกน้อยใช้ `window.AppCore.pickFromChoiceButtons({title, text, options, selectedValue})` (ปุ่มกด ไม่ใช่ dropdown)
- **ใน handler ปุ่มของ Swal: `resolve(value)` ก่อน `Swal.close()` เสมอ** — close() ยิง willClose/dismiss แบบ synchronous เคยตัดหน้าจน dialog ทุกตัวกลายเป็น "ยกเลิก"
- toast ถูกบังคับให้กะทัดรัดด้วย CSS `.pea-swal-popup.swal2-toast`

### อื่นๆ
- ผู้ใช้ LINE มี username เป็น LINE userId — แสดงชื่อผ่าน `formatShareUserName()` ใน app.js (ใช้ displayName ถ้ามี ไม่งั้นย่อ `ผู้ใช้ LINE (…xxxxxx)`) การแก้ถาวรต้องให้ GAS เก็บ display name ลงชีต Config ตอน login
- ตารางใน Swal บนจอแคบ: ใช้ `.staging-table-wrap` overflow-x + min-width ห้ามปล่อยให้บีบ
- ปุ่มกลุ่ม "เพิ่มส่วน / TR" ใน toolbar ยุบอัตโนมัติหลังเลือก (`window.__surveySetSegTools`)
- รัน local ต่อ GAS ไม่ได้ — ฟีเจอร์ master data/Drive/แชร์ ต้องทดสอบบน Vercel จริง
- dev server: `.claude/launch.json` ชื่อ `pea-estimate` (npx http-server -p 8080)

## การทดสอบใน browser (Claude Code)

- login จำลอง: `sessionStorage.setItem("pea_auth_session_v1", JSON.stringify({ user: { username: "Dev Tester", role: "ADMIN", tabs: "all" }, savedAt: Date.now() }))` แล้ว reload
- เข้าสำรวจเร็ว: แท็บสำรวจ → `#surveyAddMvBtn` → `.swal-choice-btn` แรก → `.span-seg-btn` "40" → ปุ่มเริ่มสำรวจ → กรอกชื่อ → confirm
- ภาพ capture ดูได้จาก `window.AppCore.getProjectFileList()` หลังกด "สำรวจเสร็จ"
- ธีม: `localStorage.setItem("pea_theme_v1", "light"|"dark")`
