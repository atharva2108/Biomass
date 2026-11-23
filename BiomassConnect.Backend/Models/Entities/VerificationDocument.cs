using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.Models.Entities;

/// <summary>Table <c>verification_documents</c>: the one KYC document uploaded at registration.</summary>
public class VerificationDocument
{
    public long DocumentId { get; set; }
    public long UserId { get; set; }
    public DocumentType DocType { get; set; }
    public string DocNumber { get; set; } = "";
    public string DocFile { get; set; } = "";
    public int? DocSizeKb { get; set; }
    public DateOnly SubmittedOn { get; set; }
    public VerificationStatus Status { get; set; } = VerificationStatus.Pending;
    public long? ReviewedBy { get; set; }
    public DateOnly? ReviewedOn { get; set; }
    public string? ReasonCategory { get; set; }
    public string? Reason { get; set; }

    public User? User { get; set; }
    public User? Reviewer { get; set; }
}
