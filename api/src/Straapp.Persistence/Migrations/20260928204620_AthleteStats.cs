using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Straapp.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AthleteStats : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "stats_json",
                table: "athletes",
                type: "jsonb",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "stats_json",
                table: "athletes");
        }
    }
}
