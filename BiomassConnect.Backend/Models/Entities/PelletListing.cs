using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.Models.Entities;

/// <summary>Table <c>pellet_listings</c>: pellets listed by a manufacturer, bought whole by a power plant.</summary>
public class PelletListing
{
    public long ListingId { get; set; }
    public long ManufacturerId { get; set; }
    public string PelletType { get; set; } = "";
    public string Grade { get; set; } = "";
    public decimal QuantityTons { get; set; }
    public decimal PricePerTon { get; set; }
    public decimal DiameterMm { get; set; }
    public decimal LengthMm { get; set; }
    public decimal MoisturePct { get; set; }
    public decimal AshContentPct { get; set; }
    public int CalorificValue { get; set; }
    public int BulkDensity { get; set; }
    public string PickupLocation { get; set; } = "";
    public DateOnly AvailableFrom { get; set; }
    public string? Certification { get; set; }
    public ListingStatus Status { get; set; } = ListingStatus.Active;
    public DateOnly CreatedAt { get; set; }

    public User? Manufacturer { get; set; }
}
