import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import {
  getResumeDetailApi,
  updateResumeApi,
  createResumeApi,
  listResumesApi,
  deleteResumeApi,
} from '/@/api/resume';
import type {
  IResumeData,
  IResumeSection,
  IResumeSummary,
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
      return { id, name: '', level: 3, keywords: [], visible: true };
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

  async function removeResume(resumeId: string) {
    await deleteResumeApi(resumeId);
    await fetchList();
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

  function updateSectionContent(sectionId: string, content: string) {
    if (!data.value) return;
    const section = data.value.sections.find((s) => s.id === sectionId);
    if (section) {
      section.content = content;
      markDirty();
    }
  }

  function setTemplate(templateId: string, primaryColor?: string) {
    if (!data.value) return;
    data.value.metadata.templateId = templateId;
    if (primaryColor) {
      data.value.metadata.theme.primaryColor = primaryColor;
    }
    markDirty();
  }

  function updateTheme(patch: Partial<IResumeData['metadata']['theme']>) {
    if (!data.value) return;
    data.value.metadata.theme = { ...data.value.metadata.theme, ...patch };
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
    isLoading,
    isSaving,
    isDirty,
    sortedSections,
    visibleSections,
    fetchList,
    createResume,
    loadResume,
    saveResume,
    removeResume,
    updateBasics,
    reorderSections,
    toggleSectionVisible,
    renameSection,
    addSection,
    removeSection,
    addItem,
    updateItem,
    removeItem,
    updateSectionContent,
    setTemplate,
    updateTheme,
    setTitle,
  };
});
