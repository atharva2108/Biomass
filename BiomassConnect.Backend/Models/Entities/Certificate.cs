namespace BiomassConnect.Backend.Models.Entities;

/// <summary>Table <c>certificates</c>: Government Norms Compliance Certificate issued by admin to a power plant.</summary>
public class Certificate
{
    public long CertificateId { get; set; }
    public string CertificateNo { get; set; } = "";
    public long PowerPlantId { get; set; }
    public string Title { get; set; } = "Government Norms Compliance Certificate";
    public DateOnly IssueDate { get; set; }
    public DateOnly ValidUntil { get; set; }
    public string? Remarks { get; set; }
    public long IssuedBy { get; set; }

    public User? PowerPlant { get; set; }
    public User? Issuer { get; set; }
}
