using NpgsqlTypes;

namespace BiomassConnect.Backend.Models.Enums;

/// <summary>PostgreSQL enum <c>order_status</c> (schema.sql).</summary>
public enum OrderStatus
{
    [PgName("Placed")] Placed,
    [PgName("Pickup Scheduled")] PickupScheduled,
    [PgName("In Transit")] InTransit,
    [PgName("Delivered")] Delivered
}
