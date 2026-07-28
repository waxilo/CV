import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  cloneTemplateApi,
  createTemplateApi,
  deleteTemplateApi,
  getTemplateDetailApi,
  listTemplatesApi,
  updateTemplateApi,
} from '/@/api/template';
import { migrateTemplateConfig } from '/@/features/template-renderer';
import type { ITemplate, ITemplateConfig } from '/@/types/template';

export const useTemplateStore = defineStore('template', () => {
  const list = ref<ITemplate[]>([]);
  const current = ref<ITemplate | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);

  const builtins = computed(() => list.value.filter((t) => t.is_builtin));
  const customs = computed(() => list.value.filter((t) => !t.is_builtin));

  function normalizeList(items: ITemplate[]): ITemplate[] {
    return items.map((t) => ({
      ...t,
      config: migrateTemplateConfig(t.config),
    }));
  }

  async function fetchList() {
    isLoading.value = true;
    try {
      const res = await listTemplatesApi();
      list.value = normalizeList(res.data || []);
    } finally {
      isLoading.value = false;
    }
  }

  async function loadDetail(templateId: string) {
    isLoading.value = true;
    try {
      const res = await getTemplateDetailApi(templateId);
      if (res.data) {
        current.value = {
          ...res.data,
          config: migrateTemplateConfig(res.data.config),
        };
        return current.value;
      }
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function createTemplate(payload: {
    name: string;
    description?: string;
    config: ITemplateConfig;
  }) {
    isSaving.value = true;
    try {
      const res = await createTemplateApi(payload);
      await fetchList();
      return res.data?.template_id || null;
    } finally {
      isSaving.value = false;
    }
  }

  async function updateTemplate(payload: {
    template_id: string;
    name?: string;
    description?: string;
    config?: ITemplateConfig;
  }) {
    isSaving.value = true;
    try {
      await updateTemplateApi(payload);
      await fetchList();
      if (current.value?.template_id === payload.template_id) {
        await loadDetail(payload.template_id);
      }
    } finally {
      isSaving.value = false;
    }
  }

  async function removeTemplate(templateId: string) {
    await deleteTemplateApi(templateId);
    await fetchList();
    if (current.value?.template_id === templateId) current.value = null;
  }

  async function cloneTemplate(templateId: string, name?: string) {
    isSaving.value = true;
    try {
      const res = await cloneTemplateApi(templateId, name);
      await fetchList();
      return res.data?.template_id || null;
    } finally {
      isSaving.value = false;
    }
  }

  function getById(templateId: string): ITemplate | undefined {
    return list.value.find((t) => t.template_id === templateId);
  }

  return {
    list,
    current,
    isLoading,
    isSaving,
    builtins,
    customs,
    fetchList,
    loadDetail,
    createTemplate,
    updateTemplate,
    removeTemplate,
    cloneTemplate,
    getById,
  };
});
