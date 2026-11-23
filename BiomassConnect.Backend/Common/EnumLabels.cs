using System.Collections.Concurrent;
using System.Reflection;
using NpgsqlTypes;

namespace BiomassConnect.Backend.Common;

/// <summary>Shows enum values with their database labels ('Sold Out', 'Pickup Scheduled', ...).</summary>
public static class EnumLabels
{
    private static readonly ConcurrentDictionary<Enum, string> Cache = new();

    public static string Label(this Enum value) => Cache.GetOrAdd(value, v =>
    {
        var member = v.GetType().GetField(v.ToString());
        var pg = member?.GetCustomAttribute<PgNameAttribute>()?.PgName ?? v.ToString();
        // user_role labels are lower-case in the database; show them as the frontend does.
        return v is Models.Enums.UserRole r ? Session.CurrentUser.RoleLabel(r) : pg;
    });
}
