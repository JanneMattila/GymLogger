using GymLogger.Extensions;
using GymLogger.Models;
using GymLogger.Repositories;
using System.Security.Claims;

namespace GymLogger.Endpoints;

public static class ExerciseEndpoints
{
    public static void MapExerciseEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/exercises");

        // Exercise endpoints
        group.MapGet("/", async (ClaimsPrincipal user, ExerciseRepository repo) =>
        {
            return await repo.GetAllExercisesAsync(user.Id);
        });

        group.MapPost("/", async (ClaimsPrincipal user, Exercise exercise, ExerciseRepository repo) =>
        {
            return await repo.CreateUserExerciseAsync(user.Id, exercise);
        });
        
        
        var userExercisesGroup = app.MapGroup("/api/users/me/exercises");

        userExercisesGroup.MapPut("/{id}", async (ClaimsPrincipal user, string id, Exercise exercise, ExerciseRepository repo) =>
        {
            var updated = await repo.UpdateUserExerciseAsync(user.Id, id, exercise);
            return updated != null ? Results.Ok(updated) : Results.NotFound();
        });

        userExercisesGroup.MapDelete("/{id}", async (ClaimsPrincipal user, string id, ExerciseRepository repo) =>
        {
            var deleted = await repo.DeleteUserExerciseAsync(user.Id, id);
            return deleted ? Results.Ok() : Results.NotFound();
        });
    }
}
