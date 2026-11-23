using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;
using BiomassConnect.Backend.Services.Interfaces;
using BiomassConnect.Backend.Session;

namespace BiomassConnect.Backend.Controllers;

/// <summary>Farmer portal (uses IFarmerService). Every method requires a signed-in Farmer.</summary>
public class FarmerController : ControllerBase
{
    private readonly IFarmerService _svc;

    public FarmerController(IFarmerService svc, CurrentUser session) : base(session) => _svc = svc;

    // GET /api/farmer/dashboard
    public Task<Result<FarmerDashboard>> GetDashboard() => As(UserRole.Farmer, id => _svc.GetDashboardAsync(id));

    // GET /api/farmer/listings
    public Task<Result<List<BiomassListing>>> GetListings(ListingStatus? status = null) => As(UserRole.Farmer, id => _svc.GetListingsAsync(id, status));

    // POST /api/farmer/listings
    public Task<Result<BiomassListing>> CreateListing(BiomassListing listing, bool confirmDuplicate = false) =>
        As(UserRole.Farmer, id => _svc.CreateListingAsync(id, listing, confirmDuplicate));

    // PUT /api/farmer/listings/{id}
    public Task<Result<BiomassListing>> UpdateListing(long listingId, BiomassListing changes) =>
        As(UserRole.Farmer, id => _svc.UpdateListingAsync(id, listingId, changes));

    // PATCH /api/farmer/listings/{id}/status
    public Task<Result<BiomassListing>> SetListingStatus(long listingId, bool active) =>
        As(UserRole.Farmer, id => _svc.SetListingStatusAsync(id, listingId, active));

    // DELETE /api/farmer/listings/{id}
    public Task<Result<Unit>> DeleteListing(long listingId) => As(UserRole.Farmer, id => _svc.DeleteListingAsync(id, listingId));

    // GET /api/farmer/orders?from=&to=&q=
    public Task<Result<List<OrderView>>> GetOrders(DateOnly? from = null, DateOnly? to = null, string? keyword = null) =>
        As(UserRole.Farmer, id => _svc.GetOrdersAsync(id, from, to, keyword));

    // GET /api/farmer/orders/{id}/tracking
    public Task<Result<OrderView>> GetOrderTracking(string orderCode) =>
        As(UserRole.Farmer, id => WithOrder(orderCode, (kind, orderId) => kind == Codes.OrderKind.Biomass
            ? _svc.GetOrderTrackingAsync(id, orderId)
            : Task.FromResult(Result.Blocked<OrderView>("Farmers receive biomass purchase orders (PO-B...) only"))));

    // GET /api/farmer/payments
    public Task<Result<PaymentsView>> GetPayments() => As(UserRole.Farmer, id => _svc.GetPaymentsAsync(id));

    // GET /api/farmer/profile
    public Task<Result<FarmerProfile>> GetProfile() => As(UserRole.Farmer, id => _svc.GetProfileAsync(id));

    // PUT /api/farmer/profile
    public Task<Result<FarmerProfile>> UpdateProfile(string name, string email, string mobile, FarmerProfile profile) =>
        As(UserRole.Farmer, id => _svc.UpdateProfileAsync(id, name, email, mobile, profile));
}
