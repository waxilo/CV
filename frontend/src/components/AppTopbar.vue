<script setup lang="ts">
/**
 * 应用顶栏：品牌 + 统一主导航（我的简历 / 模板中心 / MCP 接入）+ 用户菜单。
 * 三页共用同一套导航与交互，当前路由高亮。
 */
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '/@/stores/user';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const userInitial = computed(() => userStore.displayName.trim().charAt(0).toUpperCase() || 'U');

const navItems = [
  { key: 'dashboard', label: '我的简历', path: '/', match: (name: string | symbol | null | undefined) => name === 'Dashboard' },
  {
    key: 'templates',
    label: '模板中心',
    path: '/templates',
    match: (name: string | symbol | null | undefined) =>
      name === 'TemplateCenter' || name === 'TemplateCreate' || name === 'TemplateEdit',
  },
  { key: 'mcp', label: 'MCP 接入', path: '/mcp', match: (name: string | symbol | null | undefined) => name === 'McpCenter' },
] as const;

type TNavCommand = (typeof navItems)[number]['key'] | 'logout';

function isActive(item: (typeof navItems)[number]): boolean {
  return item.match(route.name);
}

function go(path: string) {
  if (route.path === path) return;
  router.push(path);
}

function handleUserCommand(command: TNavCommand) {
  if (command === 'logout') {
    userStore.logout();
    router.replace('/login');
    return;
  }
  const item = navItems.find((nav) => nav.key === command);
  if (item) go(item.path);
}
</script>

<template>
  <header class="topbar no-print">
    <div class="nav-inner">
      <button class="brand" type="button" aria-label="返回简历首页" @click="go('/')">
        <span class="mark">
          <el-icon :size="18"><Document /></el-icon>
        </span>
        <strong>CV Builder</strong>
      </button>

      <div class="nav-actions">
        <nav class="nav-links" aria-label="主导航">
          <button
            v-for="item in navItems"
            :key="item.key"
            class="nav-link"
            type="button"
            :class="{ active: isActive(item) }"
            :aria-current="isActive(item) ? 'page' : undefined"
            @click="go(item.path)"
          >
            {{ item.label }}
          </button>
        </nav>

        <slot name="actions" />

        <el-dropdown trigger="click" placement="bottom-end" @command="handleUserCommand">
          <button class="user-menu" type="button" aria-label="用户菜单">
            <span class="avatar">
              <img
                v-if="userStore.user?.avatar_url"
                :src="userStore.user.avatar_url"
                :alt="userStore.displayName"
              />
              <span v-else>{{ userInitial }}</span>
            </span>
            <span class="user-name">{{ userStore.displayName }}</span>
            <el-icon class="chevron"><ArrowDown /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="dashboard">
                <el-icon><House /></el-icon>
                我的简历
              </el-dropdown-item>
              <el-dropdown-item command="templates">
                <el-icon><Collection /></el-icon>
                模板中心
              </el-dropdown-item>
              <el-dropdown-item command="mcp">
                <el-icon><Connection /></el-icon>
                MCP 接入
              </el-dropdown-item>
              <el-dropdown-item divided command="logout">
                <el-icon><SwitchButton /></el-icon>
                退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);
  background: rgba(248, 250, 252, 0.86);
  backdrop-filter: blur(12px);
}

.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  height: 64px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  color: #0f172a;

  strong {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  &:hover .mark {
    transform: translateY(-1px) rotate(-2deg);
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
  }
}

.mark {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(135deg, #2563eb, #6366f1);
  box-shadow: 0 8px 16px rgba(37, 99, 235, 0.22);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-link {
  appearance: none;
  border: 0;
  background: transparent;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.2s ease, background-color 0.2s ease;

  &:hover {
    color: #0f172a;
    background: rgba(15, 23, 42, 0.04);
  }

  &.active {
    color: #1d4ed8;
    background: rgba(37, 99, 235, 0.08);
  }
}

.user-menu {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: 4px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  padding: 4px 10px 4px 4px;
  background: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  color: #0f172a;
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: linear-gradient(135deg, #dbeafe, #e0e7ff);
  color: #4338ca;
  font-size: 12px;
  font-weight: 700;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.user-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
}

.chevron {
  color: #94a3b8;
  font-size: 12px;
}

@media (max-width: 640px) {
  .nav-inner {
    padding: 0 16px;
  }

  .nav-links,
  .user-name,
  .chevron {
    display: none;
  }
}
</style>
