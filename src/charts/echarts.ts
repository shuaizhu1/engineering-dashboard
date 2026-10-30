// Tree-shaken ECharts: register only the pieces the app uses.
import { LineChart } from 'echarts/charts'
import {
  AriaComponent,
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  MarkAreaComponent,
  TooltipComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  LineChart,
  AriaComponent,
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  MarkAreaComponent,
  TooltipComponent,
  CanvasRenderer,
])

export { echarts }
