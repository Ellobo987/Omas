# API LasOmas (.NET 8) + panel de administración - imagen para Render
# Contexto de build: la RAÍZ del repositorio (necesita api/, admin/ e img/)
#   docker build -f api/Dockerfile -t omas-api .

# ---------- Etapa 1: compilar y publicar ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Primero solo el .csproj: la restauración de paquetes queda en caché mientras no cambien las dependencias
COPY api/LasOmasApi/LasOmasApi.csproj LasOmasApi/
RUN dotnet restore LasOmasApi/LasOmasApi.csproj

# Después el resto del código
COPY api/LasOmasApi/ LasOmasApi/
RUN dotnet publish LasOmasApi/LasOmasApi.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# ---------- Etapa 2: imagen final (solo runtime) ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true \
    Panel__Raiz=/app/panel

COPY --from=build /app/publish .

# Panel de administración: la API lo sirve en /admin y /img (mismo sitio que la API, para la cookie)
COPY admin/ /app/panel/admin/
COPY img/ /app/panel/img/

# Usuario sin privilegios que ya trae la imagen oficial de .NET 8
USER app

EXPOSE 8080
ENTRYPOINT ["dotnet", "LasOmasApi.dll"]
