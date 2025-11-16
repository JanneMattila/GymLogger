using GymLogger.Data;
using GymLogger.Entities;
using GymLogger.Models;
using Microsoft.EntityFrameworkCore;

namespace GymLogger.Repositories;

public class UserRepository
{
    private readonly GymLoggerDbContext _context;

    public UserRepository(GymLoggerDbContext context)
    {
        _context = context;
    }

    public async Task<UserPreferences?> GetPreferencesAsync(string userId)
    {
        var entity = await _context.UserPreferences
            .AsTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId);
        
        if (entity == null)
        {
            // Create default preferences
            entity = new UserPreferencesEntity
            {
                Id = Guid.NewGuid().ToString(),
                UserId = userId,
                DefaultWeightUnit = "KG",
                WeekStartDay = 0, // Sunday
                Theme = "light",
                WarmupPercentages = "[50,60,70,80,90]",
                WarmupReps = "[5,5,3,2,1]",
                WarmupSets = "[2,1,1,1,1]",
                WarmupBehavior = "ask",
                WarmupPreset = "standard",
                DefaultRestSeconds = 90,
                SoundEnabled = true,
                RestTimerDuration = 90,
                EnableNotifications = true,
                InboundIntegrationKey = Guid.NewGuid().ToString("N"), // Generate unique API key
                CreatedAt = DateTime.UtcNow
            };
            
            _context.UserPreferences.Add(entity);
            await _context.SaveChangesAsync();
        }
        
        return MapToUserPreferences(entity);
    }

    public async Task<UserPreferences> UpdatePreferencesAsync(string userId, UserPreferences preferences)
    {
        var entity = await _context.UserPreferences
            .AsTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId);
        
        if (entity == null)
        {
            // Create new preferences
            entity = new UserPreferencesEntity
            {
                Id = Guid.NewGuid().ToString(),
                UserId = userId,
                InboundIntegrationKey = Guid.NewGuid().ToString("N"), // Generate unique API key
                CreatedAt = DateTime.UtcNow
            };
            _context.UserPreferences.Add(entity);
        }
        
        // Update properties
        entity.DefaultWeightUnit = preferences.DefaultWeightUnit;
        entity.WeekStartDay = preferences.WeekStartDay;
        entity.Theme = preferences.Theme;
        entity.WarmupPercentages = System.Text.Json.JsonSerializer.Serialize(preferences.WarmupPercentages);
        entity.WarmupReps = System.Text.Json.JsonSerializer.Serialize(preferences.WarmupReps);
        entity.WarmupSets = System.Text.Json.JsonSerializer.Serialize(preferences.WarmupSets);
        entity.WarmupBehavior = preferences.WarmupBehavior;
        entity.WarmupPreset = preferences.WarmupPreset;
        entity.DefaultRestSeconds = preferences.DefaultRestSeconds;
        entity.SoundEnabled = preferences.SoundEnabled;
        entity.RestTimerDuration = preferences.RestTimerDuration;
        entity.EnableNotifications = preferences.EnableNotifications;
        entity.OutboundIntegrationEnabled = preferences.OutboundIntegrationEnabled;
        entity.OutboundIntegrationUrl = preferences.OutboundIntegrationUrl;
        entity.InboundIntegrationEnabled = preferences.InboundIntegrationEnabled;
        // Don't allow updating the API key from preferences - it's system-generated
        entity.UpdatedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync();
        return MapToUserPreferences(entity);
    }

    public async Task<User?> GetUserAsync(string userId)
    {
        var entity = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);
        
        return entity == null ? null : MapToUser(entity);
    }

    public async Task<User?> GetUserByExternalIdAsync(string externalId)
    {
        var entity = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.ExternalId == externalId);
        
        return entity == null ? null : MapToUser(entity);
    }

    public async Task<string> GetOrCreateAppUserIdAsync(string externalId, string authType, string userName)
    {
        // Try to find existing user by external ID
        var existingUser = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.ExternalId == externalId);
        
        if (existingUser != null)
        {
            return existingUser.Id;
        }

        // Create new user with internal app GUID
        var newUser = new UserEntity
        {
            Id = Guid.NewGuid().ToString(),
            ExternalId = externalId,
            AuthType = authType,
            Name = userName,
            IsAdmin = false,
            CreatedAt = DateTime.UtcNow
        };
        
        _context.Users.Add(newUser);
        await _context.SaveChangesAsync();
        
        return newUser.Id;
    }

    public async Task EnsureUserExistsAsync(string userId)
    {
        var user = await GetUserAsync(userId);
        if (user == null)
        {
            throw new InvalidOperationException("User should be created via GetOrCreateAppUserIdAsync");
        }
    }

    public async Task<List<(User User, UserPreferences? Preferences)>> GetAllUsersWithPreferencesAsync()
    {
        var users = await _context.Users
            .AsNoTracking()
            .ToListAsync();

        var result = new List<(User, UserPreferences?)>();
        
        foreach (var userEntity in users)
        {
            var user = MapToUser(userEntity);
            var prefs = await GetPreferencesAsync(userEntity.Id);
            result.Add((user, prefs));
        }

        return result;
    }
    
    // Mapping methods
    private static User MapToUser(UserEntity entity)
    {
        return new User
        {
            Id = entity.Id,
            ExternalId = entity.ExternalId,
            AuthType = entity.AuthType,
            Name = entity.Name,
            IsAdmin = entity.IsAdmin,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt
        };
    }
    
    private static UserPreferences MapToUserPreferences(UserPreferencesEntity entity)
    {
        var warmupPercentages = System.Text.Json.JsonSerializer.Deserialize<int[]>(entity.WarmupPercentages) ?? [50, 60, 70, 80, 90];
        var warmupReps = System.Text.Json.JsonSerializer.Deserialize<int[]>(entity.WarmupReps) ?? [5, 5, 3, 2, 1];
        var warmupSets = System.Text.Json.JsonSerializer.Deserialize<int[]>(entity.WarmupSets) ?? [2, 1, 1, 1, 1];
        
        return new UserPreferences
        {
            UserId = entity.UserId,
            DefaultWeightUnit = entity.DefaultWeightUnit,
            WeekStartDay = entity.WeekStartDay,
            Theme = entity.Theme,
            WarmupPercentages = warmupPercentages,
            WarmupReps = warmupReps,
            WarmupSets = warmupSets,
            WarmupBehavior = entity.WarmupBehavior,
            WarmupPreset = entity.WarmupPreset,
            DefaultRestSeconds = entity.DefaultRestSeconds,
            SoundEnabled = entity.SoundEnabled,
            RestTimerDuration = entity.RestTimerDuration,
            EnableNotifications = entity.EnableNotifications,
            OutboundIntegrationEnabled = entity.OutboundIntegrationEnabled,
            OutboundIntegrationUrl = entity.OutboundIntegrationUrl,
            InboundIntegrationEnabled = entity.InboundIntegrationEnabled,
            InboundIntegrationKey = entity.InboundIntegrationKey,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt
        };
    }
}

