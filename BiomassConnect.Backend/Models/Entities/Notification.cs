using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.Models.Entities;

/// <summary>Table <c>notifications</c>.</summary>
public class Notification
{
    public long NotificationId { get; set; }
    public long UserId { get; set; }
    public NotificationType Type { get; set; }
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public string? Link { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }

    public User? User { get; set; }
}
