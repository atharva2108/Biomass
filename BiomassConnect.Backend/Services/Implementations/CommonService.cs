using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Data;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;
using BiomassConnect.Backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BiomassConnect.Backend.Services.Implementations;

/// <summary>
/// Complaints, notifications and the public contact form (added to the blueprint:
/// it listed six service interfaces for seven controllers).
/// </summary>
public class CommonService : ServiceBase, ICommonService
{
    public CommonService(DbFactory db) : base(db) { }

    /// <summary>
    /// Raised by the buyer or seller of ONE order (purchase order XOR pellet order).
    /// Following the frontend: farmers and power plants can complain only on Delivered orders
    /// (their billing.js lists delivered orders only); manufacturers on any of their orders
    /// (manufacturer/billing.js lists all). A second Open complaint with the same order and
    /// category by the same user is refused.
    /// </summary>
    public Task<Result<Complaint>> SubmitComplaintAsync(long userId, Codes.OrderKind kind, long orderId, string category, string description) => Guard(async () =>
    {
        await using var db = Db.Create();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId);
        if (user is null) return Result.Blocked<Complaint>("User not found");

        var categories = user.Role switch
        {
            UserRole.Farmer => Catalog.FarmerComplaintCategories,
            UserRole.Manufacturer => Catalog.ManufacturerComplaintCategories,
            UserRole.PowerPlant => Catalog.PowerPlantComplaintCategories,
            _ => null
        };
        if (categories is null) return Result.Blocked<Complaint>("Only farmers, manufacturers and power plants can raise complaints");

        // Load the order and work out the other party.
        long sellerId, buyerId;
        OrderStatus status;
        string code;
        if (kind == Codes.OrderKind.Biomass)
        {
            var o = await db.PurchaseOrders.AsNoTracking().FirstOrDefaultAsync(x => x.OrderId == orderId);
            if (o is null) return Result.Blocked<Complaint>($"Order {Codes.PurchaseOrder(orderId)} was not found");
            (sellerId, buyerId, status, code) = (o.FarmerId, o.ManufacturerId, o.Status, Codes.PurchaseOrder(orderId));
        }
        else
        {
            var o = await db.PelletOrders.AsNoTracking().FirstOrDefaultAsync(x => x.OrderId == orderId);
            if (o is null) return Result.Blocked<Complaint>($"Order {Codes.PelletOrder(orderId)} was not found");
            (sellerId, buyerId, status, code) = (o.ManufacturerId, o.PowerPlantId, o.Status, Codes.PelletOrder(orderId));
        }

        if (userId != sellerId && userId != buyerId)
            return Result.Blocked<Complaint>($"You can raise a complaint only on your own orders ({code} is not yours)");
        if (user.Role != UserRole.Manufacturer && status != OrderStatus.Delivered)
            return Result.Blocked<Complaint>($"Order {code} is {status.Label()}: complaints can be raised only on delivered orders");

        description = (description ?? "").Trim();
        var error = Rules.First(
            Rules.Select(category, "Category", categories),
            Rules.Text(description, "Description", 20, 500, required: true));
        if (error != null) return Result.Blocked<Complaint>(error);

        var duplicate = kind == Codes.OrderKind.Biomass
            ? await db.Complaints.AsNoTracking().FirstOrDefaultAsync(c => c.RaisedBy == userId && c.Status == ComplaintStatus.Open && c.Category == category && c.PurchaseOrderId == orderId)
            : await db.Complaints.AsNoTracking().FirstOrDefaultAsync(c => c.RaisedBy == userId && c.Status == ComplaintStatus.Open && c.Category == category && c.PelletOrderId == orderId);
        if (duplicate != null)
            return Result.Blocked<Complaint>($"You already have an open \"{category}\" complaint ({Codes.Complaint(duplicate.ComplaintId)}) for {code}.");

        var complaint = new Complaint
        {
            RaisedBy = userId,
            AgainstUserId = userId == sellerId ? buyerId : sellerId,
            PurchaseOrderId = kind == Codes.OrderKind.Biomass ? orderId : null,      // exactly one of the two
            PelletOrderId = kind == Codes.OrderKind.Pellet ? orderId : null,
            Category = category,
            Description = description,
            Status = ComplaintStatus.Open,
            RaisedOn = Clock.Today
        };
        db.Complaints.Add(complaint);
        await db.SaveChangesAsync();
        return Result.Ok(complaint, $"Complaint {Codes.Complaint(complaint.ComplaintId)} ({category}) submitted on {code}. The Biomass Connect team will review it.");
    });

    public async Task<Result<NotificationList>> GetNotificationsAsync(long userId)
    {
        await using var db = Db.Create();
        var items = await db.Notifications.AsNoTracking().Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt).ToListAsync();
        int unread = items.Count(n => !n.IsRead);
        return Result.Ok(new NotificationList(unread, items), $"{unread} unread of {items.Count}");
    }

    public Task<Result<int>> MarkNotificationsReadAsync(long userId) => Guard(async () =>
    {
        await using var db = Db.Create();
        int count = await db.Notifications.Where(n => n.UserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));
        return count == 0 ? Result.Info("There are no unread notifications", 0) : Result.Ok(count, $"{count} notification(s) marked as read");
    });

    public Task<Result<ContactMessage>> SubmitContactMessageAsync(string name, string email, string? mobile, string role, string message) => Guard(async () =>
    {
        name = (name ?? "").Trim();
        email = (email ?? "").Trim();
        mobile = Clean(mobile);
        message = (message ?? "").Trim();
        // index.html contact form data-rules
        var error = Rules.First(
            Rules.Name(name, "Name"),
            Rules.Email(email),
            Rules.Mobile(mobile, required: false),
            Rules.Select(role, "Your role", Catalog.ContactRoles),
            Rules.Text(message, "Message", 20, 500, required: true));
        if (error != null) return Result.Blocked<ContactMessage>(error);

        await using var db = Db.Create();
        var msg = new ContactMessage { Name = name, Email = email, Mobile = mobile, Role = role, Message = message, SentAt = Clock.UtcNow };
        db.ContactMessages.Add(msg);
        await db.SaveChangesAsync();
        return Result.Ok(msg, $"Thanks {name.Split(' ')[0]}! We'll get back to you at {email}.");
    });
}
