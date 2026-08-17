import { describe, expect, it, vi } from 'vitest';
import { getBuiltinTemplate } from '@cv/template-schema';
import { createSampleResumeData } from '../sampleData';
import {
  builtinTemplateFallback,
  pickResumeTemplateConfig,
  resolveResumeTemplateConfig,
  type ITemplateStoreLike,
} from '../resumeConfig';
import type { ITemplate } from '/@/types/template';

function toTemplate(id: string): ITemplate {
  const builtin = getBuiltinTemplate(id)!;
  return {
    template_id: builtin.id,
    name: builtin.name,
    description: builtin.description,
    thumbnail_url: null,
    config: builtin.config,
    is_builtin: true,
    trust: 'trusted',
  };
}

function makeStore(overrides?: Partial<ITemplateStoreLike>): ITemplateStoreLike {
  const list: ITemplate[] = overrides?.list ? [...overrides.list] : [];
  return {
    list,
    getById: (id) => list.find((t) => t.template_id === id),
    fetchList: vi.fn().mockResolvedValue(undefined),
    loadDetail: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('pickResumeTemplateConfig（同步优先链）', () => {
  const data = createSampleResumeData();

  it('显式传入的配置最优先', () => {
    const explicit = getBuiltinTemplate('classic')!.config;
    const store = makeStore({ list: [toTemplate('modern')] });
    const picked = pickResumeTemplateConfig(data, store, explicit);
    expect(picked?.meta.title).toBe(explicit.meta.title);
    expect(picked?.source.html).toBe(explicit.source.html);
  });

  it('简历快照优先于模板中心', () => {
    const snapshot = getBuiltinTemplate('classic')!.config;
    const withSnapshot = {
      ...data,
      metadata: { ...data.metadata, templateConfig: snapshot },
    };
    const store = makeStore({ list: [toTemplate('modern')] });
    const picked = pickResumeTemplateConfig(withSnapshot, store);
    expect(picked?.meta.title).toBe(snapshot.meta.title);
    // 快照是 classic，模板中心是 modern → 应取 classic
    expect(picked?.source.html).toContain('<article');
  });

  it('无快照时走模板中心列表', () => {
    const withId = { ...data, metadata: { ...data.metadata, templateId: 'technical' } };
    const store = makeStore({ list: [toTemplate('technical')] });
    const picked = pickResumeTemplateConfig(withId, store);
    expect(picked?.meta.title).toBe(toTemplate('technical').config.meta.title);
  });

  it('损坏快照不抛错，宽容降级为合法配置', () => {
    // truthy 的坏值应被宽容降级，而不是 throw
    for (const bad of ['garbage', 42, [], { engine: 7 }]) {
      const withBad = {
        ...data,
        metadata: { ...data.metadata, templateConfig: bad as never },
      };
      const picked = pickResumeTemplateConfig(withBad, makeStore());
      expect(picked).not.toBeNull();
      expect(picked?.schemaVersion).toBe(2);
      expect(picked?.engine).toBeTruthy();
    }
    // falsy 快照（null）等同「无快照」，按无快照语义返回 null
    const withNull = {
      ...data,
      metadata: { ...data.metadata, templateConfig: null as never },
    };
    expect(pickResumeTemplateConfig(withNull, makeStore())).toBeNull();
  });

  it('全部找不到时返回 null（由调用方走内置兜底）', () => {
    expect(pickResumeTemplateConfig(data, makeStore())).toBeNull();
  });
});

describe('resolveResumeTemplateConfig（完整链）', () => {
  const data = createSampleResumeData();

  it('store 未加载时先 fetchList 再查', async () => {
    const withId = { ...data, metadata: { ...data.metadata, templateId: 'modern' } };
    const store = makeStore();
    (store.fetchList as ReturnType<typeof vi.fn>).mockImplementation(() => {
      (store.list as ITemplate[]).push(toTemplate('modern'));
      return Promise.resolve();
    });
    const resolved = await resolveResumeTemplateConfig(withId, store);
    expect(resolved?.meta.title).toBe(toTemplate('modern').config.meta.title);
    expect(store.fetchList).toHaveBeenCalledOnce();
  });

  it('列表无果时走详情接口', async () => {
    const store = makeStore({
      loadDetail: vi.fn().mockResolvedValue(toTemplate('minimal')),
    });
    const resolved = await resolveResumeTemplateConfig(data, store);
    expect(resolved?.meta.title).toBe(toTemplate('minimal').config.meta.title);
  });

  it('接口失败时回退内置模板', async () => {
    const store = makeStore({
      loadDetail: vi.fn().mockRejectedValue(new Error('network')),
    });
    const resolved = await resolveResumeTemplateConfig(data, store);
    expect(resolved).not.toBeNull();
    expect(resolved?.schemaVersion).toBe(2);
  });
});

describe('builtinTemplateFallback', () => {
  it('未知模板 id 回退 minimal', () => {
    const fallback = builtinTemplateFallback('no-such-template');
    expect(fallback?.meta.title).toBe(getBuiltinTemplate('minimal')!.config.meta.title);
  });

  it('已知内置模板返回同名配置', () => {
    const fallback = builtinTemplateFallback('business');
    expect(fallback?.meta.title).toBe(getBuiltinTemplate('business')!.config.meta.title);
  });
});
