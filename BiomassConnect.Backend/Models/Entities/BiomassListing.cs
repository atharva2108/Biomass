using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.Models.Entities;

/// <summary>Table <c>biomass_listings</c>: crop residue listed by a farmer, bought whole by a manufacturer.</summary>
public class BiomassListing
{
    public long ListingId { get; set; }
    public long FarmerId { get; set; }
    public string BiomassType { get; set; } = "";
    public decimal QuantityTons { get; set; }
    public decimal PricePerTon { get; set; }
    public string Location { get; set; } = "";
    public string District { get; set; } = "";
    public string State { get; set; } = "";
    public DateOnly AvailableFrom { get; set; }
    public string? Description { get; set; }
    public ListingStatus Status { get; set; } = ListingStatus.Active;
    public DateOnly CreatedAt { get; set; }

    public User? Farmer { get; set; }
}
