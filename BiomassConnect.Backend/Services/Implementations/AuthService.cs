using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using BiomassConnect.Backend.Common;
using BiomassConnect.Backend.Data;
using BiomassConnect.Backend.Models;
using BiomassConnect.Backend.Models.Entities;
using BiomassConnect.Backend.Models.Enums;
using BiomassConnect.Backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BiomassConnect.Backend.Services.Implementations;

/// <summary>
/// Registration, login and password recovery (auth/*.js).
/// The users table has no failed-attempt column and the schema must not change, so the
/// 3-attempt / 30-second lockout and the 3 security-answer attempts are kept in memory,
/// exactly as the frontend does.
/// </summary>
public class AuthService : ServiceBase, IAuthService
{
    public const int MaxLoginAttempts = 3;                                      // js/auth/auth.js MAX_ATTEMPTS
    public static readonly TimeSpan LockDuration = TimeSpan.FromSeconds(30);    // LOCK_SECONDS
    public const int MaxAnswerAttempts = 3;                                     // js/auth/forgot-password.js

    private sealed class Attempts { public int Failed; public DateTime? LockedUntil; }

    private readonly ConcurrentDictionary<string, Attempts> _login = new();
    private readonly ConcurrentDictionary<long, int> _resetAnswers = new();

    public AuthService(DbFactory db) : base(db) { }

    // ------------------------------------------------------------------ Register

    public Task<Result<long>> RegisterAsync(UserRole role, string name, string contactPerson, string email, string mobile,
        string password, string securityQuestion, string securityAnswer, string state, string pincode,
        string aadhaarOrGstin, string documentFileName, int documentSizeKb) => Guard(async () =>
    {
        if (role is not (UserRole.Farmer or UserRole.Manufacturer or UserRole.PowerPlant))
            return Result.Blocked<long>("Only Farmer, Manufacturer and Power Plant accounts can register.");

        bool isFarmer = role == UserRole.Farmer;
        name = Regex.Replace((name ?? "").Trim(), @"\s+", " ");
        contactPerson = Regex.Replace((contactPerson ?? "").Trim(), @"\s+", " ");
        email = (email ?? "").Trim().ToLowerInvariant();
        mobile = (mobile ?? "").Trim();
        securityAnswer = (securityAnswer ?? "").Trim().ToLowerInvariant();
        pincode = (pincode ?? "").Trim();
        var idNumber = isFarmer ? (aadhaarOrGstin ?? "").Replace(" ", "") : (aadhaarOrGstin ?? "").Trim().ToUpperInvariant();
        string orgLabel = role == UserRole.PowerPlant ? "Power Plant Name" : "Company name";

        // auth/register.html data-rules
        var error = Rules.First(
            isFarmer ? Rules.Name(name, "Full name") : Rules.Name(contactPerson, "Full name"),
            isFarmer ? null : Rules.Text(name, orgLabel, 2, 100, required: true),
            Rules.Mobile(mobile),
            Rules.Email(email),
            isFarmer ? Rules.Aadhaar(idNumber) : Rules.Gstin(idNumber),
            Rules.Select(state, "State", Catalog.IndianStates),
            Rules.Pincode(pincode),
            Rules.Password(password),
            Rules.Select(securityQuestion, "Security question", Catalog.SecurityQuestions),
            Rules.Text(securityAnswer, "Security answer", 2, 50, required: true),
            Rules.Document(documentFileName, documentSizeKb));
        if (error != null) return Result.Blocked<long>(error);

        await using var db = Db.Create();

        if (await db.Users.AnyAsync(u => u.Email == email))
            return Result.Blocked<long>("An account with this email already exists");
        if (await db.Users.AnyAsync(u => u.Mobile == mobile))
            return Result.Blocked<long>("An account with this mobile number already exists");
        if (!isFarmer && (await db.ManufacturerProfiles.AnyAsync(p => p.Gstin == idNumber) || await db.PowerPlantProfiles.AnyAsync(p => p.Gstin == idNumber)))
            return Result.Blocked<long>("An account with this GSTIN already exists");

        var today = Clock.Today;
        var user = new User
        {
            Name = name,
            Email = email,
            Mobile = mobile,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = role,
            Status = UserStatus.Pending,                       // every new account starts Pending
            SecurityQuestion = securityQuestion,
            SecurityAnswerHash = BCrypt.Net.BCrypt.HashPassword(securityAnswer),
            RegisteredOn = today
        };

        switch (role)
        {
            case UserRole.Farmer:
                user.FarmerProfile = new FarmerProfile { State = state, Pincode = pincode, AadhaarLast4 = idNumber[^4..] };
                break;
            case UserRole.Manufacturer:
                user.ManufacturerProfile = new ManufacturerProfile { ContactPerson = contactPerson, Gstin = idNumber, State = state, Pincode = pincode };
                break;
            case UserRole.PowerPlant:
                user.PowerPlantProfile = new PowerPlantProfile { ContactPerson = contactPerson, Gstin = idNumber, State = state, Pincode = pincode };
                break;
        }

        user.VerificationDocument = new VerificationDocument
        {
            DocType = isFarmer ? DocumentType.AadhaarCard : DocumentType.GstCertificate,
            DocNumber = isFarmer ? "XXXX XXXX " + idNumber[^4..] : idNumber,     // Aadhaar is stored masked
            DocFile = documentFileName.Trim(),                                     // file name / path only (upload deferred)
            DocSizeKb = documentSizeKb,
            SubmittedOn = today,
            Status = VerificationStatus.Pending
        };

        db.Users.Add(user);            // user + profile + document: one SaveChanges = one transaction
        await db.SaveChangesAsync();

        return Result.Ok(user.UserId,
            $"Account created for {user.Name} ({role.Label()}) | Status: Pending | {user.VerificationDocument.DocType.Label()} submitted for verification.");
    });

    // ------------------------------------------------------------------ Login

    public async Task<Result<LoginResult>> LoginAsync(string identifier, string password)
    {
        var key = (identifier ?? "").Trim().ToLowerInvariant();
        var error = Rules.First(Rules.EmailOrMobile(key), string.IsNullOrEmpty(password) ? "Password is required" : null);
        if (error != null) return Result.Blocked<LoginResult>(error);

        var state = _login.GetOrAdd(key, _ => new Attempts());
        lock (state)
        {
            if (state.LockedUntil is { } until)
            {
                var left = until - DateTime.UtcNow;
                if (left > TimeSpan.Zero)
                    return Result.Blocked<LoginResult>(
                        $"Login temporarily locked after {MaxLoginAttempts} failed attempts. Try again in {Math.Ceiling(left.TotalSeconds)}s or reset your password.");
                state.LockedUntil = null;
                state.Failed = 0;
            }
        }

        await using var db = Db.Create();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == key || u.Mobile == key);

        if (user is null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
        {
            lock (state)
            {
                state.Failed++;
                int left = MaxLoginAttempts - state.Failed;
                if (left <= 0)
                {
                    state.LockedUntil = DateTime.UtcNow + LockDuration;
                    return Result.Blocked<LoginResult>(
                        $"Too many failed attempts. Login locked for {LockDuration.TotalSeconds:0} seconds. Please wait or reset your password.");
                }
                return Result.Blocked<LoginResult>($"Invalid email/mobile or password. {left} attempt{(left == 1 ? "" : "s")} left.");
            }
        }

        // Same order as the frontend: credentials first, then account status. Pending accounts may sign in.
        if (user.Status == UserStatus.Blocked)
            return Result.Blocked<LoginResult>("Your account has been blocked by the administrator. Please contact support.");
        if (user.Status == UserStatus.Rejected)
            return Result.Blocked<LoginResult>("Your registration was rejected. Please contact support or register again.");

        lock (state) { state.Failed = 0; state.LockedUntil = null; }

        var message = user.Status == UserStatus.Pending
            ? $"Welcome, {user.Name}! Your documents are pending admin verification."
            : $"Welcome back, {user.Name}! ({user.Role.Label()})";
        return Result.Ok(new LoginResult(user.UserId, user.Name, user.Email, user.Role, user.Status), message);
    }

    // ------------------------------------------------------------------ Forgot password

    public async Task<Result<string>> FindAccountForResetAsync(string identifier)
    {
        var key = (identifier ?? "").Trim().ToLowerInvariant();
        var error = Rules.EmailOrMobile(key);
        if (error != null) return Result.Blocked<string>(error);

        await using var db = Db.Create();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == key || u.Mobile == key);
        if (user is null) return Result.Blocked<string>("No account is registered with this email or mobile number.");
        if (user.Status == UserStatus.Blocked) return Result.Blocked<string>("This account is blocked. Please contact support to reset your password.");
        if (string.IsNullOrWhiteSpace(user.SecurityQuestion)) return Result.Blocked<string>("No security question is set for this account. Please contact support.");

        _resetAnswers[user.UserId] = 0;      // step 1 done: answer attempts start now
        return Result.Ok(user.SecurityQuestion, $"Account found. Security question: {user.SecurityQuestion}");
    }

    public Task<Result<Unit>> ResetPasswordAsync(string identifier, string securityAnswer, string newPassword) => Guard(async () =>
    {
        var key = (identifier ?? "").Trim().ToLowerInvariant();
        await using var db = Db.Create();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == key || u.Mobile == key);
        if (user is null) return Result.Blocked<Unit>("No account is registered with this email or mobile number.");
        if (user.Status == UserStatus.Blocked) return Result.Blocked<Unit>("This account is blocked. Please contact support to reset your password.");
        if (!_resetAnswers.TryGetValue(user.UserId, out var used))
            return Result.Blocked<Unit>("Find your account first (step 1) to get the security question.");

        var answer = (securityAnswer ?? "").Trim().ToLowerInvariant();
        var error = Rules.First(Rules.Text(answer, "Security answer", 2, 50, required: true), Rules.Password(newPassword));
        if (error != null) return Result.Blocked<Unit>(error);

        if (!BCrypt.Net.BCrypt.Verify(answer, user.SecurityAnswerHash))
        {
            used++;
            int left = MaxAnswerAttempts - used;
            if (left <= 0)
            {
                _resetAnswers.TryRemove(user.UserId, out _);
                return Result.Blocked<Unit>("Too many incorrect answers. Please start again or contact support.");
            }
            _resetAnswers[user.UserId] = used;
            return Result.Blocked<Unit>($"Security answer is incorrect. {left} attempt{(left == 1 ? "" : "s")} left.");
        }

        if (BCrypt.Net.BCrypt.Verify(newPassword, user.PasswordHash))
            return Result.Blocked<Unit>("New password must be different from your current password.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        await db.SaveChangesAsync();
        _resetAnswers.TryRemove(user.UserId, out _);
        _login.TryRemove(user.Email, out _);
        _login.TryRemove(user.Mobile, out _);
        return Result.Ok(Unit.Value, "Password reset successful. Please sign in with your new password.");
    });
}
