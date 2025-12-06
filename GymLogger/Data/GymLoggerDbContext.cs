using Microsoft.EntityFrameworkCore;
using GymLogger.Entities;

namespace GymLogger.Data;

public class GymLoggerDbContext : DbContext
{
    public GymLoggerDbContext(DbContextOptions<GymLoggerDbContext> options)
        : base(options)
    {
    }

    public DbSet<UserEntity> Users { get; set; } = null!;
    public DbSet<ExerciseEntity> Exercises { get; set; } = null!;
    public DbSet<ProgramEntity> Programs { get; set; } = null!;
    public DbSet<ProgramExerciseEntity> ProgramExercises { get; set; } = null!;
    public DbSet<WorkoutSessionEntity> WorkoutSessions { get; set; } = null!;
    public DbSet<WorkoutSetEntity> WorkoutSets { get; set; } = null!;
    public DbSet<UserPreferencesEntity> UserPreferences { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User configurations
        modelBuilder.Entity<UserEntity>(entity =>
        {
            entity.HasIndex(e => e.ExternalId).IsUnique();
            
            entity.HasMany(e => e.Exercises)
                .WithOne(e => e.User)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.NoAction);

            entity.HasMany(e => e.Programs)
                .WithOne(e => e.User)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.NoAction);

            entity.HasMany(e => e.WorkoutSessions)
                .WithOne(e => e.User)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(e => e.Preferences)
                .WithOne(e => e.User)
                .HasForeignKey<UserPreferencesEntity>(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Exercise configurations
        modelBuilder.Entity<ExerciseEntity>(entity =>
        {
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.IsShared).HasFilter("IsShared = 1");
            entity.HasIndex(e => e.Category);
            entity.HasIndex(e => e.TargetMuscleGroup);
        });

        // Program configurations
        modelBuilder.Entity<ProgramEntity>(entity =>
        {
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.DayOfWeek);
            
            // Unique index for default program per user
            entity.HasIndex(e => e.UserId)
                .IsUnique()
                .HasFilter("IsDefault = 1")
                .HasDatabaseName("idx_programs_user_default");

            entity.HasMany(e => e.ProgramExercises)
                .WithOne(e => e.Program)
                .HasForeignKey(e => e.ProgramId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(e => e.WorkoutSessions)
                .WithOne(e => e.Program)
                .HasForeignKey(e => e.ProgramId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ProgramExercise configurations
        modelBuilder.Entity<ProgramExerciseEntity>(entity =>
        {
            entity.HasIndex(e => e.ProgramId);
            entity.HasIndex(e => e.ExerciseId);
            
            entity.HasIndex(e => new { e.ProgramId, e.OrderIndex })
                .IsUnique()
                .HasDatabaseName("idx_programexercises_order");

            entity.HasOne(e => e.Exercise)
                .WithMany(e => e.ProgramExercises)
                .HasForeignKey(e => e.ExerciseId)
                .OnDelete(DeleteBehavior.Restrict);

            // Configure decimal precision for SQL Server
            entity.Property(e => e.TargetWeight)
                .HasPrecision(18, 2);
        });

        // WorkoutSession configurations
        modelBuilder.Entity<WorkoutSessionEntity>(entity =>
        {
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.ProgramId);
            entity.HasIndex(e => e.SessionDate);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => new { e.UserId, e.SessionDate })
                .HasDatabaseName("idx_sessions_user_date");

            entity.HasMany(e => e.WorkoutSets)
                .WithOne(e => e.Session)
                .HasForeignKey(e => e.SessionId)
                .OnDelete(DeleteBehavior.Cascade);

            // Configure decimal precision for SQL Server
            entity.Property(e => e.TotalVolume)
                .HasPrecision(18, 2);

            // SQL Server doesn't allow multiple cascade paths
            entity.HasOne(e => e.User)
                .WithMany(e => e.WorkoutSessions)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        // WorkoutSet configurations
        modelBuilder.Entity<WorkoutSetEntity>(entity =>
        {
            entity.HasIndex(e => e.SessionId);
            entity.HasIndex(e => e.ExerciseId);
            entity.HasIndex(e => e.ProgramExerciseId);

            entity.HasOne(e => e.Exercise)
                .WithMany(e => e.WorkoutSets)
                .HasForeignKey(e => e.ExerciseId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.ProgramExercise)
                .WithMany(e => e.WorkoutSets)
                .HasForeignKey(e => e.ProgramExerciseId)
                .OnDelete(DeleteBehavior.SetNull);

            // Configure decimal precision for SQL Server
            entity.Property(e => e.Weight)
                .HasPrecision(18, 2);
        });

        // UserPreferences configurations
        modelBuilder.Entity<UserPreferencesEntity>(entity =>
        {
            entity.HasIndex(e => e.UserId).IsUnique();

            // Configure decimal precision for SQL Server
            entity.Property(e => e.BodyWeight)
                .HasPrecision(18, 2);
        });
    }
}
