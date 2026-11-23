// =========================
// CREATE PELLET LISTING (US020 + US021 quality parameters)
// A power plant buys the whole listing in one order (Store.placeOrder).
// =========================

const MANUFACTURER = "GreenPellet Industries";

/* ---------- Grade rules (also used on the manage page) ---------- */

function isPremium(el) {
    const grade = el && el.form && el.form.querySelector("[data-grade-select]");
    return !!grade && grade.value === "Premium";
}

Validator.addRule("premiumMax", (v, p, el, label) =>
    isPremium(el) && Number(v) > Number(p) ? label + " must be at most " + p + " for Premium grade" : "");

Validator.addRule("premiumMin", (v, p, el, label) =>
    isPremium(el) && Number(v) < Number(p) ? label + " must be at least " + p + " for Premium grade" : "");

/* ---------- Page ---------- */

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("pelletForm");

    // re-check grade dependent parameters when the grade changes
    document.getElementById("grade").addEventListener("change", () => {
        ["moisture", "ashContent", "calorificValue"].forEach(id => {
            const el = document.getElementById(id);
            if (el.value) Validator.validateField(el);
        });
    });

    ["quantity", "price"].forEach(id => document.getElementById(id).addEventListener("input", updateValue));

    form.addEventListener("reset", () => {
        setTimeout(() => {
            Validator.reset(form);
            updateValue();
        }, 0);
    });

    form.addEventListener("submit", e => {
        e.preventDefault();
        publishListing();
    });
});

function updateValue() {
    const qty = Number(document.getElementById("quantity").value);
    const price = Number(document.getElementById("price").value);
    const value = qty > 0 && price > 0 ? Math.round(qty * price * 100) / 100 : 0;
    document.getElementById("listingValue").textContent = Store.inr(value);
}

function publishListing() {
    const form = document.getElementById("pelletForm");
    if (!Validator.validateForm(form)) return;

    const val = id => document.getElementById(id).value.trim();
    const num = id => Number(document.getElementById(id).value);

    const listing = Store.add("pelletListings", {
        manufacturer: MANUFACTURER,
        pelletType: val("pelletType"),
        grade: val("grade"),
        quantity: num("quantity"),
        price: num("price"),
        diameter: num("diameter"),
        length: num("length"),
        moisture: num("moisture"),
        ashContent: num("ashContent"),
        calorificValue: num("calorificValue"),
        bulkDensity: num("bulkDensity"),
        location: val("location"),
        availableFrom: val("availableFrom"),
        certification: val("certification"),
        status: "Active"
    });

    Toast.redirect("pellet-management.html",
        "Pellet listing " + listing.id + " (" + listing.quantity + " t " + listing.pelletType + ") is now live for power plants.",
        "success");
}
