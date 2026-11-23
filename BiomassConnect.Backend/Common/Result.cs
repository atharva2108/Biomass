namespace BiomassConnect.Backend.Common;

/// <summary>How the console prints a result: [OK], [BLOCKED] or [INFO].</summary>
public enum ResultKind { Ok, Blocked, Info }

/// <summary>Uniform return type of every service and controller method.</summary>
public class Result<T>
{
    public bool Success { get; init; }
    public string Message { get; init; } = "";
    public T? Data { get; init; }
    public ResultKind Kind { get; init; }

    public static Result<T> Ok(T data, string message = "") => new() { Success = true, Data = data, Message = message, Kind = ResultKind.Ok };
    public static Result<T> Info(string message, T? data = default) => new() { Success = true, Data = data, Message = message, Kind = ResultKind.Info };
    public static Result<T> Blocked(string message) => new() { Success = false, Message = message, Kind = ResultKind.Blocked };
}

/// <summary>Short-hands so services can write <c>return Fail&lt;T&gt;("...")</c>.</summary>
public static class Result
{
    public static Result<T> Ok<T>(T data, string message = "") => Result<T>.Ok(data, message);
    public static Result<T> Info<T>(string message, T? data = default) => Result<T>.Info(message, data);
    public static Result<T> Blocked<T>(string message) => Result<T>.Blocked(message);
}

/// <summary>Placeholder payload for operations that return nothing.</summary>
public readonly record struct Unit
{
    public static readonly Unit Value = new();
}
