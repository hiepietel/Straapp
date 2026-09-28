using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Straapp.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "activities",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false),
                    athlete_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    sport_type = table.Column<string>(type: "text", nullable: true),
                    type = table.Column<string>(type: "text", nullable: true),
                    workout_type = table.Column<int>(type: "integer", nullable: true),
                    start_date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    start_date_local = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    timezone = table.Column<string>(type: "text", nullable: true),
                    utc_offset = table.Column<double>(type: "double precision", nullable: true),
                    distance = table.Column<double>(type: "double precision", nullable: false),
                    moving_time = table.Column<int>(type: "integer", nullable: false),
                    elapsed_time = table.Column<int>(type: "integer", nullable: false),
                    total_elevation_gain = table.Column<double>(type: "double precision", nullable: false),
                    elev_high = table.Column<double>(type: "double precision", nullable: true),
                    elev_low = table.Column<double>(type: "double precision", nullable: true),
                    average_speed = table.Column<double>(type: "double precision", nullable: false),
                    max_speed = table.Column<double>(type: "double precision", nullable: true),
                    average_heartrate = table.Column<double>(type: "double precision", nullable: true),
                    max_heartrate = table.Column<double>(type: "double precision", nullable: true),
                    average_cadence = table.Column<double>(type: "double precision", nullable: true),
                    average_watts = table.Column<double>(type: "double precision", nullable: true),
                    weighted_average_watts = table.Column<double>(type: "double precision", nullable: true),
                    max_watts = table.Column<double>(type: "double precision", nullable: true),
                    device_watts = table.Column<bool>(type: "boolean", nullable: true),
                    kilojoules = table.Column<double>(type: "double precision", nullable: true),
                    calories = table.Column<double>(type: "double precision", nullable: true),
                    average_temp = table.Column<double>(type: "double precision", nullable: true),
                    suffer_score = table.Column<double>(type: "double precision", nullable: true),
                    start_latitude = table.Column<double>(type: "double precision", nullable: true),
                    start_longitude = table.Column<double>(type: "double precision", nullable: true),
                    end_latitude = table.Column<double>(type: "double precision", nullable: true),
                    end_longitude = table.Column<double>(type: "double precision", nullable: true),
                    location_country = table.Column<string>(type: "text", nullable: true),
                    summary_polyline = table.Column<string>(type: "text", nullable: true),
                    polyline = table.Column<string>(type: "text", nullable: true),
                    kudos_count = table.Column<int>(type: "integer", nullable: false),
                    comment_count = table.Column<int>(type: "integer", nullable: false),
                    achievement_count = table.Column<int>(type: "integer", nullable: false),
                    pr_count = table.Column<int>(type: "integer", nullable: false),
                    athlete_count = table.Column<int>(type: "integer", nullable: false),
                    photo_count = table.Column<int>(type: "integer", nullable: false),
                    trainer = table.Column<bool>(type: "boolean", nullable: false),
                    commute = table.Column<bool>(type: "boolean", nullable: false),
                    manual = table.Column<bool>(type: "boolean", nullable: false),
                    @private = table.Column<bool>(name: "private", type: "boolean", nullable: false),
                    visibility = table.Column<string>(type: "text", nullable: true),
                    gear_id = table.Column<string>(type: "text", nullable: true),
                    device_name = table.Column<string>(type: "text", nullable: true),
                    raw_json = table.Column<string>(type: "jsonb", nullable: false),
                    synced_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_activities", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "athletes",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false),
                    username = table.Column<string>(type: "text", nullable: true),
                    firstname = table.Column<string>(type: "text", nullable: true),
                    lastname = table.Column<string>(type: "text", nullable: true),
                    city = table.Column<string>(type: "text", nullable: true),
                    country = table.Column<string>(type: "text", nullable: true),
                    sex = table.Column<string>(type: "text", nullable: true),
                    premium = table.Column<bool>(type: "boolean", nullable: false),
                    weight = table.Column<double>(type: "double precision", nullable: true),
                    ftp = table.Column<int>(type: "integer", nullable: true),
                    measurement_preference = table.Column<string>(type: "text", nullable: true),
                    profile_url = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    raw_json = table.Column<string>(type: "jsonb", nullable: false),
                    zones_json = table.Column<string>(type: "jsonb", nullable: true),
                    synced_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_athletes", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "gear",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    athlete_id = table.Column<long>(type: "bigint", nullable: false),
                    kind = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: true),
                    nickname = table.Column<string>(type: "text", nullable: true),
                    brand_name = table.Column<string>(type: "text", nullable: true),
                    model_name = table.Column<string>(type: "text", nullable: true),
                    description = table.Column<string>(type: "text", nullable: true),
                    distance = table.Column<double>(type: "double precision", nullable: false),
                    primary = table.Column<bool>(type: "boolean", nullable: false),
                    retired = table.Column<bool>(type: "boolean", nullable: false),
                    raw_json = table.Column<string>(type: "jsonb", nullable: false),
                    synced_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_gear", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "activity_comments",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false),
                    activity_id = table.Column<long>(type: "bigint", nullable: false),
                    athlete_id = table.Column<long>(type: "bigint", nullable: true),
                    athlete_name = table.Column<string>(type: "text", nullable: true),
                    text = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_activity_comments", x => x.id);
                    table.ForeignKey(
                        name: "fk_activity_comments_activities_activity_id",
                        column: x => x.activity_id,
                        principalTable: "activities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "activity_efforts",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false),
                    activity_id = table.Column<long>(type: "bigint", nullable: false),
                    kind = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: true),
                    segment_id = table.Column<long>(type: "bigint", nullable: true),
                    start_date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    elapsed_time = table.Column<int>(type: "integer", nullable: false),
                    moving_time = table.Column<int>(type: "integer", nullable: false),
                    distance = table.Column<double>(type: "double precision", nullable: false),
                    start_index = table.Column<int>(type: "integer", nullable: true),
                    end_index = table.Column<int>(type: "integer", nullable: true),
                    average_heartrate = table.Column<double>(type: "double precision", nullable: true),
                    max_heartrate = table.Column<double>(type: "double precision", nullable: true),
                    average_watts = table.Column<double>(type: "double precision", nullable: true),
                    average_cadence = table.Column<double>(type: "double precision", nullable: true),
                    pr_rank = table.Column<int>(type: "integer", nullable: true),
                    kom_rank = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_activity_efforts", x => new { x.activity_id, x.kind, x.id });
                    table.ForeignKey(
                        name: "fk_activity_efforts_activities_activity_id",
                        column: x => x.activity_id,
                        principalTable: "activities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "activity_kudos",
                columns: table => new
                {
                    activity_id = table.Column<long>(type: "bigint", nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false),
                    firstname = table.Column<string>(type: "text", nullable: true),
                    lastname = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_activity_kudos", x => new { x.activity_id, x.position });
                    table.ForeignKey(
                        name: "fk_activity_kudos_activities_activity_id",
                        column: x => x.activity_id,
                        principalTable: "activities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "activity_laps",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false),
                    activity_id = table.Column<long>(type: "bigint", nullable: false),
                    lap_index = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "text", nullable: true),
                    start_date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    elapsed_time = table.Column<int>(type: "integer", nullable: false),
                    moving_time = table.Column<int>(type: "integer", nullable: false),
                    distance = table.Column<double>(type: "double precision", nullable: false),
                    start_index = table.Column<int>(type: "integer", nullable: true),
                    end_index = table.Column<int>(type: "integer", nullable: true),
                    total_elevation_gain = table.Column<double>(type: "double precision", nullable: true),
                    average_speed = table.Column<double>(type: "double precision", nullable: true),
                    max_speed = table.Column<double>(type: "double precision", nullable: true),
                    average_cadence = table.Column<double>(type: "double precision", nullable: true),
                    average_watts = table.Column<double>(type: "double precision", nullable: true),
                    average_heartrate = table.Column<double>(type: "double precision", nullable: true),
                    max_heartrate = table.Column<double>(type: "double precision", nullable: true),
                    pace_zone = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_activity_laps", x => new { x.activity_id, x.id });
                    table.ForeignKey(
                        name: "fk_activity_laps_activities_activity_id",
                        column: x => x.activity_id,
                        principalTable: "activities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "activity_splits",
                columns: table => new
                {
                    activity_id = table.Column<long>(type: "bigint", nullable: false),
                    unit = table.Column<string>(type: "text", nullable: false),
                    index = table.Column<int>(type: "integer", nullable: false),
                    distance = table.Column<double>(type: "double precision", nullable: false),
                    elapsed_time = table.Column<int>(type: "integer", nullable: false),
                    moving_time = table.Column<int>(type: "integer", nullable: false),
                    elevation_difference = table.Column<double>(type: "double precision", nullable: true),
                    average_speed = table.Column<double>(type: "double precision", nullable: false),
                    average_grade_adjusted_speed = table.Column<double>(type: "double precision", nullable: true),
                    average_heartrate = table.Column<double>(type: "double precision", nullable: true),
                    pace_zone = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_activity_splits", x => new { x.activity_id, x.unit, x.index });
                    table.ForeignKey(
                        name: "fk_activity_splits_activities_activity_id",
                        column: x => x.activity_id,
                        principalTable: "activities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "activity_streams",
                columns: table => new
                {
                    activity_id = table.Column<long>(type: "bigint", nullable: false),
                    series_type = table.Column<string>(type: "text", nullable: true),
                    resolution = table.Column<string>(type: "text", nullable: true),
                    original_size = table.Column<int>(type: "integer", nullable: false),
                    time = table.Column<int[]>(type: "integer[]", nullable: true),
                    distance = table.Column<double[]>(type: "double precision[]", nullable: true),
                    latitude = table.Column<double[]>(type: "double precision[]", nullable: true),
                    longitude = table.Column<double[]>(type: "double precision[]", nullable: true),
                    altitude = table.Column<double[]>(type: "double precision[]", nullable: true),
                    velocity_smooth = table.Column<double[]>(type: "double precision[]", nullable: true),
                    heartrate = table.Column<int[]>(type: "integer[]", nullable: true),
                    cadence = table.Column<int[]>(type: "integer[]", nullable: true),
                    watts = table.Column<int?[]>(type: "integer[]", nullable: true),
                    temp = table.Column<int[]>(type: "integer[]", nullable: true),
                    moving = table.Column<bool[]>(type: "boolean[]", nullable: true),
                    grade_smooth = table.Column<double[]>(type: "double precision[]", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_activity_streams", x => x.activity_id);
                    table.ForeignKey(
                        name: "fk_activity_streams_activities_activity_id",
                        column: x => x.activity_id,
                        principalTable: "activities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "activity_zones",
                columns: table => new
                {
                    activity_id = table.Column<long>(type: "bigint", nullable: false),
                    type = table.Column<string>(type: "text", nullable: false),
                    score = table.Column<int>(type: "integer", nullable: true),
                    sensor_based = table.Column<bool>(type: "boolean", nullable: true),
                    custom_zones = table.Column<bool>(type: "boolean", nullable: true),
                    min = table.Column<double[]>(type: "double precision[]", nullable: false),
                    max = table.Column<double[]>(type: "double precision[]", nullable: false),
                    seconds = table.Column<int[]>(type: "integer[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_activity_zones", x => new { x.activity_id, x.type });
                    table.ForeignKey(
                        name: "fk_activity_zones_activities_activity_id",
                        column: x => x.activity_id,
                        principalTable: "activities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_activities_athlete_id_sport_type",
                table: "activities",
                columns: new[] { "athlete_id", "sport_type" });

            migrationBuilder.CreateIndex(
                name: "ix_activities_start_date",
                table: "activities",
                column: "start_date");

            migrationBuilder.CreateIndex(
                name: "ix_activity_comments_activity_id",
                table: "activity_comments",
                column: "activity_id");

            migrationBuilder.CreateIndex(
                name: "ix_activity_efforts_segment_id",
                table: "activity_efforts",
                column: "segment_id");

            migrationBuilder.CreateIndex(
                name: "ix_gear_athlete_id",
                table: "gear",
                column: "athlete_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "activity_comments");

            migrationBuilder.DropTable(
                name: "activity_efforts");

            migrationBuilder.DropTable(
                name: "activity_kudos");

            migrationBuilder.DropTable(
                name: "activity_laps");

            migrationBuilder.DropTable(
                name: "activity_splits");

            migrationBuilder.DropTable(
                name: "activity_streams");

            migrationBuilder.DropTable(
                name: "activity_zones");

            migrationBuilder.DropTable(
                name: "athletes");

            migrationBuilder.DropTable(
                name: "gear");

            migrationBuilder.DropTable(
                name: "activities");
        }
    }
}
