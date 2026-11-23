namespace BiomassConnect.Backend.Models.Entities;

/// <summary>Table <c>farmer_profiles</c> (PK = FK to users).</summary>
public class FarmerProfile
{
    public long UserId { get; set; }
    public DateOnly? Dob { get; set; }
    public string? Gender { get; set; }
    public string? Address { get; set; }
    public string? Village { get; set; }
    public string? District { get; set; }
    public string State { get; set; } = "";
    public string Pincode { get; set; } = "";
    public decimal? FarmAreaAcres { get; set; }
    public string? PrimaryCrops { get; set; }
    public string? AccountHolder { get; set; }
    public string? BankName { get; set; }
    public string? AccountNo { get; set; }
    public string? Ifsc { get; set; }
    public string? UpiId { get; set; }
    public string AadhaarLast4 { get; set; } = "";
    public string? Pan { get; set; }
    public string? PhotoUrl { get; set; }
    public DateOnly? UpdatedAt { get; set; }

    public User? User { get; set; }
}
