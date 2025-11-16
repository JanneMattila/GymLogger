using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace GymLogger.Data;

/// <summary>
/// Design-time factory for creating DbContext instances during migrations
/// </summary>
public class GymLoggerDbContextFactory : IDesignTimeDbContextFactory<GymLoggerDbContext>
{
    public GymLoggerDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<GymLoggerDbContext>();
        
        // Load configuration from appsettings.json
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .Build();

        var databaseProvider = configuration.GetValue<string>("DatabaseProvider") ?? "SQLite";
        var connectionString = configuration.GetConnectionString(databaseProvider);

        if (string.IsNullOrEmpty(connectionString))
        {
            // Fallback to SQLite if configuration is missing
            Console.WriteLine("[Migration] No connection string found, using SQLite default");
            optionsBuilder.UseSqlite("Data Source=data/gymlogger.db");
        }
        else if (databaseProvider.Equals("SqlServer", StringComparison.OrdinalIgnoreCase))
        {
            Console.WriteLine($"[Migration] Using SQL Server: {connectionString.Split(';')[0]}");
            optionsBuilder.UseSqlServer(connectionString);
        }
        else
        {
            Console.WriteLine($"[Migration] Using SQLite: {connectionString}");
            optionsBuilder.UseSqlite(connectionString);
        }
        
        return new GymLoggerDbContext(optionsBuilder.Options);
    }
}
