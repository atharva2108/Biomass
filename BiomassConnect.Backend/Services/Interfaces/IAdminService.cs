using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.Services.Interfaces;

public interface IAdminService
{
    Task<Result<AdminDashboard>> GetDashboardAsync();
    Task<Result<List<User>>> GetUsersAsync(UserRole? role = null, UserStatus? status = null, string? keyword = null);
    Task<Result<User>> BlockUserAsync(long adminId, long userId, string category, string reason);
    Task<Result<User>> UnblockUserAsync(long adminId, long userId);
    Task<Result<List<VerificationDocument>>> GetVerificationsAsync(VerificationStatus? status = VerificationStatus.Pending, UserRole? role = null);
    Task<Result<VerificationDocument>> ReviewVerificationAsync(long adminId, long documentId, bool approve, string? reasonCategory = null, string? reason = null);
    Task<Result<List<OrderView>>> GetOrdersAsync(Codes.OrderKind? kind = null, OrderStatus? status = null, DateOnly? from = null, DateOnly? to = null, string? keyword = null);
    Task<Result<List<DisputeView>>> GetDisputesAsync(ComplaintStatus? status = null, string? category = null);
    Task<Result<DisputeView>> ResolveDisputeAsync(long adminId, long complaintId, string resolution);
    Task<Result<AuditPage>> GetAuditLogsAsync(int page = 1, int pageSize = 15, string? module = null, UserRole? role = null,
        DateOnly? from = null, DateOnly? to = null, string? keyword = null);
    Task<Result<Certificate>> IssueCertificateAsync(long adminId, long powerPlantId, DateOnly issueDate, DateOnly validUntil, string? remarks);
    Task<Result<AdminReport>> GetReportsAsync(int months = 6);
    Task<Result<PlatformSettings>> GetSettingsAsync();
    Task<Result<PlatformSettings>> UpdateSettingsAsync(long adminId, PlatformSettings changes);
}
