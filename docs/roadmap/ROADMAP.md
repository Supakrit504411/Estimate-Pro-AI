# แผนพัฒนาต่อยอด — PEA Estimation AI Pro 2026

## สถานะปัจจุบัน (Phase 1 — Complete)

### สิ่งที่ทำเสร็จแล้ว

| หมวด | รายการ | สถานะ |
|------|--------|-------|
| **Core** | AI Scan BOM (รูป + PDF) | ✅ |
| **Core** | AI Review Queue + Human-in-the-Loop | ✅ |
| **Core** | คำนวณงบ 4 ประเภท (01.1, 02.1, 02.2, 03.1) | ✅ |
| **Core** | Smart Material ID Parser (or/slash/range) | ✅ |
| **Data** | บันทึก/แก้ไข/ลบโครงการ | ✅ |
| **Data** | ประวัติโครงการ + ค้นหา | ✅ |
| **Data** | Export Excel (.xlsx) | ✅ |
| **Data** | เก็บไฟล์สแกนใน Google Drive | ✅ |
| **UI** | Mobile-first responsive design | ✅ |
| **UI** | Dark glassmorphism AI theme | ✅ |
| **Infra** | Vercel hosting + GAS proxy | ✅ |
| **Infra** | GAS backend API (10 routes) | ✅ |
| **Future** | LINE intake/search API groundwork | ✅ |

### สิ่งที่ยังไม่สมบูรณ์

| หมวด | รายการ | Priority |
|------|--------|----------|
| Security | API Key hardcoded ใน GAS.txt | 🔴 Critical |
| Security | Password plain text ใน Sheet | 🔴 Critical |
| Security | CORS เปิดทุก origin | 🟡 Medium |
| Validation | ไม่มี save-time validation | 🟡 Medium |
| Testing | ไม่มี automated tests | 🟡 Medium |
| Features | Advanced history filters | 🟢 Low |
| Features | Dashboard/reporting | 🟢 Low |
| Features | LINE webhook จริง | 🟢 Planned |
| Docs | README + architecture docs | ✅ (สร้างแล้ว) |

---

## Phase 2: Stabilize & Secure (Q3 2026)

> **เป้าหมาย:** ทำให้ระบบพร้อม pilot test ในหน่วยงานจริง ปลอดภัยและเชื่อถือได้

### Phase 2 คืออะไร? (อธิบายง่ายๆ)

Phase 1 สร้างระบบให้ **ใช้งานได้** — Phase 2 ทำให้ระบบ **ใช้งานจริงในหน่วยงานได้อย่างปลอดภัย**

เปรียบเทียบกับการสร้างบ้าน:
- **Phase 1** = บ้านสร้างเสร็จ อยู่ได้ มีไฟฟ้า มีน้ำ
- **Phase 2** = ติดกลอนกุญแจ (Security) + ตรวจสอบโครงสร้าง (Validation) + ให้เพื่อนบ้านมาลองอยู่ 3 เดือน (Pilot)

| ส่วน | ทำอะไร | ทำไมต้องทำ |
|------|--------|-----------|
| **Security** | ล็อก API key, เข้ารหัส password, จำกัด CORS | ป้องกันข้อมูลรั่วก่อนเปิดให้คนอื่นใช้ |
| **Validation** | ตรวจข้อมูลก่อนบันทึก ทั้งฝั่งมือถือและ server | กันข้อมูลผิดพลาดเข้า database |
| **Pilot** | ทดลองใช้จริง 3 เดือน + เก็บ KPI | ได้ตัวเลขจริงไป pitch + รู้จุดที่ต้องปรับ |
| **Quick Shortcuts** | ปุ่มทางลัด หม้อแปลง/เสา/สายไฟ | ลดเวลาค้นหาพัสดุที่ใช้บ่อยหน้างาน |

### 2.1 Security Hardening (สัปดาห์ 1-2)

| งาน | รายละเอียด | Effort |
|-----|------------|--------|
| ย้าย API Key | Gemini key → GAS Script Properties | 2 ชม. |
| Hash Password | bcrypt/sha256 แทน plain text | 4 ชม. |
| จำกัด CORS | อนุญาตเฉพาะ Vercel domain | 1 ชม. |
| Input Validation | Server-side validation ก่อน save | 1 วัน |
| Rate Limiting | จำกัด AI scan calls ต่อ user | 4 ชม. |

### 2.2 Data Validation Layer (สัปดาห์ 3)

| งาน | รายละเอียด |
|-----|------------|
| Client validation | ตรวจชื่อโครงการ, qty > 0, budget มี items |
| Server validation | ตรวจ material ID มีใน master, qty เป็นตัวเลข |
| Duplicate check | แจ้งเตือนถ้ามีโครงการชื่อซ้ำ |
| Error messages | ข้อความ error ภาษาไทยที่เข้าใจง่าย |

### 2.3 UX Polish (สัปดาห์ 4)

| งาน | รายละเอียด |
|-----|------------|
| แก้ typo UI | งบ 02.2 แสดง "CUS 100%ิ" → "CUS 100%" |
| Loading states | Skeleton loading สำหรับ master data + history |
| Offline indicator | แจ้งเมื่อไม่มี internet |
| Keyboard shortcuts | Enter สำหรับ confirm, Esc สำหรับ cancel |
| AI confidence score | แสดง % ความมั่นใจของ AI ต่อรายการ |

### 2.4 History Enhancement (สัปดาห์ 5)

| งาน | รายละเอียด |
|-----|------------|
| Filter by date range | กรองตามช่วงวันที่ |
| Filter by budget type | กรองตามประเภทงบ |
| Sort options | เรียงตามวันที่/ยอดเงิน/ชื่อ |
| Pagination | แบ่งหน้าถ้าโครงการเยอะ |

### 2.5 ปุ่มทางลัดพัสดุยอดนิยม — Quick Category Shortcuts (สัปดาห์ 4-5) — Quick Category Shortcuts (สัปดาห์ 4-5)

> **Pain point:** เสา หม้อแปลง สายไฟ ใช้บ่อยมาก แต่ต้องพิมพ์ค้นหาทุกครั้ง

#### แนวคิด

เพิ่มปุ่มทางลัด 3 ปุ่มเหนือช่องค้นหาในแต่ละงบ:

```
[🔌 หม้อแปลง]  [🏗️ เสา]  [〰️ สายไฟ]
```

กดปุ๊บ → ระบบกรอง master data ตามหมวด → แสดงรายการให้เลือกทันที → flow เดิม (เลือกค่าแรง → ระบุจำนวน)

#### User Flow

```
กดปุ่ม "เสา"
    → Modal/Panel แสดงรายการเสาทั้งหมดจาก master
    → กรองย่อยได้ (9ม., 12ม., คอนกรีต, เหล็ก ฯลฯ)
    → เลือกรายการ → เลือกค่าแรง → ระบุ qty → เพิ่มเข้างบ
```

#### การ implement (อ้างอิงโค้ดปัจจุบัน)

| ส่วน | รายละเอียด |
|------|------------|
| **config.js** | เพิ่ม `QUICK_CATEGORIES` กำหนด keyword filter ต่อหมวด |
| **app.js** | ฟังก์ชัน `openQuickPicker(budgetIndex, category)` กรองจาก `state.dataStore` |
| **index.html** | ปุ่ม 3 ปุ่มใน `.budget-search` |
| **Google Sheet** | (ทางเลือก) เพิ่ม column หมวดหมู่ใน sheet `2026-1` สำหรับกรองแม่นยำ |

#### ตัวอย่าง config

```javascript
QUICK_CATEGORIES: {
  transformer: { label: "หม้อแปลง", icon: "🔌", keywords: ["หม้อแปลง", "transformer", "kva"] },
  pole:        { label: "เสา",      icon: "🏗️", keywords: ["เสา", "pole", "คอนกรีต", "เหล็ก"] },
  cable:       { label: "สายไฟ",    icon: "〰️", keywords: ["สาย", "cable", "aac", "xlpe"] }
}
```

#### Effort

| งาน | เวลา |
|-----|------|
| UI ปุ่มทางลัด + modal picker | 1 วัน |
| กรอง master data + reuse `hideAndAsk()` | 0.5 วัน |
| เพิ่ม column หมวดใน Sheet (optional) | 0.5 วัน |
| **รวม** | **~2 วัน** |

---

### 2.6 Pilot Test (สัปดาห์ 6-12)

| งาน | รายละเอียด |
|-----|------------|
| Pilot ใน กฟจ.นครพนม | ทดลองใช้จริง 3 เดือน (รวมปุ่มทางลัด) |
| เก็บ KPI | เวลาประมาณการ, ความแม่นยำ AI, user satisfaction |
| วัดปุ่มทางลัด | จำนวนครั้งที่ใช้ vs ค้นหาด้วยมือ |
| Feedback loop | ปรับ prompt + parser + keyword หมวดหมู่จาก feedback จริง |
| Training material | คู่มือใช้งานสำหรับเจ้าหน้าที่ |

**Deliverables Phase 2:**
- ระบบที่ปลอดภัยพร้อม pilot
- ปุ่มทางลัด หม้อแปลง/เสา/สายไฟ
- รายงาน KPI จาก pilot test 3 เดือน
- คู่มือใช้งานเจ้าหน้าที่

---

## Phase 3: Field Survey + LINE Integration (Q4 2026)

> **เป้าหมาย:** รองรับ workflow หน้างานจริง (สำรวจ + ปักเสา) และเชื่อมต่อ LINE

---

### 3.0 โหมดสำรวจหน้างาน — Field Survey Mode (สัปดาห์ 1-6)

> **Pain point:** งานขยายเขตไฟฟ้า ต้องสำรวจหน้างาน ปักหมุดตาม span แล้วค่อยมาประมาณการ — ทำ 2 รอบ เสียเวลา

#### แนวคิด

เพิ่ม Tab หรือปุ่ม **"เริ่มสำรวจ"** สำหรับงานขยายเขตไฟฟ้า ที่เชื่อม **แผนที่ + span + พัสดุ** เข้ากับระบบประมาณการโดยตรง

#### User Flow หน้างาน

```
1. กด "เริ่มสำรวจ"
       ↓
2. ปักหมุดจุดเริ่ม = เสาระบบจำหน่ายต้นสุดท้าย (จุด A)
   - ใช้ GPS ปัจจุบัน หรือแตะบนแผนที่
       ↓
3. กำหนด Span แต่ละช่วง (เลือกได้ 15 / 20 / 40 / 80 ม. หรือกำหนดเอง)
       ↓
4. ระบบคำนวณจุดเสาถัดไปตามระยะ → ปักหมุด B, C, D...
   - แสดงเส้นทางบนแผนที่
   - ปรับตำแหน่งหมุดด้วยมือได้ (ลาก)
       ↓
5. แต่ละจุดเสา → เลือก spec:
   ┌─────────────────────────────────────┐
   │ จุด B (span 40ม. จาก A)            │
   │ • ขนาดเสา:    [9ม. / 12ม. / ...]   │
   │ • หัวเสา:     [คอนกรีต / คอนเหล็ก / │
   │                Spacer แขวน / อื่นๆ] │
   │ • สายไฟ:      [AAC 50 / XLPE 95...] │
   │ • อุปกรณ์เสริม: [สลิง / ลูกโซ่ / ...]  │
   └─────────────────────────────────────┘
       ↓
6. กด "สร้างรายการประมาณการ"
   → ระบบรวมจำนวนเสา/สายไฟ/หัวเสา อัตโนมัติ
   → ดึงราคาจาก master data
   → เพิ่มเข้างบ (พร้อมเลือกค่าแรง)
```

#### สถาปัตยกรรมที่ต้องเพิ่ม

```
┌─────────────────────────────────────────────┐
│  Tab 3: สำรวจหน้างาน (Field Survey)          │
├─────────────────────────────────────────────┤
│  Map Layer (Google Maps / Leaflet)          │
│    • Geolocation API                        │
│    • Pin placement + drag                   │
│    • Span calculator (bearing + distance)   │
├─────────────────────────────────────────────┤
│  Survey State                               │
│    • startPole { lat, lng, label }          │
│    • segments[] { from, to, spanM, spec }   │
│    • poleSpec { size, headType, cable }     │
├─────────────────────────────────────────────┤
│  BOM Generator                              │
│    • นับจำนวนเสาแต่ละ spec → match master   │
│    • คำนวณเมตรสายจากระยะรวม → match master  │
│    • ส่งเข้า budgets[] (flow เดิม)          │
├─────────────────────────────────────────────┤
│  Save Survey (GAS)                          │
│    • Sheet: Survey_Records                  │
│    • เก็บ GPS + spec JSON + ผูก projectId   │
└─────────────────────────────────────────────┘
```

#### Data Model ใหม่

**Sheet: `Survey_Records`**

| Column | Field |
|--------|-------|
| A | Survey ID |
| B | Project ID (FK) |
| C | Created At |
| D | Start Pole GPS (lat,lng) |
| E | Segments JSON |
| F | Generated Items JSON |
| G | Map Snapshot URL (optional) |

**Segment JSON ตัวอย่าง:**

```json
{
  "segments": [
    {
      "from": { "lat": 17.41, "lng": 104.78, "label": "เสา A (ระบบจำหน่าย)" },
      "to":   { "lat": 17.411, "lng": 104.781, "label": "เสา B" },
      "spanM": 40,
      "spec": {
        "poleSize": "9m",
        "headType": "คอนกรีต",
        "cable": "AAC 50 sqmm",
        "extras": ["สลิง", "ลูกโซ่"]
      }
    }
  ]
}
```

#### Pole Head Types ที่รองรับ (เริ่มต้น)

| ประเภท | คำอธิบาย |
|--------|----------|
| คอนกรีต | หัวเสาคอนกรีตมาตรฐาน |
| คอนเหล็ก | หัวเสาคอนเหล็ก |
| Spacer แขวน | แขวนสายด้วย spacer |
| อื่นๆ | กำหนดเพิ่มใน master mapping |

#### Span Presets

| ค่า | ใช้เมื่อ |
|-----|---------|
| 15 ม. | ซอยแคบ / ที่ดินแคบ |
| 20 ม. | ทางซอยทั่วไป |
| 40 ม. | ถนนชุมชน |
| 80 ม. | ถนนหลัก / ข้ามพื้นที่กว้าง |
| กำหนดเอง | งานพิเศษ |

#### การ implement แบ่งเป็น Sub-phase

| Sub | งาน | Effort |
|-----|-----|--------|
| 3.0a | แผนที่ + ปักหมุดจุดเริ่ม (GPS) | 3 วัน |
| 3.0b | Span calculator + ปักหมุดตามระยะ | 3 วัน |
| 3.0c | เลือก spec ต่อจุด (เสา/หัวเสา/สาย) | 2 วัน |
| 3.0d | BOM Generator → ส่งเข้างบ | 2 วัน |
| 3.0e | บันทึก survey + แสดงในโครงการ | 2 วัน |
| **รวม** | | **~12 วัน (2-3 สัปดาห์)** |

#### Tech ที่ต้องใช้เพิ่ม

| เทคโนโลยี | หน้าที่ | ต้นทุน |
|-----------|---------|--------|
| Google Maps JavaScript API | แสดงแผนที่ + pin | Free tier มี quota |
| Geolocation API | ดึง GPS ปัจจุบัน | ฟรี (browser built-in) |
| Turf.js (optional) | คำนวณจุดตาม bearing+distance | ฟรี (CDN) |

#### จุดขายสำหรับ Pitch

> "สำรวจหน้างาน + ประมาณการ ในแอปเดียว — ปักเสาตาม span จริง แล้วได้ BOM อัตโนมัติ"

---

### 3.1 LINE Messaging API (สัปดาห์ 7-10)

```
ลูกค้า CUS                    เจ้าหน้าที่ กฟภ.
    │                              │
    ▼                              ▼
[ส่งรูป BOM ใน LINE]      [ค้นหาโครงการใน LINE]
    │                              │
    ▼                              ▼
[LINE Webhook Receiver]    [LINE Search API]
    │                              │
    ▼                              ▼
[Line_Intake_Queue]        [Project_Database]
    │                              │
    ▼                              ▼
[AI Process → Reply ยอด]   [Reply รายละเอียด]
```

| งาน | รายละเอียด | Effort |
|-----|------------|--------|
| `api/line-webhook.js` | Vercel serverless LINE webhook receiver | 2 วัน |
| LINE Reply Template | Flex Message แสดงยอดประมาณการ | 1 วัน |
| Auto-process queue | GAS trigger ประมวลผล Line_Intake_Queue | 2 วัน |
| LINE Search bot | ค้นหาโครงการ + reply สรุป | 1 วัน |
| Rich Menu | เมนูหลัก: สแกน BOM / ค้นหา / ช่วยเหลือ | 1 วัน |

### 3.2 Multi-Province Support (สัปดาห์ 11-14)

| งาน | รายละเอียด |
|-----|------------|
| Province config | แยก master data ต่อจังหวัด หรือ column province |
| User role | แยกสิทธิ์ admin (จังหวัด) vs viewer |
| Data isolation | โครงการแยกตามจังหวัด |
| Pilot 3 จังหวัด | นครพนม + 2 จังหวัดภาคอีสาน |

### 3.3 Notification System (สัปดาห์ 9-10)

| งาน | รายละเอียด |
|-----|------------|
| LINE Push | แจ้งเมื่อ AI ประมวลผลเสร็จ |
| Email alert | แจ้ง admin เมื่อมีโครงการใหม่ |
| Price update alert | แจ้งเมื่อ master data อัปเดต |

**Deliverables Phase 3:**
- โหมดสำรวจหน้างาน (แผนที่ + span + สร้าง BOM อัตโนมัติ)
- LINE Chatbot ใช้งานได้จริง
- รองรับ 3 จังหวัด
- ระบบแจ้งเตือน

---

## Phase 4: Analytics & Enterprise (2027)

> **เป้าหมาย:** Dashboard วิเคราะห์ + ขยายทั่วประเทศ + API สำหรับระบบอื่น

### 4.1 Dashboard & Reporting

| ฟีเจอร์ | รายละเอียด |
|---------|------------|
| สรุปยอดประมาณการรายเดือน | กราฟ trend ยอดรวม |
| Top materials | พัสดุที่ใช้บ่อยที่สุด |
| AI accuracy report | อัตราความถูกต้อง AI ต่อเดือน |
| Province comparison | เปรียบเทียบระหว่างจังหวัด |
| Export PDF report | รายงานสรุปสำหรับผู้บริหาร |

### 4.2 Enterprise Features

| ฟีเจอร์ | รายละเอียด |
|---------|------------|
| PEA SSO | Login ด้วยบัญชี กฟภ. |
| Approval workflow | ส่งอนุมัติก่อนสรุปยอด |
| Version control | เก็บประวัติการแก้ไขโครงการ |
| Audit log | บันทึก who/when/what |
| API for 3rd party | REST API สำหรับ ERP/ระบบอื่น |

### 4.3 AI Enhancement

| ฟีเจอร์ | รายละเอียด |
|---------|------------|
| Fine-tuned model | Train model เฉพาะ BOM กฟภ. |
| Multi-page PDF | รองรับ BOM หลายหน้า |
| Auto-suggest labor | แนะนำค่าแรง (ยังให้ user confirm) |
| Anomaly detection | แจ้งเตือนราคาผิดปกติ |
| Voice input | บอกรหัสพัสดุด้วยเสียง |

### 4.4 Scale to 74 Provinces

| งาน | รายละเอียด |
|-----|------------|
| Central admin panel | จัดการ master data กลาง |
| Regional deployment | Deploy แยกภาค หรือ multi-tenant |
| Performance optimization | Caching, CDN, GAS optimization |
| Migrate to Cloud Run | ถ้า GAS ไม่พอ scale (optional) |

---

## Priority Matrix

```
                    Impact
                    High │  Phase 2: Security    Phase 3: LINE
                         │  Phase 2: Validation   Phase 4: Dashboard
                         │
                    Low  │  Phase 2: UX polish    Phase 4: Voice input
                         │  Phase 2: Filters        Phase 4: Fine-tune
                         └──────────────────────────────────
                              Low          High
                                    Effort
```

### แนะนำลำดับความสำคัญ

1. 🔴 **Security hardening** — ก่อน pilot test
2. 🔴 **Validation layer** — ก่อน pilot test
3. 🟡 **Pilot test 3 เดือน** — เก็บ KPI จริง
4. 🟡 **LINE integration** — หลัง pilot สำเร็จ
5. 🟢 **Dashboard** — เมื่อมีข้อมูลเพียงพอ
6. 🟢 **Scale 74 จังหวัด** — เมื่อได้รับอนุมัติระดับสำนักงานใหญ่

---

## งบประมาณโดยประมาณ

### Phase 2 (Q3 2026)

| รายการ | ต้นทุน |
|--------|--------|
| Development (in-house) | 0 บาท (ทำเอง) |
| Vercel hosting | 0 บาท (free tier) |
| Gemini API | 0-500 บาท/เดือน (free quota) |
| Google Workspace | 0 บาท (มีอยู่แล้ว) |
| **รวม** | **~0-500 บาท/เดือน** |

### Phase 3 (Q4 2026)

| รายการ | ต้นทุน |
|--------|--------|
| LINE Messaging API | 0 บาท (free tier 500 msg/เดือน) |
| LINE Official Account | 0 บาท (Basic) |
| Additional Gemini quota | 500-2,000 บาท/เดือน |
| **รวม** | **~500-2,000 บาท/เดือน** |

### Phase 4 (2027)

| รายการ | ต้นทุน |
|--------|--------|
| Vercel Pro (ถ้าจำเป็น) | ~$20/เดือน |
| Gemini API (scale) | 2,000-10,000 บาท/เดือน |
| Cloud Run (optional) | 1,000-5,000 บาท/เดือน |
| **รวม** | **~3,000-15,000 บาท/เดือน** |

> ต้นทุนต่ำมากเมื่อเทียบกับ ERP หรือ custom app ทั่วไป (หลักแสน-ล้านบาท)

---

## Success Criteria

| Phase | เกณฑ์ความสำเร็จ |
|-------|----------------|
| **Phase 2** | Pilot 50+ โครงการ, ลดเวลา ≥ 80%, user satisfaction ≥ 4.0 |
| **Phase 3** | LINE bot ตอบได้ภายใน 30 วินาที, 3 จังหวัดใช้งาน |
| **Phase 4** | Dashboard ใช้งานได้, 10+ จังหวัด, API เปิดให้ระบบอื่น |

---

## ความเสี่ยงและแผนสำรอง

| ความเสี่ยง | ผลกระทบ | แผนสำรอง |
|-----------|---------|---------|
| Gemini API เปลี่ยนราคา/quota | ต้นทุนเพิ่ม | สำรอง model อื่น (Claude, GPT-4o) |
| GAS performance limit | ช้าเมื่อ user เยอะ | Migrate ไป Cloud Run |
| AI accuracy ต่ำ | ผู้ใช้ไม่เชื่อถือ | ปรับ prompt + fine-tune + เพิ่ม review step |
| ไม่ได้รับอนุมัติขยาย | คงอยู่แค่จังหวัดเดียว | ใช้เป็น internal tool + สะสม KPI |
| Master data ไม่อัปเดต | ราคาไม่ตรง | ระบบแจ้งเตือน + workflow อัปเดตราคา |
| Security breach | ข้อมูลรั่ว | Phase 2 security hardening ก่อน pilot |
