using System.Text;
using BiomassConnect.Backend.ConsoleUI;
using Microsoft.Extensions.Configuration;

// =====================================================================
// BIOMASS CONNECT - BACKEND CONSOLE (Phase 1, revised: console edition)
// Controller -> Service -> EF Core -> existing PostgreSQL schema.
// No HTTP, no routing, no JWT: the console menus call the controllers.
//
//   dotnet run              main menu
//   dotnet run -- --demo    run the automated demo once, without pauses, and exit
//   dotnet run -- --clean   remove the @demo.local data and exit
// =====================================================================

Console.OutputEncoding = Encoding.UTF8;

var config = new ConfigurationBuilder()
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: false)
    .Build();

var connectionString = config.GetConnectionString("BiomassConnect")
    ?? throw new InvalidOperationException("ConnectionStrings:BiomassConnect is missing in appsettings.json");

using var app = new AppHost(connectionString);

try
{
    await DemoData.BootstrapAsync(app.Db);
}
catch (Exception ex)
{
    Out.Blocked($"Cannot reach the database: {ex.GetBaseException().Message}");
    Out.Info("Check the connection string in appsettings.json and that database/schema.sql has been loaded.");
    return 1;
}

if (args.Contains("--demo"))
{
    await new AutomatedDemo(app).RunAsync(pauseBetweenSteps: false);
    return 0;
}
if (args.Contains("--clean"))
{
    await DemoData.CleanAsync(app.Db);
    return 0;
}

try
{
    return await MainMenu(app);
}
catch (EndOfStreamException)
{
    Console.WriteLine();
    Out.Info("Input ended - exiting.");
    return 0;
}

static async Task<int> MainMenu(AppHost app)
{
while (true)
{
    Out.Banner("BIOMASS CONNECT  -  BACKEND CONSOLE");
    Console.WriteLine("  [1] Run Full Automated Demo");
    Console.WriteLine("  [2] Interactive Menu (by role)");
    Console.WriteLine("  [3] Show Database Tables");
    Console.WriteLine("  [4] Clean Demo Data");
    Console.WriteLine("  [0] Exit");

    switch (Prompt.Text("Choose"))
    {
        case "1":
            await new AutomatedDemo(app).RunAsync(pauseBetweenSteps: Prompt.YesNo("Pause after each step", true));
            Prompt.Pause();
            break;
        case "2":
            await new InteractiveMenu(app).RunAsync();
            break;
        case "3":
            await TableViewer.ShowMenuAsync(app.Db);
            break;
        case "4":
            if (Prompt.YesNo("Delete every @demo.local account and the rows that depend on them", false))
                await DemoData.CleanAsync(app.Db);
            Prompt.Pause();
            break;
        case "0":
            return 0;
    }
}
}
