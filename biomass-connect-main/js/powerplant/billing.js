// =========================
// BILLING & COMPLAINTS (US034)
// Payments:   this plant's delivered pelletOrders. "Mark as Paid" sets
//             paymentStatus "Paid" + paidOn on the order (the manufacturer sees it).
// Complaints: shared Store "complaints" collection, resolved by Admin
//             { id, raisedBy, role, against, orderId, category, description,
//               status: "Open" | "Resolved", date, resolution, resolvedOn }
// =========================

document.addEventListener("DOMContentLoaded", () => {

    // tabs
    document.getElementById("billingTabs").addEventListener("click", e => {
        const tab = e.target.closest(".tab");
        if (tab) showTab(tab.dataset.tab);
    });
    if (Plant.param("tab") === "complaints") showTab("complaints");

    // payments
    document.getElementById("paymentFilter").addEventListener("change", renderPayments);
    document.getElementById("paymentTable").addEventListener("click", e => {
        const btn = e.target.closest("button[data-pay]");
        if (btn) markPaid(btn.dataset.pay);
    });

    // complaints
    populateComplaintForm();
    Plant.counter("complaintDescription", "descriptionCount");
    const form = document.getElementById("complaintForm");
    form.addEventListener("submit", submitComplaint);
    form.addEventListener("reset", () => setTimeout(() => Validator.reset(form), 0));
    document.getElementById("complaintTable").addEventListener("click", e => {
        const btn = e.target.closest("button[data-view]");
        if (btn) viewComplaint(btn.dataset.view);
    });

    const preOrder = Plant.param("order");
    if (preOrder && Plant.orders().some(o => o.id === preOrder)) {
        document.getElementById("complaintOrder").value = preOrder;
        showTab("complaints");
    }

    refresh();
});

function refresh() {
    loadKpis();
    renderPayments();
    renderComplaints();
}

function showTab(name) {
    document.querySelectorAll("#billingTabs .tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("hidden", p.id !== "panel-" + name));
}

/* ---------------- Data ---------------- */

function payables() {
    return Plant.orders()
        .filter(o => o.status === "Delivered")
        .sort((a, b) => (b.deliveredDate || b.orderDate || "").localeCompare(a.deliveredDate || a.orderDate || ""));
}

function isPaid(o) {
    return o.paymentStatus === "Paid";
}

function complaints() {
    return Store.get("complaints")
        .filter(c => c.role === "powerplant" && c.raisedBy === Plant.NAME)
        .sort((a, b) => (b.date || "").localeCompare(a.date || "") || String(b.id).localeCompare(String(a.id)));
}

/* ---------------- KPIs ---------------- */

function loadKpis() {
    const list = payables();
    const sum = arr => arr.reduce((s, o) => s + (Number(o.total) || 0), 0);

    document.getElementById("kpiDelivered").textContent = list.length;
    document.getElementById("kpiPaid").textContent = Store.inr(sum(list.filter(isPaid)));
    document.getElementById("kpiPending").textContent = Store.inr(sum(list.filter(o => !isPaid(o))));
    document.getElementById("kpiComplaints").textContent = complaints().filter(c => c.status === "Open").length;
}

/* ---------------- Payments ---------------- */

function renderPayments() {
    const filter = document.getElementById("paymentFilter").value;
    const list = payables().filter(o => !filter || (o.paymentStatus || "Pending") === filter);
    const table = document.getElementById("paymentTable");

    if (!list.length) {
        table.innerHTML = Plant.emptyRow(7, "fa-indian-rupee-sign", filter
            ? "No " + filter.toLowerCase() + " payments"
            : "No delivered orders yet — payments appear here once an order is delivered");
        return;
    }

    table.innerHTML = list.map(o => {
        const id = Store.esc(o.id);
        const paid = isPaid(o);
        return `
        <tr>
            <td class="fw-600">${id}</td>
            <td>${Store.esc(o.pelletType)}<br><small class="text-muted">${Plant.num(o.quantity)} t · ${Store.esc(o.grade)}</small></td>
            <td>${Store.esc(o.manufacturer)}</td>
            <td>${Store.date(o.deliveredDate)}</td>
            <td class="fw-600">${Store.inr(o.total)}</td>
            <td>${Store.statusBadge(paid ? "Paid" : "Pending")}${paid ? `<br><small class="text-muted">on ${Store.date(o.paidOn)}</small>` : ""}</td>
            <td>${paid ? `<span class="text-muted">—</span>`
                : `<button class="btn btn-primary btn-sm" type="button" data-pay="${id}"><i class="fa-solid fa-check"></i> Mark as Paid</button>`}</td>
        </tr>`;
    }).join("");
}

async function markPaid(id) {
    const order = Store.find("pelletOrders", id);
    if (!order || order.powerPlant !== Plant.NAME || order.status !== "Delivered") {
        showToast("Only delivered orders can be paid", "error");
        refresh();
        return;
    }
    if (isPaid(order)) {
        showToast(`Order ${id} is already marked as paid`, "info");
        refresh();
        return;
    }

    const ok = await confirmDialog({
        title: "Mark order " + id + " as paid?",
        message: `Confirm that ${Store.inr(order.total)} has been paid to ${order.manufacturer}. The manufacturer will see this order as paid.`,
        confirmText: "Mark as Paid"
    });
    if (!ok) return;

    Store.update("pelletOrders", id, { paymentStatus: "Paid", paidOn: Store.iso(0) });
    showToast(`Payment of ${Store.inr(order.total)} for ${id} marked as paid`, "success");
    refresh();
}

/* ---------------- Complaints ---------------- */

function populateComplaintForm() {
    const order = document.getElementById("complaintOrder");
    Plant.orders()
        .slice()
        .sort((a, b) => (b.orderDate || "").localeCompare(a.orderDate || ""))
        .forEach(o => order.insertAdjacentHTML("beforeend",
            `<option value="${Store.esc(o.id)}">${Store.esc(o.id)} — ${Store.esc(o.pelletType)} · ${Store.esc(o.manufacturer)} (${Store.esc(o.status)})</option>`));

    document.getElementById("complaintCategory").insertAdjacentHTML("beforeend",
        Store.COMPLAINT_CATEGORIES.powerplant.map(c => `<option>${Store.esc(c)}</option>`).join(""));
}

function submitComplaint(e) {
    e.preventDefault();

    if (!Validator.validateForm("#complaintForm")) return;

    const orderId = document.getElementById("complaintOrder").value;
    const category = document.getElementById("complaintCategory").value;
    const order = Store.find("pelletOrders", orderId);

    if (!order || order.powerPlant !== Plant.NAME) {
        showToast("The selected order could not be found", "error");
        return;
    }

    const duplicate = complaints().find(c => c.orderId === orderId && c.category === category && c.status === "Open");
    if (duplicate) {
        showToast(`Complaint ${duplicate.id} for this order and category is still open. Please wait for the admin to resolve it.`, "warning");
        return;
    }

    const complaint = Store.add("complaints", {
        raisedBy: Plant.NAME,
        role: "powerplant",
        against: order.manufacturer,
        orderId,
        category,
        description: document.getElementById("complaintDescription").value.trim(),
        status: "Open",
        date: Store.iso(0),
        resolution: "",
        resolvedOn: ""
    });

    showToast(`Complaint ${complaint.id} submitted to the admin team`, "success");

    document.getElementById("complaintForm").reset();
    refresh();
}

function renderComplaints() {
    const list = complaints();
    const table = document.getElementById("complaintTable");

    if (!list.length) {
        table.innerHTML = Plant.emptyRow(7, "fa-headset", "You haven't raised any complaints");
        return;
    }

    table.innerHTML = list.map(c => {
        const id = Store.esc(c.id);
        return `
        <tr>
            <td class="fw-600">${id}</td>
            <td>${Store.esc(c.orderId)}</td>
            <td>${Store.esc(c.against)}</td>
            <td>${Store.esc(c.category)}</td>
            <td>${Store.date(c.date)}</td>
            <td>${Store.statusBadge(c.status)}</td>
            <td><button class="btn btn-ghost btn-icon" type="button" data-view="${id}" title="View complaint" aria-label="View ${id}"><i class="fa-solid fa-eye"></i></button></td>
        </tr>`;
    }).join("");
}

function viewComplaint(id) {
    const c = complaints().find(x => x.id === id);
    if (!c) {
        showToast("Complaint not found", "error");
        return;
    }

    document.getElementById("complaintModalTitle").textContent = "Complaint " + c.id;
    document.getElementById("complaintModalBody").innerHTML = `
        <dl class="detail-list mb-2">
            <div><dt>Status</dt><dd>${Store.statusBadge(c.status)}</dd></div>
            <div><dt>Raised On</dt><dd>${Store.date(c.date)}</dd></div>
            <div><dt>Order</dt><dd>${Store.esc(c.orderId)}</dd></div>
            <div><dt>Against</dt><dd>${Store.esc(c.against || "—")}</dd></div>
            <div><dt>Category</dt><dd>${Store.esc(c.category)}</dd></div>
            <div><dt>Resolved On</dt><dd>${Store.date(c.resolvedOn)}</dd></div>
        </dl>
        <p class="form-label">Description</p>
        <div class="complaint-text">${Store.esc(c.description)}</div>
        <p class="form-label mt-2">Admin Resolution</p>
        <div class="complaint-text${c.resolution ? "" : " text-muted"}">${c.resolution ? Store.esc(c.resolution) : "Awaiting resolution from the admin team."}</div>`;
    Plant.openModal("complaintModal");
}
