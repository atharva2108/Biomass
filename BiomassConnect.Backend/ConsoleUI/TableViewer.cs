using System.Data.Common;
using System.Globalization;
using BiomassConnect.Backend.Data;
using Microsoft.EntityFrameworkCore;

namespace BiomassConnect.Backend.ConsoleUI;

/// <summary>[3] Show Database Tables: read-only SELECTs printed as aligned text.</summary>
public static class TableViewer
{
    private static readonly (string Title, string Sql)[] Views =
    [
        ("users", "SELECT user_id, name, email, mobile, role, status, registered_on, block_category FROM users ORDER BY user_id"),
        ("verification_documents", "SELECT document_id, user_id, doc_type, doc_number, doc_file, status, reviewed_by, reviewed_on, reason_category FROM verification_documents ORDER BY document_id"),
        ("biomass_listings", "SELECT listing_id, farmer_id, biomass_type, quantity_tons, price_per_ton, location, state, available_from, status FROM biomass_listings ORDER BY listing_id"),
        ("pellet_listings", "SELECT listing_id, manufacturer_id, pellet_type, grade, quantity_tons, price_per_ton, moisture_pct, ash_content_pct, calorific_value, status FROM pellet_listings ORDER BY listing_id"),
        ("purchase_orders", "SELECT order_id, listing_id, farmer_id, manufacturer_id, quantity_tons, total_amount, status, vehicle_no, dispatched_date, delivered_date, payment_status FROM purchase_orders ORDER BY order_id"),
        ("pellet_orders", "SELECT order_id, listing_id, manufacturer_id, powerplant_id, quantity_tons, total_amount, status, vehicle_no, delivered_date, payment_status FROM pellet_orders ORDER BY order_id"),
        ("pellet_feedback + manufacturer_ratings", "SELECT f.feedback_id, f.order_id, f.moisture_pct, f.ash_content_pct, f.calorific_value, f.score, r.manufacturer_id, r.rating, r.batches FROM pellet_feedback f JOIN pellet_orders o ON o.order_id = f.order_id LEFT JOIN manufacturer_ratings r ON r.manufacturer_id = o.manufacturer_id ORDER BY f.feedback_id"),
        ("consumption_logs", "SELECT entry_id, powerplant_id, entry_date, unit, pellets_tons, coal_tons, cofiring_ratio_pct, energy_mwh FROM consumption_logs ORDER BY entry_date DESC, entry_id"),
        ("complaints", "SELECT complaint_id, raised_by, against_user_id, purchase_order_id, pellet_order_id, category, status, resolved_on FROM complaints ORDER BY complaint_id"),
        ("certificates", "SELECT certificate_id, certificate_no, powerplant_id, issue_date, valid_until, issued_by FROM certificates ORDER BY certificate_id"),
        ("audit_logs (latest 20)", "SELECT log_id, user_id, module, action, to_char(logged_at, 'YYYY-MM-DD HH24:MI') AS logged_at FROM audit_logs ORDER BY log_id DESC LIMIT 20"),
        ("platform_settings", "SELECT * FROM platform_settings"),
        ("contact_messages", "SELECT message_id, name, email, role, left(message, 40) AS message, sent_at FROM contact_messages ORDER BY message_id")
    ];

    public static async Task ShowMenuAsync(DbFactory factory)
    {
        while (true)
        {
            Out.Banner("SHOW DATABASE TABLES (read-only)");
            for (int i = 0; i < Views.Length; i++) Console.WriteLine($"  [{i + 1,2}] {Views[i].Title}");
            Console.WriteLine("  [ A] All of the above");
            Console.WriteLine("  [ 0] Back");
            var pick = Prompt.Text("Choose").ToUpperInvariant();
            if (pick == "0" || pick == "") return;
            if (pick == "A") { foreach (var v in Views) await PrintAsync(factory, v.Title, v.Sql); }
            else if (int.TryParse(pick, out var n) && n >= 1 && n <= Views.Length) await PrintAsync(factory, Views[n - 1].Title, Views[n - 1].Sql);
            else continue;
            Prompt.Pause();
        }
    }

    /// <summary>Prints the named tables (used by the automated demo to show the data changing).</summary>
    public static async Task ShowAsync(DbFactory factory, params string[] titles)
    {
        foreach (var t in titles)
            foreach (var v in Views.Where(v => v.Title.StartsWith(t)))
                await PrintAsync(factory, v.Title, v.Sql);
    }

    private static async Task PrintAsync(DbFactory factory, string title, string sql)
    {
        Console.WriteLine();
        Console.WriteLine($"  -- {title} --");
        await using var db = factory.Create();
        var conn = db.Database.GetDbConnection();
        await conn.OpenAsync();
        await using DbCommand cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        await using var reader = await cmd.ExecuteReaderAsync();
        var headers = Enumerable.Range(0, reader.FieldCount).Select(reader.GetName).ToList();
        var rows = new List<string?[]>();
        while (await reader.ReadAsync())
            rows.Add(Enumerable.Range(0, reader.FieldCount).Select(i => Format(reader.IsDBNull(i) ? null : reader.GetValue(i))).ToArray());
        Out.Table(headers, rows);
    }

    private static string? Format(object? v) => v switch
    {
        null => "",
        Enum e => e.GetType().GetField(e.ToString())?.GetCustomAttributes(typeof(NpgsqlTypes.PgNameAttribute), false)
                    .Cast<NpgsqlTypes.PgNameAttribute>().FirstOrDefault()?.PgName ?? e.ToString(),   // database label
        // timestamptz comes back as UTC -> show local time; DATE comes back as a midnight DateTime -> date only
        DateTime dt when dt.Kind == DateTimeKind.Utc => dt.ToLocalTime().ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
        DateTime dt => dt.ToString(dt.TimeOfDay == TimeSpan.Zero ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
        DateOnly d => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        decimal m => m.ToString("0.##", CultureInfo.InvariantCulture),
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => v.ToString()
    };
}
