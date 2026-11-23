using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.Models.Entities;

/// <summary>Table <c>users</c>: every account (farmer, manufacturer, power plant, admin, logistics).</summary>
public class User
{
    public long UserId { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Mobile { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public UserRole Role { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Pending;
    public string SecurityQuestion { get; set; } = "";
    public string SecurityAnswerHash { get; set; } = "";
    public DateOnly RegisteredOn { get; set; }
    public UserStatus? PreviousStatus { get; set; }
    public string? BlockCategory { get; set; }
    public string? BlockReason { get; set; }
    public DateOnly? BlockedOn { get; set; }

    public FarmerProfile? FarmerProfile { get; set; }
    public ManufacturerProfile? ManufacturerProfile { get; set; }
    public PowerPlantProfile? PowerPlantProfile { get; set; }
    public VerificationDocument? VerificationDocument { get; set; }
}
