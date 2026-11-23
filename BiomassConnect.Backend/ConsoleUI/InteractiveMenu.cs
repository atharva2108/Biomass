using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.ConsoleUI;

/// <summary>
/// [2] Interactive Menu (by role): run any single controller method live and see its result.
/// Every option calls exactly one controller method (the console never touches services or the DbContext).
/// </summary>
public sealed class InteractiveMenu
{
    private readonly AppHost _app;

    public InteractiveMenu(AppHost app) => _app = app;

    private sealed record Item(string Label, Func<Task> Action);

    public async Task RunAsync()
    {
        while (true)
        {
            Out.Banner("INTERACTIVE MENU (by role)");
            Console.WriteLine($"  Signed in: {_app.Session}");
            Console.WriteLine("  [1] Auth & public      [2] Farmer        [3] Manufacturer");
            Console.WriteLine("  [4] Power Plant        [5] Logistics     [6] Admin");
            Console.WriteLine("  [0] Back to main menu");
            switch (Prompt.Text("Choose"))
            {
                case "1": await Section("AUTH & PUBLIC", AuthItems()); break;
                case "2": await Section("FARMER PORTAL", FarmerItems()); break;
                case "3": await Section("MANUFACTURER PORTAL", ManufacturerItems()); break;
                case "4": await Section("POWER PLANT PORTAL", PowerPlantItems()); break;
                case "5": await Section("LOGISTICS PORTAL", LogisticsItems()); break;
                case "6": await Section("ADMIN CONSOLE", AdminItems()); break;
                case "0" or "": return;
            }
        }
    }

    private async Task Section(string title, List<Item> items)
    {
        while (true)
        {
            Out.Banner(title);
            Console.WriteLine($"  Signed in: {_app.Session}");
            for (int i = 0; i < items.Count; i++) Console.WriteLine($"  [{i + 1,2}] {items[i].Label}");
            Console.WriteLine("  [ 0] Back");
            var pick = Prompt.Text("Choose");
            if (pick is "0" or "") return;
            if (!int.TryParse(pick, out var n) || n < 1 || n > items.Count) continue;
            Console.WriteLine();
            try { await items[n - 1].Action(); }
            catch (Exception ex) { Out.Blocked($"Unexpected error: {ex.GetBaseException().Message}"); }
            Prompt.Pause();
        }
    }

    /// <summary>Prints the controller name, calls it, prints [OK]/[BLOCKED]/[INFO], then shows the data on success.</summary>
    private static async Task Call<T>(string controllerMethod, Func<Task<Result<T>>> call, Action<T>? show = null)
    {
        Out.Controller(controllerMethod);
        var r = await call();
        Out.Print(r);
        if (r.Success && r.Data is not null) show?.Invoke(r.Data);
    }

    private static Task Call<T>(string controllerMethod, Func<Result<T>> call, Action<T>? show = null) =>
        Call(controllerMethod, () => Task.FromResult(call()), show);

    // ================================================================== AUTH

    private List<Item> AuthItems() =>
    [
        new("Login (email or mobile)", () => Call("AuthController.Login",
            () => _app.Auth.Login(Prompt.Text("Email or mobile"), Prompt.Text("Password")))),
        new("Quick login as a demo / built-in account", QuickLogin),
        new("Register (Farmer / Manufacturer / Power Plant)", Register),
        new("Forgot password (security question)", ForgotPassword),
        new("Current user", () => Call("AuthController.GetCurrentUser", () => _app.Auth.GetCurrentUser())),
        new("Logout", () => Call("AuthController.Logout", () => _app.Auth.Logout())),
        new("Contact form (public, no login)", () => Call("CommonController.SubmitContactMessage", () => _app.Common.SubmitContactMessage(
            Prompt.Text("Name"), Prompt.Text("Email"), Prompt.Optional("Mobile"),
            Prompt.Choice("I am a", Catalog.ContactRoles)!, Prompt.Text("Message (20-500 chars)")))),
        new("My notifications", () => Call("CommonController.GetNotifications", () => _app.Common.GetNotifications(),
            d => Out.Table(["Type", "Title", "Message", "Read"], d.Items.Select(n => new[] { n.Type.Label(), n.Title, n.Message, n.IsRead ? "yes" : "no" })))),
        new("Mark my notifications read", () => Call("CommonController.MarkNotificationsRead", () => _app.Common.MarkNotificationsRead()))
    ];

    private async Task QuickLogin()
    {
        var accounts = new (string Label, string Email, string Pwd)[]
        {
            ("Admin (System Admin)", DemoData.AdminEmail, DemoData.AdminPassword),
            ("Logistics Team", DemoData.LogisticsEmail, DemoData.LogisticsPassword),
            ("Demo farmer (after demo run)", "farmer@demo.local", "Demo@1234"),
            ("Demo manufacturer (after demo run)", "manufacturer@demo.local", "Demo@1234"),
            ("Demo power plant (after demo run)", "powerplant@demo.local", "Demo@1234")
        };
        var pick = Prompt.Choice("Account", accounts.Select(a => a.Label).ToList())!;
        var a = accounts.First(x => x.Label == pick);
        await Call($"AuthController.Login ({a.Email})", () => _app.Auth.Login(a.Email, a.Pwd));
    }

    private async Task Register()
    {
        var role = Prompt.Choice("Role", ["Farmer", "Manufacturer", "Power Plant"])!;
        var r = role switch { "Farmer" => UserRole.Farmer, "Manufacturer" => UserRole.Manufacturer, _ => UserRole.PowerPlant };
        bool farmer = r == UserRole.Farmer;
        var fullName = Prompt.Text("Full name");
        var org = farmer ? fullName : Prompt.Text(r == UserRole.PowerPlant ? "Power plant name" : "Company name");
        var mobile = Prompt.Text("Mobile (10 digits)");
        var email = Prompt.Text("Email");
        var idNo = Prompt.Text(farmer ? "Aadhaar number (12 digits)" : "GSTIN (15 characters)");
        var state = Prompt.Choice("State", Catalog.IndianStates, "Maharashtra")!;
        var pin = Prompt.Text("PIN code");
        var pwd = Prompt.Text("Password (8-20, upper, lower, digit, symbol)");
        var q = Prompt.Choice("Security question", Catalog.SecurityQuestions)!;
        var ans = Prompt.Text("Security answer");
        var file = Prompt.Text("Document file name (pdf/jpg/png)", farmer ? "aadhaar.pdf" : "gst_certificate.pdf");
        var kb = Prompt.Int("Document size in KB", 400);
        await Call("AuthController.Register", () => _app.Auth.Register(r, org, fullName, email, mobile, pwd, q, ans, state, pin, idNo, file, kb));
    }

    private async Task ForgotPassword()
    {
        var id = Prompt.Text("Email or mobile");
        Out.Controller("AuthController.FindAccountForReset");
        var found = await _app.Auth.FindAccountForReset(id);
        Out.Print(found);
        if (!found.Success) return;
        await Call("AuthController.ResetPassword", () => _app.Auth.ResetPassword(id, Prompt.Text("Answer"), Prompt.Text("New password")));
    }

    // ================================================================== FARMER

    private List<Item> FarmerItems() =>
    [
        new("Dashboard", () => Call("FarmerController.GetDashboard", () => _app.Farmer.GetDashboard(), d =>
            Out.Detail($"Active listings {d.ActiveListings} ({Out.N(d.ActiveTonnage)} t) | Orders {d.TotalOrders} | Delivered {d.DeliveredOrders} | Earnings {Out.Inr(d.Earnings)} | Pending {Out.Inr(d.PendingReceivables)}"))),
        new("My listings", () => Call("FarmerController.GetListings", () => _app.Farmer.GetListings(), ShowBiomassListings)),
        new("Create listing", async () =>
        {
            var l = ReadBiomassListing(null);
            Out.Controller("FarmerController.CreateListing");
            var r = await _app.Farmer.CreateListing(l);
            Out.Print(r);
            if (!r.Success && r.Message.Contains("already have an active") && Prompt.YesNo("Create another listing anyway"))
                await Call("FarmerController.CreateListing (confirmed)", () => _app.Farmer.CreateListing(l, confirmDuplicate: true));
        }),
        new("Edit listing", async () =>
        {
            var id = Prompt.Id("Listing id (e.g. BL-0003)");
            var current = (await _app.Farmer.GetListings()).Data?.FirstOrDefault(x => x.ListingId == id);
            await Call("FarmerController.UpdateListing", () => _app.Farmer.UpdateListing(id, ReadBiomassListing(current)));
        }),
        new("Activate / deactivate listing", () => Call("FarmerController.SetListingStatus",
            () => _app.Farmer.SetListingStatus(Prompt.Id("Listing id"), Prompt.YesNo("Make it Active")))),
        new("Delete listing", () => Call("FarmerController.DeleteListing", () => _app.Farmer.DeleteListing(Prompt.Id("Listing id")))),
        new("Orders received / history (filters)", () => Call("FarmerController.GetOrders",
            () => _app.Farmer.GetOrders(Prompt.OptionalDate("From date"), Prompt.OptionalDate("To date"), Prompt.Optional("Keyword")), ShowOrders)),
        new("Order tracking", () => Call("FarmerController.GetOrderTracking", () => _app.Farmer.GetOrderTracking(Prompt.Text("Order code (PO-B...)")), ShowTracking)),
        new("Payments & billing", () => Call("FarmerController.GetPayments", () => _app.Farmer.GetPayments(), d => ShowOrders(d.Orders))),
        new("Profile", () => Call("FarmerController.GetProfile", () => _app.Farmer.GetProfile(), ShowFarmerProfile)),
        new("Update profile", UpdateFarmerProfile),
        new("Raise a complaint", RaiseComplaint)
    ];

    private static BiomassListing ReadBiomassListing(BiomassListing? c) => new()
    {
        BiomassType = Prompt.Choice("Biomass type", Catalog.BiomassTypes, c?.BiomassType)!,
        QuantityTons = Prompt.Decimal("Quantity (tons)", c?.QuantityTons),
        PricePerTon = Prompt.Decimal("Price per ton (Rs.)", c?.PricePerTon),
        Location = Prompt.Text("Pickup location", c?.Location),
        District = Prompt.Text("District", c?.District),
        State = Prompt.Choice("State", Catalog.IndianStates, c?.State ?? "Maharashtra")!,
        AvailableFrom = Prompt.Date("Available from", c?.AvailableFrom ?? Clock.Today),
        Description = Prompt.Optional("Description", c?.Description)
    };

    private async Task UpdateFarmerProfile()
    {
        var current = (await _app.Farmer.GetProfile()).Data;
        if (current is null) { Out.Blocked("Sign in as a farmer first."); return; }
        var u = current.User!;
        var p = new FarmerProfile
        {
            Dob = Prompt.Date("Date of birth", current.Dob ?? new DateOnly(1985, 1, 1)),
            Gender = Prompt.Choice("Gender", Catalog.Genders, current.Gender),
            Address = Prompt.Text("Address (10-200 chars)", current.Address),
            Village = Prompt.Text("Village", current.Village),
            District = Prompt.Text("District", current.District),
            State = Prompt.Choice("State", Catalog.IndianStates, current.State)!,
            Pincode = Prompt.Text("PIN code", current.Pincode),
            FarmAreaAcres = Prompt.Decimal("Farm area (acres)", current.FarmAreaAcres),
            PrimaryCrops = Prompt.Optional("Primary crops", current.PrimaryCrops),
            AccountHolder = Prompt.Text("Account holder name", current.AccountHolder ?? u.Name),
            BankName = Prompt.Text("Bank name", current.BankName),
            AccountNo = Prompt.Text("Account number", current.AccountNo),
            Ifsc = Prompt.Text("IFSC", current.Ifsc),
            UpiId = Prompt.Optional("UPI ID", current.UpiId),
            Pan = Prompt.Optional("PAN", current.Pan)
        };
        await Call("FarmerController.UpdateProfile", () => _app.Farmer.UpdateProfile(
            Prompt.Text("Full name", u.Name), Prompt.Text("Email", u.Email), Prompt.Text("Mobile", u.Mobile), p), ShowFarmerProfile);
    }

    private Task RaiseComplaint()
    {
        var role = _app.Session.Role;
        var cats = role switch
        {
            UserRole.Farmer => Catalog.FarmerComplaintCategories,
            UserRole.Manufacturer => Catalog.ManufacturerComplaintCategories,
            UserRole.PowerPlant => Catalog.PowerPlantComplaintCategories,
            _ => Catalog.PowerPlantComplaintCategories
        };
        return Call("CommonController.SubmitComplaint", () => _app.Common.SubmitComplaint(
            Prompt.Text("Order code (PO-B... or PP-...)"), Prompt.Choice("Category", cats)!, Prompt.Text("Description (20-500 chars)")));
    }

    // ================================================================== MANUFACTURER

    private List<Item> ManufacturerItems() =>
    [
        new("Biomass marketplace (filters)", () => Call("ManufacturerController.GetBiomassMarketplace", () => _app.Manufacturer.GetBiomassMarketplace(
            Prompt.Choice("Biomass type", Catalog.BiomassTypes, allowNone: true), Prompt.Optional("State"), Prompt.OptionalDecimal("Max price per ton"),
            Prompt.Optional("Keyword")), ShowBiomassListings)),
        new("Buy a biomass listing (whole lot)", () => Call("ManufacturerController.PurchaseBiomass", () => _app.Manufacturer.PurchaseBiomass(
            Prompt.Id("Listing id (BL-...)"), Prompt.Text("Delivery address", "Plot 14, MIDC Ambad, Nashik 422010"), Prompt.Optional("Notes")))),
        new("Inbound purchase orders", () => Call("ManufacturerController.GetInboundOrders", () => _app.Manufacturer.GetInboundOrders(), ShowOrders)),
        new("Pay a farmer order (Mark as Paid)", () => Call("ManufacturerController.PayFarmerOrder", () => _app.Manufacturer.PayFarmerOrder(Prompt.Text("Order code (PO-B...)")))),
        new("My pellet listings", () => Call("ManufacturerController.GetPelletListings", () => _app.Manufacturer.GetPelletListings(), ShowPelletListings)),
        new("Create pellet listing", () => Call("ManufacturerController.CreatePelletListing", () => _app.Manufacturer.CreatePelletListing(ReadPelletListing(null)))),
        new("Edit pellet listing", async () =>
        {
            var id = Prompt.Id("Pellet listing id (PL-...)");
            var current = (await _app.Manufacturer.GetPelletListings()).Data?.FirstOrDefault(x => x.ListingId == id);
            await Call("ManufacturerController.UpdatePelletListing", () => _app.Manufacturer.UpdatePelletListing(id, ReadPelletListing(current)));
        }),
        new("Activate / deactivate pellet listing", () => Call("ManufacturerController.SetPelletListingStatus",
            () => _app.Manufacturer.SetPelletListingStatus(Prompt.Id("Pellet listing id"), Prompt.YesNo("Make it Active")))),
        new("Delete pellet listing", () => Call("ManufacturerController.DeletePelletListing", () => _app.Manufacturer.DeletePelletListing(Prompt.Id("Pellet listing id")))),
        new("Outbound pellet orders & receivables", () => Call("ManufacturerController.GetOutboundOrders", () => _app.Manufacturer.GetOutboundOrders(), ShowOrders)),
        new("Quality ratings", () => Call("ManufacturerController.GetRatings", () => _app.Manufacturer.GetRatings(), d =>
            Out.Table(["Order", "Plant", "Received", "Moisture", "Ash", "CV", "Score"], d.Feedback.Select(f => new[]
            {
                Codes.PelletOrder(f.OrderId), f.Order?.PowerPlant?.Name, Out.D(f.ReceivedDate), $"{f.MoisturePct}%", $"{f.AshContentPct}%", f.CalorificValue.ToString(), f.Score.ToString("0.0")
            })))),
        new("Raise a complaint", RaiseComplaint)
    ];

    private static PelletListing ReadPelletListing(PelletListing? c) => new()
    {
        PelletType = Prompt.Choice("Pellet type", Catalog.PelletTypes, c?.PelletType)!,
        Grade = Prompt.Choice("Grade (Premium: moisture <= 10, ash <= 8, CV >= 4000)", Catalog.Grades, c?.Grade)!,
        QuantityTons = Prompt.Decimal("Quantity (tons)", c?.QuantityTons),
        PricePerTon = Prompt.Decimal("Price per ton (Rs. 1000-50000)", c?.PricePerTon),
        AvailableFrom = Prompt.Date("Available from", c?.AvailableFrom ?? Clock.Today),
        PickupLocation = Prompt.Text("Pickup location", c?.PickupLocation),
        DiameterMm = Prompt.Decimal("Diameter mm (6-12)", c?.DiameterMm),
        LengthMm = Prompt.Decimal("Length mm (10-50)", c?.LengthMm),
        MoisturePct = Prompt.Decimal("Moisture % (0-15)", c?.MoisturePct),
        AshContentPct = Prompt.Decimal("Ash content % (0-20)", c?.AshContentPct),
        CalorificValue = Prompt.Int("Calorific value kcal/kg (3000-5500)", c?.CalorificValue),
        BulkDensity = Prompt.Int("Bulk density kg/m3 (500-800)", c?.BulkDensity),
        Certification = Prompt.Optional("Certification", c?.Certification)
    };

    // ================================================================== POWER PLANT

    private List<Item> PowerPlantItems() =>
    [
        new("Pellet marketplace (with supplier ratings)", () => Call("PowerPlantController.GetPelletMarketplace", () => _app.PowerPlant.GetPelletMarketplace(
            Prompt.Choice("Pellet type", Catalog.PelletTypes, allowNone: true), Prompt.Choice("Grade", Catalog.Grades, allowNone: true),
            Prompt.OptionalDecimal("Max price per ton"), (int?)Prompt.OptionalDecimal("Min calorific value")), d =>
            Out.Table(["Id", "Manufacturer", "Rating", "Type", "Grade", "Tons", "Rs./t", "Moist", "Ash", "CV"], d.Select(i => new[]
            {
                Codes.PelletListing(i.Listing.ListingId), i.Manufacturer, i.Rating is { } r ? $"{r:0.0} ({i.Batches})" : "New",
                i.Listing.PelletType, i.Listing.Grade, Out.N(i.Listing.QuantityTons), Out.N(i.Listing.PricePerTon),
                $"{i.Listing.MoisturePct}%", $"{i.Listing.AshContentPct}%", i.Listing.CalorificValue.ToString()
            })))),
        new("Buy a pellet listing (whole lot)", () => Call("PowerPlantController.PurchasePellets", () => _app.PowerPlant.PurchasePellets(
            Prompt.Id("Pellet listing id (PL-...)"), Prompt.Text("Delivery address", "Nashik Thermal Power Station, Eklahare, Nashik 422105"), Prompt.Optional("Notes")))),
        new("My pellet orders & tracking", () => Call("PowerPlantController.GetOrders", () => _app.PowerPlant.GetOrders(), ShowOrders)),
        new("Pay a pellet order", () => Call("PowerPlantController.PayPelletOrder", () => _app.PowerPlant.PayPelletOrder(Prompt.Text("Order code (PP-...)")))),
        new("Submit batch feedback (lab audit)", () => Call("PowerPlantController.SubmitFeedback", () => _app.PowerPlant.SubmitFeedback(
            Prompt.Text("Order code (PP-...)"), Prompt.Date("Received date", Clock.Today), Prompt.Decimal("Quantity received (t)"),
            Prompt.Decimal("Measured moisture %"), Prompt.Decimal("Measured ash %"), Prompt.Int("Measured calorific value"), Prompt.Optional("Remarks")))),
        new("Consumption log", () => Call("PowerPlantController.GetConsumption", () => _app.PowerPlant.GetConsumption(), d =>
            Out.Table(["Id", "Date", "Unit", "Pellets t", "Coal t", "Co-firing %", "MWh"], d.Select(c => new[]
            {
                c.EntryId.ToString(), Out.D(c.EntryDate), c.Unit, Out.N(c.PelletsTons), Out.N(c.CoalTons), c.CofiringRatioPct.ToString("0.00"), Out.N(c.EnergyMwh)
            })))),
        new("Add consumption entry", () => Call("PowerPlantController.AddConsumption", () => _app.PowerPlant.AddConsumption(
            Prompt.Date("Date", Clock.Today), Prompt.Text("Unit", "Unit 3 (210 MW)"), Prompt.Decimal("Pellets (t)"),
            Prompt.Decimal("Coal (t)"), Prompt.Decimal("Energy generated (MWh)"), Prompt.Optional("Remarks")))),
        new("Delete consumption entry", () => Call("PowerPlantController.DeleteConsumption", () => _app.PowerPlant.DeleteConsumption(Prompt.Id("Entry id")))),
        new("Carbon savings & ESG", () => Call("PowerPlantController.GetCarbonSavings", () => _app.PowerPlant.GetCarbonSavings(
            Prompt.Date("From", Clock.Today.AddDays(-29)), Prompt.Date("To", Clock.Today)), d =>
        {
            Out.Detail($"Pellets {Out.N(d.PelletsTons)} t | Coal {Out.N(d.CoalTons)} t | Co-firing {d.RatioPct:0.00}% | Energy {Out.N(d.EnergyMwh)} MWh (green {Out.N(d.GreenEnergyMwh)})");
            Out.Detail($"CO2 avoided {Out.N(d.Co2AvoidedTons)} t | Coal displaced {Out.N(d.CoalDisplacedTons)} t | Stubble saved {Out.N(d.StubbleSavedTons)} t | Trees {d.TreeEquivalent:N0}");
            Out.Table(["Month", "Pellets t", "Co-firing %", "CO2 t", "Coal t", "Stubble t", "Green MWh"], d.Months.Select(m => new[]
                { m.Month, Out.N(m.Pellets), m.RatioPct.ToString("0.00"), Out.N(m.Co2), Out.N(m.Coal), Out.N(m.Stubble), Out.N(m.GreenEnergyMwh) }));
        })),
        new("Compliance certificates", () => Call("PowerPlantController.GetCertificates", () => _app.PowerPlant.GetCertificates(), d =>
            Out.Table(["No.", "Title", "Issued", "Valid until", "Status"], d.Select(c => new[]
                { c.Certificate.CertificateNo, c.Certificate.Title, Out.D(c.Certificate.IssueDate), Out.D(c.Certificate.ValidUntil), c.Status }), 45))),
        new("Raise a complaint", RaiseComplaint)
    ];

    // ================================================================== LOGISTICS

    private List<Item> LogisticsItems() =>
    [
        new("Shipments (biomass + pellet)", () => Call("LogisticsController.GetShipments", () => _app.Logistics.GetShipments(
            Prompt.EnumChoice<OrderStatus>("Status filter")), ShowOrders)),
        new("Schedule pickup (Placed -> Pickup Scheduled)", () => Call("LogisticsController.SchedulePickup", () => _app.Logistics.SchedulePickup(
            Prompt.Text("Order code (PO-B... / PP-...)"), Prompt.Date("Pickup date", Clock.Today.AddDays(1)), Prompt.Date("Expected delivery", Clock.Today.AddDays(2)),
            Prompt.Text("Vehicle no. (e.g. MH15EF2290)"), Prompt.Text("Driver name"), Prompt.Text("Driver mobile")))),
        new("Edit shipment details", () => Call("LogisticsController.UpdateShipmentDetails", () => _app.Logistics.UpdateShipmentDetails(
            Prompt.Text("Order code"), Prompt.OptionalDate("New pickup date (ignored once In Transit)"), Prompt.Date("Expected delivery", Clock.Today.AddDays(2)),
            Prompt.Text("Vehicle no."), Prompt.Text("Driver name"), Prompt.Text("Driver mobile")))),
        new("Mark dispatched (Pickup Scheduled -> In Transit)", () => Call("LogisticsController.MarkDispatched", () => _app.Logistics.MarkDispatched(Prompt.Text("Order code")))),
        new("Mark delivered (In Transit -> Delivered)", () => Call("LogisticsController.MarkDelivered", () => _app.Logistics.MarkDelivered(Prompt.Text("Order code"))))
    ];

    // ================================================================== ADMIN

    private List<Item> AdminItems() =>
    [
        new("Dashboard", () => Call("AdminController.GetDashboard", () => _app.Admin.GetDashboard(), d =>
            Out.Detail($"Users {d.TotalUsers} (active {d.ActiveUsers}) | Farmers {d.Farmers} | Manufacturers {d.Manufacturers} | Plants {d.PowerPlants} | Active orders {d.ActiveOrders}"))),
        new("Users (filters)", () => Call("AdminController.GetUsers", () => _app.Admin.GetUsers(
            Prompt.EnumChoice<UserRole>("Role"), Prompt.EnumChoice<UserStatus>("Status"), Prompt.Optional("Keyword")), d =>
            Out.Table(["Id", "Name", "Email", "Mobile", "Role", "Status", "Block category"], d.Select(u => new[]
                { u.UserId.ToString(), u.Name, u.Email, u.Mobile, u.Role.Label(), u.Status.Label(), u.BlockCategory })))),
        new("Block user", () => Call("AdminController.BlockUser", () => _app.Admin.BlockUser(
            Prompt.Id("User id"), Prompt.Choice("Category", Catalog.BlockCategories)!, Prompt.Text("Reason (10-500 chars)")))),
        new("Unblock user", () => Call("AdminController.UnblockUser", () => _app.Admin.UnblockUser(Prompt.Id("User id")))),
        new("Verification workbench", () => Call("AdminController.GetVerifications", () => _app.Admin.GetVerifications(
            Prompt.EnumChoice<VerificationStatus>("Status") , Prompt.EnumChoice<UserRole>("Role")), d =>
            Out.Table(["Doc id", "User", "Role", "Document", "Number", "File", "Submitted", "Status"], d.Select(v => new[]
                { v.DocumentId.ToString(), v.User?.Name, v.User?.Role.Label(), v.DocType.Label(), v.DocNumber, v.DocFile, Out.D(v.SubmittedOn), v.Status.Label() })))),
        new("Approve / reject a document", async () =>
        {
            var id = Prompt.Id("Document id");
            bool approve = Prompt.YesNo("Approve (n = reject)");
            string? cat = null, reason = null;
            if (!approve) { cat = Prompt.Choice("Rejection category", Catalog.RejectCategories); reason = Prompt.Text("Reason (10-500 chars)"); }
            await Call("AdminController.ReviewVerification", () => _app.Admin.ReviewVerification(id, approve, cat, reason));
        }),
        new("Orders & transactions", () => Call("AdminController.GetOrders", () => _app.Admin.GetOrders(
            null, Prompt.EnumChoice<OrderStatus>("Status"), Prompt.OptionalDate("From"), Prompt.OptionalDate("To"), Prompt.Optional("Keyword")), ShowOrders)),
        new("Disputes", () => Call("AdminController.GetDisputes", () => _app.Admin.GetDisputes(Prompt.EnumChoice<ComplaintStatus>("Status")), d =>
            Out.Table(["Id", "Order", "Raised by", "Against", "Category", "Status", "Resolution"], d.Select(x => new[]
                { x.Complaint.ComplaintId.ToString(), x.OrderCode, x.RaisedBy, x.Against, x.Complaint.Category, x.Complaint.Status.Label(), x.Complaint.Resolution })))),
        new("Resolve dispute", () => Call("AdminController.ResolveDispute", () => _app.Admin.ResolveDispute(
            Prompt.Id("Complaint id"), Prompt.Text("Resolution (10-500 chars)")))),
        new("Audit logs", () => Call("AdminController.GetAuditLogs", () => _app.Admin.GetAuditLogs(
            Prompt.Int("Page", 1), 15, Prompt.Optional("Module (Users, Verification, Disputes, Compliance, Settings)"), null, null, null, Prompt.Optional("Keyword")), d =>
            Out.Table(["When", "By", "Module", "Action"], d.Items.Select(l => new[]
                { l.LoggedAt.ToLocalTime().ToString("dd MMM yyyy HH:mm"), l.User?.Name, l.Module, l.Action }), 90))),
        new("Issue compliance certificate", () => Call("AdminController.IssueCertificate", () => _app.Admin.IssueCertificate(
            Prompt.Id("Power plant user id"), Prompt.Date("Issue date", Clock.Today), Prompt.Date("Valid until", Clock.Today.AddYears(1)),
            Prompt.Optional("Remarks")))),
        new("Reports", () => Call("AdminController.GetReports", () => _app.Admin.GetReports(), d =>
        {
            Out.Detail($"Delivered biomass {Out.N(d.DeliveredBiomassTons)} t | pellets {Out.N(d.DeliveredPelletTons)} t | Paid {Out.Inr(d.PaidValue)} | Pending {Out.Inr(d.PendingValue)}");
            Out.Detail("Orders by status: " + string.Join(", ", d.StatusCounts.Select(kv => $"{kv.Key.Label()} {kv.Value}")));
            Out.Table(["Month", "Biomass t", "Pellets t", "Deliveries"], d.Months.Select(m => new[] { m.Month, Out.N(m.BiomassTons), Out.N(m.PelletTons), m.Deliveries.ToString() }));
        })),
        new("Platform settings", () => Call("AdminController.GetSettings", () => _app.Admin.GetSettings(), ShowSettings)),
        new("Update platform settings", async () =>
        {
            var s = (await _app.Admin.GetSettings()).Data;
            if (s is null) { Out.Blocked("Sign in as admin first."); return; }
            var n = s.Clone();
            n.PlatformName = Prompt.Text("Platform name", s.PlatformName);
            n.SupportEmail = Prompt.Text("Support email", s.SupportEmail);
            n.SupportPhone = Prompt.Text("Support phone", s.SupportPhone);
            n.CommissionPct = Prompt.Decimal("Commission % (0-20)", s.CommissionPct);
            n.GstOnCommissionPct = Prompt.Decimal("GST on commission % (0-28)", s.GstOnCommissionPct);
            n.MinOrderTons = Prompt.Int("Minimum order tons (1-1000)", s.MinOrderTons);
            n.SessionTimeoutMin = Prompt.Int("Session timeout minutes (5-240)", s.SessionTimeoutMin);
            n.MaxLoginAttempts = Prompt.Int("Max login attempts (3-10)", s.MaxLoginAttempts);
            n.MaxUploadMb = Prompt.Int("Max upload MB (1-25)", s.MaxUploadMb);
            n.NotifyRegistrations = Prompt.YesNo("Notify registrations", s.NotifyRegistrations);
            n.NotifyComplaints = Prompt.YesNo("Notify complaints", s.NotifyComplaints);
            n.NotifyHighValue = Prompt.YesNo("Notify high-value orders", s.NotifyHighValue);
            if (n.NotifyHighValue) n.HighValueThreshold = Prompt.Decimal("High-value threshold (10000-100000000)", s.HighValueThreshold);
            await Call("AdminController.UpdateSettings", () => _app.Admin.UpdateSettings(n), ShowSettings);
        })
    ];

    // ================================================================== display helpers

    private static void ShowBiomassListings(List<BiomassListing> list) =>
        Out.Table(["Id", "Farmer", "Type", "Tons", "Rs./t", "Location", "State", "Available", "Status"], list.Select(l => new[]
        {
            Codes.BiomassListing(l.ListingId), l.Farmer?.Name ?? "", l.BiomassType, Out.N(l.QuantityTons), Out.N(l.PricePerTon),
            l.Location, l.State, Out.D(l.AvailableFrom), l.Status.Label()
        }));

    private static void ShowPelletListings(List<PelletListing> list) =>
        Out.Table(["Id", "Type", "Grade", "Tons", "Rs./t", "Moist", "Ash", "CV", "Available", "Status"], list.Select(l => new[]
        {
            Codes.PelletListing(l.ListingId), l.PelletType, l.Grade, Out.N(l.QuantityTons), Out.N(l.PricePerTon),
            $"{l.MoisturePct}%", $"{l.AshContentPct}%", l.CalorificValue.ToString(), Out.D(l.AvailableFrom), l.Status.Label()
        }));

    private static void ShowOrders(List<OrderView> list) =>
        Out.Table(["Order", "Seller", "Buyer", "Product", "Tons", "Total (DB)", "Status", "Vehicle", "Payment"], list.Select(o => new[]
        {
            o.Code, o.Seller, o.Buyer, o.Product, Out.N(o.QuantityTons), Out.Inr(o.TotalAmount), o.Status.Label(), o.VehicleNo, o.PaymentStatus.Label()
        }), 28);

    private static void ShowTracking(OrderView o)
    {
        Out.Detail(string.Join("  ->  ", Enum.GetValues<OrderStatus>().Select(s => s <= o.Status ? $"[x] {s.Label()}" : $"[ ] {s.Label()}")));
        Out.Detail($"From {o.PickupAddress}  to  {o.DeliveryAddress}");
        Out.Detail($"Truck {o.VehicleNo ?? "-"} | Driver {o.DriverName ?? "-"} {o.DriverMobile} | Pickup {Out.D(o.PickupDate)} | Expected {Out.D(o.ExpectedDelivery)} | Dispatched {Out.D(o.DispatchedDate)} | Delivered {Out.D(o.DeliveredDate)}");
    }

    private static void ShowFarmerProfile(FarmerProfile p)
    {
        var u = p.User;
        Out.Detail($"{u?.Name} | {u?.Email} | {u?.Mobile} | Status {u?.Status}");
        Out.Detail($"DOB {Out.D(p.Dob)} | {p.Gender} | {p.Address}, {p.Village}, {p.District}, {p.State} {p.Pincode}");
        Out.Detail($"Farm {p.FarmAreaAcres} acres | Crops {p.PrimaryCrops} | Aadhaar XXXX XXXX {p.AadhaarLast4}");
        Out.Detail($"Bank {p.BankName} | A/c {Mask(p.AccountNo)} | IFSC {p.Ifsc} | UPI {p.UpiId} | PAN {p.Pan}");
    }

    private static string Mask(string? acct) => string.IsNullOrEmpty(acct) ? "-" : new string('X', Math.Max(0, acct.Length - 4)) + acct[^Math.Min(4, acct.Length)..];

    private static void ShowSettings(PlatformSettings s) =>
        Out.Detail($"{s.PlatformName} | {s.SupportEmail} | {s.SupportPhone} | commission {s.CommissionPct}% + GST {s.GstOnCommissionPct}% | min order {s.MinOrderTons} t | " +
                   $"timeout {s.SessionTimeoutMin} min | login attempts {s.MaxLoginAttempts} | upload {s.MaxUploadMb} MB | high value {(s.NotifyHighValue ? Out.Inr(s.HighValueThreshold) : "off")}");
}
