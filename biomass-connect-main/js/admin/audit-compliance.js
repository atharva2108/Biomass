// =========================
// ADMIN — AUDIT & COMPLIANCE (US043)
// Audit log viewer + Government Norms Compliance Certificates that the
// admin issues to coal power plants (shared Store "certificates").
// =========================

const LOGS_KEY = "admin_audit_logs";
const CERTS_KEY = "certificates";
const CERT_TITLE = "Government Norms Compliance Certificate";
const LOG_PAGE = 15;

let logLimit = LOG_PAGE;

document.addEventListener("DOMContentLoaded", () => {

    // tabs
    document.querySelectorAll("#sectionTabs .tab").forEach(tab =>
        tab.addEventListener("click", () => showPanel(tab.dataset.panel)));
    if (location.hash === "#certificates") showPanel("certPanel");

    // audit log filters
    fillModules();
    document.getElementById("logSearch").addEventListener("input", resetAndRenderLogs);
    document.getElementById("logRole").addEventListener("change", resetAndRenderLogs);
    document.getElementById("logModule").addEventListener("change", resetAndRenderLogs);
    ["logFrom", "logTo"].forEach(id => document.getElementById(id).addEventListener("change", onLogDateChange));
    document.getElementById("logFilters").addEventListener("submit", e => e.preventDefault());
    document.getElementById("clearLogFilters").addEventListener("click", clearLogFilters);
    document.getElementById("moreLogsBtn").addEventListener("click", () => { logLimit += LOG_PAGE; renderLogs(); });

    // certificates
    fillPlants();
    const form = document.getElementById("certForm");
    form.addEventListener("submit", issueCertificate);
    form.addEventListener("reset", () => setTimeout(resetCertForm, 0));
    document.getElementById("certIssue").addEventListener("change", updateCertNo);
    resetCertForm();

    renderKpis();
    renderLogs();
    renderCerts();
});

function showPanel(id) {
    document.querySelectorAll("#sectionTabs .tab").forEach(t => t.classList.toggle("active", t.dataset.panel === id));
    document.getElementById("logsPanel").classList.toggle("hidden", id !== "logsPanel");
    document.getElementById("certPanel").classList.toggle("hidden", id !== "certPanel");
    history.replaceState(null, "", id === "certPanel" ? "#certificates" : location.pathname + location.search);
}

function renderKpis() {
    const logs = Admin.get(LOGS_KEY);
    const certs = Store.get(CERTS_KEY);
    const since = Store.iso(-30);
    const today = Store.iso(0);

    document.getElementById("kpiLogs").textContent = logs.filter(l => l.timestamp.slice(0, 10) >= since).length;
    document.getElementById("kpiAdminToday").textContent = logs.filter(l => l.role === "Admin" && l.timestamp.slice(0, 10) === today).length;
    document.getElementById("kpiCerts").textContent = certs.length;
    document.getElementById("kpiValid").textContent = certs.filter(c => certStatus(c) === "Valid").length;
}

/* =========================
   AUDIT LOGS
========================= */

function fillModules() {
    const known = ["Authentication", "Users", "Verification", "Orders", "Disputes", "Listings", "Compliance", "Settings"];
    const modules = [...new Set(known.concat(Admin.get(LOGS_KEY).map(l => l.module)))].filter(Boolean).sort();
    document.getElementById("logModule").insertAdjacentHTML("beforeend",
        modules.map(m => `<option>${Store.esc(m)}</option>`).join(""));
}

function logDateRange() {
    const from = document.getElementById("logFrom");
    const to = document.getElementById("logTo");
    const okFrom = Validator.validateField(from);
    const okTo = Validator.validateField(to);
    return { from: okFrom ? from.value : "", to: okFrom && okTo ? to.value : "", valid: okFrom && okTo };
}

function onLogDateChange() {
    if (!logDateRange().valid) showToast("Fix the highlighted date range to filter the log", "error", { title: "Invalid date range" });
    resetAndRenderLogs();
}

function filteredLogs() {
    const q = document.getElementById("logSearch").value.trim().toLowerCase();
    const role = document.getElementById("logRole").value;
    const mod = document.getElementById("logModule").value;
    const { from, to } = logDateRange();

    return Admin.get(LOGS_KEY)
        .filter(l => {
            const day = l.timestamp.slice(0, 10);
            return (role === "All" || l.role === role) &&
                (mod === "All" || l.module === mod) &&
                (!from || day >= from) &&
                (!to || day <= to) &&
                (!q || [l.user, l.action, l.id].some(v => String(v || "").toLowerCase().includes(q)));
        })
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function resetAndRenderLogs() {
    logLimit = LOG_PAGE;
    renderLogs();
}

function renderLogs() {
    const list = filteredLogs();
    const table = document.getElementById("logTable");
    const more = document.getElementById("moreLogsBtn");

    document.getElementById("logCount").textContent =
        list.length + (list.length === 1 ? " entry" : " entries") + (list.length > logLimit ? " · showing " + logLimit : "");
    more.classList.toggle("hidden", list.length <= logLimit);

    if (!list.length) {
        table.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fa-solid fa-clipboard-list"></i>No log entries match your filters</div></td></tr>`;
        return;
    }

    table.innerHTML = list.slice(0, logLimit).map(l => `
        <tr>
            <td class="nowrap">${Admin.dateTime(l.timestamp)}</td>
            <td class="fw-600">${Store.esc(l.user)}</td>
            <td>${Store.esc(l.role)}</td>
            <td>${Store.esc(l.action)}</td>
            <td><span class="badge">${Store.esc(l.module)}</span></td>
        </tr>
    `).join("");
}

function clearLogFilters() {
    const form = document.getElementById("logFilters");
    form.reset();
    Validator.reset(form);
    resetAndRenderLogs();
    showToast("Filters cleared", "info");
}

/* =========================
   COMPLIANCE CERTIFICATES
========================= */

function fillPlants() {
    const plants = [...new Set(Admin.get("admin_users")
        .filter(u => u.role === "Power Plant" && u.status === "Active")
        .map(u => u.name))].sort();
    document.getElementById("certPlant").insertAdjacentHTML("beforeend",
        plants.map(p => `<option>${Store.esc(p)}</option>`).join(""));
}

function certStatus(c) {
    return c.validUntil >= Store.iso(0) ? "Valid" : "Expired";
}

// e.g. BC/GN/2026/1002 — year of issue + running number
function nextCertNo() {
    const issue = document.getElementById("certIssue").value;
    const year = /^\d{4}-/.test(issue) ? issue.slice(0, 4) : String(new Date().getFullYear());
    const num = Store.nextId(CERTS_KEY).replace(/^\D+/, "");
    return "BC/GN/" + year + "/" + num;
}

function updateCertNo() {
    document.getElementById("certNo").value = nextCertNo();
}

function resetCertForm() {
    Validator.reset(document.getElementById("certForm"));
    document.getElementById("certIssue").value = Store.iso(0);
    updateCertNo();
}

function issueCertificate(e) {
    e.preventDefault();
    if (!Validator.validateForm("#certForm")) return;

    const cert = Store.add(CERTS_KEY, {
        certificateNo: nextCertNo(),
        plant: document.getElementById("certPlant").value,
        title: CERT_TITLE,
        issueDate: document.getElementById("certIssue").value,
        validUntil: document.getElementById("certValid").value,
        remarks: document.getElementById("certRemarks").value.trim(),
        issuedBy: Admin.adminName()
    });
    Admin.log("Issued compliance certificate " + cert.certificateNo + " to " + cert.plant, "Compliance");

    document.getElementById("certForm").reset();
    resetCertForm();
    renderKpis();
    renderLogs();
    renderCerts();
    showToast("Certificate " + cert.certificateNo + " issued to " + cert.plant, "success");
}

function renderCerts() {
    const list = Store.get(CERTS_KEY).slice().sort((a, b) => String(b.issueDate).localeCompare(String(a.issueDate)));
    const table = document.getElementById("certTable");
    document.getElementById("certCount").textContent = list.length + (list.length === 1 ? " certificate" : " certificates");

    if (!list.length) {
        table.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-certificate"></i>No certificates issued yet</div></td></tr>`;
        return;
    }

    table.innerHTML = list.map(c => `
        <tr>
            <td class="fw-600 nowrap">${Store.esc(c.certificateNo || c.id)}</td>
            <td>${Store.esc(c.plant)}</td>
            <td class="nowrap">${Store.date(c.issueDate)}</td>
            <td class="nowrap">${Store.date(c.validUntil)}</td>
            <td>${Store.statusBadge(certStatus(c))}</td>
            <td>${Store.esc(c.issuedBy || "—")}</td>
            <td>${Store.esc(c.remarks || "—")}</td>
        </tr>
    `).join("");
}
