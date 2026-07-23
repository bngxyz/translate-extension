# Quick Translate to Thai

Browser Extension แปลข้อความเป็นภาษาไทย (รองรับทั้ง Chrome และ Firefox) — คลุมข้อความด้วยเมาส์ จะมีไอคอน **อ** ขึ้นมา กดแล้วป็อปอัพคำแปลจะแสดงทันที (ตรวจจับภาษาต้นทางอัตโนมัติ)

## วิธีติดตั้ง

### Chrome

1. เปิด Chrome ไปที่ `chrome://extensions`
2. เปิดสวิตช์ **Developer mode** (มุมขวาบน)
3. กด **Load unpacked** แล้วเลือกโฟลเดอร์ `D:\SRC2026\tran`

### Firefox (ต้องเป็นเวอร์ชัน 121 ขึ้นไป)

1. เปิด Firefox ไปที่ `about:debugging#/runtime/this-firefox`
2. กด **Load Temporary Add-on…** แล้วเลือกไฟล์ `manifest.json` ในโฟลเดอร์ `D:\SRC2026\tran`
3. **สำคัญ:** Firefox จะไม่ให้สิทธิ์เข้าถึงเว็บไซต์โดยอัตโนมัติ — ไปที่ `about:addons` → เลือก **Quick Translate to Thai** → แท็บ **Permissions** → เปิดสิทธิ์ **Access your data for translate.googleapis.com** (ถ้าไม่เปิด การแปลอาจล้มเหลว)

> การโหลดแบบ Temporary Add-on จะหายไปเมื่อปิด Firefox ต้องโหลดใหม่ทุกครั้ง หากต้องการติดตั้งถาวรต้อง sign ผ่าน [addons.mozilla.org](https://addons.mozilla.org) หรือใช้ Firefox Developer Edition/Nightly ที่ปิด `xpinstall.signatures.required` ได้

## วิธีใช้

1. คลุม (ไฮไลต์) ข้อความในหน้าเว็บใดก็ได้
2. จะมีไอคอนวงกลมสีน้ำเงิน **อ** ขึ้นมาข้าง ๆ ข้อความ
3. กดไอคอน → ป็อปอัพแสดงคำแปลภาษาไทย พร้อมบอกภาษาที่ตรวจพบ
4. กดปุ่ม **คัดลอก** เพื่อคัดลอกคำแปล / กด `Esc` หรือคลิกที่อื่นเพื่อปิด

## โครงสร้างไฟล์

- `manifest.json` — Manifest V3 (ประกาศ background ทั้งแบบ `service_worker` สำหรับ Chrome และ `scripts` สำหรับ Firefox)
- `content.js` — ตรวจจับการคลุมข้อความ แสดงไอคอนและป็อปอัพ (ใช้ Shadow DOM กัน CSS หน้าเว็บชนกัน)
- `background.js` — เรียก Google Translate endpoint สาธารณะ (ไม่ต้องใช้ API key) รันเป็น service worker บน Chrome / event page บน Firefox
- `icons/` — ไอคอน extension

## หมายเหตุ

- ใช้ endpoint `translate.googleapis.com` แบบไม่ต้องมี key เหมาะกับใช้งานส่วนตัว ถ้าเรียกถี่มากอาจโดนจำกัดชั่วคราว
- ข้อความยาวเกิน ~4,500 ตัวอักษรจะถูกตัดก่อนแปล
