import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { loginApi, registerApi, getProfileApi, type ILoginRequest, type IRegisterRequest } from '/@/api/auth';
import type { IUser } from '/@/types/resume';

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem('cv_token') || '');
  const user = ref<IUser | null>(
    localStorage.getItem('cv_user') ? JSON.parse(localStorage.getItem('cv_user')!) : null
  );

  const isLoggedIn = computed(() => !!token.value);
  const displayName = computed(() => user.value?.display_name || user.value?.username || '用户');

  function persist(nextToken: string, nextUser: IUser) {
    token.value = nextToken;
    user.value = nextUser;
    localStorage.setItem('cv_token', nextToken);
    localStorage.setItem('cv_user', JSON.stringify(nextUser));
  }

  async function login(payload: ILoginRequest) {
    const res = await loginApi(payload);
    if (res.data) {
      persist(res.data.token, res.data.user);
    }
    return res;
  }

  async function register(payload: IRegisterRequest) {
    const res = await registerApi(payload);
    if (res.data) {
      persist(res.data.token, res.data.user);
    }
    return res;
  }

  async function fetchProfile() {
    if (!token.value) return;
    const res = await getProfileApi();
    if (res.data) {
      user.value = res.data;
      localStorage.setItem('cv_user', JSON.stringify(res.data));
    }
  }

  function logout() {
    token.value = '';
    user.value = null;
    localStorage.removeItem('cv_token');
    localStorage.removeItem('cv_user');
  }

  return {
    token,
    user,
    isLoggedIn,
    displayName,
    login,
    register,
    fetchProfile,
    logout,
  };
});
