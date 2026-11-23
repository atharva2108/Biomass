using System.Globalization;
using System.Text.RegularExpressions;

namespace BiomassConnect.Backend.Common;

/// <summary>
/// Field rules and messages taken from the frontend (js/common/validation.js and the
/// data-rules on each form). Every method returns null when valid, otherwise the message.
/// </summary>
public static class Rules
{
    private static readonly Regex NameRe = new(@"^[A-Za-z][A-Za-z .'-]*$");
    private static readonly Regex AlphaRe = new(@"^[A-Za-z ]+$");
    private static readonly Regex EmailRe = new(@"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$");
    private static readonly Regex MobileRe = new(@"^[6-9]\d{9}$");
    private static readonly Regex PincodeRe = new(@"^[1-9]\d{5}$");
    private static readonly Regex GstRe = new(@"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$");
    private static readonly Regex PanRe = new(@"^[A-Z]{5}\d{4}[A-Z]$");
    private static readonly Regex AadhaarRe = new(@"^[2-9]\d{11}$");
    private static readonly Regex IfscRe = new(@"^[A-Z]{4}0[A-Z0-9]{6}$");
    private static readonly Regex AccountRe = new(@"^\d{9,18}$");
    private static readonly Regex UpiRe = new(@"^[\w.-]{2,256}@[A-Za-z]{2,64}$");
    private static readonly Regex VehicleRe = new(@"^[A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{0,3}[ -]?\d{4}$");

    /// <summary>Returns the first error, or null if every check passed.</summary>
    public static string? First(params string?[] errors) => errors.FirstOrDefault(e => e != null);

    public static string? Required(string? v, string label) =>
        string.IsNullOrWhiteSpace(v) ? $"{label} is required" : null;

    public static string? Select(string? v, string label, IEnumerable<string> allowed) =>
        string.IsNullOrWhiteSpace(v) ? $"Please select {label.ToLowerInvariant()}"
        : allowed.Contains(v) ? null : $"{label} '{v}' is not a valid option";

    public static string? Name(string? v, string label)
    {
        if (string.IsNullOrWhiteSpace(v)) return $"{label} is required";
        if (!NameRe.IsMatch(v)) return $"{label} can contain only letters, spaces, dots and hyphens";
        if (v.Count(char.IsLetter) < 2) return $"{label} must have at least 2 letters";
        if (v.Length > 60) return $"{label} must be at most 60 characters";
        if (Regex.IsMatch(v, @"\s{2,}")) return $"{label} cannot contain consecutive spaces";
        return null;
    }

    /// <summary>Free text: no &lt; or &gt;, with optional min / max length. Empty is allowed unless required.</summary>
    public static string? Text(string? v, string label, int min = 0, int max = int.MaxValue, bool required = false)
    {
        if (string.IsNullOrWhiteSpace(v)) return required ? $"{label} is required" : null;
        if (v.IndexOfAny(['<', '>']) >= 0) return $"{label} cannot contain < or > characters";
        if (v.Length < min) return $"{label} must be at least {min} characters";
        if (v.Length > max) return $"{label} must be at most {max} characters";
        return null;
    }

    public static string? Alpha(string? v, string label, int min, int max, bool required = true)
    {
        if (string.IsNullOrWhiteSpace(v)) return required ? $"{label} is required" : null;
        if (!AlphaRe.IsMatch(v)) return $"{label} can contain only letters and spaces";
        if (v.Length < min) return $"{label} must be at least {min} characters";
        if (v.Length > max) return $"{label} must be at most {max} characters";
        return null;
    }

    public static string? Email(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return "Email is required";
        if (!EmailRe.IsMatch(v)) return "Enter a valid email address (e.g. name@example.com)";
        if (v.Length > 100) return "Email must be at most 100 characters";
        if (v.Contains("..")) return "Email cannot contain consecutive dots";
        return null;
    }

    public static string? Mobile(string? v, bool required = true, string label = "Mobile number")
    {
        if (string.IsNullOrWhiteSpace(v)) return required ? $"{label} is required" : null;
        if (!v.All(char.IsAsciiDigit)) return $"{label} can contain only digits";
        if (v.Length != 10) return $"{label} must be exactly 10 digits";
        if (!MobileRe.IsMatch(v)) return $"{label} must start with 6, 7, 8 or 9";
        return null;
    }

    public static string? EmailOrMobile(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return "Email or mobile number is required";
        v = v.Trim();
        if (v.All(char.IsAsciiDigit)) return Mobile(v);
        return EmailRe.IsMatch(v) ? null : "Enter a valid email or 10-digit mobile number";
    }

    public static string? Password(string? v)
    {
        if (string.IsNullOrEmpty(v)) return "Password is required";
        if (v.Any(char.IsWhiteSpace)) return "Password cannot contain spaces";
        if (v.Length < 8) return "Password must be at least 8 characters";
        if (v.Length > 20) return "Password must be at most 20 characters";
        if (!v.Any(char.IsAsciiLetterUpper)) return "Password needs at least one uppercase letter";
        if (!v.Any(char.IsAsciiLetterLower)) return "Password needs at least one lowercase letter";
        if (!v.Any(char.IsAsciiDigit)) return "Password needs at least one number";
        if (v.All(char.IsAsciiLetterOrDigit)) return "Password needs at least one special character";
        return null;
    }

    public static string? Pincode(string? v) =>
        string.IsNullOrWhiteSpace(v) ? "PIN code is required" : PincodeRe.IsMatch(v) ? null : "Enter a valid 6-digit PIN code";

    public static string? Gstin(string? v) =>
        string.IsNullOrWhiteSpace(v) ? "GSTIN is required"
        : GstRe.IsMatch(v.ToUpperInvariant()) ? null : "Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5)";

    public static string? Aadhaar(string? v) =>
        string.IsNullOrWhiteSpace(v) ? "Aadhaar number is required"
        : AadhaarRe.IsMatch(v.Replace(" ", "")) ? null : "Enter a valid 12-digit Aadhaar number";

    public static string? Pan(string? v) =>
        string.IsNullOrWhiteSpace(v) ? null : PanRe.IsMatch(v.ToUpperInvariant()) ? null : "Enter a valid PAN (e.g. ABCDE1234F)";

    public static string? Ifsc(string? v) =>
        string.IsNullOrWhiteSpace(v) ? "IFSC code is required"
        : IfscRe.IsMatch(v.ToUpperInvariant()) ? null : "Enter a valid IFSC code (e.g. SBIN0001234)";

    public static string? Account(string? v) =>
        string.IsNullOrWhiteSpace(v) ? "Account number is required"
        : AccountRe.IsMatch(v) ? null : "Account number must be 9 to 18 digits";

    public static string? Upi(string? v) =>
        string.IsNullOrWhiteSpace(v) ? null
        : v.Length > 100 ? "UPI ID must be at most 100 characters"
        : UpiRe.IsMatch(v) ? null : "Enter a valid UPI ID (e.g. name@bank)";

    public static string? Vehicle(string? v) =>
        string.IsNullOrWhiteSpace(v) ? "Vehicle number is required"
        : v.Length > 13 ? "Vehicle number must be at most 13 characters"
        : VehicleRe.IsMatch(v.ToUpperInvariant()) ? null : "Enter a valid vehicle number (e.g. MH12AB1234)";

    /// <summary>Numeric range with a maximum number of decimal places (frontend: number|min|max|decimals).</summary>
    public static string? Range(decimal v, string label, decimal min, decimal max, int decimals = 2, bool exclusiveMin = false)
    {
        if (exclusiveMin ? v <= min : v < min)
            return exclusiveMin && min == 0 ? $"{label} must be greater than 0" : $"{label} must be at least {Fmt(min)}";
        if (v > max) return $"{label} cannot exceed {Fmt(max)}";
        if (decimal.Round(v, decimals) != v)
            return decimals == 0 ? $"{label} must be a whole number" : $"{label} can have at most {decimals} decimal places";
        return null;
    }

    public static string? NotPast(DateOnly d, string label) => d < Clock.Today ? $"{label} cannot be in the past" : null;
    public static string? NotFuture(DateOnly d, string label) => d > Clock.Today ? $"{label} cannot be in the future" : null;
    public static string? MinDate(DateOnly d, DateOnly min, string label) => d < min ? $"{label} cannot be before {Fmt(min)}" : null;
    public static string? MaxDate(DateOnly d, DateOnly max, string label) => d > max ? $"{label} cannot be after {Fmt(max)}" : null;

    /// <summary>File type and size check for the registration document (pdf/jpg/jpeg/png, ≤ 5 MB).</summary>
    public static string? Document(string? fileName, int sizeKb)
    {
        if (string.IsNullOrWhiteSpace(fileName)) return "Please upload the verification document";
        var ext = Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant();
        if (ext is not ("pdf" or "jpg" or "jpeg" or "png")) return "Only PDF, JPG, JPEG, PNG files are allowed";
        if (sizeKb <= 0) return "Document size must be greater than 0";
        if (sizeKb > 5120) return "File size must be at most 5 MB";
        return null;
    }

    public static string Fmt(decimal v) => v.ToString("0.##", CultureInfo.InvariantCulture);
    public static string Fmt(DateOnly d) => d.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);
}
