using GymLogger.Models;
using GymLogger.Repositories;

namespace GymLogger.Services;

public class StatsService
{
    private readonly SessionRepository _sessionRepo;
    private readonly ExerciseRepository _exerciseRepo;

    public StatsService(SessionRepository sessionRepo, ExerciseRepository exerciseRepo)
    {
        _sessionRepo = sessionRepo;
        _exerciseRepo = exerciseRepo;
    }

    public async Task<List<ExerciseStats>> GetStatsByExerciseAsync(string userId)
    {
        var sessions = await _sessionRepo.GetSessionsAsync(userId);
        var exercises = await _exerciseRepo.GetAllExercisesAsync(userId);
        var stats = new Dictionary<string, ExerciseStats>();

        foreach (var session in sessions.Where(s => s.Status == "completed"))
        {
            var sets = await _sessionRepo.GetSetsForSessionAsync(userId, session.Id);
            var workingSets = sets.Where(s => !s.IsWarmup && s.Reps.HasValue && s.Weight.HasValue).ToList();

            foreach (var set in workingSets)
            {
                if (!stats.ContainsKey(set.ExerciseId))
                {
                    var exercise = exercises.FirstOrDefault(e => e.Id == set.ExerciseId);
                    stats[set.ExerciseId] = new ExerciseStats
                    {
                        ExerciseId = set.ExerciseId,
                        Name = exercise?.Name ?? set.ExerciseName
                    };
                }

                var stat = stats[set.ExerciseId];
                
                if (!set.Weight.HasValue || string.IsNullOrEmpty(set.WeightUnit))
                    continue;
                
                var weightInKg = ConvertToKilograms(set.Weight.Value, set.WeightUnit);

                // Max Weight
                if (!stat.MaxWeight.HasValue || weightInKg > stat.MaxWeight.Value)
                {
                    stat.MaxWeight = weightInKg;
                    stat.MaxWeightDate = session.SessionDate;
                }

                // Epley 1RM: weight × (1 + reps/30)
                if (set.Reps.HasValue && set.Reps.Value > 0)
                {
                    var epley = weightInKg * (1 + set.Reps.Value / 30m);
                    if (!stat.Epley1RM.HasValue || epley > stat.Epley1RM.Value)
                    {
                        stat.Epley1RM = epley;
                        stat.Epley1RMDate = session.SessionDate;
                    }

                    // Brzycki 1RM: weight × (36/(37-reps))
                    if (set.Reps.Value < 37)
                    {
                        var brzycki = weightInKg * (36m / (37m - set.Reps.Value));
                        if (!stat.Brzycki1RM.HasValue || brzycki > stat.Brzycki1RM.Value)
                        {
                            stat.Brzycki1RM = brzycki;
                            stat.Brzycki1RMDate = session.SessionDate;
                        }
                    }
                }
            }

            // Calculate max volume per session
            var volumeByExercise = workingSets
                .GroupBy(s => s.ExerciseId)
                .Select(g => new
                {
                    ExerciseId = g.Key,
                        Volume = g.Sum(s =>
                        {
                            var weight = ConvertToKilograms(s.Weight!.Value, s.WeightUnit);
                            return weight * s.Reps!.Value;
                        })
                });

            foreach (var vol in volumeByExercise)
            {
                if (stats.ContainsKey(vol.ExerciseId))
                {
                    var stat = stats[vol.ExerciseId];
                    if (!stat.MaxVolume.HasValue || vol.Volume > stat.MaxVolume.Value)
                    {
                        stat.MaxVolume = vol.Volume;
                        stat.MaxVolumeDate = session.SessionDate;
                    }
                }
            }
        }

        return stats.Values.OrderBy(s => s.Name).ToList();
    }

    public async Task<List<ExerciseStats>> GetStatsByProgramAsync(string userId, string programId)
    {
        var allStats = await GetStatsByExerciseAsync(userId);
        var sessions = await _sessionRepo.GetSessionsAsync(userId);
        
        // Get all exercise IDs used in this program
        var exerciseIds = new HashSet<string>();
        foreach (var session in sessions.Where(s => s.Status == "completed"))
        {
            var sets = await _sessionRepo.GetSetsForSessionAsync(userId, session.Id);
            foreach (var set in sets.Where(s => s.ProgramId == programId))
            {
                exerciseIds.Add(set.ExerciseId);
            }
        }

        return allStats.Where(s => exerciseIds.Contains(s.ExerciseId)).ToList();
    }

    public async Task<List<ExerciseStats>> GetStatsByMuscleGroupAsync(string userId, string muscleGroup)
    {
        var allStats = await GetStatsByExerciseAsync(userId);
        var exercises = await _exerciseRepo.GetAllExercisesAsync(userId);
        
        var exerciseIds = exercises
            .Where(e => e.MuscleGroup?.Equals(muscleGroup, StringComparison.OrdinalIgnoreCase) == true)
            .Select(e => e.Id)
            .ToHashSet();

        return allStats.Where(s => exerciseIds.Contains(s.ExerciseId)).ToList();
    }

    public async Task<List<HistoryDataPoint>> GetExerciseHistoryAsync(string userId, string exerciseId)
    {
        var sessions = await _sessionRepo.GetSessionsAsync(userId);
        var history = new List<HistoryDataPoint>();

        foreach (var session in sessions.Where(s => s.Status == "completed").OrderBy(s => s.SessionDate))
        {
            var sets = await _sessionRepo.GetSetsForSessionAsync(userId, session.Id);
            var exerciseSets = sets.Where(s => s.ExerciseId == exerciseId && !s.IsWarmup && s.Reps.HasValue && s.Weight.HasValue).ToList();

            if (exerciseSets.Any())
            {
                var dataPoint = new HistoryDataPoint
                {
                    Date = session.SessionDate,
                    Sets = exerciseSets.Select(s =>
                        {
                            var weightInKg = ConvertToKilograms(s.Weight!.Value, s.WeightUnit);
                            return new SetData
                            {
                                Weight = weightInKg,
                                Reps = s.Reps!.Value,
                                Volume = weightInKg * s.Reps.Value
                            };
                        }).ToList()
                };
                history.Add(dataPoint);
            }
        }

        return history;
    }

    private static decimal ConvertToKilograms(decimal weight, string? weightUnit)
    {
        if (string.IsNullOrWhiteSpace(weightUnit))
        {
            return weight;
        }

        if (weightUnit.Equals("KG", StringComparison.OrdinalIgnoreCase) ||
            weightUnit.Equals("KGS", StringComparison.OrdinalIgnoreCase))
        {
            return weight;
        }

        if (weightUnit.StartsWith("LB", StringComparison.OrdinalIgnoreCase))
        {
            return weight / 2.20462m;
        }

        return weight;
    }
}
