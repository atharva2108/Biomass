namespace BiomassConnect.Backend.Models.Entities;

/// <summary>View <c>manufacturer_ratings</c>: average batch score per manufacturer (keyless, read-only).</summary>
public class ManufacturerRating
{
    public long ManufacturerId { get; set; }
    public decimal Rating { get; set; }
    public long Batches { get; set; }
}
