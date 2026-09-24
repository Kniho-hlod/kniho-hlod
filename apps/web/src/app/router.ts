import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import type { UserRole } from '@kniho-hlod/domain';
import { useSessionStore } from '@/features/auth/session-store';

declare module 'vue-router' {
  interface RouteMeta {
    /** Only for signed-in users; anyone else is sent to sign-in. */
    requiresAuth?: boolean;
    /** Only for signed-out visitors (sign-in, registration, password reset). */
    guestOnly?: boolean;
    requiresRole?: UserRole;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'home', component: () => import('@/pages/HomePage.vue') },
      { path: 'account', name: 'account', component: () => import('@/pages/AccountPage.vue') },
    ],
  },
  {
    path: '/',
    component: () => import('@/layouts/GuestLayout.vue'),
    meta: { guestOnly: true },
    children: [
      { path: 'login', name: 'sign-in', component: () => import('@/pages/SignInPage.vue') },
      { path: 'register', name: 'sign-up', component: () => import('@/pages/SignUpPage.vue') },
      {
        path: 'forgot-password',
        name: 'forgot-password',
        component: () => import('@/pages/ForgotPasswordPage.vue'),
      },
      {
        path: 'reset-password',
        name: 'reset-password',
        component: () => import('@/pages/ResetPasswordPage.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/NotFoundPage.vue'),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  const session = useSessionStore();
  if (to.meta.requiresAuth && !session.isSignedIn) {
    return { name: 'sign-in', query: { redirect: to.fullPath } };
  }
  if (to.meta.guestOnly && session.isSignedIn) {
    return { name: 'home' };
  }
  if (to.meta.requiresRole && to.meta.requiresRole !== session.user?.role) {
    return { name: 'home' };
  }
  return true;
});
