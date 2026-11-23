using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Data;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;
using BiomassConnect.Backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BiomassConnect.Backend.Services.Implementations;

/// <summary>Manufacturer portal rules (js/manufacturer/*.js).</summary>
public class ManufacturerService : ServiceBase, IManufacturerService
{
    public ManufacturerService(DbFactory db) : base(db) { }

    // ------------------------------------------------------------------ Biomass marketplace & purchase

    public async Task<Result<List<BiomassListing>>> GetBiomassMarketplaceAsync(string? biomassType = null, string? state = null,
        decimal? maxPricePerTon = null, string? keyword = null)
    {
        if (maxPricePerTon.HasValue && Rules.Range(maxPricePerTon.Value, "Max price", 100, 100000, 2) is { } err)
            return Result.Blocked<List<BiomassListing>>(err);

        await using var db = Db.Create();
        var q = db.BiomassListings.AsNoTracking().Include(l => l.Farmer)
            .Where(l => l.Status == ListingStatus.Active && l.QuantityTons > 0);
        if (!string.IsNullOrWhiteSpace(biomassType)) q = q.Where(l => l.BiomassType == biomassType);
        if (!string.IsNullOrWhiteSpace(state)) q = q.Where(l => l.State == state);
        if (maxPricePerTon.HasValue) q = q.Where(l => l.PricePerTon <= maxPricePerTon);
        var list = await q.OrderByDescending(l => l.CreatedAt).ThenByDescending(l => l.ListingId).ToListAsync();

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var k = keyword.Trim().ToLowerInvariant();
            list = list.Where(l => $"{l.BiomassType} {l.Farmer?.Name} {l.Location} {l.District} {l.State}".ToLowerInvariant().Contains(k)).ToList();
        }
        return Result.Ok(list, $"{list.Count} listing(s) available");
    }

    /// <summary>
    /// Whole-listing purchase in ONE transaction: lock the listing row, confirm it is Active,
    /// mark it Sold Out and create the purchase order as Placed (store.js placeOrder).
    /// </summary>
    public Task<Result<OrderView>> PurchaseBiomassAsync(long manufacturerId, long listingId, string deliveryAddress, string? notes) => Guard(async () =>
    {
        deliveryAddress = (deliveryAddress ?? "").Trim();
        var error = Rules.First(
            Rules.Text(deliveryAddress, "Delivery address", 10, 200, required: true),
            Rules.Text(notes, "Notes", 0, 500));
        if (error != null) return Result.Blocked<OrderView>(error);

        await using var db = Db.Create();
        await using var tx = await db.Database.BeginTransactionAsync();

        // Row lock: a second buyer waits here and then sees 'Sold Out'.
        var listing = (await db.BiomassListings
            .FromSqlInterpolated($"SELECT * FROM biomass_listings WHERE listing_id = {listingId} FOR UPDATE")
            .ToListAsync()).SingleOrDefault();

        if (listing is null || listing.Status != ListingStatus.Active || listing.QuantityTons <= 0)
            return Result.Blocked<OrderView>("This listing is no longer available. Please select another listing.");
        if (listing.FarmerId == manufacturerId)
            return Result.Blocked<OrderView>("You cannot buy your own listing.");

        listing.Status = ListingStatus.SoldOut;
        var order = new PurchaseOrder
        {
            ListingId = listing.ListingId,
            FarmerId = listing.FarmerId,                 // seller = owner of the listing
            ManufacturerId = manufacturerId,
            QuantityTons = listing.QuantityTons,         // copied from the listing at purchase
            PricePerTon = listing.PricePerTon,
            OrderDate = Clock.Today,
            PickupAddress = string.Join(", ", new[] { listing.Location, listing.District, listing.State }.Where(s => !string.IsNullOrWhiteSpace(s))),
            DeliveryAddress = deliveryAddress,
            Notes = Clean(notes),
            Status = OrderStatus.Placed,
            PaymentStatus = PaymentStatus.Pending
        };
        db.PurchaseOrders.Add(order);
        await db.SaveChangesAsync();                     // total_amount comes back from the database
        await tx.CommitAsync();

        var view = (await LoadOrderViewAsync(db, Codes.OrderKind.Biomass, order.OrderId))!;
        return Result.Ok(view,
            $"Purchase order created: {view.Code} | Status: {view.Status.Label()} | Total: {Inr(view.TotalAmount)} (from database)");
    });

    public async Task<Result<List<OrderView>>> GetInboundOrdersAsync(long manufacturerId, OrderStatus? status = null)
    {
        await using var db = Db.Create();
        var q = PurchaseOrdersQuery(db).Where(o => o.ManufacturerId == manufacturerId);
        if (status.HasValue) q = q.Where(o => o.Status == status);
        var list = (await q.OrderByDescending(o => o.OrderDate).ThenByDescending(o => o.OrderId).ToListAsync()).Select(OrderView.From).ToList();
        return Result.Ok(list, $"{list.Count} order(s) | {list.Count(o => o.Status != OrderStatus.Delivered)} in progress");
    }

    public Task<Result<OrderView>> PayFarmerOrderAsync(long manufacturerId, long orderId) => Guard(async () =>
    {
        await using var db = Db.Create();
        var o = await db.PurchaseOrders.FirstOrDefaultAsync(x => x.OrderId == orderId && x.ManufacturerId == manufacturerId);
        var error = PaymentGuard(o, Codes.PurchaseOrder(orderId));
        if (error != null) return Result.Blocked<OrderView>(error);

        o!.PaymentStatus = PaymentStatus.Paid;
        o.PaidOn = Clock.Today;
        await db.SaveChangesAsync();
        var view = (await LoadOrderViewAsync(db, Codes.OrderKind.Biomass, orderId))!;
        return Result.Ok(view, $"Payment of {Inr(view.TotalAmount)} to {view.Seller} recorded for {view.Code}.");
    });

    /// <summary>An order can be marked Paid only after it is Delivered (shared with the power plant service).</summary>
    internal static string? PaymentGuard(IShipmentOrder? o, string code) =>
        o is null ? $"Order {code} was not found among your orders"
        : o.PaymentStatus == PaymentStatus.Paid ? $"Order {code} is already paid"
        : o.Status != OrderStatus.Delivered ? $"Order {code} is {o.Status.Label()}: payment can be made only after it is Delivered."
        : null;

    // ------------------------------------------------------------------ Pellet listings

    public async Task<Result<List<PelletListing>>> GetPelletListingsAsync(long manufacturerId, ListingStatus? status = null)
    {
        await using var db = Db.Create();
        var q = db.PelletListings.AsNoTracking().Where(l => l.ManufacturerId == manufacturerId);
        if (status.HasValue) q = q.Where(l => l.Status == status);
        var list = await q.OrderByDescending(l => l.ListingId).ToListAsync();
        return Result.Ok(list, $"{list.Count} listing(s)");
    }

    public Task<Result<PelletListing>> CreatePelletListingAsync(long manufacturerId, PelletListing input) => Guard(async () =>
    {
        var l = Normalise(input);
        var error = Validate(l, Rules.NotPast(l.AvailableFrom, "Available from"));
        if (error != null) return Result.Blocked<PelletListing>(error);

        await using var db = Db.Create();
        l.ManufacturerId = manufacturerId;
        l.Status = ListingStatus.Active;
        l.CreatedAt = Clock.Today;
        db.PelletListings.Add(l);
        await db.SaveChangesAsync();
        return Result.Ok(l, $"Pellet listing {Codes.PelletListing(l.ListingId)} ({Rules.Fmt(l.QuantityTons)} t {l.PelletType}, {l.Grade}) is now live for power plants.");
    });

    public Task<Result<PelletListing>> UpdatePelletListingAsync(long manufacturerId, long listingId, PelletListing changes) => Guard(async () =>
    {
        await using var db = Db.Create();
        var current = await db.PelletListings.FirstOrDefaultAsync(l => l.ListingId == listingId && l.ManufacturerId == manufacturerId);
        var guard = EditableGuard(current, listingId);
        if (guard != null) return Result.Blocked<PelletListing>(guard);

        var c = Normalise(changes);
        // pellet-management.js notPastIfChanged: an unchanged past date may stay.
        var dateRule = c.AvailableFrom != current!.AvailableFrom ? Rules.NotPast(c.AvailableFrom, "Available from") : null;
        var error = Validate(c, dateRule);
        if (error != null) return Result.Blocked<PelletListing>(error);

        bool changed = current.PelletType != c.PelletType || current.Grade != c.Grade || current.QuantityTons != c.QuantityTons ||
                       current.PricePerTon != c.PricePerTon || current.AvailableFrom != c.AvailableFrom ||
                       current.PickupLocation != c.PickupLocation || current.DiameterMm != c.DiameterMm ||
                       current.LengthMm != c.LengthMm || current.MoisturePct != c.MoisturePct ||
                       current.AshContentPct != c.AshContentPct || current.CalorificValue != c.CalorificValue ||
                       current.BulkDensity != c.BulkDensity || (current.Certification ?? "") != (c.Certification ?? "");
        if (!changed) return Result.Info($"No changes were made to {Codes.PelletListing(listingId)}.", current);

        current.PelletType = c.PelletType;
        current.Grade = c.Grade;
        current.QuantityTons = c.QuantityTons;
        current.PricePerTon = c.PricePerTon;
        current.AvailableFrom = c.AvailableFrom;
        current.PickupLocation = c.PickupLocation;
        current.DiameterMm = c.DiameterMm;
        current.LengthMm = c.LengthMm;
        current.MoisturePct = c.MoisturePct;
        current.AshContentPct = c.AshContentPct;
        current.CalorificValue = c.CalorificValue;
        current.BulkDensity = c.BulkDensity;
        current.Certification = c.Certification;
        await db.SaveChangesAsync();
        return Result.Ok(current, $"{Codes.PelletListing(listingId)} updated successfully.");
    });

    public Task<Result<PelletListing>> SetPelletListingStatusAsync(long manufacturerId, long listingId, bool active) => Guard(async () =>
    {
        await using var db = Db.Create();
        var l = await db.PelletListings.FirstOrDefaultAsync(x => x.ListingId == listingId && x.ManufacturerId == manufacturerId);
        var guard = EditableGuard(l, listingId);
        if (guard != null) return Result.Blocked<PelletListing>(guard);

        var next = active ? ListingStatus.Active : ListingStatus.Inactive;
        if (l!.Status == next) return Result.Info($"{Codes.PelletListing(listingId)} is already {next.Label()}", l);
        l.Status = next;
        await db.SaveChangesAsync();
        return Result.Ok(l, active
            ? $"{Codes.PelletListing(listingId)} is active again and visible to power plants."
            : $"{Codes.PelletListing(listingId)} is now inactive and hidden from the marketplace.");
    });

    public Task<Result<Unit>> DeletePelletListingAsync(long manufacturerId, long listingId) => Guard(async () =>
    {
        await using var db = Db.Create();
        var l = await db.PelletListings.FirstOrDefaultAsync(x => x.ListingId == listingId && x.ManufacturerId == manufacturerId);
        var guard = EditableGuard(l, listingId);
        if (guard != null) return Result.Blocked<Unit>(guard);
        db.PelletListings.Remove(l!);
        await db.SaveChangesAsync();
        return Result.Ok(Unit.Value, $"Listing {Codes.PelletListing(listingId)} removed.");
    });

    private static string? EditableGuard(PelletListing? l, long id) =>
        l is null ? "This listing no longer exists."
        : l.Status == ListingStatus.SoldOut ? $"{Codes.PelletListing(id)} has been bought by a power plant and can no longer be changed."
        : null;

    private static PelletListing Normalise(PelletListing x) => new()
    {
        PelletType = (x.PelletType ?? "").Trim(),
        Grade = (x.Grade ?? "").Trim(),
        QuantityTons = x.QuantityTons,
        PricePerTon = x.PricePerTon,
        DiameterMm = x.DiameterMm,
        LengthMm = x.LengthMm,
        MoisturePct = x.MoisturePct,
        AshContentPct = x.AshContentPct,
        CalorificValue = x.CalorificValue,
        BulkDensity = x.BulkDensity,
        PickupLocation = (x.PickupLocation ?? "").Trim(),
        AvailableFrom = x.AvailableFrom,
        Certification = Clean(x.Certification)
    };

    /// <summary>manufacturer/pellet-listing.html data-rules, including the Premium grade limits.</summary>
    private static string? Validate(PelletListing l, string? dateRule)
    {
        bool premium = l.Grade == "Premium";
        return Rules.First(
            Rules.Select(l.PelletType, "Pellet type", Catalog.PelletTypes),
            Rules.Select(l.Grade, "Grade", Catalog.Grades),
            Rules.Range(l.QuantityTons, "Quantity", 0, 10000, 2, exclusiveMin: true),
            Rules.Range(l.PricePerTon, "Price per ton", 1000, 50000, 2),
            dateRule,
            Rules.MaxDate(l.AvailableFrom, Clock.Today.AddDays(180), "Available from"),
            Rules.Text(l.PickupLocation, "Pickup location", 2, 100, required: true),
            Rules.Range(l.DiameterMm, "Diameter", 6, 12, 1),
            Rules.Range(l.LengthMm, "Length", 10, 50, 1),
            Rules.Range(l.MoisturePct, "Moisture", 0, 15, 2),
            premium && l.MoisturePct > 10 ? "Moisture must be at most 10 for Premium grade" : null,
            Rules.Range(l.AshContentPct, "Ash content", 0, 20, 2),
            premium && l.AshContentPct > 8 ? "Ash content must be at most 8 for Premium grade" : null,
            Rules.Range(l.CalorificValue, "Calorific value", 3000, 5500, 0),
            premium && l.CalorificValue < 4000 ? "Calorific value must be at least 4000 for Premium grade" : null,
            Rules.Range(l.BulkDensity, "Bulk density", 500, 800, 0),
            Rules.Text(l.Certification, "Certification", 2, 60));
    }

    // ------------------------------------------------------------------ Outbound pellet orders & ratings

    public async Task<Result<List<OrderView>>> GetOutboundOrdersAsync(long manufacturerId, OrderStatus? status = null)
    {
        await using var db = Db.Create();
        var q = PelletOrdersQuery(db).Where(o => o.ManufacturerId == manufacturerId);
        if (status.HasValue) q = q.Where(o => o.Status == status);
        var list = (await q.OrderByDescending(o => o.OrderDate).ThenByDescending(o => o.OrderId).ToListAsync()).Select(OrderView.From).ToList();
        var receivable = list.Where(o => o.Status == OrderStatus.Delivered && o.PaymentStatus == PaymentStatus.Pending).Sum(o => o.TotalAmount);
        return Result.Ok(list, $"{list.Count} pellet order(s) | receivable {Inr(receivable)}");
    }

    public async Task<Result<RatingSummary>> GetRatingsAsync(long manufacturerId)
    {
        await using var db = Db.Create();
        var rating = await db.ManufacturerRatings.AsNoTracking().FirstOrDefaultAsync(r => r.ManufacturerId == manufacturerId);
        var feedback = await db.PelletFeedback.AsNoTracking()
            .Include(f => f.Order).ThenInclude(o => o!.PowerPlant)
            .Include(f => f.Order).ThenInclude(o => o!.Listing)
            .Where(f => f.Order!.ManufacturerId == manufacturerId)
            .OrderByDescending(f => f.ReceivedDate).ToListAsync();
        return Result.Ok(new RatingSummary(rating?.Rating, rating?.Batches ?? 0, feedback),
            rating is null ? "New supplier: no batch feedback yet" : $"Rating {rating.Rating:0.0} from {rating.Batches} batch(es)");
    }
}
