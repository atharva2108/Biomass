using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.Session;

/// <summary>
/// In-memory logged-in user: the stand-in for JWT claims. Controllers read the
/// user id and role from here exactly as they will later read them from claims.
/// </summary>
public sealed class CurrentUser
{
    public long? UserId { get; private set; }
    public string? Name { get; private set; }
    public string? Email { get; private set; }
    public UserRole? Role { get; private set; }
    public UserStatus? Status { get; private set; }

    public bool IsAuthenticated => UserId.HasValue;

    public void SignIn(long userId, string name, string email, UserRole role, UserStatus status)
    {
        UserId = userId; Name = name; Email = email; Role = role; Status = status;
    }

    public void SignOut()
    {
        UserId = null; Name = null; Email = null; Role = null; Status = null;
    }

    /// <summary>Returns an error message unless a user with the given role is signed in (future: [Authorize(Roles = ...)]).</summary>
    public string? Require(UserRole role)
    {
        if (!IsAuthenticated) return "Please sign in first.";
        return Role == role ? null : $"This action needs a {RoleLabel(role)} account (signed in as {RoleLabel(Role!.Value)}).";
    }

    public static string RoleLabel(UserRole role) => role switch
    {
        UserRole.Farmer => "Farmer",
        UserRole.Manufacturer => "Manufacturer",
        UserRole.PowerPlant => "Power Plant",
        UserRole.Admin => "Admin",
        UserRole.Logistics => "Logistics",
        _ => role.ToString()
    };

    public override string ToString() =>
        IsAuthenticated ? $"{Name} <{Email}> ({RoleLabel(Role!.Value)}, {Status})" : "(not signed in)";
}
