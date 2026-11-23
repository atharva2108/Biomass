// =========================
// POWER PLANT DASHBOARD (US027)
// =========================

document.addEventListener("DOMContentLoaded", () => {
    const orders = Plant.orders();
    loadKpis(orders);
    loadOrders(orders);
});

function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
}

function loadKpis(orders) {
    const delivered = orders.filter(o => o.status === "Delivered");
    const active = orders.filter(o => o.status !== "Delivered");
    const inTransit = active.filter(o => o.status === "In Transit").length;
    const tons = delivered.reduce((sum, o) => sum + Number(o.quantity || 0), 0);
    const value = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    const reviewed = new Set(Store.get("pelletFeedback").map(f => f.orderId));
    const awaiting = delivered.filter(o => !reviewed.has(o.id)).length;

    document.getElementById("kpiDelivered").textContent = Plant.num(tons) + " t";
    document.getElementById("kpiDeliveredNote").textContent = plural(delivered.length, "delivered order");

    document.getElementById("kpiActive").textContent = active.length;
    document.getElementById("kpiActiveNote").textContent = inTransit + " in transit";

    document.getElementById("kpiValue").textContent = Store.inr(value);
    document.getElementById("kpiValueNote").textContent = "across " + plural(orders.length, "order");

    document.getElementById("kpiFeedback").textContent = awaiting;
    document.getElementById("kpiFeedbackNote").innerHTML = awaiting
        ? '<a href="pellet-feedback.html">Enter batch details</a>'
        : "All delivered batches reviewed";
}

function loadOrders(orders) {
    const table = document.getElementById("orderTable");
    const recent = orders.slice()
        .sort((a, b) => (b.orderDate || "").localeCompare(a.orderDate || "") || String(b.id).localeCompare(String(a.id)))
        .slice(0, 5);

    if (!recent.length) {
        table.innerHTML = Plant.emptyRow(7, "fa-inbox", "No pellet orders yet — explore the marketplace to place one");
        return;
    }

    table.innerHTML = recent.map(o => `
        <tr>
            <td class="fw-600">${Store.esc(o.id)}</td>
            <td>${Store.esc(o.manufacturer)}</td>
            <td>${Store.esc(o.pelletType)}</td>
            <td>${Plant.num(o.quantity)} t</td>
            <td>${Store.inr(o.total)}</td>
            <td>${Store.date(o.orderDate)}</td>
            <td>${Store.statusBadge(o.status)}</td>
        </tr>
    `).join("");
}
