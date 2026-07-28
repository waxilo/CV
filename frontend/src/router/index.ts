import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useUserStore } from '/@/stores/user';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('/@/views/Login.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('/@/views/Dashboard.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/editor/:id',
    name: 'Editor',
    component: () => import('/@/views/Editor.vue'),
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  // History 模式同时支持网页部署与 Tauri；Pages 通过 public/_redirects 做 SPA 回退
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to, _from, next) => {
  const userStore = useUserStore();
  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    next({ name: 'Login', query: { redirect: to.fullPath } });
  } else if (to.name === 'Login' && userStore.isLoggedIn) {
    next({ name: 'Dashboard' });
  } else {
    next();
  }
});

export default router;
