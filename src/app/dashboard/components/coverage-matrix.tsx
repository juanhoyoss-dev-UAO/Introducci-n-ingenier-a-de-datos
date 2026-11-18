import type {
  CoverageMatrix as CoverageMatrixModel,
  CoverageMatrixCell,
  CoverageMatrixState,
} from "../view-model";

const numberFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2,
});

const STATE_PRESENTATION: Record<
  CoverageMatrixState,
  { label: string; className: string; legendClassName: string }
> = {
  deficit_importante: {
    label: "Déficit importante",
    className: "border-rose-300 bg-rose-100 text-rose-950",
    legendClassName: "bg-rose-500",
  },
  deficit_parcial: {
    label: "Déficit parcial",
    className: "border-amber-300 bg-amber-100 text-amber-950",
    legendClassName: "bg-amber-400",
  },
  cubierta: {
    label: "Necesidad cubierta",
    className: "border-emerald-300 bg-emerald-100 text-emerald-950",
    legendClassName: "bg-emerald-500",
  },
  excedente: {
    label: "Excedente",
    className: "border-cyan-300 bg-cyan-100 text-cyan-950",
    legendClassName: "bg-cyan-500",
  },
  sin_necesidad: {
    label: "Sin necesidad declarada",
    className: "border-slate-300 bg-slate-100 text-slate-700",
    legendClassName: "bg-slate-400",
  },
};

function formatUnits(value: number, unit: CoverageMatrixCell["unidad_base"]) {
  const suffix = unit === "unidad" && value !== 1 ? "unidades" : unit;
  return `${numberFormatter.format(value)} ${suffix}`;
}

function MatrixCell({ cell }: { cell: CoverageMatrixCell | null }) {
  if (!cell) {
    return (
      <div className="min-w-40 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center text-xs font-semibold text-slate-500">
        Información no disponible
      </div>
    );
  }

  const presentation = STATE_PRESENTATION[cell.estado];
  const coverage =
    cell.cobertura_porcentaje === null
      ? "0 %"
      : `${numberFormatter.format(cell.cobertura_porcentaje)} %`;

  return (
    <details className={`group min-w-40 rounded-lg border ${presentation.className}`}>
      <summary className="cursor-pointer list-none px-3 py-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span className="block text-base font-bold tabular-nums">{coverage}</span>
        <span className="mt-1 block text-[11px] font-semibold leading-4">
          {presentation.label}
        </span>
        <span className="mt-1 block text-[10px] opacity-70 group-open:hidden">
          Consultar datos
        </span>
      </summary>
      <dl className="border-t border-current/20 bg-white/75 px-3 py-3 text-xs leading-5">
        <dt className="font-semibold">Producto</dt>
        <dd>{cell.producto_nombre}</dd>
        <dt className="mt-1 font-semibold">Centro</dt>
        <dd>{cell.centro_nombre}</dd>
        <dt className="mt-1 font-semibold">Unidad</dt>
        <dd>{cell.unidad_base}</dd>
        <dt className="mt-1 font-semibold">Inventario confirmado</dt>
        <dd className="tabular-nums">
          {formatUnits(
            cell.inventario_confirmado_unidad_base,
            cell.unidad_base,
          )}
        </dd>
        <dt className="mt-1 font-semibold">Necesidad vigente</dt>
        <dd className="tabular-nums">
          {formatUnits(cell.objetivo_unidad_base, cell.unidad_base)}
        </dd>
        <dt className="mt-1 font-semibold">Déficit</dt>
        <dd className="tabular-nums">
          {formatUnits(
            cell.deficit_confirmado_unidad_base,
            cell.unidad_base,
          )}
        </dd>
        {cell.excedente_transferible_unidad_base > 0 ? (
          <>
            <dt className="mt-1 font-semibold">Excedente</dt>
            <dd className="tabular-nums">
              {formatUnits(
                cell.excedente_transferible_unidad_base,
                cell.unidad_base,
              )}
            </dd>
          </>
        ) : null}
      </dl>
    </details>
  );
}

export function CoverageMatrix({ matrix }: { matrix: CoverageMatrixModel }) {
  const states = Object.entries(STATE_PRESENTATION) as Array<
    [CoverageMatrixState, (typeof STATE_PRESENTATION)[CoverageMatrixState]]
  >;

  return (
    <section
      aria-labelledby="coverage-matrix-title"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h3
            className="text-lg font-semibold tracking-tight text-slate-950"
            id="coverage-matrix-title"
          >
            Matriz de cobertura por producto y centro
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Cada porcentaje corresponde a un único producto y centro. Las
            cantidades mantienen su unidad original y los recursos anunciados
            no se suman al inventario confirmado.
          </p>
        </div>
        <ul
          aria-label="Leyenda de cobertura"
          className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-700"
        >
          {states.map(([state, presentation]) => (
            <li className="flex items-center gap-2" key={state}>
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-full ${presentation.legendClassName}`}
              />
              {presentation.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 max-h-[70vh] overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-max border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-20 bg-slate-950 text-white shadow-sm">
            <tr>
              <th className="sticky left-0 z-30 min-w-64 border-r border-slate-700 bg-slate-950 px-4 py-3 font-semibold">
                Producto
              </th>
              {matrix.centros.map((center) => (
                <th
                  className="min-w-44 border-r border-slate-700 px-3 py-3 text-center font-semibold last:border-r-0"
                  key={center.centro_id}
                >
                  <span className="block">{center.centro_nombre}</span>
                  <span className="mt-1 block font-mono text-[10px] text-slate-300">
                    {center.centro_id}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.filas.map((row) => (
              <tr className="even:bg-slate-50" key={row.producto_id}>
                <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-inherit px-4 py-3 align-top font-semibold text-slate-950">
                  <span className="block">{row.producto_nombre}</span>
                  <span className="mt-1 block font-mono text-[10px] font-medium text-slate-500">
                    {row.producto_id} · {row.unidad_base}
                  </span>
                </th>
                {row.celdas.map((cell, index) => (
                  <td
                    className="border-b border-r border-slate-200 p-2 align-top last:border-r-0"
                    key={matrix.centros[index]?.centro_id ?? index}
                  >
                    <MatrixCell cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
