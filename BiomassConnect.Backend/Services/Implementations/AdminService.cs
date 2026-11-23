using System.Text.RegularExpressions;
using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Data;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;
using BiomassConnect.Backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BiomassConnect.Backend.Services.Implementations;

/// <summary>Admin console rules (js/admin/*.js). Every admin action is written to audit_logs in the same transaction.</summary>
public class AdminService : ServiceBase, IAdminService
{
    private static readonly UserRole[] MarketRoles = [UserRole.Farmer, UserRole.Manufacturer, UserRole.PowerPlant];

    public AdminService(DbFactory db) : base(db) { }

    private static void Audit(BiomassDbContext db, long adminId, string action, string module) =>
        db.AuditLogs.Add(new AuditLog { UserId = adminId, Action = action.Length > 200 ? action[..200] : action, Module = module, LoggedAt = Clock.UtcNow });

    private static string Who(User u) => $"{u.Name} <{u.Email}>";

    // ------------------------------------------------------------------ Dashboard

    public async Task<Result<AdminDashboard>> GetDashboardAsync()
    {
        await using var db = Db.Create();
        var users = await db.Users.Where(u => MarketRoles.Contains(u.Role)).Select(u => new { u.Role, u.Status }).ToListAsync();
        var poRows = await db.PurchaseOrders.Select(o => new { o.Status, o.TotalAmount }).ToListAsync();
        var ppRows = await db.PelletOrders.Select(o => new { o.Status, o.TotalAmount }).ToListAsync();
        var orders = poRows.Concat(ppRows).ToList();

        var dash = new AdminDashboard(
            TotalUsers: users.Count,
            ActiveUsers: users.Count(u => u.Status == UserStatus.Active),
            Farmers: users.Count(u => u.Role == UserRole.Farmer),
            Manufacturers: users.Count(u => u.Role == UserRole.Manufacturer),
            PowerPlants: users.Count(u => u.Role == UserRole.PowerPlant),
            PendingVerifications: await db.VerificationDocuments.CountAsync(v => v.Status == VerificationStatus.Pending),
            ActiveOrders: orders.Count(o => o.Status != OrderStatus.Delivered),
            OpenDisputes: await db.Complaints.CountAsync(c => c.Status == ComplaintStatus.Open),
            Gmv: orders.Sum(o => o.TotalAmount));               // dashboard.js: GMV = total of all orders
        return Result.Ok(dash, $"GMV {Inr(dash.Gmv)} | {dash.TotalUsers} users | {dash.PendingVerifications} pending KYC | {dash.OpenDisputes} open disputes");
    }

    // ------------------------------------------------------------------ Users

    public async Task<Result<List<User>>> GetUsersAsync(UserRole? role = null, UserStatus? status = null, string? keyword = null)
    {
        await using var db = Db.Create();
        var q = db.Users.AsNoTracking().Where(u => MarketRoles.Contains(u.Role));
        if (role.HasValue) q = q.Where(u => u.Role == role);
        if (status.HasValue) q = q.Where(u => u.Status == status);
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var k = $"%{keyword.Trim().ToLowerInvariant()}%";
            q = q.Where(u => EF.Functions.Like(u.Name.ToLower(), k) || EF.Functions.Like(u.Email, k) || EF.Functions.Like(u.Mobile, k));
        }
        var list = await q.OrderByDescending(u => u.RegisteredOn).ThenByDescending(u => u.UserId).ToListAsync();
        return Result.Ok(list, $"{list.Count} user(s)");
    }

    public Task<Result<User>> BlockUserAsync(long adminId, long userId, string category, string reason) => Guard(async () =>
    {
        reason = (reason ?? "").Trim();
        var error = Rules.First(
            Rules.Select(category, "Block category", Catalog.BlockCategories),
            Rules.Text(reason, "Reason", 10, 500, required: true));
        if (error != null) return Result.Blocked<User>(error);

        await using var db = Db.Create();
        var u = await db.Users.FirstOrDefaultAsync(x => x.UserId == userId);
        if (u is null || !MarketRoles.Contains(u.Role)) return Result.Blocked<User>("User not found");
        if (u.Status == UserStatus.Blocked) return Result.Blocked<User>($"{u.Name} is already blocked");

        u.PreviousStatus = u.Status;                         // restored on unblock
        u.Status = UserStatus.Blocked;
        u.BlockCategory = category;
        u.BlockReason = reason;
        u.BlockedOn = Clock.Today;
        Audit(db, adminId, $"Blocked user {Who(u)} - {category}", "Users");
        await db.SaveChangesAsync();
        return Result.Ok(u, $"{u.Name} has been blocked ({category}). Previous status {u.PreviousStatus} saved for unblock.");
    });

    public Task<Result<User>> UnblockUserAsync(long adminId, long userId) => Guard(async () =>
    {
        await using var db = Db.Create();
        var u = await db.Users.FirstOrDefaultAsync(x => x.UserId == userId);
        if (u is null || !MarketRoles.Contains(u.Role)) return Result.Blocked<User>("User not found");
        if (u.Status != UserStatus.Blocked) return Result.Blocked<User>($"{u.Name} is not blocked");

        u.Status = u.PreviousStatus is { } prev && prev != UserStatus.Blocked ? prev : UserStatus.Active;
        u.PreviousStatus = null;
        u.BlockCategory = null;
        u.BlockReason = null;
        u.BlockedOn = null;
        Audit(db, adminId, $"Unblocked user {Who(u)}", "Users");
        await db.SaveChangesAsync();
        return Result.Ok(u, $"{u.Name} has been unblocked. Status restored to {u.Status}.");
    });

    // ------------------------------------------------------------------ Verification (KYC)

    public async Task<Result<List<VerificationDocument>>> GetVerificationsAsync(VerificationStatus? status = VerificationStatus.Pending, UserRole? role = null)
    {
        await using var db = Db.Create();
        var q = db.VerificationDocuments.AsNoTracking().Include(v => v.User).Include(v => v.Reviewer).AsQueryable();
        if (status.HasValue) q = q.Where(v => v.Status == status);
        if (role.HasValue) q = q.Where(v => v.User!.Role == role);
        // Pending queue oldest first; reviewed ones newest first (verification.js).
        var list = status == VerificationStatus.Pending
            ? await q.OrderBy(v => v.SubmittedOn).ThenBy(v => v.DocumentId).ToListAsync()
            : await q.OrderByDescending(v => v.SubmittedOn).ThenByDescending(v => v.DocumentId).ToListAsync();
        return Result.Ok(list, $"{list.Count} application(s)");
    }

    public Task<Result<VerificationDocument>> ReviewVerificationAsync(long adminId, long documentId, bool approve,
        string? reasonCategory = null, string? reason = null) => Guard(async () =>
    {
        await using var db = Db.Create();
        var v = await db.VerificationDocuments.Include(x => x.User).FirstOrDefaultAsync(x => x.DocumentId == documentId);
        if (v is null) return Result.Blocked<VerificationDocument>("Application not found");
        if (v.Status != VerificationStatus.Pending)
            return Result.Blocked<VerificationDocument>($"{Codes.Verification(documentId)} was already {v.Status} on {Rules.Fmt(v.ReviewedOn!.Value)}");

        if (!approve)
        {
            reason = (reason ?? "").Trim();
            var error = Rules.First(
                Rules.Select(reasonCategory, "Rejection category", Catalog.RejectCategories),
                Rules.Text(reason, "Reason", 10, 500, required: true));
            if (error != null) return Result.Blocked<VerificationDocument>(error);
        }

        var user = v.User!;
        var label = user.Role.Label().ToLowerInvariant();
        v.Status = approve ? VerificationStatus.Approved : VerificationStatus.Rejected;
        v.ReviewedBy = adminId;
        v.ReviewedOn = Clock.Today;
        v.ReasonCategory = approve ? null : reasonCategory;
        v.Reason = approve ? null : reason;

        // verification.js syncUser: Approved -> Active, Rejected -> Rejected; a Blocked account stays Blocked.
        if (user.Status != UserStatus.Blocked)
            user.Status = approve ? UserStatus.Active : UserStatus.Rejected;

        Audit(db, adminId, $"{(approve ? "Approved" : "Rejected")} {label} verification {Codes.Verification(documentId)} ({Who(user)})", "Verification");
        await db.SaveChangesAsync();
        return Result.Ok(v, approve
            ? $"{user.Name}: {v.DocType.Label()} approved. Account status: {user.Status}"
            : $"{user.Name}: registration rejected ({reasonCategory}). Account status: {user.Status}");
    });

    // ------------------------------------------------------------------ Orders & disputes

    public async Task<Result<List<OrderView>>> GetOrdersAsync(Codes.OrderKind? kind = null, OrderStatus? status = null,
        DateOnly? from = null, DateOnly? to = null, string? keyword = null)
    {
        var error = Rules.First(
            from.HasValue ? Rules.NotFuture(from.Value, "From date") : null,
            to.HasValue ? Rules.NotFuture(to.Value, "To date") : null,
            from.HasValue && to.HasValue && to < from ? "To date cannot be before from date" : null);
        if (error != null) return Result.Blocked<List<OrderView>>(error);

        await using var db = Db.Create();
        var all = new List<OrderView>();
        if (kind is null or Codes.OrderKind.Biomass) all.AddRange((await PurchaseOrdersQuery(db).ToListAsync()).Select(OrderView.From));
        if (kind is null or Codes.OrderKind.Pellet) all.AddRange((await PelletOrdersQuery(db).ToListAsync()).Select(OrderView.From));

        var list = all
            .Where(o => status is null || o.Status == status)
            .Where(o => from is null || o.OrderDate >= from)
            .Where(o => to is null || o.OrderDate <= to)
            .Where(o => string.IsNullOrWhiteSpace(keyword) || $"{o.Code} {o.Buyer} {o.Seller} {o.Product}".Contains(keyword.Trim(), StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(o => o.OrderDate).ThenByDescending(o => o.OrderId).ToList();
        return Result.Ok(list, $"{list.Count} transaction(s) worth {Inr(list.Sum(o => o.TotalAmount))}");
    }

    public async Task<Result<List<DisputeView>>> GetDisputesAsync(ComplaintStatus? status = null, string? category = null)
    {
        await using var db = Db.Create();
        var q = ComplaintsQuery(db);
        if (status.HasValue) q = q.Where(c => c.Status == status);
        if (!string.IsNullOrWhiteSpace(category)) q = q.Where(c => c.Category == category);
        var list = (await q.OrderByDescending(c => c.RaisedOn).ThenByDescending(c => c.ComplaintId).ToListAsync()).Select(ToView).ToList();
        return Result.Ok(list, $"{list.Count(d => d.Complaint.Status == ComplaintStatus.Open)} open, {list.Count(d => d.Complaint.Status == ComplaintStatus.Resolved)} resolved");
    }

    public Task<Result<DisputeView>> ResolveDisputeAsync(long adminId, long complaintId, string resolution) => Guard(async () =>
    {
        resolution = (resolution ?? "").Trim();
        var error = Rules.Text(resolution, "Resolution", 10, 500, required: true);
        if (error != null) return Result.Blocked<DisputeView>(error);

        await using var db = Db.Create();
        var c = await db.Complaints.Include(x => x.RaisedByUser).FirstOrDefaultAsync(x => x.ComplaintId == complaintId);
        if (c is null) return Result.Blocked<DisputeView>("Complaint not found");
        if (c.Status == ComplaintStatus.Resolved) return Result.Blocked<DisputeView>($"{Codes.Complaint(complaintId)} is already resolved");

        c.Status = ComplaintStatus.Resolved;
        c.Resolution = resolution;
        c.ResolvedOn = Clock.Today;
        Audit(db, adminId, $"Resolved complaint {Codes.Complaint(complaintId)} raised by {Who(c.RaisedByUser!)}", "Disputes");
        await db.SaveChangesAsync();

        var view = ToView(await ComplaintsQuery(db).FirstAsync(x => x.ComplaintId == complaintId));
        return Result.Ok(view, $"{Codes.Complaint(complaintId)} resolved (binding): \"{resolution}\"");
    });

    private static IQueryable<Complaint> ComplaintsQuery(BiomassDbContext db) => db.Complaints.AsNoTracking()
        .Include(c => c.RaisedByUser).Include(c => c.AgainstUser).Include(c => c.PurchaseOrder).Include(c => c.PelletOrder);

    private static DisputeView ToView(Complaint c) => new(c,
        c.PurchaseOrderId is { } po ? Codes.PurchaseOrder(po) : Codes.PelletOrder(c.PelletOrderId!.Value),
        c.RaisedByUser?.Name ?? "", c.AgainstUser?.Name ?? "");

    // ------------------------------------------------------------------ Audit & compliance

    public async Task<Result<AuditPage>> GetAuditLogsAsync(int page = 1, int pageSize = 15, string? module = null, UserRole? role = null,
        DateOnly? from = null, DateOnly? to = null, string? keyword = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        if (from.HasValue && to.HasValue && to < from) return Result.Blocked<AuditPage>("To date cannot be before from date");

        await using var db = Db.Create();
        var q = db.AuditLogs.AsNoTracking().Include(l => l.User).AsQueryable();
        if (!string.IsNullOrWhiteSpace(module)) q = q.Where(l => l.Module == module);
        if (role.HasValue) q = q.Where(l => l.User!.Role == role);
        if (from.HasValue)
        {
            var start = from.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Local).ToUniversalTime();
            q = q.Where(l => l.LoggedAt >= start);
        }
        if (to.HasValue)
        {
            var end = to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Local).ToUniversalTime();
            q = q.Where(l => l.LoggedAt < end);
        }
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var k = $"%{keyword.Trim().ToLowerInvariant()}%";
            q = q.Where(l => EF.Functions.Like(l.Action.ToLower(), k) || EF.Functions.Like(l.User!.Name.ToLower(), k));
        }
        int total = await q.CountAsync();
        var items = await q.OrderByDescending(l => l.LoggedAt).ThenByDescending(l => l.LogId)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Result.Ok(new AuditPage(total, page, pageSize, items), $"{total} entr{(total == 1 ? "y" : "ies")} | page {page} of {Math.Max(1, (total + pageSize - 1) / pageSize)}");
    }

    public Task<Result<Certificate>> IssueCertificateAsync(long adminId, long powerPlantId, DateOnly issueDate, DateOnly validUntil, string? remarks) => Guard(async () =>
    {
        var error = Rules.First(
            Rules.NotFuture(issueDate, "Issue date"),
            validUntil <= issueDate ? "Valid until must be after issue date" : null,
            Rules.Text(remarks, "Remarks", 0, 200));
        if (error != null) return Result.Blocked<Certificate>(error);

        await using var db = Db.Create();
        var plant = await db.Users.FirstOrDefaultAsync(u => u.UserId == powerPlantId);
        if (plant is null || plant.Role != UserRole.PowerPlant) return Result.Blocked<Certificate>("Please select a power plant");
        if (plant.Status != UserStatus.Active) return Result.Blocked<Certificate>($"{plant.Name} is {plant.Status}: certificates are issued only to active power plants");

        // audit-compliance.js: BC/GN/<issue year>/<next number, from 1001>
        var numbers = (await db.Certificates.Select(c => c.CertificateNo).ToListAsync())
            .Select(n => Regex.Match(n, @"(\d+)$")).Where(m => m.Success).Select(m => long.Parse(m.Value)).ToList();
        long next = numbers.Count > 0 ? Math.Max(numbers.Max() + 1, 1001) : 1001;

        var cert = new Certificate
        {
            CertificateNo = $"BC/GN/{issueDate.Year}/{next}",
            PowerPlantId = powerPlantId,
            Title = Catalog.CertificateTitle,
            IssueDate = issueDate,
            ValidUntil = validUntil,
            Remarks = Clean(remarks),
            IssuedBy = adminId
        };
        db.Certificates.Add(cert);
        Audit(db, adminId, $"Issued compliance certificate {cert.CertificateNo} to {Who(plant)}", "Compliance");
        await db.SaveChangesAsync();
        return Result.Ok(cert, $"Certificate {cert.CertificateNo} issued to {plant.Name}, valid {Rules.Fmt(issueDate)} - {Rules.Fmt(validUntil)}");
    });

    // ------------------------------------------------------------------ Reports

    private sealed record ReportRow(Codes.OrderKind Kind, OrderStatus Status, decimal QuantityTons, decimal TotalAmount,
        PaymentStatus PaymentStatus, DateOnly? DeliveredDate, DateOnly OrderDate);

    public async Task<Result<AdminReport>> GetReportsAsync(int months = 6)
    {
        months = Math.Clamp(months, 1, 24);
        await using var db = Db.Create();
        var rows = (await db.PurchaseOrders.Select(o => new { o.Status, o.QuantityTons, o.TotalAmount, o.PaymentStatus, o.DeliveredDate, o.OrderDate }).ToListAsync())
                .Select(o => new ReportRow(Codes.OrderKind.Biomass, o.Status, o.QuantityTons, o.TotalAmount, o.PaymentStatus, o.DeliveredDate, o.OrderDate))
            .Concat((await db.PelletOrders.Select(o => new { o.Status, o.QuantityTons, o.TotalAmount, o.PaymentStatus, o.DeliveredDate, o.OrderDate }).ToListAsync())
                .Select(o => new ReportRow(Codes.OrderKind.Pellet, o.Status, o.QuantityTons, o.TotalAmount, o.PaymentStatus, o.DeliveredDate, o.OrderDate)))
            .ToList();
        var delivered = rows.Where(r => r.Status == OrderStatus.Delivered).ToList();

        var first = new DateOnly(Clock.Today.Year, Clock.Today.Month, 1).AddMonths(-(months - 1));
        var trend = Enumerable.Range(0, months).Select(i =>
        {
            var m = first.AddMonths(i);
            var inMonth = delivered.Where(r => (r.DeliveredDate ?? r.OrderDate) is var d && d.Year == m.Year && d.Month == m.Month).ToList();
            return new MonthlyTrend(m.ToString("MMM yy"),
                inMonth.Where(r => r.Kind == Codes.OrderKind.Biomass).Sum(r => r.QuantityTons),
                inMonth.Where(r => r.Kind == Codes.OrderKind.Pellet).Sum(r => r.QuantityTons),
                inMonth.Count);
        }).ToList();

        return Result.Ok(new AdminReport(
            DeliveredBiomassTons: delivered.Where(r => r.Kind == Codes.OrderKind.Biomass).Sum(r => r.QuantityTons),
            DeliveredPelletTons: delivered.Where(r => r.Kind == Codes.OrderKind.Pellet).Sum(r => r.QuantityTons),
            PaidValue: rows.Where(r => r.PaymentStatus == PaymentStatus.Paid).Sum(r => r.TotalAmount),
            PendingValue: delivered.Where(r => r.PaymentStatus == PaymentStatus.Pending).Sum(r => r.TotalAmount),
            StatusCounts: Enum.GetValues<OrderStatus>().ToDictionary(s => s, s => rows.Count(r => r.Status == s)),
            Months: trend), $"{rows.Count} order(s), {delivered.Count} delivered");
    }

    // ------------------------------------------------------------------ Settings (singleton row)

    public async Task<Result<PlatformSettings>> GetSettingsAsync()
    {
        await using var db = Db.Create();
        var s = await db.PlatformSettings.AsNoTracking().FirstOrDefaultAsync(x => x.SettingsId == 1);
        return s is null ? Result.Blocked<PlatformSettings>("The platform_settings row (settings_id = 1) is missing") : Result.Ok(s);
    }

    public Task<Result<PlatformSettings>> UpdateSettingsAsync(long adminId, PlatformSettings n) => Guard(async () =>
    {
        await using var db = Db.Create();
        var s = await db.PlatformSettings.FirstOrDefaultAsync(x => x.SettingsId == 1);
        if (s is null) return Result.Blocked<PlatformSettings>("The platform_settings row (settings_id = 1) is missing");

        var next = n.Clone();
        next.PlatformName = (next.PlatformName ?? "").Trim();
        next.SupportEmail = (next.SupportEmail ?? "").Trim().ToLowerInvariant();
        next.SupportPhone = (next.SupportPhone ?? "").Trim();
        if (!next.NotifyHighValue) next.HighValueThreshold = s.HighValueThreshold;   // setting.js keeps the old threshold

        // admin/setting.html data-rules
        var error = Rules.First(
            Rules.Text(next.PlatformName, "Platform name", 3, 60, required: true),
            Rules.Email(next.SupportEmail),
            Rules.Mobile(next.SupportPhone, label: "Support phone"),
            Rules.Range(next.CommissionPct, "Commission", 0, 20, 2),
            Rules.Range(next.GstOnCommissionPct, "GST", 0, 28, 2),
            Rules.Range(next.MinOrderTons, "Minimum order quantity", 1, 1000, 0),
            Rules.Range(next.SessionTimeoutMin, "Session timeout", 5, 240, 0),
            Rules.Range(next.MaxLoginAttempts, "Max login attempts", 3, 10, 0),
            Rules.Range(next.MaxUploadMb, "Max upload size", 1, 25, 0),
            next.NotifyHighValue ? Rules.Range(next.HighValueThreshold, "High-value threshold", 10000, 100000000, 0) : null);
        if (error != null) return Result.Blocked<PlatformSettings>(error);

        var changed = new List<string>();
        void Set<T>(string name, T current, T value, Action<T> assign)
        {
            if (!EqualityComparer<T>.Default.Equals(current, value)) { changed.Add(name); assign(value); }
        }
        Set("platform name", s.PlatformName, next.PlatformName, v => s.PlatformName = v);
        Set("support email", s.SupportEmail, next.SupportEmail, v => s.SupportEmail = v);
        Set("support phone", s.SupportPhone, next.SupportPhone, v => s.SupportPhone = v);
        Set("commission", s.CommissionPct, next.CommissionPct, v => s.CommissionPct = v);
        Set("GST", s.GstOnCommissionPct, next.GstOnCommissionPct, v => s.GstOnCommissionPct = v);
        Set("min order", s.MinOrderTons, next.MinOrderTons, v => s.MinOrderTons = v);
        Set("session timeout", s.SessionTimeoutMin, next.SessionTimeoutMin, v => s.SessionTimeoutMin = v);
        Set("max login attempts", s.MaxLoginAttempts, next.MaxLoginAttempts, v => s.MaxLoginAttempts = v);
        Set("max upload", s.MaxUploadMb, next.MaxUploadMb, v => s.MaxUploadMb = v);
        Set("notify registrations", s.NotifyRegistrations, next.NotifyRegistrations, v => s.NotifyRegistrations = v);
        Set("notify complaints", s.NotifyComplaints, next.NotifyComplaints, v => s.NotifyComplaints = v);
        Set("notify high value", s.NotifyHighValue, next.NotifyHighValue, v => s.NotifyHighValue = v);
        Set("high-value threshold", s.HighValueThreshold, next.HighValueThreshold, v => s.HighValueThreshold = v);

        if (changed.Count == 0) return Result.Info("No changes to save", s);

        Audit(db, adminId, $"Updated platform settings ({changed.Count} field{(changed.Count > 1 ? "s" : "")}: {string.Join(", ", changed)})", "Settings");
        await db.SaveChangesAsync();
        return Result.Ok(s, $"Platform settings saved ({string.Join(", ", changed)})");
    });
}
