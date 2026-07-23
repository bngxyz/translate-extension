// Content script: แสดงไอคอนเมื่อคลุมข้อความ กดแล้วแปลและแสดงป็อปอัพคำแปล
(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;
  const MAX_TEXT_LEN = 4500; // จำกัดความยาวต่อครั้งของ endpoint

  // ใช้ Shadow DOM กัน CSS ของหน้าเว็บมารบกวน
  const host = document.createElement("div");
  host.style.cssText = "all:initial; position:absolute; top:0; left:0; z-index:2147483647;";
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, sans-serif; }

    .qt-btn {
      position: absolute;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: #1a73e8;
      color: #fff;
      display: none;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,.35);
      user-select: none;
      font-size: 15px;
      line-height: 1;
      transition: transform .1s ease;
    }
    .qt-btn:hover { transform: scale(1.12); background: #1765cc; }

    .qt-popup {
      position: absolute;
      min-width: 340px;
      max-width: 640px;
      background: #fff;
      color: #202124;
      border: 1px solid #dadce0;
      border-radius: 10px;
      box-shadow: 0 6px 24px rgba(0,0,0,.25);
      display: none;
      overflow: hidden;
    }
    .qt-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 12px;
      background: #f1f3f4;
      font-size: 12px;
      color: #5f6368;
      cursor: move;
      user-select: none;
    }
    .qt-close {
      cursor: pointer;
      border: none;
      background: none;
      font-size: 16px;
      color: #5f6368;
      padding: 0 2px;
      line-height: 1;
    }
    .qt-close:hover { color: #202124; }
    .qt-body {
      padding: 12px 14px;
      font-size: 15px;
      line-height: 1.55;
      max-height: 260px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .qt-footer {
      display: flex;
      justify-content: flex-end;
      padding: 6px 10px 10px;
    }
    .qt-copy {
      border: 1px solid #dadce0;
      background: #fff;
      color: #1a73e8;
      border-radius: 6px;
      padding: 4px 12px;
      font-size: 12px;
      cursor: pointer;
    }
    .qt-copy:hover { background: #f1f7fe; }
    .qt-loading { color: #5f6368; font-style: italic; }
    .qt-error { color: #d93025; }

    @media (prefers-color-scheme: dark) {
      .qt-popup { background: #2d2e31; color: #e8eaed; border-color: #5f6368; }
      .qt-header { background: #202124; color: #9aa0a6; }
      .qt-close { color: #9aa0a6; }
      .qt-close:hover { color: #e8eaed; }
      .qt-copy { background: #2d2e31; border-color: #5f6368; color: #8ab4f8; }
      .qt-copy:hover { background: #3c4043; }
    }
  `;

  const btn = document.createElement("div");
  btn.className = "qt-btn";
  btn.textContent = "อ";
  btn.title = "แปลเป็นภาษาไทย";

  const popup = document.createElement("div");
  popup.className = "qt-popup";
  popup.innerHTML = `
    <div class="qt-header">
      <span class="qt-lang">กำลังแปล…</span>
      <button class="qt-close" title="ปิด">✕</button>
    </div>
    <div class="qt-body"></div>
    <div class="qt-footer">
      <button class="qt-copy">คัดลอก</button>
    </div>
  `;

  shadow.append(style, btn, popup);

  const langEl = popup.querySelector(".qt-lang");
  const bodyEl = popup.querySelector(".qt-body");
  const copyBtn = popup.querySelector(".qt-copy");
  const closeBtn = popup.querySelector(".qt-close");

  let selectedText = "";
  let anchorRect = null; // ตำแหน่งของข้อความที่คลุม (พิกัดหน้าเว็บ)
  let dragging = false;  // กำลังลากป็อปอัพอยู่หรือไม่
  let dragged = false;   // ผู้ใช้ลากป็อปอัพไปวางเองแล้ว
  let dragOffX = 0, dragOffY = 0;

  function ensureHost() {
    if (!host.isConnected && document.body) document.body.appendChild(host);
  }

  function hideButton() { btn.style.display = "none"; }
  function hidePopup() { popup.style.display = "none"; }
  function hideAll() { hideButton(); hidePopup(); }

  function getSelectionInfo() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const text = sel.toString().trim();
    if (!text) return null;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    return { text, rect };
  }

  function pageCoords(rect) {
    return {
      left: rect.left + window.scrollX,
      right: rect.right + window.scrollX,
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
      width: rect.width
    };
  }

  function showButton(mouseX, mouseY) {
    ensureHost();
    btn.style.display = "flex";
    // วางไอคอนกึ่งกลางใต้ตำแหน่งเมาส์เล็กน้อย
    let left = mouseX - 15; // กึ่งกลางปุ่มกว้าง 30px
    let top = mouseY + 14;
    const minLeft = window.scrollX + 4;
    const maxLeft = window.scrollX + document.documentElement.clientWidth - 34;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;
    btn.style.left = left + "px";
    btn.style.top = top + "px";
  }

  function showPopupAt() {
    ensureHost();
    popup.style.display = "block";
    if (dragged) return; // ผู้ใช้ลากไปวางเองแล้ว ไม่ต้องจัดตำแหน่งใหม่
    const r = anchorRect;
    const vw = document.documentElement.clientWidth;
    let left = r.left;
    let top = r.bottom + 10;
    // กันป็อปอัพล้นขอบขวา
    const pw = Math.min(640, popup.offsetWidth || 640);
    if (left + pw > window.scrollX + vw - 12) {
      left = Math.max(window.scrollX + 12, window.scrollX + vw - pw - 12);
    }
    popup.style.left = left + "px";
    popup.style.top = top + "px";
  }

  async function doTranslate() {
    hideButton();
    dragged = false; // การแปลครั้งใหม่ ให้จัดตำแหน่งอัตโนมัติอีกครั้ง
    langEl.textContent = "กำลังแปล…";
    bodyEl.className = "qt-body qt-loading";
    bodyEl.textContent = "กำลังแปล…";
    showPopupAt();

    let text = selectedText;
    if (text.length > MAX_TEXT_LEN) text = text.slice(0, MAX_TEXT_LEN);

    let res;
    try {
      res = await api.runtime.sendMessage({ type: "TRANSLATE", text, targetLang: "th" });
    } catch (e) {
      res = { ok: false, error: String(e) };
    }

    if (!res || !res.ok) {
      langEl.textContent = "เกิดข้อผิดพลาด";
      bodyEl.className = "qt-body qt-error";
      const err = res && res.error ? res.error : "";
      // ข้อความ error ต่างกันตามเบราว์เซอร์: Chrome = "Extension context invalidated",
      // Firefox = "Message manager disconnected" / "Receiving end does not exist"
      if (
        err.includes("Extension context invalidated") ||
        err.includes("Message manager disconnected") ||
        err.includes("Receiving end does not exist")
      ) {
        bodyEl.textContent = "ส่วนขยายเพิ่งถูกอัปเดต/รีโหลด\nกรุณารีเฟรชหน้าเว็บนี้ (F5) แล้วลองแปลใหม่อีกครั้ง";
      } else {
        bodyEl.textContent = "แปลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง\n" + err;
      }
      return;
    }

    langEl.textContent = res.detectedLangName
      ? `ตรวจพบ: ${res.detectedLangName} → ไทย`
      : "แปลเป็นไทย";
    bodyEl.className = "qt-body";
    bodyEl.textContent = res.translated || "(ไม่มีคำแปล)";
    showPopupAt(); // จัดตำแหน่งใหม่หลังรู้ขนาดจริง
  }

  // --- events ---

  // --- ลากป็อปอัพด้วยแถบหัว ---
  const headerEl = popup.querySelector(".qt-header");
  headerEl.addEventListener("mousedown", (e) => {
    if (e.target === closeBtn) return;
    e.preventDefault();
    dragging = true;
    const rect = popup.getBoundingClientRect();
    dragOffX = e.clientX - rect.left;
    dragOffY = e.clientY - rect.top;
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    e.preventDefault();
    dragged = true;
    popup.style.left = (e.clientX - dragOffX + window.scrollX) + "px";
    popup.style.top = (e.clientY - dragOffY + window.scrollY) + "px";
  }, true);

  document.addEventListener("mouseup", (e) => {
    // ปล่อยเมาส์หลังลากป็อปอัพ ไม่ต้องยุ่งกับ selection
    if (dragging) { dragging = false; return; }
    // ไม่สนใจเหตุการณ์ที่เกิดใน UI ของเราเอง
    if (e.composedPath().includes(host)) return;
    const mx = e.pageX, my = e.pageY;
    // รอให้ browser อัปเดต selection ก่อน
    setTimeout(() => {
      const info = getSelectionInfo();
      if (info) {
        selectedText = info.text;
        anchorRect = pageCoords(info.rect);
        hidePopup();
        showButton(mx, my);
      } else {
        hideAll();
      }
    }, 10);
  });

  document.addEventListener("mousedown", (e) => {
    if (e.composedPath().includes(host)) return;
    hideAll();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideAll();
  });

  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    doTranslate();
  });

  closeBtn.addEventListener("click", hidePopup);

  copyBtn.addEventListener("click", async () => {
    const text = bodyEl.textContent || "";
    let ok = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback สำหรับเบราว์เซอร์ที่บล็อก clipboard API ใน content script
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed; top:-9999px; left:-9999px;";
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand("copy");
      ta.remove();
    }
    copyBtn.textContent = ok ? "คัดลอกแล้ว ✓" : "คัดลอกไม่สำเร็จ";
    setTimeout(() => (copyBtn.textContent = "คัดลอก"), 1500);
  });

  // ไม่ฉีด host เข้า DOM ตั้งแต่โหลด — รอจนผู้ใช้คลุมข้อความจริง (ensureHost ถูกเรียก
  // ใน showButton/showPopupAt) เฟรมที่ไม่มีการโต้ตอบ เช่น iframe ของ Turnstile/reCAPTCHA
  // จะไม่ถูกแทรกโหนดแปลกปลอม ป้องกัน tamper detection ของด่านทำงานผิดพลาด (Error 600010)
})();
