using NpgsqlTypes;

namespace BiomassConnect.Backend.Models.Enums;

/// <summary>PostgreSQL enum <c>complaint_status</c> (schema.sql).</summary>
public enum ComplaintStatus
{
    [PgName("Open")] Open,
    [PgName("Resolved")] Resolved
}
