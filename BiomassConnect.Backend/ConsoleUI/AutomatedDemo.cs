using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.ConsoleUI;

/// <summary>
/// [1] Run Full Automated Demo: the whole supply chain, step by step, through the controllers only.
/// Alongside the happy path it deliberately attempts invalid actions, each printed as [BLOCKED].
/// All demo accounts use @demo.local and can be removed with [4] Clean Demo Data.
/// </summary>
public sealed class AutomatedDemo
{
    private readonly AppHost _app;
    private int _blockedShown;

    private const string Pwd = "Demo@1234";
    private const string FarmerEmail = "farmer@demo.local", MfrEmail = "manufacturer@demo.local", PlantEmail = "powerplant@demo.local";
    private const string Unit3 = "Unit 3 (210 MW)";

    public AutomatedDemo(AppHost app) => _app = app;

    private sealed class DemoAborted(string message) : Exception(message);

    public async Task RunAsync(bool pauseBetweenSteps)
    {
        Out.Banner("FULL AUTOMATED DEMO - Biomass Connect supply chain");
        Out.Info("Removing any earlier @demo.local data first so the run starts clean...");
        await DemoData.CleanAsync(_app.Db, quiet: true);
        _blockedShown = 0;
        try
        {
            await RunStepsAsync(pauseBetweenSteps);
            Out.Banner("DEMO COMPLETE");
            Out.Ok($"Every step ran Controller -> Service -> PostgreSQL. {_blockedShown} invalid action(s) were blocked by the rules.");
            Out.Info("The demo data stays in the database: [3] Show Database Tables to inspect it, [4] Clean Demo Data to remove it.");
        }
        catch (DemoAborted ex)
        {
            Out.Blocked($"Demo stopped: a happy-path step did not succeed ({ex.Message}).");
        }
        finally
        {
            _app.Auth.Logout();
        }
    }

    private async Task RunStepsAsync(bool pause)
    {
        var today = Clock.Today;

        // ------------------------------------------------------------------ 1
        Out.Step("1", "Register a farmer, a manufacturer and a power plant (status Pending)");
        await Must("AuthController.Register (Farmer)", () => _app.Auth.Register(UserRole.Farmer,
            "Ramesh Patil", "", FarmerEmail, "7000000101", Pwd, "What is your birth city?", "Pune",
            "Maharashtra", "422001", "234567891234", "aadhaar_ramesh.pdf", 386));
        await Must("AuthController.Register (Manufacturer)", () => _app.Auth.Register(UserRole.Manufacturer,
            "GreenPellet Industries Demo", "Suresh Kulkarni", MfrEmail, "7000000102", Pwd, "What is your birth city?", "Nashik",
            "Maharashtra", "422010", "27DEMOM1234M1Z5", "gst_greenpellet.pdf", 412));
        var plantId = await Must("AuthController.Register (Power Plant)", () => _app.Auth.Register(UserRole.PowerPlant,
            "NTPC Nashik Unit Demo", "Anil Deshmukh", PlantEmail, "7000000103", Pwd, "What is your birth city?", "Nashik",
            "Maharashtra", "422105", "27DEMOP1234P1Z5", "gst_ntpc_nashik.pdf", 512));
        await Expect("AuthController.Register (same email again)", () => _app.Auth.Register(UserRole.Farmer,
            "Another Farmer", "", FarmerEmail, "7000000199", Pwd, "What is your birth city?", "Pune",
            "Maharashtra", "422001", "234567891299", "aadhaar.pdf", 100));
        await TableViewer.ShowAsync(_app.Db, "users");
        Pause(pause);

        // ------------------------------------------------------------------ 2
        Out.Step("2", "Admin approves their KYC documents");
        await Login(DemoData.AdminEmail, DemoData.AdminPassword);
        var pending = await Must("AdminController.GetVerifications (Pending)", () => _app.Admin.GetVerifications(VerificationStatus.Pending));
        foreach (var doc in pending.Where(d => d.User!.Email.EndsWith(DemoData.DemoDomain)))
            await Must($"AdminController.ReviewVerification ({doc.DocType.Label()} of {doc.User!.Name})",
                () => _app.Admin.ReviewVerification(doc.DocumentId, approve: true));
        await TableViewer.ShowAsync(_app.Db, "verification_documents");
        Pause(pause);

        // ------------------------------------------------------------------ 3
        Out.Step("3", "Farmer creates a biomass listing");
        await Login(FarmerEmail, Pwd);
        var listing = await Must("FarmerController.CreateListing", () => _app.Farmer.CreateListing(new BiomassListing
        {
            BiomassType = "Rice Husk", QuantityTons = 40, PricePerTon = 2000, Location = "Nashik", District = "Nashik",
            State = "Maharashtra", AvailableFrom = today, Description = "Clean, dry rice husk stored under cover."
        }));
        Out.Step("3b", "Farmer tries a second active Rice Husk listing at the same pickup point");
        await Expect("FarmerController.CreateListing (duplicate)", () => _app.Farmer.CreateListing(new BiomassListing
        {
            BiomassType = "Rice Husk", QuantityTons = 10, PricePerTon = 2100, Location = "nashik", District = "Nashik",
            State = "Maharashtra", AvailableFrom = today
        }));
        Pause(pause);

        // ------------------------------------------------------------------ 4
        Out.Step("4", "Manufacturer buys the biomass listing");
        await Login(MfrEmail, Pwd);
        var market = await Must("ManufacturerController.GetBiomassMarketplace (Rice Husk, Maharashtra)",
            () => _app.Manufacturer.GetBiomassMarketplace("Rice Husk", "Maharashtra"));
        Out.Detail($"Marketplace shows {market.Count} listing(s); buying {Codes.BiomassListing(listing.ListingId)} as a whole lot.");
        var po = await Must("ManufacturerController.PurchaseBiomass", () => _app.Manufacturer.PurchaseBiomass(
            listing.ListingId, "Plot 14, MIDC Ambad, Nashik 422010", "Deliver before noon"));

        Out.Step("4b", "Farmer tries to edit the sold listing");
        await Login(FarmerEmail, Pwd);
        var mine = await Must("FarmerController.GetListings", () => _app.Farmer.GetListings());
        Out.Info($"Listing {Codes.BiomassListing(listing.ListingId)} is now: {mine.First(l => l.ListingId == listing.ListingId).Status.Label()}");
        await Expect("FarmerController.UpdateListing", () => _app.Farmer.UpdateListing(listing.ListingId, new BiomassListing
        {
            BiomassType = "Rice Husk", QuantityTons = 45, PricePerTon = 2000, Location = "Nashik", District = "Nashik",
            State = "Maharashtra", AvailableFrom = today
        }));

        Out.Step("4c", "Manufacturer tries to pay before delivery");
        await Login(MfrEmail, Pwd);
        await Expect("ManufacturerController.PayFarmerOrder", () => _app.Manufacturer.PayFarmerOrder(po.Code));
        await TableViewer.ShowAsync(_app.Db, "biomass_listings", "purchase_orders");
        Pause(pause);

        // ------------------------------------------------------------------ 5
        Out.Step("5", "Logistics schedules pickup, marks dispatched, marks delivered");
        await Login(DemoData.LogisticsEmail, DemoData.LogisticsPassword);
        await Expect("LogisticsController.MarkDispatched (Placed -> In Transit, skipping a state)", () => _app.Logistics.MarkDispatched(po.Code));
        await Expect("LogisticsController.SchedulePickup (invalid vehicle number 'MH 1234')", () => _app.Logistics.SchedulePickup(
            po.Code, today.AddDays(1), today.AddDays(2), "MH 1234", "Santosh Kale", "9823011456"));
        await Must("LogisticsController.SchedulePickup", () => _app.Logistics.SchedulePickup(
            po.Code, today, today.AddDays(1), "MH15EF2290", "Santosh Kale", "9823011456"));
        await Must("LogisticsController.MarkDispatched", () => _app.Logistics.MarkDispatched(po.Code));
        await Expect("LogisticsController.MarkDispatched (again: repeating / going back)", () => _app.Logistics.MarkDispatched(po.Code));
        await Must("LogisticsController.MarkDelivered", () => _app.Logistics.MarkDelivered(po.Code));

        Out.Step("5b", "Farmer views the order tracking (read-only)");
        await Login(FarmerEmail, Pwd);
        var track = await Must("FarmerController.GetOrderTracking", () => _app.Farmer.GetOrderTracking(po.Code));
        PrintTracking(track);
        Pause(pause);

        // ------------------------------------------------------------------ 6
        Out.Step("6", "Manufacturer pays the farmer");
        await Login(MfrEmail, Pwd);
        await Must("ManufacturerController.PayFarmerOrder", () => _app.Manufacturer.PayFarmerOrder(po.Code));
        await Login(FarmerEmail, Pwd);
        var dash = await Must("FarmerController.GetDashboard", () => _app.Farmer.GetDashboard());
        Out.Detail($"Farmer KPIs: active listings {dash.ActiveListings}, orders {dash.TotalOrders}, earnings {Out.Inr(dash.Earnings)}, pending receivables {Out.Inr(dash.PendingReceivables)}");
        Pause(pause);

        // ------------------------------------------------------------------ 7
        Out.Step("7", "Manufacturer publishes a pellet listing");
        await Login(MfrEmail, Pwd);
        await Expect("ManufacturerController.CreatePelletListing (moisture 18% > 15%)", () => _app.Manufacturer.CreatePelletListing(Pellet(moisture: 18, grade: "Standard")));
        await Expect("ManufacturerController.CreatePelletListing (Premium with ash 9% > 8%)", () => _app.Manufacturer.CreatePelletListing(Pellet(ash: 9)));
        var pellet = await Must("ManufacturerController.CreatePelletListing", () => _app.Manufacturer.CreatePelletListing(Pellet()));
        Pause(pause);

        // ------------------------------------------------------------------ 8
        Out.Step("8", "Power plant buys the pellets; logistics moves the order to Delivered");
        await Login(PlantEmail, Pwd);
        var pmarket = await Must("PowerPlantController.GetPelletMarketplace (Premium)", () => _app.PowerPlant.GetPelletMarketplace(grade: "Premium"));
        var item = pmarket.FirstOrDefault(i => i.Listing.ListingId == pellet.ListingId);
        Out.Detail($"{Codes.PelletListing(pellet.ListingId)} by {item?.Manufacturer}: rating {(item?.Rating is { } r ? $"{r:0.0} ({item.Batches} batches)" : "New supplier")}");
        var pp = await Must("PowerPlantController.PurchasePellets", () => _app.PowerPlant.PurchasePellets(
            pellet.ListingId, "Nashik Thermal Power Station, Eklahare, Nashik 422105"));
        await Login(DemoData.LogisticsEmail, DemoData.LogisticsPassword);
        await Must("LogisticsController.SchedulePickup", () => _app.Logistics.SchedulePickup(
            pp.Code, today, today.AddDays(1), "MH15JK3301", "Imran Pathan", "9881224470"));
        await Must("LogisticsController.MarkDispatched", () => _app.Logistics.MarkDispatched(pp.Code));
        await Must("LogisticsController.MarkDelivered", () => _app.Logistics.MarkDelivered(pp.Code));
        Pause(pause);

        // ------------------------------------------------------------------ 9
        Out.Step("9", "Power plant submits batch feedback; quality score is computed");
        await Login(PlantEmail, Pwd);
        Out.Detail("Declared: moisture 8%, ash 6%, calorific value 4200 kcal/kg.  Measured: 9.5%, 6%, 4150.");
        var fb = await Must("PowerPlantController.SubmitFeedback", () => _app.PowerPlant.SubmitFeedback(
            pp.Code, today, 50, 9.5m, 6m, 4150, "Slightly higher moisture than declared."));
        Out.Detail($"Score = avg(moisture 3.5, ash 5.0, calorific 4.5) = {fb.Score:0.0}; manufacturer_ratings view now says {fb.ManufacturerRating:0.0}");
        await Expect("PowerPlantController.SubmitFeedback (second time, same order)", () => _app.PowerPlant.SubmitFeedback(
            pp.Code, today, 50, 8m, 6m, 4200));
        await Must("PowerPlantController.PayPelletOrder", () => _app.PowerPlant.PayPelletOrder(pp.Code));
        Pause(pause);

        // ------------------------------------------------------------------ 10
        Out.Step("10", "Power plant records consumption logs; co-firing % comes from the database");
        await Must("PowerPlantController.AddConsumption", () => _app.PowerPlant.AddConsumption(today, Unit3, 150, 2400, 4800, "Normal run"));
        await Must("PowerPlantController.AddConsumption", () => _app.PowerPlant.AddConsumption(today.AddDays(-1), Unit3, 142.5m, 2380, 4750));
        await Expect("PowerPlantController.AddConsumption (same unit and date again)", () => _app.PowerPlant.AddConsumption(today, Unit3, 120, 2400, 4700));
        await Expect("PowerPlantController.AddConsumption (co-firing above 20%)", () => _app.PowerPlant.AddConsumption(today, "Unit 4 (210 MW)", 900, 2400, 4800));
        await Expect("PowerPlantController.AddConsumption (6000 MWh from a 210 MW unit)", () => _app.PowerPlant.AddConsumption(today, "Unit 4 (210 MW)", 100, 2400, 6000));
        await TableViewer.ShowAsync(_app.Db, "consumption_logs");
        Pause(pause);

        // ------------------------------------------------------------------ 11
        Out.Step("11", "Carbon savings report (CO2, coal, stubble, trees)");
        var carbon = await Must("PowerPlantController.GetCarbonSavings (last 30 days)", () => _app.PowerPlant.GetCarbonSavings(today.AddDays(-29), today));
        Out.Detail($"Pellets co-fired {Out.N(carbon.PelletsTons)} t | coal {Out.N(carbon.CoalTons)} t | average co-firing {carbon.RatioPct:0.00}%");
        Out.Detail($"CO2 avoided       = {Out.N(carbon.PelletsTons)} x 1.5  = {Out.N(carbon.Co2AvoidedTons)} t");
        Out.Detail($"Coal displaced    = {Out.N(carbon.PelletsTons)} x 1.15 = {Out.N(carbon.CoalDisplacedTons)} t");
        Out.Detail($"Stubble not burnt = {Out.N(carbon.PelletsTons)} x 1.2  = {Out.N(carbon.StubbleSavedTons)} t");
        Out.Detail($"Tree equivalent   = CO2 / 0.022 t   = {carbon.TreeEquivalent:N0} trees for a year");
        Out.Detail($"Green energy      = sum(energy x co-firing %) = {Out.N(carbon.GreenEnergyMwh)} MWh");
        Pause(pause);

        // ------------------------------------------------------------------ 12
        Out.Step("12", "A complaint is raised and Admin resolves it");
        await Expect("CommonController.SubmitComplaint (category the power plant portal does not offer)", () => _app.Common.SubmitComplaint(
            pp.Code, "Payment delayed", "Testing a category that the power plant portal does not offer."));
        var complaint = await Must("CommonController.SubmitComplaint", () => _app.Common.SubmitComplaint(
            pp.Code, "Pellet quality issue", "Moisture measured at 9.5% against the declared 8% on this batch."));
        await Expect("CommonController.SubmitComplaint (same order and category while still open)", () => _app.Common.SubmitComplaint(
            pp.Code, "Pellet quality issue", "Raising the same moisture complaint a second time."));
        await Login(DemoData.AdminEmail, DemoData.AdminPassword);
        var disputes = await Must("AdminController.GetDisputes (Open)", () => _app.Admin.GetDisputes(ComplaintStatus.Open));
        Out.Detail($"{disputes.Count} open dispute(s) on the platform.");
        await Must("AdminController.ResolveDispute", () => _app.Admin.ResolveDispute(complaint.ComplaintId,
            "Manufacturer agreed to a 2% moisture credit on the next invoice."));
        Pause(pause);

        // ------------------------------------------------------------------ 13
        Out.Step("13", "Admin issues a compliance certificate");
        await Must("AdminController.IssueCertificate", () => _app.Admin.IssueCertificate(plantId, today, today.AddYears(1),
            "Biomass co-firing as per the Ministry of Power policy."));
        await Login(PlantEmail, Pwd);
        var certs = await Must("PowerPlantController.GetCertificates", () => _app.PowerPlant.GetCertificates());
        foreach (var c in certs) Out.Detail($"{c.Certificate.CertificateNo} | {c.Certificate.Title} | valid until {Out.D(c.Certificate.ValidUntil)} | {c.Status}");
        Pause(pause);

        // ------------------------------------------------------------------ 14
        Out.Step("14", "Audit log and dashboard summary");
        await Login(DemoData.AdminEmail, DemoData.AdminPassword);
        var audit = await Must("AdminController.GetAuditLogs (page 1)", () => _app.Admin.GetAuditLogs(1, 10));
        Out.Table(["When", "Module", "Action"], audit.Items.Select(l => new[] { l.LoggedAt.ToLocalTime().ToString("dd MMM HH:mm"), l.Module, l.Action }), 90);
        var admin = await Must("AdminController.GetDashboard", () => _app.Admin.GetDashboard());
        Out.Detail($"Users {admin.TotalUsers} (active {admin.ActiveUsers}) | Farmers {admin.Farmers} | Manufacturers {admin.Manufacturers} | Power plants {admin.PowerPlants}");
        Out.Detail($"Pending KYC {admin.PendingVerifications} | Active orders {admin.ActiveOrders} | Open disputes {admin.OpenDisputes} | GMV {Out.Inr(admin.Gmv)}");
        Pause(pause);

        // ------------------------------------------------------------------ 15
        Out.Step("15", "Login lockout after 3 failed attempts");
        _app.Auth.Logout();
        for (int i = 1; i <= 3; i++)
        {
            int attempt = i;
            await Expect($"AuthController.Login (wrong password, attempt {attempt})", () => _app.Auth.Login(FarmerEmail, "Wrong@123"));
        }
        await Expect("AuthController.Login (correct password, but still locked)", () => _app.Auth.Login(FarmerEmail, Pwd));
        Out.Info("The lock lasts 30 seconds and is kept in memory (the users table has no failed-attempt column).");
    }

    // ------------------------------------------------------------------ helpers

    private static PelletListing Pellet(decimal moisture = 8, decimal ash = 6, string grade = "Premium") => new()
    {
        PelletType = "Agro Residue Pellets", Grade = grade, QuantityTons = 50, PricePerTon = 7800,
        DiameterMm = 8, LengthMm = 30, MoisturePct = moisture, AshContentPct = ash, CalorificValue = 4200, BulkDensity = 650,
        PickupLocation = "Nashik, Maharashtra", AvailableFrom = Clock.Today, Certification = "BIS IS 17583"
    };

    private async Task Login(string email, string password)
    {
        Out.Controller($"AuthController.Login ({email})");
        var r = await _app.Auth.Login(email, password);
        Out.Print(r);
        if (!r.Success) throw new DemoAborted($"login as {email} failed");
    }

    /// <summary>A happy-path call: must succeed or the demo stops.</summary>
    private static async Task<T> Must<T>(string controllerMethod, Func<Task<Result<T>>> call)
    {
        Out.Controller(controllerMethod);
        var r = await call();
        Out.Print(r);
        if (!r.Success || r.Data is null) throw new DemoAborted(controllerMethod);
        return r.Data;
    }

    /// <summary>A deliberately invalid call: the rules must block it.</summary>
    private async Task Expect<T>(string controllerMethod, Func<Task<Result<T>>> call)
    {
        Out.Controller(controllerMethod);
        var r = await call();
        Out.Print(r);
        if (r.Success) Out.Info("(expected this to be blocked)");
        else _blockedShown++;
    }

    private static void PrintTracking(OrderView o)
    {
        var steps = Enum.GetValues<OrderStatus>().Select(s => s <= o.Status ? $"[x] {s.Label()}" : $"[ ] {s.Label()}");
        Out.Detail(string.Join("  ->  ", steps));
        Out.Detail($"Truck {o.VehicleNo} | Driver {o.DriverName} ({o.DriverMobile}) | Pickup {Out.D(o.PickupDate)} | Dispatched {Out.D(o.DispatchedDate)} | Delivered {Out.D(o.DeliveredDate)}");
    }

    private static void Pause(bool pause)
    {
        if (pause) Prompt.Pause();
    }
}
