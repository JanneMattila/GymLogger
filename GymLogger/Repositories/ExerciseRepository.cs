using GymLogger.Data;
using GymLogger.Entities;
using GymLogger.Models;
using Microsoft.EntityFrameworkCore;

namespace GymLogger.Repositories;

public class ExerciseRepository
{
    private readonly GymLoggerDbContext _context;

    public ExerciseRepository(GymLoggerDbContext context)
    {
        _context = context;
    }

    public async Task<List<Exercise>> GetSharedExercisesAsync()
    {
        var entities = await _context.Exercises
            .AsNoTracking()
            .Where(e => e.UserId == null)
            .OrderBy(e => e.Name)
            .ToListAsync();
        
        return entities.Select(MapToExercise).ToList();
    }

    public async Task<List<Exercise>> GetUserExercisesAsync(string userId)
    {
        var entities = await _context.Exercises
            .AsNoTracking()
            .Where(e => e.UserId == userId)
            .OrderBy(e => e.Name)
            .ToListAsync();
        
        return entities.Select(MapToExercise).ToList();
    }

    public async Task<List<Exercise>> GetAllExercisesAsync(string userId)
    {
        var entities = await _context.Exercises
            .AsNoTracking()
            .Where(e => e.UserId == null || e.UserId == userId)
            .OrderBy(e => e.Name)
            .ToListAsync();
        
        return entities.Select(MapToExercise).ToList();
    }

    public async Task<List<Exercise>> GetExercisesByIdsAsync(string userId, IEnumerable<string> exerciseIds)
    {
        if (exerciseIds == null)
        {
            return new List<Exercise>();
        }

        var idSet = new HashSet<string>(exerciseIds.Where(id => !string.IsNullOrWhiteSpace(id)), StringComparer.OrdinalIgnoreCase);

        if (idSet.Count == 0)
        {
            return new List<Exercise>();
        }

        var entities = await _context.Exercises
            .AsNoTracking()
            .Where(e => idSet.Contains(e.Id) && (e.UserId == null || e.UserId == userId))
            .ToListAsync();

        return entities.Select(MapToExercise).ToList();
    }

    public async Task<Exercise?> GetExerciseByIdAsync(string userId, string exerciseId)
    {
        var entity = await _context.Exercises
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == exerciseId && (e.UserId == null || e.UserId == userId));
        
        return entity == null ? null : MapToExercise(entity);
    }

    public async Task<Exercise> CreateUserExerciseAsync(string userId, Exercise exercise)
    {
        var entity = new ExerciseEntity
        {
            Id = Guid.NewGuid().ToString(),
            UserId = userId,
            Name = exercise.Name,
            Description = exercise.Description,
            Category = exercise.MuscleGroup,
            TargetMuscleGroup = exercise.MuscleGroup,
            Equipment = exercise.EquipmentType,
            IsShared = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Exercises.Add(entity);
        await _context.SaveChangesAsync();
        
        return MapToExercise(entity);
    }

    public async Task<Exercise?> UpdateUserExerciseAsync(string userId, string exerciseId, Exercise updatedExercise)
    {
        var entity = await _context.Exercises
            .AsTracking()
            .FirstOrDefaultAsync(e => e.Id == exerciseId && e.UserId == userId);
        
        if (entity == null) return null;

        entity.Name = updatedExercise.Name;
        entity.Description = updatedExercise.Description;
        entity.Category = updatedExercise.MuscleGroup;
        entity.TargetMuscleGroup = updatedExercise.MuscleGroup;
        entity.Equipment = updatedExercise.EquipmentType;
        entity.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return MapToExercise(entity);
    }

    public async Task<bool> DeleteUserExerciseAsync(string userId, string exerciseId)
    {
        var entity = await _context.Exercises
            .AsTracking()
            .FirstOrDefaultAsync(e => e.Id == exerciseId && e.UserId == userId);
        
        if (entity == null) return false;
        
        _context.Exercises.Remove(entity);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<Exercise> CreateSharedExerciseAsync(Exercise exercise)
    {
        var entity = new ExerciseEntity
        {
            Id = Guid.NewGuid().ToString(),
            UserId = null, // Shared exercise
            Name = exercise.Name,
            Description = exercise.Description,
            Category = exercise.MuscleGroup,
            TargetMuscleGroup = exercise.MuscleGroup,
            Equipment = exercise.EquipmentType,
            IsShared = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Exercises.Add(entity);
        await _context.SaveChangesAsync();
        
        return MapToExercise(entity);
    }
    
    // Mapping method
    private static Exercise MapToExercise(ExerciseEntity entity)
    {
        return new Exercise
        {
            Id = entity.Id,
            Name = entity.Name,
            MuscleGroup = entity.Category ?? entity.TargetMuscleGroup ?? "",
            EquipmentType = entity.Equipment ?? "",
            Description = entity.Description,
            IsCustom = entity.UserId != null,
            UserId = entity.UserId,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt
        };
    }
}

