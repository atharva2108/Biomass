// =========================
// FARMER — CREATE BIOMASS LISTING (US009)
// Validation rules live on the inputs (data-rules) — see validation.js
// =========================

document.addEventListener("DOMContentLoaded", () => {

    Farmer.fillSelect("biomassType", BIOMASS_TYPES, "Select biomass type");
    Farmer.fillSelect("state", INDIAN_STATES, "Select state");

    const form = document.getElementById("listingForm");
    const updateCount = Farmer.counter("description", "descCount", 500);

    // prefill the farmer's district / state from the profile when available
    const profile = Farmer.readJSON("bc_profile_farmer", {});
    prefillLocation(profile);

    form.addEventListener("input", updateSummary);
    form.addEventListener("change", updateSummary);
    updateSummary();

    document.getElementById("resetBtn").addEventListener("click", () => {
        resetForm(profile);
        updateCount();
        showToast("Form cleared", "info");
    });

    form.addEventListener("submit", e => {
        e.preventDefault();
        createListing(profile);
    });
});

function prefillLocation(profile) {
    if (profile.district) document.getElementById("district").value = profile.district;
    if (profile.state && INDIAN_STATES.includes(profile.state)) document.getElementById("state").value = profile.state;
    if (profile.village) document.getElementById("location").value = profile.village;
}

function value(id) {
    return document.getElementById(id).value.trim();
}

function updateSummary() {
    const qty = Number(value("quantity"));
    const price = Number(value("price"));
    const valid = qty > 0 && price > 0 && !isNaN(qty) && !isNaN(price);

    document.getElementById("estimateValue").textContent = valid ? Store.inr(Math.round(qty * price * 100) / 100) : "₹0";
    document.getElementById("estimateBreakdown").textContent = valid
        ? Farmer.tons(qty) + " × " + Store.inr(price) + " per ton"
        : "Enter quantity and price to see the estimate";

    const location = [value("location"), value("district"), value("state")].filter(Boolean).join(", ");
    const date = value("availableFrom");

    document.getElementById("sumType").textContent = value("biomassType") || "—";
    document.getElementById("sumDate").textContent = Validator.parseDate(date) ? Store.date(date) : "—";
    document.getElementById("sumLocation").textContent = location || "—";
}

function resetForm(profile) {
    const form = document.getElementById("listingForm");
    form.reset();
    Validator.reset(form);
    prefillLocation(profile);
    updateSummary();
}

async function createListing(profile) {

    if (!Validator.validateForm("#listingForm")) return;

    const data = {
        farmer: FARMER_NAME,
        biomassType: value("biomassType"),
        quantity: Number(value("quantity")),
        unit: "Tons",
        price: Number(value("price")),
        location: value("location"),
        district: value("district"),
        state: value("state"),
        availableFrom: value("availableFrom"),
        description: value("description"),
        status: "Active"
    };

    // warn about an identical active listing (same type at the same pickup point)
    const duplicate = Farmer.listings().find(l =>
        l.status === "Active" &&
        l.biomassType === data.biomassType &&
        String(l.location).toLowerCase() === data.location.toLowerCase());

    if (duplicate) {
        const proceed = await confirmDialog({
            title: "Similar listing exists",
            message: "You already have an active " + data.biomassType + " listing at " + duplicate.location +
                " (" + duplicate.id + "). Create another listing anyway?",
            confirmText: "Create anyway"
        });
        if (!proceed) {
            showToast("Listing not created. You can update " + duplicate.id + " from Manage Listings.", "info");
            return;
        }
    }

    const btn = document.getElementById("submitBtn");
    btn.disabled = true;

    const record = Store.add("biomassListings", data);

    Toast.redirect("manage-listings.html",
        "Listing " + record.id + " created: " + Farmer.tons(record.quantity) + " of " + record.biomassType + " is now live.",
        "success");
}
