insert into public.snapshots (id, nombre, created_at, descripcion) values
  ('10000000-0000-4000-8000-000000000001', 'Jornada demostrativa A', '2026-10-01T08:00:00-05:00', 'Dataset principal con seis centros.'),
  ('10000000-0000-4000-8000-000000000002', 'Jornada demostrativa B', '2026-10-15T08:00:00-05:00', 'Segundo estado independiente para probar aislamiento.');

insert into public.centros (snapshot_id, centro_id, nombre, estado, zona, coordinador_nombre) values
  ('10000000-0000-4000-8000-000000000001', 'C01', 'Centro Norte', 'activo', 'Norte', 'Coordinador Norte'),
  ('10000000-0000-4000-8000-000000000001', 'C02', 'Centro Sur', 'activo', 'Sur', 'Coordinador Sur'),
  ('10000000-0000-4000-8000-000000000001', 'C03', 'Centro Oriente', 'activo', 'Oriente', 'Coordinador Oriente'),
  ('10000000-0000-4000-8000-000000000001', 'C04', 'Centro Occidente', 'activo', 'Occidente', 'Coordinador Occidente'),
  ('10000000-0000-4000-8000-000000000001', 'C05', 'Centro Centro', 'activo', 'Centro', 'Coordinador Centro'),
  ('10000000-0000-4000-8000-000000000001', 'C06', 'Centro Ladera', 'activo', 'Ladera', 'Coordinador Ladera'),
  ('10000000-0000-4000-8000-000000000002', 'C01', 'Centro Norte - Jornada B', 'activo', 'Norte', 'Coordinador B Norte'),
  ('10000000-0000-4000-8000-000000000002', 'C07', 'Centro Aguablanca', 'activo', 'Oriente', 'Coordinador Aguablanca');

insert into public.productos (snapshot_id, producto_id, nombre, unidad_base)
select snapshot_id, producto_id, nombre, unidad_base
from (values
  ('P01', 'Agua potable', 'ml'),
  ('P02', 'Arroz', 'g'),
  ('P03', 'Alimento enlatado', 'unidad'),
  ('P04', 'Cobija', 'unidad'),
  ('P05', 'Kit de aseo', 'unidad')
) as producto(producto_id, nombre, unidad_base)
cross join (values
  ('10000000-0000-4000-8000-000000000001'::uuid),
  ('10000000-0000-4000-8000-000000000002'::uuid)
) as snapshot(snapshot_id);

insert into public.presentaciones (snapshot_id, sku_id, producto_id, nombre, contenido_por_paquete)
select snapshot_id, sku_id, producto_id, nombre, contenido_por_paquete
from (values
  ('AGUA-600', 'P01', 'Botella de agua 600 ml', 600),
  ('AGUA-1500', 'P01', 'Botella de agua 1.500 ml', 1500),
  ('ARROZ-1000', 'P02', 'Bolsa de arroz 1.000 g', 1000),
  ('ARROZ-5000', 'P02', 'Bulto de arroz 5.000 g', 5000),
  ('ENLATADO-1', 'P03', 'Lata individual', 1),
  ('COBIJA-1', 'P04', 'Cobija individual', 1),
  ('ASEO-1', 'P05', 'Kit de aseo individual', 1)
) as presentacion(sku_id, producto_id, nombre, contenido_por_paquete)
cross join (values
  ('10000000-0000-4000-8000-000000000001'::uuid),
  ('10000000-0000-4000-8000-000000000002'::uuid)
) as snapshot(snapshot_id);

insert into public.presentaciones (snapshot_id, sku_id, producto_id, nombre, contenido_por_paquete) values
  ('10000000-0000-4000-8000-000000000002', 'AGUA-330', 'P01', 'Botella de agua 330 ml', 330);

insert into public.inventario_inicial (snapshot_id, centro_id, sku_id, cantidad_paquetes) values
  ('10000000-0000-4000-8000-000000000001', 'C01', 'AGUA-600', 10),
  ('10000000-0000-4000-8000-000000000001', 'C01', 'AGUA-1500', 4),
  ('10000000-0000-4000-8000-000000000001', 'C01', 'ARROZ-1000', 8),
  ('10000000-0000-4000-8000-000000000001', 'C02', 'AGUA-600', 20),
  ('10000000-0000-4000-8000-000000000001', 'C02', 'AGUA-1500', 6),
  ('10000000-0000-4000-8000-000000000001', 'C02', 'COBIJA-1', 25),
  ('10000000-0000-4000-8000-000000000001', 'C03', 'ARROZ-5000', 5),
  ('10000000-0000-4000-8000-000000000001', 'C03', 'ENLATADO-1', 40),
  ('10000000-0000-4000-8000-000000000001', 'C04', 'ASEO-1', 15),
  ('10000000-0000-4000-8000-000000000001', 'C05', 'COBIJA-1', 8),
  ('10000000-0000-4000-8000-000000000001', 'C06', 'ARROZ-1000', 12),
  ('10000000-0000-4000-8000-000000000002', 'C01', 'AGUA-600', 2),
  ('10000000-0000-4000-8000-000000000002', 'C01', 'AGUA-1500', 1),
  ('10000000-0000-4000-8000-000000000002', 'C07', 'AGUA-330', 30),
  ('10000000-0000-4000-8000-000000000002', 'C07', 'ARROZ-1000', 4);

insert into public.necesidades (snapshot_id, centro_id, producto_id, objetivo_unidad_base, reserva_unidad_base, prioridad) values
  ('10000000-0000-4000-8000-000000000001', 'C01', 'P01', 20000, 0, 1),
  ('10000000-0000-4000-8000-000000000001', 'C01', 'P02', 12000, 1000, 2),
  ('10000000-0000-4000-8000-000000000001', 'C02', 'P01', 9000, 2000, 2),
  ('10000000-0000-4000-8000-000000000001', 'C02', 'P04', 10, 5, 3),
  ('10000000-0000-4000-8000-000000000001', 'C03', 'P02', 15000, 2000, 2),
  ('10000000-0000-4000-8000-000000000001', 'C04', 'P05', 20, 2, 1),
  ('10000000-0000-4000-8000-000000000001', 'C05', 'P04', 20, 2, 2),
  ('10000000-0000-4000-8000-000000000001', 'C06', 'P02', 20000, 1000, 1),
  ('10000000-0000-4000-8000-000000000002', 'C01', 'P01', 5000, 0, 1),
  ('10000000-0000-4000-8000-000000000002', 'C07', 'P01', 4000, 1000, 2);

insert into public.voluntarios (snapshot_id, centro_id, disponibles, requeridos) values
  ('10000000-0000-4000-8000-000000000001', 'C01', 4, 7),
  ('10000000-0000-4000-8000-000000000001', 'C02', 8, 6),
  ('10000000-0000-4000-8000-000000000001', 'C03', 3, 5),
  ('10000000-0000-4000-8000-000000000001', 'C04', 6, 6),
  ('10000000-0000-4000-8000-000000000001', 'C05', 2, 4),
  ('10000000-0000-4000-8000-000000000001', 'C06', 5, 8),
  ('10000000-0000-4000-8000-000000000002', 'C01', 2, 5),
  ('10000000-0000-4000-8000-000000000002', 'C07', 7, 5);

insert into public.tiempos_traslado (snapshot_id, origen_id, destino_id, minutos) values
  ('10000000-0000-4000-8000-000000000001', 'C02', 'C01', 15),
  ('10000000-0000-4000-8000-000000000001', 'C01', 'C02', 20),
  ('10000000-0000-4000-8000-000000000001', 'C03', 'C01', 25),
  ('10000000-0000-4000-8000-000000000001', 'C03', 'C06', 18),
  ('10000000-0000-4000-8000-000000000001', 'C04', 'C05', 12),
  ('10000000-0000-4000-8000-000000000001', 'C05', 'C04', 16),
  ('10000000-0000-4000-8000-000000000002', 'C07', 'C01', 22),
  ('10000000-0000-4000-8000-000000000002', 'C01', 'C07', 28);

insert into public.donaciones_esperadas (snapshot_id, intencion_id, centro_id, sku_id, cantidad_paquetes, llegada_prevista, estado) values
  ('10000000-0000-4000-8000-000000000001', 'D01', 'C01', 'AGUA-600', 10, '2026-10-01T12:00:00-05:00', 'pendiente'),
  ('10000000-0000-4000-8000-000000000001', 'D02', 'C04', 'ASEO-1', 8, '2026-10-01T14:00:00-05:00', 'pendiente'),
  ('10000000-0000-4000-8000-000000000002', 'D01', 'C01', 'AGUA-330', 5, '2026-10-15T11:00:00-05:00', 'pendiente');

insert into public.simulaciones (id, snapshot_id, nombre, hora_inicio, hora_actual, estado) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Simulación mañana', '2026-10-01T08:00:00-05:00', '2026-10-01T10:00:00-05:00', 'activa'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Simulación alternativa', '2026-10-01T08:00:00-05:00', '2026-10-01T10:00:00-05:00', 'activa');

insert into public.eventos_simulacion (id, simulacion_id, tipo, ocurrido_en, registrado_en, payload) values
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'recepcion_confirmada',
    '2026-10-01T09:00:00-05:00',
    '2026-10-01T09:05:00-05:00',
    '{"centro_id":"C01","sku_id":"AGUA-600","cantidad_paquetes":5,"estado":"confirmada"}'::jsonb
  );

