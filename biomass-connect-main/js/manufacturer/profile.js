// =========================
// MANUFACTURER — PROFILE
// Profile: localStorage "bc_profile_manufacturer" (layout.js shows its `name` in the topbar;
//          auth.js writes { name, email, mobile } there on login — merged with the defaults below)
// Photo:   localStorage "bc_profile_manufacturer_photo" (data URL)
// Account: the users list from js/auth/users.js (login email / mobile / password and the
//          verification status of the GST certificate: "Active" = verified)
// =========================

const MANUFACTURER = "GreenPellet Industries";
const PROFILE_KEY = "bc_profile_manufacturer";
const PHOTO_KEY = "bc_profile_manufacturer_photo";

const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
    "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

const DEFAULT_PROFILE = {
    name: MANUFACTURER,
    contactPerson: "Anil Deshmukh",
    mobile: "9876543212",
    email: "manufacturer@gmail.com",
    address: "Plot 14, MIDC Ambad",
    city: "Nashik",
    state: "Maharashtra",
    pincode: "422010",
    capacity: 60,
    gstin: "27AACCG4410L1Z4",
    memberSince: "2025-04-12"
};

// form field id → profile key
const FIELDS = {
    companyName: "name", contactPerson: "contactPerson", mobile: "mobile", email: "email",
    address: "address", city: "city", state: "state", pincode: "pincode", capacity: "capacity"
};

document.addEventListener("DOMContentLoaded", () => {

    fillSelect("state", INDIAN_STATES, "Select state");

    const profile = loadProfile();
    fillForm(profile);
    renderSummary(profile);
    renderPhoto();

    document.getElementById("profileForm").addEventListener("submit", e => {
        e.preventDefault();
        saveProfile();
    });

    document.getElementById("discardBtn").addEventListener("click", () => {
        if (!hasChanges()) {
            showToast("There are no unsaved changes", "info");
            return;
        }
        fillForm(loadProfile());
        showToast("Unsaved changes discarded", "info");
    });

    document.getElementById("passwordForm").addEventListener("submit", e => {
        e.preventDefault();
        changePassword();
    });

    document.getElementById("photoInput").addEventListener("change", uploadPhoto);
    document.getElementById("removePhoto").addEventListener("click", removePhoto);
});

/* ---------- Helpers ---------- */

function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return fallback;
}

function writeJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        return false;
    }
}

function hasItem(key) {
    try { return !!localStorage.getItem(key); } catch (e) { return false; }
}

// fills a <select>; keeps a current value even if it isn't in the list
function fillSelect(id, items, placeholder, current) {
    const select = document.getElementById(id);
    const list = items.slice();
    if (current && !list.includes(current)) list.push(current);
    select.innerHTML = '<option value="">' + Store.esc(placeholder) + "</option>" +
        list.map(v => '<option value="' + Store.esc(v) + '">' + Store.esc(v) + "</option>").join("");
    if (current) select.value = current;
}

// show an error the declarative rules can't know about (duplicate email, wrong password)
function fieldError(id, message) {
    const el = document.getElementById(id);
    const group = el.closest(".form-group");
    let err = group.querySelector(".error");
    if (!err) {
        err = document.createElement("small");
        err.className = "error";
        group.appendChild(err);
    }
    el.classList.add("is-invalid");
    el.classList.remove("is-valid");
    el.dataset.touched = "1";
    err.textContent = message;
    el.focus();
}

function initials(name) {
    return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "M";
}

/* ---------- Account & profile data ---------- */

function accountEmail() {
    const session = readJSON("bc_current_user", null);
    if (session && session.email && (!session.role || session.role === "Manufacturer")) return session.email;
    const stored = readJSON(PROFILE_KEY, null);
    return (stored && stored.email) || DEFAULT_PROFILE.email;
}

function accountUser() {
    return Users.find(accountEmail());
}

// defaults ← details given at registration ← saved profile
function loadProfile() {
    const user = accountUser() || {};
    const fromAccount = {};
    ["contactPerson", "state", "pincode", "gstin"].forEach(k => { if (user[k]) fromAccount[k] = user[k]; });
    if (user.registeredOn) fromAccount.memberSince = user.registeredOn;
    return Object.assign({}, DEFAULT_PROFILE, fromAccount, readJSON(PROFILE_KEY, {}) || {});
}

function gstStatus() {
    const user = accountUser();
    return !user || user.status === "Active" ? "Verified" : "Under Review";
}

function fillForm(p) {
    if (p.state && !INDIAN_STATES.includes(p.state)) fillSelect("state", INDIAN_STATES, "Select state", p.state);
    Object.keys(FIELDS).forEach(id => {
        const v = p[FIELDS[id]];
        document.getElementById(id).value = v == null ? "" : v;
    });
    document.getElementById("gstin").value = p.gstin || "Not provided";
    Validator.reset("#profileForm");
}

function readForm() {
    const data = {};
    Object.keys(FIELDS).forEach(id => {
        data[FIELDS[id]] = document.getElementById(id).value.trim();
    });
    data.capacity = Number(data.capacity);
    data.email = data.email.toLowerCase();
    return data;
}

function hasChanges() {
    const current = loadProfile();
    const data = readForm();
    return Object.keys(data).some(k => String(data[k] == null ? "" : data[k]) !== String(current[k] == null ? "" : current[k]));
}

/* ---------- Summary ---------- */

function renderSummary(p) {
    const status = gstStatus();

    document.getElementById("sumName").textContent = p.name;
    document.getElementById("sumStatus").innerHTML = status === "Verified"
        ? '<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Verified</span>'
        : '<span class="badge badge-warning"><i class="fa-regular fa-clock"></i> Under Review</span>';
    document.getElementById("sumRating").innerHTML = Store.ratingHtml(MANUFACTURER);
    document.getElementById("sumContact").textContent = p.contactPerson || "—";
    document.getElementById("sumMobile").textContent = p.mobile ? "+91 " + p.mobile : "—";
    document.getElementById("sumEmail").textContent = p.email || "—";
    document.getElementById("sumLocation").textContent = [p.city, p.state].filter(Boolean).join(", ") || "—";
    document.getElementById("sumCapacity").textContent = p.capacity ? p.capacity + " tons/day production capacity" : "—";
    document.getElementById("sumSince").textContent = "Member since " + Store.date(p.memberSince);

    document.getElementById("gstDoc").innerHTML =
        '<i class="fa-regular fa-file-lines"></i><span>GST Registration Certificate</span>' + Store.statusBadge(status);
    document.getElementById("gstHint").textContent = status === "Verified"
        ? "Checked and approved by the Biomass Connect admin team."
        : "Your GST certificate is being checked by the admin team.";

    const keys = Object.values(FIELDS).concat(["gstin"]);
    const filled = keys.filter(k => p[k] !== undefined && p[k] !== null && String(p[k]).trim() !== "").length +
        (hasItem(PHOTO_KEY) ? 1 : 0);
    const pct = Math.round(filled / (keys.length + 1) * 100);
    document.getElementById("completeText").textContent = pct + "%";
    document.getElementById("completeBar").style.width = pct + "%";

    if (!hasItem(PHOTO_KEY)) document.getElementById("avatarBig").textContent = initials(p.name);
}

// keep the topbar chip in sync without a reload
function refreshTopbar(name) {
    const chip = document.querySelector(".user-chip");
    if (!chip) return;
    const strong = chip.querySelector(".user-meta strong");
    const avatar = chip.querySelector(".avatar");
    if (strong) strong.textContent = name;
    if (avatar) avatar.textContent = initials(name);
}

/* ---------- Save profile ---------- */

function saveProfile() {

    if (!Validator.validateForm("#profileForm")) return;

    if (!hasChanges()) {
        showToast("No changes to save", "info");
        return;
    }

    const current = loadProfile();
    const data = readForm();
    const oldEmail = accountEmail();
    const me = Users.find(oldEmail);

    // email / mobile must stay unique across accounts
    const byEmail = Users.find(data.email);
    if (byEmail && (!me || byEmail.email.toLowerCase() !== me.email.toLowerCase())) {
        fieldError("email", "This email is already registered to another account");
        showToast("This email is already registered to another account", "error");
        return;
    }
    const byMobile = Users.find(data.mobile);
    if (byMobile && (!me || byMobile.email.toLowerCase() !== me.email.toLowerCase())) {
        fieldError("mobile", "This mobile number is already registered to another account");
        showToast("This mobile number is already registered to another account", "error");
        return;
    }

    const profile = Object.assign({}, current, data, { updatedAt: Store.iso(0) });

    if (!writeJSON(PROFILE_KEY, profile)) {
        showToast("Could not save your profile. Please try again.", "error");
        return;
    }

    // keep login credentials and session in step with the profile
    if (me) Users.update(oldEmail, { name: profile.name, email: profile.email, mobile: profile.mobile });
    const session = readJSON("bc_current_user", null);
    if (session && (!session.role || session.role === "Manufacturer")) {
        writeJSON("bc_current_user", Object.assign(session, { name: profile.name, email: profile.email }));
    }

    fillForm(profile);
    renderSummary(profile);
    refreshTopbar(profile.name);
    showToast("Profile updated successfully", "success");
}

/* ---------- Photo ---------- */

function renderPhoto() {
    const avatar = document.getElementById("avatarBig");
    let src = "";
    try { src = localStorage.getItem(PHOTO_KEY) || ""; } catch (e) { src = ""; }

    avatar.innerHTML = "";
    if (src) {
        const img = document.createElement("img");
        img.src = src;
        img.alt = "Profile photo";
        avatar.appendChild(img);
    } else {
        avatar.textContent = initials(loadProfile().name);
    }
    document.getElementById("removePhoto").classList.toggle("hidden", !src);
}

function uploadPhoto() {
    const input = document.getElementById("photoInput");
    if (!input.files.length) return;

    if (!Validator.validateField(input)) {
        showToast("Please choose a JPG or PNG image up to 1 MB", "error");
        input.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        try {
            localStorage.setItem(PHOTO_KEY, reader.result);
        } catch (e) {
            showToast("This photo is too large to store. Please choose a smaller image.", "error");
            input.value = "";
            return;
        }
        input.value = "";
        Validator.reset(".photo-group");
        renderPhoto();
        renderSummary(loadProfile());
        showToast("Profile photo updated", "success");
    };
    reader.onerror = () => showToast("Could not read the selected file", "error");
    reader.readAsDataURL(input.files[0]);
}

async function removePhoto() {
    const ok = await confirmDialog({
        title: "Remove profile photo?",
        message: "Your initials will be shown instead.",
        confirmText: "Remove",
        danger: true
    });
    if (!ok) return;
    try { localStorage.removeItem(PHOTO_KEY); } catch (e) { /* ignore */ }
    renderPhoto();
    renderSummary(loadProfile());
    showToast("Profile photo removed", "success");
}

/* ---------- Password ---------- */

function changePassword() {

    if (!Validator.validateForm("#passwordForm")) return;

    const current = document.getElementById("currentPassword").value;
    const next = document.getElementById("newPassword").value;
    const user = accountUser();
    const expected = user ? user.password : (readJSON("manufacturer_password", null) || "Manufacturer@123");

    if (current !== expected) {
        fieldError("currentPassword", "Current password is incorrect");
        showToast("Current password is incorrect", "error");
        return;
    }

    if (user) Users.update(user.email, { password: next });
    else writeJSON("manufacturer_password", next);

    const form = document.getElementById("passwordForm");
    form.reset();
    Validator.reset(form);
    form.querySelectorAll(".password-wrap input").forEach(i => { i.type = "password"; });
    form.querySelectorAll(".password-toggle").forEach(b => { b.innerHTML = '<i class="fa-regular fa-eye"></i>'; });

    showToast("Password changed successfully. Use your new password next time you sign in.", "success");
}
