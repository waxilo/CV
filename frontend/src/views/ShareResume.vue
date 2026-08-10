<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getSharedResumeApi, type ISharedResumePayload } from '/@/api/resume';
import ResumeFullPreview from '/@/components/preview/ResumeFullPreview.vue';
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
    <div v-if="error" class="empty">
      <h2>无法打开这份简历</h2>
      <p>{{ error }}</p>
    </div>

    <ResumeFullPreview
      v-else-if="payload && config"
      :data="payload.data"
      :config="config"
      :title="displayName"
      variant="page"
      :show-toolbar="true"
    />
  </div>
</template>

<style scoped lang="scss">
.share-page {
  height: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
</style>
