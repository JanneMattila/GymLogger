using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GymLogger.Entities;

[Table("Programs")]
public class ProgramEntity
{
    [Key]
    [MaxLength(36)]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    [MaxLength(36)]
    public string UserId { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;

    public int? DayOfWeek { get; set; } // 0-6, NULL for unscheduled

    public bool IsDefault { get; set; } = false;

    [Required]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    [ForeignKey(nameof(UserId))]
    public virtual UserEntity User { get; set; } = null!;

    public virtual ICollection<ProgramExerciseEntity> ProgramExercises { get; set; } = new List<ProgramExerciseEntity>();
    public virtual ICollection<WorkoutSessionEntity> WorkoutSessions { get; set; } = new List<WorkoutSessionEntity>();
}
