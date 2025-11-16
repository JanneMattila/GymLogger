using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GymLogger.Entities;

[Table("Users")]
public class UserEntity
{
    [Key]
    [MaxLength(36)]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    [MaxLength(500)]
    public string ExternalId { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string AuthType { get; set; } = string.Empty; // "EntraID" or "Guest"

    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;

    public bool IsAdmin { get; set; } = false;

    [Required]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public virtual ICollection<ExerciseEntity> Exercises { get; set; } = new List<ExerciseEntity>();
    public virtual ICollection<ProgramEntity> Programs { get; set; } = new List<ProgramEntity>();
    public virtual ICollection<WorkoutSessionEntity> WorkoutSessions { get; set; } = new List<WorkoutSessionEntity>();
    public virtual UserPreferencesEntity? Preferences { get; set; }
}
