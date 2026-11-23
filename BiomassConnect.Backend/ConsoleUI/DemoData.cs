using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Data;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace BiomassConnect.Backend.ConsoleUI;

/// <summary>
/// Demo tooling (not business logic, so it uses the DbContext directly):
///  * Bootstrap: if the database has no admin / logistics account or no platform_settings row,
///    only that single row is added. Existing rows are used as they are. schema.sql is never touched.
///  * Cleanup: removes ONLY the @demo.local accounts and the rows that depend on them.
/// </summary>
public static class DemoData
{
    public const string DemoDomain = "@demo.local";

    // Same sign-in details as the frontend's built-in demo accounts (js/auth/users.js).
    public const string AdminEmail = "admin@gmail.com", AdminPassword = "Admin@123";
    public const string LogisticsEmail = "logistics@gmail.com", LogisticsPassword = "Logistics@123";

    public static async Task BootstrapAsync(DbFactory factory)
    {
        await using var db = factory.Create();

        if (!await db.PlatformSettings.AnyAsync(s => s.SettingsId == 1))
        {
            db.PlatformSettings.Add(new PlatformSettings());
            Out.Info("platform_settings row was missing: added the default row (settings_id = 1).");
        }

        await EnsureAccount(db, UserRole.Admin, "System Admin", AdminEmail, "9876543210", AdminPassword);
        await EnsureAccount(db, UserRole.Logistics, "Logistics Team", LogisticsEmail, "9876543214", LogisticsPassword);
        await db.SaveChangesAsync();
    }

    private static async Task EnsureAccount(BiomassDbContext db, UserRole role, string name, string email, string mobile, string password)
    {
        if (await db.Users.AnyAsync(u => u.Role == role)) return;
        if (await db.Users.AnyAsync(u => u.Email == email || u.Mobile == mobile))
        {
            Out.Info($"No {role} account exists and {email} / {mobile} is taken by another account; create a {role} account manually.");
            return;
        }
        db.Users.Add(new User
        {
            Name = name, Email = email, Mobile = mobile, Role = role, Status = UserStatus.Active,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            SecurityQuestion = "What is your birth city?",
            SecurityAnswerHash = BCrypt.Net.BCrypt.HashPassword("pune"),
            RegisteredOn = Clock.Today
        });
        Out.Info($"No {role} account was found: added {name} ({email} / {password}).");
    }

    /// <summary>Deletes every @demo.local account and the rows that reference it, in one transaction.</summary>
    public static async Task<int> CleanAsync(DbFactory factory, bool quiet = false)
    {
        await using var db = factory.Create();
        await using var tx = await db.Database.BeginTransactionAsync();
        const string demo = "(SELECT user_id FROM users WHERE email LIKE '%@demo.local')";
        const string po = "(SELECT order_id FROM purchase_orders WHERE farmer_id IN " + demo + " OR manufacturer_id IN " + demo + ")";
        const string pp = "(SELECT order_id FROM pellet_orders WHERE manufacturer_id IN " + demo + " OR powerplant_id IN " + demo + ")";

        var steps = new (string Table, string Sql)[]
        {
            ("audit_logs", $"DELETE FROM audit_logs WHERE user_id IN {demo} OR action LIKE '%@demo.local%'"),
            ("notifications", $"DELETE FROM notifications WHERE user_id IN {demo}"),
            ("complaints", $"DELETE FROM complaints WHERE raised_by IN {demo} OR against_user_id IN {demo} OR purchase_order_id IN {po} OR pellet_order_id IN {pp}"),
            ("pellet_feedback", $"DELETE FROM pellet_feedback WHERE order_id IN {pp}"),
            ("certificates", $"DELETE FROM certificates WHERE powerplant_id IN {demo} OR issued_by IN {demo}"),
            ("consumption_logs", $"DELETE FROM consumption_logs WHERE powerplant_id IN {demo}"),
            ("purchase_orders", $"DELETE FROM purchase_orders WHERE order_id IN {po}"),
            ("pellet_orders", $"DELETE FROM pellet_orders WHERE order_id IN {pp}"),
            ("biomass_listings", $"DELETE FROM biomass_listings WHERE farmer_id IN {demo}"),
            ("pellet_listings", $"DELETE FROM pellet_listings WHERE manufacturer_id IN {demo}"),
            ("verification_documents", $"DELETE FROM verification_documents WHERE user_id IN {demo}"),
            ("contact_messages", "DELETE FROM contact_messages WHERE email LIKE '%@demo.local'"),
            ("profiles + users", $"DELETE FROM users WHERE user_id IN {demo}")   // profiles go with ON DELETE CASCADE
        };

        int total = 0;
        foreach (var (table, sql) in steps)
        {
            int n = await db.Database.ExecuteSqlRawAsync(sql);
            total += n;
            if (n > 0 && !quiet) Out.Detail($"{table,-24} {n} row(s) removed");
        }
        await tx.CommitAsync();
        if (!quiet) Out.Ok(total == 0 ? "No demo data found: the database is already clean." : $"Removed {total} demo row(s). Only {DemoDomain} data was touched.");
        return total;
    }
}
