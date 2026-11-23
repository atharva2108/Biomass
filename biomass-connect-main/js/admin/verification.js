// =========================
// ADMIN — REGISTRATION VERIFICATION
// Shared by farmer-verification (US039), powerplant-verification (US040)
// and manufacturer-verification (US041).
// The page sets <body data-verify-role="farmer|manufacturer|powerplant">.
// Each applicant submits ONE document: Aadhaar card (farmer) or
// GST certificate (manufacturer / power plant).
// =========================

const VERIFY_KEY = "admin_verifications";

const VERIFY_CONFIG = {
    farmer: {
        label: "Farmer",
        idLabel: "Aadhaar No.",
        locationLabel: "Village / Taluka",
        checks: [
            "Aadhaar card is clear and readable",
            "Name and Aadhaar number match the registration details"
        ]
    },
    manufacturer: {
        label: "Manufacturer",
        idLabel: "GSTIN",
        locationLabel: "Factory Location",
        checks: [
            "GST certificate is clear and readable",
            "Business name and GSTIN match the registration details"
        ]
    },
    powerplant: {
        label: "Power Plant",
        idLabel: "GSTIN",
        locationLabel: "Plant Location",
        checks: [
            "GST certificate is clear and readable",
            "Plant name and GSTIN match the registration details"
        ]
    }
};

const ROLE = document.body.dataset.verifyRole || "farmer";
const CFG = VERIFY_CONFIG[ROLE];

let activeTab = "Pending";
let reviewingId = null;

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("idColumn").textContent = CFG.idLabel;

    document.querySelectorAll("#statusTabs .tab").forEach(tab =>
        tab.addEventListener("click", () => {
            activeTab = tab.dataset.status;
            renderTable();
        }));

    document.getElementById("searchInput").addEventListener("input", renderTable);
    document.getElementById("verifyTable").addEventListener("click", e => {
        const btn = e.target.closest("[data-review]");
        if (btn) openReview(btn.dataset.review);
    });
    document.getElementById("reviewModal").addEventListener("click", onReviewClick);
    document.getElementById("rejectForm").addEventListener("submit", rejectApplication);

    renderTable();

    // deep link from the dashboard queue: ?id=VER-1001
    const id = new URLSearchParams(location.search).get("id");
    if (id) {
        const v = Store.find(VERIFY_KEY, id);
        if (v && v.role === ROLE) openReview(id);
        else showToast("Verification request " + id + " was not found", "warning");
    }
});

/* ---------- list ---------- */

function applications() {
    return Admin.get(VERIFY_KEY).filter(v => v.role === ROLE);
}

function renderTable() {
    const all = applications();
    const count = s => all.filter(v => v.status === s).length;

    document.getElementById("kpiPending").textContent = count("Pending");
    document.getElementById("kpiApproved").textContent = count("Approved");
    document.getElementById("kpiRejected").textContent = count("Rejected");
    document.getElementById("kpiTotal").textContent = all.length;

    document.querySelectorAll("#statusTabs .tab").forEach(tab => {
        const s = tab.dataset.status;
        tab.classList.toggle("active", s === activeTab);
        tab.querySelector(".count").textContent = s === "All" ? all.length : count(s);
    });

    const q = document.getElementById("searchInput").value.trim().toLowerCase();
    const list = all
        .filter(v => activeTab === "All" || v.status === activeTab)
        .filter(v => !q || [v.name, v.email, v.mobile, v.id, v.district, v.location, v.docNumber]
            .some(x => String(x || "").toLowerCase().includes(q)))
        .sort((a, b) => activeTab === "Pending"
            ? a.submitted.localeCompare(b.submitted)
            : b.submitted.localeCompare(a.submitted));

    const table = document.getElementById("verifyTable");

    if (!list.length) {
        const msg = q ? "No applications match your search" :
            activeTab === "Pending" ? "No pending " + CFG.label.toLowerCase() + " registrations — you're all caught up" :
            "No " + activeTab.toLowerCase() + " applications";
        table.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-folder-open"></i>${Store.esc(msg)}</div></td></tr>`;
        return;
    }

    table.innerHTML = list.map(v => `
        <tr>
            <td>
                <div class="fw-600">${Store.esc(v.name)}</div>
                <small class="text-muted">${Store.esc(v.id)}</small>
            </td>
            <td>
                <div>${Store.esc(v.email)}</div>
                <small class="text-muted">${Store.esc(v.mobile)}</small>
            </td>
            <td>${Store.esc(v.district)}, ${Store.esc(v.state)}</td>
            <td>${Store.esc(v.docNumber || "—")}</td>
            <td>${Store.date(v.submitted)}</td>
            <td>${Store.statusBadge(v.status)}</td>
            <td class="text-right">
                <button class="btn ${v.status === "Pending" ? "btn-primary" : "btn-secondary"} btn-sm" type="button" data-review="${Store.esc(v.id)}">
                    ${v.status === "Pending" ? "Review" : "View"}
                </button>
            </td>
        </tr>
    `).join("");
}

/* ---------- review modal ---------- */

function docIcon(file) {
    return /\.pdf$/i.test(file || "") ? "fa-file-pdf" : "fa-file-image";
}

function openReview(id) {
    const v = Store.find(VERIFY_KEY, id);
    if (!v) return showToast("Application not found", "error");
    reviewingId = id;

    const pending = v.status === "Pending";
    const fields = [
        [CFG.idLabel, v.docNumber],
        [CFG.locationLabel, v.location],
        ["District", v.district],
        ["State", v.state]
    ];

    document.getElementById("reviewTitle").textContent = CFG.label + " Application · " + v.id;
    document.getElementById("reviewBody").innerHTML = `
        <div class="applicant-head">
            <span class="avatar avatar-lg">${Store.esc(Admin.initials(v.name))}</span>
            <div>
                <div class="fw-600">${Store.esc(v.name)}</div>
                <small class="text-muted">${Store.esc(v.email)} · ${Store.esc(v.mobile)}</small>
            </div>
            <div class="applicant-status">
                ${Store.statusBadge(v.status)}
                <small class="text-muted">Submitted ${Store.date(v.submitted)}</small>
            </div>
        </div>

        <dl class="detail-list">
            ${fields.map(([label, value]) => `<div><dt>${Store.esc(label)}</dt><dd>${Store.esc(value || "—")}</dd></div>`).join("")}
        </dl>

        <h4 class="section-title">Submitted Document</h4>
        <div class="doc-preview">
            <div class="doc-sheet">
                <i class="fa-solid ${docIcon(v.docFile)}"></i>
                <strong>${Store.esc(v.docType || "Document")}</strong>
                <span>${Store.esc(v.docNumber || "")}</span>
                <div class="doc-lines"><span></span><span></span><span></span><span></span></div>
            </div>
            <small class="text-muted">Preview placeholder · ${Store.esc(v.docFile || "—")}${v.docSize ? " · " + Store.esc(v.docSize) : ""}</small>
        </div>

        ${pending ? `
            <h4 class="section-title">Verification Checklist</h4>
            <div class="checklist" id="checklist">
                ${CFG.checks.map((c, i) => `
                    <label class="checkbox-row"><input type="checkbox" data-novalidate id="check${i}"> ${Store.esc(c)}</label>`).join("")}
            </div>` : ""}

        ${v.status === "Approved" ? `
            <div class="note-box note-success mt-2">
                <strong>Approved on ${Store.date(v.reviewedOn)}</strong>
                <p>Verified by ${Store.esc(v.reviewedBy || "Admin")}. The account is active on the platform.</p>
            </div>` : ""}

        ${v.status === "Rejected" ? `
            <div class="note-box note-danger mt-2">
                <strong>Rejected on ${Store.date(v.reviewedOn)}${v.reasonCategory ? " · " + Store.esc(v.reasonCategory) : ""}</strong>
                <p>${Store.esc(v.reason || "No reason recorded")}</p>
            </div>` : ""}
    `;

    document.getElementById("reviewFooter").innerHTML = pending ? `
        <button class="btn btn-secondary" type="button" data-close>Close</button>
        <button class="btn btn-danger" type="button" data-verify="reject"><i class="fa-solid fa-xmark"></i> Reject</button>
        <button class="btn btn-primary" type="button" data-verify="approve"><i class="fa-solid fa-check"></i> Approve</button>
    ` : `
        <button class="btn btn-secondary" type="button" data-close>Close</button>
    `;

    Admin.openModal("reviewModal");
}

function onReviewClick(e) {
    const action = e.target.closest("[data-verify]");
    if (!action) return;
    const v = Store.find(VERIFY_KEY, reviewingId);
    if (!v) return;
    if (action.dataset.verify === "approve") approveApplication(v);
    if (action.dataset.verify === "reject") openReject(v);
}

/* ---------- approve ---------- */

function approveApplication(v) {
    const boxes = [...document.querySelectorAll("#checklist input[type=checkbox]")];
    const unchecked = boxes.filter(b => !b.checked);
    boxes.forEach(b => b.closest(".checkbox-row").classList.toggle("unchecked", !b.checked));

    if (unchecked.length) {
        showToast("Tick all " + boxes.length + " checklist items to confirm the document was verified", "warning", { title: "Checklist incomplete" });
        unchecked[0].focus();
        return;
    }

    Store.update(VERIFY_KEY, v.id, {
        status: "Approved",
        reviewedOn: Store.iso(0),
        reviewedBy: Admin.adminName(),
        reasonCategory: "", reason: ""
    });
    syncUser(v, "Active");
    Admin.log("Approved " + CFG.label.toLowerCase() + " verification " + v.id + " (" + v.name + ")", "Verification");

    Admin.closeModal("reviewModal");
    renderTable();
    showToast(v.name + " has been verified and activated", "success");
}

/* ---------- reject ---------- */

function openReject(v) {
    const form = document.getElementById("rejectForm");
    form.reset();
    Validator.reset(form);
    document.getElementById("rejectIntro").textContent =
        "Tell " + v.name + " why the registration was rejected so they can correct and resubmit their " + (v.docType || "document") + ".";
    Admin.closeModal("reviewModal");
    Admin.openModal("rejectModal");
}

async function rejectApplication(e) {
    e.preventDefault();
    if (!Validator.validateForm("#rejectForm")) return;

    const v = Store.find(VERIFY_KEY, reviewingId);
    if (!v) return showToast("Application not found", "error");

    const ok = await confirmDialog({
        title: "Reject " + v.name + "?",
        message: "The applicant will be notified with your reason and must resubmit the document to register.",
        confirmText: "Reject Application",
        danger: true
    });
    if (!ok) return;

    Store.update(VERIFY_KEY, v.id, {
        status: "Rejected",
        reviewedOn: Store.iso(0),
        reviewedBy: Admin.adminName(),
        reasonCategory: document.getElementById("rejectCategory").value,
        reason: document.getElementById("rejectReason").value.trim()
    });
    syncUser(v, "Rejected");
    Admin.log("Rejected " + CFG.label.toLowerCase() + " verification " + v.id + " (" + v.name + ")", "Verification");

    Admin.closeModal("rejectModal");
    renderTable();
    showToast(v.name + "'s registration was rejected", "success");
}

/* ---------- keep User Management in sync ---------- */

function syncUser(v, status) {
    const users = Admin.get("admin_users");
    const existing = users.find(u => u.email.toLowerCase() === v.email.toLowerCase());
    if (existing) {
        if (existing.status !== "Blocked") Store.update("admin_users", existing.id, { status });
        return;
    }
    Store.add("admin_users", {
        name: v.name, role: CFG.label, email: v.email, mobile: v.mobile,
        location: v.district, state: v.state, status, joined: v.submitted
    }, "USR-");
}
