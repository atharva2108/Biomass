// =========================
// FARMER — PAYMENTS & COMPLAINTS (US014)
// Payments: delivered purchase orders; the buyer sets order.paymentStatus / paidOn.
// Complaints: shared "complaints" collection (role "farmer"), resolved by Admin.
// =========================

let updateComplaintCount = () => {};

document.addEventListener("DOMContentLoaded", () => {

    updateComplaintCount = Farmer.counter("complaintDescription", "complaintCount", 500);
    Farmer.fillSelect("complaintCategory", Store.COMPLAINT_CATEGORIES.farmer, "Select category");
    fillOrderSelect();

    document.getElementById("pageTabs").addEventListener("click", e => {
        const tab = e.target.closest(".tab");
        if (tab) switchTab(tab.dataset.tab);
    });

    document.getElementById("raiseBtn").addEventListener("click", () => openComplaintForm(""));

    document.getElementById("paymentSearch").addEventListener("input", renderPayments);
    document.getElementById("paymentFilter").addEventListener("change", renderPayments);

    document.getElementById("paymentTable").addEventListener("click", e => {
        const btn = e.target.closest("button[data-action='complain']");
        if (btn) openComplaintForm(btn.dataset.id);
    });

    document.getElementById("complaintTable").addEventListener("click", e => {
        const btn = e.target.closest("button[data-action='view']");
        if (btn) viewComplaint(btn.dataset.id);
    });

    document.getElementById("complaintReset").addEventListener("click", () => {
        resetComplaintForm();
        showToast("Complaint form cleared", "info");
    });

    document.getElementById("complaintForm").addEventListener("submit", e => {
        e.preventDefault();
        submitComplaint();
    });

    renderAll();

    if (Farmer.param("tab") === "complaints") switchTab("complaints");
});

/* ---------- Data ---------- */

function deliveredOrders() {
    return Farmer.orders()
        .filter(o => o.status === "Delivered")
        .sort((a, b) => String(b.deliveredDate || "").localeCompare(String(a.deliveredDate || "")));
}

function isPaid(o) {
    return o.paymentStatus === "Paid";
}

function myComplaints() {
    return Store.get("complaints")
        .filter(c => c.role === "farmer" && c.raisedBy === Farmer.name)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
}

/* ---------- Tabs ---------- */

function switchTab(name) {
    document.querySelectorAll("#pageTabs .tab").forEach(t => {
        const active = t.dataset.tab === name;
        t.classList.toggle("active", active);
        t.setAttribute("aria-selected", active);
    });
    document.getElementById("panel-payments").classList.toggle("hidden", name !== "payments");
    document.getElementById("panel-complaints").classList.toggle("hidden", name !== "complaints");
}

function renderAll() {
    renderKpis();
    renderPayments();
    renderComplaints();
}

function renderKpis() {
    const orders = deliveredOrders();
    const sum = list => list.reduce((s, o) => s + Number(o.total || 0), 0);
    document.getElementById("kpiDelivered").textContent = Store.inr(sum(orders));
    document.getElementById("kpiPaid").textContent = Store.inr(sum(orders.filter(isPaid)));
    document.getElementById("kpiPending").textContent = Store.inr(sum(orders.filter(o => !isPaid(o))));
    document.getElementById("kpiComplaints").textContent = myComplaints().filter(c => c.status === "Open").length;
}

/* ---------- Payments ---------- */

function renderPayments() {
    const all = deliveredOrders();
    const q = document.getElementById("paymentSearch").value.trim().toLowerCase();
    const status = document.getElementById("paymentFilter").value;

    const rows = all.filter(o =>
        (!status || (status === "Paid") === isPaid(o)) &&
        (!q || [o.id, o.manufacturer, o.biomassType].join(" ").toLowerCase().includes(q)));

    const table = document.getElementById("paymentTable");

    if (!rows.length) {
        table.innerHTML = Farmer.emptyRow(8, "fa-indian-rupee-sign",
            all.length ? "No payments match your filters." : "No payments yet. Payments appear here once an order is delivered.");
        return;
    }

    table.innerHTML = rows.map(o => `
        <tr>
            <td class="fw-600">${Store.esc(o.id)}</td>
            <td>${Store.esc(o.manufacturer)}</td>
            <td>${Store.esc(o.biomassType)}</td>
            <td>${Store.date(o.deliveredDate)}</td>
            <td>${Store.inr(o.total)}</td>
            <td>${Store.statusBadge(isPaid(o) ? "Paid" : "Pending")}</td>
            <td>${Store.date(o.paidOn)}</td>
            <td>
                <button type="button" class="btn btn-ghost btn-sm" data-action="complain" data-id="${Store.esc(o.id)}">
                    <i class="fa-solid fa-headset"></i> Report issue
                </button>
            </td>
        </tr>`).join("");
}

/* ---------- Complaints ---------- */

function fillOrderSelect() {
    const select = document.getElementById("complaintOrder");
    const orders = deliveredOrders();
    select.innerHTML = '<option value="">' + (orders.length ? "Select delivered order" : "No delivered orders yet") + "</option>" +
        orders.map(o => `<option value="${Store.esc(o.id)}">${Store.esc(o.id)} · ${Store.esc(o.manufacturer)} · ${Store.inr(o.total)}</option>`).join("");
}

function openComplaintForm(orderId) {
    switchTab("complaints");
    const select = document.getElementById("complaintOrder");
    if (orderId) {
        select.value = orderId;
        Validator.validateField(select);
    }
    const target = orderId ? document.getElementById("complaintCategory") : select;
    target.focus({ preventScroll: true });
    document.getElementById("complaintForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetComplaintForm() {
    const form = document.getElementById("complaintForm");
    form.reset();
    Validator.reset(form);
    updateComplaintCount();
}

function submitComplaint() {

    if (!Validator.validateForm("#complaintForm")) return;

    const orderId = document.getElementById("complaintOrder").value;
    const category = document.getElementById("complaintCategory").value;
    const order = deliveredOrders().find(o => o.id === orderId);

    if (!order) {
        showToast("The selected order is no longer available. Please choose another order.", "error");
        fillOrderSelect();
        return;
    }

    const duplicate = myComplaints().find(c => c.orderId === orderId && c.category === category && c.status === "Open");
    if (duplicate) {
        showToast("You already have an open \"" + category + "\" complaint (" + duplicate.id + ") for " + orderId + ".", "warning",
            { title: "Duplicate complaint" });
        return;
    }

    const record = Store.add("complaints", {
        raisedBy: Farmer.name,
        role: "farmer",
        against: order.manufacturer,
        orderId,
        category,
        description: document.getElementById("complaintDescription").value.trim(),
        status: "Open",
        date: Farmer.today(),
        resolution: "",
        resolvedOn: ""
    });

    resetComplaintForm();
    renderAll();
    showToast("Complaint " + record.id + " submitted. The admin team will review it.", "success");
}

function renderComplaints() {
    const list = myComplaints();
    document.getElementById("complaintCountLabel").textContent = list.length + " complaint" + (list.length === 1 ? "" : "s");

    const table = document.getElementById("complaintTable");
    if (!list.length) {
        table.innerHTML = Farmer.emptyRow(7, "fa-headset", "You have not raised any complaints.");
        return;
    }

    table.innerHTML = list.map(c => `
        <tr>
            <td class="fw-600">${Store.esc(c.id)}</td>
            <td>${Store.esc(c.orderId)}</td>
            <td>${Store.esc(c.against)}</td>
            <td>${Store.esc(c.category)}</td>
            <td>${Store.date(c.date)}</td>
            <td>${Store.statusBadge(c.status)}</td>
            <td>
                <button type="button" class="btn btn-secondary btn-sm btn-icon" data-action="view" data-id="${Store.esc(c.id)}"
                        title="View complaint" aria-label="View ${Store.esc(c.id)}"><i class="fa-solid fa-eye"></i></button>
            </td>
        </tr>`).join("");
}

function viewComplaint(id) {
    const c = myComplaints().find(x => x.id === id);
    if (!c) {
        showToast("Complaint " + id + " no longer exists", "error");
        renderAll();
        return;
    }

    const resolved = c.status === "Resolved";
    document.getElementById("complaintTitle").textContent = "Complaint " + c.id;
    document.getElementById("complaintBody").innerHTML = `
        <dl class="detail-list">
            <div><dt>Order</dt><dd>${Store.esc(c.orderId)}</dd></div>
            <div><dt>Status</dt><dd>${Store.statusBadge(c.status)}</dd></div>
            <div><dt>Against</dt><dd>${Store.esc(c.against)}</dd></div>
            <div><dt>Category</dt><dd>${Store.esc(c.category)}</dd></div>
            <div><dt>Raised On</dt><dd>${Store.date(c.date)}</dd></div>
            <div><dt>Resolved On</dt><dd>${resolved ? Store.date(c.resolvedOn) : "—"}</dd></div>
            <div class="span-full"><dt>Description</dt><dd class="pre-wrap">${Store.esc(c.description)}</dd></div>
            <div class="span-full"><dt>Admin Resolution</dt><dd class="pre-wrap">${
                c.resolution ? Store.esc(c.resolution) : '<span class="text-subtle">Awaiting review by the admin team</span>'}</dd></div>
        </dl>`;
    Farmer.openModal("complaintModal");
}
