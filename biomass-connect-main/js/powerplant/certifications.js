// =========================
// COMPLIANCE CERTIFICATE (US035)
// View-only. Admin issues the Government Norms Compliance Certificate
// to a power plant; it lives in the shared Store "certificates" collection:
//   { id, certificateNo, plant, title, issueDate, validUntil, remarks, issuedBy }
// Status (Valid / Expired) is computed from validUntil, not stored.
// =========================

document.addEventListener("DOMContentLoaded", renderCertificates);

function statusOf(cert) {
    return cert.validUntil && Plant.daysUntil(cert.validUntil) >= 0 ? "Valid" : "Expired";
}

function certificates() {
    return Store.get("certificates")
        .filter(c => c.plant === Plant.NAME)
        .sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || ""));
}

function validityNote(cert) {
    if (!cert.validUntil) return "";
    const days = Plant.daysUntil(cert.validUntil);
    if (days < 0) return `expired ${-days} day${days === -1 ? "" : "s"} ago`;
    if (days === 0) return "expires today";
    return `${days} day${days === 1 ? "" : "s"} remaining`;
}

function renderCertificates() {
    const list = certificates();
    const el = document.getElementById("certList");

    if (!list.length) {
        el.innerHTML = `
            <section class="card">
                <div class="empty-state"><i class="fa-solid fa-certificate"></i>Admin has not issued your compliance certificate yet.</div>
            </section>`;
        return;
    }

    el.innerHTML = list.map(c => {
        const status = statusOf(c);
        const note = validityNote(c);
        return `
        <section class="card">
            <div class="card-header">
                <div class="cert-heading">
                    <span class="cert-icon"><i class="fa-solid fa-award"></i></span>
                    <div>
                        <div class="card-title">${Store.esc(c.title || "Government Norms Compliance Certificate")}</div>
                        <div class="card-subtitle">Issued to ${Store.esc(c.plant)}</div>
                    </div>
                </div>
                ${Store.statusBadge(status)}
            </div>
            <div class="card-body">
                <dl class="detail-list">
                    <div><dt>Certificate No.</dt><dd>${Store.esc(c.certificateNo || "—")}</dd></div>
                    <div><dt>Issue Date</dt><dd>${Store.date(c.issueDate)}</dd></div>
                    <div><dt>Valid Until</dt><dd>${Store.date(c.validUntil)}${note ? ` <small class="text-muted">(${note})</small>` : ""}</dd></div>
                    <div><dt>Issued By</dt><dd>${Store.esc(c.issuedBy || "—")}</dd></div>
                    <div class="span-full"><dt>Remarks</dt><dd>${Store.esc(c.remarks || "—")}</dd></div>
                </dl>
            </div>
        </section>`;
    }).join("");
}
