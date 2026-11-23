namespace BiomassConnect.Backend.Models.Entities;

/// <summary>Table <c>pellet_feedback</c>: batch measurements a power plant enters after delivery (one per order).</summary>
public class PelletFeedback
{
    public long FeedbackId { get; set; }
    public long OrderId { get; set; }
    public DateOnly ReceivedDate { get; set; }
    public decimal QuantityReceived { get; set; }
    public decimal MoisturePct { get; set; }
    public decimal AshContentPct { get; set; }
    public int CalorificValue { get; set; }
    public decimal Score { get; set; }
    public string? Remarks { get; set; }

    public PelletOrder? Order { get; set; }
}
