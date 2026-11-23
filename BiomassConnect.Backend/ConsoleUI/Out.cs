using System.Globalization;
using BiomassConnect.Backend.Common;

namespace BiomassConnect.Backend.ConsoleUI;

/// <summary>Plain Console.WriteLine output with [OK] / [BLOCKED] / [INFO] prefixes (no UI libraries).</summary>
public static class Out
{
    private static readonly CultureInfo India = CultureInfo.GetCultureInfo("en-IN");

    public static void Banner(string title)
    {
        Console.WriteLine();
        Console.WriteLine(new string('=', 60));
        Console.WriteLine("  " + title);
        Console.WriteLine(new string('=', 60));
    }

    public static void Step(string number, string title)
    {
        Console.WriteLine();
        Write(ConsoleColor.Cyan, $"STEP {number,-3} {title}");
        Console.WriteLine();
    }

    public static void Controller(string name) => Write(ConsoleColor.DarkGray, $"[Controller] {name}\n");

    public static void Ok(string msg) => Line(ConsoleColor.Green, "[OK]     ", msg);
    public static void Blocked(string msg) => Line(ConsoleColor.Red, "[BLOCKED]", msg);
    public static void Info(string msg) => Line(ConsoleColor.Yellow, "[INFO]   ", msg);
    public static void Detail(string msg) => Console.WriteLine("          " + msg);

    public static void Print<T>(Result<T> r)
    {
        switch (r.Kind)
        {
            case ResultKind.Ok: Ok(r.Message == "" ? "Done" : r.Message); break;
            case ResultKind.Info: Info(r.Message); break;
            default: Blocked(r.Message); break;
        }
    }

    public static string Inr(decimal v) => "Rs. " + v.ToString("#,##,##0.##", India);
    public static string N(decimal v) => v.ToString("#,##,##0.##", India);
    public static string D(DateOnly? d) => d is null ? "-" : d.Value.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);

    /// <summary>Prints rows as simple aligned text columns.</summary>
    public static void Table(IReadOnlyList<string> headers, IEnumerable<IReadOnlyList<string?>> rows, int maxWidth = 34)
    {
        var data = rows.Select(r => r.Select(c => Trim(c ?? "", maxWidth)).ToList()).ToList();
        var widths = headers.Select((h, i) => Math.Max(h.Length, data.Count == 0 ? 0 : data.Max(r => i < r.Count ? r[i].Length : 0))).ToList();
        string Row(IReadOnlyList<string> cells) => "  " + string.Join(" | ", widths.Select((w, i) => (i < cells.Count ? cells[i] : "").PadRight(w)));

        Console.WriteLine(Row(headers));
        Console.WriteLine("  " + string.Join("-+-", widths.Select(w => new string('-', w))));
        if (data.Count == 0) Console.WriteLine("  (no rows)");
        foreach (var r in data) Console.WriteLine(Row(r));
    }

    private static string Trim(string s, int max) => s.Length <= max ? s : s[..(max - 1)] + "~";

    private static void Line(ConsoleColor color, string prefix, string msg)
    {
        Write(color, prefix);
        Console.WriteLine(" " + msg);
    }

    private static void Write(ConsoleColor color, string text)
    {
        var old = Console.ForegroundColor;
        Console.ForegroundColor = color;
        Console.Write(text);
        Console.ForegroundColor = old;
    }
}
