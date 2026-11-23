using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;
using BiomassConnect.Backend.Services.Interfaces;
using BiomassConnect.Backend.Session;

namespace BiomassConnect.Backend.Controllers;

/// <summary>Power plant portal (uses IPowerPlantService). Every method requires a signed-in Power Plant.</summary>
public class PowerPlantController : ControllerBase
{
    private readonly IPowerPlantService _svc;

    public PowerPlantController(IPowerPlantService svc, CurrentUser session) : base(session) => _svc = svc;

    // GET /api/powerplant/marketplace/pellets?type=&grade=&maxPrice=&minCv=
    public Task<Result<List<PelletMarketItem>>> GetPelletMarketplace(string? pelletType = null, string? grade = null, decimal? maxPricePerTon = null, int? minCalorificValue = null) =>
        As(UserRole.PowerPlant, _ => _svc.GetPelletMarketplaceAsync(pelletType, grade, maxPricePerTon, minCalorificValue));

    // POST /api/powerplant/orders/purchase
    public Task<Result<OrderView>> PurchasePellets(long listingId, string deliveryAddress, string? notes = null) =>
        As(UserRole.PowerPlant, id => _svc.PurchasePelletsAsync(id, listingId, deliveryAddress, notes));

    // GET /api/powerplant/orders
    public Task<Result<List<OrderView>>> GetOrders() => As(UserRole.PowerPlant, id => _svc.GetOrdersAsync(id));

    // POST /api/powerplant/orders/{id}/pay
    public Task<Result<OrderView>> PayPelletOrder(string orderCode) =>
        As(UserRole.PowerPlant, id => WithOrder(orderCode, (kind, orderId) => kind == Codes.OrderKind.Pellet
            ? _svc.PayPelletOrderAsync(id, orderId)
            : Task.FromResult(Result.Blocked<OrderView>("Power plants pay pellet orders (PP-...) only"))));

    // POST /api/powerplant/feedback
    public Task<Result<FeedbackResult>> SubmitFeedback(string orderCode, DateOnly receivedDate, decimal quantityReceived,
        decimal moisturePct, decimal ashContentPct, int calorificValue, string? remarks = null) =>
        As(UserRole.PowerPlant, id => WithOrder(orderCode, (kind, orderId) => kind == Codes.OrderKind.Pellet
            ? _svc.SubmitFeedbackAsync(id, orderId, receivedDate, quantityReceived, moisturePct, ashContentPct, calorificValue, remarks)
            : Task.FromResult(Result.Blocked<FeedbackResult>("Batch feedback is recorded for pellet orders (PP-...) only"))));

    // GET /api/powerplant/consumption
    public Task<Result<List<ConsumptionLog>>> GetConsumption(string? unit = null) => As(UserRole.PowerPlant, id => _svc.GetConsumptionAsync(id, unit));

    // POST /api/powerplant/consumption
    public Task<Result<ConsumptionLog>> AddConsumption(DateOnly entryDate, string unit, decimal pelletsTons, decimal coalTons, decimal energyMwh, string? remarks = null) =>
        As(UserRole.PowerPlant, id => _svc.AddConsumptionAsync(id, entryDate, unit, pelletsTons, coalTons, energyMwh, remarks));

    // DELETE /api/powerplant/consumption/{id}
    public Task<Result<Unit>> DeleteConsumption(long entryId) => As(UserRole.PowerPlant, id => _svc.DeleteConsumptionAsync(id, entryId));

    // GET /api/powerplant/carbon-savings?from=&to=
    public Task<Result<CarbonReport>> GetCarbonSavings(DateOnly from, DateOnly to) => As(UserRole.PowerPlant, id => _svc.GetCarbonSavingsAsync(id, from, to));

    // GET /api/powerplant/certificates
    public Task<Result<List<CertificateView>>> GetCertificates() => As(UserRole.PowerPlant, id => _svc.GetCertificatesAsync(id));
}
