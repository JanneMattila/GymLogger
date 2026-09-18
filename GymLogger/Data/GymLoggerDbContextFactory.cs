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

        var databaseProvider = configuration.GetValue<string>("DatabaseProvider") ?? "SqlServer";
        if (!databaseProvider.Equals("SqlServer", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Only the SqlServer database provider is supported.");
        }

        var connectionString = configuration.GetConnectionString(databaseProvider);

        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException("SqlServer connection string not found in configuration");
        }

        Console.WriteLine("[Migration] Using SQL Server");
        optionsBuilder.UseSqlServer(connectionString);
        
        return new GymLoggerDbContext(optionsBuilder.Options);
    }
}
