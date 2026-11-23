using System.Text.RegularExpressions;

namespace BiomassConnect.Backend.Common;

/// <summary>
/// Display codes for database ids, in the same style as the frontend
/// (BL-, PL-, PO-B, PP-, CMP-). The database keeps plain BIGINT ids.
/// </summary>
public static class Codes
{
    public static string BiomassListing(long id) => $"BL-{id:0000}";
    public static string PelletListing(long id) => $"PL-{id:0000}";
    public static string PurchaseOrder(long id) => $"PO-B{id:0000}";
    public static string PelletOrder(long id) => $"PP-{id:0000}";
    public static string Complaint(long id) => $"CMP-{id:0000}";
    public static string User(long id) => $"U-{id:0000}";
    public static string Verification(long id) => $"VER-{id:0000}";

    /// <summary>Order kind behind an order code.</summary>
    public enum OrderKind { Biomass, Pellet }

    private static readonly Regex OrderCode = new(@"^(PO-B|PP-)(\d+)$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>Parses "PO-B0001" (biomass purchase order) or "PP-0001" (pellet order).</summary>
    public static bool TryParseOrder(string? code, out OrderKind kind, out long id)
    {
        kind = OrderKind.Biomass; id = 0;
        var m = OrderCode.Match((code ?? "").Trim());
        if (!m.Success || !long.TryParse(m.Groups[2].Value, out id)) return false;
        kind = m.Groups[1].Value.Equals("PP-", StringComparison.OrdinalIgnoreCase) ? OrderKind.Pellet : OrderKind.Biomass;
        return true;
    }

    /// <summary>Accepts "BL-0003", "PL-12" or just "3".</summary>
    public static bool TryParseId(string? code, out long id)
    {
        var digits = Regex.Match((code ?? "").Trim(), @"(\d+)$");
        id = 0;
        return digits.Success && long.TryParse(digits.Value, out id);
    }
}
