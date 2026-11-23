using System.Globalization;
using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Data;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace BiomassConnect.Backend.Services.Implementations;

/// <summary>Shared plumbing for the services: DbContext creation, database-error translation, common queries.</summary>
public abstract class ServiceBase
{
    protected readonly DbFactory Db;

    protected ServiceBase(DbFactory db) => Db = db;

    private static readonly CultureInfo India = CultureInfo.GetCultureInfo("en-IN");

    /// <summary>Rs. 1,00,000.00 (Indian digit grouping, as the frontend's Store.inr).</summary>
    protected static string Inr(decimal v) => "Rs. " + v.ToString("#,##,##0.##", India);

    /// <summary>
    /// Runs a service operation. The service rules are checked first, but schema.sql also has
    /// CHECK / UNIQUE / FK constraints; if the database rejects a change it is reported as
    /// [BLOCKED] instead of crashing the console.
    /// </summary>
    protected static async Task<Result<T>> Guard<T>(Func<Task<Result<T>>> operation)
    {
        try
        {
            return await operation();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pg)
        {
            return Result.Blocked<T>(DescribeDbError(pg));
        }
        catch (PostgresException pg)
        {
            return Result.Blocked<T>(DescribeDbError(pg));
        }
    }

    private static string DescribeDbError(PostgresException pg) => pg.SqlState switch
    {
        PostgresErrorCodes.UniqueViolation => $"Database rejected a duplicate value ({pg.ConstraintName}).",
        PostgresErrorCodes.CheckViolation => $"Database rule violated ({pg.ConstraintName}).",
        PostgresErrorCodes.ForeignKeyViolation => $"Database reference rule violated ({pg.ConstraintName}).",
        _ => $"Database error: {pg.MessageText}"
    };

    // ---------- Order queries with the names needed for display ----------

    protected static IQueryable<PurchaseOrder> PurchaseOrdersQuery(BiomassDbContext db) =>
        db.PurchaseOrders.AsNoTracking().Include(o => o.Listing).Include(o => o.Farmer).Include(o => o.Manufacturer);

    protected static IQueryable<PelletOrder> PelletOrdersQuery(BiomassDbContext db) =>
        db.PelletOrders.AsNoTracking().Include(o => o.Listing).Include(o => o.Manufacturer).Include(o => o.PowerPlant);

    protected static async Task<OrderView?> LoadOrderViewAsync(BiomassDbContext db, Codes.OrderKind kind, long orderId) =>
        kind == Codes.OrderKind.Biomass
            ? (await PurchaseOrdersQuery(db).FirstOrDefaultAsync(o => o.OrderId == orderId)) is { } po ? OrderView.From(po) : null
            : (await PelletOrdersQuery(db).FirstOrDefaultAsync(o => o.OrderId == orderId)) is { } pp ? OrderView.From(pp) : null;

    protected static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
}
