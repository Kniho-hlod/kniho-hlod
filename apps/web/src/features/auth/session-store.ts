import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { ApiError } from '@eleansphere/entity-core';
import type { LoginResponse } from '@eleansphere/entity-core';
import {
  ADMIN_ROLE,
  type ProfileChanges,
  type RegisterRequest,
  type User,
} from '@kniho-hlod/domain';
import { services, session, sessionStorage } from '@/app/api';
import { setLocale } from '@/app/i18n';

/** Who is signed in, and everything that changes it. */
export const useSessionStore = defineStore('session', () => {
  const user = ref<User | null>(null);
  const isRestoring = ref(false);

  const isSignedIn = computed(() => user.value !== null);
  const isAdmin = computed(() => user.value?.role === ADMIN_ROLE);

  function remember(startedSession: LoginResponse<User>): void {
    session.start(startedSession);
    setUser(startedSession.user);
  }

  function setUser(signedInUser: User): void {
    user.value = signedInUser;
    setLocale(signedInUser.locale);
  }

  /** Forgets the local session without calling the server (e.g. after it rejected our tokens). */
  function forget(): void {
    session.end();
    user.value = null;
  }

  let restoration: Promise<void> | null = null;

  /**
   * Loads the signed-in user on startup, once; every later call waits for that same load. It never
   * fails: when the server cannot say who is signed in, the error is reported and the app starts
   * signed out.
   */
  function restore(): Promise<void> {
    restoration ??= loadStoredUser().catch(reportError);
    return restoration;
  }

  /** A rejected session simply means "not signed in". */
  async function loadStoredUser(): Promise<void> {
    if (!session.isSignedIn) return;
    isRestoring.value = true;
    try {
      setUser(await services.auth.me());
    } catch (err) {
      if (!(err instanceof ApiError) || !err.isAuthError) throw err;
      forget();
    } finally {
      isRestoring.value = false;
    }
  }

  async function signIn(email: string, password: string): Promise<void> {
    remember(await services.auth.login({ email, password }));
  }

  async function register(data: RegisterRequest): Promise<void> {
    remember(await services.auth.register(data));
  }

  async function signOut(): Promise<void> {
    const refreshToken = sessionStorage.load()?.refreshToken;
    if (refreshToken) {
      // The session is over either way; a failed revocation must not keep the user signed in.
      await services.auth.logout(refreshToken).catch(() => undefined);
    }
    forget();
  }

  async function updateProfile(changes: ProfileChanges): Promise<void> {
    setUser(await services.auth.updateMe(changes));
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    remember(await services.auth.changePassword(currentPassword, newPassword));
  }

  async function deleteAccount(password: string): Promise<void> {
    await services.auth.deleteMe(password);
    forget();
  }

  return {
    user,
    isRestoring,
    isSignedIn,
    isAdmin,
    restore,
    signIn,
    register,
    signOut,
    forget,
    updateProfile,
    changePassword,
    deleteAccount,
  };
});
