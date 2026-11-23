using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Enums;
using BiomassConnect.Backend.Services.Interfaces;
using BiomassConnect.Backend.Session;

namespace BiomassConnect.Backend.Controllers;

/// <summary>Logistics portal (uses ILogisticsService). Only the Logistics role changes order status.</summary>
public class LogisticsController : ControllerBase
{
    private readonly ILogisticsService _svc;

    public LogisticsController(ILogisticsService svc, CurrentUser session) : base(session) => _svc = svc;

    // GET /api/logistics/shipments?status=&type=&q=
    public Task<Result<List<OrderView>>> GetShipments(OrderStatus? status = null, Codes.OrderKind? kind = null, string? keyword = null) =>
        As(UserRole.Logistics, _ => _svc.GetShipmentsAsync(status, kind, keyword));

    // POST /api/logistics/shipments/{orderId}/schedule
    public Task<Result<OrderView>> SchedulePickup(string orderCode, DateOnly pickupDate, DateOnly expectedDelivery,
        string vehicleNo, string driverName, string driverMobile) =>
        As(UserRole.Logistics, _ => WithOrder(orderCode, (kind, id) =>
            _svc.SchedulePickupAsync(kind, id, pickupDate, expectedDelivery, vehicleNo, driverName, driverMobile)));

    // PUT /api/logistics/shipments/{orderId}  (extra: dashboard.js "Edit shipment details")
    public Task<Result<OrderView>> UpdateShipmentDetails(string orderCode, DateOnly? pickupDate, DateOnly expectedDelivery,
        string vehicleNo, string driverName, string driverMobile) =>
        As(UserRole.Logistics, _ => WithOrder(orderCode, (kind, id) =>
            _svc.UpdateShipmentDetailsAsync(kind, id, pickupDate, expectedDelivery, vehicleNo, driverName, driverMobile)));

    // POST /api/logistics/shipments/{orderId}/dispatch
    public Task<Result<OrderView>> MarkDispatched(string orderCode) =>
        As(UserRole.Logistics, _ => WithOrder(orderCode, (kind, id) => _svc.MarkDispatchedAsync(kind, id)));

    // POST /api/logistics/shipments/{orderId}/deliver
    public Task<Result<OrderView>> MarkDelivered(string orderCode) =>
        As(UserRole.Logistics, _ => WithOrder(orderCode, (kind, id) => _svc.MarkDeliveredAsync(kind, id)));
}
