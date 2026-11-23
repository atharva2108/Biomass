namespace BiomassConnect.Backend.Models.Entities;

/// <summary>Table <c>contact_messages</c>: landing-page contact form.</summary>
public class ContactMessage
{
    public long MessageId { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Mobile { get; set; }
    public string Role { get; set; } = "";
    public string Message { get; set; } = "";
    public DateTime SentAt { get; set; }
}
