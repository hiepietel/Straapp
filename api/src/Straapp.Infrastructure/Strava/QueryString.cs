namespace Straapp.Infrastructure.Strava;

internal static class QueryString
{
    /// <summary>Appends the non-null parameters to <paramref name="path"/>, URL-encoded.</summary>
    public static string Append(string path, params (string Key, object? Value)[] parameters)
    {
        var pairs = parameters
            .Where(p => p.Value is not null)
            .Select(p => $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(Format(p.Value!))}")
            .ToArray();

        if (pairs.Length == 0) return path;
        return path + (path.Contains('?') ? '&' : '?') + string.Join('&', pairs);
    }

    private static string Format(object value) => value switch
    {
        // Strava takes timestamps as epoch seconds.
        DateTimeOffset time => time.ToUnixTimeSeconds().ToString(),
        bool flag => flag ? "true" : "false",
        IFormattable formattable => formattable.ToString(null, System.Globalization.CultureInfo.InvariantCulture),
        _ => value.ToString() ?? "",
    };
}
