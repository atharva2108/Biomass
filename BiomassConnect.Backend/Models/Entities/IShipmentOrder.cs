using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.Models.Entities;

/// <summary>
/// Logistics and payment columns shared by purchase_orders and pellet_orders
/// (the two tables have the same lifecycle), so one set of rules serves both.
/// </summary>
public interface IShipmentOrder
{
    long OrderId { get; }
    decimal QuantityTons { get; }
    decimal TotalAmount { get; }
    OrderStatus Status { get; set; }
    DateOnly? PickupDate { get; set; }
    DateOnly? ExpectedDelivery { get; set; }
    string? VehicleNo { get; set; }
    string? DriverName { get; set; }
    string? DriverMobile { get; set; }
    DateOnly? DispatchedDate { get; set; }
    DateOnly? DeliveredDate { get; set; }
    PaymentStatus PaymentStatus { get; set; }
    DateOnly? PaidOn { get; set; }
}
