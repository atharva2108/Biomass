/* =========================================================
   BIOMASS CONNECT — APP LAYOUT (sidebar, topbar, notifications)
   ---------------------------------------------------------
   Every role page uses this skeleton:

   <body data-role="farmer" data-page="dashboard">
     <div class="app-shell">
       <aside class="sidebar" id="sidebar"></aside>
       <div class="app-main">
         <header class="topbar" id="topbar"></header>
         <main class="page"> ...page content... </main>
       </div>
     </div>
     <script src="../js/common/toast.js"></script>
     <script src="../js/common/validation.js"></script>
     <script src="../js/common/layout.js"></script>
     <script src="../js/<role>/<page>.js"></script>
   </body>

   data-role: farmer | manufacturer | powerplant | admin | logistics
   data-page: file name without ".html" (auto-detected if omitted)

   A notifications page only needs <div id="notificationsPage"></div>.
   Globals: logout(), Layout.menu, Layout.user, Layout.notifications
========================================================= */

(function () {

    const MENUS = {

        farmer: {
            label: "Farmer Portal",
            user: { name: "Ramesh Patil", role: "Farmer" },
            items: [
                { page: "dashboard", label: "Dashboard", icon: "fa-house" },
                { section: "Biomass" },
                { page: "create-listing", label: "Create Listing", icon: "fa-circle-plus" },
                { page: "manage-listings", label: "Manage Listings", icon: "fa-list-check" },
                { section: "Orders" },
                { page: "orders", label: "Orders Received", icon: "fa-cart-shopping" },
                { page: "tracking", label: "Order Tracking", icon: "fa-truck-fast" },
                { page: "history", label: "Order History", icon: "fa-clock-rotate-left" },
                { section: "Account" },
                { page: "billing", label: "Payments & Complaints", icon: "fa-file-invoice" },
                { page: "notifications", label: "Notifications", icon: "fa-bell" },
                { page: "profile", label: "Profile", icon: "fa-user" }
            ]
        },

        manufacturer: {
            label: "Manufacturer Portal",
            user: { name: "GreenPellet Industries", role: "Manufacturer" },
            items: [
                { page: "dashboard", label: "Dashboard", icon: "fa-house" },
                { section: "Buy Biomass" },
                { page: "marketplace", label: "Biomass Marketplace", icon: "fa-store" },
                { page: "purchase-orders", label: "Purchase Orders", icon: "fa-file-signature" },
                { page: "tracking", label: "Purchase Tracking", icon: "fa-truck-fast" },
                { page: "history", label: "Purchase History", icon: "fa-clock-rotate-left" },
                { section: "Sell Pellets" },
                { page: "pellet-listing", label: "Create Pellet Listing", icon: "fa-circle-plus" },
                { page: "pellet-management", label: "Manage Pellet Listings", icon: "fa-boxes-stacked" },
                { page: "pellet-orders", label: "Pellet Orders Received", icon: "fa-cart-shopping" },
                { page: "pellet-tracking", label: "Pellet Order Tracking", icon: "fa-route" },
                { page: "pellet-sales", label: "Pellet Sales History", icon: "fa-chart-line" },
                { section: "Account" },
                { page: "billing", label: "Billing & Complaints", icon: "fa-file-invoice" },
                { page: "notifications", label: "Notifications", icon: "fa-bell" },
                { page: "profile", label: "Profile", icon: "fa-user" }
            ]
        },

        powerplant: {
            label: "Power Plant Portal",
            user: { name: "NTPC Nashik Unit", role: "Coal Power Plant" },
            items: [
                { page: "dashboard", label: "Dashboard", icon: "fa-house" },
                { section: "Buy Pellets" },
                { page: "marketplace", label: "Pellet Marketplace", icon: "fa-store" },
                { page: "purchase-orders", label: "Place Pellet Order", icon: "fa-file-signature" },
                { page: "tracking", label: "Order Tracking", icon: "fa-truck-fast" },
                { page: "history", label: "Purchase History", icon: "fa-clock-rotate-left" },
                { page: "pellet-feedback", label: "Pellet Batch Feedback", icon: "fa-clipboard-check" },
                { section: "Sustainability" },
                { page: "consumption", label: "Biomass Consumption", icon: "fa-fire-flame-curved" },
                { page: "carbon-savings", label: "Carbon Savings", icon: "fa-leaf" },
                { page: "certifications", label: "Compliance Certificate", icon: "fa-certificate" },
                { section: "Account" },
                { page: "billing", label: "Billing & Complaints", icon: "fa-file-invoice" },
                { page: "notifications", label: "Notifications", icon: "fa-bell" },
                { page: "profile", label: "Profile", icon: "fa-user" }
            ]
        },

        admin: {
            label: "Admin Console",
            user: { name: "System Admin", role: "Administrator" },
            items: [
                { page: "dashboard", label: "Dashboard", icon: "fa-house" },
                { section: "Users" },
                { page: "user-management", label: "User Management", icon: "fa-users" },
                { page: "farmer-verification", label: "Farmer Verification", icon: "fa-seedling" },
                { page: "manufacturer-verification", label: "Manufacturer Verification", icon: "fa-industry" },
                { page: "powerplant-verification", label: "Power Plant Verification", icon: "fa-bolt" },
                { section: "Operations" },
                { page: "orders-monitoring", label: "Orders & Transactions", icon: "fa-money-bill-transfer" },
                { page: "dispute-management", label: "Dispute Management", icon: "fa-scale-balanced" },
                { page: "audit-compliance", label: "Audit & Compliance", icon: "fa-shield-halved" },
                { page: "reports-monitoring", label: "Reports & Monitoring", icon: "fa-chart-pie" },
                { section: "System" },
                { page: "setting", label: "Settings", icon: "fa-gear" },
                { page: "profile", label: "Profile", icon: "fa-user" }
            ]
        },

        logistics: {
            label: "Logistics Portal",
            user: { name: "Logistics Team", role: "Logistics Partner" },
            items: [
                { page: "dashboard", label: "Shipments", icon: "fa-truck-fast" }
            ]
        }
    };

    /* ---------------- Sample notifications (US007) ---------------- */

    const NOTIFICATIONS = {
        farmer: [
            { id: "f1", type: "order", title: "New order received", text: "GreenPellet Industries bought your entire Cotton Stalk listing (12 tons), order PO-B2044. Please keep it ready for pickup.", time: "1 day ago", link: "orders.html" },
            { id: "f2", type: "delivery", title: "Pickup scheduled", text: "The logistics team will pick up PO-B2041 (Rice Husk, 20 tons) tomorrow. Vehicle MH15EF2290.", time: "3 hours ago", link: "tracking.html" },
            { id: "f3", type: "delivery", title: "Order picked up", text: "PO-B2045 (Maize Stover, 18 tons) is on the way to GreenPellet Industries.", time: "Yesterday", link: "tracking.html" },
            { id: "f4", type: "payment", title: "Payment received", text: "₹32,250 received for PO-B2042 from EcoFuel Pellets Ltd.", time: "2 days ago", link: "billing.html" },
            { id: "f5", type: "alert", title: "Complaint resolved", text: "Your complaint CMP-1001 about the payment for PO-B2042 has been resolved.", time: "2 days ago", link: "billing.html?tab=complaints" }
        ],
        manufacturer: [
            { id: "m1", type: "order", title: "New pellet order", text: "Tata Power Trombay bought your Agro Residue Pellets listing (30 tons), order PP-3013.", time: "15 min ago", link: "pellet-orders.html" },
            { id: "m2", type: "delivery", title: "Biomass in transit", text: "PO-B2045 (Maize Stover, 18 tons) is on the way and expected tomorrow.", time: "1 hour ago", link: "tracking.html" },
            { id: "m3", type: "delivery", title: "Pellet pickup scheduled", text: "The logistics team will pick up PP-3012 (40 tons) from your unit tomorrow.", time: "5 hours ago", link: "pellet-tracking.html" },
            { id: "m4", type: "alert", title: "New batch rating", text: "NTPC Nashik Unit submitted batch details for PP-3009. Quality score 4.5 / 5.", time: "Yesterday", link: "pellet-sales.html" },
            { id: "m5", type: "payment", title: "Payment pending", text: "Payment of ₹35,200 to Ramesh Patil for PO-B2040 is pending.", time: "2 days ago", link: "billing.html" }
        ],
        powerplant: [
            { id: "p1", type: "delivery", title: "Shipment in transit", text: "PP-3011 (50 tons Bagasse Pellets) is on the way and expected tomorrow.", time: "20 min ago", link: "tracking.html" },
            { id: "p2", type: "delivery", title: "Pickup scheduled", text: "PP-3012 will be picked up from GreenPellet Industries tomorrow.", time: "3 hours ago", link: "tracking.html" },
            { id: "p3", type: "delivery", title: "Order delivered", text: "PP-3008 was delivered. Please submit the pellet batch details.", time: "3 days ago", link: "pellet-feedback.html" },
            { id: "p4", type: "payment", title: "Payment pending", text: "₹3,90,000 for PP-3008 is due to GreenPellet Industries.", time: "3 days ago", link: "billing.html" },
            { id: "p5", type: "alert", title: "Compliance certificate issued", text: "Admin issued your Government Norms Compliance Certificate.", time: "2 months ago", link: "certifications.html" }
        ],
        admin: [
            { id: "a1", type: "alert", title: "New verification request", text: "3 new farmer registrations are awaiting Aadhaar verification.", time: "5 min ago", link: "farmer-verification.html" },
            { id: "a2", type: "alert", title: "Complaint raised", text: "NTPC Nashik Unit raised a complaint on order PP-3011.", time: "1 day ago", link: "dispute-management.html" },
            { id: "a3", type: "order", title: "High value order", text: "Order PP-3008 of ₹3,90,000 was delivered.", time: "3 days ago", link: "orders-monitoring.html" },
            { id: "a4", type: "alert", title: "Manufacturer verification", text: "Shree Agro Pellets uploaded their GST certificate.", time: "Yesterday", link: "manufacturer-verification.html" }
        ],
        logistics: [
            { id: "l1", type: "order", title: "New pickup request", text: "PP-3013: 30 tons from GreenPellet Industries, Nashik to Tata Power Trombay.", time: "15 min ago", link: "dashboard.html" },
            { id: "l2", type: "order", title: "New pickup request", text: "PO-B2044: 12 tons Cotton Stalk from Ramesh Patil, Nashik to GreenPellet Industries.", time: "1 day ago", link: "dashboard.html" }
        ]
    };

    const ICONS = { order: "fa-cart-shopping", delivery: "fa-truck", payment: "fa-indian-rupee-sign", alert: "fa-bell" };

    /* ---------------- Helpers ---------------- */

    const body = document.body;
    const role = (body.dataset.role || "").toLowerCase();
    const menu = MENUS[role];
    const currentPage = body.dataset.page ||
        (location.pathname.split("/").pop() || "dashboard.html").replace(/\.html$/, "");

    function escapeHtml(s) {
        return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    }

    function readKey() { return "bc_notif_read_" + role; }

    function readSet() {
        try { return new Set(JSON.parse(localStorage.getItem(readKey())) || []); }
        catch (e) { return new Set(); }
    }

    function saveRead(set) {
        try { localStorage.setItem(readKey(), JSON.stringify([...set])); } catch (e) { /* ignore */ }
    }

    function notifications() {
        const read = readSet();
        return (NOTIFICATIONS[role] || []).map(n => Object.assign({}, n, { unread: !read.has(n.id) }));
    }

    function initials(name) {
        return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
    }

    function currentUser() {
        const base = menu ? menu.user : { name: "User", role: "" };
        try {
            const stored = JSON.parse(localStorage.getItem("bc_profile_" + role));
            if (stored && stored.name) return Object.assign({}, base, { name: stored.name });
        } catch (e) { /* ignore */ }
        return base;
    }

    /* ---------------- Render sidebar ---------------- */

    function renderSidebar() {
        const el = document.getElementById("sidebar");
        if (!el || !menu) return;

        const links = menu.items.map(item => {
            if (item.section) return '<li class="sidebar-section">' + item.section + "</li>";
            const active = item.page === currentPage ? " active" : "";
            return '<li><a href="' + item.page + '.html" class="' + active.trim() + '">' +
                '<i class="fa-solid ' + item.icon + '"></i><span>' + item.label + "</span></a></li>";
        }).join("");

        el.innerHTML =
            '<a class="sidebar-brand" href="dashboard.html">' +
                '<span class="brand-icon"><i class="fa-solid fa-leaf"></i></span>' +
                '<span><strong>Biomass Connect</strong><small>From Farms To Fuel</small></span>' +
            "</a>" +
            '<div class="sidebar-role">' + menu.label + "</div>" +
            '<ul class="sidebar-nav">' + links + "</ul>" +
            '<div class="sidebar-footer"><button type="button" onclick="logout()">' +
                '<i class="fa-solid fa-right-from-bracket"></i><span>Logout</span></button></div>';

        if (!document.querySelector(".sidebar-backdrop")) {
            const backdrop = document.createElement("div");
            backdrop.className = "sidebar-backdrop";
            backdrop.addEventListener("click", () => body.classList.remove("sidebar-open"));
            el.insertAdjacentElement("afterend", backdrop);
        }
    }

    /* ---------------- Render topbar ---------------- */

    function hasPage(page) {
        return !!menu && menu.items.some(i => i.page === page);
    }

    function pageLabel() {
        if (!menu) return document.title;
        const item = menu.items.find(i => i.page === currentPage);
        return item ? item.label : (document.querySelector(".page-header h1") || {}).textContent || "";
    }

    function renderTopbar() {
        const el = document.getElementById("topbar");
        if (!el || !menu) return;

        const user = currentUser();
        const unread = notifications().filter(n => n.unread).length;

        el.innerHTML =
            '<div class="topbar-left">' +
                '<button class="icon-btn topbar-menu" type="button" aria-label="Open menu"><i class="fa-solid fa-bars"></i></button>' +
                '<div class="breadcrumb">' + menu.label + ' / <strong>' + escapeHtml(pageLabel()) + "</strong></div>" +
            "</div>" +
            '<div class="topbar-right">' +
                '<div class="notif-wrap">' +
                    '<button class="icon-btn" type="button" id="notifBtn" aria-label="Notifications">' +
                        '<i class="fa-regular fa-bell"></i>' +
                        (unread ? '<span class="dot">' + unread + "</span>" : "") +
                    "</button>" +
                    '<div class="notif-panel" id="notifPanel"></div>' +
                "</div>" +
                (hasPage("profile") ? '<a class="user-chip" href="profile.html" title="Profile">' : '<span class="user-chip">') +
                    '<span class="avatar">' + initials(user.name) + "</span>" +
                    '<span class="user-meta"><strong>' + escapeHtml(user.name) + "</strong><small>" + escapeHtml(user.role) + "</small></span>" +
                (hasPage("profile") ? "</a>" : "</span>") +
            "</div>";

        el.querySelector(".topbar-menu").addEventListener("click", () => body.classList.toggle("sidebar-open"));

        const btn = el.querySelector("#notifBtn");
        const panel = el.querySelector("#notifPanel");

        btn.addEventListener("click", e => {
            e.stopPropagation();
            renderPanel(panel);
            panel.classList.toggle("open");
        });

        document.addEventListener("click", e => {
            if (!panel.contains(e.target)) panel.classList.remove("open");
        });
    }

    function notifItemHtml(n) {
        return '<div class="notif-item' + (n.unread ? " unread" : "") + '" data-id="' + n.id + '" data-link="' + n.link + '">' +
            '<span class="notif-icon ' + n.type + '"><i class="fa-solid ' + (ICONS[n.type] || "fa-bell") + '"></i></span>' +
            "<div><p><strong>" + escapeHtml(n.title) + "</strong></p><p>" + escapeHtml(n.text) + "</p><small>" + n.time + "</small></div>" +
            "</div>";
    }

    function renderPanel(panel) {
        const list = notifications().slice(0, 5);
        panel.innerHTML =
            '<div class="notif-panel-head"><span>Notifications</span><button type="button" id="markAllBtn">Mark all as read</button></div>' +
            '<div class="notif-panel-list">' +
                (list.length ? list.map(notifItemHtml).join("") : '<div class="empty-state">No notifications</div>') +
            "</div>" +
            (hasPage("notifications") ? '<a class="notif-panel-foot" href="notifications.html">View all notifications</a>' : "");

        panel.querySelector("#markAllBtn").addEventListener("click", e => {
            e.stopPropagation();
            markAllRead();
            showToast && showToast("All notifications marked as read", "success");
        });

        bindNotifClicks(panel);
    }

    function bindNotifClicks(scope) {
        scope.querySelectorAll(".notif-item").forEach(item => {
            item.addEventListener("click", () => {
                const read = readSet();
                read.add(item.dataset.id);
                saveRead(read);
                window.location.href = item.dataset.link;
            });
        });
    }

    function markAllRead() {
        const read = readSet();
        (NOTIFICATIONS[role] || []).forEach(n => read.add(n.id));
        saveRead(read);
        refreshBadge();
        const page = document.getElementById("notificationsPage");
        if (page) renderNotificationsPage(page);
        const panel = document.getElementById("notifPanel");
        if (panel && panel.classList.contains("open")) renderPanel(panel);
    }

    function refreshBadge() {
        const btn = document.getElementById("notifBtn");
        if (!btn) return;
        const unread = notifications().filter(n => n.unread).length;
        const dot = btn.querySelector(".dot");
        if (unread && dot) dot.textContent = unread;
        else if (unread) btn.insertAdjacentHTML("beforeend", '<span class="dot">' + unread + "</span>");
        else if (dot) dot.remove();
    }

    /* ---------------- Notifications page ---------------- */

    let notifFilter = "all";

    function renderNotificationsPage(el) {
        const all = notifications();
        const list = all.filter(n =>
            notifFilter === "all" ? true :
            notifFilter === "unread" ? n.unread : n.type === notifFilter);

        const tabs = [["all", "All"], ["unread", "Unread"], ["order", "Orders"], ["delivery", "Deliveries"], ["payment", "Payments"], ["alert", "Alerts"]];

        el.innerHTML =
            '<div class="card">' +
                '<div class="card-header">' +
                    '<div><div class="card-title">All notifications</div>' +
                    '<div class="card-subtitle">' + all.filter(n => n.unread).length + " unread</div></div>" +
                    '<button class="btn btn-secondary btn-sm" type="button" id="pageMarkAll"><i class="fa-solid fa-check-double"></i> Mark all as read</button>' +
                "</div>" +
                '<div class="card-body" style="padding-bottom:0"><div class="tabs" style="margin-bottom:0">' +
                    tabs.map(t => '<button type="button" class="tab' + (t[0] === notifFilter ? " active" : "") + '" data-filter="' + t[0] + '">' + t[1] + "</button>").join("") +
                "</div></div>" +
                "<div>" + (list.length ? list.map(notifItemHtml).join("") :
                    '<div class="empty-state"><i class="fa-regular fa-bell-slash"></i>No notifications in this category</div>') + "</div>" +
            "</div>";

        el.querySelector("#pageMarkAll").addEventListener("click", () => {
            markAllRead();
            showToast("All notifications marked as read", "success");
        });

        el.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
            notifFilter = tab.dataset.filter;
            renderNotificationsPage(el);
        }));

        bindNotifClicks(el);
    }

    /* ---------------- Logout ---------------- */

    function logout() {
        confirmDialog({
            title: "Log out?",
            message: "You will need to sign in again to access your dashboard.",
            confirmText: "Logout"
        }).then(ok => {
            if (!ok) return;
            localStorage.removeItem("isLoggedIn");
            localStorage.removeItem("role");
            Toast.redirect("../auth/login.html", "You have been logged out successfully", "success");
        });
    }

    window.logout = logout;
    // legacy names used by older pages
    window.logoutfarmer = logout;
    window.logoutUser = logout;

    /* ---------------- Init ---------------- */

    renderSidebar();
    renderTopbar();

    const notifPage = document.getElementById("notificationsPage");
    if (notifPage) renderNotificationsPage(notifPage);

    window.Layout = {
        role,
        page: currentPage,
        menu,
        user: currentUser,
        notifications,
        markAllRead
    };

})();
