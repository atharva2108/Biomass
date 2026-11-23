using NpgsqlTypes;

namespace BiomassConnect.Backend.Models.Enums;

/// <summary>PostgreSQL enum <c>user_role</c> (schema.sql).</summary>
public enum UserRole
{
    [PgName("farmer")] Farmer,
    [PgName("manufacturer")] Manufacturer,
    [PgName("powerplant")] PowerPlant,
    [PgName("admin")] Admin,
    [PgName("logistics")] Logistics
}
