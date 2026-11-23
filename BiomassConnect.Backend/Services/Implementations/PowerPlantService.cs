using System.Text.RegularExpressions;
using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Data;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;
using BiomassConnect.Backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BiomassConnect.Backend.Services.Implementations;

/// <summary>Power plant portal rules (js/powerplant/*.js).</summary>
public class PowerPlantService : ServiceBase, IPowerPlantService
{
    public PowerPlantService(DbFactory db) : base(db) { }

    // ------------------------------------------------------------------ Pellet marketplace & purchase

    public async Task<Result<List<PelletMarketItem>>> GetPelletMarketplaceAsync(string? pelletType = null, string? grade = null,
        decimal? maxPricePerTon = null, int? minCalorificValue = null)
    {
        var error = Rules.First(
            maxPricePerTon.HasValue ? Rules.Range(maxPricePerTon.Value, "Max price", 0, 100000, 2, exclusiveMin: true) : null,
            minCalorificValue.HasValue ? Rules.Range(minCalorificValue.Value, "Min calorific value", 1000, 6000, 0) : null);
        if (error != null) return Result.Blocked<List<PelletMarketItem>>(error);

        await using var db = Db.Create();
        var q = db.PelletListings.AsNoTracking().Include(l => l.Manufacturer)
            .Where(l => l.Status == ListingStatus.Active && l.QuantityTons > 0);
        if (!string.IsNullOrWhiteSpace(pelletType)) q = q.Where(l => l.PelletType == pelletType);
        if (!string.IsNullOrWhiteSpace(grade)) q = q.Where(l => l.Grade == grade);
        if (maxPricePerTon.HasValue) q = q.Where(l => l.PricePerTon <= maxPricePerTon);
        if (minCalorificValue.HasValue) q = q.Where(l => l.CalorificValue >= minCalorificValue);
        var listings = await q.OrderByDescending(l => l.CreatedAt).ThenByDescending(l => l.ListingId).ToListAsync();

        // Manufacturer rating comes from the manufacturer_ratings view.
        var ratings = await db.ManufacturerRatings.AsNoTracking().ToDictionaryAsync(r => r.ManufacturerId);
        var items = listings.Select(l => ratings.TryGetValue(l.ManufacturerId, out var r)
            ? new PelletMarketItem(l, l.Manufacturer?.Name ?? "", r.Rating, r.Batches)
            : new PelletMarketItem(l, l.Manufacturer?.Name ?? "", null, 0)).ToList();
        return Result.Ok(items, $"{items.Count} pellet listing(s) available");
    }

    /// <summary>Atomic whole-listing purchase (same steps as the biomass purchase).</summary>
    public Task<Result<OrderView>> PurchasePelletsAsync(long powerPlantId, long listingId, string deliveryAddress, string? notes) => Guard(async () =>
    {
        deliveryAddress = (deliveryAddress ?? "").Trim();
        var error = Rules.First(
            Rules.Text(deliveryAddress, "Delivery address", 10, 200, required: true),
            Rules.Text(notes, "Notes", 0, 500));
        if (error != null) return Result.Blocked<OrderView>(error);

        await using var db = Db.Create();
        await using var tx = await db.Database.BeginTransactionAsync();

        var listing = (await db.PelletListings
            .FromSqlInterpolated($"SELECT * FROM pellet_listings WHERE listing_id = {listingId} FOR UPDATE")
            .ToListAsync()).SingleOrDefault();

        if (listing is null || listing.Status != ListingStatus.Active || listing.QuantityTons <= 0)
            return Result.Blocked<OrderView>("This listing has just been sold or is no longer available. Please choose another listing.");
        if (listing.ManufacturerId == powerPlantId)
            return Result.Blocked<OrderView>("You cannot buy your own listing.");

        listing.Status = ListingStatus.SoldOut;
        var order = new PelletOrder
        {
            ListingId = listing.ListingId,
            ManufacturerId = listing.ManufacturerId,
            PowerPlantId = powerPlantId,
            QuantityTons = listing.QuantityTons,
            PricePerTon = listing.PricePerTon,
            OrderDate = Clock.Today,
            PickupAddress = listing.PickupLocation,
            DeliveryAddress = deliveryAddress,
            Notes = Clean(notes),
            Status = OrderStatus.Placed,
            PaymentStatus = PaymentStatus.Pending
        };
        db.PelletOrders.Add(order);
        await db.SaveChangesAsync();
        await tx.CommitAsync();

        var view = (await LoadOrderViewAsync(db, Codes.OrderKind.Pellet, order.OrderId))!;
        return Result.Ok(view, $"Pellet order created: {view.Code} with {view.Seller} | Status: {view.Status.Label()} | Total: {Inr(view.TotalAmount)} (from database)");
    });

    public async Task<Result<List<OrderView>>> GetOrdersAsync(long powerPlantId)
    {
        await using var db = Db.Create();
        var list = (await PelletOrdersQuery(db).Where(o => o.PowerPlantId == powerPlantId)
            .OrderByDescending(o => o.OrderDate).ThenByDescending(o => o.OrderId).ToListAsync()).Select(OrderView.From).ToList();
        return Result.Ok(list, $"{list.Count} pellet order(s)");
    }

    public Task<Result<OrderView>> PayPelletOrderAsync(long powerPlantId, long orderId) => Guard(async () =>
    {
        await using var db = Db.Create();
        var o = await db.PelletOrders.FirstOrDefaultAsync(x => x.OrderId == orderId && x.PowerPlantId == powerPlantId);
        var error = ManufacturerService.PaymentGuard(o, Codes.PelletOrder(orderId));
        if (error != null) return Result.Blocked<OrderView>(error);

        o!.PaymentStatus = PaymentStatus.Paid;
        o.PaidOn = Clock.Today;
        await db.SaveChangesAsync();
        var view = (await LoadOrderViewAsync(db, Codes.OrderKind.Pellet, orderId))!;
        return Result.Ok(view, $"Payment of {Inr(view.TotalAmount)} to {view.Seller} recorded for {view.Code}.");
    });

    // ------------------------------------------------------------------ Batch feedback

    public Task<Result<FeedbackResult>> SubmitFeedbackAsync(long powerPlantId, long orderId, DateOnly receivedDate, decimal quantityReceived,
        decimal moisturePct, decimal ashContentPct, int calorificValue, string? remarks) => Guard(async () =>
    {
        await using var db = Db.Create();
        var order = await db.PelletOrders.Include(o => o.Listing).Include(o => o.Feedback)
            .FirstOrDefaultAsync(o => o.OrderId == orderId && o.PowerPlantId == powerPlantId);
        var code = Codes.PelletOrder(orderId);

        if (order is null) return Result.Blocked<FeedbackResult>($"Order {code} was not found");
        if (order.Feedback != null) return Result.Blocked<FeedbackResult>($"Batch details for {code} have already been submitted");
        if (order.Status != OrderStatus.Delivered) return Result.Blocked<FeedbackResult>($"Order {code} has not been delivered yet");
        if (order.Listing is null) return Result.Blocked<FeedbackResult>("The declared specification for this order is not available, so the batch cannot be scored.");

        var minDate = order.DeliveredDate ?? order.OrderDate;
        var error = Rules.First(
            Rules.NotFuture(receivedDate, "Received date"),
            receivedDate < minDate ? $"Received date cannot be before the delivery date ({Rules.Fmt(minDate)})" : null,
            Rules.Range(quantityReceived, "Quantity received", 0, 10000, 2, exclusiveMin: true),
            quantityReceived > order.QuantityTons ? $"Quantity received cannot exceed the ordered {Rules.Fmt(order.QuantityTons)} tons" : null,
            Rules.Range(moisturePct, "Moisture", 0, 40, 2),
            Rules.Range(ashContentPct, "Ash content", 0, 40, 2),
            Rules.Range(calorificValue, "Calorific value", 1000, 6000, 0),
            Rules.Text(remarks, "Remarks", 0, 300));
        if (error != null) return Result.Blocked<FeedbackResult>(error);

        var score = BatchScore(order.Listing.MoisturePct, order.Listing.AshContentPct, order.Listing.CalorificValue,
                               moisturePct, ashContentPct, calorificValue);

        var feedback = new PelletFeedback
        {
            OrderId = orderId,
            ReceivedDate = receivedDate,
            QuantityReceived = quantityReceived,
            MoisturePct = moisturePct,
            AshContentPct = ashContentPct,
            CalorificValue = calorificValue,
            Score = score,
            Remarks = Clean(remarks)
        };
        db.PelletFeedback.Add(feedback);
        await db.SaveChangesAsync();

        var rating = await db.ManufacturerRatings.AsNoTracking().FirstOrDefaultAsync(r => r.ManufacturerId == order.ManufacturerId);
        return Result.Ok(new FeedbackResult(feedback, code, score, rating?.Rating),
            $"Batch details saved for {code}: score {score:0.0} / 5 ({ScoreLabel(score)}). Supplier rating is now {rating?.Rating:0.0}.");
    });

    /// <summary>
    /// js/common/store.js batchScore: each parameter scores 1–5.
    /// Moisture / ash: 5 if measured ≤ declared, −1 per % point above.
    /// Calorific value: 5 if measured ≥ declared, −1 per 100 kcal/kg below.
    /// Batch score = average of the three, rounded to 1 decimal.
    /// </summary>
    public static decimal BatchScore(decimal declaredMoisture, decimal declaredAsh, int declaredCv,
                                     decimal moisture, decimal ash, int cv)
    {
        static decimal Clamp(decimal n) => Math.Max(1m, Math.Min(5m, n));
        var m = Clamp(5 - Math.Max(0, moisture - declaredMoisture));
        var a = Clamp(5 - Math.Max(0, ash - declaredAsh));
        var c = Clamp(5 - Math.Max(0, declaredCv - cv) / 100m);
        return Math.Round((m + a + c) / 3 * 10, MidpointRounding.AwayFromZero) / 10;
    }

    private static string ScoreLabel(decimal s) =>
        s >= 5 ? "matches the declared specification"
        : s >= 4 ? "close to the declared specification"
        : s >= 3 ? "below the declared specification"
        : "well below the declared specification";

    // ------------------------------------------------------------------ Consumption & carbon savings

    public async Task<Result<List<ConsumptionLog>>> GetConsumptionAsync(long powerPlantId, string? unit = null)
    {
        await using var db = Db.Create();
        var q = db.ConsumptionLogs.AsNoTracking().Where(c => c.PowerPlantId == powerPlantId);
        if (!string.IsNullOrWhiteSpace(unit)) q = q.Where(c => c.Unit == unit);
        var list = await q.OrderByDescending(c => c.EntryDate).ThenBy(c => c.Unit).ToListAsync();
        return Result.Ok(list, $"{list.Count} entr{(list.Count == 1 ? "y" : "ies")}");
    }

    public Task<Result<ConsumptionLog>> AddConsumptionAsync(long powerPlantId, DateOnly entryDate, string unit, decimal pelletsTons,
        decimal coalTons, decimal energyMwh, string? remarks) => Guard(async () =>
    {
        unit = (unit ?? "").Trim();
        // consumption.js: a unit named "Unit 3 (210 MW)" can generate at most 210 × 24 MWh in a day.
        var mwMatch = Regex.Match(unit, @"(\d+)\s*MW", RegexOptions.IgnoreCase);
        int mw = mwMatch.Success ? int.Parse(mwMatch.Groups[1].Value) : 0;
        decimal maxEnergy = mw > 0 ? Math.Min(mw * 24m, Catalog.MaxDailyEnergyMwh) : Catalog.MaxDailyEnergyMwh;

        var error = Rules.First(
            Rules.NotFuture(entryDate, "Date"),
            Rules.MinDate(entryDate, Clock.Today.AddDays(-365), "Date"),
            Rules.Text(unit, "Unit", 1, 30, required: true),
            Rules.Range(pelletsTons, "Pellets", 0, 10000, 2, exclusiveMin: true),
            Rules.Range(coalTons, "Coal", 0, 50000, 2, exclusiveMin: true),
            mw > 0 && energyMwh > maxEnergy
                ? $"A {mw} MW unit can generate at most {Rules.Fmt(maxEnergy)} MWh in a day"
                : Rules.Range(energyMwh, "Energy generated", 0, maxEnergy, 2, exclusiveMin: true),
            Rules.Text(remarks, "Remarks", 0, 200));
        if (error != null) return Result.Blocked<ConsumptionLog>(error);

        // consumption.html: the auto-calculated ratio field allows at most 20 %. This is only a validation
        // preview; the stored cofiring_ratio_pct is generated by the database and read back below.
        var preview = Math.Round(pelletsTons * 100 / (pelletsTons + coalTons), 2, MidpointRounding.AwayFromZero);
        if (preview > Catalog.MaxCofiringRatioPct)
            return Result.Blocked<ConsumptionLog>($"Co-firing ratio would be {preview:0.00}%. It cannot exceed 20% - check the pellet and coal quantities.");

        await using var db = Db.Create();
        if (await db.ConsumptionLogs.AnyAsync(c => c.PowerPlantId == powerPlantId && c.EntryDate == entryDate && c.Unit == unit))
            return Result.Blocked<ConsumptionLog>($"An entry for {unit} on {Rules.Fmt(entryDate)} already exists. Delete it first to log a correction.");

        var log = new ConsumptionLog
        {
            PowerPlantId = powerPlantId,
            EntryDate = entryDate,
            Unit = unit,
            PelletsTons = pelletsTons,
            CoalTons = coalTons,
            EnergyMwh = energyMwh,
            Remarks = Clean(remarks)
        };
        db.ConsumptionLogs.Add(log);
        await db.SaveChangesAsync();             // cofiring_ratio_pct returned by the database
        return Result.Ok(log, $"Entry saved for {unit} on {Rules.Fmt(entryDate)}: co-firing {log.CofiringRatioPct:0.00}% (computed by the database)");
    });

    public Task<Result<Unit>> DeleteConsumptionAsync(long powerPlantId, long entryId) => Guard(async () =>
    {
        await using var db = Db.Create();
        var entry = await db.ConsumptionLogs.FirstOrDefaultAsync(c => c.EntryId == entryId && c.PowerPlantId == powerPlantId);
        if (entry is null) return Result.Blocked<Unit>("Entry not found");
        db.ConsumptionLogs.Remove(entry);
        await db.SaveChangesAsync();
        return Result.Ok(Unit.Value, $"Consumption entry for {entry.Unit} on {Rules.Fmt(entry.EntryDate)} deleted");
    });

    /// <summary>carbon-savings.js: Ministry of Power factors from js/powerplant/plant.js.</summary>
    public async Task<Result<CarbonReport>> GetCarbonSavingsAsync(long powerPlantId, DateOnly from, DateOnly to)
    {
        var error = Rules.First(
            Rules.NotFuture(from, "From date"),
            Rules.MinDate(from, Clock.Today.AddDays(-365), "From date"),
            Rules.NotFuture(to, "To date"),
            to < from ? "To date cannot be before from date" : null);
        if (error != null) return Result.Blocked<CarbonReport>(error);

        await using var db = Db.Create();
        var entries = await db.ConsumptionLogs.AsNoTracking()
            .Where(c => c.PowerPlantId == powerPlantId && c.EntryDate >= from && c.EntryDate <= to).ToListAsync();

        decimal pellets = entries.Sum(e => e.PelletsTons);
        decimal coal = entries.Sum(e => e.CoalTons);
        decimal energy = entries.Sum(e => e.EnergyMwh);
        decimal green = entries.Sum(e => e.EnergyMwh * e.CofiringRatioPct / 100);   // stored ratio from the database
        decimal co2Raw = pellets * Catalog.Co2PerTon;

        var months = new List<CarbonMonth>();
        for (var m = new DateOnly(from.Year, from.Month, 1); m <= to; m = m.AddMonths(1))
        {
            var inMonth = entries.Where(e => e.EntryDate.Year == m.Year && e.EntryDate.Month == m.Month).ToList();
            decimal p = inMonth.Sum(e => e.PelletsTons), c = inMonth.Sum(e => e.CoalTons);
            months.Add(new CarbonMonth(m.ToString("MMM yy"), p, Ratio(p, c),
                R2(p * Catalog.Co2PerTon), R2(p * Catalog.CoalPerTon), R2(p * Catalog.StubblePerTon),
                R2(inMonth.Sum(e => e.EnergyMwh * e.CofiringRatioPct / 100))));
        }

        return Result.Ok(new CarbonReport(from, to, entries.Count, pellets, coal, energy, R2(green), Ratio(pellets, coal),
            Co2AvoidedTons: R2(co2Raw),
            CoalDisplacedTons: R2(pellets * Catalog.CoalPerTon),
            StubbleSavedTons: R2(pellets * Catalog.StubblePerTon),
            TreeEquivalent: (long)Math.Round(co2Raw / Catalog.Co2PerTree, MidpointRounding.AwayFromZero),
            Months: months),
            $"{entries.Count} log entr{(entries.Count == 1 ? "y" : "ies")} from {Rules.Fmt(from)} to {Rules.Fmt(to)}");
    }

    private static decimal R2(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);
    private static decimal Ratio(decimal p, decimal c) => p + c > 0 ? R2(p / (p + c) * 100) : 0;

    // ------------------------------------------------------------------ Certificates

    public async Task<Result<List<CertificateView>>> GetCertificatesAsync(long powerPlantId)
    {
        await using var db = Db.Create();
        var today = Clock.Today;
        var list = (await db.Certificates.AsNoTracking().Include(c => c.Issuer)
                .Where(c => c.PowerPlantId == powerPlantId).OrderByDescending(c => c.IssueDate).ToListAsync())
            .Select(c => new CertificateView(c, c.ValidUntil >= today ? "Valid" : "Expired")).ToList();
        return Result.Ok(list, $"{list.Count} certificate(s)");
    }
}
