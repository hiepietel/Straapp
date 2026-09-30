using Straapp.Application.GearStats;
using Straapp.Domain.Athletes;

namespace Straapp.UnitTests.GearStats;

public class GearNamesTests
{
    private readonly FakeAthleteRepository _athletes = new();

    private Task<IReadOnlyList<GearLabel>> LabelAsync(params string[] ids) => GearNames.LabelAsync(_athletes, 1, ids);

    [Fact]
    public async Task No_ids_means_no_labels()
    {
        Assert.Empty(await LabelAsync());
    }

    [Fact]
    public async Task Stored_gear_keeps_its_name_kind_and_retired_flag_in_the_given_order()
    {
        _athletes.Gear.Add(new Gear { Id = "g1", Name = " Trail shoes ", Kind = GearKind.Shoes, Retired = true });
        _athletes.Gear.Add(new Gear { Id = "b1", Name = "Road bike", Kind = GearKind.Bike });

        var labels = await LabelAsync("b1", "g1");

        Assert.Equal(
            [new GearLabel("b1", "Road bike", GearKind.Bike, false), new GearLabel("g1", "Trail shoes", GearKind.Shoes, true)],
            labels);
    }

    [Fact]
    public async Task Gear_only_on_the_profile_is_named_from_the_profile()
    {
        _athletes.Athlete = new Athlete
        {
            Id = 1,
            RawJson = """{"id":1,"bikes":[{"id":"b9","name":"Profile bike","distance":1000}],"shoes":[]}""",
        };

        var label = Assert.Single(await LabelAsync("b9"));

        Assert.Equal("Profile bike", label.Name);
    }

    [Fact]
    public async Task Stored_details_win_over_the_profile()
    {
        _athletes.Gear.Add(new Gear { Id = "b9", Name = "Stored name", Kind = GearKind.Bike });
        _athletes.Athlete = new Athlete { Id = 1, RawJson = """{"id":1,"bikes":[{"id":"b9","name":"Profile name"}]}""" };

        Assert.Equal("Stored name", Assert.Single(await LabelAsync("b9")).Name);
    }

    [Fact]
    public async Task Unknown_or_unnamed_gear_gets_a_placeholder_and_a_kind_from_its_id()
    {
        _athletes.Gear.Add(new Gear { Id = "g2", Name = "   ", Kind = GearKind.Shoes });
        _athletes.Athlete = new Athlete { Id = 1, RawJson = "not json" };

        var labels = await LabelAsync("b5", "g2", "g3");

        Assert.Equal(["Gear b5", "Gear g2", "Gear g3"], labels.Select(l => l.Name));
        Assert.Equal([GearKind.Bike, GearKind.Shoes, GearKind.Shoes], labels.Select(l => l.Kind));
    }
}
