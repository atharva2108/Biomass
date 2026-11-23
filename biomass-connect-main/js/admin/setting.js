// =========================
// ADMIN — PLATFORM SETTINGS
// Stored as an object under "admin_settings".
// =========================

const SETTINGS_KEY = "admin_settings";

const DEFAULTS = {
    platformName: "Biomass Connect",
    supportEmail: "support@biomassconnect.in",
    supportPhone: "9876543210",
    commission: 2.5,
    gst: 18,
    minOrderQty: 5,
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    maxUpload: 5,
    notifyRegistration: true,
    notifyDisputes: true,
    notifyHighValue: true,
    highValueThreshold: 1000000
};

const TEXT_FIELDS = ["platformName", "supportEmail", "supportPhone"];
const NUMBER_FIELDS = ["commission", "gst", "minOrderQty", "sessionTimeout", "maxLoginAttempts", "maxUpload", "highValueThreshold"];
const TOGGLES = ["notifyRegistration", "notifyDisputes", "notifyHighValue"];

let dirty = false;

document.addEventListener("DOMContentLoaded", () => {

    fillForm(loadSettings());

    const form = document.getElementById("settingsForm");
    form.addEventListener("submit", saveSettings);
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);

    document.getElementById("notifyHighValue").addEventListener("change", syncThreshold);
    document.getElementById("resetDefaults").addEventListener("click", resetDefaults);
    document.getElementById("discardBtn").addEventListener("click", discardChanges);
});

/* ---------- storage ---------- */

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
        if (saved && typeof saved === "object") return Object.assign({}, DEFAULTS, saved);
    } catch (e) { /* ignore */ }
    return Object.assign({}, DEFAULTS);
}

function storeSettings(settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        return true;
    } catch (e) {
        return false;
    }
}

/* ---------- form ---------- */

function fillForm(s) {
    TEXT_FIELDS.concat(NUMBER_FIELDS).forEach(id => { document.getElementById(id).value = s[id]; });
    TOGGLES.forEach(id => { document.getElementById(id).checked = !!s[id]; });
    syncThreshold();
    Validator.reset("#settingsForm");
    setDirty(false, s.updatedAt);
}

function readForm() {
    const s = {};
    TEXT_FIELDS.forEach(id => { s[id] = document.getElementById(id).value.trim(); });
    NUMBER_FIELDS.forEach(id => { s[id] = Number(document.getElementById(id).value); });
    TOGGLES.forEach(id => { s[id] = document.getElementById(id).checked; });
    s.supportEmail = s.supportEmail.toLowerCase();
    return s;
}

// threshold only matters (and is only validated) when high-value alerts are on
function syncThreshold() {
    const on = document.getElementById("notifyHighValue").checked;
    const input = document.getElementById("highValueThreshold");
    input.disabled = !on;
    document.getElementById("thresholdGroup").classList.toggle("is-disabled", !on);
    if (!on) Validator.validateField(input);
}

function markDirty() {
    if (!dirty) setDirty(true);
}

function setDirty(value, savedAt) {
    dirty = value;
    const el = document.getElementById("saveState");
    if (value) {
        el.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Unsaved changes';
        el.classList.add("is-dirty");
    } else {
        const at = savedAt || loadSettings().updatedAt;
        el.textContent = at ? "Last saved " + Admin.dateTime(at) : "Using default settings";
        el.classList.remove("is-dirty");
    }
}

/* ---------- actions ---------- */

function saveSettings(e) {
    e.preventDefault();
    if (!Validator.validateForm("#settingsForm")) return;

    const before = loadSettings();
    const next = readForm();
    if (!next.notifyHighValue) next.highValueThreshold = before.highValueThreshold;

    const changed = Object.keys(next).filter(k => String(before[k]) !== String(next[k]));
    if (!changed.length) {
        setDirty(false);
        return showToast("No changes to save", "info");
    }

    next.updatedAt = Admin.now();
    if (!storeSettings(next)) return showToast("Settings could not be saved. Browser storage is unavailable.", "error");

    Admin.log("Updated platform settings (" + changed.length + " field" + (changed.length > 1 ? "s" : "") + ")", "Settings");
    setDirty(false, next.updatedAt);
    showToast("Platform settings saved successfully", "success");
}

async function resetDefaults() {
    const ok = await confirmDialog({
        title: "Reset all settings?",
        message: "Every setting on this page will return to its default value. This cannot be undone.",
        confirmText: "Reset to Defaults",
        danger: true
    });
    if (!ok) return;

    const settings = Object.assign({}, DEFAULTS, { updatedAt: Admin.now() });
    if (!storeSettings(settings)) return showToast("Settings could not be reset. Browser storage is unavailable.", "error");

    fillForm(settings);
    Admin.log("Reset platform settings to defaults", "Settings");
    showToast("Settings reset to defaults", "success");
}

function discardChanges() {
    if (!dirty) return showToast("There are no unsaved changes", "info");
    fillForm(loadSettings());
    showToast("Unsaved changes discarded", "info");
}
