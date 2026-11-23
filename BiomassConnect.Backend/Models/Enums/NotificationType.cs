using NpgsqlTypes;

namespace BiomassConnect.Backend.Models.Enums;

/// <summary>PostgreSQL enum <c>notification_type</c> (schema.sql).</summary>
public enum NotificationType
{
    [PgName("order")] Order,
    [PgName("delivery")] Delivery,
    [PgName("payment")] Payment,
    [PgName("alert")] Alert
}
