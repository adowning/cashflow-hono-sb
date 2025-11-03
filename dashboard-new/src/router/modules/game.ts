import { AppRouteRecord } from '@/types/router'

export const gameRoutes: AppRouteRecord = {
  path: '/game',
  name: 'Games',
  component: '/game/list',
  // component: '/game/list',
  meta: {
    title: 'Games',
    icon: 'ri:game-line',
    // roles: ['R_SUPER', 'R_ADMIN']
    // roles: ['USER', 'R_ADMIN']
  },
  // children: [
  //   {
  //     path: 'game-list',
  //     name: 'GameList',
  //     component: '/game/list',
  //     meta: {
  //       title: 'Game List',
  //       keepAlive: true,
  //       authList: [
  //         { title: '新增', authMark: 'add' },
  //         { title: '编辑', authMark: 'edit' }
  //       ]
  //     }
  //   },
  //   {
  //     path: 'detail/:id',
  //     name: 'GameDetail',
  //     component: '/game/detail',
  //     meta: {
  //       title: 'menus.game.gameDetail',
  //       isHide: true,
  //       keepAlive: true,
  //       activePath: '/game/game-list'
  //     }
  //   },
  //   {
  //     path: 'comment',
  //     name: 'GameComment',
  //     component: '/game/comment',
  //     meta: {
  //       isHide: true,
  //       title: 'menus.game.comment',
  //       keepAlive: true
  //     }
  //   },
  //   {
  //     path: 'publish',
  //     name: 'GamePublish',
  //     component: '/game/publish',
  //     meta: {
  //       isHide: true,
  //       title: 'menus.game.gamePublish',
  //       keepAlive: true,
  //       authList: [{ title: '发布', authMark: 'add' }]
  //     }
  //   }
  // ]
}
