// Background script: เรียก Google Translate (endpoint สาธารณะ ไม่ต้องใช้ API key)
// แปลจากภาษาใดก็ได้ (auto-detect) -> ไทย
// รันเป็น service worker บน Chrome และ event page บน Firefox

const api = typeof browser !== "undefined" ? browser : chrome;

const LANG_NAMES = {
  en: "อังกฤษ", ja: "ญี่ปุ่น", ko: "เกาหลี", zh: "จีน", "zh-CN": "จีน (ตัวย่อ)",
  "zh-TW": "จีน (ตัวเต็ม)", fr: "ฝรั่งเศส", de: "เยอรมัน", es: "สเปน",
  ru: "รัสเซีย", pt: "โปรตุเกส", it: "อิตาลี", vi: "เวียดนาม", id: "อินโดนีเซีย",
  ms: "มาเลย์", ar: "อาหรับ", hi: "ฮินดี", th: "ไทย", lo: "ลาว", my: "พม่า",
  km: "เขมร", tl: "ตากาล็อก", nl: "ดัตช์", tr: "ตุรกี", pl: "โปแลนด์",
  sv: "สวีเดน", uk: "ยูเครน"
};

async function translate(text, targetLang = "th") {
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    "?client=gtx&sl=auto&tl=" + encodeURIComponent(targetLang) +
    "&dt=t&dj=1&q=" + encodeURIComponent(text);

  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();

  const translated = (data.sentences || [])
    .map((s) => s.trans || "")
    .join("");
  const detected = data.src || "";

  return {
    translated,
    detectedLang: detected,
    detectedLangName: LANG_NAMES[detected] || detected
  };
}

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "TRANSLATE") {
    translate(msg.text, msg.targetLang || "th")
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // ตอบกลับแบบ async
  }
});
