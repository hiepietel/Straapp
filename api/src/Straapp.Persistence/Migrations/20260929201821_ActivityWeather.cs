using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Straapp.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ActivityWeather : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "activity_weather",
                columns: table => new
                {
                    activity_id = table.Column<long>(type: "bigint", nullable: false),
                    latitude = table.Column<double>(type: "double precision", nullable: false),
                    longitude = table.Column<double>(type: "double precision", nullable: false),
                    elevation = table.Column<double>(type: "double precision", nullable: true),
                    source = table.Column<string>(type: "text", nullable: false),
                    fetched_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_activity_weather", x => x.activity_id);
                    table.ForeignKey(
                        name: "fk_activity_weather_activities_activity_id",
                        column: x => x.activity_id,
                        principalTable: "activities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "weather_samples",
                columns: table => new
                {
                    activity_id = table.Column<long>(type: "bigint", nullable: false),
                    time = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    temperature = table.Column<double>(type: "double precision", nullable: true),
                    apparent_temperature = table.Column<double>(type: "double precision", nullable: true),
                    relative_humidity = table.Column<int>(type: "integer", nullable: true),
                    dew_point = table.Column<double>(type: "double precision", nullable: true),
                    precipitation = table.Column<double>(type: "double precision", nullable: true),
                    rain = table.Column<double>(type: "double precision", nullable: true),
                    snowfall = table.Column<double>(type: "double precision", nullable: true),
                    cloud_cover = table.Column<int>(type: "integer", nullable: true),
                    wind_speed = table.Column<double>(type: "double precision", nullable: true),
                    wind_direction = table.Column<int>(type: "integer", nullable: true),
                    wind_gusts = table.Column<double>(type: "double precision", nullable: true),
                    weather_code = table.Column<int>(type: "integer", nullable: true),
                    pressure = table.Column<double>(type: "double precision", nullable: true),
                    is_day = table.Column<bool>(type: "boolean", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_weather_samples", x => new { x.activity_id, x.time });
                    table.ForeignKey(
                        name: "fk_weather_samples_activity_weather_activity_id",
                        column: x => x.activity_id,
                        principalTable: "activity_weather",
                        principalColumn: "activity_id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "weather_samples");

            migrationBuilder.DropTable(
                name: "activity_weather");
        }
    }
}
