using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Data;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;
using BiomassConnect.Backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BiomassConnect.Backend.Services.Implementations;

/// <summary>Farmer portal rules (js/farmer/*.js).</summary>
public class FarmerService : ServiceBase, IFarmerService
{
    public FarmerService(DbFactory db) : base(db) { }

    // ------------------------------------------------------------------ Dashboard

    public async Task<Result<FarmerDashboard>> GetDashboardAsync(long farmerId)
    {
        await using var db = Db.Create();
        var active = await db.BiomassListings.Where(l => l.FarmerId == farmerId && l.Status == ListingStatus.Active)
            .Select(l => l.QuantityTons).ToListAsync();
        var orders = await db.PurchaseOrders.Where(o => o.FarmerId == farmerId)
            .Select(o => new { o.Status, o.TotalAmount, o.PaymentStatus }).ToListAsync();
        var delivered = orders.Where(o => o.Status == OrderStatus.Delivered).ToList();

        return Result.Ok(new FarmerDashboard(
            ActiveListings: active.Count,
            ActiveTonnage: active.Sum(),
            TotalOrders: orders.Count,
            DeliveredOrders: delivered.Count,
            Earnings: delivered.Sum(o => o.TotalAmount),
            PaidAmount: delivered.Where(o => o.PaymentStatus == PaymentStatus.Paid).Sum(o => o.TotalAmount),
            PendingReceivables: delivered.Where(o => o.PaymentStatus == PaymentStatus.Pending).Sum(o => o.TotalAmount)),
            "Dashboard KPIs loaded");
    }

    // ------------------------------------------------------------------ Listings

    public async Task<Result<List<BiomassListing>>> GetListingsAsync(long farmerId, ListingStatus? status = null)
    {
        await using var db = Db.Create();
        var q = db.BiomassListings.AsNoTracking().Where(l => l.FarmerId == farmerId);
        if (status.HasValue) q = q.Where(l => l.Status == status);
        var list = await q.OrderByDescending(l => l.ListingId).ToListAsync();
        return Result.Ok(list, $"{list.Count} listing(s)");
    }

    public Task<Result<BiomassListing>> CreateListingAsync(long farmerId, BiomassListing input, bool confirmDuplicate = false) => Guard(async () =>
    {
        var l = Normalise(input);
        var error = Validate(l, minAvailableFrom: Clock.Today);
        if (error != null) return Result.Blocked<BiomassListing>(error);

        await using var db = Db.Create();

        // Frontend: an Active listing of the SAME type at the SAME pickup point asks "Create anyway?".
        var duplicate = await db.BiomassListings.AsNoTracking().FirstOrDefaultAsync(x =>
            x.FarmerId == farmerId && x.Status == ListingStatus.Active &&
            x.BiomassType == l.BiomassType && x.Location.ToLower() == l.Location.ToLower());
        if (duplicate != null && !confirmDuplicate)
            return Result.Blocked<BiomassListing>(
                $"You already have an active {l.BiomassType} listing at {duplicate.Location} ({Codes.BiomassListing(duplicate.ListingId)}). " +
                "Update that listing, or confirm to create another one anyway.");

        l.FarmerId = farmerId;
        l.Status = ListingStatus.Active;
        l.CreatedAt = Clock.Today;
        db.BiomassListings.Add(l);
        await db.SaveChangesAsync();

        return Result.Ok(l, $"Listing {Codes.BiomassListing(l.ListingId)} created: {Rules.Fmt(l.QuantityTons)} t of {l.BiomassType} at {Inr(l.PricePerTon)}/t is now live.");
    });

    public Task<Result<BiomassListing>> UpdateListingAsync(long farmerId, long listingId, BiomassListing changes) => Guard(async () =>
    {
        await using var db = Db.Create();
        var current = await db.BiomassListings.FirstOrDefaultAsync(l => l.ListingId == listingId && l.FarmerId == farmerId);
        var guard = EditableGuard(current, listingId);
        if (guard != null) return Result.Blocked<BiomassListing>(guard);

        var c = Normalise(changes);
        // The available-from date may stay where it is, but can't be moved further into the past.
        var minDate = current!.AvailableFrom < Clock.Today ? current.AvailableFrom : Clock.Today;
        var error = Validate(c, minDate);
        if (error != null) return Result.Blocked<BiomassListing>(error);

        bool changed = current.BiomassType != c.BiomassType || current.QuantityTons != c.QuantityTons ||
                       current.PricePerTon != c.PricePerTon || current.AvailableFrom != c.AvailableFrom ||
                       current.Location != c.Location || current.District != c.District ||
                       current.State != c.State || (current.Description ?? "") != (c.Description ?? "");
        if (!changed) return Result.Info("No changes to save", current);

        current.BiomassType = c.BiomassType;
        current.QuantityTons = c.QuantityTons;
        current.PricePerTon = c.PricePerTon;
        current.AvailableFrom = c.AvailableFrom;
        current.Location = c.Location;
        current.District = c.District;
        current.State = c.State;
        current.Description = c.Description;
        await db.SaveChangesAsync();
        return Result.Ok(current, $"Listing {Codes.BiomassListing(listingId)} updated successfully");
    });

    public Task<Result<BiomassListing>> SetListingStatusAsync(long farmerId, long listingId, bool active) => Guard(async () =>
    {
        await using var db = Db.Create();
        var l = await db.BiomassListings.FirstOrDefaultAsync(x => x.ListingId == listingId && x.FarmerId == farmerId);
        var guard = EditableGuard(l, listingId);
        if (guard != null) return Result.Blocked<BiomassListing>(guard);

        var next = active ? ListingStatus.Active : ListingStatus.Inactive;
        if (l!.Status == next) return Result.Info($"Listing {Codes.BiomassListing(listingId)} is already {next.Label()}", l);
        if (active && l.QuantityTons <= 0) return Result.Blocked<BiomassListing>("Add quantity before activating this listing");

        l.Status = next;
        await db.SaveChangesAsync();
        return Result.Ok(l, active
            ? $"Listing {Codes.BiomassListing(listingId)} is now active and visible to buyers"
            : $"Listing {Codes.BiomassListing(listingId)} deactivated and hidden from buyers");
    });

    public Task<Result<Unit>> DeleteListingAsync(long farmerId, long listingId) => Guard(async () =>
    {
        await using var db = Db.Create();
        var l = await db.BiomassListings.FirstOrDefaultAsync(x => x.ListingId == listingId && x.FarmerId == farmerId);
        var guard = EditableGuard(l, listingId);
        if (guard != null) return Result.Blocked<Unit>(guard);

        db.BiomassListings.Remove(l!);
        await db.SaveChangesAsync();
        return Result.Ok(Unit.Value, $"Listing {Codes.BiomassListing(listingId)} deleted");
    });

    /// <summary>Sold Out listings are permanently locked: no edit, status change or delete.</summary>
    private static string? EditableGuard(BiomassListing? l, long listingId) =>
        l is null ? $"Listing {Codes.BiomassListing(listingId)} no longer exists"
        : l.Status == ListingStatus.SoldOut ? $"Listing {Codes.BiomassListing(listingId)} is Sold Out and permanently locked."
        : null;

    private static BiomassListing Normalise(BiomassListing x) => new()
    {
        BiomassType = (x.BiomassType ?? "").Trim(),
        QuantityTons = x.QuantityTons,
        PricePerTon = x.PricePerTon,
        Location = (x.Location ?? "").Trim(),
        District = (x.District ?? "").Trim(),
        State = (x.State ?? "").Trim(),
        AvailableFrom = x.AvailableFrom,
        Description = Clean(x.Description)
    };

    // farmer/create-listing.html + manage-listings.html data-rules
    private static string? Validate(BiomassListing l, DateOnly minAvailableFrom) => Rules.First(
        Rules.Select(l.BiomassType, "Biomass type", Catalog.BiomassTypes),
        l.AvailableFrom < minAvailableFrom
            ? (minAvailableFrom == Clock.Today ? "Available from cannot be in the past" : $"Available from cannot be before {Rules.Fmt(minAvailableFrom)}")
            : null,
        Rules.MaxDate(l.AvailableFrom, Clock.Today.AddDays(180), "Available from"),
        Rules.Range(l.QuantityTons, "Quantity", 0, 10000, 2, exclusiveMin: true),
        Rules.Range(l.PricePerTon, "Price per ton", 100, 100000, 2),
        Rules.Text(l.Location, "Pickup location", 2, 100, required: true),
        Rules.Alpha(l.District, "District", 2, 50),
        Rules.Select(l.State, "State", Catalog.IndianStates),
        Rules.Text(l.Description, "Description", 0, 500));

    // ------------------------------------------------------------------ Orders, tracking, payments

    public async Task<Result<List<OrderView>>> GetOrdersAsync(long farmerId, DateOnly? from = null, DateOnly? to = null, string? keyword = null)
    {
        if (from.HasValue && to.HasValue && to < from) return Result.Blocked<List<OrderView>>("To date cannot be before from date");
        await using var db = Db.Create();
        var q = PurchaseOrdersQuery(db).Where(o => o.FarmerId == farmerId);
        if (from.HasValue) q = q.Where(o => o.OrderDate >= from);
        if (to.HasValue) q = q.Where(o => o.OrderDate <= to);
        var list = (await q.OrderByDescending(o => o.OrderDate).ThenByDescending(o => o.OrderId).ToListAsync())
            .Select(OrderView.From).ToList();

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var k = keyword.Trim().ToLowerInvariant();
            list = list.Where(o => $"{o.Code} {o.Buyer} {o.Product}".ToLowerInvariant().Contains(k)).ToList();
        }
        return Result.Ok(list, $"{list.Count} order(s)");
    }

    public async Task<Result<OrderView>> GetOrderTrackingAsync(long farmerId, long orderId)
    {
        await using var db = Db.Create();
        var o = await PurchaseOrdersQuery(db).FirstOrDefaultAsync(x => x.OrderId == orderId && x.FarmerId == farmerId);
        return o is null
            ? Result.Blocked<OrderView>($"Order {Codes.PurchaseOrder(orderId)} was not found among your orders")
            : Result.Ok(OrderView.From(o), $"{Codes.PurchaseOrder(orderId)} is {o.Status.Label()}");
    }

    public async Task<Result<PaymentsView>> GetPaymentsAsync(long farmerId)
    {
        await using var db = Db.Create();
        var delivered = (await PurchaseOrdersQuery(db)
                .Where(o => o.FarmerId == farmerId && o.Status == OrderStatus.Delivered)
                .OrderByDescending(o => o.DeliveredDate).ToListAsync())
            .Select(OrderView.From).ToList();
        var paid = delivered.Where(o => o.PaymentStatus == PaymentStatus.Paid).Sum(o => o.TotalAmount);
        var pending = delivered.Where(o => o.PaymentStatus == PaymentStatus.Pending).Sum(o => o.TotalAmount);
        return Result.Ok(new PaymentsView(delivered, paid, pending), $"Paid {Inr(paid)} | Pending {Inr(pending)}");
    }

    // ------------------------------------------------------------------ Profile

    public async Task<Result<FarmerProfile>> GetProfileAsync(long farmerId)
    {
        await using var db = Db.Create();
        var p = await db.FarmerProfiles.AsNoTracking().Include(x => x.User).FirstOrDefaultAsync(x => x.UserId == farmerId);
        return p is null ? Result.Blocked<FarmerProfile>("Farmer profile not found") : Result.Ok(p);
    }

    public Task<Result<FarmerProfile>> UpdateProfileAsync(long farmerId, string name, string email, string mobile, FarmerProfile c) => Guard(async () =>
    {
        name = (name ?? "").Trim();
        email = (email ?? "").Trim().ToLowerInvariant();
        mobile = (mobile ?? "").Trim();
        var ifsc = (c.Ifsc ?? "").Trim().ToUpperInvariant();
        var pan = Clean(c.Pan)?.ToUpperInvariant();
        var today = Clock.Today;

        // farmer/profile.html data-rules
        var error = Rules.First(
            Rules.Name(name, "Full name"),
            c.Dob is null ? "Date of birth is required"
                : c.Dob > today.AddYears(-18) ? "You must be at least 18 years old"
                : c.Dob < today.AddDays(-36525) ? "Date of birth cannot be more than 100 years ago" : null,
            Rules.Select(c.Gender, "Gender", Catalog.Genders),
            Rules.Mobile(mobile),
            Rules.Email(email),
            Rules.Text(c.Address, "Address", 10, 200, required: true),
            Rules.Alpha(c.Village, "Village", 2, 60),
            Rules.Alpha(c.District, "District", 2, 50),
            Rules.Select(c.State, "State", Catalog.IndianStates),
            Rules.Pincode(c.Pincode),
            c.FarmAreaAcres is null ? "Farm area is required" : Rules.Range(c.FarmAreaAcres.Value, "Farm area", 0, 1000, 2, exclusiveMin: true),
            Rules.Text(c.PrimaryCrops, "Primary crops", 0, 100),
            Rules.Name(c.AccountHolder, "Account holder name"),
            Rules.Text(c.BankName, "Bank name", 3, 100, required: true),
            Rules.Account(c.AccountNo),
            Rules.Ifsc(ifsc),
            Rules.Upi(c.UpiId),
            Rules.Pan(pan));
        if (error != null) return Result.Blocked<FarmerProfile>(error);

        await using var db = Db.Create();
        var p = await db.FarmerProfiles.Include(x => x.User).FirstOrDefaultAsync(x => x.UserId == farmerId);
        if (p is null) return Result.Blocked<FarmerProfile>("Farmer profile not found");
        if (await db.Users.AnyAsync(u => u.Email == email && u.UserId != farmerId)) return Result.Blocked<FarmerProfile>("An account with this email already exists");
        if (await db.Users.AnyAsync(u => u.Mobile == mobile && u.UserId != farmerId)) return Result.Blocked<FarmerProfile>("An account with this mobile number already exists");

        p.User!.Name = name;
        p.User.Email = email;
        p.User.Mobile = mobile;
        p.Dob = c.Dob;
        p.Gender = c.Gender;
        p.Address = c.Address!.Trim();
        p.Village = c.Village!.Trim();
        p.District = c.District!.Trim();
        p.State = c.State;
        p.Pincode = c.Pincode.Trim();
        p.FarmAreaAcres = c.FarmAreaAcres;
        p.PrimaryCrops = Clean(c.PrimaryCrops);
        p.AccountHolder = c.AccountHolder!.Trim();
        p.BankName = c.BankName!.Trim();
        p.AccountNo = c.AccountNo!.Trim();
        p.Ifsc = ifsc;
        p.UpiId = Clean(c.UpiId);
        p.Pan = pan;
        p.PhotoUrl = Clean(c.PhotoUrl) ?? p.PhotoUrl;
        p.UpdatedAt = today;                       // aadhaar_last4 is never changed here
        await db.SaveChangesAsync();
        return Result.Ok(p, "Profile updated successfully");
    });
}
