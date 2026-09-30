using Straapp.Application.Strava.Models;
using Straapp.Application.Sync;
using Straapp.Domain.Activities;
using Straapp.Domain.Athletes;
using StravaSplit = Straapp.Application.Strava.Models.ActivitySplit;
using StravaZone = Straapp.Application.Strava.Models.ActivityZone;

namespace Straapp.UnitTests.Sync;

public class StravaMapperTests
{
    private static readonly DateTimeOffset SyncedAt = new(2026, 9, 30, 12, 0, 0, TimeSpan.Zero);

    private static Activity Map(DetailedActivity detail, StreamSet? streams = null, IReadOnlyList<StravaZone>? zones = null,
        IReadOnlyList<Comment>? comments = null, IReadOnlyList<SummaryAthlete>? kudoers = null) =>
        StravaMapper.ToActivity(detail, streams, zones ?? [], comments ?? [], kudoers ?? [], SyncedAt);

    [Fact]
    public void Keeps_local_wall_clock_time_and_stores_the_start_in_utc()
    {
        var activity = Map(new DetailedActivity
        {
            Id = 1,
            Athlete = new MetaAthlete { Id = 9 },
            StartDate = new DateTimeOffset(2026, 6, 1, 10, 0, 0, TimeSpan.FromHours(2)),
            // Strava labels local time as UTC.
            StartDateLocal = new DateTimeOffset(2026, 6, 1, 10, 0, 0, TimeSpan.Zero),
        });

        Assert.Equal(9, activity.AthleteId);
        Assert.Equal(new DateTimeOffset(2026, 6, 1, 8, 0, 0, TimeSpan.Zero), activity.StartDate);
        Assert.Equal(TimeSpan.Zero, activity.StartDate.Offset);
        Assert.Equal(new DateTime(2026, 6, 1, 10, 0, 0), activity.StartDateLocal);
        Assert.Equal(SyncedAt, activity.SyncedAt);
    }

    [Fact]
    public void Missing_values_get_sensible_defaults()
    {
        var activity = Map(new DetailedActivity { Id = 1, StartLatlng = [], Map = new PolylineMap { SummaryPolyline = "" } });

        Assert.Equal("", activity.Name);
        Assert.Null(activity.StartLatitude);
        Assert.Null(activity.SummaryPolyline);
        Assert.Null(activity.Streams);
        Assert.Equal(1, activity.AthleteCount);
        Assert.Equal(0, activity.KudosCount);
        Assert.False(activity.Private);
        Assert.False(activity.Trainer);
    }

    [Fact]
    public void Coordinates_and_photo_count_are_taken_from_the_detail()
    {
        var activity = Map(new DetailedActivity
        {
            Id = 1,
            StartLatlng = [50.06, 19.94],
            EndLatlng = [50.1, 20.0],
            PhotoCount = 1,
            TotalPhotoCount = 4,
        });

        Assert.Equal((50.06, 19.94), (activity.StartLatitude, activity.StartLongitude));
        Assert.Equal((50.1, 20.0), (activity.EndLatitude, activity.EndLongitude));
        Assert.Equal(4, activity.PhotoCount);
    }

    [Fact]
    public void Duplicate_parts_from_Strava_are_stored_once()
    {
        var activity = Map(
            new DetailedActivity
            {
                Id = 1,
                Laps = [new Lap { Id = 5 }, new Lap { Id = 5 }],
                SplitsMetric = [new StravaSplit { Split = 1 }, new StravaSplit { Split = 1 }, new StravaSplit { Split = 2 }],
                SplitsStandard = [new StravaSplit { Split = 1 }],
                BestEfforts = [new SegmentEffort { Id = 3 }, new SegmentEffort { Id = 3 }],
            },
            zones: [new StravaZone { Type = "heartrate" }, new StravaZone { Type = "heartrate" }, new StravaZone { Type = null }],
            comments: [new Comment { Id = 8 }, new Comment { Id = 8 }]);

        Assert.Single(activity.Laps);
        Assert.Equal(2, activity.Splits.Count(s => s.Unit == SplitUnit.Kilometre));
        Assert.Single(activity.Splits, s => s.Unit == SplitUnit.Mile);
        Assert.Single(activity.Efforts);
        Assert.Single(activity.Zones);
        Assert.Single(activity.Comments);
    }

    [Fact]
    public void Zone_buckets_become_parallel_arrays_of_whole_seconds()
    {
        var zone = Assert.Single(Map(new DetailedActivity { Id = 1 }, zones:
        [
            new StravaZone
            {
                Type = "heartrate",
                DistributionBuckets = [new TimedZoneRange { Min = 0, Max = 120, Time = 59.6 }, new TimedZoneRange { Min = 120, Max = -1, Time = 10.2 }],
            },
        ]).Zones);

        Assert.Equal([0d, 120d], zone.Min);
        Assert.Equal([120d, -1d], zone.Max);
        Assert.Equal([60, 10], zone.Seconds);
    }

    [Fact]
    public void Comment_authors_are_named_only_when_known()
    {
        var comments = Map(new DetailedActivity { Id = 1 }, comments:
        [
            new Comment { Id = 1, Athlete = new SummaryAthlete { Id = 4, Firstname = "Ada", Lastname = "L." } },
            new Comment { Id = 2, Athlete = new SummaryAthlete { Id = 0, Firstname = " ", Lastname = null } },
            new Comment { Id = 3 },
        ]).Comments;

        Assert.Equal([4L, null, null], comments.Select(c => c.AthleteId));
        Assert.Equal(["Ada L.", null, null], comments.Select(c => c.AthleteName));
    }

    [Fact]
    public void Kudos_keep_their_order()
    {
        var kudos = Map(new DetailedActivity { Id = 1 }, kudoers:
        [
            new SummaryAthlete { Firstname = "A" },
            new SummaryAthlete { Firstname = "B" },
        ]).Kudos;

        Assert.Equal([(1, "A"), (2, "B")], kudos.Select(k => (k.Position, k.Firstname)));
    }

    [Fact]
    public void Streams_are_split_into_columns()
    {
        var streams = Map(new DetailedActivity { Id = 1 }, streams: new StreamSet
        {
            Distance = new Stream<double> { Data = [0, 10], SeriesType = "distance", Resolution = "high", OriginalSize = 2 },
            Latlng = new Stream<IReadOnlyList<double>> { Data = [[50, 20], [50.1, 20.1]] },
        }).Streams;

        Assert.NotNull(streams);
        Assert.Equal("distance", streams.SeriesType);
        Assert.Equal(2, streams.OriginalSize);
        Assert.Equal([50d, 50.1], streams.Latitude!);
        Assert.Equal([20d, 20.1], streams.Longitude!);
        Assert.Null(streams.Time);
    }

    [Fact]
    public void Gear_kind_comes_from_the_id()
    {
        Assert.Equal(GearKind.Bike, StravaMapper.ToGear(new DetailedGear { Id = "b1" }, 1, SyncedAt).Kind);
        Assert.Equal(GearKind.Shoes, StravaMapper.ToGear(new DetailedGear { Id = "g1" }, 1, SyncedAt).Kind);
    }

    [Fact]
    public void Athlete_keeps_its_zones_only_when_there_are_some()
    {
        var athlete = StravaMapper.ToAthlete(new DetailedAthlete { Id = 3, Firstname = "Ada" }, null, SyncedAt);

        Assert.Equal(3, athlete.Id);
        Assert.Null(athlete.ZonesJson);
        Assert.Contains("\"firstname\":\"Ada\"", athlete.RawJson);
    }
}
