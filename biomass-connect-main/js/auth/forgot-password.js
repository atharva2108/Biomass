// =========================================================
// FORGOT PASSWORD (US004) — reset via security question
// =========================================================

const MAX_ANSWER_ATTEMPTS = 3;
let account = null;
let answerAttempts = 0;

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("findForm").addEventListener("submit", e => {
        e.preventDefault();
        findAccount();
    });

    document.getElementById("resetForm").addEventListener("submit", e => {
        e.preventDefault();
        resetPassword();
    });

    document.getElementById("backBtn").addEventListener("click", () => showStep(1));

    initStrengthMeter("newPassword", "strengthMeter");
});

function showStep(step) {
    document.getElementById("findForm").classList.toggle("hidden", step !== 1);
    document.getElementById("resetForm").classList.toggle("hidden", step !== 2);

    document.getElementById("step1Indicator").className = "step " + (step === 1 ? "current" : "done");
    document.getElementById("step2Indicator").className = "step" + (step === 2 ? " current" : "");

    if (step === 1) {
        account = null;
        Validator.reset("#resetForm");
        document.getElementById("resetForm").reset();
        document.getElementById("username").focus();
    } else {
        document.getElementById("securityAnswer").focus();
    }
}

// ---------- Step 1 ----------

function findAccount() {

    if (!Validator.validateForm("#findForm")) return;

    const username = document.getElementById("username").value.trim();
    const user = Users.find(username);

    if (!user) {
        showToast("No account is registered with this email or mobile number.", "error", { title: "Account not found" });
        return;
    }

    if (user.status === "Blocked") {
        showToast("This account is blocked. Please contact support to reset your password.", "error", { title: "Account blocked" });
        return;
    }

    if (!user.securityQuestion) {
        showToast("No security question is set for this account. Please contact support.", "warning");
        return;
    }

    account = user;
    answerAttempts = 0;
    document.getElementById("questionText").textContent = user.securityQuestion;
    showStep(2);
    showToast("Account found. Answer your security question to continue.", "info");
}

// ---------- Step 2 ----------

function resetPassword() {

    if (!account) {
        showStep(1);
        return;
    }

    if (!Validator.validateForm("#resetForm")) return;

    const answer = document.getElementById("securityAnswer").value.trim().toLowerCase();
    const newPassword = document.getElementById("newPassword").value;

    if (answer !== String(account.securityAnswer || "").toLowerCase()) {
        answerAttempts++;
        const left = MAX_ANSWER_ATTEMPTS - answerAttempts;

        if (left <= 0) {
            showToast("Too many incorrect answers. Please start again or contact support.", "error", { title: "Verification failed" });
            showStep(1);
            return;
        }

        const input = document.getElementById("securityAnswer");
        input.classList.add("is-invalid");
        document.getElementById("securityAnswerError").textContent = "Incorrect answer";
        showToast("Security answer is incorrect. " + left + " attempt" + (left === 1 ? "" : "s") + " left.", "error");
        input.focus();
        return;
    }

    if (newPassword === account.password) {
        const input = document.getElementById("newPassword");
        input.classList.add("is-invalid");
        document.getElementById("newPasswordError").textContent = "New password must be different from your current password";
        showToast("Please choose a password you haven't used before.", "warning");
        return;
    }

    Users.update(account.email, { password: newPassword });

    const btn = document.getElementById("resetBtn");
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resetting...';

    showToast("Your password has been updated.", "success", { title: "Password reset", duration: 1500 });

    setTimeout(() => {
        Toast.redirect("login.html", "Password reset successful. Please sign in with your new password.", "success");
    }, 1500);
}
