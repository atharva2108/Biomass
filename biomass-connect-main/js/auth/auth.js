// =========================================================
// LOGIN
// Validation rules live on the inputs (data-rules) — see validation.js
// =========================================================

const MAX_ATTEMPTS = 3;
const LOCK_SECONDS = 30;
let failedAttempts = 0;

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("loginForm");

    // remembered username
    const remembered = localStorage.getItem("bc_remember_user");
    if (remembered) {
        document.getElementById("username").value = remembered;
        document.getElementById("rememberMe").checked = true;
    }

    // already signed in? offer to continue
    const role = localStorage.getItem("role");
    if (localStorage.getItem("isLoggedIn") === "true" && ROLE_HOME[role] && !sessionStorage.getItem("bc_flash_toast")) {
        showToast("You are already signed in as " + role + ". Sign in again to switch accounts.", "info");
    }

    form.addEventListener("submit", e => {
        e.preventDefault();
        login();
    });

    // demo account quick-fill
    document.querySelectorAll(".demo-fill").forEach(cell => {
        cell.addEventListener("click", () => {
            document.getElementById("username").value = cell.dataset.user;
            document.getElementById("password").value = cell.dataset.pass;
            Validator.reset(form);
            showToast("Demo credentials filled in. Click Sign in.", "info");
        });
    });

    initCapsLockHint("password");
});

function login() {

    const btn = document.getElementById("loginBtn");
    if (btn.disabled) return;

    if (!Validator.validateForm("#loginForm")) return;

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    const user = Users.find(username);

    if (!user || user.password !== password) {
        failedAttempts++;
        const left = MAX_ATTEMPTS - failedAttempts;

        if (left <= 0) {
            lockLogin(btn);
            return;
        }

        showToast(
            "Invalid email/mobile or password. " + left + " attempt" + (left === 1 ? "" : "s") + " left.",
            "error",
            { title: "Login failed" }
        );
        document.getElementById("password").value = "";
        document.getElementById("password").focus();
        return;
    }

    if (user.status === "Blocked") {
        showToast("Your account has been blocked by the administrator. Please contact support.", "error", { title: "Account blocked" });
        return;
    }

    if (user.status === "Rejected") {
        showToast("Your registration was rejected. Please contact support or register again.", "error", { title: "Registration rejected" });
        return;
    }

    failedAttempts = 0;

    // remember me
    if (document.getElementById("rememberMe").checked) {
        localStorage.setItem("bc_remember_user", username);
    } else {
        localStorage.removeItem("bc_remember_user");
    }

    // session
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("role", user.role);
    localStorage.setItem("bc_current_user", JSON.stringify({ name: user.name, email: user.email, role: user.role }));

    // make the topbar show the signed-in user's name
    const profileKey = "bc_profile_" + ROLE_KEY[user.role];
    let profile = null;
    try { profile = JSON.parse(localStorage.getItem(profileKey)); } catch (e) { profile = null; }
    if (!profile || profile.email !== user.email) {
        localStorage.setItem(profileKey, JSON.stringify({ name: user.name, email: user.email, mobile: user.mobile }));
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';

    const message = user.status === "Pending"
        ? "Welcome, " + user.name + "! Your documents are pending admin verification."
        : "Welcome back, " + user.name + "!";

    showToast("Login successful. Redirecting to your dashboard...", "success", { duration: 1200 });

    setTimeout(() => {
        Toast.redirect(ROLE_HOME[user.role], message, user.status === "Pending" ? "info" : "success");
    }, 1200);
}

function lockLogin(btn) {
    let remaining = LOCK_SECONDS;
    btn.disabled = true;

    showToast(
        "Too many failed attempts. Please wait " + LOCK_SECONDS + " seconds or reset your password.",
        "warning",
        { title: "Login temporarily locked", duration: 5000 }
    );

    const original = 'Sign in <i class="fa-solid fa-arrow-right"></i>';
    const timer = setInterval(() => {
        remaining--;
        btn.textContent = "Try again in " + remaining + "s";
        if (remaining <= 0) {
            clearInterval(timer);
            failedAttempts = 0;
            btn.disabled = false;
            btn.innerHTML = original;
            showToast("You can try signing in again.", "info");
        }
    }, 1000);
    btn.textContent = "Try again in " + remaining + "s";
}
