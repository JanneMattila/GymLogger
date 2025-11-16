using GymLogger.Extensions;
using GymLogger.Models;
using GymLogger.Repositories;
using System.Security.Claims;

namespace GymLogger.Endpoints;

public static class UserEndpoints
{
    public static void MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users/me/preferences");

        // User preferences endpoints
        group.MapGet("/", async (ClaimsPrincipal user, UserRepository repo) =>
        {
            var preferences = await repo.GetPreferencesAsync(user.Id);
            return new { userId = user.Id, preferences };
        });

        group.MapPut("/", async (ClaimsPrincipal user, UserPreferences preferences, UserRepository repo) =>
        {
            return await repo.UpdatePreferencesAsync(user.Id, preferences);
        });
    }
}
