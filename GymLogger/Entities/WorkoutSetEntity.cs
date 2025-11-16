using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GymLogger.Entities;

[Table("WorkoutSets")]
public class WorkoutSetEntity
{
    [Key]
    [MaxLength(36)]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    [MaxLength(36)]
    public string SessionId { get; set; } = string.Empty;

    [Required]
    [MaxLength(36)]
    public string ExerciseId { get; set; } = string.Empty;

    [MaxLength(36)]
    public string? ProgramExerciseId { get; set; } // NULL for ad-hoc sets

    [Required]
    public int SetNumber { get; set; }

    public decimal? Weight { get; set; }

    public int? Reps { get; set; }

    public bool IsWarmup { get; set; } = false;

    public int? RestSeconds { get; set; }

    [MaxLength(1000)]
    public string? Notes { get; set; }

    [Required]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey(nameof(SessionId))]
    public virtual WorkoutSessionEntity Session { get; set; } = null!;

    [ForeignKey(nameof(ExerciseId))]
    public virtual ExerciseEntity Exercise { get; set; } = null!;

    [ForeignKey(nameof(ProgramExerciseId))]
    public virtual ProgramExerciseEntity? ProgramExercise { get; set; }
}
