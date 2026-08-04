import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import {
  getResumeDetailApi,
  updateResumeApi,
  createResumeApi,
  listResumesApi,
  deleteResumeApi,
  cloneResumeApi,
} from '/@/api/resume';
import type {
  IResumeData,
  IResumeSection,
  IResumeSummary,
  TSectionItem,
  TSectionType,
} from '/@/types/resume';

function createEmptyItem(type: TSectionType): Record<string, unknown> {
  const id = uuidv4();
  switch (type) {
    case 'experience':
      return {
        id,
        company: '',
        position: '',
        location: '',
        startDate: '',
        endDate: '',
        isCurrent: false,
        description: '',
        visible: true,
      };
    case 'education':
      return {
        id,
        school: '',
        degree: '',
        major: '',
        startDate: '',
        endDate: '',
        description: '',
        visible: true,
      };
    case 'skills':
      return { id, name: '', level: 3, keywords: [], description: '', visible: true };
    case 'projects':
      return {
        id,
        name: '',
        url: '',
        startDate: '',
        endDate: '',
        description: '',
        visible: true,
      };
    case 'languages':
      return { id, name: '', level: '熟练', visible: true };
    case 'certificates':
      return { id, name: '', issuer: '', date: '', url: '', visible: true };
    case 'custom':
      return { id, title: '', subtitle: '', date: '', description: '', visible: true };
    default:
      return { id, visible: true };
  }
}

const SECTION_NAME_MAP: Record<string, string> = {
  summary: '个人简介',
  experience: '工作经历',
  education: '教育经历',
  skills: '专业技能',
  projects: '项目经历',
  languages: '语言能力',
  certificates: '证书资质',
  awards: '荣誉奖项',
  interests: '兴趣爱好',
  custom: '自定义模块',
};

export const useResumeStore = defineStore('resume', () => {
  const list = ref<IResumeSummary[]>([]);
  const currentId = ref<string>('');
  const title = ref('未命名简历');
  const data = ref<IResumeData | null>(null);
  const isPublic = ref(false);
  const shareToken = ref<string | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const isDirty = ref(false);

  const sortedSections = computed(() => {
    if (!data.value) return [];
    return [...data.value.sections].sort((a, b) => a.order - b.order);
  });

  const visibleSections = computed(() => sortedSections.value.filter((s) => s.visible));

  async function fetchList() {
    isLoading.value = true;
    try {
      const res = await listResumesApi();
      list.value = res.data || [];
    } finally {
      isLoading.value = false;
    }
  }

  async function createResume(resumeTitle = '未命名简历', templateId = 'modern') {
    const res = await createResumeApi({ title: resumeTitle, template_id: templateId });
    if (res.data) {
      await fetchList();
      return res.data.resume_id;
    }
    return null;
  }

  async function loadResume(resumeId: string) {
    isLoading.value = true;
    try {
      const res = await getResumeDetailApi(resumeId);
      if (res.data) {
        currentId.value = res.data.resume_id;
        title.value = res.data.title;
        data.value = res.data.data;
        isPublic.value = Boolean(res.data.is_public);
        shareToken.value = res.data.share_token || null;
        isDirty.value = false;
      }
    } finally {
      isLoading.value = false;
    }
  }

  async function saveResume() {
    if (!currentId.value || !data.value) return;
    isSaving.value = true;
    try {
      await updateResumeApi({
        resume_id: currentId.value,
        title: title.value,
        data: data.value,
        template_id: data.value.metadata.templateId,
      });
      isDirty.value = false;
    } finally {
      isSaving.value = false;
    }
  }

  /**
   * 开启/关闭在线分享。
   * 每次开启都会生成新的 share_token，旧链接立即失效。
   */
  async function setPublicShare(enabled: boolean) {
    if (!currentId.value) return;
    const res = await updateResumeApi({
      resume_id: currentId.value,
      is_public: enabled,
    });
    isPublic.value = enabled;
    shareToken.value = enabled ? res.data?.share_token || null : null;
  }

  async function removeResume(resumeId: string) {
    await deleteResumeApi(resumeId);
    await fetchList();
  }

  /** 复制一份简历：后端深拷贝完整 data（内容、主题、字体等） */
  async function duplicateResume(resumeId: string) {
    const res = await cloneResumeApi(resumeId);
    if (!res.data?.resume_id) return null;
    await fetchList();
    return res.data.resume_id;
  }

  function markDirty() {
    isDirty.value = true;
  }

  function updateBasics(patch: Partial<IResumeData['basics']>) {
    if (!data.value) return;
    data.value.basics = { ...data.value.basics, ...patch };
    markDirty();
  }

  function reorderSections(sections: IResumeSection[]) {
    if (!data.value) return;
    data.value.sections = sections.map((s, index) => ({ ...s, order: index }));
    markDirty();
  }

  function toggleSectionVisible(sectionId: string) {
    if (!data.value) return;
    const section = data.value.sections.find((s) => s.id === sectionId);
    if (section) {
      section.visible = !section.visible;
      markDirty();
    }
  }

  function renameSection(sectionId: string, name: string) {
    if (!data.value) return;
    const section = data.value.sections.find((s) => s.id === sectionId);
    if (section) {
      section.name = name;
      markDirty();
    }
  }

  function addSection(type: TSectionType) {
    if (!data.value) return;
    const maxOrder = Math.max(0, ...data.value.sections.map((s) => s.order));
    const section: IResumeSection = {
      id: uuidv4(),
      type,
      name: SECTION_NAME_MAP[type] || '自定义模块',
      visible: true,
      order: maxOrder + 1,
      items: type === 'summary' ? [] : [createEmptyItem(type)],
      content: type === 'summary' ? '' : undefined,
    };
    data.value.sections.push(section);
    markDirty();
    return section.id;
  }

  function removeSection(sectionId: string) {
    if (!data.value) return;
    data.value.sections = data.value.sections.filter((s) => s.id !== sectionId);
    markDirty();
  }

  function addItem(sectionId: string) {
    if (!data.value) return;
    const section = data.value.sections.find((s) => s.id === sectionId);
    if (!section) return;
    section.items.push(createEmptyItem(section.type));
    markDirty();
  }

  function updateItem(sectionId: string, itemId: string, patch: Record<string, unknown>) {
    if (!data.value) return;
    const section = data.value.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const idx = section.items.findIndex((i) => (i as { id: string }).id === itemId);
    if (idx >= 0) {
      section.items[idx] = { ...section.items[idx], ...patch };
      markDirty();
    }
  }

  function removeItem(sectionId: string, itemId: string) {
    if (!data.value) return;
    const section = data.value.sections.find((s) => s.id === sectionId);
    if (!section) return;
    section.items = section.items.filter((i) => (i as { id: string }).id !== itemId);
    markDirty();
  }

  /**
   * 重排模块内的条目。
   *
   * 条目没有 order 字段，渲染顺序就是数组顺序，所以直接整体替换数组。
   */
  function reorderItems(sectionId: string, items: TSectionItem[]) {
    if (!data.value) return;
    const section = data.value.sections.find((s) => s.id === sectionId);
    if (!section) return;
    section.items = [...items];
    markDirty();
  }

  function updateSectionContent(sectionId: string, content: string) {
    if (!data.value) return;
    const section = data.value.sections.find((s) => s.id === sectionId);
    if (section) {
      section.content = content;
      markDirty();
    }
  }

  /** metadata.theme 字段 → 模板变量 key 的映射 */
  const THEME_TO_VAR: Record<string, string> = {
    primaryColor: 'primaryColor',
    textColor: 'textColor',
    fontFamily: 'fontFamily',
    fontSize: 'fontSize',
    spacing: 'lineHeight',
  };

  /**
   * 切换模板。
   *
   * 同时把 templateVars 清空为 {}：新模板声明的变量默认值应该立刻生效，
   * 而不是继承上一个模板的调参结果。空对象（而不是 undefined）也标记了
   * 这份简历已进入新的变量体系，渲染时不再回退读 metadata.theme。
   */
  function setTemplate(templateId: string, primaryColor?: string) {
    if (!data.value) return;
    data.value.metadata.templateId = templateId;
    data.value.metadata.templateVars = {};
    if (primaryColor) {
      data.value.metadata.theme.primaryColor = primaryColor;
    }
    markDirty();
  }

  /**
   * 更新主题。
   *
   * 除了写 metadata.theme（保持向后兼容），还会同步写入 templateVars 的同名变量，
   * 因为渲染层在 templateVars 存在时不再读 theme。
   */
  function updateTheme(patch: Partial<IResumeData['metadata']['theme']>) {
    if (!data.value) return;
    data.value.metadata.theme = { ...data.value.metadata.theme, ...patch };

    const vars = { ...(data.value.metadata.templateVars || {}) };
    for (const [themeKey, value] of Object.entries(patch)) {
      const varKey = THEME_TO_VAR[themeKey];
      if (varKey && value !== undefined && value !== null) {
        vars[varKey] = value as string | number | boolean;
      }
    }
    data.value.metadata.templateVars = vars;

    markDirty();
  }

  /** 更新单个模板变量（模板自定义参数面板用） */
  function updateTemplateVar(key: string, value: string | number | boolean) {
    if (!data.value) return;
    data.value.metadata.templateVars = {
      ...(data.value.metadata.templateVars || {}),
      [key]: value,
    };
    markDirty();
  }

  /** 恢复模板变量为模板声明的默认值 */
  function resetTemplateVars() {
    if (!data.value) return;
    data.value.metadata.templateVars = {};
    markDirty();
  }

  /**
   * 更新页边距（毫米，四向统一）。
   * 写入 resume.metadata.page.margin，渲染时覆盖模板声明的四向边距。
   */
  function updatePageMargin(marginMm: number) {
    if (!data.value) return;
    const margin = Math.min(50, Math.max(0, Math.round(marginMm * 10) / 10));
    data.value.metadata.page = {
      ...(data.value.metadata.page || {}),
      format: 'a4',
      margin,
    };
    markDirty();
  }

  function setTitle(next: string) {
    title.value = next;
    markDirty();
  }

  return {
    list,
    currentId,
    title,
    data,
    isPublic,
    shareToken,
    isLoading,
    isSaving,
    isDirty,
    sortedSections,
    visibleSections,
    fetchList,
    createResume,
    loadResume,
    saveResume,
    setPublicShare,
    removeResume,
    duplicateResume,
    updateBasics,
    reorderSections,
    toggleSectionVisible,
    renameSection,
    addSection,
    removeSection,
    addItem,
    updateItem,
    removeItem,
    reorderItems,
    updateSectionContent,
    setTemplate,
    updateTheme,
    updateTemplateVar,
    resetTemplateVars,
    updatePageMargin,
    setTitle,
  };
});
