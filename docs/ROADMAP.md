# Roadmap & ข้อเสนอแนะพัฒนา

เอกสารนี้สรุปทิศทางพัฒนาเพื่อให้ **PEA Estimation AI Pro** สมบูรณ์และน่าสนใจมากขึ้น  
จัดลำดับตาม **ผลกระทบ × ความยาก** — อัปเดตล่าสุด: 2026-06-13

---

## สถานะปัจจุบัน (สรุป)

| ด้าน | ระดับ | หมายเหตุ |
|------|-------|----------|
| BOQ + งบหลายประเภท | ✅ ดี | Quick pick, SET MV/TR/LV |
| สำรวจหน้างาน | ✅ ดี | Map, TR, OSRM, KML, stats overlay, bulk pole (4 กลุ่ม), SET summary |
| ถามราคา | ✅ ดี | NLU + Gemini, glossary, chat thread, LV phase clarify, export |
| AI Scan | ✅ ดี | Review queue + manual master search + skip row |
| Theme | ✅ พื้นฐาน | Dark/Light/Auto; แผนที่ survey light เสมอ |
| Login / RBAC | ✅ พอใช้ | Client + GAS ตรวจซ้ำ |
| แชร์โครงการ | ✅ แก้แล้ว | ต้อง re-share โครงการที่เคยบันทึกว่าง |
| Admin / Audit | ✅ พื้นฐาน | ตาราง raw |
| Tests | ⚠️ กลาง | 169 price-quote cases; ยังไม่มี survey/share tests |
| Docs | ✅ อัปเดต | โฟลเดอร์ `docs/` sync ใน git |
| LINE OA | ❌ ยังไม่เชื่อม UI | config มี endpoint |
| PWA / Offline | ❌ ไม่มี | |
| Price Ask multi-turn chat | 🔄 บางส่วน | มี chat bubble; clarification ยัง Swal popup |

---

## ✅ เสร็จแล้วล่าสุด (2026-06-13)

| รายการ | Commit | หมายเหตุ |
|--------|--------|----------|
| AI Scan queue — ค้นหา master / ข้ามแถว | `9c5e895` | เมื่อ AI ไม่มีรหัส |
| กล่องสถิติเสาบนแผนที่ capture | `9c5e895` | มุมขวาบน PNG |
| SET summary + คอลัมน์ในประวัติ | `9c5e895` | `surveyMeta.setUsage` |
| Bulk apply สเปกเสา (4 กลุ่ม) | `be6b67a` | ทางตรง / เข้าโค้ง / ออกโค้ง / ภายในโค้ง |
| Bulk apply สเปกเสาทางตรง (รุ่นแรก) | `9c5e895` | ขยายเป็น 4 กลุ่มแล้ว |
| LV phase clarification (Price Ask) | `9c5e895` | ไม่ auto 3P |
| Price Ask chat thread UI | `9c5e895` | clarification ยัง Swal |
| Transformer / manhole / budget capacity | `a691edd` | golden queries |
| Dark/Light/Auto theme | `394b797` | token migration Phase 3 |
| Price Ask NLU glossary + confidence | `e3cac94` | feedback loop |

---

## 🔴 Priority 1 — ควรทำก่อน (1–2 sprint)

### 1.1 Re-share โครงการที่ข้อมูลแชร์ว่าง

**ปัญหา:** โครงการที่แชร์ก่อน fix bug `preConfirm` ยังมี SharedView/Edit ว่างในชีต  
**แนะนำ:** แจ้ง user ให้กด「จัดการแชร์」อีกครั้ง หรือทำสคริปต์ GAS one-time migrate จาก Audit log

### 1.2 Session Token แทน username ใน payload

**ปัจจุบัน:** ส่ง `username` จาก client — spoof ได้ถ้ารู้ชื่อ user  
**แนะนำ:**
- GAS `login` ออก `sessionToken` (UUID + expiry ใน Sheet/Cache)
- ทุก request ส่ง token → GAS resolve username
- Logout / expire ชัดเจน

### 1.3 Hash รหัผ่านใน Config sheet

**ปัจจุบัน:** Password plain text ในชีต  
**แนะนำ:** bcrypt/SHA256 + salt ใน GAS หรือย้าย auth ไป Identity ที่ปลอดภัยกว่า

### 1.4 Admin Audit UI ที่อ่านง่าย

**แนะนำ:**
- แยก filter: share / delete / user
- แสดง detail JSON เป็น badge (view/edit/public)
- Export CSV audit

### 1.5 ขยาย test coverage

**ปัจจุบัน:** 169 cases ใน `scripts/run-price-quote-tests.js`

**แนะนำเพิ่ม:**
- `parseHistoryShareFields`, `getShareCoverageStatus`
- `collectSharePickerValues` (mock DOM)
- `budget-formula.js` edge cases

---

## 🟠 Priority 2 — คุณค่าสูง (2–4 สปrint)

### 2.1 Duplicate / Template โครงการ

- **Duplicate:** คัดลอก BOQ + survey meta เป็นโครงการใหม่
- **Template:** บันทึกโครงการเป็น template สำหรับงานประเภทซ้ำ (เช่น ขยายเขต MV มาตรฐาน)

### 2.2 รายงาน PDF โครงการแบบสมบูรณ์

**ปัจจุบัน:** Export PDF มีใน「ถามราคา」  
**แนะนำ:** PDF รวม — หน้าปก, BOQ แยกงบ, แผนที่สำรวจ (snapshot), สรุปยอด, ลายเซ็น

### 2.3 Survey ↔ BOQ Validation

- แจ้งเตือนเมื่อจำนวนเสา/สายใน map ไม่ match BOQ
- ปุ่ม「ซิงค์จากสำรวจ」อัปเดต BOQ อัตโนมัติ

### 2.4 แจ้งเตือนเมื่อถูกแชร์

- Email (GAS MailApp) หรือ LINE Notify เมื่อมีคนแชร์โครงการให้
- Optional: daily digest โครงการค้าง

### 2.5 PWA + Offline master data

- `manifest.json` + service worker cache shell
- Master data ใช้ offline ได้เมื่อเคยโหลดแล้ว (สำรวจหน้างานไม่มีสัญญาณ)

### 2.6 Mobile polish

- เพิ่ม Admin ใน bottom nav (สำหรับ admin)
- ลบ `user-scalable=no` เพื่อ accessibility
- Gesture ปิด history menu ⋮ เมื่อ tap นอก

### 2.7 LINE Official Account

**มี endpoint แล้ว:** `line-intake`, `line-search`  
**ต้องทำ:**
- `api/line-webhook.js` บน Vercel
- UI ค้นหาโครงการ / ส่ง BOQ สรุปผ่าน LINE
- ใช้ case: ส่งรูปหน้างาน → สร้าง draft project

### 2.8 Price Ask — Multi-turn conversational UI

**ปัจจุบัน:** chat bubble แสดงประวัติ; clarification (1P/3P ฯลฯ) ยัง popup Swal  
**แนะนำ:** input แบบ ChatGPT — ถาม-ตอบต่อเนื่องในกล่องเดียว (~2–3 วัน dev)

---

## 🟡 Priority 3 — น่าสนใจ / ระยะยาว

### 3.1 Dashboard Analytics (Admin)

- กราฟยอดรวมตามเดือน / ผู้ใช้ / ประเภทงบ
- Top materials / โครงการใหญ่สุด

### 3.2 Version history โครงการ

- เก็บ snapshot BOQ ทุกครั้งที่ save
- เปรียบเทียบ diff ระหว่าง version

### 3.3 Approval workflow

- สถานะ: ร่าง → ส่งตรวจ → อนุมัติ
- ผูกกับ role ใน Config

### 3.4 Multi-site / สาขา

- ฟิลด์ `SiteCode` / `Area` ในโครงการ
- Filter history ตามสาขา

### 3.5 Integration อื่น

- Import จาก Excel template PEA มาตรฐาน
- Export SAP / ERP format (ถ้ามี spec)

### 3.6 AI เพิ่มเติม

- สรุป BOQ เป็นภาษาธรรมชาติ
- ตรวจสอบรายการผิดปกติ (ราคาผิดช่วง, qty สูงผิดปกติ)
- แนะนำวัสดุทดแทน

---

## 🛠 Technical Debt

| รายการ | แนะนำ |
|--------|--------|
| ไม่มี `package.json` | เพิ่ม npm scripts: test, lint, build-presets |
| `app.js` ~2.8k บรรทัด | แยก modules: history, share, admin, price |
| `survey.js` ~3k บรรทัด | แยก map / dialog / export |
| CORS `*` บน proxy | จำกัด origin เป็น domain Vercel |
| ไม่มี CSP header | เพิ่มใน vercel.json |
| GAS manual deploy | CI reminder ใน PR template |

---

## 💡 Quick Wins (ทำได้ใน 1–2 ชม.)

- [ ] ปุ่ม「คัดลอกลิงก์โครงการ」ใน history (deep link อนาคต)
- [ ] แสดงเวลา relative ใน history (`2 ชม. ที่แล้ว`)
- [ ] Keyboard shortcut: `/` focus search history
- [ ] Empty state illustration สวยขึ้น
- [ ] Toast แทน Swal สำหรับ success สั้นๆ
- [ ] `.env.example` + health check ใน README ✅

---

## ลำดับแนะนำสำหรับ Sprint ถัดไป

```
Sprint A (เสถียรภาพ)
  → Session token
  → Tests แชร์ + formula
  → Audit UI

Sprint B (UX)
  → Duplicate project
  → PDF รายงานเต็ม
  → Survey/BOQ validation

Sprint C (ขยาย)
  → LINE webhook
  → PWA
  → Dashboard admin
```

---

## การอัปเดตเอกสารนี้

เมื่อปิดงานแต่ละรายการ:
1. ย้ายจาก Priority → ✅ ใน CHANGELOG-NOTES.md
2. อัปเดต README ถ้ามีฟีเจอร์ใหม่
3. อัปเดต API.md ถ้ามี route ใหม่
