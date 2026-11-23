namespace BiomassConnect.Backend.Models.Entities;

/// <summary>Table <c>consumption_logs</c>: daily pellet / coal use per boiler unit.</summary>
public class ConsumptionLog
{
    public long EntryId { get; set; }
    public long PowerPlantId { get; set; }
    public DateOnly EntryDate { get; set; }
    public string Unit { get; set; } = "";
    public decimal PelletsTons { get; set; }
    public decimal CoalTons { get; set; }
    /// <summary>GENERATED ALWAYS AS (round(pellets*100/(pellets+coal),2)) STORED. Read-only.</summary>
    public decimal CofiringRatioPct { get; private set; }
    public decimal EnergyMwh { get; set; }
    public string? Remarks { get; set; }

    public User? PowerPlant { get; set; }
}
