using GymLogger.Data;
using GymLogger.Endpoints;
using GymLogger.Repositories;
using GymLogger.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Web;
using System.Security.Claims;

var builder = WebApplication.CreateBuilder(args);

// Configure authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
})
.AddMicrosoftIdentityWebApp(options =>
{
    builder.Configuration.GetSection("AzureAd").Bind(options);
    
    // Hook into authentication to add custom claims
    options.Events = new OpenIdConnectEvents
    {
        OnTokenValidated = async context =>
        {
            // Get user repository from DI
            var userRepo = context.HttpContext.RequestServices.GetRequiredService<UserRepository>();
            
            // Extract external identity from Entra ID claims
            var externalId = context.Principal?.FindFirst("http://schemas.microsoft.com/identity/claims/objectidentifier")?.Value;
            var userName = context.Principal?.FindFirst("name")?.Value ?? "Unknown User";
            
            if (!string.IsNullOrEmpty(externalId))
            {
                // Get or create app user ID
                var appUserId = await userRepo.GetOrCreateAppUserIdAsync(externalId, "EntraID", userName);
                
                // Get user to check if admin
                var user = await userRepo.GetUserAsync(appUserId);

                // Add custom claims to the existing identity
                if (context.Principal?.Identity is ClaimsIdentity identity)
                {
                    // Add app user ID claim using a custom claim type
                    identity.AddClaim(new Claim("app_user_id", appUserId));

                    // Add admin role if applicable
                    if (user?.IsAdmin == true)
                    {
                        identity.AddClaim(new Claim(ClaimTypes.Role, "Admin"));
                    }

                    Console.WriteLine($"[Auth] Entra ID user authenticated: {userName}, AppUserId: {appUserId}, IsAdmin: {user?.IsAdmin}");
                }
                else
                {
                    throw new InvalidOperationException("Identity is not ClaimsIdentity");
                }
            }
            
            // Make authentication persistent (remember user across browser sessions)
            if (context.Properties != null)
            {
                context.Properties.IsPersistent = true;
                context.Properties.ExpiresUtc = DateTimeOffset.UtcNow.AddDays(180);
            }
        }
    };
}, cookieScheme: CookieAuthenticationDefaults.AuthenticationScheme)
.EnableTokenAcquisitionToCallDownstreamApi()
.AddInMemoryTokenCaches();

// Configure cookie options
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = "GymLogger.Auth";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() 
        ? CookieSecurePolicy.SameAsRequest 
        : CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.ExpireTimeSpan = TimeSpan.FromDays(180);
    options.SlidingExpiration = true;
    options.Cookie.IsEssential = true;
    options.Cookie.MaxAge = TimeSpan.FromDays(180);
    options.LoginPath = "/signin-oidc";
    options.LogoutPath = "/signout-oidc";
    options.AccessDeniedPath = "/access-denied";
});

builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build());
builder.Services.AddControllers();

// Configure database
var databaseProvider = builder.Configuration.GetValue<string>("DatabaseProvider") ?? "SqlServer";
var connectionString = builder.Configuration.GetConnectionString(databaseProvider);

if (string.IsNullOrEmpty(connectionString))
{
    throw new InvalidOperationException($"{databaseProvider} connection string not found in configuration");
}

Console.WriteLine($"[Database] Using provider: {databaseProvider}");

builder.Services.AddDbContext<GymLoggerDbContext>(options =>
{
    if (databaseProvider.Equals("SqlServer", StringComparison.OrdinalIgnoreCase))
    {
        options.UseSqlServer(connectionString);
    }
    else
    {
        options.UseSqlite(connectionString);
    }

    if (builder.Environment.IsDevelopment())
    {
        options.EnableSensitiveDataLogging();
        options.EnableDetailedErrors();
    }
    
    // Use NoTracking by default for better performance (explicitly use .AsTracking() when needed)
    options.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);
});

// Register HttpClient factory for outbound integrations
builder.Services.AddHttpClient();

// Register repositories and services (scoped to work with DbContext)
builder.Services.AddScoped<ExerciseRepository>();
builder.Services.AddScoped<ProgramRepository>();
builder.Services.AddScoped<SessionRepository>();
builder.Services.AddScoped<UserRepository>();
builder.Services.AddScoped<TemplateService>();
builder.Services.AddScoped<StatsService>();
builder.Services.AddScoped<OutboundIntegrationService>();

var app = builder.Build();

// Apply database migrations and create database if needed
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<GymLoggerDbContext>();
    try
    {
        // Apply any pending migrations
        Console.WriteLine("[Database] Applying migrations...");
        dbContext.Database.Migrate();
        Console.WriteLine("[Database] Database is up to date");
        
        await DatabaseSeeder.SeedSharedExercisesAsync(dbContext);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Database] Error during migration: {ex.Message}");
        throw;
    }
}

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapAdminEndpoints();
app.MapExerciseEndpoints();
app.MapProgramEndpoints();
app.MapSessionEndpoints();
app.MapUserEndpoints();
app.MapStatsEndpoints();
app.MapIntegrationEndpoints();
app.MapTemplateEndpoints();
app.MapSyncEndpoints();

app.Run();
