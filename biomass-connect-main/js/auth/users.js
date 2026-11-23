// =========================================================
// AUTH HELPERS — shared by login, register and forgot password
// Front-end only: users are kept in localStorage ("users").
// =========================================================

const DEMO_USERS = [
    { name: "System Admin", email: "admin@gmail.com", mobile: "9876543210", password: "Admin@123", role: "Admin", securityQuestion: "What is your birth city?", securityAnswer: "pune", status: "Active" },
    { name: "Ramesh Patil", email: "farmer@gmail.com", mobile: "9876543211", password: "Farmer@123", role: "Farmer", securityQuestion: "What is your birth city?", securityAnswer: "pune", status: "Active" },
    { name: "GreenPellet Industries", email: "manufacturer@gmail.com", mobile: "9876543212", password: "Manufacturer@123", role: "Manufacturer", securityQuestion: "What is your birth city?", securityAnswer: "pune", status: "Active" },
    { name: "NTPC Nashik Unit", email: "powerplant@gmail.com", mobile: "9876543213", password: "PowerPlant@123", role: "Power Plant", securityQuestion: "What is your birth city?", securityAnswer: "pune", status: "Active" },
    // Logistics partner account (created by Biomass Connect, not via public registration)
    { name: "Logistics Team", email: "logistics@gmail.com", mobile: "9876543214", password: "Logistics@123", role: "Logistics", securityQuestion: "What is your birth city?", securityAnswer: "pune", status: "Active" }
];

const ROLE_HOME = {
    "Admin": "../admin/dashboard.html",
    "Farmer": "../farmer/dashboard.html",
    "Manufacturer": "../manufacturer/dashboard.html",
    "Power Plant": "../powerplant/dashboard.html",
    "Logistics": "../logistics/dashboard.html"
};

const ROLE_KEY = {
    "Admin": "admin",
    "Farmer": "farmer",
    "Manufacturer": "manufacturer",
    "Power Plant": "powerplant",
    "Logistics": "logistics"
};

const Users = {

    all() {
        let users;
        try { users = JSON.parse(localStorage.getItem("users")); } catch (e) { users = null; }
        if (!Array.isArray(users)) users = [];
        // make sure demo accounts always exist
        DEMO_USERS.forEach(demo => {
            if (!users.some(u => u.email === demo.email)) users.push(Object.assign({}, demo));
        });
        return users;
    },

    save(users) {
        try { localStorage.setItem("users", JSON.stringify(users)); } catch (e) { /* ignore */ }
    },

    // find by email (case-insensitive) or mobile
    find(identifier) {
        const id = String(identifier || "").trim().toLowerCase();
        return this.all().find(u => u.email.toLowerCase() === id || u.mobile === id) || null;
    },

    add(user) {
        const users = this.all();
        users.push(user);
        this.save(users);
    },

    update(email, patch) {
        const users = this.all();
        const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
        if (idx === -1) return false;
        users[idx] = Object.assign({}, users[idx], patch);
        this.save(users);
        return true;
    }
};

// ---------- Password show / hide ----------

function initPasswordToggles() {
    document.querySelectorAll(".password-toggle").forEach(btn => {
        btn.addEventListener("click", () => {
            const input = btn.parentElement.querySelector("input");
            const show = input.type === "password";
            input.type = show ? "text" : "password";
            btn.innerHTML = '<i class="fa-regular ' + (show ? "fa-eye-slash" : "fa-eye") + '"></i>';
            btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
        });
    });
}

// ---------- Password strength meter ----------

function initStrengthMeter(inputId, meterId) {
    const input = document.getElementById(inputId);
    const meter = document.getElementById(meterId);
    if (!input || !meter) return;

    const labels = ["", "Weak", "Fair", "Good", "Strong"];

    input.addEventListener("input", () => {
        const v = input.value;
        let score = 0;
        if (v.length >= 8) score++;
        if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
        if (/\d/.test(v)) score++;
        if (/[^A-Za-z0-9]/.test(v)) score++;
        if (!v) score = 0;
        meter.dataset.level = score;
        meter.querySelector(".strength-label").textContent = labels[score] || "";
    });
}

// ---------- Caps lock hint ----------

function initCapsLockHint(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    let warned = false;
    input.addEventListener("keyup", e => {
        if (e.getModifierState && e.getModifierState("CapsLock") && !warned) {
            warned = true;
            showToast("Caps Lock is on", "warning", { duration: 2500 });
        }
        if (e.getModifierState && !e.getModifierState("CapsLock")) warned = false;
    });
}

document.addEventListener("DOMContentLoaded", initPasswordToggles);
