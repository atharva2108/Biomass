using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.Models;

// Read-only shapes returned by services for screens that combine several tables.
// They are plain records (not request/response DTOs, which are deferred to the API phase).

public record LoginResult(long UserId, string Name, string Email, UserRole Role, UserStatus Status);

/// <summary>One biomass or pellet order seen from any portal (logistics, admin, tracking, complaints).</summary>
public record OrderView(
    Codes.OrderKind Kind, long OrderId, string Code,
    long SellerId, string Seller, long BuyerId, string Buyer, string Product,
    decimal QuantityTons, decimal PricePerTon, decimal TotalAmount,
    DateOnly OrderDate, string PickupAddress, string DeliveryAddress, string? Notes,
    OrderStatus Status, DateOnly? PickupDate, DateOnly? ExpectedDelivery,
    string? VehicleNo, string? DriverName, string? DriverMobile,
    DateOnly? DispatchedDate, DateOnly? DeliveredDate,
    PaymentStatus PaymentStatus, DateOnly? PaidOn)
{
    public static OrderView From(PurchaseOrder o) => new(
        Codes.OrderKind.Biomass, o.OrderId, Codes.PurchaseOrder(o.OrderId),
        o.FarmerId, o.Farmer?.Name ?? "", o.ManufacturerId, o.Manufacturer?.Name ?? "", o.Listing?.BiomassType ?? "",
        o.QuantityTons, o.PricePerTon, o.TotalAmount, o.OrderDate, o.PickupAddress, o.DeliveryAddress, o.Notes,
        o.Status, o.PickupDate, o.ExpectedDelivery, o.VehicleNo, o.DriverName, o.DriverMobile,
        o.DispatchedDate, o.DeliveredDate, o.PaymentStatus, o.PaidOn);

    public static OrderView From(PelletOrder o) => new(
        Codes.OrderKind.Pellet, o.OrderId, Codes.PelletOrder(o.OrderId),
        o.ManufacturerId, o.Manufacturer?.Name ?? "", o.PowerPlantId, o.PowerPlant?.Name ?? "",
        o.Listing is null ? "" : $"{o.Listing.PelletType} ({o.Listing.Grade})",
        o.QuantityTons, o.PricePerTon, o.TotalAmount, o.OrderDate, o.PickupAddress, o.DeliveryAddress, o.Notes,
        o.Status, o.PickupDate, o.ExpectedDelivery, o.VehicleNo, o.DriverName, o.DriverMobile,
        o.DispatchedDate, o.DeliveredDate, o.PaymentStatus, o.PaidOn);
}

public record FarmerDashboard(int ActiveListings, decimal ActiveTonnage, int TotalOrders, int DeliveredOrders,
    decimal Earnings, decimal PaidAmount, decimal PendingReceivables);

public record PaymentsView(List<OrderView> Orders, decimal Paid, decimal Pending);

public record PelletMarketItem(PelletListing Listing, string Manufacturer, decimal? Rating, long Batches);

public record RatingSummary(decimal? Rating, long Batches, List<PelletFeedback> Feedback);

public record FeedbackResult(PelletFeedback Feedback, string OrderCode, decimal Score, decimal? ManufacturerRating);

public record CarbonMonth(string Month, decimal Pellets, decimal RatioPct, decimal Co2, decimal Coal, decimal Stubble, decimal GreenEnergyMwh);

public record CarbonReport(DateOnly From, DateOnly To, int Entries, decimal PelletsTons, decimal CoalTons,
    decimal EnergyMwh, decimal GreenEnergyMwh, decimal RatioPct,
    decimal Co2AvoidedTons, decimal CoalDisplacedTons, decimal StubbleSavedTons, long TreeEquivalent,
    List<CarbonMonth> Months);

public record CertificateView(Certificate Certificate, string Status);

public record AdminDashboard(int TotalUsers, int ActiveUsers, int Farmers, int Manufacturers, int PowerPlants,
    int PendingVerifications, int ActiveOrders, int OpenDisputes, decimal Gmv);

public record MonthlyTrend(string Month, decimal BiomassTons, decimal PelletTons, int Deliveries);

public record AdminReport(decimal DeliveredBiomassTons, decimal DeliveredPelletTons, decimal PaidValue, decimal PendingValue,
    Dictionary<OrderStatus, int> StatusCounts, List<MonthlyTrend> Months);

public record DisputeView(Complaint Complaint, string OrderCode, string RaisedBy, string Against);

public record AuditPage(int Total, int Page, int PageSize, List<AuditLog> Items);

public record NotificationList(int Unread, List<Notification> Items);
