using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymLogger.Migrations
{
    /// <inheritdoc />
    public partial class AddKeepScreenAwakePreference : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "KeepScreenAwake",
                table: "UserPreferences",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "KeepScreenAwake",
                table: "UserPreferences");
        }
    }
}
