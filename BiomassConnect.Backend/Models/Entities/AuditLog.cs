namespace BiomassConnect.Backend.Models.Entities;

/// <summary>Table <c>audit_logs</c>: trail of admin actions.</summary>
public class AuditLog
{
    public long LogId { get; set; }
    public long UserId { get; set; }
    public string Action { get; set; } = "";
    public string Module { get; set; } = "";
    public DateTime LoggedAt { get; set; }

    public User? User { get; set; }
}
