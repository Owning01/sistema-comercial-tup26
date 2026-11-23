'use client'

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { formatearPesos } from '@/lib/dinero'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
)

type VentasDiarias = { fecha: string; importe: number }[]
type PorForma = { forma: string; importe: number }[]
type MasVendido = {
  productoId: number
  codigo: string
  descripcion: string
  unidades: number
  importe: number
}

const nombreForma: Record<string, string> = {
  contado: 'Contado',
  tarjeta: 'Tarjeta',
  cuenta_corriente: 'Cuenta corriente',
}

const tinta = '#1c1917'
const gris = '#78716c'
const claro = '#d6d3d1'

function etiquetaDia(fecha: string) {
  const [, mes, dia] = fecha.split('-')
  return `${dia}/${mes}`
}

export function GraficosTablero({
  ventasDiarias,
  porFormaDePago,
  masVendidos,
}: {
  ventasDiarias: VentasDiarias
  porFormaDePago: PorForma
  masVendidos: MasVendido[]
}) {
  const linea: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (contexto) => formatearPesos(Number(contexto.parsed.y)),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: gris, maxTicksLimit: 10, font: { size: 10 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(120, 113, 108, 0.15)' },
        ticks: {
          color: gris,
          font: { size: 10 },
          callback: (valor) => formatearPesos(Number(valor)),
        },
      },
    },
  }

  const torta: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: gris, boxWidth: 10, boxHeight: 10, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label: (contexto) => `${contexto.label}: ${formatearPesos(Number(contexto.parsed))}`,
        },
      },
    },
  }

  const barras: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (contexto) => {
            const dato = masVendidos[contexto.dataIndex]
            return `${dato.unidades} unidades · ${formatearPesos(dato.importe)}`
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: 'rgba(120, 113, 108, 0.15)' },
        ticks: { color: gris, precision: 0, font: { size: 10 } },
      },
      y: {
        grid: { display: false },
        ticks: {
          color: tinta,
          font: { size: 11 },
          callback: (_valor, indice) => {
            const dato = masVendidos[indice]
            return dato ? `${dato.codigo} · ${dato.descripcion.slice(0, 20)}` : ''
          },
        },
      },
    },
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Ventas de los últimos 30 días</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <Line
              data={{
                labels: ventasDiarias.map((dia) => etiquetaDia(dia.fecha)),
                datasets: [
                  {
                    label: 'Facturado',
                    data: ventasDiarias.map((dia) => dia.importe),
                    borderColor: tinta,
                    backgroundColor: 'rgba(28, 25, 23, 0.08)',
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    fill: true,
                    tension: 0.25,
                  },
                ],
              }}
              options={linea}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Formas de pago del mes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <Doughnut
              data={{
                labels: porFormaDePago.map((forma) => nombreForma[forma.forma] ?? forma.forma),
                datasets: [
                  {
                    data: porFormaDePago.map((forma) => forma.importe),
                    backgroundColor: [tinta, gris, claro],
                    borderColor: '#ffffff',
                    borderWidth: 2,
                  },
                ],
              }}
              options={torta}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Más vendidos del mes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <Bar
              data={{
                labels: masVendidos.map((producto) => producto.codigo),
                datasets: [
                  {
                    label: 'Unidades',
                    data: masVendidos.map((producto) => producto.unidades),
                    backgroundColor: tinta,
                    borderRadius: 3,
                  },
                ],
              }}
              options={barras}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
