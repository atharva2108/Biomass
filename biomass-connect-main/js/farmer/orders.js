// =========================
// FARMER — ORDERS RECEIVED (US011)
// View only: a manufacturer buys the whole listing and the farmer supplies it.
// Status and transport details are updated by the logistics team.
// =========================

const ORDER_TABS = ["All"].concat(Store.ORDER_STEPS);
let activeTab = "All";

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("searchInput").addEventListener("input", render);

    document.getElementById("statusTabs").addEventListener("click", e => {
        const tab = e.target.closest(".tab");
        if (!tab) return;
        activeTab = tab.dataset.tab;
        render();
    });

    document.getElementById("ordersTable").addEventListener("click", e => {
        const btn = e.target.closest("button[data-action='view']");
        if (btn) openView(btn.dataset.id);
    });

    render();
});

/* ---------- Data ---------- */

function sortedOrders() {
    return Farmer.orders().sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)));
}

function findOrder(id) {
    const o = Store.find("purchaseOrders", id);
    return o && o.farmer === FARMER_NAME ? o : null;
}

/* ---------- Rendering ---------- */

function render() {
    const orders = sortedOrders();
    renderTabs(orders);

    const q = document.getElementById("searchInput").value.trim().toLowerCase();
    const rows = orders.filter(o =>
        (activeTab === "All" || o.status === activeTab) &&
        (!q || [o.id, o.manufacturer, o.biomassType].join(" ").toLowerCase().includes(q)));

    const table = document.getElementById("ordersTable");

    if (!rows.length) {
        table.innerHTML = Farmer.emptyRow(8, "fa-inbox",
            q ? "No orders match your search." : (activeTab === "All" ? "No orders received yet." : "No orders with status \"" + activeTab + "\"."));
        return;
    }

    table.innerHTML = rows.map(o => `
        <tr>
            <td class="fw-600">${Store.esc(o.id)}</td>
            <td>${Store.esc(o.manufacturer)}</td>
            <td>${Store.esc(o.biomassType)}</td>
            <td>${Farmer.tons(o.quantity)}</td>
            <td>${Store.inr(o.total)}</td>
            <td>${Store.date(o.orderDate)}</td>
            <td>${Store.statusBadge(o.status)}</td>
            <td>
                <button type="button" class="btn btn-secondary btn-sm btn-icon" data-action="view" data-id="${Store.esc(o.id)}"
                        title="View details" aria-label="View ${Store.esc(o.id)}"><i class="fa-solid fa-eye"></i></button>
            </td>
        </tr>`).join("");
}

function renderTabs(orders) {
    document.getElementById("statusTabs").innerHTML = ORDER_TABS.map(t => {
        const count = t === "All" ? orders.length : orders.filter(o => o.status === t).length;
        return `<button type="button" class="tab${t === activeTab ? " active" : ""}" data-tab="${t}" role="tab"
                    aria-selected="${t === activeTab}">${t} <span class="tab-count">${count}</span></button>`;
    }).join("");
}

/* ---------- View ---------- */

function openView(id) {
    const o = findOrder(id);
    if (!o) {
        showToast("Order " + id + " no longer exists", "error");
        render();
        return;
    }

    const rows = [
        ["Manufacturer", Store.esc(o.manufacturer)],
        ["Status", Store.statusBadge(o.status)],
        ["Biomass", Store.esc(o.biomassType)],
        ["Listing", Store.esc(o.listingId || "—")],
        ["Quantity", Farmer.tons(o.quantity)],
        ["Price / Ton", Store.inr(o.price)],
        ["Order Amount", Store.inr(o.total)],
        ["Order Date", Store.date(o.orderDate)]
    ];
    if (o.status === "Delivered") {
        rows.push(["Payment", Store.statusBadge(o.paymentStatus || "Pending") +
            (o.paidOn ? ' <span class="text-subtle">on ' + Store.date(o.paidOn) + "</span>" : "")]);
    }
    if (o.notes) rows.push(["Buyer Notes", Store.esc(o.notes), true]);

    document.getElementById("viewTitle").textContent = "Order " + o.id;
    document.getElementById("viewBody").innerHTML = `
        <dl class="detail-list">${rows.map(r =>
            `<div${r[2] ? ' class="span-full"' : ""}><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`).join("")}</dl>
        <div class="mt-3">
            <div class="form-section-title">Pickup &amp; Delivery</div>
            <div class="mt-2">${Store.trackingHtml(o)}</div>
        </div>`;

    Farmer.openModal("viewModal");
}
