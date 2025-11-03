import { AppRouteRecord } from '@/types/router'

export const playerRoutes: AppRouteRecord = {
  path: '/player',
  name: 'Players',
  component: '/player/index',
  // component: '/player/list',
  meta: {
    title: 'Players',
    icon: 'mdi:account-group',
    // roles: ['R_SUPER', 'R_ADMIN']
    // roles: ['USER', 'R_ADMIN']
  },
  // children: [
  //   {
  //     path: 'player-list',
  //     name: 'PlayerList',
  //     component: '/player/list',
  //     meta: {
  //       title: 'Player List',
  //       keepAlive: true,
  //       authList: [
  //         { title: '新增', authMark: 'add' },
  //         { title: '编辑', authMark: 'edit' }
  //       ]
  //     }
  //   },
  //   {
  //     path: 'detail/:id',
  //     name: 'PlayerDetail',
  //     component: '/player/detail',
  //     meta: {
  //       title: 'menus.player.playerDetail',
  //       isHide: true,
  //       keepAlive: true,
  //       activePath: '/player/player-list'
  //     }
  //   },
  //   {
  //     path: 'comment',
  //     name: 'PlayerComment',
  //     component: '/player/comment',
  //     meta: {
  //       isHide: true,
  //       title: 'menus.player.comment',
  //       keepAlive: true
  //     }
  //   },
  //   {
  //     path: 'publish',
  //     name: 'PlayerPublish',
  //     component: '/player/publish',
  //     meta: {
  //       isHide: true,
  //       title: 'menus.player.playerPublish',
  //       keepAlive: true,
  //       authList: [{ title: '发布', authMark: 'add' }]
  //     }
  //   }
  // ]
}
