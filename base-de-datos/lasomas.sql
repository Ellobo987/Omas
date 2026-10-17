/* =====================================================================
   SGI-OMAS · Base de datos LasOmas (SQL Server)
   Modelo corregido por el profesor (versión 1): Rol, Usuario, Estado, CategoriaTela,
   EmpresaDonante, IngresoDonacion y Bulto. Lo único que se agrega es Usuario.ClaveHash,
   que hace falta para iniciar sesión.

   Se puede correr varias veces sin perder nada: crea solo lo que falta.
   · En una máquina sin la base: crea la base, las tablas y los datos iniciales.
   · En la base que ya existe: agrega ClaveHash y carga los datos iniciales que falten.
   Correrlo con:  sqlcmd -S . -E -f 65001 -i lasomas.sql   (el -f 65001 es para que lea bien los acentos)
   o abrirlo en SQL Server Management Studio y ejecutarlo.
   Después, la API se arma con Database First (Scaffold-DbContext).

   DATOS DE EJEMPLO, solo para desarrollo: las empresas y los usuarios son inventados.
   Las cuentas de prueba usan la clave "omas2026" (la misma del prototipo): cambiarla antes de usarlo de verdad.
   ===================================================================== */

IF DB_ID(N'LasOmas') IS NULL CREATE DATABASE LasOmas;
GO
USE LasOmas;
GO

/* ===== Tablas (tal cual el diagrama) ===== */
IF OBJECT_ID(N'dbo.Rol') IS NULL
CREATE TABLE dbo.Rol (
  IdRol       INT IDENTITY(1,1) PRIMARY KEY,
  NombreRol   NVARCHAR(50)  NOT NULL,
  Descripcion NVARCHAR(200) NULL
);
GO
IF OBJECT_ID(N'dbo.Usuario') IS NULL
CREATE TABLE dbo.Usuario (
  IdUsuario  INT IDENTITY(1,1) PRIMARY KEY,
  Nombre     NVARCHAR(100) NOT NULL,
  Apellido   NVARCHAR(100) NOT NULL,
  Email      NVARCHAR(254) NOT NULL CONSTRAINT UQ_Usuario_Email UNIQUE,
  Telefono   VARCHAR(30)   NULL,
  IdRol      INT           NOT NULL CONSTRAINT FK_Usuario_Rol REFERENCES dbo.Rol(IdRol),
  Activo_SN  BIT           NOT NULL DEFAULT 1   -- baja lógica: no se borra, queda quién registró cada ingreso
);
GO
IF OBJECT_ID(N'dbo.EmpresaDonante') IS NULL
CREATE TABLE dbo.EmpresaDonante (
  IdEmpresa   INT IDENTITY(1,1) PRIMARY KEY,
  RazonSocial NVARCHAR(150) NOT NULL,
  CUIT        VARCHAR(11)   NOT NULL CONSTRAINT UQ_EmpresaDonante_CUIT UNIQUE,  -- 11 números, sin guiones
  Telefono    VARCHAR(30)   NULL,
  Email       NVARCHAR(254) NULL
);
GO
IF OBJECT_ID(N'dbo.Estado') IS NULL
CREATE TABLE dbo.Estado (
  IdEstado    INT IDENTITY(1,1) PRIMARY KEY,
  Descripcion NVARCHAR(100) NOT NULL
);
GO
IF OBJECT_ID(N'dbo.CategoriaTela') IS NULL
CREATE TABLE dbo.CategoriaTela (
  IdCategoria   INT IDENTITY(1,1) PRIMARY KEY,
  Nombre        NVARCHAR(100)  NOT NULL,
  StockMinimoKg DECIMAL(12,3)  NOT NULL CONSTRAINT CK_CategoriaTela_StockMinimo CHECK (StockMinimoKg >= 0)
);
GO
IF OBJECT_ID(N'dbo.IngresoDonacion') IS NULL
CREATE TABLE dbo.IngresoDonacion (
  IdIngresoDonacion INT IDENTITY(1,1) PRIMARY KEY,
  NumeroRemito      NVARCHAR(50) NOT NULL,
  FechaIngreso      DATETIME2    NOT NULL,
  IdEmpresa         INT          NOT NULL CONSTRAINT FK_IngresoDonacion_EmpresaDonante REFERENCES dbo.EmpresaDonante(IdEmpresa),
  IdUsuario         INT          NOT NULL CONSTRAINT FK_IngresoDonacion_Usuario REFERENCES dbo.Usuario(IdUsuario)
);
GO
IF OBJECT_ID(N'dbo.Bulto') IS NULL
CREATE TABLE dbo.Bulto (
  IdBulto           INT IDENTITY(1,1) PRIMARY KEY,
  PesoKg            DECIMAL(12,3) NOT NULL CONSTRAINT CK_Bulto_Peso CHECK (PesoKg > 0),
  IdEstado          INT           NOT NULL CONSTRAINT FK_Bulto_Estado REFERENCES dbo.Estado(IdEstado),
  Color             NVARCHAR(50)  NULL,
  IdCategoria       INT           NOT NULL CONSTRAINT FK_Bulto_CategoriaTela REFERENCES dbo.CategoriaTela(IdCategoria),
  IdIngresoDonacion INT           NOT NULL CONSTRAINT FK_Bulto_IngresoDonacion REFERENCES dbo.IngresoDonacion(IdIngresoDonacion)
);
GO

/* ===== Agregado: clave para iniciar sesión =====
   Se guarda el hash, nunca la clave. Formato de ASP.NET Core Identity (PasswordHasher, PBKDF2 con
   HMAC-SHA512 y sal al azar), así la API la verifica con PasswordHasher<Usuario> sin paquetes extra. */
IF COL_LENGTH(N'dbo.Usuario', N'ClaveHash') IS NULL
  ALTER TABLE dbo.Usuario ADD ClaveHash VARCHAR(255) NOT NULL
    CONSTRAINT DF_Usuario_ClaveHash DEFAULT '';  -- '' = sin clave: no puede entrar hasta que Administración le dé una
GO

/* ===== Controles que no cambian el modelo: evitan datos repetidos o mal cargados ===== */
IF OBJECT_ID(N'dbo.UQ_Rol_NombreRol') IS NULL
  ALTER TABLE dbo.Rol ADD CONSTRAINT UQ_Rol_NombreRol UNIQUE (NombreRol);
IF OBJECT_ID(N'dbo.UQ_Estado_Descripcion') IS NULL
  ALTER TABLE dbo.Estado ADD CONSTRAINT UQ_Estado_Descripcion UNIQUE (Descripcion);
IF OBJECT_ID(N'dbo.UQ_CategoriaTela_Nombre') IS NULL
  ALTER TABLE dbo.CategoriaTela ADD CONSTRAINT UQ_CategoriaTela_Nombre UNIQUE (Nombre);
-- El número de remito lo pone cada empresa: no se puede repetir para la misma empresa
IF OBJECT_ID(N'dbo.UQ_IngresoDonacion_Remito') IS NULL
  ALTER TABLE dbo.IngresoDonacion ADD CONSTRAINT UQ_IngresoDonacion_Remito UNIQUE (IdEmpresa, NumeroRemito);
-- Remito: 13 números y un guion entre ellos (ej. 00012-34567890), como lo controla la pantalla de pesajes
IF OBJECT_ID(N'dbo.CK_IngresoDonacion_Remito') IS NULL
  ALTER TABLE dbo.IngresoDonacion ADD CONSTRAINT CK_IngresoDonacion_Remito
    CHECK (LEN(NumeroRemito) = 14 AND NumeroRemito NOT LIKE '%[^0-9-]%'
           AND NumeroRemito LIKE '[0-9]%[0-9]' AND NumeroRemito LIKE '%-%' AND NumeroRemito NOT LIKE '%-%-%');
-- CUIT: 11 números
IF OBJECT_ID(N'dbo.CK_EmpresaDonante_CUIT') IS NULL
  ALTER TABLE dbo.EmpresaDonante ADD CONSTRAINT CK_EmpresaDonante_CUIT CHECK (LEN(CUIT) = 11 AND CUIT NOT LIKE '%[^0-9]%');
GO

/* ===== Datos iniciales (catálogos) ===== */
-- Roles: los mismos del prototipo
MERGE dbo.Rol AS d
USING (VALUES
  (N'Administración', N'Crea y da de baja usuarios. Ve y carga todo.'),
  (N'Coordinadora',   N'Organiza el depósito y la producción.'),
  (N'Supervisión',    N'Revisa lo cargado y la calidad.'),
  (N'Depósito',       N'Registra las donaciones y los pesajes.')
) AS o (NombreRol, Descripcion) ON d.NombreRol = o.NombreRol
WHEN NOT MATCHED THEN INSERT (NombreRol, Descripcion) VALUES (o.NombreRol, o.Descripcion);
GO
-- Estados del bulto
MERGE dbo.Estado AS d
USING (VALUES (N'En depósito'), (N'Retirado'), (N'Descartado')) AS o (Descripcion) ON d.Descripcion = o.Descripcion
WHEN NOT MATCHED THEN INSERT (Descripcion) VALUES (o.Descripcion);
GO
-- Categorías: las secciones del depósito. "Sin clasificar" = se pesó pero todavía no se separó.
-- El stock mínimo arranca en 0: lo define la coordinación.
MERGE dbo.CategoriaTela AS d
USING (VALUES
  (N'Sin clasificar'), (N'Feria'), (N'Desmarcado'), (N'Trapos'),
  (N'Lienzo para bolsas'), (N'Merchandising'), (N'Desbastado')
) AS o (Nombre) ON d.Nombre = o.Nombre
WHEN NOT MATCHED THEN INSERT (Nombre, StockMinimoKg) VALUES (o.Nombre, 0);
GO

/* ===== Datos de ejemplo (inventados, solo para desarrollo) ===== */
MERGE dbo.EmpresaDonante AS d
USING (VALUES
  (N'Empresa Ejemplo Uno S.A.',  '30000000017', '3510000001', N'donaciones@ejemplo-uno.test'),
  (N'Empresa Ejemplo Dos S.R.L.', '30000000025', NULL,         N'contacto@ejemplo-dos.test')
) AS o (RazonSocial, CUIT, Telefono, Email) ON d.CUIT = o.CUIT
WHEN NOT MATCHED THEN INSERT (RazonSocial, CUIT, Telefono, Email) VALUES (o.RazonSocial, o.CUIT, o.Telefono, o.Email);
GO
-- Cuentas de prueba (clave "omas2026"). Entran con el email.
MERGE dbo.Usuario AS d
USING (VALUES
  (N'Laura',     N'Prueba', N'laura@lasomas.test',     N'Coordinadora',   'AQAAAAIAAYagAAAAEKy/WD40anm7+bT2v6f1g+4xbg9MiqhrPfSNgE6jPIUvdYlkFAC7XjfZE4J2V/jmFg=='),
  (N'Sandra',    N'Prueba', N'sandra@lasomas.test',    N'Administración', 'AQAAAAIAAYagAAAAELtKvWsSRYShyT3Cozk4Lgu54b2YuO8MESd/cEhX0yY3fzZCyaYA5M72B90p7J37Dw=='),
  (N'Florencia', N'Prueba', N'florencia@lasomas.test', N'Depósito',       'AQAAAAIAAYagAAAAELHMHVwW6N8Ik1Ogw20v88+e1V6iHNucNMwIvHVvygL8oKvGP0GdX/qSaXmZqMSTTA==')
) AS o (Nombre, Apellido, Email, NombreRol, ClaveHash) ON d.Email = o.Email
WHEN NOT MATCHED THEN INSERT (Nombre, Apellido, Email, IdRol, Activo_SN, ClaveHash)
  VALUES (o.Nombre, o.Apellido, o.Email, (SELECT IdRol FROM dbo.Rol WHERE NombreRol = o.NombreRol), 1, o.ClaveHash);
GO
-- Una donación de ejemplo con tres bultos (uno queda sin clasificar)
IF NOT EXISTS (SELECT 1 FROM dbo.IngresoDonacion WHERE NumeroRemito = N'00001-00000001')
BEGIN
  DECLARE @ingreso INT, @enDeposito INT = (SELECT IdEstado FROM dbo.Estado WHERE Descripcion = N'En depósito');
  INSERT dbo.IngresoDonacion (NumeroRemito, FechaIngreso, IdEmpresa, IdUsuario)
  VALUES (N'00001-00000001', SYSDATETIME(),
          (SELECT IdEmpresa FROM dbo.EmpresaDonante WHERE CUIT = '30000000017'),
          (SELECT IdUsuario FROM dbo.Usuario WHERE Email = N'florencia@lasomas.test'));
  SET @ingreso = SCOPE_IDENTITY();
  INSERT dbo.Bulto (PesoKg, IdEstado, Color, IdCategoria, IdIngresoDonacion)
  SELECT o.PesoKg, @enDeposito, o.Color, c.IdCategoria, @ingreso
  FROM (VALUES (30.000, N'Azul', N'Trapos'), (20.500, NULL, N'Feria'), (45.000, NULL, N'Sin clasificar')) AS o (PesoKg, Color, Categoria)
  JOIN dbo.CategoriaTela c ON c.Nombre = o.Categoria;
END
GO
