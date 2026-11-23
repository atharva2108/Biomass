// =========================
// FARMER DASHBOARD
// =========================

document.addEventListener("DOMContentLoaded", () => {

    const listings = Farmer.listings();
    const orders = Farmer.orders().sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)));

    loadKpis(listings, orders);
    loadOrders(orders);
    loadStatus(orders);
});

function loadKpis(listings, orders) {
    const delivered = orders.filter(o => o.status === "Delivered");
    const revenue = delivered.reduce((sum, o) => sum + Number(o.total || 0), 0);

    document.getElementById("kpiListings").textContent = listings.filter(l => l.status === "Active").length;
    document.getElementById("kpiOrders").textContent = orders.length;
    document.getElementById("kpiRevenue").textContent = Store.inr(revenue);
    document.getElementById("kpiDelivered").textContent = delivered.length;
}

function loadOrders(orders) {
    const table = document.getElementById("orderTable");

    if (!orders.length) {
        table.innerHTML = Farmer.emptyRow(6, "fa-inbox", "No orders yet");
        return;
    }

    table.innerHTML = orders.slice(0, 5).map(o => `
        <tr>
            <td class="fw-600">${Store.esc(o.id)}</td>
            <td>${Store.esc(o.manufacturer)}</td>
            <td>${Store.esc(o.biomassType)}</td>
            <td>${Farmer.tons(o.quantity)}</td>
            <td>${Store.inr(o.total)}</td>
            <td>${Store.statusBadge(o.status)}</td>
        </tr>
    `).join("");
}

function loadStatus(orders) {
    const total = orders.length || 1;

    document.getElementById("statusList").innerHTML = Store.ORDER_STEPS.map(label => {
        const count = orders.filter(o => o.status === label).length;
        return `
            <div>
                <div class="status-row">
                    <span class="text-muted">${label}</span>
                    <strong>${count}</strong>
                </div>
                <div class="progress"><span style="width:${Math.round(count / total * 100)}%"></span></div>
            </div>`;
    }).join("");
}
