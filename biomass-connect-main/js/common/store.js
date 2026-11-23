/* =========================================================
   BIOMASS CONNECT — SHARED DATA STORE (localStorage, front-end only)
   ---------------------------------------------------------
   Each collection below maps 1:1 to a database table.

   biomassListings  — created by Farmers, bought (whole) by Manufacturers
     { id, farmer, biomassType, quantity, unit:"Tons", price (₹/ton),
       location, district, state, availableFrom (YYYY-MM-DD),
       description, status: "Active" | "Inactive" | "Sold Out", createdAt }

   pelletListings   — created by Manufacturers, bought (whole) by Power Plants
     { id, manufacturer, pelletType, grade, quantity, price, diameter (mm),
       length (mm), moisture (%), ashContent (%), calorificValue (kcal/kg),
       bulkDensity (kg/m3), location, availableFrom, certification,
       status: "Active" | "Inactive" | "Sold Out", createdAt }

   purchaseOrders   — Manufacturer buys a whole biomass listing from a Farmer
   pelletOrders     — Power Plant buys a whole pellet listing from a Manufacturer
     Common fields:
     { id, listingId, quantity, price, total, orderDate,
       pickupAddress, deliveryAddress, notes,
       status: "Placed" | "Pickup Scheduled" | "In Transit" | "Delivered",
       // logistics — entered ONLY by the logistics team
       pickupDate, vehicleNo, driverName, driverMobile, expectedDelivery,
       dispatchedDate, deliveredDate,
       // payment — buyer pays seller after delivery
       paymentStatus: "Pending" | "Paid", paidOn }
     purchaseOrders also: farmer, manufacturer, biomassType
     pelletOrders also:   manufacturer, powerPlant, pelletType, grade

     Orders are never accepted / rejected / cancelled: once placed, the
     seller must supply and the buyer cannot cancel.

   pelletFeedback   — Power Plant measures a delivered pellet batch
     { id, orderId, manufacturer, powerPlant, pelletType, receivedDate,
       quantityReceived, moisture, ashContent, calorificValue,
       declared { moisture, ashContent, calorificValue },
       score (1–5, computed), remarks, createdAt }

   complaints       — raised by Farmer / Manufacturer / Power Plant,
                      viewed and resolved by Admin (Dispute Management)
     { id, raisedBy, role: "farmer" | "manufacturer" | "powerplant",
       against, orderId, category, description,
       status: "Open" | "Resolved", date, resolution, resolvedOn }

   certificates     — Government norms compliance certificate,
                      issued by Admin to a Power Plant
     { id, certificateNo, plant, title, issueDate, validUntil,
       remarks, issuedBy }

   API:
     Store.get(key) / set(key, array) / find(key, id)
     Store.add(key, item, prefix) / update(key, id, patch) / remove(key, id)
     Store.nextId(key, prefix)
     Store.placeOrder("biomass" | "pellet", listingId, buyerFields) → order | null
     Store.batchScore(declared, measured) → 1..5
     Store.manufacturerRating(name) → { score, count }
     Store.ratingHtml(name) → "★ 4.3 (2 batches)" badge html
     Store.trackingHtml(order) → read-only stepper + logistics details
   Helpers:
     Store.esc(str), Store.inr(n), Store.date(iso), Store.iso(offsetDays)
     Store.badge(status) → css class,  Store.statusBadge(status) → html
     Store.ORDER_STEPS, Store.COMPLAINT_CATEGORIES
========================================================= */

(function () {

    /* ---------------- Data version ----------------
       Bump when the seed data shape changes. Old demo data is cleared
       (sign-in, users and profiles are kept). */

    const DATA_VERSION = "2";
    const KEEP = ["users", "isLoggedIn", "role", "bc_current_user", "bc_remember_user", "bc_data_version"];

    try {
        if (localStorage.getItem("bc_data_version") !== DATA_VERSION) {
            Object.keys(localStorage).forEach(k => {
                if (!KEEP.includes(k) && !k.startsWith("bc_profile_")) localStorage.removeItem(k);
            });
            localStorage.setItem("bc_data_version", DATA_VERSION);
        }
    } catch (e) { /* storage unavailable */ }

    function iso(offsetDays) {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }

    const ORDER_STEPS = ["Placed", "Pickup Scheduled", "In Transit", "Delivered"];

    const COMPLAINT_CATEGORIES = {
        farmer: ["Payment not received", "Payment delayed", "Wrong amount paid", "Partial payment received"],
        manufacturer: ["Payment not received", "Payment delayed", "Wrong amount paid", "Biomass quality issue", "Quantity mismatch", "Other"],
        powerplant: ["Pellet quality issue", "Quantity mismatch", "Billing issue", "Other"]
    };

    function blankLogistics() {
        return { pickupDate: "", vehicleNo: "", driverName: "", driverMobile: "", expectedDelivery: "", dispatchedDate: "", deliveredDate: "" };
    }

    function order(fields) {
        return Object.assign({ notes: "", paymentStatus: "Pending", paidOn: "" }, blankLogistics(), fields);
    }

    const GP_ADDR = "Plot 14, MIDC Ambad, Nashik 422010";
    const ECO_ADDR = "Gat 221, Chakan MIDC, Pune 410501";
    const NTPC_ADDR = "Eklahare, Nashik 422105";

    const SEED = {

        biomassListings: [
            { id: "BL-1001", farmer: "Ramesh Patil", biomassType: "Rice Husk", quantity: 40, unit: "Tons", price: 2000, location: "Nashik", district: "Nashik", state: "Maharashtra", availableFrom: iso(-5), description: "Clean, dry rice husk stored under cover.", status: "Active", createdAt: iso(-10) },
            { id: "BL-1002", farmer: "Ramesh Patil", biomassType: "Wheat Straw", quantity: 25, unit: "Tons", price: 2150, location: "Niphad", district: "Nashik", state: "Maharashtra", availableFrom: iso(2), description: "Baled wheat straw, ready for pickup.", status: "Active", createdAt: iso(-8) },
            { id: "BL-1003", farmer: "Sunita Jadhav", biomassType: "Sugarcane Bagasse", quantity: 60, unit: "Tons", price: 1800, location: "Baramati", district: "Pune", state: "Maharashtra", availableFrom: iso(0), description: "Fresh bagasse from the current crushing season.", status: "Active", createdAt: iso(-6) },
            { id: "BL-1004", farmer: "Ramesh Patil", biomassType: "Cotton Stalk", quantity: 12, unit: "Tons", price: 1800, location: "Nashik", district: "Nashik", state: "Maharashtra", availableFrom: iso(-15), description: "Shredded cotton stalk.", status: "Sold Out", createdAt: iso(-20) },
            { id: "BL-1005", farmer: "Vijay Shinde", biomassType: "Soybean Husk", quantity: 30, unit: "Tons", price: 2400, location: "Latur", district: "Latur", state: "Maharashtra", availableFrom: iso(5), description: "Soybean husk, low ash content.", status: "Active", createdAt: iso(-3) },
            { id: "BL-1006", farmer: "Ramesh Patil", biomassType: "Rice Husk", quantity: 20, unit: "Tons", price: 2000, location: "Nashik", district: "Nashik", state: "Maharashtra", availableFrom: iso(-6), description: "Rice husk from the kharif harvest.", status: "Sold Out", createdAt: iso(-9) },
            { id: "BL-1007", farmer: "Ramesh Patil", biomassType: "Wheat Straw", quantity: 15, unit: "Tons", price: 2150, location: "Niphad", district: "Nashik", state: "Maharashtra", availableFrom: iso(-20), description: "Baled wheat straw.", status: "Sold Out", createdAt: iso(-25) },
            { id: "BL-1008", farmer: "Sunita Jadhav", biomassType: "Sugarcane Bagasse", quantity: 30, unit: "Tons", price: 1800, location: "Baramati", district: "Pune", state: "Maharashtra", availableFrom: iso(-8), description: "Sun-dried bagasse.", status: "Sold Out", createdAt: iso(-12) },
            { id: "BL-1009", farmer: "Ramesh Patil", biomassType: "Maize Stover", quantity: 18, unit: "Tons", price: 1700, location: "Nashik", district: "Nashik", state: "Maharashtra", availableFrom: iso(-7), description: "Chopped maize stover.", status: "Sold Out", createdAt: iso(-11) },
            { id: "BL-1010", farmer: "Ramesh Patil", biomassType: "Rice Straw", quantity: 22, unit: "Tons", price: 1600, location: "Nashik", district: "Nashik", state: "Maharashtra", availableFrom: iso(-30), description: "Rice straw bales.", status: "Sold Out", createdAt: iso(-34) }
        ],

        purchaseOrders: [
            order({ id: "PO-B2044", listingId: "BL-1004", farmer: "Ramesh Patil", manufacturer: "GreenPellet Industries", biomassType: "Cotton Stalk", quantity: 12, price: 1800, total: 21600, orderDate: iso(-1), pickupAddress: "Nashik, Nashik, Maharashtra", deliveryAddress: GP_ADDR, status: "Placed" }),
            order({ id: "PO-B2041", listingId: "BL-1006", farmer: "Ramesh Patil", manufacturer: "GreenPellet Industries", biomassType: "Rice Husk", quantity: 20, price: 2000, total: 40000, orderDate: iso(-3), pickupAddress: "Nashik, Nashik, Maharashtra", deliveryAddress: GP_ADDR, status: "Pickup Scheduled",
                pickupDate: iso(1), vehicleNo: "MH15EF2290", driverName: "Santosh Kale", driverMobile: "9823011456", expectedDelivery: iso(2) }),
            order({ id: "PO-B2045", listingId: "BL-1009", farmer: "Ramesh Patil", manufacturer: "GreenPellet Industries", biomassType: "Maize Stover", quantity: 18, price: 1700, total: 30600, orderDate: iso(-5), pickupAddress: "Nashik, Nashik, Maharashtra", deliveryAddress: GP_ADDR, status: "In Transit",
                pickupDate: iso(-1), vehicleNo: "MH15GH7741", driverName: "Raju Shaikh", driverMobile: "9767120034", expectedDelivery: iso(1), dispatchedDate: iso(-1) }),
            order({ id: "PO-B2043", listingId: "BL-1008", farmer: "Sunita Jadhav", manufacturer: "GreenPellet Industries", biomassType: "Sugarcane Bagasse", quantity: 30, price: 1800, total: 54000, orderDate: iso(-6), pickupAddress: "Baramati, Pune, Maharashtra", deliveryAddress: GP_ADDR, notes: "Deliver before noon", status: "In Transit",
                pickupDate: iso(-2), vehicleNo: "MH42CD7810", driverName: "Vikas Jagtap", driverMobile: "9890556621", expectedDelivery: iso(1), dispatchedDate: iso(-2) }),
            order({ id: "PO-B2042", listingId: "BL-1007", farmer: "Ramesh Patil", manufacturer: "EcoFuel Pellets Ltd", biomassType: "Wheat Straw", quantity: 15, price: 2150, total: 32250, orderDate: iso(-14), pickupAddress: "Niphad, Nashik, Maharashtra", deliveryAddress: ECO_ADDR, status: "Delivered",
                pickupDate: iso(-8), vehicleNo: "MH15AB4521", driverName: "Ganesh Pawar", driverMobile: "9822340098", expectedDelivery: iso(-6), dispatchedDate: iso(-8), deliveredDate: iso(-6), paymentStatus: "Paid", paidOn: iso(-2) }),
            order({ id: "PO-B2040", listingId: "BL-1010", farmer: "Ramesh Patil", manufacturer: "GreenPellet Industries", biomassType: "Rice Straw", quantity: 22, price: 1600, total: 35200, orderDate: iso(-28), pickupAddress: "Nashik, Nashik, Maharashtra", deliveryAddress: GP_ADDR, status: "Delivered",
                pickupDate: iso(-24), vehicleNo: "MH15CD1180", driverName: "Santosh Kale", driverMobile: "9823011456", expectedDelivery: iso(-23), dispatchedDate: iso(-24), deliveredDate: iso(-23) })
        ],

        pelletListings: [
            { id: "PL-501", manufacturer: "GreenPellet Industries", pelletType: "Agro Residue Pellets", grade: "Premium", quantity: 120, price: 7800, diameter: 8, length: 30, moisture: 8, ashContent: 6, calorificValue: 4200, bulkDensity: 650, location: "Nashik, Maharashtra", availableFrom: iso(0), certification: "BIS IS 17583", status: "Active", createdAt: iso(-7) },
            { id: "PL-502", manufacturer: "GreenPellet Industries", pelletType: "Rice Husk Pellets", grade: "Standard", quantity: 80, price: 6900, diameter: 10, length: 35, moisture: 10, ashContent: 12, calorificValue: 3600, bulkDensity: 620, location: "Nashik, Maharashtra", availableFrom: iso(3), certification: "", status: "Active", createdAt: iso(-4) },
            { id: "PL-503", manufacturer: "EcoFuel Pellets Ltd", pelletType: "Bagasse Pellets", grade: "Premium", quantity: 200, price: 7500, diameter: 8, length: 28, moisture: 9, ashContent: 5, calorificValue: 4100, bulkDensity: 640, location: "Pune, Maharashtra", availableFrom: iso(-1), certification: "BIS IS 17583", status: "Active", createdAt: iso(-9) },
            { id: "PL-504", manufacturer: "GreenPellet Industries", pelletType: "Agro Residue Pellets", grade: "Premium", quantity: 50, price: 7800, diameter: 8, length: 30, moisture: 8, ashContent: 6, calorificValue: 4200, bulkDensity: 650, location: "Nashik, Maharashtra", availableFrom: iso(-16), certification: "BIS IS 17583", status: "Sold Out", createdAt: iso(-18) },
            { id: "PL-505", manufacturer: "EcoFuel Pellets Ltd", pelletType: "Bagasse Pellets", grade: "Premium", quantity: 50, price: 7500, diameter: 8, length: 28, moisture: 9, ashContent: 5, calorificValue: 4100, bulkDensity: 640, location: "Pune, Maharashtra", availableFrom: iso(-6), certification: "BIS IS 17583", status: "Sold Out", createdAt: iso(-8) },
            { id: "PL-506", manufacturer: "GreenPellet Industries", pelletType: "Rice Husk Pellets", grade: "Standard", quantity: 40, price: 6900, diameter: 10, length: 35, moisture: 10, ashContent: 12, calorificValue: 3600, bulkDensity: 620, location: "Nashik, Maharashtra", availableFrom: iso(-3), certification: "", status: "Sold Out", createdAt: iso(-5) },
            { id: "PL-507", manufacturer: "GreenPellet Industries", pelletType: "Agro Residue Pellets", grade: "Premium", quantity: 30, price: 7800, diameter: 8, length: 30, moisture: 8, ashContent: 6, calorificValue: 4200, bulkDensity: 650, location: "Nashik, Maharashtra", availableFrom: iso(-1), certification: "BIS IS 17583", status: "Sold Out", createdAt: iso(-2) },
            { id: "PL-508", manufacturer: "GreenPellet Industries", pelletType: "Agro Residue Pellets", grade: "Standard", quantity: 45, price: 7200, diameter: 8, length: 32, moisture: 9, ashContent: 8, calorificValue: 3900, bulkDensity: 630, location: "Nashik, Maharashtra", availableFrom: iso(-30), certification: "", status: "Sold Out", createdAt: iso(-32) },
            { id: "PL-509", manufacturer: "EcoFuel Pellets Ltd", pelletType: "Bagasse Pellets", grade: "Premium", quantity: 60, price: 7500, diameter: 8, length: 28, moisture: 9, ashContent: 5, calorificValue: 4100, bulkDensity: 640, location: "Pune, Maharashtra", availableFrom: iso(-40), certification: "BIS IS 17583", status: "Sold Out", createdAt: iso(-42) }
        ],

        pelletOrders: [
            order({ id: "PP-3013", listingId: "PL-507", manufacturer: "GreenPellet Industries", powerPlant: "Tata Power Trombay", pelletType: "Agro Residue Pellets", grade: "Premium", quantity: 30, price: 7800, total: 234000, orderDate: iso(0), pickupAddress: "Nashik, Maharashtra", deliveryAddress: "Trombay, Mumbai 400074", status: "Placed" }),
            order({ id: "PP-3012", listingId: "PL-506", manufacturer: "GreenPellet Industries", powerPlant: "NTPC Nashik Unit", pelletType: "Rice Husk Pellets", grade: "Standard", quantity: 40, price: 6900, total: 276000, orderDate: iso(-2), pickupAddress: "Nashik, Maharashtra", deliveryAddress: NTPC_ADDR, status: "Pickup Scheduled",
                pickupDate: iso(1), vehicleNo: "MH15JK3301", driverName: "Imran Pathan", driverMobile: "9881224470", expectedDelivery: iso(2) }),
            order({ id: "PP-3011", listingId: "PL-505", manufacturer: "EcoFuel Pellets Ltd", powerPlant: "NTPC Nashik Unit", pelletType: "Bagasse Pellets", grade: "Premium", quantity: 50, price: 7500, total: 375000, orderDate: iso(-5), pickupAddress: "Pune, Maharashtra", deliveryAddress: NTPC_ADDR, status: "In Transit",
                pickupDate: iso(-1), vehicleNo: "MH12KL5566", driverName: "Sunil Mane", driverMobile: "9850671123", expectedDelivery: iso(1), dispatchedDate: iso(-1) }),
            order({ id: "PP-3009", listingId: "PL-508", manufacturer: "GreenPellet Industries", powerPlant: "NTPC Nashik Unit", pelletType: "Agro Residue Pellets", grade: "Standard", quantity: 45, price: 7200, total: 324000, orderDate: iso(-30), pickupAddress: "Nashik, Maharashtra", deliveryAddress: NTPC_ADDR, status: "Delivered",
                pickupDate: iso(-27), vehicleNo: "MH15GH1122", driverName: "Imran Pathan", driverMobile: "9881224470", expectedDelivery: iso(-26), dispatchedDate: iso(-27), deliveredDate: iso(-26), paymentStatus: "Paid", paidOn: iso(-20) }),
            order({ id: "PP-3008", listingId: "PL-504", manufacturer: "GreenPellet Industries", powerPlant: "NTPC Nashik Unit", pelletType: "Agro Residue Pellets", grade: "Premium", quantity: 50, price: 7800, total: 390000, orderDate: iso(-16), pickupAddress: "Nashik, Maharashtra", deliveryAddress: NTPC_ADDR, status: "Delivered",
                pickupDate: iso(-5), vehicleNo: "MH15GH1122", driverName: "Imran Pathan", driverMobile: "9881224470", expectedDelivery: iso(-3), dispatchedDate: iso(-5), deliveredDate: iso(-3) }),
            order({ id: "PP-3006", listingId: "PL-509", manufacturer: "EcoFuel Pellets Ltd", powerPlant: "Tata Power Trombay", pelletType: "Bagasse Pellets", grade: "Premium", quantity: 60, price: 7500, total: 450000, orderDate: iso(-40), pickupAddress: "Pune, Maharashtra", deliveryAddress: "Trombay, Mumbai 400074", status: "Delivered",
                pickupDate: iso(-36), vehicleNo: "MH12PQ8890", driverName: "Sunil Mane", driverMobile: "9850671123", expectedDelivery: iso(-35), dispatchedDate: iso(-36), deliveredDate: iso(-35), paymentStatus: "Paid", paidOn: iso(-30) })
        ],

        pelletFeedback: [
            { id: "FB-1002", orderId: "PP-3009", manufacturer: "GreenPellet Industries", powerPlant: "NTPC Nashik Unit", pelletType: "Agro Residue Pellets", receivedDate: iso(-26), quantityReceived: 45,
              moisture: 10, ashContent: 8, calorificValue: 3850, declared: { moisture: 9, ashContent: 8, calorificValue: 3900 }, score: 4.5, remarks: "Slightly higher moisture than declared.", createdAt: iso(-25) },
            { id: "FB-1001", orderId: "PP-3006", manufacturer: "EcoFuel Pellets Ltd", powerPlant: "Tata Power Trombay", pelletType: "Bagasse Pellets", receivedDate: iso(-35), quantityReceived: 60,
              moisture: 9, ashContent: 5, calorificValue: 4120, declared: { moisture: 9, ashContent: 5, calorificValue: 4100 }, score: 5, remarks: "Matched the declared specification.", createdAt: iso(-34) }
        ],

        complaints: [
            { id: "CMP-1003", raisedBy: "NTPC Nashik Unit", role: "powerplant", against: "EcoFuel Pellets Ltd", orderId: "PP-3011", category: "Quantity mismatch", description: "The dispatch note shows 48 tons while the order is for 50 tons.", status: "Open", date: iso(-1), resolution: "", resolvedOn: "" },
            { id: "CMP-1002", raisedBy: "Ramesh Patil", role: "farmer", against: "GreenPellet Industries", orderId: "PO-B2040", category: "Payment delayed", description: "Order was delivered more than 3 weeks ago but the payment is still pending.", status: "Open", date: iso(-4), resolution: "", resolvedOn: "" },
            { id: "CMP-1001", raisedBy: "Ramesh Patil", role: "farmer", against: "EcoFuel Pellets Ltd", orderId: "PO-B2042", category: "Payment not received", description: "The order was delivered on time but the payment was not credited after five days.", status: "Resolved", date: iso(-4), resolution: "The buyer has released the payment and it has been credited to your account.", resolvedOn: iso(-2) }
        ],

        certificates: [
            { id: "CERT-1001", certificateNo: "BC/GN/2026/1001", plant: "NTPC Nashik Unit", title: "Government Norms Compliance Certificate", issueDate: iso(-60), validUntil: iso(305), remarks: "Biomass co-firing as per the Ministry of Power policy.", issuedBy: "System Admin" }
        ]
    };

    const PREFIX = {
        biomassListings: "BL-", purchaseOrders: "PO-B", pelletListings: "PL-", pelletOrders: "PP-",
        pelletFeedback: "FB-", complaints: "CMP-", certificates: "CERT-"
    };

    /* ---------------- Core CRUD ---------------- */

    function read(key) {
        try {
            const raw = localStorage.getItem(key);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* ignore */ }
        return null;
    }

    function get(key) {
        let data = read(key);
        if (!Array.isArray(data)) {
            data = SEED[key] ? JSON.parse(JSON.stringify(SEED[key])) : [];
            if (SEED[key]) set(key, data);
        }
        return data;
    }

    function set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* quota / private mode */ }
    }

    function nextId(key, prefix) {
        prefix = prefix || PREFIX[key] || "ID-";
        const nums = get(key)
            .map(i => String(i.id || ""))
            .filter(id => id.startsWith(prefix))
            .map(id => parseInt(id.slice(prefix.length), 10))
            .filter(n => !isNaN(n));
        const next = nums.length ? Math.max(...nums) + 1 : 1001;
        return prefix + next;
    }

    function add(key, item, prefix) {
        const list = get(key);
        const record = Object.assign({ id: nextId(key, prefix), createdAt: iso(0) }, item);
        list.unshift(record);
        set(key, list);
        return record;
    }

    function find(key, id) {
        return get(key).find(i => i.id === id) || null;
    }

    function update(key, id, patch) {
        const list = get(key);
        const idx = list.findIndex(i => i.id === id);
        if (idx === -1) return null;
        list[idx] = Object.assign({}, list[idx], patch);
        set(key, list);
        return list[idx];
    }

    function remove(key, id) {
        set(key, get(key).filter(i => i.id !== id));
    }

    /* ---------------- Orders ----------------
       The buyer always takes the WHOLE listing. The listing becomes
       "Sold Out" and the order starts as "Placed"; from then on only
       the logistics team changes it. */

    function placeOrder(kind, listingId, buyer) {
        buyer = buyer || {};
        const isPellet = kind === "pellet";
        const listingKey = isPellet ? "pelletListings" : "biomassListings";
        const listing = find(listingKey, listingId);
        if (!listing || listing.status !== "Active") return null;

        const base = {
            listingId: listing.id,
            quantity: Number(listing.quantity),
            price: Number(listing.price),
            total: Number(listing.quantity) * Number(listing.price),
            orderDate: iso(0),
            deliveryAddress: buyer.deliveryAddress || "",
            notes: buyer.notes || "",
            status: "Placed"
        };

        const record = isPellet
            ? order(Object.assign(base, {
                manufacturer: listing.manufacturer, powerPlant: buyer.powerPlant,
                pelletType: listing.pelletType, grade: listing.grade,
                pickupAddress: listing.location || ""
            }))
            : order(Object.assign(base, {
                farmer: listing.farmer, manufacturer: buyer.manufacturer,
                biomassType: listing.biomassType,
                pickupAddress: [listing.location, listing.district, listing.state].filter(Boolean).join(", ")
            }));

        const saved = add(isPellet ? "pelletOrders" : "purchaseOrders", record);
        update(listingKey, listing.id, { status: "Sold Out" });
        return saved;
    }

    /* ---------------- Manufacturer rating ----------------
       Computed automatically from the batch details a power plant
       enters after delivery. Each parameter scores 1–5:
         moisture / ash : 5 if measured ≤ declared, −1 per % point above
         calorific value: 5 if measured ≥ declared, −1 per 100 kcal/kg below
       Batch score = average of the three. Rating = average of batch scores. */

    function clamp(n) { return Math.max(1, Math.min(5, n)); }

    function batchScore(declared, measured) {
        const d = declared || {};
        const m = measured || {};
        const moisture = clamp(5 - Math.max(0, Number(m.moisture) - Number(d.moisture)));
        const ash = clamp(5 - Math.max(0, Number(m.ashContent) - Number(d.ashContent)));
        const cv = clamp(5 - Math.max(0, Number(d.calorificValue) - Number(m.calorificValue)) / 100);
        return Math.round((moisture + ash + cv) / 3 * 10) / 10;
    }

    function manufacturerRating(name) {
        const scores = get("pelletFeedback").filter(f => f.manufacturer === name).map(f => Number(f.score)).filter(n => !isNaN(n));
        if (!scores.length) return { score: null, count: 0 };
        return { score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10, count: scores.length };
    }

    function ratingHtml(name) {
        const r = manufacturerRating(name);
        if (!r.count) return '<span class="rating rating-new" title="No batch feedback yet">New supplier</span>';
        return '<span class="rating" title="Average quality score from ' + r.count + ' delivered batch' + (r.count === 1 ? "" : "es") + '">' +
            '<i class="fa-solid fa-star"></i> ' + r.score.toFixed(1) +
            ' <small>(' + r.count + ' batch' + (r.count === 1 ? "" : "es") + ")</small></span>";
    }

    /* ---------------- Formatting ---------------- */

    function esc(str) {
        return String(str == null ? "" : str).replace(/[&<>"']/g, c =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    function inr(n) {
        const num = Number(n);
        if (isNaN(num)) return n;
        return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
    }

    function date(isoStr) {
        if (!isoStr) return "—";
        const parts = String(isoStr).split("-").map(Number);
        if (parts.length !== 3) return isoStr;
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }

    function badge(status) {
        const s = String(status || "").toLowerCase();
        if (["delivered", "completed", "paid", "approved", "verified", "active", "resolved", "valid"].includes(s)) return "badge badge-success";
        if (["placed", "pending", "processing", "in review", "unpaid", "open", "under review"].includes(s)) return "badge badge-warning";
        if (["rejected", "cancelled", "blocked", "overdue", "failed", "suspended", "expired"].includes(s)) return "badge badge-danger";
        if (["pickup scheduled", "in transit", "dispatched", "shipped", "confirmed", "in progress"].includes(s)) return "badge badge-info";
        return "badge";
    }

    function statusBadge(status) {
        return '<span class="' + badge(status) + '">' + esc(status) + "</span>";
    }

    /* ---------------- Read-only tracking view ----------------
       Used by Farmer, Manufacturer and Power Plant tracking screens.
       Only the logistics team can change these details. */

    function trackingHtml(o) {
        if (!o) return "";
        const idx = Math.max(0, ORDER_STEPS.indexOf(o.status));
        const delivered = o.status === "Delivered";
        const stepper = '<div class="stepper">' + ORDER_STEPS.map((label, i) =>
            '<div class="step' + (i < idx || (delivered && i === idx) ? " done" : i === idx ? " current" : "") + '">' + label + "</div>").join("") + "</div>";

        const rows = [
            ["Pickup From", o.pickupAddress || "—", true],
            ["Deliver To", o.deliveryAddress || "—", true],
            ["Pickup Date", date(o.pickupDate)],
            ["Expected Delivery", date(o.expectedDelivery)],
            ["Vehicle No.", o.vehicleNo || "—"],
            ["Driver", o.driverName ? o.driverName + (o.driverMobile ? " · " + o.driverMobile : "") : "—"],
            ["Dispatched On", date(o.dispatchedDate)],
            ["Delivered On", date(o.deliveredDate)]
        ];

        return stepper +
            '<dl class="detail-list mt-3">' + rows.map(r =>
                "<div" + (r[2] ? ' class="span-full"' : "") + "><dt>" + r[0] + "</dt><dd>" + esc(r[1]) + "</dd></div>").join("") + "</dl>" +
            '<p class="form-hint mt-3"><i class="fa-solid fa-circle-info"></i> Transport is handled by the Biomass Connect logistics team. ' +
            "These details are updated by them and shown here for your information.</p>";
    }

    window.Store = {
        get, set, find, add, update, remove, nextId,
        placeOrder, batchScore, manufacturerRating, ratingHtml, trackingHtml,
        esc, inr, date, badge, statusBadge, iso,
        ORDER_STEPS, COMPLAINT_CATEGORIES
    };

})();
