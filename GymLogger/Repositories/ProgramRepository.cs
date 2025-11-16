using GymLogger.Data;
using GymLogger.Entities;
using Microsoft.EntityFrameworkCore;

namespace GymLogger.Repositories;

public class ProgramRepository
{
    private readonly GymLoggerDbContext _context;

    public ProgramRepository(GymLoggerDbContext context)
    {
        _context = context;
    }

    public async Task<List<Models.Program>> GetProgramsAsync(string userId, int? dayOfWeek = null)
    {
        var query = _context.Programs
            .AsNoTracking()
            .Include(p => p.ProgramExercises.OrderBy(pe => pe.OrderIndex))
            .ThenInclude(pe => pe.Exercise)
            .Where(p => p.UserId == userId);
        
        if (dayOfWeek.HasValue)
        {
            query = query.Where(p => p.DayOfWeek == dayOfWeek.Value);
        }
        
        var entities = await query.OrderBy(p => p.Name).ToListAsync();
        return entities.Select(MapToProgram).ToList();
    }

    public async Task<Models.Program?> GetProgramByIdAsync(string userId, string programId)
    {
        var entity = await _context.Programs
            .AsNoTracking()
            .Include(p => p.ProgramExercises.OrderBy(pe => pe.OrderIndex))
            .ThenInclude(pe => pe.Exercise)
            .FirstOrDefaultAsync(p => p.Id == programId && p.UserId == userId);
        
        return entity == null ? null : MapToProgram(entity);
    }

    public async Task<Models.Program> CreateProgramAsync(string userId, Models.Program program)
    {
        var entity = new ProgramEntity
        {
            Id = Guid.NewGuid().ToString(),
            UserId = userId,
            Name = program.Name,
            DayOfWeek = program.DayOfWeek,
            IsDefault = program.IsDefault,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // Add program exercises
        if (program.Exercises != null)
        {
            for (int i = 0; i < program.Exercises.Count; i++)
            {
                var ex = program.Exercises[i];
                entity.ProgramExercises.Add(new ProgramExerciseEntity
                {
                    Id = Guid.NewGuid().ToString(),
                    ProgramId = entity.Id,
                    ExerciseId = ex.ExerciseId,
                    OrderIndex = i,
                    Sets = ex.Sets,
                    RepsMin = ex.RepsMin,
                    RepsMax = ex.RepsMax,
                    TargetWeight = ex.TargetWeight,
                    RestSeconds = ex.RestSeconds,
                    Notes = ex.Notes,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        _context.Programs.Add(entity);
        await _context.SaveChangesAsync();
        
        // Reload with exercises
        entity = await _context.Programs
            .Include(p => p.ProgramExercises.OrderBy(pe => pe.OrderIndex))
            .ThenInclude(pe => pe.Exercise)
            .FirstAsync(p => p.Id == entity.Id);
        
        return MapToProgram(entity);
    }

    public async Task<Models.Program?> UpdateProgramAsync(string userId, string programId, Models.Program updatedProgram)
    {
        var entity = await _context.Programs
            .AsTracking()
            .Include(p => p.ProgramExercises)
            .FirstOrDefaultAsync(p => p.Id == programId && p.UserId == userId);
        
        if (entity == null) return null;

        entity.Name = updatedProgram.Name;
        entity.DayOfWeek = updatedProgram.DayOfWeek;
        entity.IsDefault = updatedProgram.IsDefault;
        entity.UpdatedAt = DateTime.UtcNow;

        // Update exercises: Remove all and re-add (simpler than diffing)
        _context.ProgramExercises.RemoveRange(entity.ProgramExercises);
        
        if (updatedProgram.Exercises != null)
        {
            for (int i = 0; i < updatedProgram.Exercises.Count; i++)
            {
                var ex = updatedProgram.Exercises[i];
                _context.ProgramExercises.Add(new ProgramExerciseEntity
                {
                    Id = Guid.NewGuid().ToString(),
                    ProgramId = entity.Id,
                    ExerciseId = ex.ExerciseId,
                    OrderIndex = i,
                    Sets = ex.Sets,
                    RepsMin = ex.RepsMin,
                    RepsMax = ex.RepsMax,
                    TargetWeight = ex.TargetWeight,
                    RestSeconds = ex.RestSeconds,
                    Notes = ex.Notes,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await _context.SaveChangesAsync();
        
        // Reload with exercises
        entity = await _context.Programs
            .Include(p => p.ProgramExercises.OrderBy(pe => pe.OrderIndex))
            .ThenInclude(pe => pe.Exercise)
            .FirstAsync(p => p.Id == entity.Id);
        
        return MapToProgram(entity);
    }

    public async Task<bool> SetDefaultProgramAsync(string userId, string programId)
    {
        var target = await _context.Programs
            .AsTracking()
            .FirstOrDefaultAsync(p => p.Id == programId && p.UserId == userId);
        
        if (target == null) return false;

        // Remove default flag from programs with same day
        var sameDay = await _context.Programs
            .AsTracking()
            .Where(p => p.UserId == userId && p.DayOfWeek == target.DayOfWeek && p.Id != programId)
            .ToListAsync();
        
        foreach (var program in sameDay)
        {
            program.IsDefault = false;
        }

        target.IsDefault = true;
        target.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteProgramAsync(string userId, string programId)
    {
        var entity = await _context.Programs
            .AsTracking()
            .FirstOrDefaultAsync(p => p.Id == programId && p.UserId == userId);
        
        if (entity == null) return false;
        
        _context.Programs.Remove(entity);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task UpdateLastUsedAsync(string userId, string programId)
    {
        var program = await _context.Programs
            .AsTracking()
            .FirstOrDefaultAsync(p => p.Id == programId && p.UserId == userId);
        
        if (program != null)
        {
            program.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }
    
    // Mapping method
    private static Models.Program MapToProgram(ProgramEntity entity)
    {
        return new Models.Program
        {
            Id = entity.Id,
            UserId = entity.UserId,
            Name = entity.Name,
            DayOfWeek = entity.DayOfWeek,
            IsDefault = entity.IsDefault,
            Exercises = entity.ProgramExercises
                .OrderBy(pe => pe.OrderIndex)
                .Select(pe => new Models.ProgramExercise
                {
                    ExerciseId = pe.ExerciseId,
                    ExerciseName = pe.Exercise?.Name ?? "",
                    Sets = pe.Sets,
                    RepsMin = pe.RepsMin,
                    RepsMax = pe.RepsMax,
                    TargetWeight = pe.TargetWeight,
                    RestSeconds = pe.RestSeconds,
                    Notes = pe.Notes
                }).ToList(),
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt,
            LastUsedDate = entity.UpdatedAt // Using UpdatedAt as proxy for LastUsedDate
        };
    }
}

