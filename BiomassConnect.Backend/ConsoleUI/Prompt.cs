using System.Globalization;

namespace BiomassConnect.Backend.ConsoleUI;

/// <summary>Reads typed input for the interactive menu. Press Enter to keep a shown default.</summary>
public static class Prompt
{
    public static string Text(string label, string? current = null)
    {
        Console.Write(current is null ? $"  {label}: " : $"  {label} [{current}]: ");
        // null = input stream closed (e.g. piped input ran out): stop instead of looping forever.
        var line = Console.ReadLine() ?? throw new EndOfStreamException("Console input ended");
        var v = line.Trim().TrimStart('﻿').Trim();     // a BOM can precede piped input
        return v == "" && current is not null ? current : v;
    }

    public static string? Optional(string label, string? current = null)
    {
        var v = Text(label + " (optional, '-' to clear)", current ?? "");
        return v is "" or "-" ? null : v;
    }

    public static decimal Decimal(string label, decimal? current = null)
    {
        while (true)
        {
            var v = Text(label, current?.ToString(CultureInfo.InvariantCulture));
            if (decimal.TryParse(v, NumberStyles.Number, CultureInfo.InvariantCulture, out var d)) return d;
            Out.Blocked($"{label} must be a valid number");
        }
    }

    public static decimal? OptionalDecimal(string label)
    {
        var v = Text(label + " (Enter to skip)", "");
        return decimal.TryParse(v, NumberStyles.Number, CultureInfo.InvariantCulture, out var d) ? d : null;
    }

    public static int Int(string label, int? current = null)
    {
        while (true)
        {
            var v = Text(label, current?.ToString(CultureInfo.InvariantCulture));
            if (int.TryParse(v, out var i)) return i;
            Out.Blocked($"{label} must be a whole number");
        }
    }

    public static long Id(string label)
    {
        while (true)
        {
            var v = Text(label);
            if (Common.Codes.TryParseId(v, out var id)) return id;
            Out.Blocked("Enter a number (e.g. 3) or a code (e.g. BL-0003)");
        }
    }

    /// <summary>Accepts YYYY-MM-DD, 'today', or an offset in days such as +1 / -7.</summary>
    public static DateOnly Date(string label, DateOnly? current = null)
    {
        while (true)
        {
            var v = Text(label + " (YYYY-MM-DD, today, +N/-N days)", current?.ToString("yyyy-MM-dd"));
            if (TryDate(v, out var d)) return d;
            Out.Blocked("Enter a date as YYYY-MM-DD, 'today', or +N / -N days");
        }
    }

    public static DateOnly? OptionalDate(string label)
    {
        var v = Text(label + " (Enter to skip)", "");
        return TryDate(v, out var d) ? d : null;
    }

    private static bool TryDate(string v, out DateOnly d)
    {
        d = default;
        if (v.Equals("today", StringComparison.OrdinalIgnoreCase)) { d = Common.Clock.Today; return true; }
        if ((v.StartsWith('+') || v.StartsWith('-')) && int.TryParse(v, out var off)) { d = Common.Clock.Today.AddDays(off); return true; }
        return DateOnly.TryParseExact(v, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out d);
    }

    public static bool YesNo(string label, bool? current = null)
    {
        var v = Text(label + " (y/n)", current is null ? null : current.Value ? "y" : "n");
        return v.StartsWith("y", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Numbered pick list. Returns null for "none" when allowNone is true.</summary>
    public static string? Choice(string label, IReadOnlyList<string> options, string? current = null, bool allowNone = false)
    {
        Console.WriteLine($"  {label}:");
        for (int i = 0; i < options.Count; i++) Console.WriteLine($"     {i + 1,2}. {options[i]}");
        if (allowNone) Console.WriteLine("      0. (any / none)");
        while (true)
        {
            var v = Text("  Choose", current is null ? null : (Array.IndexOf(options.ToArray(), current) + 1).ToString());
            if (allowNone && (v == "0" || v == "")) return null;
            if (int.TryParse(v, out var n) && n >= 1 && n <= options.Count) return options[n - 1];
            if (options.Contains(v)) return v;
            Out.Blocked("Pick one of the numbers shown");
        }
    }

    public static T? EnumChoice<T>(string label, bool allowNone = true) where T : struct, Enum
    {
        var values = Enum.GetValues<T>();
        var labels = values.Select(v => Common.EnumLabels.Label(v)).ToList();
        var picked = Choice(label, labels, allowNone: allowNone);
        return picked is null ? null : values[labels.IndexOf(picked)];
    }

    public static void Pause()
    {
        Console.Write("\n  Press Enter to continue...");
        if (Console.ReadLine() is null) throw new EndOfStreamException("Console input ended");
    }
}
