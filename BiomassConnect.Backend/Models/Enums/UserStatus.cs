using NpgsqlTypes;

namespace BiomassConnect.Backend.Models.Enums;

/// <summary>PostgreSQL enum <c>user_status</c> (schema.sql).</summary>
public enum UserStatus
{
    [PgName("Pending")] Pending,
    [PgName("Active")] Active,
    [PgName("Blocked")] Blocked,
    [PgName("Rejected")] Rejected
}
