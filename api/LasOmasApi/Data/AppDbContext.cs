using System;
using System.Collections.Generic;
using LasOmasApi.Models;
using Microsoft.EntityFrameworkCore;

namespace LasOmasApi.Data;

public partial class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Bulto> Bultos { get; set; }

    public virtual DbSet<CategoriaTela> CategoriaTelas { get; set; }

    public virtual DbSet<EmpresaDonante> EmpresaDonantes { get; set; }

    public virtual DbSet<Estado> Estados { get; set; }

    public virtual DbSet<IngresoDonacion> IngresoDonacions { get; set; }

    public virtual DbSet<Rol> Rols { get; set; }

    public virtual DbSet<Usuario> Usuarios { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Bulto>(entity =>
        {
            entity.HasKey(e => e.IdBulto).HasName("PK__Bulto__BCDCBE92493643AC");

            entity.ToTable("Bulto");

            entity.Property(e => e.Color).HasMaxLength(50);
            entity.Property(e => e.PesoKg).HasColumnType("decimal(12, 3)");

            entity.HasOne(d => d.IdCategoriaNavigation).WithMany(p => p.Bultos)
                .HasForeignKey(d => d.IdCategoria)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Bulto_CategoriaTela");

            entity.HasOne(d => d.IdEstadoNavigation).WithMany(p => p.Bultos)
                .HasForeignKey(d => d.IdEstado)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Bulto_Estado");

            entity.HasOne(d => d.IdIngresoDonacionNavigation).WithMany(p => p.Bultos)
                .HasForeignKey(d => d.IdIngresoDonacion)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Bulto_IngresoDonacion");
        });

        modelBuilder.Entity<CategoriaTela>(entity =>
        {
            entity.HasKey(e => e.IdCategoria).HasName("PK__Categori__A3C02A1057C3AC49");

            entity.ToTable("CategoriaTela");

            entity.HasIndex(e => e.Nombre, "UQ_CategoriaTela_Nombre").IsUnique();

            entity.Property(e => e.Nombre).HasMaxLength(100);
            entity.Property(e => e.StockMinimoKg).HasColumnType("decimal(12, 3)");
        });

        modelBuilder.Entity<EmpresaDonante>(entity =>
        {
            entity.HasKey(e => e.IdEmpresa).HasName("PK__EmpresaD__5EF4033EC8E9B747");

            entity.ToTable("EmpresaDonante");

            entity.HasIndex(e => e.Cuit, "UQ_EmpresaDonante_CUIT").IsUnique();

            entity.Property(e => e.Cuit)
                .HasMaxLength(11)
                .IsUnicode(false)
                .HasColumnName("CUIT");
            entity.Property(e => e.Email).HasMaxLength(254);
            entity.Property(e => e.RazonSocial).HasMaxLength(150);
            entity.Property(e => e.Telefono)
                .HasMaxLength(30)
                .IsUnicode(false);
        });

        modelBuilder.Entity<Estado>(entity =>
        {
            entity.HasKey(e => e.IdEstado).HasName("PK__Estado__FBB0EDC1BD467DE2");

            entity.ToTable("Estado");

            entity.HasIndex(e => e.Descripcion, "UQ_Estado_Descripcion").IsUnique();

            entity.Property(e => e.Descripcion).HasMaxLength(100);
        });

        modelBuilder.Entity<IngresoDonacion>(entity =>
        {
            entity.HasKey(e => e.IdIngresoDonacion).HasName("PK__IngresoD__C8FC1963FDAD2BF8");

            entity.ToTable("IngresoDonacion");

            entity.HasIndex(e => new { e.IdEmpresa, e.NumeroRemito }, "UQ_IngresoDonacion_Remito").IsUnique();

            entity.Property(e => e.FechaIngreso).HasPrecision(0);
            entity.Property(e => e.NumeroRemito).HasMaxLength(50);

            entity.HasOne(d => d.IdEmpresaNavigation).WithMany(p => p.IngresoDonacions)
                .HasForeignKey(d => d.IdEmpresa)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_IngresoDonacion_EmpresaDonante");

            entity.HasOne(d => d.IdUsuarioNavigation).WithMany(p => p.IngresoDonacions)
                .HasForeignKey(d => d.IdUsuario)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_IngresoDonacion_Usuario");
        });

        modelBuilder.Entity<Rol>(entity =>
        {
            entity.HasKey(e => e.IdRol).HasName("PK__Rol__2A49584CE587403C");

            entity.ToTable("Rol");

            entity.HasIndex(e => e.NombreRol, "UQ_Rol_NombreRol").IsUnique();

            entity.Property(e => e.Descripcion).HasMaxLength(200);
            entity.Property(e => e.NombreRol).HasMaxLength(50);
        });

        modelBuilder.Entity<Usuario>(entity =>
        {
            entity.HasKey(e => e.IdUsuario).HasName("PK__Usuario__5B65BF97147E8666");

            entity.ToTable("Usuario");

            entity.HasIndex(e => e.Email, "UQ_Usuario_Email").IsUnique();

            entity.Property(e => e.ActivoSn)
                .HasDefaultValue(true)
                .HasColumnName("Activo_SN");
            entity.Property(e => e.Apellido).HasMaxLength(100);
            entity.Property(e => e.ClaveHash)
                .HasMaxLength(255)
                .IsUnicode(false)
                .HasDefaultValue("");
            entity.Property(e => e.Email).HasMaxLength(254);
            entity.Property(e => e.Nombre).HasMaxLength(100);
            entity.Property(e => e.Telefono)
                .HasMaxLength(30)
                .IsUnicode(false);

            entity.HasOne(d => d.IdRolNavigation).WithMany(p => p.Usuarios)
                .HasForeignKey(d => d.IdRol)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Usuario_Rol");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
