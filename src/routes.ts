import { RouteRecordRaw, createRouter, createWebHashHistory } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'index',
    redirect: '/effect',
  },
  {
    path: '/effect',
    name: 'effect',
    component: () => import('./views/EffectDome.vue')
  },
  {
    path: '/watch-effect',
    name: 'watch-effect',
    component: () => import('./views/WatchEffectDome.vue')
  },
  {
    path: '/i-reactive',
    name: 'i-reactive',
    component: () => import('./views/IReactive.vue')
  },
]

const router = createRouter({
  history: createWebHashHistory('./'),
  routes,
});

export default router;