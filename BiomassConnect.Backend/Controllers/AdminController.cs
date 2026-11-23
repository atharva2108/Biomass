using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;
using BiomassConnect.Backend.Services.Interfaces;
using BiomassConnect.Backend.Session;

namespace BiomassConnect.Backend.Controllers;

/// <summary>Admin console (uses IAdminService). Every method requires a signed-in Admin.</summary>
public class AdminController : ControllerBase
{
    private readonly IAdminService _svc;

    public AdminController(IAdminService svc, CurrentUser session) : base(session) => _svc = svc;

    // GET /api/admin/dashboard
    public Task<Result<AdminDashboard>> GetDashboard() => As(UserRole.Admin, _ => _svc.GetDashboardAsync());

    // GET /api/admin/users?role=&status=&q=
    public Task<Result<List<User>>> GetUsers(UserRole? role = null, UserStatus? status = null, string? keyword = null) =>
        As(UserRole.Admin, _ => _svc.GetUsersAsync(role, status, keyword));

    // POST /api/admin/users/{id}/block
    public Task<Result<User>> BlockUser(long userId, string category, string reason) =>
        As(UserRole.Admin, adminId => _svc.BlockUserAsync(adminId, userId, category, reason));

    // POST /api/admin/users/{id}/unblock
    public Task<Result<User>> UnblockUser(long userId) => As(UserRole.Admin, adminId => _svc.UnblockUserAsync(adminId, userId));

    // GET /api/admin/verifications?status=&role=
    public Task<Result<List<VerificationDocument>>> GetVerifications(VerificationStatus? status = VerificationStatus.Pending, UserRole? role = null) =>
        As(UserRole.Admin, _ => _svc.GetVerificationsAsync(status, role));

    // POST /api/admin/verifications/{id}/review
    public Task<Result<VerificationDocument>> ReviewVerification(long documentId, bool approve, string? reasonCategory = null, string? reason = null) =>
        As(UserRole.Admin, adminId => _svc.ReviewVerificationAsync(adminId, documentId, approve, reasonCategory, reason));

    // GET /api/admin/orders?type=&status=&from=&to=&q=
    public Task<Result<List<OrderView>>> GetOrders(Codes.OrderKind? kind = null, OrderStatus? status = null, DateOnly? from = null, DateOnly? to = null, string? keyword = null) =>
        As(UserRole.Admin, _ => _svc.GetOrdersAsync(kind, status, from, to, keyword));

    // GET /api/admin/disputes?status=&category=
    public Task<Result<List<DisputeView>>> GetDisputes(ComplaintStatus? status = null, string? category = null) =>
        As(UserRole.Admin, _ => _svc.GetDisputesAsync(status, category));

    // POST /api/admin/disputes/{id}/resolve
    public Task<Result<DisputeView>> ResolveDispute(long complaintId, string resolution) =>
        As(UserRole.Admin, adminId => _svc.ResolveDisputeAsync(adminId, complaintId, resolution));

    // GET /api/admin/audit-logs?page=&pageSize=&module=&role=&from=&to=&q=
    public Task<Result<AuditPage>> GetAuditLogs(int page = 1, int pageSize = 15, string? module = null, UserRole? role = null,
        DateOnly? from = null, DateOnly? to = null, string? keyword = null) =>
        As(UserRole.Admin, _ => _svc.GetAuditLogsAsync(page, pageSize, module, role, from, to, keyword));

    // POST /api/admin/certificates/issue
    public Task<Result<Certificate>> IssueCertificate(long powerPlantId, DateOnly issueDate, DateOnly validUntil, string? remarks = null) =>
        As(UserRole.Admin, adminId => _svc.IssueCertificateAsync(adminId, powerPlantId, issueDate, validUntil, remarks));

    // GET /api/admin/reports
    public Task<Result<AdminReport>> GetReports(int months = 6) => As(UserRole.Admin, _ => _svc.GetReportsAsync(months));

    // GET /api/admin/settings
    public Task<Result<PlatformSettings>> GetSettings() => As(UserRole.Admin, _ => _svc.GetSettingsAsync());

    // PUT /api/admin/settings
    public Task<Result<PlatformSettings>> UpdateSettings(PlatformSettings settings) =>
        As(UserRole.Admin, adminId => _svc.UpdateSettingsAsync(adminId, settings));
}
