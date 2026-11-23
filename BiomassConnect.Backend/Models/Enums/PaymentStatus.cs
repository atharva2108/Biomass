using NpgsqlTypes;

namespace BiomassConnect.Backend.Models.Enums;

/// <summary>PostgreSQL enum <c>payment_status</c> (schema.sql).</summary>
public enum PaymentStatus
{
    [PgName("Pending")] Pending,
    [PgName("Paid")] Paid
}
