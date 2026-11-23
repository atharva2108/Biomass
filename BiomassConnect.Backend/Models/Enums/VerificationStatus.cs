using NpgsqlTypes;

namespace BiomassConnect.Backend.Models.Enums;

/// <summary>PostgreSQL enum <c>verification_status</c> (schema.sql).</summary>
public enum VerificationStatus
{
    [PgName("Pending")] Pending,
    [PgName("Approved")] Approved,
    [PgName("Rejected")] Rejected
}
