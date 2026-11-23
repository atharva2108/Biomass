// =========================
// POWER PLANT — PROFILE
// Profile: Plant.profile() / Plant.saveProfile() → localStorage "bc_profile_powerplant"
//          (layout.js shows its `name` in the topbar; field list in plant.js header)
// Photo:   localStorage "bc_profile_powerplant_photo" (data URL)
// The only verification document is the GST registration certificate. Its
// status (gstStatus) is set by the admin team and is read-only here.
// Password changes go to the shared users list (js/auth/users.js).
// =========================

const PHOTO_KEY = "bc_profile_powerplant_photo";

const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
    "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

// form field id → profile key
const FIELDS = {
    plantName: "name", capacity: "capacity",
    contactPerson: "contactPerson", designation: "designation", mobile: "mobile", email: "email",
    address: "address", city: "city", state: "state", pincode: "pincode"
};

const GST_HINTS = {
    Verified: "Verified by the admin team.",
    Pending: "Under review by the admin team.",
    Rejected: "Rejected by the admin team. Please contact support."
};

document.addEventListener("DOMContentLoaded", () => {

    fillForm(Plant.profile());
    renderSummary(Plant.profile());
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
        fillForm(Plant.profile());
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

function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}

function fillStates(current) {
    const list = INDIAN_STATES.slice();
    if (current && !list.includes(current)) list.push(current);
    document.getElementById("state").innerHTML = '<option value="">Select state</option>' +
        list.map(s => `<option value="${Store.esc(s)}">${Store.esc(s)}</option>`).join("");
}

// show an error the declarative rules can't know about (duplicate email, wrong password)
function fieldError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("is-invalid");
    el.classList.remove("is-valid");
    el.dataset.touched = "1";
    const err = document.getElementById(id + "Error") ||
        (el.closest(".form-group") && el.closest(".form-group").querySelector(".error"));
    if (err) err.textContent = message;
    el.focus();
}

function hasUsers() {
    return typeof Users !== "undefined" && Users && typeof Users.find === "function";
}

function accountEmail() {
    const session = readJSON("bc_current_user");
    if (session && session.email && (!session.role || session.role === "Power Plant")) return session.email;
    return Plant.profile().email;
}

function initials(name) {
    return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "P";
}

function hasPhoto() {
    try { return !!localStorage.getItem(PHOTO_KEY); } catch (e) { return false; }
}

/* ---------- Profile data ---------- */

function fillForm(p) {
    fillStates(p.state);
    Object.keys(FIELDS).forEach(id => {
        const v = p[FIELDS[id]];
        document.getElementById(id).value = v == null ? "" : v;
    });
    document.getElementById("gstin").value = p.gst || "Not provided";
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
    const current = Plant.profile();
    const data = readForm();
    return Object.keys(data).some(k => String(data[k] == null ? "" : data[k]) !== String(current[k] == null ? "" : current[k]));
}

function renderSummary(p) {
    const status = p.gstStatus || "Pending";

    document.getElementById("sumName").textContent = p.name;
    document.getElementById("sumStatus").innerHTML = Store.statusBadge(status);
    document.getElementById("sumContact").textContent = p.contactPerson ? p.contactPerson + (p.designation ? " · " + p.designation : "") : "—";
    document.getElementById("sumMobile").textContent = p.mobile ? "+91 " + p.mobile : "—";
    document.getElementById("sumEmail").textContent = p.email || "—";
    document.getElementById("sumLocation").textContent = [p.city, p.state].filter(Boolean).join(", ") || "—";
    document.getElementById("sumCapacity").textContent = p.capacity ? Plant.num(p.capacity) + " MW installed capacity" : "—";
    document.getElementById("sumSince").textContent = "Member since " + Store.date(p.memberSince);

    document.getElementById("gstCertName").textContent = p.gstCertificate || "Not uploaded";
    document.getElementById("gstCertStatus").innerHTML = Store.statusBadge(status);
    document.getElementById("gstCertHint").textContent = GST_HINTS[status] || "";

    const keys = Object.values(FIELDS).concat(["gst", "gstCertificate"]);
    const filled = keys.filter(k => p[k] !== undefined && p[k] !== null && String(p[k]).trim() !== "").length +
        (hasPhoto() ? 1 : 0);
    const pct = Math.round(filled / (keys.length + 1) * 100);
    document.getElementById("completeText").textContent = pct + "%";
    document.getElementById("completeBar").style.width = pct + "%";

    if (!hasPhoto()) document.getElementById("avatarBig").textContent = initials(p.name);
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

    const data = readForm();
    const oldEmail = accountEmail();

    // email / mobile must stay unique across accounts
    if (hasUsers()) {
        const me = Users.find(oldEmail);
        const isOther = u => u && (!me || u.email.toLowerCase() !== me.email.toLowerCase());
        if (isOther(Users.find(data.email))) {
            fieldError("email", "This email is already registered to another account");
            showToast("This email is already registered to another account", "error");
            return;
        }
        if (isOther(Users.find(data.mobile))) {
            fieldError("mobile", "This mobile number is already registered to another account");
            showToast("This mobile number is already registered to another account", "error");
            return;
        }
    }

    const profile = Object.assign({}, Plant.profile(), data, { updatedAt: Store.iso(0) });
    delete profile.cofiringTarget;   // dropped field from older saved profiles
    Plant.saveProfile(profile);

    // keep login credentials and session in step with the profile
    if (hasUsers() && Users.find(oldEmail)) {
        Users.update(oldEmail, { name: profile.name, contactPerson: profile.contactPerson, email: profile.email, mobile: profile.mobile });
    }
    const session = readJSON("bc_current_user");
    if (session && (!session.role || session.role === "Power Plant")) {
        Store.set("bc_current_user", Object.assign(session, { name: profile.name, email: profile.email }));
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
        avatar.textContent = initials(Plant.profile().name);
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
        renderSummary(Plant.profile());
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
    renderSummary(Plant.profile());
    showToast("Profile photo removed", "success");
}

/* ---------- Password ---------- */

function changePassword() {

    if (!Validator.validateForm("#passwordForm")) return;

    const user = hasUsers() ? Users.find(accountEmail()) : null;
    if (!user) {
        showToast("Your account could not be found. Please sign in again.", "error");
        return;
    }

    if (document.getElementById("currentPassword").value !== user.password) {
        fieldError("currentPassword", "Current password is incorrect");
        showToast("Current password is incorrect", "error");
        return;
    }

    Users.update(user.email, { password: document.getElementById("newPassword").value });

    const form = document.getElementById("passwordForm");
    form.reset();
    Validator.reset(form);
    form.querySelectorAll(".password-wrap input").forEach(i => { i.type = "password"; });
    form.querySelectorAll(".password-toggle").forEach(b => { b.innerHTML = '<i class="fa-regular fa-eye"></i>'; });

    showToast("Password changed successfully. Use your new password next time you sign in.", "success");
}
