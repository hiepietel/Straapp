using Straapp.Application.Statistics;

namespace Straapp.Application.Calendar;

public sealed record CalendarActivity(
    long Id, string Name, string SportType, double Distance, int MovingTime, double Elevation);

public sealed record CalendarDay(DateOnly Date, Totals Totals, IReadOnlyList<CalendarActivity> Activities);

/// <param name="To">The exclusive end date.</param>
public sealed record CalendarReport(DateOnly From, DateOnly To, IReadOnlyList<CalendarDay> Days);