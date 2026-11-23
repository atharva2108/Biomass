namespace BiomassConnect.Backend.Models.Entities;

/// <summary>Table <c>powerplant_profiles</c> (PK = FK to users).</summary>
public class PowerPlantProfile
{
    public long UserId { get; set; }
    public string ContactPerson { get; set; } = "";
    public string? Designation { get; set; }
    public string Gstin { get; set; } = "";
    public decimal? CapacityMw { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string State { get; set; } = "";
    public string Pincode { get; set; } = "";
    public string? PhotoUrl { get; set; }
    public DateOnly? UpdatedAt { get; set; }

    public User? User { get; set; }
}
