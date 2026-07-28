<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useUserStore } from '/@/stores/user';
import { useResumeStore } from '/@/stores/resume';

const router = useRouter();
const userStore = useUserStore();
const resumeStore = useResumeStore();
const isCreating = ref(false);

onMounted(() => {
  resumeStore.fetchList();
});

async function handleCreate() {
  isCreating.value = true;
  try {
    const id = await resumeStore.createResume('我的简历', 'modern');
    if (id) {
      ElMessage.success('创建成功');
      router.push(`/editor/${id}`);
    }
  } finally {
    isCreating.value = false;
  }
}

function openEditor(id: string) {
  router.push(`/editor/${id}`);
}

async function handleDelete(id: string, title: string) {
  await ElMessageBox.confirm(`确定删除「${title}」？此操作不可恢复。`, '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  });
  await resumeStore.removeResume(id);
  ElMessage.success('已删除');
}

function handleLogout() {
  userStore.logout();
  router.replace('/login');
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('zh-CN');
  } catch {
    return value;
  }
}
</script>

<template>
  <div class="dashboard">
    <header class="topbar no-print">
      <div class="brand">
        <span class="mark">CV</span>
        <strong>CV Builder</strong>
      </div>
      <div class="actions">
        <span class="user">{{ userStore.displayName }}</span>
        <el-button text @click="handleLogout">退出</el-button>
      </div>
    </header>

    <main class="content">
      <div class="section-head">
        <div>
          <h1>我的简历</h1>
          <p>创建、编辑、切换模板，支持模块拖拽排序</p>
        </div>
        <el-button type="primary" :loading="isCreating" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          新建简历
        </el-button>
      </div>

      <div v-loading="resumeStore.isLoading" class="grid">
        <button class="card create" type="button" @click="handleCreate">
          <el-icon :size="28"><Plus /></el-icon>
          <span>新建空白简历</span>
        </button>

        <article
          v-for="item in resumeStore.list"
          :key="item.resume_id"
          class="card resume"
          @click="openEditor(item.resume_id)"
        >
          <div class="card-top">
            <h3>{{ item.title }}</h3>
            <el-tag size="small" effect="plain">{{ item.template_id }}</el-tag>
          </div>
          <p class="meta">更新于 {{ formatDate(item.updated_at) }}</p>
          <div class="card-actions" @click.stop>
            <el-button size="small" type="primary" plain @click="openEditor(item.resume_id)">
              编辑
            </el-button>
            <el-button
              size="small"
              type="danger"
              plain
              @click="handleDelete(item.resume_id, item.title)"
            >
              删除
            </el-button>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.dashboard {
  min-height: 100%;
}

.topbar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--cv-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;

  .mark {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: linear-gradient(135deg, #2563eb, #0ea5e9);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    display: grid;
    place-items: center;
  }
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;

  .user {
    color: var(--cv-muted);
    font-size: 14px;
  }
}

.content {
  max-width: 1100px;
  margin: 0 auto;
  padding: 36px 28px 64px;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 28px;

  h1 {
    font-size: 28px;
    letter-spacing: -0.02em;
    margin-bottom: 6px;
  }

  p {
    color: var(--cv-muted);
    font-size: 14px;
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  min-height: 160px;
}

.card {
  background: var(--cv-surface);
  border: 1px solid var(--cv-border);
  border-radius: var(--cv-radius);
  box-shadow: var(--cv-shadow);
  padding: 20px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: #93c5fd;
    transform: translateY(-2px);
  }

  &.create {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 160px;
    color: var(--cv-muted);
    border-style: dashed;
    background: rgba(255, 255, 255, 0.6);
  }

  h3 {
    font-size: 16px;
    margin-bottom: 8px;
  }

  .meta {
    color: var(--cv-muted);
    font-size: 12px;
    margin-bottom: 16px;
  }
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.card-actions {
  display: flex;
  gap: 8px;
}
</style>
