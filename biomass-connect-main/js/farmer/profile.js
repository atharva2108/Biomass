// =========================
// FARMER — PROFILE (US006)
// Profile: localStorage "bc_profile_farmer" (layout.js shows its `name` in the topbar)
// Photo:   localStorage "bc_profile_farmer_photo" (data URL)
// Password changes go to the shared demo users list (js/auth/users.js) when available.
// =========================

const PROFILE_KEY = "bc_profile_farmer";
const PHOTO_KEY = "bc_profile_farmer_photo";

const DEFAULT_PROFILE = {
    name: FARMER_NAME,
    dob: "1984-06-15",
    gender: "Male",
    mobile: "9876543211",
    email: "farmer@gmail.com",
    address: "Survey No. 112, Near Gram Panchayat Office",
    village: "Niphad",
    district: "Nashik",
    state: "Maharashtra",
    pincode: "422303",
    farmArea: 12.5,
    primaryCrops: "Rice, Wheat, Sugarcane",
    accountHolder: FARMER_NAME,
    bankName: "State Bank of India",
    accountNo: "30412345678",
    ifsc: "SBIN0001234",
    upi: "ramesh.patil@sbi",
    aadhaarLast4: "4821",
    pan: "",
    memberSince: "2025-01-10"
};

// form field id → profile key
const FIELDS = {
    fullName: "name", dob: "dob", gender: "gender", mobile: "mobile", email: "email",
    address: "address", village: "village", district: "district", state: "state", pincode: "pincode",
    farmArea: "farmArea", primaryCrops: "primaryCrops",
    accountHolder: "accountHolder", bankName: "bankName", accountNo: "accountNo", ifsc: "ifsc", upi: "upi",
    pan: "pan"
};

document.addEventListener("DOMContentLoaded", () => {

    Farmer.fillSelect("state", INDIAN_STATES, "Select state");

    // users.js (auth) wires the password toggles itself; bind our own only if it isn't loaded
    if (typeof initPasswordToggles !== "function") bindPasswordToggles();

    fillForm(loadProfile());
    renderSummary(loadProfile());
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

/* ---------- Profile data ---------- */

function loadProfile() {
    const stored = Farmer.readJSON(PROFILE_KEY, {}) || {};
    return Object.assign({}, DEFAULT_PROFILE, stored);
}

function accountEmail() {
    const session = Farmer.readJSON("bc_current_user", null);
    if (session && session.email && (!session.role || session.role === "Farmer")) return session.email;
    return loadProfile().email || DEFAULT_PROFILE.email;
}

function fillForm(p) {
    Object.keys(FIELDS).forEach(id => {
        const el = document.getElementById(id);
        const v = p[FIELDS[id]];
        el.value = v == null ? "" : v;
    });
    if (p.state && !INDIAN_STATES.includes(p.state)) Farmer.fillSelect("state", INDIAN_STATES, "Select state", p.state);
    document.getElementById("state").value = p.state || "";
    document.getElementById("confirmAccount").value = p.accountNo || "";
    document.getElementById("aadhaar").value = p.aadhaarLast4 ? "XXXX XXXX " + p.aadhaarLast4 : "Not provided";
    Validator.reset("#profileForm");
}

function readForm() {
    const data = {};
    Object.keys(FIELDS).forEach(id => {
        data[FIELDS[id]] = document.getElementById(id).value.trim();
    });
    data.farmArea = Number(data.farmArea);
    data.ifsc = data.ifsc.toUpperCase();
    data.pan = data.pan.toUpperCase();
    data.email = data.email.toLowerCase();
    return data;
}

function hasChanges() {
    const current = loadProfile();
    const data = readForm();
    return Object.keys(data).some(k => String(data[k] == null ? "" : data[k]) !== String(current[k] == null ? "" : current[k]));
}

function initials(name) {
    return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "F";
}

function renderSummary(p) {
    document.getElementById("sumName").textContent = p.name;
    document.getElementById("sumMobile").textContent = p.mobile ? "+91 " + p.mobile : "—";
    document.getElementById("sumEmail").textContent = p.email || "—";
    document.getElementById("sumLocation").textContent = [p.village, p.district, p.state].filter(Boolean).join(", ") || "—";
    document.getElementById("sumFarm").textContent = p.farmArea ? p.farmArea + " acres" + (p.primaryCrops ? " · " + p.primaryCrops : "") : "—";
    document.getElementById("sumSince").textContent = "Member since " + Store.date(p.memberSince);

    const keys = Object.values(FIELDS).concat(["aadhaarLast4"]);
    const filled = keys.filter(k => p[k] !== undefined && p[k] !== null && String(p[k]).trim() !== "").length +
        (localStorageHas(PHOTO_KEY) ? 1 : 0);
    const pct = Math.round(filled / (keys.length + 1) * 100);
    document.getElementById("completeText").textContent = pct + "%";
    document.getElementById("completeBar").style.width = pct + "%";

    if (!localStorageHas(PHOTO_KEY)) document.getElementById("avatarBig").textContent = initials(p.name);
}

function localStorageHas(key) {
    try { return !!localStorage.getItem(key); } catch (e) { return false; }
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
    const hasUsers = typeof Users !== "undefined" && Users && typeof Users.find === "function";

    // email / mobile must stay unique across accounts
    if (hasUsers) {
        const me = Users.find(oldEmail);
        const byEmail = Users.find(data.email);
        if (byEmail && (!me || byEmail.email.toLowerCase() !== me.email.toLowerCase())) {
            Farmer.fieldError("email", "This email is already registered to another account");
            showToast("This email is already registered to another account", "error");
            return;
        }
        const byMobile = Users.find(data.mobile);
        if (byMobile && (!me || byMobile.email.toLowerCase() !== me.email.toLowerCase())) {
            Farmer.fieldError("mobile", "This mobile number is already registered to another account");
            showToast("This mobile number is already registered to another account", "error");
            return;
        }
    }

    const profile = Object.assign({}, current, data, { updatedAt: Farmer.today() });

    if (!Farmer.writeJSON(PROFILE_KEY, profile)) {
        showToast("Could not save your profile. Please try again.", "error");
        return;
    }

    // keep login credentials and session in step with the profile
    if (hasUsers && Users.find(oldEmail)) {
        Users.update(oldEmail, { name: profile.name, email: profile.email, mobile: profile.mobile });
    }
    const session = Farmer.readJSON("bc_current_user", null);
    if (session && (!session.role || session.role === "Farmer")) {
        Farmer.writeJSON("bc_current_user", Object.assign(session, { name: profile.name, email: profile.email }));
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

function bindPasswordToggles() {
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

function changePassword() {

    if (!Validator.validateForm("#passwordForm")) return;

    const current = document.getElementById("currentPassword").value;
    const next = document.getElementById("newPassword").value;
    const email = accountEmail();
    const hasUsers = typeof Users !== "undefined" && Users && typeof Users.find === "function";
    const user = hasUsers ? Users.find(email) : null;
    const expected = user ? user.password : (Farmer.readJSON("farmer_password", null) || "Farmer@123");

    if (current !== expected) {
        Farmer.fieldError("currentPassword", "Current password is incorrect");
        showToast("Current password is incorrect", "error");
        return;
    }

    if (user) Users.update(user.email, { password: next });
    else Farmer.writeJSON("farmer_password", next);

    const form = document.getElementById("passwordForm");
    form.reset();
    Validator.reset(form);
    form.querySelectorAll(".password-wrap input").forEach(i => { i.type = "password"; });
    form.querySelectorAll(".password-toggle").forEach(b => { b.innerHTML = '<i class="fa-regular fa-eye"></i>'; });

    showToast("Password changed successfully. Use your new password next time you sign in.", "success");
}
