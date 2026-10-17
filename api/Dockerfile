# API LasOmas (.NET 8) - imagen para Render
# Contexto de build: la carpeta /api  ->  docker build -t omas-api ./api

# ---------- Etapa 1: compilar y publicar ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Primero solo el .csproj: la restauración de paquetes queda en caché mientras no cambien las dependencias
COPY LasOmasApi/LasOmasApi.csproj LasOmasApi/
RUN dotnet restore LasOmasApi/LasOmasApi.csproj

# Después el resto del código
COPY LasOmasApi/ LasOmasApi/
RUN dotnet publish LasOmasApi/LasOmasApi.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# ---------- Etapa 2: imagen final (solo runtime) ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true

COPY --from=build /app/publish .

# Usuario sin privilegios que ya trae la imagen oficial de .NET 8
USER app

EXPOSE 8080
ENTRYPOINT ["dotnet", "LasOmasApi.dll"]
