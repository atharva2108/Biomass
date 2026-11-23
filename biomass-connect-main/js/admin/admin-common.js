/* =========================================================
   BIOMASS CONNECT — ADMIN SHARED HELPERS
   ---------------------------------------------------------
   Loaded on every admin page after the common scripts
   (toast, validation, store, layout) and before the page script.

   Admin-private collections (seeded on first use):
     admin_users          { id, name, role: Farmer|Manufacturer|Power Plant,
                            email, mobile, location, state,
                            status: Active|Pending|Blocked|Rejected, joined,
                            previousStatus, blockCategory, blockReason, blockedOn }
     admin_verifications  { id, role: farmer|manufacturer|powerplant, name,
                            email, mobile, location, district, state,
                            submitted, status: Pending|Approved|Rejected,
                            docType ("Aadhaar Card" for farmers,
                                     "GST Certificate" for the others),
                            docNumber (Aadhaar no. / GSTIN), docFile, docSize,
                            reviewedOn, reviewedBy, reasonCategory, reason }
     admin_audit_logs     { id, timestamp "YYYY-MM-DD HH:MM", user, role,
                            action, module }
     admin_settings       object (see setting.js)

   Shared collections used by the admin pages (see js/common/store.js):
     purchaseOrders, pelletOrders  → Orders & Transactions, Reports
     complaints                    → Dispute Management (view + resolve)
     certificates                  → Audit & Compliance (issue)
     pelletFeedback                → manufacturer rating (Store.ratingHtml)

   API (window.Admin):
     Admin.get(key) / Admin.set(key, list)
     Admin.log(action, module)        → appends to admin_audit_logs
     Admin.adminName()
     Admin.allOrders()                → biomass + pellet orders, normalised
     Admin.isActiveOrder(o)           → not yet delivered
     Admin.now() / Admin.dateTime(stamp)
     Admin.openModal(id) / Admin.closeModal(idOrEl)
     Admin.initials(name)
     Admin.ROLE_LABEL
========================================================= */

(function () {

    const iso = Store.iso;

    const ROLE_LABEL = { farmer: "Farmer", manufacturer: "Manufacturer", powerplant: "Power Plant" };

    /* ---------------- Data version ----------------
       Bump when the admin seed shape changes: every admin_* key is
       cleared and re-seeded on the next page load. */

    const ADMIN_DATA_VERSION = "2";

    try {
        if (localStorage.getItem("bc_admin_data_version") !== ADMIN_DATA_VERSION) {
            Object.keys(localStorage).filter(k => k.startsWith("admin_")).forEach(k => localStorage.removeItem(k));
            localStorage.setItem("bc_admin_data_version", ADMIN_DATA_VERSION);
        }
    } catch (e) { /* storage unavailable */ }

    function stamp(offsetDays, time) { return iso(offsetDays) + " " + time; }

    /* ---------------- Verification seed ----------------
       Farmers submit one document (Aadhaar card); manufacturers and
       power plants submit one document (GST certificate). */

    function aadhaarDoc(slug, number) {
        return { docType: "Aadhaar Card", docNumber: number, docFile: "aadhaar_" + slug + ".pdf", docSize: "386 KB" };
    }

    function gstDoc(slug, gstin) {
        return { docType: "GST Certificate", docNumber: gstin, docFile: "gst_" + slug + ".pdf", docSize: "412 KB" };
    }

    function app(fields, doc) {
        return Object.assign({}, fields, doc);
    }

    const VERIFICATIONS = [
        // Farmers
        app({ id: "VER-1001", role: "farmer", name: "Mahesh Pawar", email: "mahesh.pawar@gmail.com", mobile: "9876501234", location: "Niphad", district: "Nashik", state: "Maharashtra", submitted: iso(-1), status: "Pending" },
            aadhaarDoc("mahesh_pawar", "XXXX XXXX 4521")),
        app({ id: "VER-1002", role: "farmer", name: "Anita Kale", email: "anita.kale@gmail.com", mobile: "9823107654", location: "Sinnar", district: "Nashik", state: "Maharashtra", submitted: iso(-2), status: "Pending" },
            aadhaarDoc("anita_kale", "XXXX XXXX 7810")),
        app({ id: "VER-1003", role: "farmer", name: "Prakash More", email: "prakash.more@yahoo.com", mobile: "9960234517", location: "Indapur", district: "Pune", state: "Maharashtra", submitted: iso(-3), status: "Pending" },
            aadhaarDoc("prakash_more", "XXXX XXXX 3307")),
        app({ id: "VER-1004", role: "farmer", name: "Savita Gaikwad", email: "savita.gaikwad@gmail.com", mobile: "9881456023", location: "Kopargaon", district: "Ahmednagar", state: "Maharashtra", submitted: iso(-32), status: "Approved", reviewedOn: iso(-30), reviewedBy: "System Admin" },
            aadhaarDoc("savita_gaikwad", "XXXX XXXX 6642")),
        app({ id: "VER-1005", role: "farmer", name: "Ramesh Patil", email: "ramesh.patil@gmail.com", mobile: "9822014587", location: "Nashik", district: "Nashik", state: "Maharashtra", submitted: iso(-182), status: "Approved", reviewedOn: iso(-180), reviewedBy: "System Admin" },
            aadhaarDoc("ramesh_patil", "XXXX XXXX 1185")),
        app({ id: "VER-1006", role: "farmer", name: "Dattatray Bhosale", email: "datta.bhosale@gmail.com", mobile: "9730562148", location: "Phaltan", district: "Satara", state: "Maharashtra", submitted: iso(-11), status: "Rejected", reviewedOn: iso(-10), reviewedBy: "System Admin",
              reasonCategory: "Document unclear", reason: "The Aadhaar card image is blurred and the name cannot be read. Please upload a clear scan." },
            aadhaarDoc("dattatray_bhosale", "XXXX XXXX 9024")),

        // Manufacturers
        app({ id: "VER-2001", role: "manufacturer", name: "Shree Agro Pellets", email: "info@shreeagropellets.in", mobile: "9823001122", location: "MIDC Jalgaon", district: "Jalgaon", state: "Maharashtra", submitted: iso(-1), status: "Pending" },
            gstDoc("shree_agro", "27AAKCS1234M1Z2")),
        app({ id: "VER-2002", role: "manufacturer", name: "BioCarbon Fuels", email: "contact@biocarbonfuels.com", mobile: "9890456712", location: "Waluj MIDC", district: "Aurangabad", state: "Maharashtra", submitted: iso(-3), status: "Pending" },
            gstDoc("biocarbon", "27AAHCB5521Q1Z7")),
        app({ id: "VER-2003", role: "manufacturer", name: "GreenPellet Industries", email: "contact@greenpellet.in", mobile: "9823456712", location: "MIDC Ambad", district: "Nashik", state: "Maharashtra", submitted: iso(-204), status: "Approved", reviewedOn: iso(-202), reviewedBy: "System Admin" },
            gstDoc("greenpellet", "27AACCG4410L1Z4")),
        app({ id: "VER-2004", role: "manufacturer", name: "Sahyadri Briquettes", email: "sahyadri.briquettes@gmail.com", mobile: "9767334410", location: "Kurkumbh MIDC", district: "Pune", state: "Maharashtra", submitted: iso(-16), status: "Rejected", reviewedOn: iso(-15), reviewedBy: "System Admin",
              reasonCategory: "Details mismatch", reason: "The business name on the GST certificate does not match the name entered at registration." },
            gstDoc("sahyadri", "27AAPFS7788D1Z1")),

        // Power plants
        app({ id: "VER-3001", role: "powerplant", name: "Mahagenco Koradi TPS", email: "koradi.fuel@mahagenco.in", mobile: "9420112233", location: "Koradi", district: "Nagpur", state: "Maharashtra", submitted: iso(-2), status: "Pending" },
            gstDoc("koradi", "27AABCM5678K1Z9")),
        app({ id: "VER-3002", role: "powerplant", name: "JSW Energy Ratnagiri", email: "fuel.ratnagiri@jsw.in", mobile: "9422876510", location: "Jaigad", district: "Ratnagiri", state: "Maharashtra", submitted: iso(-5), status: "Pending" },
            gstDoc("jsw_ratnagiri", "27AAACJ3344R1Z6")),
        app({ id: "VER-3003", role: "powerplant", name: "NTPC Nashik Unit", email: "fuel.nashik@ntpc.co.in", mobile: "9422334455", location: "Eklahare", district: "Nashik", state: "Maharashtra", submitted: iso(-214), status: "Approved", reviewedOn: iso(-212), reviewedBy: "System Admin" },
            gstDoc("ntpc_nashik", "27AAACN0255D1ZQ")),
        app({ id: "VER-3004", role: "powerplant", name: "Adani Power Tiroda", email: "biomass.tiroda@adani.com", mobile: "9370665412", location: "Tiroda", district: "Gondia", state: "Maharashtra", submitted: iso(-21), status: "Rejected", reviewedOn: iso(-20), reviewedBy: "System Admin",
              reasonCategory: "Details mismatch", reason: "The GSTIN on the certificate does not match the GSTIN entered at registration." },
            gstDoc("adani_tiroda", "27AAECA1122H1Z3"))
    ];

    /* ---------------- Users seed ---------------- */

    const BASE_USERS = [
        { name: "Ramesh Patil", role: "Farmer", email: "ramesh.patil@gmail.com", mobile: "9822014587", location: "Nashik", state: "Maharashtra", status: "Active", joined: iso(-180) },
        { name: "Sunita Jadhav", role: "Farmer", email: "sunita.jadhav@gmail.com", mobile: "9765432108", location: "Baramati", state: "Maharashtra", status: "Active", joined: iso(-150) },
        { name: "Vijay Shinde", role: "Farmer", email: "vijay.shinde@yahoo.com", mobile: "9850123476", location: "Latur", state: "Maharashtra", status: "Active", joined: iso(-120) },
        { name: "Kiran Deshmukh", role: "Farmer", email: "kiran.deshmukh@gmail.com", mobile: "9921345670", location: "Ahmednagar", state: "Maharashtra", status: "Blocked", joined: iso(-90),
          previousStatus: "Active", blockCategory: "Fake or misleading listings", blockReason: "Repeatedly listed biomass that was not available for pickup.", blockedOn: iso(-14) },
        { name: "GreenPellet Industries", role: "Manufacturer", email: "contact@greenpellet.in", mobile: "9823456712", location: "Nashik", state: "Maharashtra", status: "Active", joined: iso(-200) },
        { name: "EcoFuel Pellets Ltd", role: "Manufacturer", email: "info@ecofuelpellets.com", mobile: "9890011223", location: "Pune", state: "Maharashtra", status: "Active", joined: iso(-160) },
        { name: "NTPC Nashik Unit", role: "Power Plant", email: "fuel.nashik@ntpc.co.in", mobile: "9422334455", location: "Nashik", state: "Maharashtra", status: "Active", joined: iso(-210) },
        { name: "Tata Power Trombay", role: "Power Plant", email: "biomass.trombay@tatapower.com", mobile: "9819988776", location: "Mumbai", state: "Maharashtra", status: "Active", joined: iso(-140) }
    ];

    function usersSeed() {
        const list = BASE_USERS.map(u => Object.assign({}, u));
        VERIFICATIONS.forEach(v => {
            if (list.some(u => u.email === v.email)) return;
            list.push({
                name: v.name, role: ROLE_LABEL[v.role], email: v.email, mobile: v.mobile,
                location: v.district, state: v.state,
                status: v.status === "Approved" ? "Active" : v.status,
                joined: v.submitted
            });
        });
        return list
            .sort((a, b) => a.joined.localeCompare(b.joined))
            .map((u, i) => Object.assign({ id: "USR-" + (1001 + i) }, u))
            .reverse();
    }

    /* ---------------- Audit log seed (newest first) ---------------- */

    const LOG_ROWS = [
        [0, "09:12", "System Admin", "Admin", "Logged in to admin console", "Authentication"],
        [0, "07:55", "Tata Power Trombay", "Power Plant", "Placed pellet order PP-3013", "Orders"],
        [-1, "17:05", "NTPC Nashik Unit", "Power Plant", "Raised complaint CMP-1003 on order PP-3011", "Disputes"],
        [-1, "11:30", "Mahesh Pawar", "Farmer", "Submitted Aadhaar card for verification", "Verification"],
        [-1, "10:02", "Shree Agro Pellets", "Manufacturer", "Submitted GST certificate for verification", "Verification"],
        [-1, "09:15", "GreenPellet Industries", "Manufacturer", "Placed purchase order PO-B2044", "Orders"],
        [-2, "16:48", "NTPC Nashik Unit", "Power Plant", "Placed pellet order PP-3012", "Orders"],
        [-2, "15:10", "System Admin", "Admin", "Resolved complaint CMP-1001", "Disputes"],
        [-2, "12:15", "Anita Kale", "Farmer", "Submitted Aadhaar card for verification", "Verification"],
        [-2, "09:30", "Mahagenco Koradi TPS", "Power Plant", "Submitted GST certificate for verification", "Verification"],
        [-3, "15:42", "Prakash More", "Farmer", "Submitted Aadhaar card for verification", "Verification"],
        [-3, "14:20", "GreenPellet Industries", "Manufacturer", "Placed purchase order PO-B2041", "Orders"],
        [-4, "18:10", "Ramesh Patil", "Farmer", "Raised complaint CMP-1002 on order PO-B2040", "Disputes"],
        [-4, "11:05", "Ramesh Patil", "Farmer", "Raised complaint CMP-1001 on order PO-B2042", "Disputes"],
        [-5, "13:27", "GreenPellet Industries", "Manufacturer", "Placed purchase order PO-B2045", "Orders"],
        [-5, "10:18", "JSW Energy Ratnagiri", "Power Plant", "Submitted GST certificate for verification", "Verification"],
        [-6, "12:40", "Sunita Jadhav", "Farmer", "Created biomass listing BL-1003", "Listings"],
        [-7, "12:50", "GreenPellet Industries", "Manufacturer", "Created pellet listing PL-501", "Listings"],
        [-10, "15:05", "System Admin", "Admin", "Rejected farmer verification VER-1006", "Verification"],
        [-14, "17:22", "System Admin", "Admin", "Blocked user Kiran Deshmukh", "Users"],
        [-15, "10:11", "System Admin", "Admin", "Rejected manufacturer verification VER-2004", "Verification"],
        [-18, "09:47", "System Admin", "Admin", "Updated platform settings", "Settings"],
        [-20, "14:36", "System Admin", "Admin", "Rejected power plant verification VER-3004", "Verification"],
        [-25, "16:02", "NTPC Nashik Unit", "Power Plant", "Submitted pellet batch details for PP-3009", "Orders"],
        [-30, "11:28", "System Admin", "Admin", "Approved farmer verification VER-1004", "Verification"],
        [-60, "12:00", "System Admin", "Admin", "Issued compliance certificate BC/GN/2026/1001 to NTPC Nashik Unit", "Compliance"]
    ];

    function logsSeed() {
        return LOG_ROWS.map((r, i) => ({
            id: "LOG-" + (1000 + LOG_ROWS.length - i),
            timestamp: stamp(r[0], r[1]), user: r[2], role: r[3], action: r[4], module: r[5]
        }));
    }

    /* ---------------- Seeding ---------------- */

    const SEED = {
        admin_users: usersSeed,
        admin_verifications: () => VERIFICATIONS,
        admin_audit_logs: logsSeed
    };

    function seed(key) {
        let raw = null;
        try { raw = localStorage.getItem(key); } catch (e) { /* storage unavailable */ }
        if (raw === null && SEED[key]) Store.set(key, JSON.parse(JSON.stringify(SEED[key]())));
    }

    Object.keys(SEED).forEach(seed);

    function get(key) {
        seed(key);
        return Store.get(key);
    }

    function set(key, list) {
        Store.set(key, list);
    }

    /* ---------------- Profile / audit ---------------- */

    function adminName() {
        try {
            const p = JSON.parse(localStorage.getItem("bc_profile_admin"));
            if (p && p.name) return p.name;
        } catch (e) { /* ignore */ }
        return "System Admin";
    }

    function pad(n) { return String(n).padStart(2, "0"); }

    function now() {
        const d = new Date();
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    }

    function dateTime(ts) {
        if (!ts) return "—";
        const parts = String(ts).split(" ");
        return Store.date(parts[0]) + (parts[1] ? ", " + parts[1] : "");
    }

    function log(action, module) {
        return Store.add("admin_audit_logs", {
            timestamp: now(),
            user: adminName(),
            role: "Admin",
            action: action,
            module: module
        }, "LOG-");
    }

    /* ---------------- Orders (biomass + pellet) ----------------
       Each order keeps all of its stored fields (logistics, payment)
       so it can be passed straight to Store.trackingHtml(). */

    function normalise(o, extra) {
        return Object.assign({}, o, extra, {
            quantity: Number(o.quantity) || 0,
            price: Number(o.price) || 0,
            total: Number(o.total) || 0,
            paymentStatus: o.paymentStatus === "Paid" ? "Paid" : "Pending"
        });
    }

    function allOrders() {
        const bio = Store.get("purchaseOrders").map(o => normalise(o, {
            type: "Biomass", buyer: o.manufacturer, buyerRole: "Manufacturer",
            seller: o.farmer, sellerRole: "Farmer", product: o.biomassType
        }));
        const pellet = Store.get("pelletOrders").map(o => normalise(o, {
            type: "Pellet", buyer: o.powerPlant, buyerRole: "Power Plant",
            seller: o.manufacturer, sellerRole: "Manufacturer",
            product: o.pelletType + (o.grade ? " (" + o.grade + ")" : "")
        }));
        return bio.concat(pellet).sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)));
    }

    function isActiveOrder(o) {
        return o.status !== "Delivered";
    }

    /* ---------------- Modals ---------------- */

    function modalEl(idOrEl) {
        return typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;
    }

    function openModal(idOrEl) {
        const m = modalEl(idOrEl);
        if (!m) return;
        m.classList.add("open");
        m.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        const field = m.querySelector("form input:not([type=hidden]):not([readonly]):not([type=checkbox]), form select, form textarea");
        if (field) setTimeout(() => field.focus(), 60);
    }

    function closeModal(idOrEl) {
        const m = modalEl(idOrEl);
        if (!m) return;
        m.classList.remove("open");
        m.setAttribute("aria-hidden", "true");
        m.querySelectorAll("form").forEach(f => Validator.reset(f));
        if (!document.querySelector(".modal-backdrop.open:not(.confirm-dialog)")) document.body.style.overflow = "";
    }

    document.addEventListener("click", e => {
        const closer = e.target.closest("[data-close]");
        if (closer) {
            const m = closer.closest(".modal-backdrop");
            if (m) closeModal(m);
            return;
        }
        if (e.target.classList && e.target.classList.contains("modal-backdrop") && !e.target.classList.contains("confirm-dialog")) {
            closeModal(e.target);
        }
    });

    document.addEventListener("keydown", e => {
        if (e.key !== "Escape" || document.querySelector(".confirm-dialog")) return;
        const open = document.querySelectorAll(".modal-backdrop.open:not(.confirm-dialog)");
        if (open.length) closeModal(open[open.length - 1]);
    });

    function initials(name) {
        return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "?";
    }

    window.Admin = {
        ROLE_LABEL,
        get, set, log, adminName,
        now, dateTime,
        allOrders, isActiveOrder,
        openModal, closeModal,
        initials
    };

})();
