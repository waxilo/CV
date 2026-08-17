import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { getBuiltinTemplate } from '@cv/template-schema';
import { useResumeStore } from '../resume';
import { createSampleResumeData } from '/@/features/template-renderer/sampleData';
import { updateResumeApi } from '/@/api/resume';
import type { IResumeSummary } from '/@/types/resume';

vi.mock('/@/api/resume', () => ({
  updateResumeApi: vi.fn().mockResolvedValue({
    success: true,
    code: '0',
    message: '',
    data: {},
  }),
}));

function makeListItem(partial: Partial<IResumeSummary>): IResumeSummary {
  return {
    resume_id: '11111111-1111-1111-1111-111111111111',
    title: '我的简历',
    slug: 'resume-test',
    template_id: 'modern',
    is_public: false,
    is_locked: false,
    data: createSampleResumeData(),
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...partial,
  };
}

describe('useResumeStore 模板快照', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('setTemplate 深拷贝完整配置为快照并清空 templateVars', () => {
    const store = useResumeStore();
    store.data = createSampleResumeData();
    store.data.metadata.templateVars = { primaryColor: '#ff0000' };

    const config = getBuiltinTemplate('classic')!.config;
    store.setTemplate('classic', config);

    expect(store.data?.metadata.templateId).toBe('classic');
    expect(store.data?.metadata.templateConfig).toEqual(config);
    // 深拷贝：修改外部 config 不影响快照
    expect(store.data?.metadata.templateConfig).not.toBe(config);
    expect(store.data?.metadata.templateVars).toEqual({});
    expect(store.isDirty).toBe(true);
  });

  it('updateTemplateConfig 替换快照并标记 dirty', () => {
    const store = useResumeStore();
    store.data = createSampleResumeData();

    const config = getBuiltinTemplate('minimal')!.config;
    store.updateTemplateConfig(config);

    expect(store.data?.metadata.templateConfig).toEqual(config);
    expect(store.isDirty).toBe(true);
  });
});

describe('useResumeStore renameResume', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('锁定中的简历直接抛错，不发请求', async () => {
    const store = useResumeStore();
    store.list = [makeListItem({ is_locked: true })];

    await expect(store.renameResume(store.list[0].resume_id, '新名字')).rejects.toThrow('锁定');
    expect(updateResumeApi).not.toHaveBeenCalled();
  });

  it('空名称抛错', async () => {
    const store = useResumeStore();
    store.list = [makeListItem({})];

    await expect(store.renameResume(store.list[0].resume_id, '   ')).rejects.toThrow('不能为空');
    expect(updateResumeApi).not.toHaveBeenCalled();
  });

  it('重命名成功：trim 后写回并同步列表项', async () => {
    const store = useResumeStore();
    store.list = [makeListItem({ title: '旧名字' })];

    await store.renameResume(store.list[0].resume_id, '  新名字  ');

    expect(updateResumeApi).toHaveBeenCalledWith({
      resume_id: store.list[0].resume_id,
      title: '新名字',
    });
    expect(store.list[0].title).toBe('新名字');
  });
});
