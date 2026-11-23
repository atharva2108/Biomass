// =========================
// ADMIN DASHBOARD (US037)
// =========================

const VERIFY_PAGE = {
    farmer: "farmer-verification.html",
    manufacturer: "manufacturer-verification.html",
    powerplant: "powerplant-verification.html"
};

document.addEventListener("DOMContentLoaded", () => {

    const users = Admin.get("admin_users");
    const verifications = Admin.get("admin_verifications");
    const complaints = Store.get("complaints");
    const orders = Admin.allOrders();

    loadWelcome();
    loadKpis(users, verifications, complaints, orders);
    loadQueue(verifications);
    loadTransactions(orders);
    loadRoles(users);
    loadComplaints(complaints);
});

function loadWelcome() {
    const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    document.getElementById("welcomeTitle").textContent = "Welcome back, " + Admin.adminName();
    document.getElementById("welcomeSubtitle").textContent = today + " · Platform overview of users, verifications, orders and complaints.";
}

function loadKpis(users, verifications, complaints, orders) {
    const byRole = role => users.filter(u => u.role === role).length;
    const activeUsers = users.filter(u => u.status === "Active").length;

    document.getElementById("kpiUsers").textContent = users.length;
    document.getElementById("kpiUsersTrend").textContent = activeUsers + " active";
    document.getElementById("kpiFarmers").textContent = byRole("Farmer");
    document.getElementById("kpiManufacturers").textContent = byRole("Manufacturer");
    document.getElementById("kpiPlants").textContent = byRole("Power Plant");
    document.getElementById("kpiPending").textContent = verifications.filter(v => v.status === "Pending").length;
    document.getElementById("kpiActiveOrders").textContent = orders.filter(Admin.isActiveOrder).length;
    document.getElementById("kpiDisputes").textContent = complaints.filter(c => c.status !== "Resolved").length;
    document.getElementById("kpiGmv").textContent = Store.inr(orders.reduce((sum, o) => sum + o.total, 0));
}

function loadQueue(verifications) {
    const table = document.getElementById("queueTable");
    const pending = verifications
        .filter(v => v.status === "Pending")
        .sort((a, b) => a.submitted.localeCompare(b.submitted));

    document.getElementById("queueCount").textContent = pending.length + " pending";

    if (!pending.length) {
        table.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-circle-check"></i>All registrations have been reviewed</div></td></tr>`;
        return;
    }

    table.innerHTML = pending.slice(0, 6).map(v => `
        <tr>
            <td>
                <div class="fw-600">${Store.esc(v.name)}</div>
                <small class="text-muted">${Store.esc(v.id)}</small>
            </td>
            <td>${Store.esc(Admin.ROLE_LABEL[v.role] || v.role)}</td>
            <td>${Store.esc(v.district)}, ${Store.esc(v.state)}</td>
            <td>${Store.date(v.submitted)}</td>
            <td>${Store.esc(v.docType || "—")}</td>
            <td class="text-right">
                <a class="btn btn-secondary btn-sm" href="${VERIFY_PAGE[v.role]}?id=${encodeURIComponent(v.id)}">Review</a>
            </td>
        </tr>
    `).join("");
}

function loadTransactions(orders) {
    const table = document.getElementById("txnTable");

    if (!orders.length) {
        table.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-inbox"></i>No transactions yet</div></td></tr>`;
        return;
    }

    table.innerHTML = orders.slice(0, 6).map(o => `
        <tr>
            <td class="fw-600">${Store.esc(o.id)}</td>
            <td>${Store.esc(o.type)}</td>
            <td>${Store.esc(o.buyer)}</td>
            <td>${Store.esc(o.seller)}</td>
            <td>${Store.inr(o.total)}</td>
            <td>${Store.date(o.orderDate)}</td>
            <td>${Store.statusBadge(o.status)}</td>
        </tr>
    `).join("");
}

function loadRoles(users) {
    const roles = [["Farmer", "Farmers"], ["Manufacturer", "Manufacturers"], ["Power Plant", "Power Plants"]];
    const total = users.length || 1;

    document.getElementById("roleList").innerHTML = roles.map(([role, label]) => {
        const list = users.filter(u => u.role === role);
        const active = list.filter(u => u.status === "Active").length;
        return `
            <a class="role-row" href="user-management.html?role=${encodeURIComponent(role)}">
                <div class="status-row">
                    <span class="text-muted">${label} <small>(${active} active)</small></span>
                    <strong>${list.length}</strong>
                </div>
                <div class="progress"><span style="width:${Math.round(list.length / total * 100)}%"></span></div>
            </a>`;
    }).join("");
}

function loadComplaints(complaints) {
    const el = document.getElementById("disputeList");
    const open = complaints.filter(c => c.status !== "Resolved").slice(0, 4);

    if (!open.length) {
        el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-check"></i>No open complaints</div>`;
        return;
    }

    el.innerHTML = open.map(c => `
        <a class="mini-item" href="dispute-management.html?id=${encodeURIComponent(c.id)}">
            <div>
                <div class="fw-600">${Store.esc(c.id)} · ${Store.esc(c.category)}</div>
                <small class="text-muted">${Store.esc(c.raisedBy)} vs ${Store.esc(c.against)}</small>
            </div>
            ${Store.statusBadge(c.status)}
        </a>
    `).join("");
}
