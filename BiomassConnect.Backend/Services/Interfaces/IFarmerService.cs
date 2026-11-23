using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.Services.Interfaces;

public interface IFarmerService
{
    Task<Result<FarmerDashboard>> GetDashboardAsync(long farmerId);
    Task<Result<List<BiomassListing>>> GetListingsAsync(long farmerId, ListingStatus? status = null);
    /// <param name="confirmDuplicate">The frontend asks "Create anyway?" for a duplicate; true = the farmer confirmed.</param>
    Task<Result<BiomassListing>> CreateListingAsync(long farmerId, BiomassListing input, bool confirmDuplicate = false);
    Task<Result<BiomassListing>> UpdateListingAsync(long farmerId, long listingId, BiomassListing changes);
    Task<Result<BiomassListing>> SetListingStatusAsync(long farmerId, long listingId, bool active);
    Task<Result<Unit>> DeleteListingAsync(long farmerId, long listingId);
    Task<Result<List<OrderView>>> GetOrdersAsync(long farmerId, DateOnly? from = null, DateOnly? to = null, string? keyword = null);
    Task<Result<OrderView>> GetOrderTrackingAsync(long farmerId, long orderId);
    Task<Result<PaymentsView>> GetPaymentsAsync(long farmerId);
    Task<Result<FarmerProfile>> GetProfileAsync(long farmerId);
    Task<Result<FarmerProfile>> UpdateProfileAsync(long farmerId, string name, string email, string mobile, FarmerProfile changes);
}
