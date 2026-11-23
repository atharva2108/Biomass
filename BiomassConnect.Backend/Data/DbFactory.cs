using BiomassConnect.Backend.Models.Enums;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Npgsql.NameTranslation;

namespace BiomassConnect.Backend.Data;

/// <summary>
/// Creates a short-lived <see cref="BiomassDbContext"/> per operation (the same lifetime
/// a scoped DbContext will have per HTTP request in the API phase).
/// The PostgreSQL enums are mapped once on the shared data source.
/// </summary>
public sealed class DbFactory : IDisposable
{
    private readonly NpgsqlDataSource _dataSource;
    private readonly DbContextOptions<BiomassDbContext> _options;

    public DbFactory(string connectionString)
    {
        var builder = new NpgsqlDataSourceBuilder(connectionString);
        // Labels such as 'Sold Out' / 'farmer' come from [PgName] on each member;
        // the null translator keeps the C# names otherwise.
        var keep = new NpgsqlNullNameTranslator();
        builder.MapEnum<UserRole>("user_role", keep);
        builder.MapEnum<UserStatus>("user_status", keep);
        builder.MapEnum<VerificationStatus>("verification_status", keep);
        builder.MapEnum<DocumentType>("document_type", keep);
        builder.MapEnum<ListingStatus>("listing_status", keep);
        builder.MapEnum<OrderStatus>("order_status", keep);
        builder.MapEnum<PaymentStatus>("payment_status", keep);
        builder.MapEnum<ComplaintStatus>("complaint_status", keep);
        builder.MapEnum<NotificationType>("notification_type", keep);
        _dataSource = builder.Build();

        _options = new DbContextOptionsBuilder<BiomassDbContext>()
            .UseNpgsql(_dataSource)
            .Options;
    }

    public BiomassDbContext Create() => new(_options);

    public void Dispose() => _dataSource.Dispose();
}
