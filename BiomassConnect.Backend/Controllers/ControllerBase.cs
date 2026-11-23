using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models.Enums;
using BiomassConnect.Backend.Session;

namespace BiomassConnect.Backend.Controllers;

/// <summary>
/// Plain controller base: NO HTTP. Controllers only read the signed-in user (the stand-in for
/// JWT claims / [Authorize(Roles = ...)]), call exactly one service method and return its Result.
/// </summary>
public abstract class ControllerBase
{
    protected readonly CurrentUser Session;

    protected ControllerBase(CurrentUser session) => Session = session;

    /// <summary>Runs <paramref name="action"/> with the signed-in user's id if the role matches, else returns [BLOCKED].</summary>
    protected Task<Result<T>> As<T>(UserRole role, Func<long, Task<Result<T>>> action) =>
        Session.Require(role) is { } denied ? Task.FromResult(Result.Blocked<T>(denied)) : action(Session.UserId!.Value);

    /// <summary>Parses an order code (PO-B0001 / PP-0001) before calling the service.</summary>
    protected static Task<Result<T>> WithOrder<T>(string orderCode, Func<Codes.OrderKind, long, Task<Result<T>>> action) =>
        Codes.TryParseOrder(orderCode, out var kind, out var id)
            ? action(kind, id)
            : Task.FromResult(Result.Blocked<T>($"'{orderCode}' is not a valid order code (use PO-B0001 for biomass or PP-0001 for pellets)"));
}
