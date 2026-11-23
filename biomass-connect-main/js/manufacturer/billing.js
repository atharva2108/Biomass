// =========================
// BILLING & COMPLAINTS (US026)
// Payables:    delivered purchaseOrders (biomass bought from farmers) —
//              the manufacturer marks them as paid (paymentStatus / paidOn).
// Receivables: delivered pelletOrders — view only, the power plant pays.
// Complaints:  shared "complaints" collection, resolved by Admin.
// =========================

const MANUFACTURER = "GreenPellet Industries";

document.addEventListener("DOMContentLoaded", () => {

    bindModals();
    bindTabs();
    fillOrderOptions();
    fillCategories();

    document.addEventListener("click", e => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;
        if (btn.dataset.action === "markPaid") markPaid(btn.dataset.id);
        if (btn.dataset.action === "viewComplaint") viewComplaint(btn.dataset.id);
    });

    const form = document.getElementById("complaintForm");
    form.addEventListener("submit", e => { e.preventDefault(); submitComplaint(); });
    form.addEventListener("reset", () => setTimeout(() => {
        Validator.reset(form);
        document.getElementById("cAgainst").value = "";
        updateDescCount();
    }, 0));

    document.getElementById("cOrder").addEventListener("change", updateAgainst);
    document.getElementById("cDescription").addEventListener("input", updateDescCount);

    preselectOrder();
    renderAll();
});

function renderAll() {
    renderKpis();
    renderPayables();
    renderReceivables();
    renderComplaints();
}

/* ---------------- Data ---------------- */

function payables() {
    return sortForPayment(Store.get("purchaseOrders")
        .filter(o => o.manufacturer === MANUFACTURER && o.status === "Delivered"));
}

function receivables() {
    return sortForPayment(Store.get("pelletOrders")
        .filter(o => o.manufacturer === MANUFACTURER && o.status === "Delivered"));
}

// unpaid first, then the most recently delivered
function sortForPayment(list) {
    return list.sort((a, b) =>
        ((a.paymentStatus === "Paid") - (b.paymentStatus === "Paid")) ||
        String(b.deliveredDate).localeCompare(String(a.deliveredDate)));
}

function myComplaints() {
    return Store.get("complaints")
        .filter(c => c.raisedBy === MANUFACTURER || c.against === MANUFACTURER)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

const sum = list => list.reduce((s, o) => s + Number(o.total || 0), 0);
const isPaid = o => o.paymentStatus === "Paid";

function renderKpis() {
    const pay = payables();
    const open = myComplaints().filter(c => c.status === "Open").length;

    document.getElementById("kpiPayable").textContent = Store.inr(sum(pay.filter(o => !isPaid(o))));
    document.getElementById("kpiPaid").textContent = Store.inr(sum(pay.filter(isPaid)));
    document.getElementById("kpiReceivable").textContent = Store.inr(sum(receivables().filter(o => !isPaid(o))));
    document.getElementById("kpiComplaints").textContent = open;
    document.getElementById("complaintCount").textContent = open;
}

/* ---------------- Tabs ---------------- */

function bindTabs() {
    document.getElementById("billingTabs").addEventListener("click", e => {
        const tab = e.target.closest(".tab");
        if (!tab) return;
        showTab(tab.dataset.tab);
        history.replaceState(null, "", location.pathname + location.search + "#" + tab.dataset.tab);
    });

    const wanted = location.hash.replace("#", "") || new URLSearchParams(location.search).get("tab");
    if (["payments", "complaints"].includes(wanted)) showTab(wanted);
}

function showTab(name) {
    document.querySelectorAll("#billingTabs .tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("hidden", p.dataset.panel !== name));
}

/* ---------------- Payments ---------------- */

function emptyRow(cols, icon, text) {
    return `<tr><td colspan="${cols}"><div class="empty-state"><i class="fa-solid ${icon}"></i>${text}</div></td></tr>`;
}

function paymentCell(o) {
    return Store.statusBadge(o.paymentStatus || "Pending") +
        (isPaid(o) && o.paidOn ? `<span class="cell-sub">on ${Store.date(o.paidOn)}</span>` : "");
}

function renderPayables() {
    const list = payables();
    const table = document.getElementById("payableTable");

    if (!list.length) {
        table.innerHTML = emptyRow(6, "fa-file-invoice", "No delivered biomass orders yet.");
        return;
    }

    table.innerHTML = list.map(o => `
        <tr>
            <td class="fw-600">${Store.esc(o.id)}<span class="cell-sub">${Store.esc(o.biomassType)} · ${Store.esc(o.quantity)} t</span></td>
            <td>${Store.esc(o.farmer)}</td>
            <td>${Store.date(o.deliveredDate)}</td>
            <td class="fw-600">${Store.inr(o.total)}</td>
            <td>${paymentCell(o)}</td>
            <td>${isPaid(o) ? `<span class="text-muted">—</span>`
                : `<button class="btn btn-primary btn-sm" data-action="markPaid" data-id="${Store.esc(o.id)}"><i class="fa-solid fa-indian-rupee-sign"></i> Mark as Paid</button>`}</td>
        </tr>
    `).join("");
}

function renderReceivables() {
    const list = receivables();
    const table = document.getElementById("receivableTable");

    if (!list.length) {
        table.innerHTML = emptyRow(5, "fa-hand-holding-dollar", "No delivered pellet orders yet.");
        return;
    }

    table.innerHTML = list.map(o => `
        <tr>
            <td class="fw-600">${Store.esc(o.id)}<span class="cell-sub">${Store.esc(o.pelletType)} · ${Store.esc(o.quantity)} t</span></td>
            <td>${Store.esc(o.powerPlant)}</td>
            <td>${Store.date(o.deliveredDate)}</td>
            <td class="fw-600">${Store.inr(o.total)}</td>
            <td>${paymentCell(o)}</td>
        </tr>
    `).join("");
}

async function markPaid(id) {
    const o = Store.find("purchaseOrders", id);
    if (!o || o.manufacturer !== MANUFACTURER || o.status !== "Delivered" || isPaid(o)) {
        showToast("This order is not awaiting payment.", "info");
        return renderAll();
    }

    const ok = await confirmDialog({
        title: "Mark as paid?",
        message: "Confirm that you have paid " + Store.inr(o.total) + " to " + o.farmer + " for " + o.id + ". The farmer will see this order as paid.",
        confirmText: "Mark as Paid"
    });
    if (!ok) return;

    Store.update("purchaseOrders", id, { paymentStatus: "Paid", paidOn: Store.iso(0) });
    showToast("Payment of " + Store.inr(o.total) + " to " + o.farmer + " recorded for " + o.id + ".", "success", { title: "Marked as paid" });
    renderAll();
}

/* ---------------- Raise a complaint ---------------- */

function fillOrderOptions() {
    const pos = Store.get("purchaseOrders").filter(o => o.manufacturer === MANUFACTURER);
    const pellets = Store.get("pelletOrders").filter(o => o.manufacturer === MANUFACTURER);

    const opt = (o, party, item) =>
        `<option value="${Store.esc(o.id)}" data-party="${Store.esc(party)}">${Store.esc(o.id)} · ${Store.esc(item)} · ${Store.esc(party)} (${Store.esc(o.status)})</option>`;

    let html = "";
    if (pos.length) html += `<optgroup label="Biomass purchase orders">${pos.map(o => opt(o, o.farmer, o.biomassType)).join("")}</optgroup>`;
    if (pellets.length) html += `<optgroup label="Pellet orders">${pellets.map(o => opt(o, o.powerPlant, o.pelletType)).join("")}</optgroup>`;
    document.getElementById("cOrder").insertAdjacentHTML("beforeend", html);
}

function fillCategories() {
    document.getElementById("cCategory").insertAdjacentHTML("beforeend",
        Store.COMPLAINT_CATEGORIES.manufacturer.map(c => `<option>${Store.esc(c)}</option>`).join(""));
}

function preselectOrder() {
    const id = new URLSearchParams(location.search).get("order");
    if (!id) return;
    const select = document.getElementById("cOrder");
    if (![...select.options].some(o => o.value === id)) return;
    select.value = id;
    updateAgainst();
    showTab("complaints");
}

function updateAgainst() {
    const select = document.getElementById("cOrder");
    const opt = select.options[select.selectedIndex];
    document.getElementById("cAgainst").value = opt && opt.value ? opt.dataset.party : "";
}

function updateDescCount() {
    document.getElementById("cDescCount").textContent = document.getElementById("cDescription").value.length;
}

function submitComplaint() {
    const form = document.getElementById("complaintForm");
    if (!Validator.validateForm(form)) return;

    const orderId = document.getElementById("cOrder").value;
    const category = document.getElementById("cCategory").value;

    const duplicate = Store.get("complaints").find(c =>
        c.raisedBy === MANUFACTURER && c.orderId === orderId && c.category === category && c.status === "Open");
    if (duplicate) {
        showToast("You already have an open \"" + category + "\" complaint (" + duplicate.id + ") for " + orderId + ".", "warning");
        return;
    }

    const record = Store.add("complaints", {
        raisedBy: MANUFACTURER,
        role: "manufacturer",
        against: document.getElementById("cAgainst").value,
        orderId,
        category,
        description: document.getElementById("cDescription").value.trim(),
        status: "Open",
        date: Store.iso(0),
        resolution: "",
        resolvedOn: ""
    });

    form.reset();
    showToast("Complaint " + record.id + " submitted. The Biomass Connect team will review it.", "success", { title: "Complaint raised" });
    renderAll();
}

/* ---------------- Complaint list ---------------- */

function renderComplaints() {
    const list = myComplaints();
    const table = document.getElementById("complaintTable");

    if (!list.length) {
        table.innerHTML = emptyRow(8, "fa-face-smile", "No complaints yet.");
        return;
    }

    const who = name => name === MANUFACTURER ? "You" : Store.esc(name);

    table.innerHTML = list.map(c => {
        const id = Store.esc(c.id);
        return `
        <tr>
            <td class="fw-600">${id}</td>
            <td>${Store.esc(c.orderId)}</td>
            <td>${who(c.raisedBy)}</td>
            <td>${who(c.against)}</td>
            <td>${Store.esc(c.category)}</td>
            <td>${Store.date(c.date)}</td>
            <td>${Store.statusBadge(c.status)}</td>
            <td><button class="btn btn-secondary btn-sm btn-icon" data-action="viewComplaint" data-id="${id}" title="View" aria-label="View ${id}"><i class="fa-solid fa-eye"></i></button></td>
        </tr>`;
    }).join("");
}

function viewComplaint(id) {
    const c = Store.find("complaints", id);
    if (!c) {
        showToast("Complaint not found.", "error");
        return renderAll();
    }

    document.getElementById("complaintTitle").textContent = c.id + " · " + c.category;
    document.getElementById("complaintBody").innerHTML = `
        <dl class="detail-list mb-2">
            <div><dt>Raised by</dt><dd>${Store.esc(c.raisedBy)}</dd></div>
            <div><dt>Against</dt><dd>${Store.esc(c.against)}</dd></div>
            <div><dt>Order</dt><dd>${Store.esc(c.orderId)}</dd></div>
            <div><dt>Date</dt><dd>${Store.date(c.date)}</dd></div>
            <div><dt>Status</dt><dd>${Store.statusBadge(c.status)}</dd></div>
            <div><dt>Resolved on</dt><dd>${Store.date(c.resolvedOn)}</dd></div>
        </dl>
        <div class="complaint-quote"><strong>Description</strong>${Store.esc(c.description)}</div>
        <div class="complaint-quote mt-2"><strong>Resolution</strong>${c.resolution ? Store.esc(c.resolution) : "Awaiting review by the Biomass Connect team."}</div>`;
    openModal("complaintModal");
}

/* ---------------- Modal helpers ---------------- */

function openModal(id) {
    document.getElementById(id).classList.add("open");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("open");
}

function bindModals() {
    document.querySelectorAll(".modal-backdrop[id]").forEach(modal => {
        modal.addEventListener("click", e => {
            if (e.target === modal || e.target.closest("[data-close]")) closeModal(modal.id);
        });
    });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") document.querySelectorAll(".modal-backdrop.open[id]").forEach(m => closeModal(m.id));
    });
}
