using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GymLogger.Entities;

[Table("Exercises")]
public class ExerciseEntity
{
    [Key]
    [MaxLength(36)]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [MaxLength(36)]
    public string? UserId { get; set; } // NULL for shared exercises

    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [MaxLength(100)]
    public string? Category { get; set; }

    [MaxLength(100)]
    public string? TargetMuscleGroup { get; set; }

    [MaxLength(100)]
    public string? Equipment { get; set; }

    public bool IsShared { get; set; } = false;

    [Required]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    [ForeignKey(nameof(UserId))]
    public virtual UserEntity? User { get; set; }

    public virtual ICollection<ProgramExerciseEntity> ProgramExercises { get; set; } = new List<ProgramExerciseEntity>();
    public virtual ICollection<WorkoutSetEntity> WorkoutSets { get; set; } = new List<WorkoutSetEntity>();
}
