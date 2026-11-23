using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Enums;
using BiomassConnect.Backend.Services.Interfaces;
using BiomassConnect.Backend.Session;

namespace BiomassConnect.Backend.Controllers;

/// <summary>Authentication and account recovery (uses IAuthService).</summary>
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth, CurrentUser session) : base(session) => _auth = auth;

    // POST /api/auth/register
    public Task<Result<long>> Register(UserRole role, string name, string contactPerson, string email, string mobile,
        string password, string securityQuestion, string securityAnswer, string state, string pincode,
        string aadhaarOrGstin, string documentFileName, int documentSizeKb) =>
        _auth.RegisterAsync(role, name, contactPerson, email, mobile, password, securityQuestion, securityAnswer,
            state, pincode, aadhaarOrGstin, documentFileName, documentSizeKb);

    // POST /api/auth/login
    public async Task<Result<LoginResult>> Login(string identifier, string password)
    {
        var result = await _auth.LoginAsync(identifier, password);
        if (result.Success && result.Data is { } u)
            Session.SignIn(u.UserId, u.Name, u.Email, u.Role, u.Status);   // future: issue the JWT here
        return result;
    }

    // POST /api/auth/forgot-password/find
    public Task<Result<string>> FindAccountForReset(string identifier) => _auth.FindAccountForResetAsync(identifier);

    // POST /api/auth/forgot-password/reset
    public Task<Result<Unit>> ResetPassword(string identifier, string securityAnswer, string newPassword) =>
        _auth.ResetPasswordAsync(identifier, securityAnswer, newPassword);

    // GET /api/auth/current-user
    public Result<LoginResult> GetCurrentUser() =>
        Session.IsAuthenticated
            ? Result.Ok(new LoginResult(Session.UserId!.Value, Session.Name!, Session.Email!, Session.Role!.Value, Session.Status!.Value), Session.ToString())
            : Result.Info<LoginResult>("Not signed in");

    // POST /api/auth/logout  (extra: the frontend's logout(); with JWT this is client-side)
    public Result<Unit> Logout()
    {
        var who = Session.Name;
        Session.SignOut();
        return who is null ? Result.Info<Unit>("Not signed in") : Result.Ok(Unit.Value, $"{who} signed out");
    }
}
