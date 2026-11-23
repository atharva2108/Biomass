# Biomass Connect — Backend Console (Phase 1, revised)

The backend business logic for Biomass Connect, written in C# / .NET 8 with EF Core (Npgsql) and connected straight to the **existing** PostgreSQL schema (`biomass-connect-main/database/schema.sql`). It runs as a console app, **so no REST API is executed**. The existing system (frontend, `schema.sql`, ER diagrams) is untouched.

```
Console menu  ->  XxxController (plain class, no HTTP)  ->  IXxxService (all rules)  ->  BiomassDbContext  ->  PostgreSQL
                                                                                              (existing schema, unchanged)
```

## Run it

Requirements: .NET 8 SDK, and PostgreSQL with `schema.sql` loaded into a database. The connection string is in `appsettings.json`.

```powershell
cd D:\ILP\BiomassConnect.Backend
dotnet run                 # main menu
dotnet run -- --demo       # run the automated demo once (no pauses) and exit
dotnet run -- --clean      # remove all @demo.local data and exit
```

Main menu:

```
[1] Run Full Automated Demo     [3] Show Database Tables
[2] Interactive Menu (by role)  [4] Clean Demo Data       [0] Exit
```

On start-up, the app adds a single row only where one is missing (existing rows are used as they are):
- the `platform_settings` row (settings_id = 1);
- an **Admin** account `admin@gmail.com` / `Admin@123` and a **Logistics** account `logistics@gmail.com` / `Logistics@123`. These are the frontend's own built-in sign-ins from `js/auth/users.js`. Logistics accounts are never created through public registration, so the demo needs one.

## 2-minute demo script

1. **`dotnet run`, then `[1]`, answer `y` to pausing.** Each step prints the controller method it calls and `[OK]` / `[BLOCKED]` / `[INFO]`. Point out:
   - Step 1: three registrations come out **Pending**, and a duplicate email is **blocked**.
   - Step 4: the purchase is one transaction. The listing becomes **Sold Out**, the PO is **Placed**, and its **total comes from the database** (generated column). Editing the sold listing and paying before delivery are both **blocked**.
   - Step 5: the logistics state machine. Skipping `Placed -> In Transit`, an invalid RTO number and a repeated dispatch are all **blocked**.
   - Step 9: batch score **4.3** = avg(3.5, 5.0, 4.5), and the `manufacturer_ratings` view updates.
   - Step 10: co-firing % is **computed by PostgreSQL**. A ratio over 20% and over 210 MW × 24 h are **blocked**.
   - Step 11: CO₂ / coal / stubble / tree figures.
   - Steps 12–14: a complaint is raised and resolved, a certificate is issued, and the audit log shows every admin action.
   - Step 15: lockout after 3 failed logins.
2. **`[3]`, then `A`.** The same data, read straight from the PostgreSQL tables.
3. **`[2]`.** Run any single operation live, e.g. Auth → Quick login → Admin, then Admin → Dashboard.
4. **`[4]`.** Removes only `@demo.local` rows. The database is back to how it was.

## Project layout

| Folder | Contents |
|---|---|
| `Controllers/` | 7 plain controllers (no HTTP, no attributes). Each method carries a `// VERB /api/...` comment naming its future endpoint and calls exactly one service method. |
| `Services/Interfaces`, `Services/Implementations` | `IAuthService`, `IFarmerService`, `IManufacturerService`, `IPowerPlantService`, `ILogisticsService`, `IAdminService`, `ICommonService`. **All business rules and transactions live here.** |
| `Models/Entities`, `Models/Enums` | 17 tables + the `manufacturer_ratings` view; the 9 PostgreSQL enums (`[PgName]` holds the exact DB label, e.g. `'Sold Out'`). |
| `Models/ReadModels.cs` | Read-only shapes for screens that join several tables (dashboards, order views). Not request/response DTOs, which are deferred. |
| `Data/` | `BiomassDbContext` (mapping only: no migrations, no `EnsureCreated`), `DbFactory` (one short-lived context per operation; enums mapped on the data source). |
| `Common/` | `Result<T>`, field rules copied from `js/common/validation.js`, option lists from the forms, ID display codes (`BL-`, `PL-`, `PO-B`, `PP-`, `CMP-`). |
| `Session/CurrentUser.cs` | In-memory signed-in user, the stand-in for JWT claims. |
| `ConsoleUI/` | Main menu helpers, automated demo, interactive menu, table viewer, demo bootstrap and clean-up. Business operations go only through controllers. The table viewer and clean-up are tooling and read or delete through the DbContext directly. |

## Database rules respected

- No `ALTER`, migrations or new objects. Entities mirror `schema.sql` column for column.
- `total_amount` and `cofiring_ratio_pct` are mapped as **generated** (`HasComputedColumnSql`). EF never writes them and reads them back after `INSERT` / `UPDATE`.
- Every PostgreSQL `CHECK` / `UNIQUE` / FK the services might still hit is caught and reported as `[BLOCKED]`; it never crashes the console.
- The whole-listing purchase locks the listing row (`SELECT ... FOR UPDATE`) inside a transaction, so two buyers can never buy the same listing.

## Where the frontend and the blueprint disagree (frontend followed)

| Topic | Blueprint | Frontend (implemented) |
|---|---|---|
| Duplicate listing | "blocked" | Same **type** + same **pickup point** (case-insensitive) is refused unless the farmer confirms "Create anyway" (`confirmDuplicate: true`). |
| Complaints | "Delivered orders only" | Farmers and power plants: delivered orders only. Manufacturers: any of their orders (`manufacturer/billing.js` lists all). A second **open** complaint with the same order and category is refused. Description 20–500 characters. Categories are per role (`store.js`). |
| Login lockout | 3 attempts / 30 s | Same. `platform_settings.max_login_attempts` (default 5) is **not** used, because the frontend hard-codes 3. Kept in memory per identifier (no column for it). |
| Extra rules not in the blueprint | — | Co-firing ratio ≤ 20%. Daily energy ≤ unit MW × 24. Premium grade: moisture ≤ 10%, ash ≤ 8%, CV ≥ 4000. Password 8–20 characters with upper, lower, digit and symbol. A reset password must be new. 3 security-answer attempts. Blocked accounts cannot reset. Pickup ≤ today+30, expected delivery ≤ today+60. |
| Batch score | "1.0 – 5.0" | `store.js` formula: moisture/ash lose 1 point per % above declared, CV loses 1 per 100 kcal/kg below; each part clamped to 1–5; score = average, 1 decimal. |
| KYC review | approve / reject | Approve makes the user **Active** and reject makes them **Rejected**, except a **Blocked** user stays Blocked (`verification.js`). Unblock restores the previous status. |
| Notifications | list / mark read | The frontend only shows fixed sample notifications and never creates any, so the backend reads them and marks them read but does not generate them. |
| Audit log | every admin action | Admin actions only (as `admin-common.js`). Entries name the affected account's email, so demo clean-up can remove demo entries. |

**Three methods were added beyond the blueprint's 58**, because the frontend has these actions: `AuthController.Logout`, `ManufacturerController.SetPelletListingStatus` (activate / deactivate a pellet listing) and `LogisticsController.UpdateShipmentDetails` (edit vehicle, driver and dates while Pickup Scheduled or In Transit; the pickup date is fixed once In Transit).

## Endpoint → controller → service mapping (61 = 58 blueprint + 3 extras)

| # | Future endpoint (not executed) | Controller method | Service method |
|---|---|---|---|
| 1 | `POST /api/auth/register` | `AuthController.Register` | `IAuthService.RegisterAsync` |
| 2 | `POST /api/auth/login` | `AuthController.Login` | `IAuthService.LoginAsync` |
| 3 | `POST /api/auth/forgot-password/find` | `AuthController.FindAccountForReset` | `IAuthService.FindAccountForResetAsync` |
| 4 | `POST /api/auth/forgot-password/reset` | `AuthController.ResetPassword` | `IAuthService.ResetPasswordAsync` |
| 5 | `GET /api/auth/current-user` | `AuthController.GetCurrentUser` | `CurrentUser (in-memory session)` |
| 6 | `POST /api/auth/logout` **(extra)** | `AuthController.Logout` | `CurrentUser (in-memory session)` |
| 7 | `GET /api/farmer/dashboard` | `FarmerController.GetDashboard` | `IFarmerService.GetDashboardAsync` |
| 8 | `GET /api/farmer/listings` | `FarmerController.GetListings` | `IFarmerService.GetListingsAsync` |
| 9 | `POST /api/farmer/listings` | `FarmerController.CreateListing` | `IFarmerService.CreateListingAsync` |
| 10 | `PUT /api/farmer/listings/{id}` | `FarmerController.UpdateListing` | `IFarmerService.UpdateListingAsync` |
| 11 | `PATCH /api/farmer/listings/{id}/status` | `FarmerController.SetListingStatus` | `IFarmerService.SetListingStatusAsync` |
| 12 | `DELETE /api/farmer/listings/{id}` | `FarmerController.DeleteListing` | `IFarmerService.DeleteListingAsync` |
| 13 | `GET /api/farmer/orders?from=&to=&q=` | `FarmerController.GetOrders` | `IFarmerService.GetOrdersAsync` |
| 14 | `GET /api/farmer/orders/{id}/tracking` | `FarmerController.GetOrderTracking` | `IFarmerService.GetOrderTrackingAsync` |
| 15 | `GET /api/farmer/payments` | `FarmerController.GetPayments` | `IFarmerService.GetPaymentsAsync` |
| 16 | `GET /api/farmer/profile` | `FarmerController.GetProfile` | `IFarmerService.GetProfileAsync` |
| 17 | `PUT /api/farmer/profile` | `FarmerController.UpdateProfile` | `IFarmerService.UpdateProfileAsync` |
| 18 | `GET /api/manufacturer/marketplace/biomass?type=&state=&maxPrice=&q=` | `ManufacturerController.GetBiomassMarketplace` | `IManufacturerService.GetBiomassMarketplaceAsync` |
| 19 | `POST /api/manufacturer/orders/purchase` | `ManufacturerController.PurchaseBiomass` | `IManufacturerService.PurchaseBiomassAsync` |
| 20 | `GET /api/manufacturer/orders/inbound` | `ManufacturerController.GetInboundOrders` | `IManufacturerService.GetInboundOrdersAsync` |
| 21 | `POST /api/manufacturer/orders/{id}/pay` | `ManufacturerController.PayFarmerOrder` | `IManufacturerService.PayFarmerOrderAsync` |
| 22 | `GET /api/manufacturer/pellets` | `ManufacturerController.GetPelletListings` | `IManufacturerService.GetPelletListingsAsync` |
| 23 | `POST /api/manufacturer/pellets` | `ManufacturerController.CreatePelletListing` | `IManufacturerService.CreatePelletListingAsync` |
| 24 | `PUT /api/manufacturer/pellets/{id}` | `ManufacturerController.UpdatePelletListing` | `IManufacturerService.UpdatePelletListingAsync` |
| 25 | `PATCH /api/manufacturer/pellets/{id}/status` **(extra)** | `ManufacturerController.SetPelletListingStatus` | `IManufacturerService.SetPelletListingStatusAsync` |
| 26 | `DELETE /api/manufacturer/pellets/{id}` | `ManufacturerController.DeletePelletListing` | `IManufacturerService.DeletePelletListingAsync` |
| 27 | `GET /api/manufacturer/orders/outbound` | `ManufacturerController.GetOutboundOrders` | `IManufacturerService.GetOutboundOrdersAsync` |
| 28 | `GET /api/manufacturer/ratings` | `ManufacturerController.GetRatings` | `IManufacturerService.GetRatingsAsync` |
| 29 | `GET /api/powerplant/marketplace/pellets?type=&grade=&maxPrice=&minCv=` | `PowerPlantController.GetPelletMarketplace` | `IPowerPlantService.GetPelletMarketplaceAsync` |
| 30 | `POST /api/powerplant/orders/purchase` | `PowerPlantController.PurchasePellets` | `IPowerPlantService.PurchasePelletsAsync` |
| 31 | `GET /api/powerplant/orders` | `PowerPlantController.GetOrders` | `IPowerPlantService.GetOrdersAsync` |
| 32 | `POST /api/powerplant/orders/{id}/pay` | `PowerPlantController.PayPelletOrder` | `IPowerPlantService.PayPelletOrderAsync` |
| 33 | `POST /api/powerplant/feedback` | `PowerPlantController.SubmitFeedback` | `IPowerPlantService.SubmitFeedbackAsync` |
| 34 | `GET /api/powerplant/consumption` | `PowerPlantController.GetConsumption` | `IPowerPlantService.GetConsumptionAsync` |
| 35 | `POST /api/powerplant/consumption` | `PowerPlantController.AddConsumption` | `IPowerPlantService.AddConsumptionAsync` |
| 36 | `DELETE /api/powerplant/consumption/{id}` | `PowerPlantController.DeleteConsumption` | `IPowerPlantService.DeleteConsumptionAsync` |
| 37 | `GET /api/powerplant/carbon-savings?from=&to=` | `PowerPlantController.GetCarbonSavings` | `IPowerPlantService.GetCarbonSavingsAsync` |
| 38 | `GET /api/powerplant/certificates` | `PowerPlantController.GetCertificates` | `IPowerPlantService.GetCertificatesAsync` |
| 39 | `GET /api/logistics/shipments?status=&type=&q=` | `LogisticsController.GetShipments` | `ILogisticsService.GetShipmentsAsync` |
| 40 | `POST /api/logistics/shipments/{orderId}/schedule` | `LogisticsController.SchedulePickup` | `ILogisticsService.SchedulePickupAsync` |
| 41 | `PUT /api/logistics/shipments/{orderId}` **(extra)** | `LogisticsController.UpdateShipmentDetails` | `ILogisticsService.UpdateShipmentDetailsAsync` |
| 42 | `POST /api/logistics/shipments/{orderId}/dispatch` | `LogisticsController.MarkDispatched` | `ILogisticsService.MarkDispatchedAsync` |
| 43 | `POST /api/logistics/shipments/{orderId}/deliver` | `LogisticsController.MarkDelivered` | `ILogisticsService.MarkDeliveredAsync` |
| 44 | `GET /api/admin/dashboard` | `AdminController.GetDashboard` | `IAdminService.GetDashboardAsync` |
| 45 | `GET /api/admin/users?role=&status=&q=` | `AdminController.GetUsers` | `IAdminService.GetUsersAsync` |
| 46 | `POST /api/admin/users/{id}/block` | `AdminController.BlockUser` | `IAdminService.BlockUserAsync` |
| 47 | `POST /api/admin/users/{id}/unblock` | `AdminController.UnblockUser` | `IAdminService.UnblockUserAsync` |
| 48 | `GET /api/admin/verifications?status=&role=` | `AdminController.GetVerifications` | `IAdminService.GetVerificationsAsync` |
| 49 | `POST /api/admin/verifications/{id}/review` | `AdminController.ReviewVerification` | `IAdminService.ReviewVerificationAsync` |
| 50 | `GET /api/admin/orders?type=&status=&from=&to=&q=` | `AdminController.GetOrders` | `IAdminService.GetOrdersAsync` |
| 51 | `GET /api/admin/disputes?status=&category=` | `AdminController.GetDisputes` | `IAdminService.GetDisputesAsync` |
| 52 | `POST /api/admin/disputes/{id}/resolve` | `AdminController.ResolveDispute` | `IAdminService.ResolveDisputeAsync` |
| 53 | `GET /api/admin/audit-logs?page=&pageSize=&module=&role=&from=&to=&q=` | `AdminController.GetAuditLogs` | `IAdminService.GetAuditLogsAsync` |
| 54 | `POST /api/admin/certificates/issue` | `AdminController.IssueCertificate` | `IAdminService.IssueCertificateAsync` |
| 55 | `GET /api/admin/reports` | `AdminController.GetReports` | `IAdminService.GetReportsAsync` |
| 56 | `GET /api/admin/settings` | `AdminController.GetSettings` | `IAdminService.GetSettingsAsync` |
| 57 | `PUT /api/admin/settings` | `AdminController.UpdateSettings` | `IAdminService.UpdateSettingsAsync` |
| 58 | `POST /api/complaints` | `CommonController.SubmitComplaint` | `ICommonService.SubmitComplaintAsync` |
| 59 | `GET /api/notifications` | `CommonController.GetNotifications` | `ICommonService.GetNotificationsAsync` |
| 60 | `PATCH /api/notifications/read` | `CommonController.MarkNotificationsRead` | `ICommonService.MarkNotificationsReadAsync` |
| 61 | `POST /api/contact` | `CommonController.SubmitContactMessage` | `ICommonService.SubmitContactMessageAsync` |

## Moving to the API phase (additive)

1. Add the ASP.NET Core packages and switch `Program.cs` to a web host. Register the same services, and `BiomassDbContext` as scoped, in DI.
2. Add `[ApiController]` / `[Route]` to the existing controllers. The route is already written above each method. Return `Result<T>` as JSON.
3. Add request/response DTOs (and a repository layer if wanted).
4. Replace `CurrentUser` with JWT claims and `ControllerBase.As(role, ...)` with `[Authorize(Roles = ...)]`. Move the in-memory login lockout to a distributed store.
5. Frontend: replace the `localStorage` calls with `fetch()` and serve the static files from `wwwroot`.
