using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.Services.Interfaces;

public interface IManufacturerService
{
    Task<Result<List<BiomassListing>>> GetBiomassMarketplaceAsync(string? biomassType = null, string? state = null, decimal? maxPricePerTon = null, string? keyword = null);
    Task<Result<OrderView>> PurchaseBiomassAsync(long manufacturerId, long listingId, string deliveryAddress, string? notes);
    Task<Result<List<OrderView>>> GetInboundOrdersAsync(long manufacturerId, OrderStatus? status = null);
    Task<Result<OrderView>> PayFarmerOrderAsync(long manufacturerId, long orderId);
    Task<Result<List<PelletListing>>> GetPelletListingsAsync(long manufacturerId, ListingStatus? status = null);
    Task<Result<PelletListing>> CreatePelletListingAsync(long manufacturerId, PelletListing input);
    Task<Result<PelletListing>> UpdatePelletListingAsync(long manufacturerId, long listingId, PelletListing changes);
    Task<Result<PelletListing>> SetPelletListingStatusAsync(long manufacturerId, long listingId, bool active);
    Task<Result<Unit>> DeletePelletListingAsync(long manufacturerId, long listingId);
    Task<Result<List<OrderView>>> GetOutboundOrdersAsync(long manufacturerId, OrderStatus? status = null);
    Task<Result<RatingSummary>> GetRatingsAsync(long manufacturerId);
}
