namespace BiomassConnect.Backend.Common;

/// <summary>Today's date in local time (the frontend uses the browser's local date).</summary>
public static class Clock
{
    public static DateOnly Today => DateOnly.FromDateTime(DateTime.Now);
    public static DateTime UtcNow => DateTime.UtcNow;
}
