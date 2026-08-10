<script setup lang="ts">
/**
 * MCP 接入页：账号级 API Key 与 Cursor 配置说明。
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '/@/stores/user';
import McpPanel from '/@/components/mcp/McpPanel.vue';

const router = useRouter();
const userStore = useUserStore();
const userInitial = computed(() => userStore.displayName.trim().charAt(0).toUpperCase() || 'U');

function goDashboard() {
  router.push('/');
}

function handleUserCommand(command: string) {
  if (command === 'dashboard') {
    goDashboard();
    return;
  }
  if (command === 'templates') {
    router.push('/templates');
    return;
  }
  if (command === 'logout') {
    userStore.logout();
    router.replace('/login');
  }
}
</script>

<template>
  <div class="mcp-page">
    <header class="topbar no-print">
      <div class="nav-inner">
        <button class="brand" type="button" aria-label="返回简历首页" @click="goDashboard">
          <span class="mark">
            <el-icon :size="18"><Document /></el-icon>
          </span>
          <strong>CV Builder</strong>
        </button>

        <div class="nav-actions">
          <button class="nav-link" type="button" @click="goDashboard">我的简历</button>
          <button class="nav-link" type="button" @click="router.push('/templates')">模板中心</button>
          <button class="nav-link active" type="button">MCP 接入</button>
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

    <main class="content">
      <section class="page-heading">
        <div>
          <h1>MCP 接入</h1>
          <p>创建 API Key，一键复制提示词，让 Agent 帮你安装全局 MCP</p>
        </div>
      </section>
      <McpPanel />
    </main>
  </div>
</template>

<style scoped lang="scss">
.mcp-page {
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(99, 102, 241, 0.08), transparent 28%),
    radial-gradient(circle at top right, rgba(14, 165, 233, 0.08), transparent 24%),
    #f8fafc;
}

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
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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

.content {
  max-width: 880px;
  margin: 0 auto;
  padding: 36px 24px 88px;
}

.page-heading {
  margin-bottom: 8px;

  h1 {
    margin: 0 0 8px;
    color: #0f172a;
    font-size: clamp(24px, 2.2vw, 30px);
    letter-spacing: -0.03em;
  }

  p {
    margin: 0;
    color: #64748b;
    font-size: 14px;
    line-height: 1.6;
  }
}
</style>
