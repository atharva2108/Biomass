namespace BiomassConnect.Backend.Models.Entities;

/// <summary>Table <c>platform_settings</c>: singleton row (settings_id = 1).</summary>
public class PlatformSettings
{
    public short SettingsId { get; set; } = 1;
    public string PlatformName { get; set; } = "Biomass Connect";
    public string SupportEmail { get; set; } = "support@biomassconnect.in";
    public string SupportPhone { get; set; } = "9876543210";
    public decimal CommissionPct { get; set; } = 2.5m;
    public decimal GstOnCommissionPct { get; set; } = 18m;
    public int MinOrderTons { get; set; } = 5;
    public int SessionTimeoutMin { get; set; } = 30;
    public int MaxLoginAttempts { get; set; } = 5;
    public int MaxUploadMb { get; set; } = 5;
    public bool NotifyRegistrations { get; set; } = true;
    public bool NotifyComplaints { get; set; } = true;
    public bool NotifyHighValue { get; set; } = true;
    public decimal HighValueThreshold { get; set; } = 1000000m;

    public PlatformSettings Clone() => (PlatformSettings)MemberwiseClone();
}
