using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Enums;

namespace BiomassConnect.Backend.Services.Interfaces;

public interface IAuthService
{
    /// <summary>Registers a farmer, manufacturer or power plant: user (Pending) + role profile + KYC document, in one transaction.</summary>
    Task<Result<long>> RegisterAsync(UserRole role, string name, string contactPerson, string email, string mobile,
        string password, string securityQuestion, string securityAnswer, string state, string pincode,
        string aadhaarOrGstin, string documentFileName, int documentSizeKb);

    Task<Result<LoginResult>> LoginAsync(string identifier, string password);
    Task<Result<string>> FindAccountForResetAsync(string identifier);
    Task<Result<Unit>> ResetPasswordAsync(string identifier, string securityAnswer, string newPassword);
}
