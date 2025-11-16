using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GymLogger.Entities;

[Table("ProgramExercises")]
public class ProgramExerciseEntity
{
    [Key]
    [MaxLength(36)]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    [MaxLength(36)]
    public string ProgramId { get; set; } = string.Empty;

    [Required]
    [MaxLength(36)]
    public string ExerciseId { get; set; } = string.Empty;

    [Required]
    public int OrderIndex { get; set; }

    [Required]
    public int Sets { get; set; }

    [Required]
    public int RepsMin { get; set; }

    [Required]
    public int RepsMax { get; set; }

    public decimal? TargetWeight { get; set; }

    public int? RestSeconds { get; set; }

    [MaxLength(1000)]
    public string? Notes { get; set; }

    [Required]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey(nameof(ProgramId))]
    public virtual ProgramEntity Program { get; set; } = null!;

    [ForeignKey(nameof(ExerciseId))]
    public virtual ExerciseEntity Exercise { get; set; } = null!;

    public virtual ICollection<WorkoutSetEntity> WorkoutSets { get; set; } = new List<WorkoutSetEntity>();
}
