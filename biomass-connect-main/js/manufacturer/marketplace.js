// =========================
// BIOMASS MARKETPLACE (US016)
// =========================

document.addEventListener("DOMContentLoaded", () => {

    fillFilterOptions();

    ["searchInput", "maxPrice"].forEach(id =>
        document.getElementById(id).addEventListener("input", renderListings));

    ["typeFilter", "stateFilter", "sortBy"].forEach(id =>
        document.getElementById(id).addEventListener("change", renderListings));

    document.getElementById("filterForm").addEventListener("submit", e => e.preventDefault());

    document.getElementById("resetFilters").addEventListener("click", () => {
        document.getElementById("filterForm").reset();
        Validator.reset("#filterForm");
        renderListings();
    });

    renderListings();
});

function activeListings() {
    return Store.get("biomassListings").filter(l => l.status === "Active" && Number(l.quantity) > 0);
}

function fillFilterOptions() {
    const listings = activeListings();
    const unique = key => [...new Set(listings.map(l => l[key]).filter(Boolean))].sort();

    document.getElementById("typeFilter").insertAdjacentHTML("beforeend",
        unique("biomassType").map(t => `<option value="${Store.esc(t)}">${Store.esc(t)}</option>`).join(""));

    document.getElementById("stateFilter").insertAdjacentHTML("beforeend",
        unique("state").map(s => `<option value="${Store.esc(s)}">${Store.esc(s)}</option>`).join(""));
}

function renderListings() {
    const container = document.getElementById("marketplaceContainer");
    const search = document.getElementById("searchInput").value.trim().toLowerCase();
    const type = document.getElementById("typeFilter").value;
    const state = document.getElementById("stateFilter").value;
    const sortBy = document.getElementById("sortBy").value;
    const priceEl = document.getElementById("maxPrice");

    // apply the max price only when it is a valid value
    const priceValid = !priceEl.value || Validator.validateField(priceEl);
    const maxPrice = priceValid && priceEl.value ? Number(priceEl.value) : null;

    let list = activeListings().filter(l => {
        const haystack = [l.biomassType, l.farmer, l.location, l.district, l.state].join(" ").toLowerCase();
        if (search && !haystack.includes(search)) return false;
        if (type && l.biomassType !== type) return false;
        if (state && l.state !== state) return false;
        if (maxPrice !== null && Number(l.price) > maxPrice) return false;
        return true;
    });

    const sorters = {
        newest: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
        priceAsc: (a, b) => a.price - b.price,
        priceDesc: (a, b) => b.price - a.price,
        qtyDesc: (a, b) => b.quantity - a.quantity
    };
    list.sort(sorters[sortBy] || sorters.newest);

    document.getElementById("resultCount").textContent =
        list.length + (list.length === 1 ? " listing" : " listings") + " available";

    if (!list.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-seedling"></i>
                No biomass listings match your filters.
            </div>`;
        return;
    }

    container.innerHTML = list.map(l => {
        const upcoming = l.availableFrom && l.availableFrom > Store.iso(0);
        return `
        <article class="card listing-card">
            <div class="card-header">
                <div>
                    <div class="card-title">${Store.esc(l.biomassType)}</div>
                    <div class="card-subtitle">${Store.esc(l.id)} · by ${Store.esc(l.farmer)}</div>
                </div>
                <span class="${upcoming ? "badge badge-info" : "badge badge-success"}">${upcoming ? "Upcoming" : "Available"}</span>
            </div>
            <div class="card-body">
                <div class="listing-price">${Store.inr(l.price)} <small>/ ton</small></div>
                <dl class="detail-list mt-2">
                    <div><dt>Quantity</dt><dd>${Store.esc(l.quantity)} ${Store.esc(l.unit || "Tons")}</dd></div>
                    <div><dt>Available from</dt><dd>${Store.date(l.availableFrom)}</dd></div>
                    <div class="span-full"><dt>Location</dt><dd>${Store.esc([l.location, l.state].filter(Boolean).join(", "))}</dd></div>
                </dl>
                ${l.description ? `<p class="listing-desc">${Store.esc(l.description)}</p>` : ""}
            </div>
            <div class="listing-footer">
                <span class="text-muted">Total: <strong>${Store.inr(Number(l.price) * Number(l.quantity))}</strong></span>
                <a class="btn btn-primary btn-sm" href="purchase-orders.html?listing=${encodeURIComponent(l.id)}">
                    <i class="fa-solid fa-cart-plus"></i> Buy Listing
                </a>
            </div>
        </article>`;
    }).join("");
}
