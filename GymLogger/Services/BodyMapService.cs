using System.Text.Json;
using GymLogger.Models;
using GymLogger.Repositories;

namespace GymLogger.Services;

/// <summary>
/// Service for calculating muscle group advancement levels based on lifting statistics
/// and user body metrics (weight, gender, age).
/// 
/// Advancement levels are determined by comparing the user's strength (estimated 1RM)
/// relative to their body weight against established strength standards loaded from
/// the strength-standards.json file.
/// </summary>
public class BodyMapService
{
    private readonly StatsService _statsService;
    private readonly ExerciseRepository _exerciseRepo;
    private readonly UserRepository _userRepo;
    private readonly IWebHostEnvironment _environment;
    private StrengthStandards? _cachedStandards;
    private readonly object _cacheLock = new();

    public BodyMapService(StatsService statsService, ExerciseRepository exerciseRepo, UserRepository userRepo, IWebHostEnvironment environment)
    {
        _statsService = statsService;
        _exerciseRepo = exerciseRepo;
        _userRepo = userRepo;
        _environment = environment;
    }

    /// <summary>
    /// Get the strength standards data (used by both server and exposed to client)
    /// </summary>
    public StrengthStandards GetStrengthStandards()
    {
        if (_cachedStandards != null)
            return _cachedStandards;

        lock (_cacheLock)
        {
            if (_cachedStandards != null)
                return _cachedStandards;

            var filePath = Path.Combine(_environment.ContentRootPath, "strength-standards.json");
            var json = File.ReadAllText(filePath);
            _cachedStandards = JsonSerializer.Deserialize<StrengthStandards>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }) ?? throw new InvalidOperationException("Failed to load strength standards");

            return _cachedStandards;
        }
    }

    /// <summary>
    /// Get muscle group advancement data for body map visualization
    /// </summary>
    public async Task<BodyMapResponse> GetBodyMapDataAsync(string userId)
    {
        var preferences = await _userRepo.GetPreferencesAsync(userId);
        var stats = await _statsService.GetStatsByExerciseAsync(userId);
        var exercises = await _exerciseRepo.GetAllExercisesAsync(userId);
        
        var exerciseMap = exercises.ToDictionary(e => e.Id, e => e);
        
        // Group stats by muscle group
        var statsByMuscle = stats
            .Where(s => s.Epley1RM.HasValue)
            .GroupBy(s => exerciseMap.TryGetValue(s.ExerciseId, out var ex) ? ex.MuscleGroup ?? "Other" : "Other")
            .ToDictionary(g => g.Key, g => g.ToList());

        // Define all muscle groups that should appear on body map
        var allMuscleGroups = new[] { "Chest", "Back", "Shoulders", "Arms", "Legs", "Core" };
        
        var muscleAdvancements = new List<MuscleAdvancement>();
        
        foreach (var muscleGroup in allMuscleGroups)
        {
            var advancement = CalculateMuscleAdvancement(
                muscleGroup,
                statsByMuscle.GetValueOrDefault(muscleGroup) ?? new List<ExerciseStats>(),
                preferences?.BodyWeight,
                preferences?.Gender,
                preferences?.Age
            );
            muscleAdvancements.Add(advancement);
        }
        
        return new BodyMapResponse
        {
            MuscleAdvancements = muscleAdvancements,
            HasBodyMetrics = preferences?.BodyWeight.HasValue == true,
            BodyWeight = preferences?.BodyWeight,
            Gender = preferences?.Gender,
            Age = preferences?.Age
        };
    }

    private MuscleAdvancement CalculateMuscleAdvancement(
        string muscleGroup, 
        List<ExerciseStats> stats, 
        decimal? bodyWeight, 
        string? gender, 
        int? age)
    {
        var advancement = new MuscleAdvancement
        {
            MuscleGroup = muscleGroup,
            ExerciseCount = stats.Count
        };
        
        if (stats.Count == 0)
        {
            advancement.Level = AdvancementLevels.NoData;
            advancement.LevelName = AdvancementLevels.GetLevelName(AdvancementLevels.NoData);
            return advancement;
        }
        
        // Find the best 1RM in this muscle group
        var bestStat = stats.OrderByDescending(s => s.Epley1RM ?? 0).First();
        advancement.Best1RM = bestStat.Epley1RM;
        advancement.BestExerciseName = bestStat.Name;
        
        // Calculate total sets (approximation based on having stats means sets were done)
        advancement.TotalSetsLogged = stats.Count * 3; // Rough estimate
        
        // Calculate strength ratio if body weight is available
        if (bodyWeight.HasValue && bodyWeight.Value > 0 && advancement.Best1RM.HasValue)
        {
            advancement.StrengthRatio = Math.Round(advancement.Best1RM.Value / bodyWeight.Value, 2);
        }
        
        // Calculate level based on strength standards
        advancement.Level = CalculateLevel(muscleGroup, advancement.Best1RM, bodyWeight, gender, age);
        advancement.LevelName = AdvancementLevels.GetLevelName(advancement.Level);
        
        return advancement;
    }

    /// <summary>
    /// Calculate advancement level based on strength standards from JSON file.
    /// Uses relative strength (weight lifted / body weight) when body weight is available,
    /// otherwise uses absolute weight thresholds with assumed body weight.
    /// </summary>
    private int CalculateLevel(string muscleGroup, decimal? best1RM, decimal? bodyWeight, string? gender, int? age)
    {
        if (!best1RM.HasValue || best1RM.Value <= 0)
            return AdvancementLevels.NoData;

        var standards = GetStrengthStandards();
        var ageGroupId = GetAgeGroupId(age, standards);
        var genderKey = string.IsNullOrEmpty(gender) ? standards.DefaultGender : gender;

        // If body weight is available, use relative strength standards
        if (bodyWeight.HasValue && bodyWeight.Value > 0)
        {
            var ratio = best1RM.Value / bodyWeight.Value;
            return CalculateLevelByRatio(muscleGroup, ratio, genderKey, ageGroupId, standards);
        }
        
        // Fallback to absolute weight thresholds (less accurate)
        return CalculateLevelByAbsoluteWeight(muscleGroup, best1RM.Value, genderKey, ageGroupId, standards);
    }

    /// <summary>
    /// Get the age group ID based on the user's age
    /// </summary>
    private string GetAgeGroupId(int? age, StrengthStandards standards)
    {
        if (!age.HasValue)
            return standards.DefaultAgeGroup;

        foreach (var ageGroup in standards.AgeGroups)
        {
            var minMatches = !ageGroup.MinAge.HasValue || age.Value >= ageGroup.MinAge.Value;
            var maxMatches = !ageGroup.MaxAge.HasValue || age.Value <= ageGroup.MaxAge.Value;
            
            if (minMatches && maxMatches)
                return ageGroup.Id;
        }

        return standards.DefaultAgeGroup;
    }

    /// <summary>
    /// Calculate level based on strength-to-bodyweight ratio using JSON standards
    /// </summary>
    private int CalculateLevelByRatio(string muscleGroup, decimal ratio, string gender, string ageGroupId, StrengthStandards standards)
    {
        var thresholds = GetThresholdsFromStandards(muscleGroup, gender, ageGroupId, standards);
        
        if (thresholds == null)
            return AdvancementLevels.Beginner;
        
        if (ratio >= thresholds.Elite) return AdvancementLevels.Elite;
        if (ratio >= thresholds.Advanced) return AdvancementLevels.Advanced;
        if (ratio >= thresholds.Intermediate) return AdvancementLevels.Intermediate;
        if (ratio >= thresholds.Novice) return AdvancementLevels.Novice;
        return AdvancementLevels.Beginner;
    }

    /// <summary>
    /// Fallback calculation using absolute weight (less accurate without body weight)
    /// </summary>
    private int CalculateLevelByAbsoluteWeight(string muscleGroup, decimal weight, string gender, string ageGroupId, StrengthStandards standards)
    {
        var isFemale = string.Equals(gender, "Female", StringComparison.OrdinalIgnoreCase);
        var avgBodyWeight = isFemale ? 60m : 80m;
        
        var ratio = weight / avgBodyWeight;
        return CalculateLevelByRatio(muscleGroup, ratio, gender, ageGroupId, standards);
    }

    /// <summary>
    /// Get thresholds from the strength standards JSON for a specific muscle group, gender, and age group
    /// </summary>
    private LevelThresholds? GetThresholdsFromStandards(string muscleGroup, string gender, string ageGroupId, StrengthStandards standards)
    {
        if (!standards.MuscleGroups.TryGetValue(muscleGroup, out var muscleStandards))
            return null;

        if (!muscleStandards.Standards.TryGetValue(gender, out var genderStandards))
        {
            // Fallback to default gender
            if (!muscleStandards.Standards.TryGetValue(standards.DefaultGender, out genderStandards))
                return null;
        }

        if (!genderStandards.TryGetValue(ageGroupId, out var thresholds))
        {
            // Fallback to default age group
            genderStandards.TryGetValue(standards.DefaultAgeGroup, out thresholds);
        }

        return thresholds;
    }
}
