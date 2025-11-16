using GymLogger.Entities;
using Microsoft.EntityFrameworkCore;

namespace GymLogger.Data;

public static class DatabaseSeeder
{
    public static async Task SeedSharedExercisesAsync(GymLoggerDbContext dbContext)
    {
        Console.WriteLine("[Database] Syncing shared exercises from exercises.json...");
        
        var exercisesPath = "exercises.json";
        if (!File.Exists(exercisesPath))
        {
            Console.WriteLine($"[Database] Warning: exercises.json not found at {exercisesPath}");
            return;
        }
        
        try
        {
            var json = await File.ReadAllTextAsync(exercisesPath);
            var exercises = System.Text.Json.JsonSerializer.Deserialize<List<SharedExerciseDto>>(json);
            
            if (exercises == null || exercises.Count == 0)
            {
                Console.WriteLine("[Database] No exercises found in exercises.json");
                return;
            }
            
            // Get all existing shared exercises (with tracking enabled for updates)
            var existingExercises = await dbContext.Exercises
                .Where(e => e.UserId == null)
                .AsTracking()
                .ToDictionaryAsync(e => e.Id);
            
            int addedCount = 0;
            int updatedCount = 0;
            
            foreach (var exercise in exercises)
            {
                if (existingExercises.TryGetValue(exercise.id, out var existingExercise))
                {
                    // Always update all fields from JSON
                    existingExercise.Name = exercise.name;
                    existingExercise.Description = exercise.description;
                    existingExercise.Category = exercise.muscleGroup;
                    existingExercise.TargetMuscleGroup = exercise.muscleGroup;
                    existingExercise.Equipment = exercise.equipmentType;
                    existingExercise.UpdatedAt = exercise.updatedAt;
                    updatedCount++;
                }
                else
                {
                    // Add new exercise
                    dbContext.Exercises.Add(new ExerciseEntity
                    {
                        Id = exercise.id,
                        UserId = null, // Shared exercise
                        Name = exercise.name,
                        Description = exercise.description,
                        Category = exercise.muscleGroup,
                        TargetMuscleGroup = exercise.muscleGroup,
                        Equipment = exercise.equipmentType,
                        IsShared = true,
                        CreatedAt = exercise.createdAt,
                        UpdatedAt = exercise.updatedAt
                    });
                    addedCount++;
                }
            }
            
            if (addedCount > 0 || updatedCount > 0)
            {
                var changesSaved = await dbContext.SaveChangesAsync();
                Console.WriteLine($"[Database] Exercise sync complete: {addedCount} added, {updatedCount} updated ({changesSaved} changes saved)");
            }
            else
            {
                Console.WriteLine($"[Database] No exercises to sync");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Database] Error syncing exercises: {ex.Message}");
        }
    }
    
    // DTO for deserializing exercises.json
    private record SharedExerciseDto(
        string id,
        string name,
        string muscleGroup,
        string equipmentType,
        string description,
        bool isCustom,
        DateTime createdAt,
        DateTime updatedAt
    );
}
