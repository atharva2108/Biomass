using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;

namespace BiomassConnect.Backend.Services.Interfaces;

public interface ICommonService
{
    Task<Result<Complaint>> SubmitComplaintAsync(long userId, Codes.OrderKind kind, long orderId, string category, string description);
    Task<Result<NotificationList>> GetNotificationsAsync(long userId);
    Task<Result<int>> MarkNotificationsReadAsync(long userId);
    Task<Result<ContactMessage>> SubmitContactMessageAsync(string name, string email, string? mobile, string role, string message);
}
