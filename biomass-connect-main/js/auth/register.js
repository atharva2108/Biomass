// =========================================================
// REGISTRATION
// Field rules live on the inputs (data-rules) — see validation.js
// =========================================================

const DOCUMENTS = {
    "Farmer": {
        title: "Aadhaar Card",
        description: "Upload your Aadhaar card for identity verification."
    },
    "Manufacturer": {
        title: "GST Registration Certificate",
        description: "Upload your GST registration certificate for business verification."
    },
    "Power Plant": {
        title: "GST Registration Certificate",
        description: "Upload your plant's GST registration certificate for business verification."
    }
};

document.addEventListener("DOMContentLoaded", () => {

    document.querySelectorAll(".role-card").forEach(card => {
        card.addEventListener("click", () => selectRole(card));
    });

    document.getElementById("document").addEventListener("change", onFileChange);

    document.getElementById("registerForm").addEventListener("submit", e => {
        e.preventDefault();
        registerUser();
    });

    // email / mobile already registered? tell the user early
    document.getElementById("email").addEventListener("blur", checkDuplicateEmail);
    document.getElementById("mobile").addEventListener("blur", checkDuplicateMobile);

    initStrengthMeter("password", "strengthMeter");
    initCapsLockHint("password");

    // pre-select a role from the landing page (?role=Manufacturer)
    const requested = new URLSearchParams(location.search).get("role");
    const card = requested && document.querySelector('.role-card[data-role="' + requested.replace(/"/g, "") + '"]');
    if (card) selectRole(card);
});

// ---------- Role selection ----------

function selectRole(card) {
    const role = card.dataset.role;

    document.querySelectorAll(".role-card").forEach(c => {
        c.classList.toggle("active", c === card);
        c.setAttribute("aria-checked", c === card ? "true" : "false");
    });

    document.getElementById("selectedRole").value = role;

    const isFarmer = role === "Farmer";
    document.querySelectorAll(".org-only").forEach(el => el.classList.toggle("hidden", isFarmer));
    document.querySelectorAll(".farmer-only").forEach(el => el.classList.toggle("hidden", !isFarmer));

    const orgLabel = role === "Power Plant" ? "Power Plant Name" : "Company Name";
    const orgInput = document.getElementById("orgName");
    orgInput.dataset.label = orgLabel;
    document.getElementById("orgNameLabel").innerHTML = orgLabel + ' <span class="req">*</span>';

    const doc = DOCUMENTS[role];
    document.getElementById("documentTitle").innerHTML = doc.title + ' <span class="req">*</span>';
    document.getElementById("documentDescription").textContent = doc.description;

    // a previously chosen file was for the other document type
    const fileInput = document.getElementById("document");
    if (fileInput.value) {
        fileInput.value = "";
        document.getElementById("fileName").textContent = "";
        showToast("Please upload your " + doc.title + " for the " + role + " account.", "info");
    }

    // clear errors on fields that were just hidden
    document.querySelectorAll(".org-only input, .farmer-only input").forEach(input => Validator.validateField(input));
}

// ---------- File ----------

function onFileChange() {
    const input = document.getElementById("document");
    const nameEl = document.getElementById("fileName");
    const file = input.files[0];

    if (!file) {
        nameEl.textContent = "";
        return;
    }

    if (Validator.validateField(input)) {
        const sizeKb = Math.max(1, Math.round(file.size / 1024));
        nameEl.innerHTML = '<i class="fa-solid fa-paperclip"></i> ' + Store_esc(file.name) + " (" + sizeKb + " KB)";
        showToast("Document attached: " + file.name, "success");
    } else {
        nameEl.textContent = "";
        showToast(document.getElementById("documentError").textContent || "Invalid file", "error", { title: "Upload failed" });
        input.value = "";
    }
}

function Store_esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Duplicate checks ----------

function checkDuplicateEmail() {
    const input = document.getElementById("email");
    const value = input.value.trim();
    if (!value || Validator.check("email", value)) return true;

    if (Users.find(value)) {
        markError(input, "An account with this email already exists");
        showToast("This email is already registered. Try signing in instead.", "warning");
        return false;
    }
    return true;
}

function checkDuplicateMobile() {
    const input = document.getElementById("mobile");
    const value = input.value.trim();
    if (!value || Validator.check("mobile", value)) return true;

    if (Users.find(value)) {
        markError(input, "An account with this mobile number already exists");
        showToast("This mobile number is already registered.", "warning");
        return false;
    }
    return true;
}

function markError(input, message) {
    input.classList.add("is-invalid");
    input.classList.remove("is-valid");
    const err = document.getElementById(input.id + "Error");
    if (err) err.textContent = message;
}

// ---------- Submit ----------

function registerUser() {

    const btn = document.getElementById("registerBtn");
    if (btn.disabled) return;

    if (!Validator.validateForm("#registerForm")) return;

    if (!checkDuplicateEmail() || !checkDuplicateMobile()) {
        document.getElementById("email").scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }

    const role = document.getElementById("selectedRole").value;
    const isFarmer = role === "Farmer";
    const fullName = document.getElementById("fullName").value.trim().replace(/\s+/g, " ");

    const user = {
        name: isFarmer ? fullName : document.getElementById("orgName").value.trim(),
        contactPerson: fullName,
        email: document.getElementById("email").value.trim().toLowerCase(),
        mobile: document.getElementById("mobile").value.trim(),
        role: role,
        state: document.getElementById("state").value,
        pincode: document.getElementById("pincode").value.trim(),
        gstin: isFarmer ? "" : document.getElementById("gstin").value.trim().toUpperCase(),
        aadhaarLast4: isFarmer ? document.getElementById("aadhaar").value.trim().slice(-4) : "",
        password: document.getElementById("password").value,
        securityQuestion: document.getElementById("securityQuestion").value,
        securityAnswer: document.getElementById("securityAnswer").value.trim().toLowerCase(),
        documentName: document.getElementById("document").files[0].name,
        status: "Pending",
        registeredOn: new Date().toISOString().slice(0, 10)
    };

    Users.add(user);

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account...';

    showToast("Account created for " + user.name + ". Redirecting to login...", "success", {
        title: "Registration successful",
        duration: 1800
    });

    setTimeout(() => {
        Toast.redirect(
            "login.html",
            "Your documents have been submitted for verification. You can sign in now.",
            "info"
        );
    }, 1800);
}
