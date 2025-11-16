using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymLogger.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: false),
                    ExternalId = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    AuthType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    IsAdmin = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Exercises",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: true),
                    Name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Category = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    TargetMuscleGroup = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Equipment = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsShared = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Exercises", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Exercises_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Programs",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    DayOfWeek = table.Column<int>(type: "int", nullable: true),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Programs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Programs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "UserPreferences",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: false),
                    DefaultWeightUnit = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    WeekStartDay = table.Column<int>(type: "int", nullable: false),
                    Theme = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    WarmupPercentages = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    WarmupReps = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    WarmupSets = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    WarmupBehavior = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    WarmupPreset = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DefaultRestSeconds = table.Column<int>(type: "int", nullable: false),
                    SoundEnabled = table.Column<bool>(type: "bit", nullable: false),
                    RestTimerDuration = table.Column<int>(type: "int", nullable: false),
                    EnableNotifications = table.Column<bool>(type: "bit", nullable: false),
                    OutboundIntegrationEnabled = table.Column<bool>(type: "bit", nullable: false),
                    OutboundIntegrationUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    InboundIntegrationEnabled = table.Column<bool>(type: "bit", nullable: false),
                    InboundIntegrationKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserPreferences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserPreferences_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProgramExercises",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: false),
                    ProgramId = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: false),
                    ExerciseId = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: false),
                    OrderIndex = table.Column<int>(type: "int", nullable: false),
                    Sets = table.Column<int>(type: "int", nullable: false),
                    RepsMin = table.Column<int>(type: "int", nullable: false),
                    RepsMax = table.Column<int>(type: "int", nullable: false),
                    TargetWeight = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    RestSeconds = table.Column<int>(type: "int", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgramExercises", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgramExercises_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProgramExercises_Programs_ProgramId",
                        column: x => x.ProgramId,
                        principalTable: "Programs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkoutSessions",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: false),
                    ProgramId = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: true),
                    ProgramName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    SessionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TotalSets = table.Column<int>(type: "int", nullable: false),
                    TotalReps = table.Column<int>(type: "int", nullable: false),
                    TotalVolume = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DurationSeconds = table.Column<int>(type: "int", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkoutSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkoutSessions_Programs_ProgramId",
                        column: x => x.ProgramId,
                        principalTable: "Programs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_WorkoutSessions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "WorkoutSets",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: false),
                    SessionId = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: false),
                    ExerciseId = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: false),
                    ProgramExerciseId = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: true),
                    SetNumber = table.Column<int>(type: "int", nullable: false),
                    Weight = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    Reps = table.Column<int>(type: "int", nullable: true),
                    IsWarmup = table.Column<bool>(type: "bit", nullable: false),
                    RestSeconds = table.Column<int>(type: "int", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkoutSets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkoutSets_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkoutSets_ProgramExercises_ProgramExerciseId",
                        column: x => x.ProgramExerciseId,
                        principalTable: "ProgramExercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_WorkoutSets_WorkoutSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "WorkoutSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_Category",
                table: "Exercises",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_IsShared",
                table: "Exercises",
                column: "IsShared",
                filter: "IsShared = 1");

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_TargetMuscleGroup",
                table: "Exercises",
                column: "TargetMuscleGroup");

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_UserId",
                table: "Exercises",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "idx_programexercises_order",
                table: "ProgramExercises",
                columns: new[] { "ProgramId", "OrderIndex" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProgramExercises_ExerciseId",
                table: "ProgramExercises",
                column: "ExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgramExercises_ProgramId",
                table: "ProgramExercises",
                column: "ProgramId");

            migrationBuilder.CreateIndex(
                name: "idx_programs_user_default",
                table: "Programs",
                column: "UserId",
                unique: true,
                filter: "IsDefault = 1");

            migrationBuilder.CreateIndex(
                name: "IX_Programs_DayOfWeek",
                table: "Programs",
                column: "DayOfWeek");

            migrationBuilder.CreateIndex(
                name: "IX_UserPreferences_UserId",
                table: "UserPreferences",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_ExternalId",
                table: "Users",
                column: "ExternalId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_sessions_user_date",
                table: "WorkoutSessions",
                columns: new[] { "UserId", "SessionDate" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSessions_ProgramId",
                table: "WorkoutSessions",
                column: "ProgramId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSessions_SessionDate",
                table: "WorkoutSessions",
                column: "SessionDate");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSessions_Status",
                table: "WorkoutSessions",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSessions_UserId",
                table: "WorkoutSessions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSets_ExerciseId",
                table: "WorkoutSets",
                column: "ExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSets_ProgramExerciseId",
                table: "WorkoutSets",
                column: "ProgramExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSets_SessionId",
                table: "WorkoutSets",
                column: "SessionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserPreferences");

            migrationBuilder.DropTable(
                name: "WorkoutSets");

            migrationBuilder.DropTable(
                name: "ProgramExercises");

            migrationBuilder.DropTable(
                name: "WorkoutSessions");

            migrationBuilder.DropTable(
                name: "Exercises");

            migrationBuilder.DropTable(
                name: "Programs");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
