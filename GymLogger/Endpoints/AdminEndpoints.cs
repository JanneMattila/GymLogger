using GymLogger.Models;
using GymLogger.Repositories;

namespace GymLogger.Endpoints;

public static class AdminEndpoints
{
    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        // Admin exercise endpoints
        var adminExercisesGroup = app.MapGroup("/api/admin/exercises")
            .RequireAuthorization(policy => policy.RequireRole("Admin"));

        adminExercisesGroup.MapPost("/", async (HttpContext httpContext, Exercise exercise, ExerciseRepository repo) =>
        {
            return Results.Ok(await repo.CreateSharedExerciseAsync(exercise));
        });
    }
}
