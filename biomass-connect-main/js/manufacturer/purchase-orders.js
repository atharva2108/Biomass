// =========================
// PURCHASE ORDERS (US017 create + list)
// The manufacturer buys a WHOLE biomass listing. Orders cannot be
// cancelled; pickup and delivery are handled by the logistics team.
// =========================

const MANUFACTURER = "GreenPellet Industries";
const DEFAULT_ADDRESS = "Plot 14, MIDC Ambad, Nashik 422010";

let selectedListing = null;

document.addEventListener("DOMContentLoaded", () => {

    fillListingOptions();
    prefillAddress();

    const form = document.getElementById("poForm");

    document.getElementById("listingSelect").addEventListener("change", e => selectListing(e.target.value));
    document.getElementById("notes").addEventListener("input", updateNotesCount);

    form.addEventListener("submit", e => {
        e.preventDefault();
        placeOrder();
    });

    form.addEventListener("reset", () => {
        // the form resets after this handler runs
        setTimeout(() => {
            Validator.reset(form);
            selectListing("");
            updateNotesCount();
        }, 0);
    });

    document.getElementById("orderSearch").addEventListener("input", renderOrders);
    document.getElementById("statusFilter").addEventListener("change", renderOrders);

    preselectFromUrl();
    renderOrders();
});

/* ---------------- Listing selection ---------------- */

function availableListings() {
    return Store.get("biomassListings").filter(l => l.status === "Active" && Number(l.quantity) > 0);
}

function fillListingOptions() {
    document.getElementById("listingSelect").innerHTML = `<option value="">Select a listing</option>` +
        availableListings().map(l =>
            `<option value="${Store.esc(l.id)}">${Store.esc(l.biomassType)} — ${Store.esc(l.farmer)}, ${Store.esc(l.location)} · ${Store.esc(l.quantity)} t @ ${Store.inr(l.price)}/t (${Store.esc(l.id)})</option>`
        ).join("");
}

function preselectFromUrl() {
    const id = new URLSearchParams(location.search).get("listing");
    if (!id) return;

    const listing = Store.find("biomassListings", id);
    if (!listing || listing.status !== "Active" || Number(listing.quantity) <= 0) {
        showToast("The selected listing is no longer available. Please choose another one.", "warning");
        return;
    }

    document.getElementById("listingSelect").value = id;
    selectListing(id);
    showToast(listing.biomassType + " from " + listing.farmer + " selected. Check the delivery address and place the order.", "info");
}

function selectListing(id) {
    selectedListing = id ? Store.find("biomassListings", id) : null;
    const l = selectedListing;

    document.getElementById("farmerName").value = l ? l.farmer : "";
    document.getElementById("quantityDisplay").value = l ? l.quantity + " " + (l.unit || "Tons") : "";

    renderSummary();
}

function renderSummary() {
    const box = document.getElementById("listingSummary");
    const l = selectedListing;

    document.getElementById("sumQty").textContent = l ? l.quantity + " tons" : "—";
    document.getElementById("sumPrice").textContent = l ? Store.inr(l.price) : "—";
    document.getElementById("sumTotal").textContent = l ? Store.inr(Number(l.quantity) * Number(l.price)) : "₹0";

    if (!l) {
        box.className = "text-muted";
        box.textContent = "No listing selected.";
        return;
    }

    box.className = "";
    box.innerHTML = `
        <div class="listing-summary-title">${Store.esc(l.biomassType)}</div>
        <div class="text-muted" style="font-size:13px">${Store.esc(l.id)} · ${Store.esc(l.farmer)} · ${Store.esc(l.location)}, ${Store.esc(l.state)}</div>
        <div class="text-muted" style="font-size:13px">Available from ${Store.date(l.availableFrom)}</div>`;
}

function updateNotesCount() {
    document.getElementById("notesCount").textContent = document.getElementById("notes").value.length;
}

function prefillAddress() {
    let address = DEFAULT_ADDRESS;
    try {
        const p = JSON.parse(localStorage.getItem("bc_profile_manufacturer")) || {};
        if (p.address && String(p.address).trim()) address = String(p.address).trim();
    } catch (e) { /* use default */ }

    const el = document.getElementById("deliveryAddress");
    el.defaultValue = address; // kept after form reset
    el.value = address;
}

/* ---------------- Place order ---------------- */

async function placeOrder() {
    const form = document.getElementById("poForm");
    if (!Validator.validateForm(form)) return;

    // the listing might have been bought by someone else since the page loaded
    const listing = Store.find("biomassListings", document.getElementById("listingSelect").value);
    if (!listing || listing.status !== "Active") {
        showToast("This listing is no longer available. Please select another listing.", "error");
        refreshListings();
        return;
    }

    const total = Number(listing.quantity) * Number(listing.price);
    const ok = await confirmDialog({
        title: "Place this order?",
        message: "You are buying the whole listing: " + listing.quantity + " tons of " + listing.biomassType +
            " from " + listing.farmer + " for " + Store.inr(total) + ". Once placed, the order cannot be cancelled.",
        confirmText: "Place order"
    });
    if (!ok) return;

    const order = Store.placeOrder("biomass", listing.id, {
        manufacturer: MANUFACTURER,
        deliveryAddress: document.getElementById("deliveryAddress").value.trim(),
        notes: document.getElementById("notes").value.trim()
    });

    if (!order) {
        showToast("This listing is no longer available. Please select another listing.", "error");
        refreshListings();
        return;
    }

    form.reset();
    refreshListings();
    try {
        if (location.search) history.replaceState(null, "", location.pathname);
    } catch (e) { /* some browsers block this on file:// pages */ }

    showToast("Purchase order " + order.id + " placed with " + order.farmer + " for " + order.quantity + " tons of " + order.biomassType + ". The logistics team will schedule the pickup.", "success", { title: "Order placed" });
    renderOrders();
}

function refreshListings() {
    fillListingOptions();
    selectListing("");
}

/* ---------------- My purchase orders ---------------- */

function myOrders() {
    return Store.get("purchaseOrders").filter(o => o.manufacturer === MANUFACTURER);
}

function renderOrders() {
    const search = document.getElementById("orderSearch").value.trim().toLowerCase();
    const status = document.getElementById("statusFilter").value;
    const all = myOrders();

    const list = all.filter(o => {
        if (status && o.status !== status) return false;
        if (search && ![o.id, o.farmer, o.biomassType].join(" ").toLowerCase().includes(search)) return false;
        return true;
    });

    document.getElementById("orderCount").textContent =
        all.length + (all.length === 1 ? " order" : " orders") + " · " + all.filter(o => o.status !== "Delivered").length + " in progress";

    const table = document.getElementById("purchaseOrderTable");

    if (!list.length) {
        table.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-file-circle-question"></i>${all.length ? "No orders match your filters" : "You have not placed any purchase orders yet"}</div></td></tr>`;
        return;
    }

    table.innerHTML = list.map(o => `
        <tr>
            <td class="fw-600">${Store.esc(o.id)}</td>
            <td>${Store.esc(o.farmer)}</td>
            <td>${Store.esc(o.biomassType)}</td>
            <td>${Store.esc(o.quantity)} t</td>
            <td>${Store.inr(o.total)}</td>
            <td>${Store.date(o.orderDate)}</td>
            <td>${Store.statusBadge(o.status)}</td>
            <td>
                <a class="btn btn-secondary btn-sm" href="tracking.html?order=${encodeURIComponent(o.id)}" aria-label="Track ${Store.esc(o.id)}"><i class="fa-solid fa-truck-fast"></i> Track</a>
            </td>
        </tr>
    `).join("");
}
