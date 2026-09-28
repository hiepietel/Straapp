using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Straapp.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class StatisticsIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "ix_activities_athlete_id_start_date_local",
                table: "activities",
                columns: new[] { "athlete_id", "start_date_local" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_activities_athlete_id_start_date_local",
                table: "activities");
        }
    }
}
