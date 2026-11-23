using NpgsqlTypes;

namespace BiomassConnect.Backend.Models.Enums;

/// <summary>PostgreSQL enum <c>listing_status</c> (schema.sql).</summary>
public enum ListingStatus
{
    [PgName("Active")] Active,
    [PgName("Inactive")] Inactive,
    [PgName("Sold Out")] SoldOut
}
