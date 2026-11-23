using NpgsqlTypes;

namespace BiomassConnect.Backend.Models.Enums;

/// <summary>PostgreSQL enum <c>document_type</c> (schema.sql).</summary>
public enum DocumentType
{
    [PgName("Aadhaar Card")] AadhaarCard,
    [PgName("GST Certificate")] GstCertificate
}
