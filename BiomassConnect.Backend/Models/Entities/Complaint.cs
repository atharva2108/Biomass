using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.Models.Entities;

/// <summary>Table <c>complaints</c>: raised on exactly one order (biomass XOR pellet) by its buyer or seller.</summary>
public class Complaint
{
    public long ComplaintId { get; set; }
    public long RaisedBy { get; set; }
    public long AgainstUserId { get; set; }
    public long? PurchaseOrderId { get; set; }
    public long? PelletOrderId { get; set; }
    public string Category { get; set; } = "";
    public string Description { get; set; } = "";
    public ComplaintStatus Status { get; set; } = ComplaintStatus.Open;
    public DateOnly RaisedOn { get; set; }
    public string? Resolution { get; set; }
    public DateOnly? ResolvedOn { get; set; }

    public User? RaisedByUser { get; set; }
    public User? AgainstUser { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }
    public PelletOrder? PelletOrder { get; set; }
}
