<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getSharedResumeApi, type ISharedResumePayload } from '/@/api/resume';
import PaperThumb from '/@/components/preview/PaperThumb.vue';
import { normalizeTemplateConfig } from '/@/features/template-renderer';
import type { ITemplateConfig } from '/@/types/template';

const route = useRoute();

const loading = ref(true);
const error = ref('');
const payload = ref<ISharedResumePayload | null>(null);
const config = ref<ITemplateConfig | null>(null);

const displayName = computed(() => {
  if (!payload.value) return '简历';
  return payload.value.data.basics.name || payload.value.title || '简历';
});

onMounted(async () => {
  const resumeId = String(route.params.id || '');
  if (!resumeId) {
    error.value = '链接无效';
    loading.value = false;
    return;
  }

  try {
    const res = await getSharedResumeApi(resumeId);
    if (!res.data) {
      error.value = '分享不存在或已关闭';
      return;
    }
    payload.value = res.data;
    config.value = normalizeTemplateConfig(res.data.template_config);
    const name = res.data.data.basics.name || res.data.title || '简历';
    document.title = `${name} · 在线简历`;
  } catch (e: unknown) {
    const message =
      e && typeof e === 'object' && 'message' in e
        ? String((e as { message: unknown }).message)
        : '无法加载分享简历';
    error.value = message || '分享不存在或已关闭';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="share-page" v-loading="loading">
    <header v-if="payload && !error" class="share-bar no-print">
      <div class="share-bar-inner">
        <div class="identity">
          <h1>{{ displayName }}</h1>
          <p v-if="payload.data.basics.headline" class="headline">{{ payload.data.basics.headline }}</p>
        </div>
        <p class="hint">在线预览 · 内容随作者更新</p>
      </div>
    </header>

    <main class="share-main">
      <div v-if="error" class="empty">
        <h2>无法打开这份简历</h2>
        <p>{{ error }}</p>
      </div>

      <div v-else-if="payload && config" class="paper-wrap">
        <PaperThumb
          :data="payload.data"
          :config="config"
          :fallback-scale="0.85"
          freeze-scale
          show-all-pages
          page-layout="vertical"
        />
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.share-page {
  min-height: 100%;
  background: #e8eaed;
}

.share-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(255, 255, 255, 0.92);
  border-bottom: 1px solid #e2e8f0;
  backdrop-filter: blur(8px);
}

.share-bar-inner {
  max-width: 820px;
  margin: 0 auto;
  padding: 14px 20px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.identity h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  color: #0f172a;
}

.headline {
  margin: 4px 0 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.4;
}

.hint {
  margin: 0;
  flex-shrink: 0;
  font-size: 12px;
  color: #94a3b8;
}

.share-main {
  padding: 24px 16px 48px;
}

.paper-wrap {
  width: min(100%, 794px);
  margin: 0 auto;
}

.empty {
  max-width: 420px;
  margin: 80px auto;
  padding: 32px 24px;
  text-align: center;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);

  h2 {
    margin: 0 0 8px;
    font-size: 18px;
    color: #0f172a;
  }

  p {
    margin: 0;
    font-size: 14px;
    color: #64748b;
    line-height: 1.5;
  }
}

@media print {
  .share-page {
    background: #fff;
  }

  .share-main {
    padding: 0;
  }

  .paper-wrap {
    width: 100%;
  }
}
</style>
