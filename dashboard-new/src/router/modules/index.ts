import { AppRouteRecord } from '@/types/router'
import { articleRoutes } from './article'
import { dashboardRoutes } from './dashboard'
import { examplesRoutes } from './examples'
import { exceptionRoutes } from './exception'
import { gameRoutes } from './game'
import { helpRoutes } from './help'
import { playerRoutes } from './player'
import { resultRoutes } from './result'
import { safeguardRoutes } from './safeguard'
import { systemRoutes } from './system'
import { templateRoutes } from './template'
import { widgetsRoutes } from './widgets'

/**
 * 导出所有模块化路由
 */
export const routeModules: AppRouteRecord[] = [
  dashboardRoutes,
  gameRoutes,
  playerRoutes,
  templateRoutes,
  widgetsRoutes,
  examplesRoutes,
  systemRoutes,
  articleRoutes,
  resultRoutes,
  exceptionRoutes,
  safeguardRoutes,
  ...helpRoutes
]
