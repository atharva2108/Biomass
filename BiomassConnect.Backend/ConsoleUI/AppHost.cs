using BiomassConnect.Backend.Controllers;
using BiomassConnect.Backend.Data;
using BiomassConnect.Backend.Services.Implementations;
using BiomassConnect.Backend.Session;

namespace BiomassConnect.Backend.ConsoleUI;

/// <summary>
/// Composition root: wires DbFactory -> services -> controllers by hand (the API phase will
/// register the same classes in ASP.NET Core DI). The console only ever uses the controllers
/// for business operations.
/// </summary>
public sealed class AppHost : IDisposable
{
    public DbFactory Db { get; }
    public CurrentUser Session { get; } = new();

    public AuthController Auth { get; }
    public FarmerController Farmer { get; }
    public ManufacturerController Manufacturer { get; }
    public PowerPlantController PowerPlant { get; }
    public LogisticsController Logistics { get; }
    public AdminController Admin { get; }
    public CommonController Common { get; }

    public AppHost(string connectionString)
    {
        Db = new DbFactory(connectionString);
        Auth = new AuthController(new AuthService(Db), Session);
        Farmer = new FarmerController(new FarmerService(Db), Session);
        Manufacturer = new ManufacturerController(new ManufacturerService(Db), Session);
        PowerPlant = new PowerPlantController(new PowerPlantService(Db), Session);
        Logistics = new LogisticsController(new LogisticsService(Db), Session);
        Admin = new AdminController(new AdminService(Db), Session);
        Common = new CommonController(new CommonService(Db), Session);
    }

    public void Dispose() => Db.Dispose();
}
