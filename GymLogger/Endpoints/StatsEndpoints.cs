using GymLogger.Extensions;
using GymLogger.Services;
using System.Security.Claims;

namespace GymLogger.Endpoints;

public static class StatsEndpoints
{
    public static void MapStatsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users/me/stats");

        // Stats endpoints
        group.MapGet("/by-exercise", async (ClaimsPrincipal user, StatsService service) =>
        {
            return await service.GetStatsByExerciseAsync(user.Id);
        });

        group.MapGet("/by-program/{programId}", async (ClaimsPrincipal user, string programId, StatsService service) =>
        {
            return await service.GetStatsByProgramAsync(user.Id, programId);
        });

        group.MapGet("/by-muscle", async (ClaimsPrincipal user, string? muscleGroup, StatsService service) =>
        {
            if (string.IsNullOrEmpty(muscleGroup))
            {
                return Results.BadRequest("muscleGroup parameter is required");
            }
            return Results.Ok(await service.GetStatsByMuscleGroupAsync(user.Id, muscleGroup));
        });

        group.MapGet("/history/{exerciseId}", async (ClaimsPrincipal user, string exerciseId, StatsService service) =>
        {
            return await service.GetExerciseHistoryAsync(user.Id, exerciseId);
        });
    }
}
