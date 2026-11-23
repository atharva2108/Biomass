using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;
using BiomassConnect.Backend.Services.Interfaces;
using BiomassConnect.Backend.Session;

namespace BiomassConnect.Backend.Controllers;

/// <summary>Manufacturer portal (uses IManufacturerService). Every method requires a signed-in Manufacturer.</summary>
public class ManufacturerController : ControllerBase
{
    private readonly IManufacturerService _svc;

    public ManufacturerController(IManufacturerService svc, CurrentUser session) : base(session) => _svc = svc;

    // GET /api/manufacturer/marketplace/biomass?type=&state=&maxPrice=&q=
    public Task<Result<List<BiomassListing>>> GetBiomassMarketplace(string? biomassType = null, string? state = null, decimal? maxPricePerTon = null, string? keyword = null) =>
        As(UserRole.Manufacturer, _ => _svc.GetBiomassMarketplaceAsync(biomassType, state, maxPricePerTon, keyword));

    // POST /api/manufacturer/orders/purchase
    public Task<Result<OrderView>> PurchaseBiomass(long listingId, string deliveryAddress, string? notes = null) =>
        As(UserRole.Manufacturer, id => _svc.PurchaseBiomassAsync(id, listingId, deliveryAddress, notes));

    // GET /api/manufacturer/orders/inbound
    public Task<Result<List<OrderView>>> GetInboundOrders(OrderStatus? status = null) =>
        As(UserRole.Manufacturer, id => _svc.GetInboundOrdersAsync(id, status));

    // POST /api/manufacturer/orders/{id}/pay
    public Task<Result<OrderView>> PayFarmerOrder(string orderCode) =>
        As(UserRole.Manufacturer, id => WithOrder(orderCode, (kind, orderId) => kind == Codes.OrderKind.Biomass
            ? _svc.PayFarmerOrderAsync(id, orderId)
            : Task.FromResult(Result.Blocked<OrderView>("Pellet orders (PP-...) are paid by the power plant"))));

    // GET /api/manufacturer/pellets
    public Task<Result<List<PelletListing>>> GetPelletListings(ListingStatus? status = null) =>
        As(UserRole.Manufacturer, id => _svc.GetPelletListingsAsync(id, status));

    // POST /api/manufacturer/pellets
    public Task<Result<PelletListing>> CreatePelletListing(PelletListing listing) =>
        As(UserRole.Manufacturer, id => _svc.CreatePelletListingAsync(id, listing));

    // PUT /api/manufacturer/pellets/{id}
    public Task<Result<PelletListing>> UpdatePelletListing(long listingId, PelletListing changes) =>
        As(UserRole.Manufacturer, id => _svc.UpdatePelletListingAsync(id, listingId, changes));

    // PATCH /api/manufacturer/pellets/{id}/status  (extra: pellet-management.js Activate / Deactivate)
    public Task<Result<PelletListing>> SetPelletListingStatus(long listingId, bool active) =>
        As(UserRole.Manufacturer, id => _svc.SetPelletListingStatusAsync(id, listingId, active));

    // DELETE /api/manufacturer/pellets/{id}
    public Task<Result<Unit>> DeletePelletListing(long listingId) =>
        As(UserRole.Manufacturer, id => _svc.DeletePelletListingAsync(id, listingId));

    // GET /api/manufacturer/orders/outbound
    public Task<Result<List<OrderView>>> GetOutboundOrders(OrderStatus? status = null) =>
        As(UserRole.Manufacturer, id => _svc.GetOutboundOrdersAsync(id, status));

    // GET /api/manufacturer/ratings
    public Task<Result<RatingSummary>> GetRatings() => As(UserRole.Manufacturer, id => _svc.GetRatingsAsync(id));
}
