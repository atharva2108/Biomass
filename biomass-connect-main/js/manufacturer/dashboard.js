// =========================
// MANUFACTURER DASHBOARD (US015)
// =========================

const MANUFACTURER = "GreenPellet Industries";

document.addEventListener("DOMContentLoaded", () => {

    const purchaseOrders = Store.get("purchaseOrders").filter(o => o.manufacturer === MANUFACTURER);
    const pelletListings = Store.get("pelletListings").filter(l => l.manufacturer === MANUFACTURER);
    const pelletOrders = Store.get("pelletOrders").filter(o => o.manufacturer === MANUFACTURER);

    loadKpis(purchaseOrders, pelletListings, pelletOrders);
    loadPurchaseOrders(purchaseOrders);
    loadPelletOrders(pelletOrders);
    loadStatus(pelletOrders);

    document.getElementById("ratingBox").innerHTML = Store.ratingHtml(MANUFACTURER);
});

function loadKpis(purchaseOrders, pelletListings, pelletOrders) {
    // every placed order is a purchase: orders cannot be cancelled
    const purchasedTons = purchaseOrders.reduce((sum, o) => sum + Number(o.quantity || 0), 0);
    const activePOs = purchaseOrders.filter(o => o.status !== "Delivered").length;

    const revenue = pelletOrders
        .filter(o => o.status === "Delivered")
        .reduce((sum, o) => sum + Number(o.total || 0), 0);

    document.getElementById("kpiBiomass").textContent = formatTons(purchasedTons);
    document.getElementById("kpiActivePOs").textContent = activePOs;
    document.getElementById("kpiListings").textContent = pelletListings.filter(l => l.status === "Active").length;
    document.getElementById("kpiRevenue").textContent = Store.inr(revenue);
}

function formatTons(n) {
    return Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " t";
}

function emptyRow(cols, text) {
    return `<tr><td colspan="${cols}"><div class="empty-state"><i class="fa-solid fa-inbox"></i>${text}</div></td></tr>`;
}

function loadPurchaseOrders(orders) {
    const table = document.getElementById("poTable");

    if (!orders.length) {
        table.innerHTML = emptyRow(6, "No purchase orders yet — browse the biomass marketplace to buy a listing.");
        return;
    }

    table.innerHTML = orders.slice(0, 5).map(o => `
        <tr>
            <td class="fw-600">${Store.esc(o.id)}</td>
            <td>${Store.esc(o.farmer)}</td>
            <td>${Store.esc(o.biomassType)}</td>
            <td>${Store.esc(o.quantity)} Tons</td>
            <td>${Store.inr(o.total)}</td>
            <td>${Store.statusBadge(o.status)}</td>
        </tr>
    `).join("");
}

function loadPelletOrders(orders) {
    const table = document.getElementById("pelletTable");

    if (!orders.length) {
        table.innerHTML = emptyRow(6, "No pellet orders received yet.");
        return;
    }

    table.innerHTML = orders.slice(0, 5).map(o => `
        <tr>
            <td class="fw-600">${Store.esc(o.id)}</td>
            <td>${Store.esc(o.powerPlant)}</td>
            <td>${Store.esc(o.pelletType)}</td>
            <td>${Store.esc(o.quantity)} Tons</td>
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
