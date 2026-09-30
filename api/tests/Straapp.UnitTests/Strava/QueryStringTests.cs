using System.Globalization;
using Straapp.Infrastructure.Strava;

namespace Straapp.UnitTests.Strava;

public class QueryStringTests
{
    [Fact]
    public void Leaves_the_path_alone_without_parameters()
    {
        Assert.Equal("athlete/activities", QueryString.Append("athlete/activities", ("before", null)));
    }

    [Fact]
    public void Skips_nulls_and_encodes_the_rest()
    {
        Assert.Equal(
            "search?q=a%20%26%20b&page=2",
            QueryString.Append("search", ("q", "a & b"), ("after", null), ("page", 2)));
    }

    [Fact]
    public void Adds_to_an_existing_query()
    {
        Assert.Equal("x?a=1&b=true", QueryString.Append("x?a=1", ("b", true)));
    }

    [Fact]
    public void Timestamps_are_epoch_seconds()
    {
        var time = new DateTimeOffset(2026, 1, 1, 1, 0, 0, TimeSpan.FromHours(1));

        Assert.Equal("x?before=1767225600", QueryString.Append("x", ("before", time)));
    }

    [Fact]
    public void Numbers_ignore_the_current_culture()
    {
        var culture = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = new CultureInfo("pl-PL");
            Assert.Equal("x?lat=50.5", QueryString.Append("x", ("lat", 50.5)));
        }
        finally
        {
            CultureInfo.CurrentCulture = culture;
        }
    }
}
