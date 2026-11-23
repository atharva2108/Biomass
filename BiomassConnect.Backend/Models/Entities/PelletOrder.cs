using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.Models.Entities;

/// <summary>Table <c>pellet_orders</c>: a power plant buys a whole pellet listing from a manufacturer.</summary>
public class PelletOrder : IShipmentOrder
{
    public long OrderId { get; set; }
    public long ListingId { get; set; }
    public long ManufacturerId { get; set; }
    public long PowerPlantId { get; set; }
    public decimal QuantityTons { get; set; }
    public decimal PricePerTon { get; set; }
    /// <summary>GENERATED ALWAYS AS (quantity_tons * price_per_ton) STORED. Read-only: never written by the backend.</summary>
    public decimal TotalAmount { get; private set; }
    public DateOnly OrderDate { get; set; }
    public string PickupAddress { get; set; } = "";
    public string DeliveryAddress { get; set; } = "";
    public string? Notes { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Placed;
    public DateOnly? PickupDate { get; set; }
    public DateOnly? ExpectedDelivery { get; set; }
    public string? VehicleNo { get; set; }
    public string? DriverName { get; set; }
    public string? DriverMobile { get; set; }
    public DateOnly? DispatchedDate { get; set; }
    public DateOnly? DeliveredDate { get; set; }
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;
    public DateOnly? PaidOn { get; set; }

    public PelletListing? Listing { get; set; }
    public User? Manufacturer { get; set; }
    public User? PowerPlant { get; set; }
    public PelletFeedback? Feedback { get; set; }
}
