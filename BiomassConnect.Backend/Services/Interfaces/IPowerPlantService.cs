using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;

namespace BiomassConnect.Backend.Services.Interfaces;

public interface IPowerPlantService
{
    Task<Result<List<PelletMarketItem>>> GetPelletMarketplaceAsync(string? pelletType = null, string? grade = null, decimal? maxPricePerTon = null, int? minCalorificValue = null);
    Task<Result<OrderView>> PurchasePelletsAsync(long powerPlantId, long listingId, string deliveryAddress, string? notes);
    Task<Result<List<OrderView>>> GetOrdersAsync(long powerPlantId);
    Task<Result<OrderView>> PayPelletOrderAsync(long powerPlantId, long orderId);
    Task<Result<FeedbackResult>> SubmitFeedbackAsync(long powerPlantId, long orderId, DateOnly receivedDate, decimal quantityReceived,
        decimal moisturePct, decimal ashContentPct, int calorificValue, string? remarks);
    Task<Result<List<ConsumptionLog>>> GetConsumptionAsync(long powerPlantId, string? unit = null);
    Task<Result<ConsumptionLog>> AddConsumptionAsync(long powerPlantId, DateOnly entryDate, string unit, decimal pelletsTons,
        decimal coalTons, decimal energyMwh, string? remarks);
    Task<Result<Unit>> DeleteConsumptionAsync(long powerPlantId, long entryId);
    Task<Result<CarbonReport>> GetCarbonSavingsAsync(long powerPlantId, DateOnly from, DateOnly to);
    Task<Result<List<CertificateView>>> GetCertificatesAsync(long powerPlantId);
}
