using GymLogger.Data;
using GymLogger.Entities;
using GymLogger.Models;
using Microsoft.EntityFrameworkCore;

namespace GymLogger.Repositories;

public class SessionRepository
{
    private readonly GymLoggerDbContext _context;

    public SessionRepository(GymLoggerDbContext context)
    {
        _context = context;
    }

    public async Task<WorkoutSession?> GetSessionByIdAsync(string userId, string sessionId)
    {
        var entity = await _context.WorkoutSessions
            .AsNoTracking()
            .Include(s => s.WorkoutSets.OrderBy(ws => ws.CreatedAt))
            .ThenInclude(ws => ws.Exercise)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);
        
        return entity == null ? null : await MapToWorkoutSessionAsync(entity);
    }

    public async Task<List<WorkoutSession>> GetSessionsAsync(string userId, string? startDate = null, string? endDate = null)
    {
        var query = _context.WorkoutSessions
            .AsNoTracking()
            .Include(s => s.WorkoutSets.OrderBy(ws => ws.CreatedAt))
            .ThenInclude(ws => ws.Exercise)
            .Where(s => s.UserId == userId);

        if (startDate != null && DateTime.TryParse(startDate, out var start))
        {
            query = query.Where(s => s.SessionDate >= start);
        }
        
        if (endDate != null && DateTime.TryParse(endDate, out var end))
        {
            query = query.Where(s => s.SessionDate <= end);
        }

        var entities = await query
            .OrderByDescending(s => s.SessionDate)
            .ThenByDescending(s => s.StartedAt)
            .ToListAsync();

        var sessions = new List<WorkoutSession>();
        foreach (var entity in entities)
        {
            sessions.Add(await MapToWorkoutSessionAsync(entity));
        }
        
        return sessions;
    }

    public async Task<WorkoutSession?> GetActiveSessionAsync(string userId)
    {
        var entity = await _context.WorkoutSessions
            .AsNoTracking()
            .Include(s => s.WorkoutSets.OrderBy(ws => ws.CreatedAt))
            .ThenInclude(ws => ws.Exercise)
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Status == "in-progress");
        
        Console.WriteLine($"[GetActiveSessionAsync] Active session: {entity?.Id ?? "none"}");
        
        return entity == null ? null : await MapToWorkoutSessionAsync(entity);
    }

    public async Task<WorkoutSession?> GetLastSessionForProgramAsync(string userId, string programId)
    {
        var entity = await _context.WorkoutSessions
            .AsNoTracking()
            .Include(s => s.WorkoutSets)
            .Where(s => s.UserId == userId && s.Status == "completed" && s.ProgramId == programId)
            .OrderByDescending(s => s.SessionDate)
            .ThenByDescending(s => s.CompletedAt)
            .FirstOrDefaultAsync();

        return entity == null ? null : await MapToWorkoutSessionAsync(entity);
    }

    public async Task<WorkoutSession> CreateSessionAsync(string userId, WorkoutSession session)
    {
        var entity = new WorkoutSessionEntity
        {
            Id = Guid.NewGuid().ToString(),
            UserId = userId,
            ProgramId = session.ProgramId ?? string.Empty,
            ProgramName = session.ProgramName ?? string.Empty,
            SessionDate = DateTime.Parse(session.SessionDate),
            StartedAt = DateTime.UtcNow,
            Status = session.Status,
            TotalSets = 0,
            TotalReps = 0,
            TotalVolume = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.WorkoutSessions.Add(entity);
        await _context.SaveChangesAsync();
        
        return await MapToWorkoutSessionAsync(entity);
    }

    public async Task<WorkoutSession?> UpdateSessionAsync(string userId, string sessionId, WorkoutSession updatedSession)
    {
        var entity = await _context.WorkoutSessions
            .AsTracking()
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);
        
        if (entity == null) return null;

        Console.WriteLine($"[UpdateSessionAsync] Before update - Session: {entity.Id}, OldStatus: {entity.Status}, NewStatus: {updatedSession.Status}");

        entity.CompletedAt = updatedSession.CompletedAt;
        entity.Status = updatedSession.Status;
        entity.UpdatedAt = DateTime.UtcNow;
        
        // Recalculate statistics
        await RecalculateSessionStatsAsync(entity);

        await _context.SaveChangesAsync();
        
        Console.WriteLine($"[UpdateSessionAsync] After SaveChanges - Session: {entity.Id}, Status: {entity.Status}");
        return await MapToWorkoutSessionAsync(entity);
    }

    public async Task<bool> CleanupSessionAsync(string userId, string sessionId)
    {
        var entity = await _context.WorkoutSessions
            .AsTracking()
            .Include(s => s.WorkoutSets)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);
        
        if (entity == null) return false;

        // Remove sets with null reps
        var invalidSets = entity.WorkoutSets.Where(s => !s.Reps.HasValue).ToList();
        foreach (var set in invalidSets)
        {
            _context.WorkoutSets.Remove(set);
        }

        entity.CompletedAt = DateTime.UtcNow;
        entity.Status = "completed";
        entity.UpdatedAt = DateTime.UtcNow;
        
        // Recalculate statistics
        await RecalculateSessionStatsAsync(entity);

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<WorkoutSet>> GetSetsForSessionAsync(string userId, string sessionId)
    {
        // Verify session belongs to user
        var sessionExists = await _context.WorkoutSessions
            .AnyAsync(s => s.Id == sessionId && s.UserId == userId);
        
        if (!sessionExists) return new List<WorkoutSet>();

        var entities = await _context.WorkoutSets
            .AsNoTracking()
            .Include(ws => ws.Exercise)
            .Where(ws => ws.SessionId == sessionId)
            .OrderBy(ws => ws.CreatedAt)
            .ToListAsync();

        return entities.Select(MapToWorkoutSet).ToList();
    }

    public async Task<WorkoutSet> AddSetAsync(string userId, string sessionId, WorkoutSet set)
    {
        // Verify session belongs to user
        var session = await _context.WorkoutSessions
            .AsTracking()
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);
        
        if (session == null)
        {
            throw new InvalidOperationException("Session not found or access denied");
        }

        var entity = new WorkoutSetEntity
        {
            Id = Guid.NewGuid().ToString(),
            SessionId = sessionId,
            ExerciseId = set.ExerciseId,
            ProgramExerciseId = set.ProgramExerciseId,
            SetNumber = set.SetNumber,
            Weight = set.Weight ?? 0,
            Reps = set.Reps ?? 0,
            IsWarmup = set.IsWarmup,
            RestSeconds = set.RestSeconds,
            Notes = set.Notes,
            CreatedAt = DateTime.UtcNow
        };

        _context.WorkoutSets.Add(entity);
        
        // Update session statistics
        await RecalculateSessionStatsAsync(session);
        
        await _context.SaveChangesAsync();
        
        // Reload with exercise
        entity = await _context.WorkoutSets
            .Include(ws => ws.Exercise)
            .FirstAsync(ws => ws.Id == entity.Id);
        
        return MapToWorkoutSet(entity);
    }

    public async Task<WorkoutSet?> UpdateSetAsync(string userId, string sessionId, string setId, WorkoutSet updatedSet)
    {
        // Verify session belongs to user
        var session = await _context.WorkoutSessions
            .AsTracking()
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);
        
        if (session == null) return null;

        var entity = await _context.WorkoutSets
            .AsTracking()
            .Include(ws => ws.Exercise)
            .FirstOrDefaultAsync(ws => ws.Id == setId && ws.SessionId == sessionId);
        
        if (entity == null) return null;

        entity.Reps = updatedSet.Reps ?? entity.Reps;
        entity.Weight = updatedSet.Weight ?? entity.Weight;
        entity.RestSeconds = updatedSet.RestSeconds;
        
        // Update session statistics
        await RecalculateSessionStatsAsync(session);
        
        await _context.SaveChangesAsync();
        return MapToWorkoutSet(entity);
    }

    public async Task<bool> DeleteSetAsync(string userId, string sessionId, string setId)
    {
        // Verify session belongs to user
        var session = await _context.WorkoutSessions
            .AsTracking()
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);
        
        if (session == null) return false;

        var entity = await _context.WorkoutSets
            .AsTracking()
            .FirstOrDefaultAsync(ws => ws.Id == setId && ws.SessionId == sessionId);
        
        if (entity == null) return false;
        
        _context.WorkoutSets.Remove(entity);
        
        // Update session statistics
        await RecalculateSessionStatsAsync(session);
        
        await _context.SaveChangesAsync();
        return true;
    }
    
    // Helper to recalculate session statistics
    private async Task RecalculateSessionStatsAsync(WorkoutSessionEntity session)
    {
        var sets = await _context.WorkoutSets
            .Where(ws => ws.SessionId == session.Id && ws.Reps.HasValue)
            .ToListAsync();

        session.TotalSets = sets.Count;
        session.TotalReps = sets.Sum(s => s.Reps ?? 0);
        session.TotalVolume = sets.Sum(s => (s.Weight ?? 0) * (s.Reps ?? 0));
        
        if (session.StartedAt != default && session.CompletedAt.HasValue)
        {
            session.DurationSeconds = (int)(session.CompletedAt.Value - session.StartedAt).TotalSeconds;
        }
    }
    
    // Mapping methods
    private async Task<WorkoutSession> MapToWorkoutSessionAsync(WorkoutSessionEntity entity)
    {
        var sets = entity.WorkoutSets?.Select(MapToWorkoutSet).ToList() 
                   ?? await GetSetsForSessionAsync(entity.UserId, entity.Id);

        return new WorkoutSession
        {
            Id = entity.Id,
            UserId = entity.UserId,
            ProgramId = entity.ProgramId,
            ProgramName = entity.ProgramName,
            SessionDate = entity.SessionDate.ToString("yyyy-MM-dd"),
            StartedAt = entity.StartedAt,
            CompletedAt = entity.CompletedAt,
            Status = entity.Status,
            Sets = sets,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt
        };
    }
    
    private static WorkoutSet MapToWorkoutSet(WorkoutSetEntity entity)
    {
        return new WorkoutSet
        {
            Id = entity.Id,
            SessionId = entity.SessionId,
            ExerciseId = entity.ExerciseId,
            ExerciseName = entity.Exercise?.Name ?? "",
            ProgramId = null, // Not stored at set level in new schema
            ProgramExerciseId = entity.ProgramExerciseId,
            SetNumber = entity.SetNumber,
            Weight = entity.Weight,
            WeightUnit = "kg", // Default, could be stored in preferences
            Reps = entity.Reps,
            IsWarmup = entity.IsWarmup,
            RestSeconds = entity.RestSeconds,
            Notes = entity.Notes,
            LoggedAt = entity.CreatedAt,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = null
        };
    }
}

