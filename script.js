"use strict";

/* ============================================================
   CONFIGURATION
   ============================================================ */
let whatsappNumber = 919288209406;

const CLINIC = {
  phoneTel: "+919288209406",
  phoneShow: "+91 92882 09406",
  timeZone: "Asia/Kolkata",
  opensAt: 10,
  closesAt: 19,
  slotHours: { "10:00 AM": 10, "12:00 PM": 12, "4:00 PM": 16, "6:00 PM": 18 },
  maxDaysAhead: 60,
  mapUrl: "https://maps.app.goo.gl/tf8feNz9hpsK3H5B8",
};

// Existing EmailJS account, unchanged
const EMAILJS = {
  publicKey: "uphcX247dYNakklMn",
  serviceId: "service_cqjci6q",
  templateId: "template_8er9mw8",
};

/* ============================================================
   SMALL HELPERS
   ============================================================ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const currentLang = () => (document.documentElement.lang === "hi" ? "hi" : "en");
const L = (en, hi) =>
  `<span class="lang en" lang="en">${en}</span><span class="lang hi" lang="hi">${hi}</span>`;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function safeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function safeSet(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
function safeRemove(key) { try { localStorage.removeItem(key); } catch (e) {} }
function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error("Timed out")), ms))]);
}

/* Current date/time at the clinic (India), independent of the visitor's device zone */
function clinicNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function formatDate(dateStr, lang) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
function formatPhone(p) { return p.length === 10 ? `+91 ${p.slice(0, 5)} ${p.slice(5)}` : p; }

/* ============================================================
   NAVIGATION MENU
   ============================================================ */
function toggleMenu(force) {
  const nav = $("#navMenu");
  const btn = $(".menu-toggle");
  if (!nav || !btn) return;
  const open = typeof force === "boolean" ? force : !nav.classList.contains("active");
  nav.classList.toggle("active", open);
  btn.classList.toggle("open", open);
  btn.setAttribute("aria-expanded", String(open));
}

/* ============================================================
   FORM VALIDATION
   ============================================================ */
function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validatePhone(phone) { return /^[6-9]\d{9}$/.test(phone); }

const MSG = {
  service: { en: "Please choose a service.", hi: "कृपया एक सेवा चुनें।" },
  nameRequired: { en: "Please enter your name.", hi: "कृपया अपना नाम लिखें।" },
  nameShort: { en: "Please enter your full name.", hi: "कृपया अपना पूरा नाम लिखें।" },
  phoneRequired: { en: "Please enter your 10-digit mobile number.", hi: "कृपया अपना 10 अंकों का मोबाइल नंबर लिखें।" },
  phoneInvalid: { en: "Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.", hi: "6, 7, 8 या 9 से शुरू होने वाला सही 10 अंकों का मोबाइल नंबर लिखें।" },
  emailInvalid: { en: "Enter a valid email address, or leave this empty.", hi: "सही ईमेल पता लिखें, या इसे खाली छोड़ दें।" },
  dateRequired: { en: "Please choose a date.", hi: "कृपया तारीख चुनें।" },
  datePast: { en: "That date has passed. Choose today or a later date.", hi: "यह तारीख निकल चुकी है। आज या बाद की तारीख चुनें।" },
  dateFar: { en: `Please choose a date within the next ${CLINIC.maxDaysAhead} days.`, hi: `कृपया अगले ${CLINIC.maxDaysAhead} दिनों के भीतर की तारीख चुनें।` },
  timeRequired: { en: "Please choose a time.", hi: "कृपया समय चुनें।" },
  timePast: { en: "That time has passed today. Choose a later time or another date.", hi: "आज यह समय निकल चुका है। बाद का समय या दूसरी तारीख चुनें।" },
  formInvalid: { en: "Please check the highlighted fields.", hi: "कृपया चिह्नित फ़ील्ड जाँच लें।" },
  slotsPassed: { en: "Times that have already passed today are unavailable.", hi: "आज जो समय निकल चुके हैं वे उपलब्ध नहीं हैं।" },
  noSlots: { en: "No time slots are left today. Please choose another date.", hi: "आज कोई समय शेष नहीं है। कृपया दूसरी तारीख चुनें।" },
};
const msg = (key) => MSG[key][currentLang()];

const VALIDATORS = {
  service: (v) => (v ? "" : "service"),
  name: (v) => {
    v = v.trim();
    if (!v) return "nameRequired";
    if (v.length < 2 || !/\p{L}/u.test(v)) return "nameShort";
    return "";
  },
  phone: (v) => (!v ? "phoneRequired" : validatePhone(v) ? "" : "phoneInvalid"),
  email: (v) => (!v.trim() || validateEmail(v.trim()) ? "" : "emailInvalid"),
  date: (v) => {
    if (!v) return "dateRequired";
    const now = clinicNow();
    if (v < now.date) return "datePast";
    if (v > addDays(now.date, CLINIC.maxDaysAhead)) return "dateFar";
    return "";
  },
  time: (v) => {
    if (!v) return "timeRequired";
    const now = clinicNow();
    if ($("#date").value === now.date && CLINIC.slotHours[v] * 60 <= now.minutes) return "timePast";
    return "";
  },
};
const FIELD_ORDER = ["service", "name", "phone", "email", "date", "time"];

function setFieldError(id, key) {
  const input = $("#" + id);
  const box = $("#err-" + id);
  if (!input || !box) return;
  box.dataset.key = key || "";
  box.textContent = key ? msg(key) : "";
  if (key) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}
function validateField(id) {
  const key = VALIDATORS[id]($("#" + id).value);
  setFieldError(id, key);
  return key === "";
}
function refreshErrors() {
  $$(".field-error").forEach((box) => { if (box.dataset.key) box.textContent = msg(box.dataset.key); });
  const status = $("#formStatus");
  if (status && status.dataset.key) status.textContent = msg(status.dataset.key);
  refreshSlots();
}

/* Disable time slots that have already started when today is selected */
function refreshSlots() {
  const sel = $("#time");
  const hint = $("#hint-time");
  if (!sel || !hint) return;
  const now = clinicNow();
  const isToday = $("#date").value === now.date;
  let available = 0, passed = 0;
  $$("option", sel).forEach((opt) => {
    if (!opt.value) return;
    const past = isToday && CLINIC.slotHours[opt.value] * 60 <= now.minutes;
    opt.disabled = past;
    past ? passed++ : available++;
  });
  if (sel.value && sel.selectedOptions[0] && sel.selectedOptions[0].disabled) sel.value = "";
  hint.textContent = !isToday || !passed ? "" : available ? msg("slotsPassed") : msg("noSlots");
}

/* ============================================================
   APPOINTMENT DIALOG
   ============================================================ */
const state = { step: 1, sending: false, data: null };

function getData() {
  return {
    service: $("#service").value,
    name: $("#name").value.trim(),
    phone: $("#phone").value.trim(),
    email: $("#email").value.trim(),
    date: $("#date").value,
    time: $("#time").value,
    problem: $("#problem").value.trim(),
  };
}
function optionLabel(selectId, value, lang) {
  const opt = $$("#" + selectId + " option").find((o) => o.value === value);
  return opt ? opt.dataset[lang] || opt.textContent : value;
}
const LABELS = {
  service: { en: "Service", hi: "सेवा" },
  name: { en: "Name", hi: "नाम" },
  phone: { en: "Mobile", hi: "मोबाइल" },
  email: { en: "Email", hi: "ईमेल" },
  date: { en: "Preferred date", hi: "पसंदीदा तारीख" },
  time: { en: "Preferred time", hi: "पसंदीदा समय" },
  problem: { en: "Problem", hi: "समस्या" },
};
function fillSummary(dl, d) {
  const lang = currentLang();
  dl.textContent = "";
  [
    ["service", optionLabel("service", d.service, lang)],
    ["name", d.name],
    ["phone", formatPhone(d.phone)],
    d.email ? ["email", d.email] : null,
    ["date", formatDate(d.date, lang)],
    ["time", optionLabel("time", d.time, lang)],
    d.problem ? ["problem", d.problem] : null,
  ].filter(Boolean).forEach(([key, value]) => {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = LABELS[key][lang];
    dd.textContent = value;
    row.append(dt, dd);
    dl.append(row);
  });
}

function showStep(n) {
  state.step = n;
  $$("#appointmentModal .step").forEach((el) => { el.hidden = Number(el.dataset.step) !== n; });
  const label = $("#stepLabel");
  label.innerHTML = n === 1 ? L("Step 1 of 2: your details", "चरण 1 / 2: आपका विवरण")
    : n === 2 ? L("Step 2 of 2: check and send", "चरण 2 / 2: जाँचें और भेजें") : "";
  label.hidden = n === 3;
  const body = $("#appointmentModal .step:not([hidden]) .modal-body");
  if (body) body.scrollTop = 0;
}

/* Remember name/phone/email/service on this device while a request is unfinished */
function saveDraft() {
  safeSet("sc_draft", JSON.stringify({
    service: $("#service").value, name: $("#name").value, phone: $("#phone").value, email: $("#email").value,
  }));
}
function loadDraft() {
  try {
    const d = JSON.parse(safeGet("sc_draft") || "null");
    if (!d) return;
    ["service", "name", "phone", "email"].forEach((id) => {
      const el = $("#" + id);
      if (el && !el.value && d[id]) el.value = d[id];
    });
    if ($("#service").selectedIndex === -1) $("#service").value = "";
  } catch (e) {}
}
function clearDraft() { safeRemove("sc_draft"); }

function prepareForm() {
  const now = clinicNow();
  const date = $("#date");
  date.min = now.date;
  date.max = addDays(now.date, CLINIC.maxDaysAhead);
  loadDraft();
  refreshSlots();
}

function openModal(service) {
  const dlg = $("#appointmentModal");
  if (!dlg) return;
  toggleMenu(false);
  if (!dlg.open) {
    state.data = null;
    $("#formStatus").textContent = "";
    $("#formStatus").dataset.key = "";
    prepareForm();
    showStep(1);
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
    document.body.classList.add("no-scroll");
  }
  if (service) {
    const sel = $("#service");
    sel.value = service;
    if (sel.value !== service) sel.value = "";
    setFieldError("service", "");
  }
  (service ? $("#name") : $("#service")).focus({ preventScroll: true });
}
function closeModal() {
  const dlg = $("#appointmentModal");
  if (dlg && dlg.open) dlg.close();
}

function sendReview(e) {
  e.preventDefault();
  if ($("#website").value) return; // honeypot
  let firstBad = null;
  FIELD_ORDER.forEach((id) => { if (!validateField(id) && !firstBad) firstBad = id; });
  const status = $("#formStatus");
  if (firstBad) {
    status.dataset.key = "formInvalid";
    status.textContent = msg("formInvalid");
    const el = $("#" + firstBad);
    el.scrollIntoView({ block: "center" });
    el.focus({ preventScroll: true });
    return;
  }
  status.dataset.key = "";
  status.textContent = "";
  state.data = getData();
  fillSummary($("#reviewSummary"), state.data);
  showStep(2);
  $("#apptDialogTitle").focus();
}

/* ============================================================
   SENDING THE REQUEST
   Existing mechanism kept: EmailJS to the clinic, WhatsApp as fallback.
   Nothing here confirms an appointment; the clinic does that.
   ============================================================ */
function composeProblem(d) {
  return `Service: ${d.service}` + (d.problem ? `\nProblem: ${d.problem}` : "");
}
function whatsappUrl(d) {
  const message =
    `Hello Doctor,\n\nI would like to request an appointment:\n\n` +
    `Service: ${d.service}\nName: ${d.name}\nPhone: ${d.phone}\n` +
    (d.email ? `Email: ${d.email}\n` : "") +
    `Preferred date: ${formatDate(d.date, "en")}\nPreferred time: ${d.time}\n` +
    `Problem: ${d.problem || "N/A"}\n\nPlease confirm availability.`;
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}
function sendToWhatsApp(d) {
  d = d || state.data || getData();
  window.open(whatsappUrl(d), "_blank", "noopener");
}

function setSending(on) {
  state.sending = on;
  const btn = $("#sendBtn");
  if (!btn) return;
  if (on) {
    btn.dataset.html = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-small" aria-hidden="true"></span>${L("Sending...", "भेजा जा रहा है...")}`;
  } else if (btn.dataset.html) {
    btn.innerHTML = btn.dataset.html;
  }
  btn.disabled = on;
  $("#editBtn").disabled = on;
}

async function sendToEmail() {
  if (state.sending || !state.data) return;
  const d = state.data;
  setSending(true);
  const payload = {
    name: d.name,
    email: d.email || "Not provided",
    phone: d.phone,
    date: formatDate(d.date, "en"),
    time: d.time,
    service: d.service,
    problem: composeProblem(d),
  };
  try {
    if (!window.emailjs) throw new Error("EmailJS did not load");
    if (navigator.onLine === false) throw new Error("Offline");
    await withTimeout(emailjs.send(EMAILJS.serviceId, EMAILJS.templateId, payload), 15000);
    clearDraft();
    $("#apptForm").reset();
    showResult("sent", d);
  } catch (error) {
    console.error("Email failed:", error);
    showResult("failed", d);
  } finally {
    setSending(false);
  }
}

function showResult(kind, d) {
  const box = $("#resultBox");
  const foot = $("#resultFoot");
  const wa = whatsappUrl(d);
  const call = `tel:${CLINIC.phoneTel}`;
  const phone = escapeHtml(formatPhone(d.phone));
  const actions = (waLabel) => `
      <div class="result-actions">
        <a class="btn btn-wa" href="${wa}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i>${waLabel}</a>
        <a class="btn btn-ghost" href="${call}"><i class="fa-solid fa-phone" aria-hidden="true"></i>${L("Call " + CLINIC.phoneShow, "कॉल करें " + CLINIC.phoneShow)}</a>
      </div>`;
  if (kind === "sent") {
    box.className = "result is-sent";
    box.innerHTML = `
      <div class="result-icon" aria-hidden="true"><i class="fa-solid fa-check"></i></div>
      <h3 tabindex="-1">${L("Request sent", "अनुरोध भेज दिया गया")}</h3>
      <p>${L(
        `Your request has been sent to the clinic. <strong>It is not a confirmed appointment yet.</strong> The clinic will contact you on ${phone} to confirm a time.`,
        `आपका अनुरोध क्लिनिक को भेज दिया गया है। <strong>यह अभी पक्का अपॉइंटमेंट नहीं है।</strong> क्लिनिक समय की पुष्टि के लिए ${phone} पर आपसे संपर्क करेगा।`
      )}</p>
      <dl class="summary" id="resultSummary"></dl>
      <p>${L("Want a faster reply, or need to change something? Call or message the clinic.", "जल्दी उत्तर चाहिए या कुछ बदलना है? क्लिनिक को कॉल करें या संदेश भेजें।")}</p>
      ${actions(L("Message on WhatsApp", "व्हाट्सएप पर संदेश भेजें"))}`;
    fillSummary($("#resultSummary"), d);
    foot.innerHTML = `<button type="button" class="btn btn-primary" data-close-dialog>${L("Done", "ठीक है")}</button>`;
  } else {
    box.className = "result is-failed";
    box.innerHTML = `
      <div class="result-icon" aria-hidden="true"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <h3 tabindex="-1">${L("We could not send your request", "हम आपका अनुरोध नहीं भेज सके")}</h3>
      <p>${L(
        "Your request was <strong>not</strong> sent. You can send the same details on WhatsApp (already filled in), or call the clinic.",
        "आपका अनुरोध <strong>नहीं</strong> भेजा गया। आप वही विवरण व्हाट्सएप पर भेज सकते हैं (पहले से भरा हुआ), या क्लिनिक को कॉल कर सकते हैं।"
      )}</p>
      ${actions(L("Send on WhatsApp", "व्हाट्सएप पर भेजें"))}`;
    foot.innerHTML = `
      <button type="button" class="btn btn-ghost" data-back-review>${L("Back", "वापस")}</button>
      <button type="button" class="btn btn-primary" data-retry>${L("Try again", "फिर कोशिश करें")}</button>`;
  }
  showStep(3);
  const heading = $("h3", box);
  if (heading) heading.focus();
}

function openWhatsApp() {
  const message = "Hello Doctor, I want to book an appointment.";
  window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
}
function openMap() { window.open(CLINIC.mapUrl, "_blank", "noopener"); }
function scrollToForm() {
  const el = $("#appointment");
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

/* ============================================================
   LANGUAGE SWITCHING (BILINGUAL)
   Both languages exist in the page; CSS shows the one on <html lang>.
   ============================================================ */
const TITLES = {
  en: "Smile Craft Dental & Maxillofacial Centre, Begusarai | Dr. Pravin Kumar",
  hi: "स्माइल क्राफ्ट डेंटल एंड मैक्सिलोफेशियल सेंटर, बेगूसराय | डॉ. प्रवीन कुमार",
};

function switchLang(lang) {
  if (lang !== "hi") lang = "en";
  document.documentElement.lang = lang;
  document.title = TITLES[lang];
  $$(".lang-switch button").forEach((btn) => {
    const on = btn.dataset.lang === lang;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", String(on));
  });
  safeSet("lang", lang);
  updatePlaceholders(lang);
  updateSelectOptions(lang);
  updateStaticLabels(lang);
  updateHeroImage(lang);
  updateClinicStatus();
  refreshErrors();
  if (state.step === 2 && state.data) fillSummary($("#reviewSummary"), state.data);
  const rs = $("#resultSummary");
  if (state.step === 3 && state.data && rs) fillSummary(rs, state.data);
}
function updatePlaceholders(lang) {
  $$("input, textarea").forEach((el) => { if (el.dataset[lang]) el.placeholder = el.dataset[lang]; });
}
function updateSelectOptions(lang) {
  $$("#service option, #time option").forEach((opt) => { if (opt.dataset[lang]) opt.textContent = opt.dataset[lang]; });
}
/* Alt text and aria-labels that live in attributes */
function updateStaticLabels(lang) {
  $$("[data-alt-en]").forEach((el) => { el.alt = lang === "hi" ? el.dataset.altHi : el.dataset.altEn; });
  $$("[data-label-en]").forEach((el) => {
    el.setAttribute("aria-label", lang === "hi" ? el.dataset.labelHi : el.dataset.labelEn);
  });
  $$(".gallery-item").forEach((btn) => {
    const img = $("img", btn);
    const alt = lang === "hi" ? img.dataset.altHi : img.dataset.alt;
    btn.setAttribute("aria-label", alt + (lang === "hi" ? "। बड़ा देखें" : ". Open larger view"));
  });
  if (lightbox.dlg && lightbox.dlg.open) lightbox.render();
}

// Hero image follows the language (cross-fade, as before)
function updateHeroImage(lang, initial) {
  const img = $("#heroImage");
  if (!img) return;
  const newSrc = lang === "hi" ? "images/hero_image1.jpeg" : "images/hero_image2.jpeg";
  const current = img.dataset.current || img.getAttribute("src");
  if (current === newSrc) { img.dataset.current = newSrc; return; }
  const swap = () => { img.src = newSrc; img.dataset.current = newSrc; img.classList.remove("is-fading"); };
  if (initial) return swap();
  img.classList.add("is-fading");
  const pre = new Image();
  pre.onload = () => setTimeout(swap, 300);
  pre.onerror = () => img.classList.remove("is-fading");
  pre.src = newSrc;
}

/* ============================================================
   CLINIC OPEN/CLOSED NOTE (from the clinic's stated hours)
   ============================================================ */
function updateClinicStatus() {
  const el = $("#clinicStatus");
  if (!el) return;
  const { minutes } = clinicNow();
  const open = minutes >= CLINIC.opensAt * 60 && minutes < CLINIC.closesAt * 60;
  const beforeOpen = minutes < CLINIC.opensAt * 60;
  el.classList.toggle("is-open", open);
  const hi = currentLang() === "hi";
  el.textContent = open
    ? hi ? "अभी खुला है, शाम 7 बजे तक" : "Open now, until 7 PM"
    : beforeOpen
      ? hi ? "अभी बंद है, आज सुबह 10 बजे खुलेगा" : "Closed now, opens today at 10 AM"
      : hi ? "अभी बंद है, कल सुबह 10 बजे खुलेगा" : "Closed now, opens tomorrow at 10 AM";
}

/* ============================================================
   GALLERY LIGHTBOX
   ============================================================ */
const lightbox = {
  dlg: null, items: [], index: 0,
  init() {
    this.dlg = $("#lightbox");
    this.items = $$(".gallery-item");
    if (!this.dlg || !this.items.length) return;
    this.items.forEach((btn, i) => btn.addEventListener("click", () => this.open(i)));
    $("#lbPrev").addEventListener("click", () => this.step(-1));
    $("#lbNext").addEventListener("click", () => this.step(1));
    $("#lbClose").addEventListener("click", () => this.dlg.close());
    this.dlg.addEventListener("click", (e) => {
      if (e.target === this.dlg || e.target.classList.contains("lb-stage")) this.dlg.close();
    });
    this.dlg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") this.step(-1);
      if (e.key === "ArrowRight") this.step(1);
    });
    this.dlg.addEventListener("close", unlockScroll);
  },
  open(i) {
    this.index = i;
    this.render();
    if (typeof this.dlg.showModal === "function") this.dlg.showModal();
    else this.dlg.setAttribute("open", "");
    document.body.classList.add("no-scroll");
  },
  step(n) {
    this.index = (this.index + n + this.items.length) % this.items.length;
    this.render();
  },
  render() {
    const img = $("img", this.items[this.index]);
    const big = $("#lbImg");
    big.src = img.getAttribute("src");
    big.alt = currentLang() === "hi" ? img.dataset.altHi : img.dataset.alt;
    $("#lbCount").textContent = `${this.index + 1} / ${this.items.length}`;
  },
};
function unlockScroll() {
  if (!document.querySelector("dialog[open]")) document.body.classList.remove("no-scroll");
}

/* ============================================================
   SCROLL EFFECTS
   ============================================================ */
function updateScrollProgress() {
  const doc = document.documentElement;
  const height = doc.scrollHeight - doc.clientHeight;
  $("#progress-bar").style.width = (height > 0 ? (doc.scrollTop / height) * 100 : 0) + "%";
  $(".header-wrapper").classList.toggle("scrolled", window.scrollY > 10);
}
function initScrollSpy() {
  if (!("IntersectionObserver" in window)) return;
  const links = $$(".nav a");
  const ids = ["home", "about", "services", "why-choose", "appointment", "gallery", "faq", "contact"];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => {
        if (a.getAttribute("href") === "#" + entry.target.id) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    });
  }, { rootMargin: "-35% 0px -60% 0px" });
  ids.map((id) => document.getElementById(id)).filter(Boolean).forEach((t) => observer.observe(t));
}

/* ============================================================
   SERVICES: all open on large screens, collapsed list on phones
   ============================================================ */
function initServices() {
  const wide = window.matchMedia("(min-width: 721px)");
  const cards = $$(".service");
  const sync = () => cards.forEach((card) => {
    card.open = wide.matches;
    const summary = $("summary", card);
    if (summary) summary.tabIndex = wide.matches ? -1 : 0;
  });
  cards.forEach((card) => card.addEventListener("toggle", () => {
    if (wide.matches && !card.open) card.open = true;
  }));
  sync();
  if (wide.addEventListener) wide.addEventListener("change", sync);
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  if (window.emailjs) emailjs.init(EMAILJS.publicKey);

  document.addEventListener("click", (e) => {
    const langBtn = e.target.closest(".lang-switch button[data-lang]");
    if (langBtn) return switchLang(langBtn.dataset.lang);
    const book = e.target.closest("[data-book]");
    if (book) return openModal(book.dataset.book);
    if (e.target.closest("[data-open-appointment]")) return openModal();
    if (e.target.closest("[data-close-dialog]")) return closeModal();
    if (e.target.closest("[data-retry]")) { showStep(2); return sendToEmail(); }
    if (e.target.closest("[data-back-review]")) return showStep(2);
    if (!e.target.closest(".header-wrapper")) toggleMenu(false);
  });

  $(".menu-toggle").addEventListener("click", () => toggleMenu());
  $$(".nav a").forEach((a) => a.addEventListener("click", () => toggleMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggleMenu(false); });

  const dlg = $("#appointmentModal");
  $("#modalClose").addEventListener("click", closeModal);
  dlg.addEventListener("click", (e) => { if (e.target === dlg) closeModal(); });
  dlg.addEventListener("close", unlockScroll);
  $("#apptForm").addEventListener("submit", sendReview);
  $("#editBtn").addEventListener("click", () => { showStep(1); $("#service").focus({ preventScroll: true }); });
  $("#sendBtn").addEventListener("click", sendToEmail);

  const phone = $("#phone");
  phone.addEventListener("input", () => {
    let digits = phone.value.replace(/\D/g, "");
    if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2); // pasted +91 number
    if (digits.length > 10 && digits.startsWith("0")) digits = digits.slice(1);
    phone.value = digits.slice(0, 10);
  });
  FIELD_ORDER.forEach((id) => {
    const el = $("#" + id);
    el.addEventListener("blur", () => { if (el.value || $("#err-" + id).dataset.key) validateField(id); });
    const onChange = () => {
      if ($("#err-" + id).dataset.key) validateField(id);
      saveDraft();
    };
    el.addEventListener("input", onChange);
    el.addEventListener("change", onChange);
  });
  $("#date").addEventListener("change", () => {
    refreshSlots();
    if ($("#time").value || $("#err-time").dataset.key) validateField("time");
  });

  lightbox.init();
  initServices();
  initScrollSpy();

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { updateScrollProgress(); ticking = false; });
  }, { passive: true });
  updateScrollProgress();

  const lang = safeGet("lang") === "hi" ? "hi" : "en";
  switchLang(lang);
  updateHeroImage(lang, true);
  setInterval(updateClinicStatus, 60000);
}

init();
