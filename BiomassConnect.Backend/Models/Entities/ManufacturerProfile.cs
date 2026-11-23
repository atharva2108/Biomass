namespace BiomassConnect.Backend.Models.Entities;

/// <summary>Table <c>manufacturer_profiles</c> (PK = FK to users).</summary>
public class ManufacturerProfile
{
    public long UserId { get; set; }
    public string ContactPerson { get; set; } = "";
    public string Gstin { get; set; } = "";
    public string? Address { get; set; }
    public string? City { get; set; }
    public string State { get; set; } = "";
    public string Pincode { get; set; } = "";
    public decimal? CapacityTonsPerDay { get; set; }
    public string? PhotoUrl { get; set; }
    public DateOnly? UpdatedAt { get; set; }

    public User? User { get; set; }
}
