using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.Models.Entities;

/// <summary>Table <c>purchase_orders</c>: a manufacturer buys a whole biomass listing from a farmer.</summary>
public class PurchaseOrder : IShipmentOrder
{
    public long OrderId { get; set; }
    public long ListingId { get; set; }
    public long FarmerId { get; set; }
    public long ManufacturerId { get; set; }
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

    public BiomassListing? Listing { get; set; }
    public User? Farmer { get; set; }
    public User? Manufacturer { get; set; }
}
