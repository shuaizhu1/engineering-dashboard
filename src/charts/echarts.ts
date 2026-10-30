// Tree-shaken ECharts: register only the pieces the app uses.
import { BarChart, LineChart, ScatterChart } from 'echarts/charts'
import {
  AriaComponent,
  BrushComponent,
  DataZoomComponent,
  DatasetComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { registerChartThemes } from './chartTheme'

echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  AriaComponent,
  BrushComponent,
  DataZoomComponent,
  DatasetComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
])

registerChartThemes(echarts)

export { echarts }
