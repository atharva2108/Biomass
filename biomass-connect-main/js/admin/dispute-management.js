// =========================
// ADMIN — DISPUTE MANAGEMENT (US042)
// Complaints raised by farmers, manufacturers and power plants
// (shared Store "complaints" collection). Admin can view and resolve.
// =========================

const COMPLAINTS_KEY = "complaints";

let activeTab = "Open";
let resolvingId = null;

document.addEventListener("DOMContentLoaded", () => {

    fillCategories();

    document.querySelectorAll("#statusTabs .tab").forEach(tab =>
        tab.addEventListener("click", () => { activeTab = tab.dataset.status; render(); }));

    document.getElementById("searchInput").addEventListener("input", render);
    document.getElementById("categoryFilter").addEventListener("change", render);
    document.getElementById("disputeTable").addEventListener("click", onAction);
    document.getElementById("viewFooter").addEventListener("click", onAction);
    document.getElementById("resolveForm").addEventListener("submit", resolveComplaint);

    // deep link from the dashboard: ?id=CMP-1003
    const id = new URLSearchParams(location.search).get("id");
    const linked = id ? Store.find(COMPLAINTS_KEY, id) : null;
    if (linked && linked.status === "Resolved") activeTab = "Resolved";

    render();

    if (id) {
        if (linked) viewComplaint(id);
        else showToast("Complaint " + id + " was not found", "warning");
    }
});

/* ---------- helpers ---------- */

function complaints() {
    return Store.get(COMPLAINTS_KEY).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function roleLabel(c) {
    return Admin.ROLE_LABEL[c.role] || c.role || "";
}

function fillCategories() {
    const known = Object.values(Store.COMPLAINT_CATEGORIES).flat();
    const cats = [...new Set(known.concat(complaints().map(c => c.category)).filter(Boolean))].sort();
    document.getElementById("categoryFilter").insertAdjacentHTML("beforeend",
        cats.map(c => `<option>${Store.esc(c)}</option>`).join(""));
}

/* ---------- list ---------- */

function filtered(all) {
    const q = document.getElementById("searchInput").value.trim().toLowerCase();
    const cat = document.getElementById("categoryFilter").value;

    return all.filter(c =>
        (activeTab === "All" || c.status === activeTab) &&
        (cat === "All" || c.category === cat) &&
        (!q || [c.id, c.orderId, c.raisedBy, c.against].some(v => String(v || "").toLowerCase().includes(q)))
    );
}

function render() {
    const all = complaints();
    const count = s => all.filter(c => c.status === s).length;

    document.querySelectorAll("#statusTabs .tab").forEach(tab => {
        const s = tab.dataset.status;
        tab.classList.toggle("active", s === activeTab);
        tab.querySelector(".count").textContent = s === "All" ? all.length : count(s);
    });

    const list = filtered(all);
    const table = document.getElementById("disputeTable");

    if (!list.length) {
        const msg = activeTab === "Open" && !count("Open") ? "No open complaints — you're all caught up" : "No complaints match your filters";
        table.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-scale-balanced"></i>${msg}</div></td></tr>`;
        return;
    }

    table.innerHTML = list.map(c => `
        <tr>
            <td class="fw-600">${Store.esc(c.id)}</td>
            <td>
                <div>${Store.esc(c.raisedBy)}</div>
                <small class="text-muted">${Store.esc(roleLabel(c))}</small>
            </td>
            <td>${Store.esc(c.against || "—")}</td>
            <td>${Store.esc(c.orderId || "—")}</td>
            <td>${Store.esc(c.category)}</td>
            <td>${Store.date(c.date)}</td>
            <td>${Store.statusBadge(c.status)}</td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-secondary btn-sm btn-icon" type="button" data-action="view" data-id="${Store.esc(c.id)}" title="View complaint" aria-label="View ${Store.esc(c.id)}"><i class="fa-solid fa-eye"></i></button>
                    ${c.status !== "Resolved" ? `<button class="btn btn-primary btn-sm" type="button" data-action="resolve" data-id="${Store.esc(c.id)}">Resolve</button>` : ""}
                </div>
            </td>
        </tr>
    `).join("");
}

function onAction(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === "view") return viewComplaint(id);
    if (btn.dataset.action === "resolve") {
        Admin.closeModal("viewModal");
        openResolve(id);
    }
}

/* ---------- view ---------- */

function viewComplaint(id) {
    const c = Store.find(COMPLAINTS_KEY, id);
    if (!c) return showToast("Complaint not found", "error");

    const order = c.orderId ? Admin.allOrders().find(o => o.id === c.orderId) : null;

    document.getElementById("viewTitle").textContent = "Complaint " + c.id;
    document.getElementById("viewBody").innerHTML = `
        <dl class="detail-list">
            <div><dt>Raised By</dt><dd>${Store.esc(c.raisedBy)} <small class="text-muted">(${Store.esc(roleLabel(c))})</small></dd></div>
            <div><dt>Against</dt><dd>${Store.esc(c.against || "—")}</dd></div>
            <div><dt>Order</dt><dd>${Store.esc(c.orderId || "—")}${order ? " · " + Store.inr(order.total) : ""}</dd></div>
            <div><dt>Category</dt><dd>${Store.esc(c.category)}</dd></div>
            ${order ? `
                <div><dt>Order Status</dt><dd>${Store.statusBadge(order.status)}</dd></div>
                <div><dt>Payment</dt><dd>${Store.statusBadge(order.paymentStatus)}</dd></div>` : ""}
            <div><dt>Raised On</dt><dd>${Store.date(c.date)}</dd></div>
            <div><dt>Status</dt><dd>${Store.statusBadge(c.status)}</dd></div>
        </dl>

        <h4 class="section-title">Complaint</h4>
        <p class="dispute-desc">${Store.esc(c.description)}</p>

        ${c.status === "Resolved" ? `
            <div class="note-box mt-2">
                <strong>Resolved on ${Store.date(c.resolvedOn)}</strong>
                <p>${Store.esc(c.resolution || "No resolution recorded")}</p>
            </div>` : ""}
    `;

    document.getElementById("viewFooter").innerHTML = `
        <button class="btn btn-secondary" type="button" data-close>Close</button>
        ${c.status !== "Resolved" ? `<button class="btn btn-primary" type="button" data-action="resolve" data-id="${Store.esc(c.id)}"><i class="fa-solid fa-check"></i> Resolve</button>` : ""}
    `;

    Admin.openModal("viewModal");
}

/* ---------- resolve ---------- */

function openResolve(id) {
    const c = Store.find(COMPLAINTS_KEY, id);
    if (!c) return showToast("Complaint not found", "error");
    if (c.status === "Resolved") return showToast(c.id + " is already resolved", "warning");

    resolvingId = id;
    const form = document.getElementById("resolveForm");
    form.reset();
    Validator.reset(form);
    document.getElementById("resolveTitle").textContent = "Resolve " + c.id;
    document.getElementById("resolveIntro").textContent =
        c.raisedBy + " vs " + (c.against || "—") + " · " + c.category + (c.orderId ? " on order " + c.orderId : "");
    Admin.openModal("resolveModal");
}

async function resolveComplaint(e) {
    e.preventDefault();
    if (!Validator.validateForm("#resolveForm")) return;

    const c = Store.find(COMPLAINTS_KEY, resolvingId);
    if (!c) return showToast("Complaint not found", "error");

    const ok = await confirmDialog({
        title: "Resolve " + c.id + "?",
        message: c.raisedBy + " will see your resolution and the complaint will be closed.",
        confirmText: "Resolve"
    });
    if (!ok) return;

    Store.update(COMPLAINTS_KEY, c.id, {
        status: "Resolved",
        resolution: document.getElementById("resolutionText").value.trim(),
        resolvedOn: Store.iso(0)
    });
    Admin.log("Resolved complaint " + c.id, "Disputes");

    Admin.closeModal("resolveModal");
    render();
    showToast(c.id + " has been resolved", "success");
}
