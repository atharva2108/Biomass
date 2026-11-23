// =========================
// PELLET MARKETPLACE (US028)
// Each listing is bought as a whole lot. The supplier rating is
// computed by Store from the batch details power plants submit.
// =========================

let listings = [];
let ratings = {};

document.addEventListener("DOMContentLoaded", () => {

    listings = Store.get("pelletListings").filter(l => l.status === "Active" && Number(l.quantity) > 0);
    [...new Set(listings.map(l => l.manufacturer))].forEach(name => {
        ratings[name] = Store.manufacturerRating(name);
    });

    fillSelect("gradeFilter", listings.map(l => l.grade));
    fillSelect("supplierFilter", listings.map(l => l.manufacturer));

    document.getElementById("searchInput").addEventListener("input", render);
    ["gradeFilter", "supplierFilter", "sortBy"].forEach(id =>
        document.getElementById(id).addEventListener("change", render));
    ["maxPrice", "minCv"].forEach(id =>
        document.getElementById(id).addEventListener("input", render));

    document.getElementById("resetFilters").addEventListener("click", resetFilters);

    document.getElementById("listingGrid").addEventListener("click", e => {
        const btn = e.target.closest("[data-view]");
        if (btn) openDetails(btn.dataset.view);
        const reset = e.target.closest("[data-reset]");
        if (reset) resetFilters();
    });

    render();
});

function fillSelect(id, values) {
    const select = document.getElementById(id);
    [...new Set(values.filter(Boolean))].sort().forEach(v => {
        select.insertAdjacentHTML("beforeend", `<option value="${Store.esc(v)}">${Store.esc(v)}</option>`);
    });
}

function numericFilter(id) {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
        Validator.validateField(el);
        return null;
    }
    // ignore the filter until the value is valid (inline error explains why)
    return Validator.validateField(el) ? Number(el.value) : null;
}

function ratingScore(l) {
    const r = ratings[l.manufacturer];
    return r && r.count ? r.score : -1;   // new suppliers last
}

function lotTotal(l) {
    return Number(l.quantity) * Number(l.price);
}

function render() {
    const q = document.getElementById("searchInput").value.trim().toLowerCase();
    const grade = document.getElementById("gradeFilter").value;
    const supplier = document.getElementById("supplierFilter").value;
    const sort = document.getElementById("sortBy").value;
    const maxPrice = numericFilter("maxPrice");
    const minCv = numericFilter("minCv");

    let list = listings.filter(l => {
        const text = [l.pelletType, l.manufacturer, l.location, l.grade].join(" ").toLowerCase();
        if (q && !text.includes(q)) return false;
        if (grade && l.grade !== grade) return false;
        if (supplier && l.manufacturer !== supplier) return false;
        if (maxPrice !== null && Number(l.price) > maxPrice) return false;
        if (minCv !== null && Number(l.calorificValue) < minCv) return false;
        return true;
    });

    const sorters = {
        newest: (a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""),
        ratingDesc: (a, b) => ratingScore(b) - ratingScore(a),
        priceAsc: (a, b) => a.price - b.price,
        priceDesc: (a, b) => b.price - a.price,
        cvDesc: (a, b) => b.calorificValue - a.calorificValue,
        qtyDesc: (a, b) => b.quantity - a.quantity
    };
    list = list.slice().sort(sorters[sort] || sorters.newest);

    document.getElementById("resultCount").textContent =
        list.length + " of " + listings.length + " listing" + (listings.length === 1 ? "" : "s") + " shown";

    const grid = document.getElementById("listingGrid");

    if (!listings.length) {
        grid.innerHTML = `<div class="card"><div class="empty-state"><i class="fa-solid fa-store-slash"></i>No pellet listings are available right now. Please check back later.</div></div>`;
        return;
    }

    if (!list.length) {
        grid.innerHTML = `<div class="card"><div class="empty-state"><i class="fa-solid fa-filter-circle-xmark"></i>No listings match your filters.
            <div class="mt-2"><button class="btn btn-secondary btn-sm" type="button" data-reset>Clear filters</button></div></div></div>`;
        return;
    }

    grid.innerHTML = list.map(cardHtml).join("");
}

function availability(l) {
    return l.availableFrom && l.availableFrom > Store.iso(0)
        ? "Available from " + Store.date(l.availableFrom)
        : "Available now";
}

function cardHtml(l) {
    const gradeClass = String(l.grade).toLowerCase() === "premium" ? "badge badge-success" : "badge";
    return `
        <article class="card listing-card">
            <div class="card-body">
                <div class="flex between">
                    <span class="${gradeClass}">${Store.esc(l.grade)}</span>
                    <span class="text-subtle">${Store.esc(l.id)}</span>
                </div>
                <h3>${Store.esc(l.pelletType)}</h3>
                <div class="listing-supplier">
                    <span><i class="fa-solid fa-industry"></i>${Store.esc(l.manufacturer)}</span>
                    <span><i class="fa-solid fa-location-dot"></i>${Store.esc(l.location)}</span>
                </div>
                <div class="listing-rating">${Store.ratingHtml(l.manufacturer)}</div>

                <div class="price-row">
                    <div><strong>${Store.inr(l.price)}</strong><small>/ ton</small></div>
                    <div class="text-right"><strong>${Plant.num(l.quantity)} t</strong><small>whole lot</small></div>
                </div>

                <dl class="spec-grid">
                    <div><dt>Calorific</dt><dd>${Plant.num(l.calorificValue, 0)} kcal/kg</dd></div>
                    <div><dt>Moisture</dt><dd>${Plant.num(l.moisture)}%</dd></div>
                    <div><dt>Ash</dt><dd>${Plant.num(l.ashContent)}%</dd></div>
                    <div><dt>Diameter</dt><dd>${Plant.num(l.diameter)} mm</dd></div>
                    <div><dt>Length</dt><dd>${Plant.num(l.length)} mm</dd></div>
                    <div><dt>Density</dt><dd>${Plant.num(l.bulkDensity, 0)} kg/m³</dd></div>
                </dl>

                <div class="listing-meta">
                    <span><i class="fa-solid fa-indian-rupee-sign"></i>Lot total ${Store.inr(lotTotal(l))}</span>
                    <span><i class="fa-solid fa-calendar-check"></i>${availability(l)}</span>
                    <span><i class="fa-solid fa-award"></i>${l.certification ? Store.esc(l.certification) : "No certification declared"}</span>
                </div>
            </div>
            <div class="listing-actions">
                <button class="btn btn-secondary btn-sm" type="button" data-view="${Store.esc(l.id)}"><i class="fa-solid fa-circle-info"></i> Details</button>
                <a class="btn btn-primary btn-sm" href="purchase-orders.html?listing=${encodeURIComponent(l.id)}"><i class="fa-solid fa-cart-plus"></i> Order</a>
            </div>
        </article>`;
}

function openDetails(id) {
    const l = listings.find(x => x.id === id);
    if (!l) {
        showToast("This listing is no longer available", "warning");
        return;
    }

    document.getElementById("listingModalTitle").textContent = l.pelletType + " · " + l.id;
    document.getElementById("listingModalBody").innerHTML = `
        <dl class="detail-list">
            <div><dt>Supplier</dt><dd>${Store.esc(l.manufacturer)}</dd></div>
            <div><dt>Supplier Rating</dt><dd>${Store.ratingHtml(l.manufacturer)}</dd></div>
            <div><dt>Location</dt><dd>${Store.esc(l.location)}</dd></div>
            <div><dt>Grade</dt><dd>${Store.esc(l.grade)}</dd></div>
            <div><dt>Quantity (whole lot)</dt><dd>${Plant.num(l.quantity)} tons</dd></div>
            <div><dt>Price</dt><dd>${Store.inr(l.price)} / ton</dd></div>
            <div><dt>Lot Total</dt><dd>${Store.inr(lotTotal(l))}</dd></div>
            <div><dt>Availability</dt><dd>${availability(l)}</dd></div>
            <div><dt>Calorific Value</dt><dd>${Plant.num(l.calorificValue, 0)} kcal/kg</dd></div>
            <div><dt>Moisture</dt><dd>${Plant.num(l.moisture)}%</dd></div>
            <div><dt>Ash Content</dt><dd>${Plant.num(l.ashContent)}%</dd></div>
            <div><dt>Bulk Density</dt><dd>${Plant.num(l.bulkDensity, 0)} kg/m³</dd></div>
            <div><dt>Diameter × Length</dt><dd>${Plant.num(l.diameter)} × ${Plant.num(l.length)} mm</dd></div>
            <div><dt>Certification</dt><dd>${l.certification ? Store.esc(l.certification) : "—"}</dd></div>
        </dl>
        <p class="form-hint mt-3"><i class="fa-solid fa-circle-info"></i> The supplier rating is calculated automatically from the moisture, ash and calorific value that power plants measure on delivered batches.</p>`;
    document.getElementById("listingModalOrder").href = "purchase-orders.html?listing=" + encodeURIComponent(l.id);
    Plant.openModal("listingModal");
}

function resetFilters() {
    ["searchInput", "maxPrice", "minCv"].forEach(id => { document.getElementById(id).value = ""; });
    ["gradeFilter", "supplierFilter"].forEach(id => { document.getElementById(id).value = ""; });
    document.getElementById("sortBy").value = "newest";
    Validator.reset("#filterForm");
    render();
}
