using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Data;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;
using BiomassConnect.Backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BiomassConnect.Backend.Services.Implementations;

/// <summary>
/// Logistics portal (js/logistics/dashboard.js). The logistics team is the only role that changes
/// an order after it is placed:
///   Placed --Schedule Pickup--> Pickup Scheduled --Mark Dispatched--> In Transit --Mark Delivered--> Delivered
/// No step can be skipped and no order goes back. Works on purchase_orders and pellet_orders alike.
/// </summary>
public class LogisticsService : ServiceBase, ILogisticsService
{
    public LogisticsService(DbFactory db) : base(db) { }

    public async Task<Result<List<OrderView>>> GetShipmentsAsync(OrderStatus? status = null, Codes.OrderKind? kind = null, string? keyword = null)
    {
        await using var db = Db.Create();
        var all = new List<OrderView>();
        if (kind is null or Codes.OrderKind.Biomass)
            all.AddRange((await PurchaseOrdersQuery(db).ToListAsync()).Select(OrderView.From));
        if (kind is null or Codes.OrderKind.Pellet)
            all.AddRange((await PelletOrdersQuery(db).ToListAsync()).Select(OrderView.From));

        var list = all
            .Where(o => status is null || o.Status == status)
            .Where(o => string.IsNullOrWhiteSpace(keyword) ||
                        $"{o.Code} {o.Seller} {o.Buyer} {o.Product} {o.VehicleNo} {o.DriverName}".Contains(keyword.Trim(), StringComparison.OrdinalIgnoreCase))
            .OrderBy(o => o.Status)                              // same order as the frontend: by step, then date
            .ThenBy(o => o.PickupDate ?? o.OrderDate)
            .ToList();
        var counts = Enum.GetValues<OrderStatus>().Select(s => $"{s.Label()}: {all.Count(o => o.Status == s)}");
        return Result.Ok(list, string.Join(" | ", counts));
    }

    public Task<Result<OrderView>> SchedulePickupAsync(Codes.OrderKind kind, long orderId, DateOnly pickupDate, DateOnly expectedDelivery,
        string vehicleNo, string driverName, string driverMobile) => Guard(async () =>
    {
        await using var db = Db.Create();
        var order = await FindAsync(db, kind, orderId);
        var code = CodeOf(kind, orderId);
        if (order is null) return Result.Blocked<OrderView>($"Order {code} no longer exists");
        if (order.Status != OrderStatus.Placed)
            return Result.Blocked<OrderView>($"Order {code} is already {order.Status.Label()}. Pickup can be scheduled only for Placed orders.");

        var error = ValidateDetails(pickupDate, checkPickup: true, expectedDelivery, vehicleNo, driverName, driverMobile);
        if (error != null) return Result.Blocked<OrderView>(error);

        Apply(order, pickupDate, expectedDelivery, vehicleNo, driverName, driverMobile);
        order.Status = OrderStatus.PickupScheduled;
        await db.SaveChangesAsync();
        var view = (await LoadOrderViewAsync(db, kind, orderId))!;
        return Result.Ok(view, $"{code}: Placed -> {view.Status.Label()} on {Rules.Fmt(pickupDate)} | Vehicle {view.VehicleNo} | Driver {view.DriverName} ({view.DriverMobile})");
    });

    /// <summary>Frontend "Edit shipment details" (Pickup Scheduled / In Transit). Once In Transit the pickup date is fixed.</summary>
    public Task<Result<OrderView>> UpdateShipmentDetailsAsync(Codes.OrderKind kind, long orderId, DateOnly? pickupDate, DateOnly expectedDelivery,
        string vehicleNo, string driverName, string driverMobile) => Guard(async () =>
    {
        await using var db = Db.Create();
        var order = await FindAsync(db, kind, orderId);
        var code = CodeOf(kind, orderId);
        if (order is null) return Result.Blocked<OrderView>($"Order {code} no longer exists");
        if (order.Status == OrderStatus.Delivered) return Result.Blocked<OrderView>($"Order {code} is already delivered");
        if (order.Status == OrderStatus.Placed) return Result.Blocked<OrderView>($"Order {code} has no shipment yet. Schedule the pickup first.");

        bool inTransit = order.Status == OrderStatus.InTransit;
        var pickup = inTransit || pickupDate is null ? order.PickupDate!.Value : pickupDate.Value;
        var error = ValidateDetails(pickup, checkPickup: !inTransit && pickupDate != null, expectedDelivery, vehicleNo, driverName, driverMobile);
        if (error != null) return Result.Blocked<OrderView>(error);

        Apply(order, pickup, expectedDelivery, vehicleNo, driverName, driverMobile);
        await db.SaveChangesAsync();
        return Result.Ok((await LoadOrderViewAsync(db, kind, orderId))!,
            $"Shipment details for {code} updated{(inTransit ? " (pickup date kept: the load has already left)" : "")}.");
    });

    public Task<Result<OrderView>> MarkDispatchedAsync(Codes.OrderKind kind, long orderId) => Guard(async () =>
    {
        await using var db = Db.Create();
        var order = await FindAsync(db, kind, orderId);
        var code = CodeOf(kind, orderId);
        if (order is null) return Result.Blocked<OrderView>($"Order {code} no longer exists");
        if (order.Status != OrderStatus.PickupScheduled)
            return Result.Blocked<OrderView>(order.Status == OrderStatus.Placed
                ? $"Order {code} is Placed: it cannot jump to In Transit before a pickup is scheduled (no skipping states)."
                : $"Order {code} is already {order.Status.Label()}: states cannot go back or repeat.");

        order.Status = OrderStatus.InTransit;
        order.DispatchedDate = Clock.Today;
        await db.SaveChangesAsync();
        var view = (await LoadOrderViewAsync(db, kind, orderId))!;
        return Result.Ok(view, $"{code}: Pickup Scheduled -> In Transit to {view.Buyer} (vehicle {view.VehicleNo}, dispatched {Rules.Fmt(Clock.Today)}).");
    });

    public Task<Result<OrderView>> MarkDeliveredAsync(Codes.OrderKind kind, long orderId) => Guard(async () =>
    {
        await using var db = Db.Create();
        var order = await FindAsync(db, kind, orderId);
        var code = CodeOf(kind, orderId);
        if (order is null) return Result.Blocked<OrderView>($"Order {code} no longer exists");
        if (order.Status != OrderStatus.InTransit)
            return Result.Blocked<OrderView>(order.Status == OrderStatus.Delivered
                ? $"Order {code} is already Delivered."
                : $"Order {code} is {order.Status.Label()}: it must be In Transit before it can be delivered (no skipping states).");

        order.Status = OrderStatus.Delivered;
        order.DeliveredDate = Clock.Today;
        await db.SaveChangesAsync();
        var view = (await LoadOrderViewAsync(db, kind, orderId))!;
        return Result.Ok(view, $"{code}: In Transit -> Delivered to {view.Buyer} on {Rules.Fmt(Clock.Today)}.");
    });

    // ------------------------------------------------------------------ helpers

    private static async Task<IShipmentOrder?> FindAsync(BiomassDbContext db, Codes.OrderKind kind, long id) =>
        kind == Codes.OrderKind.Biomass
            ? await db.PurchaseOrders.FirstOrDefaultAsync(o => o.OrderId == id)
            : await db.PelletOrders.FirstOrDefaultAsync(o => o.OrderId == id);

    private static string CodeOf(Codes.OrderKind kind, long id) =>
        kind == Codes.OrderKind.Biomass ? Codes.PurchaseOrder(id) : Codes.PelletOrder(id);

    /// <summary>logistics/dashboard.html data-rules.</summary>
    private static string? ValidateDetails(DateOnly pickupDate, bool checkPickup, DateOnly expectedDelivery,
        string vehicleNo, string driverName, string driverMobile)
    {
        var today = Clock.Today;
        return Rules.First(
            checkPickup ? Rules.NotPast(pickupDate, "Pickup date") : null,
            checkPickup ? Rules.MaxDate(pickupDate, today.AddDays(30), "Pickup date") : null,
            Rules.NotPast(expectedDelivery, "Expected delivery"),
            expectedDelivery < pickupDate ? "Expected delivery cannot be before pickup date" : null,
            Rules.MaxDate(expectedDelivery, today.AddDays(60), "Expected delivery"),
            Rules.Vehicle((vehicleNo ?? "").Trim()),
            Rules.Name((driverName ?? "").Trim(), "Driver name"),
            Rules.Mobile((driverMobile ?? "").Trim(), label: "Driver mobile"));
    }

    private static void Apply(IShipmentOrder o, DateOnly pickupDate, DateOnly expectedDelivery, string vehicleNo, string driverName, string driverMobile)
    {
        o.PickupDate = pickupDate;
        o.ExpectedDelivery = expectedDelivery;
        o.VehicleNo = vehicleNo.Trim().ToUpperInvariant();
        o.DriverName = driverName.Trim();
        o.DriverMobile = driverMobile.Trim();
    }
}
