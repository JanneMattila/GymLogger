using GymLogger.Extensions;
using GymLogger.Repositories;
using System.Security.Claims;

namespace GymLogger.Endpoints;

public static class ProgramEndpoints
{
    public static void MapProgramEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users/me/programs");

        // Program endpoints
        group.MapGet("/", async (ClaimsPrincipal user, int? day, ProgramRepository repo) =>
        {
            return await repo.GetProgramsAsync(user.Id, day);
        });

        group.MapGet("/{id}", async (ClaimsPrincipal user, string id, ProgramRepository repo) =>
        {
            var program = await repo.GetProgramByIdAsync(user.Id, id);
            return program != null ? Results.Ok(program) : Results.NotFound();
        });

        group.MapPost("/", async (ClaimsPrincipal user, GymLogger.Models.Program program, ProgramRepository repo) =>
        {
            return await repo.CreateProgramAsync(user.Id, program);
        });

        group.MapPut("/{id}", async (ClaimsPrincipal user, string id, GymLogger.Models.Program program, ProgramRepository repo) =>
        {
            var updated = await repo.UpdateProgramAsync(user.Id, id, program);
            return updated != null ? Results.Ok(updated) : Results.NotFound();
        });

        group.MapPatch("/{id}/set-default", async (ClaimsPrincipal user, string id, ProgramRepository repo) =>
        {
            var result = await repo.SetDefaultProgramAsync(user.Id, id);
            return result ? Results.Ok() : Results.NotFound();
        });

        group.MapDelete("/{id}", async (ClaimsPrincipal user, string id, ProgramRepository repo) =>
        {
            var deleted = await repo.DeleteProgramAsync(user.Id, id);
            return deleted ? Results.Ok() : Results.NotFound();
        });

        // Export/Import endpoints
        group.MapGet("/export", async (ClaimsPrincipal user, ProgramRepository repo) =>
        {
            var programs = await repo.GetProgramsAsync(user.Id, null);
            var exportData = programs
                .OrderBy(p => p.DayOfWeek ?? int.MaxValue)
                .Select(p => new
                {
                    name = p.Name,
                    dayOfWeek = p.DayOfWeek,
                    isDefault = p.IsDefault,
                    exercises = p.Exercises.Select(e => new
                    {
                        exerciseName = e.ExerciseName,
                        sets = e.Sets,
                        repsMin = e.RepsMin,
                        repsMax = e.RepsMax,
                        targetWeight = e.TargetWeight,
                        notes = e.Notes ?? ""
                    }).ToList()
                }).ToList();
            return Results.Ok(exportData);
        });

        group.MapGet("/{id}/export", async (ClaimsPrincipal user, string id, ProgramRepository repo) =>
        {
            var program = await repo.GetProgramByIdAsync(user.Id, id);
            if (program == null) return Results.NotFound();
            var exportData = new[]
            {
                new
                {
                    name = program.Name,
                    dayOfWeek = program.DayOfWeek,
                    isDefault = program.IsDefault,
                    exercises = program.Exercises.Select(e => new
                    {
                        exerciseName = e.ExerciseName,
                        sets = e.Sets,
                        repsMin = e.RepsMin,
                        repsMax = e.RepsMax,
                        targetWeight = e.TargetWeight,
                        notes = e.Notes ?? ""
                    }).ToList()
                }
            };
            return Results.Ok(exportData);
        });

        group.MapPost("/import", async (ClaimsPrincipal user, List<GymLogger.Models.Program> programs, ProgramRepository repo, ExerciseRepository exerciseRepo) =>
        {
            // Get all exercises to map names to IDs
            var allExercises = await exerciseRepo.GetAllExercisesAsync(user.Id);
            var exerciseMap = allExercises.ToDictionary(e => e.Name.ToLowerInvariant(), e => e.Id);

            var results = new List<object>();
            var errors = new List<string>();

            foreach (var program in programs)
            {
                try
                {
                    // Map exercise names to IDs
                    foreach (var exercise in program.Exercises)
                    {
                        if (string.IsNullOrEmpty(exercise.ExerciseId) && !string.IsNullOrEmpty(exercise.ExerciseName))
                        {
                            var exerciseName = exercise.ExerciseName.ToLowerInvariant();
                            if (exerciseMap.TryGetValue(exerciseName, out var exerciseId))
                            {
                                exercise.ExerciseId = exerciseId;
                            }
                            else
                            {
                                errors.Add($"Exercise not found: {exercise.ExerciseName} in program {program.Name}");
                                continue;
                            }
                        }
                    }

                    // Skip if any exercises couldn't be resolved
                    if (errors.Count > 0)
                    {
                        continue;
                    }

                    // Check if program with same name exists
                    var existingPrograms = await repo.GetProgramsAsync(user.Id, null);
                    var existing = existingPrograms.FirstOrDefault(p => p.Name.Equals(program.Name, StringComparison.OrdinalIgnoreCase));

                    if (existing != null)
                    {
                        // Override existing program
                        var updated = await repo.UpdateProgramAsync(user.Id, existing.Id, program);
                        results.Add(new { action = "updated", program = updated });
                    }
                    else
                    {
                        // Create new program
                        var created = await repo.CreateProgramAsync(user.Id, program);
                        results.Add(new { action = "created", program = created });
                    }
                }
                catch (Exception ex)
                {
                    errors.Add($"Error importing program {program.Name}: {ex.Message}");
                }
            }

            if (errors.Count > 0)
            {
                return Results.BadRequest(new { imported = results.Count, results, errors });
            }

            return Results.Ok(new { imported = results.Count, results });
        });
    }
}
