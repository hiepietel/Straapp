# Straapp API. Build from the api/ folder:  docker build -t straapp-api api

# ---- build ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Project files first, so the restore layer is cached until a dependency changes.
COPY Straapp.slnx ./
COPY src/Straapp.Domain/Straapp.Domain.csproj src/Straapp.Domain/
COPY src/Straapp.Application/Straapp.Application.csproj src/Straapp.Application/
COPY src/Straapp.Infrastructure/Straapp.Infrastructure.csproj src/Straapp.Infrastructure/
COPY src/Straapp.Persistence/Straapp.Persistence.csproj src/Straapp.Persistence/
COPY src/Straapp.Api/Straapp.Api.csproj src/Straapp.Api/
RUN dotnet restore src/Straapp.Api/Straapp.Api.csproj

COPY src/ src/
RUN dotnet publish src/Straapp.Api/Straapp.Api.csproj -c Release -o /app --no-restore /p:UseAppHost=false

# ---- run ----
# Chiseled: no shell or package manager, runs as a non-root user. "extra" adds ICU and time zones.
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled-extra
WORKDIR /app
COPY --from=build /app .

ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

ENTRYPOINT ["dotnet", "Straapp.Api.dll"]
