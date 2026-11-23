// =========================================================
// LANDING PAGE + shared public-page helpers
// (social links are also used by the auth pages)
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
    initMobileNav();
    initScrollSpy();
    initBackToTop();
    initContactForm();
});

// ---------- Navigation helpers (kept for older markup) ----------

function getStarted() {
    window.location.href = "auth/register.html";
}

function goToLogin() {
    window.location.href = "auth/login.html";
}

function goToRegister() {
    window.location.href = "auth/register.html";
}

function scrollToFeatures() {
    const el = document.getElementById("features");
    if (el) el.scrollIntoView({ behavior: "smooth" });
}

function scrollToContact() {
    const el = document.getElementById("contact");
    if (el) el.scrollIntoView({ behavior: "smooth" });
}

// ---------- Social links ----------

function openLinkedIn() { window.open("https://linkedin.com", "_blank", "noopener"); }
function openTwitter() { window.open("https://twitter.com", "_blank", "noopener"); }
function openYoutube() { window.open("https://youtube.com", "_blank", "noopener"); }
function openInstagram() { window.open("https://instagram.com", "_blank", "noopener"); }

// ---------- Mobile menu ----------

function initMobileNav() {
    const toggle = document.getElementById("navToggle");
    const header = document.querySelector(".landing-header");
    if (!toggle || !header) return;

    toggle.addEventListener("click", () => {
        const open = header.classList.toggle("nav-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.innerHTML = '<i class="fa-solid ' + (open ? "fa-xmark" : "fa-bars") + '"></i>';
    });

    header.querySelectorAll("nav a").forEach(link => {
        link.addEventListener("click", () => {
            header.classList.remove("nav-open");
            toggle.setAttribute("aria-expanded", "false");
            toggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
        });
    });
}

// ---------- Highlight the section in view ----------

function initScrollSpy() {
    const links = document.querySelectorAll("#mainNav a[href^='#']");
    if (!links.length || !("IntersectionObserver" in window)) return;

    const byId = {};
    links.forEach(link => { byId[link.getAttribute("href").slice(1)] = link; });

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            links.forEach(l => l.classList.remove("active"));
            const link = byId[entry.target.id];
            if (link) link.classList.add("active");
        });
    }, { rootMargin: "-45% 0px -50% 0px" });

    Object.keys(byId).forEach(id => {
        const section = document.getElementById(id);
        if (section) observer.observe(section);
    });
}

// ---------- Back to top ----------

function initBackToTop() {
    const btn = document.getElementById("backToTop");
    if (!btn) return;
    const update = () => btn.classList.toggle("show", window.scrollY > 600);
    window.addEventListener("scroll", update, { passive: true });
    update();
}

// ---------- Contact form ----------

function initContactForm() {
    const form = document.getElementById("contactForm");
    if (!form) return;

    const message = document.getElementById("contactMessage");
    const counter = document.getElementById("messageCount");

    message.addEventListener("input", () => {
        counter.textContent = message.value.length;
    });

    form.addEventListener("submit", e => {
        e.preventDefault();

        if (!Validator.validateForm(form)) return;

        const btn = document.getElementById("contactBtn");
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

        const entry = {
            name: document.getElementById("contactName").value.trim(),
            email: document.getElementById("contactEmail").value.trim(),
            mobile: document.getElementById("contactMobile").value.trim(),
            role: document.getElementById("contactTopic").value,
            message: message.value.trim(),
            date: new Date().toISOString()
        };

        try {
            const list = JSON.parse(localStorage.getItem("bc_contact_messages")) || [];
            list.push(entry);
            localStorage.setItem("bc_contact_messages", JSON.stringify(list));
        } catch (err) { /* storage unavailable */ }

        setTimeout(() => {
            showToast("Thanks " + entry.name.split(" ")[0] + "! We'll get back to you at " + entry.email + ".", "success", { title: "Message sent" });
            form.reset();
            Validator.reset(form);
            counter.textContent = "0";
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send message';
        }, 600);
    });
}
