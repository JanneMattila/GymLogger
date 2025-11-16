using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GymLogger.Entities;

[Table("WorkoutSessions")]
public class WorkoutSessionEntity
{
    [Key]
    [MaxLength(36)]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    [MaxLength(36)]
    public string UserId { get; set; } = string.Empty;

    [MaxLength(36)]
    public string? ProgramId { get; set; }

    [Required]
    [MaxLength(255)]
    public string ProgramName { get; set; } = string.Empty; // Denormalized for history

    [Required]
    public DateTime SessionDate { get; set; }

    [Required]
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;

    public DateTime? CompletedAt { get; set; }

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "in-progress"; // in-progress, completed, cancelled

    public int TotalSets { get; set; } = 0;

    public int TotalReps { get; set; } = 0;

    public decimal TotalVolume { get; set; } = 0;

    public int? DurationSeconds { get; set; }

    [MaxLength(2000)]
    public string? Notes { get; set; }

    [Required]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    [ForeignKey(nameof(UserId))]
    public virtual UserEntity User { get; set; } = null!;

    [ForeignKey(nameof(ProgramId))]
    public virtual ProgramEntity? Program { get; set; }

    public virtual ICollection<WorkoutSetEntity> WorkoutSets { get; set; } = new List<WorkoutSetEntity>();
}
