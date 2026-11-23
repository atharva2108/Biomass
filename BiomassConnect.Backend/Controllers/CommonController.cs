using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Services.Interfaces;
using BiomassConnect.Backend.Session;

namespace BiomassConnect.Backend.Controllers;

/// <summary>Complaints, notifications and the public contact form (uses ICommonService).</summary>
public class CommonController : ControllerBase
{
    private readonly ICommonService _svc;

    public CommonController(ICommonService svc, CurrentUser session) : base(session) => _svc = svc;

    // POST /api/complaints
    public Task<Result<Complaint>> SubmitComplaint(string orderCode, string category, string description) =>
        SignedIn(userId => WithOrder(orderCode, (kind, orderId) => _svc.SubmitComplaintAsync(userId, kind, orderId, category, description)));

    // GET /api/notifications
    public Task<Result<NotificationList>> GetNotifications() => SignedIn(userId => _svc.GetNotificationsAsync(userId));

    // PATCH /api/notifications/read
    public Task<Result<int>> MarkNotificationsRead() => SignedIn(userId => _svc.MarkNotificationsReadAsync(userId));

    // POST /api/contact  (public: no sign-in)
    public Task<Result<ContactMessage>> SubmitContactMessage(string name, string email, string? mobile, string role, string message) =>
        _svc.SubmitContactMessageAsync(name, email, mobile, role, message);

    private Task<Result<T>> SignedIn<T>(Func<long, Task<Result<T>>> action) =>
        Session.IsAuthenticated ? action(Session.UserId!.Value) : Task.FromResult(Result.Blocked<T>("Please sign in first."));
}
