using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.Services.Interfaces;

public interface ILogisticsService
{
    Task<Result<List<OrderView>>> GetShipmentsAsync(OrderStatus? status = null, Codes.OrderKind? kind = null, string? keyword = null);
    Task<Result<OrderView>> SchedulePickupAsync(Codes.OrderKind kind, long orderId, DateOnly pickupDate, DateOnly expectedDelivery,
        string vehicleNo, string driverName, string driverMobile);
    Task<Result<OrderView>> UpdateShipmentDetailsAsync(Codes.OrderKind kind, long orderId, DateOnly? pickupDate, DateOnly expectedDelivery,
        string vehicleNo, string driverName, string driverMobile);
    Task<Result<OrderView>> MarkDispatchedAsync(Codes.OrderKind kind, long orderId);
    Task<Result<OrderView>> MarkDeliveredAsync(Codes.OrderKind kind, long orderId);
}
