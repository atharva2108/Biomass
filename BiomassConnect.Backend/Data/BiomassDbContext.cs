using System.Text;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace BiomassConnect.Backend.Data;

/// <summary>
/// EF Core mapping of the EXISTING database/schema.sql. Read-only structure:
/// no migrations, no EnsureCreated, no HasDefaultValue / HasCheckConstraint.
/// The schema stays the single source of truth; this class only describes it.
/// </summary>
public class BiomassDbContext : DbContext
{
    public BiomassDbContext(DbContextOptions<BiomassDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<FarmerProfile> FarmerProfiles => Set<FarmerProfile>();
    public DbSet<ManufacturerProfile> ManufacturerProfiles => Set<ManufacturerProfile>();
    public DbSet<PowerPlantProfile> PowerPlantProfiles => Set<PowerPlantProfile>();
    public DbSet<VerificationDocument> VerificationDocuments => Set<VerificationDocument>();
    public DbSet<BiomassListing> BiomassListings => Set<BiomassListing>();
    public DbSet<PelletListing> PelletListings => Set<PelletListing>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PelletOrder> PelletOrders => Set<PelletOrder>();
    public DbSet<PelletFeedback> PelletFeedback => Set<PelletFeedback>();
    public DbSet<Complaint> Complaints => Set<Complaint>();
    public DbSet<Certificate> Certificates => Set<Certificate>();
    public DbSet<ConsumptionLog> ConsumptionLogs => Set<ConsumptionLog>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<PlatformSettings> PlatformSettings => Set<PlatformSettings>();
    public DbSet<ContactMessage> ContactMessages => Set<ContactMessage>();
    public DbSet<ManufacturerRating> ManufacturerRatings => Set<ManufacturerRating>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        // The 9 PostgreSQL enum types (already created by schema.sql).
        b.HasPostgresEnum<UserRole>("user_role");
        b.HasPostgresEnum<UserStatus>("user_status");
        b.HasPostgresEnum<VerificationStatus>("verification_status");
        b.HasPostgresEnum<DocumentType>("document_type");
        b.HasPostgresEnum<ListingStatus>("listing_status");
        b.HasPostgresEnum<OrderStatus>("order_status");
        b.HasPostgresEnum<PaymentStatus>("payment_status");
        b.HasPostgresEnum<ComplaintStatus>("complaint_status");
        b.HasPostgresEnum<NotificationType>("notification_type");

        b.Entity<User>(e =>
        {
            e.ToTable("users").HasKey(x => x.UserId);
            e.HasIndex(x => x.Email).IsUnique();
            e.HasIndex(x => x.Mobile).IsUnique();
        });

        b.Entity<FarmerProfile>(e =>
        {
            e.ToTable("farmer_profiles").HasKey(x => x.UserId);
            e.Property(x => x.UserId).ValueGeneratedNever();
            e.HasOne(x => x.User).WithOne(u => u.FarmerProfile).HasForeignKey<FarmerProfile>(x => x.UserId);
        });

        b.Entity<ManufacturerProfile>(e =>
        {
            e.ToTable("manufacturer_profiles").HasKey(x => x.UserId);
            e.Property(x => x.UserId).ValueGeneratedNever();
            e.HasOne(x => x.User).WithOne(u => u.ManufacturerProfile).HasForeignKey<ManufacturerProfile>(x => x.UserId);
        });

        b.Entity<PowerPlantProfile>(e =>
        {
            e.ToTable("powerplant_profiles").HasKey(x => x.UserId);
            e.Property(x => x.UserId).ValueGeneratedNever();
            e.HasOne(x => x.User).WithOne(u => u.PowerPlantProfile).HasForeignKey<PowerPlantProfile>(x => x.UserId);
        });

        b.Entity<VerificationDocument>(e =>
        {
            e.ToTable("verification_documents").HasKey(x => x.DocumentId);
            e.HasOne(x => x.User).WithOne(u => u.VerificationDocument).HasForeignKey<VerificationDocument>(x => x.UserId);
            e.HasOne(x => x.Reviewer).WithMany().HasForeignKey(x => x.ReviewedBy);
        });

        b.Entity<BiomassListing>(e =>
        {
            e.ToTable("biomass_listings").HasKey(x => x.ListingId);
            e.HasOne(x => x.Farmer).WithMany().HasForeignKey(x => x.FarmerId);
        });

        b.Entity<PelletListing>(e =>
        {
            e.ToTable("pellet_listings").HasKey(x => x.ListingId);
            e.HasOne(x => x.Manufacturer).WithMany().HasForeignKey(x => x.ManufacturerId);
        });

        b.Entity<PurchaseOrder>(e =>
        {
            e.ToTable("purchase_orders").HasKey(x => x.OrderId);
            // Generated column: EF never writes it and reads it back after INSERT/UPDATE (RETURNING).
            e.Property(x => x.TotalAmount).HasComputedColumnSql("quantity_tons * price_per_ton", stored: true);
            e.HasOne(x => x.Listing).WithMany().HasForeignKey(x => x.ListingId);
            e.HasOne(x => x.Farmer).WithMany().HasForeignKey(x => x.FarmerId);
            e.HasOne(x => x.Manufacturer).WithMany().HasForeignKey(x => x.ManufacturerId);
        });

        b.Entity<PelletOrder>(e =>
        {
            e.ToTable("pellet_orders").HasKey(x => x.OrderId);
            e.Property(x => x.PowerPlantId).HasColumnName("powerplant_id");
            e.Property(x => x.TotalAmount).HasComputedColumnSql("quantity_tons * price_per_ton", stored: true);
            e.HasOne(x => x.Listing).WithMany().HasForeignKey(x => x.ListingId);
            e.HasOne(x => x.Manufacturer).WithMany().HasForeignKey(x => x.ManufacturerId);
            e.HasOne(x => x.PowerPlant).WithMany().HasForeignKey(x => x.PowerPlantId);
        });

        b.Entity<PelletFeedback>(e =>
        {
            e.ToTable("pellet_feedback").HasKey(x => x.FeedbackId);
            e.HasOne(x => x.Order).WithOne(o => o.Feedback).HasForeignKey<PelletFeedback>(x => x.OrderId);
        });

        b.Entity<Complaint>(e =>
        {
            e.ToTable("complaints").HasKey(x => x.ComplaintId);
            e.HasOne(x => x.RaisedByUser).WithMany().HasForeignKey(x => x.RaisedBy);
            e.HasOne(x => x.AgainstUser).WithMany().HasForeignKey(x => x.AgainstUserId);
            e.HasOne(x => x.PurchaseOrder).WithMany().HasForeignKey(x => x.PurchaseOrderId);
            e.HasOne(x => x.PelletOrder).WithMany().HasForeignKey(x => x.PelletOrderId);
        });

        b.Entity<Certificate>(e =>
        {
            e.ToTable("certificates").HasKey(x => x.CertificateId);
            e.Property(x => x.PowerPlantId).HasColumnName("powerplant_id");
            e.HasOne(x => x.PowerPlant).WithMany().HasForeignKey(x => x.PowerPlantId);
            e.HasOne(x => x.Issuer).WithMany().HasForeignKey(x => x.IssuedBy);
        });

        b.Entity<ConsumptionLog>(e =>
        {
            e.ToTable("consumption_logs").HasKey(x => x.EntryId);
            e.Property(x => x.PowerPlantId).HasColumnName("powerplant_id");
            e.Property(x => x.CofiringRatioPct)
             .HasComputedColumnSql("round(pellets_tons * 100 / (pellets_tons + coal_tons), 2)", stored: true);
            e.HasOne(x => x.PowerPlant).WithMany().HasForeignKey(x => x.PowerPlantId);
        });

        b.Entity<Notification>(e =>
        {
            e.ToTable("notifications").HasKey(x => x.NotificationId);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId);
        });

        b.Entity<AuditLog>(e =>
        {
            e.ToTable("audit_logs").HasKey(x => x.LogId);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId);
        });

        b.Entity<PlatformSettings>(e =>
        {
            e.ToTable("platform_settings").HasKey(x => x.SettingsId);
            e.Property(x => x.SettingsId).ValueGeneratedNever();
        });

        b.Entity<ContactMessage>(e => e.ToTable("contact_messages").HasKey(x => x.MessageId));

        b.Entity<ManufacturerRating>(e =>
        {
            e.ToView("manufacturer_ratings").HasNoKey();
            e.Property(x => x.ManufacturerId).HasColumnName("manufacturer_id");
            e.Property(x => x.Rating).HasColumnName("rating");
            e.Property(x => x.Batches).HasColumnName("batches");
        });

        // Every other column follows schema.sql's snake_case naming (UserId -> user_id).
        foreach (var entity in b.Model.GetEntityTypes())
            foreach (var prop in entity.GetProperties())
                if (prop.GetColumnName() == prop.Name)
                    prop.SetColumnName(ToSnakeCase(prop.Name));
    }

    private static string ToSnakeCase(string name)
    {
        var sb = new StringBuilder(name.Length + 8);
        for (int i = 0; i < name.Length; i++)
        {
            char c = name[i];
            if (char.IsUpper(c))
            {
                if (i > 0) sb.Append('_');
                sb.Append(char.ToLowerInvariant(c));
            }
            else sb.Append(c);
        }
        return sb.ToString();
    }
}
