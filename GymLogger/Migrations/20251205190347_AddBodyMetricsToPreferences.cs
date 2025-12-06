using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymLogger.Migrations
{
    /// <inheritdoc />
    public partial class AddBodyMetricsToPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Age",
                table: "UserPreferences",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "BodyWeight",
                table: "UserPreferences",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "UserPreferences",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Age",
                table: "UserPreferences");

            migrationBuilder.DropColumn(
                name: "BodyWeight",
                table: "UserPreferences");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "UserPreferences");
        }
    }
}
