import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { ADMIN_ROLE } from '@kniho-hlod/domain';
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
      {
        // One parent for the whole section, so a link to `books` stays active on its sub-pages.
        path: 'books',
        children: [
          { path: '', name: 'books', component: () => import('@/pages/BooksPage.vue') },
          { path: 'new', name: 'book-new', component: () => import('@/pages/BookFormPage.vue') },
          {
            path: 'shelves',
            name: 'shelves',
            component: () => import('@/pages/ShelvesPage.vue'),
          },
          {
            path: ':id',
            name: 'book',
            component: () => import('@/pages/BookDetailPage.vue'),
            props: true,
          },
          {
            path: ':id/edit',
            name: 'book-edit',
            component: () => import('@/pages/BookFormPage.vue'),
            props: true,
          },
        ],
      },
      {
        // Contacts sit under loans: they are the people books are lent to.
        path: 'loans',
        children: [
          { path: '', name: 'loans', component: () => import('@/pages/LoansPage.vue') },
          { path: 'new', name: 'loan-new', component: () => import('@/pages/LoanFormPage.vue') },
          {
            path: ':id/edit',
            name: 'loan-edit',
            component: () => import('@/pages/LoanFormPage.vue'),
            props: true,
          },
          {
            path: 'contacts',
            name: 'contacts',
            component: () => import('@/pages/ContactsPage.vue'),
          },
          {
            path: 'contacts/new',
            name: 'contact-new',
            component: () => import('@/pages/ContactFormPage.vue'),
          },
          {
            path: 'contacts/:id',
            name: 'contact',
            component: () => import('@/pages/ContactDetailPage.vue'),
            props: true,
          },
          {
            path: 'contacts/:id/edit',
            name: 'contact-edit',
            component: () => import('@/pages/ContactFormPage.vue'),
            props: true,
          },
        ],
      },
      { path: 'account', name: 'account', component: () => import('@/pages/AccountPage.vue') },
      {
        path: 'admin',
        meta: { requiresRole: ADMIN_ROLE },
        children: [
          { path: '', name: 'admin', component: () => import('@/pages/AdminPage.vue') },
          {
            path: 'users',
            name: 'admin-users',
            component: () => import('@/pages/AdminUsersPage.vue'),
          },
          {
            path: 'announcements',
            name: 'announcements',
            component: () => import('@/pages/AdminAnnouncementsPage.vue'),
          },
          {
            path: 'announcements/new',
            name: 'announcement-new',
            component: () => import('@/pages/AnnouncementFormPage.vue'),
          },
          {
            path: 'announcements/:id/edit',
            name: 'announcement-edit',
            component: () => import('@/pages/AnnouncementFormPage.vue'),
            props: true,
          },
        ],
      },
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
