// =========================
// PLACE PELLET ORDER (US029)
// The plant buys the WHOLE listing: quantity and total come from the
// listing and cannot be changed. Orders cannot be cancelled once placed.
// =========================

let activeListings = [];
let submitting = false;

document.addEventListener("DOMContentLoaded", () => {

    activeListings = Store.get("pelletListings").filter(l => l.status === "Active" && Number(l.quantity) > 0);

    populateListings();
    setDefaultAddress();
    Plant.counter("notes", "notesCount");

    const form = document.getElementById("orderForm");
    document.getElementById("listingSelect").addEventListener("change", onListingChange);
    form.addEventListener("submit", submitOrder);
    form.addEventListener("reset", () => setTimeout(() => {
        Validator.reset(form);
        onListingChange();
    }, 0));

    // prefill from marketplace (?listing=PL-501)
    const pre = Plant.param("listing");
    if (pre) {
        if (activeListings.some(l => l.id === pre)) {
            document.getElementById("listingSelect").value = pre;
        } else {
            showToast("The selected listing is no longer available. Please choose another listing.", "warning");
        }
    }
    onListingChange();
});

function populateListings() {
    const select = document.getElementById("listingSelect");
    activeListings.forEach(l => {
        select.insertAdjacentHTML("beforeend",
            `<option value="${Store.esc(l.id)}">${Store.esc(l.pelletType)} (${Store.esc(l.grade)}) — ${Store.esc(l.manufacturer)} · ${Plant.num(l.quantity)} t @ ${Store.inr(l.price)}/t</option>`);
    });
    if (!activeListings.length) {
        select.insertAdjacentHTML("beforeend", `<option value="" disabled>No active listings available</option>`);
    }
}

function setDefaultAddress() {
    const p = Plant.profile();
    const field = document.getElementById("deliveryAddress");
    const address = [p.address, [p.city, p.pincode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    field.value = address;
    field.defaultValue = address;   // restored by the Clear button
}

function selectedListing() {
    const id = document.getElementById("listingSelect").value;
    return activeListings.find(l => l.id === id) || null;
}

function lotTotal(l) {
    return Number(l.quantity) * Number(l.price);
}

function onListingChange() {
    const l = selectedListing();

    document.getElementById("supplierName").value = l ? l.manufacturer : "";
    document.getElementById("quantity").value = l ? Plant.num(l.quantity) + " t (whole lot)" : "";
    document.getElementById("price").value = l ? Store.inr(l.price) : "";
    document.getElementById("total").value = l ? Store.inr(lotTotal(l)) : "";

    document.getElementById("listingSummary").innerHTML = l ? summaryHtml(l)
        : `<div class="empty-state"><i class="fa-solid fa-box-open"></i>Select a listing to see its quality specifications.</div>`;
}

function summaryHtml(l) {
    return `
        <dl class="detail-list">
            <div class="span-full"><dt>Supplier Rating</dt><dd>${Store.ratingHtml(l.manufacturer)}</dd></div>
            <div><dt>Listing</dt><dd>${Store.esc(l.id)}</dd></div>
            <div><dt>Grade</dt><dd>${Store.esc(l.grade)}</dd></div>
            <div><dt>Calorific Value</dt><dd>${Plant.num(l.calorificValue, 0)} kcal/kg</dd></div>
            <div><dt>Moisture</dt><dd>${Plant.num(l.moisture)}%</dd></div>
            <div><dt>Ash Content</dt><dd>${Plant.num(l.ashContent)}%</dd></div>
            <div><dt>Bulk Density</dt><dd>${Plant.num(l.bulkDensity, 0)} kg/m³</dd></div>
            <div><dt>Size (Ø × L)</dt><dd>${Plant.num(l.diameter)} × ${Plant.num(l.length)} mm</dd></div>
            <div><dt>Certification</dt><dd>${l.certification ? Store.esc(l.certification) : "—"}</dd></div>
            <div><dt>Dispatch From</dt><dd>${Store.esc(l.location)}</dd></div>
            <div><dt>Available From</dt><dd>${Store.date(l.availableFrom)}</dd></div>
        </dl>
        <div class="summary-total">
            <span class="text-muted">Order total · ${Plant.num(l.quantity)} t</span>
            <strong>${Store.inr(lotTotal(l))}</strong>
        </div>`;
}

async function submitOrder(e) {
    e.preventDefault();
    if (submitting) return;

    if (!Validator.validateForm("#orderForm")) return;

    const selected = selectedListing();
    const listing = selected && Store.find("pelletListings", selected.id);

    if (!listing || listing.status !== "Active") {
        showToast("This listing is no longer available. Please choose another listing.", "error");
        return;
    }

    submitting = true;
    const ok = await confirmDialog({
        title: "Place order for the whole lot?",
        message: `${Plant.num(listing.quantity)} t of ${listing.pelletType} from ${listing.manufacturer} for ${Store.inr(lotTotal(listing))}. ` +
            "Once placed, the order cannot be cancelled.",
        confirmText: "Place Order",
        cancelText: "Go Back"
    });
    if (!ok) {
        submitting = false;
        return;
    }

    const order = Store.placeOrder("pellet", listing.id, {
        powerPlant: Plant.NAME,
        deliveryAddress: document.getElementById("deliveryAddress").value.trim(),
        notes: document.getElementById("notes").value.trim()
    });

    if (!order) {
        submitting = false;
        showToast("This listing has just been sold. Please choose another listing.", "error");
        return;
    }

    Toast.redirect("tracking.html?order=" + encodeURIComponent(order.id),
        `Order ${order.id} placed with ${order.manufacturer}. The logistics team will schedule the pickup.`, "success");
}
