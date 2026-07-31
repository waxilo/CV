<script setup lang="ts">
import { computed, reactive } from 'vue';
import draggable from 'vuedraggable';
import { ElMessageBox } from 'element-plus';
import { useResumeStore } from '/@/stores/resume';
import type { TSectionItem } from '/@/types/resume';

const props = defineProps<{
  sectionId: string;
}>();

const resumeStore = useResumeStore();

const section = computed(() =>
  resumeStore.data?.sections.find((s) => s.id === props.sectionId)
);

/** 拖拽排序直接读写 store：条目顺序就是数组顺序，没有 order 字段 */
const items = computed({
  get: () => section.value?.items ?? [],
  set: (value: TSectionItem[]) => {
    if (section.value) resumeStore.reorderItems(section.value.id, value);
  },
});

/**
 * 收起状态只是 UI 偏好，不写进简历数据，所以放在组件本地。
 * 记「已收起的 id」而不是「已展开的 id」，新增条目默认就是展开的。
 * Editor.vue 给本组件绑了 :key=sectionId，切模块时状态自然重置。
 */
const collapsedIds = reactive(new Set<string>());

function field(item: TSectionItem, key: string): string | number | boolean | string[] | undefined {
  return (item as Record<string, unknown>)[key] as string | number | boolean | string[] | undefined;
}

function itemId(item: TSectionItem): string {
  return String((item as Record<string, unknown>).id || '');
}

function text(item: TSectionItem, key: string): string {
  const value = field(item, key);
  return value === undefined || value === null ? '' : String(value).trim();
}

function isOpen(item: TSectionItem): boolean {
  return !collapsedIds.has(itemId(item));
}

function toggle(item: TSectionItem) {
  const id = itemId(item);
  if (collapsedIds.has(id)) collapsedIds.delete(id);
  else collapsedIds.add(id);
}

const allCollapsed = computed(
  () => items.value.length > 0 && items.value.every((item) => collapsedIds.has(itemId(item)))
);

function toggleAll() {
  if (allCollapsed.value) collapsedIds.clear();
  else items.value.forEach((item) => collapsedIds.add(itemId(item)));
}

/** 收起后卡片只剩这一行，所以标题要用条目自己的内容，不能是「项目」这种类型名 */
function itemTitle(item: TSectionItem): string {
  switch (section.value?.type) {
    case 'experience':
      return text(item, 'company') || '未填写公司';
    case 'education':
      return text(item, 'school') || '未填写学校';
    case 'skills':
      return text(item, 'name') || '未命名技能';
    case 'projects':
      return text(item, 'name') || '未命名项目';
    case 'languages':
      return text(item, 'name') || '未填写语言';
    default:
      return text(item, 'title') || text(item, 'name') || '未命名条目';
  }
}

function dateRange(item: TSectionItem): string {
  const start = text(item, 'startDate');
  const end = text(item, 'endDate');
  if (!start && !end) return '';
  return `${start || '—'} – ${end || '至今'}`;
}

/** 收起状态下的副标题，补充标题看不出来的信息 */
function itemMeta(item: TSectionItem): string {
  switch (section.value?.type) {
    case 'experience':
      return [text(item, 'position'), dateRange(item)].filter(Boolean).join(' · ');
    case 'education':
      return [text(item, 'degree'), text(item, 'major'), dateRange(item)].filter(Boolean).join(' · ');
    case 'skills':
      return `熟练度 ${Number(field(item, 'level') || 3)}/5`;
    case 'projects':
      return text(item, 'url');
    case 'languages':
      return text(item, 'level');
    default:
      return text(item, 'description');
  }
}

function patch(item: TSectionItem, data: Record<string, unknown>) {
  if (!section.value) return;
  resumeStore.updateItem(section.value.id, itemId(item), data);
}

function remove(item: TSectionItem) {
  if (!section.value) return;
  const id = itemId(item);
  collapsedIds.delete(id);
  resumeStore.removeItem(section.value.id, id);
}

/** 删除整个模块。左侧导航只负责选中与排序，破坏性操作收在这里 */
async function removeSection() {
  if (!section.value) return;
  try {
    await ElMessageBox.confirm(`删除模块「${section.value.name}」？`, '确认', { type: 'warning' });
  } catch {
    // 用户取消
    return;
  }
  resumeStore.removeSection(section.value.id);
}
</script>

<template>
  <div v-if="section" class="section-editor">
    <div class="head">
      <el-input
        :model-value="section.name"
        size="small"
        @update:model-value="(v: string) => resumeStore.renameSection(section!.id, v)"
      />
      <el-button
        v-if="section.type !== 'summary'"
        size="small"
        @click="resumeStore.addItem(section.id)"
      >
        添加条目
      </el-button>
      <el-button size="small" text type="danger" title="删除整个模块" @click="removeSection">
        <el-icon><Delete /></el-icon>
      </el-button>
    </div>

    <!-- 个人简介只有一段正文，没有条目列表 -->
    <el-input
      v-if="section.type === 'summary'"
      :model-value="section.content || ''"
      type="textarea"
      :rows="5"
      placeholder="简要介绍你的背景与优势"
      @update:model-value="(v: string) => resumeStore.updateSectionContent(section!.id, v)"
    />

    <template v-else>
      <div class="list-bar">
        <span class="total">共 {{ items.length }} 条</span>
        <el-button v-if="items.length" text size="small" @click="toggleAll">
          {{ allCollapsed ? '全部展开' : '全部收起' }}
        </el-button>
      </div>

      <!--
        force-fallback：不用 HTML5 原生拖放。Windows 的 WebView2 没实现原生 DnD，
        Tauri 窗口里 dragstart 根本不触发，只有 sortablejs 的鼠标事件模拟能用。
        fallback-on-body：跟随鼠标的克隆挂到 body，否则会被中间栏的 overflow 裁掉。
      -->
      <draggable
        v-model="items"
        item-key="id"
        handle=".item-drag"
        ghost-class="item-ghost"
        fallback-class="item-fallback"
        :force-fallback="true"
        :fallback-on-body="true"
        :animation="200"
      >
        <template #item="{ element: raw }">
          <div class="item-card" :class="{ folded: !isOpen(raw) }">
            <div
              class="item-head"
              role="button"
              tabindex="0"
              :aria-expanded="isOpen(raw)"
              @click="toggle(raw)"
              @keydown.enter.prevent="toggle(raw)"
              @keydown.space.prevent="toggle(raw)"
            >
              <!-- 拖拽手柄要吞掉点击，否则拖完会顺手把卡片折叠了 -->
              <el-icon class="item-drag" title="拖拽调整顺序" @click.stop><Rank /></el-icon>
              <el-icon class="caret" :class="{ open: isOpen(raw) }"><ArrowRight /></el-icon>
              <span class="item-label">
                <span class="item-title">{{ itemTitle(raw) }}</span>
                <span v-if="!isOpen(raw) && itemMeta(raw)" class="item-meta">{{ itemMeta(raw) }}</span>
              </span>
              <el-button
                class="item-del"
                text
                type="danger"
                size="small"
                title="删除条目"
                @click.stop="remove(raw)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>

            <el-collapse-transition>
              <div v-show="isOpen(raw)" class="item-body">
                <el-form label-position="top" size="small">
                  <template v-if="section!.type === 'experience'">
                    <div class="row">
                      <el-form-item label="公司">
                        <el-input :model-value="text(raw, 'company')" @update:model-value="(v: string) => patch(raw, { company: v })" />
                      </el-form-item>
                      <el-form-item label="职位">
                        <el-input :model-value="text(raw, 'position')" @update:model-value="(v: string) => patch(raw, { position: v })" />
                      </el-form-item>
                    </div>
                    <div class="row">
                      <el-form-item label="开始">
                        <el-input :model-value="text(raw, 'startDate')" placeholder="2022-01" @update:model-value="(v: string) => patch(raw, { startDate: v })" />
                      </el-form-item>
                      <el-form-item label="结束">
                        <el-input :model-value="text(raw, 'endDate')" placeholder="至今" @update:model-value="(v: string) => patch(raw, { endDate: v })" />
                      </el-form-item>
                    </div>
                    <el-form-item label="描述">
                      <el-input :model-value="text(raw, 'description')" type="textarea" :rows="3" @update:model-value="(v: string) => patch(raw, { description: v })" />
                    </el-form-item>
                  </template>

                  <template v-else-if="section!.type === 'education'">
                    <el-form-item label="学校">
                      <el-input :model-value="text(raw, 'school')" @update:model-value="(v: string) => patch(raw, { school: v })" />
                    </el-form-item>
                    <div class="row">
                      <el-form-item label="学历">
                        <el-input :model-value="text(raw, 'degree')" @update:model-value="(v: string) => patch(raw, { degree: v })" />
                      </el-form-item>
                      <el-form-item label="专业">
                        <el-input :model-value="text(raw, 'major')" @update:model-value="(v: string) => patch(raw, { major: v })" />
                      </el-form-item>
                    </div>
                    <div class="row">
                      <el-form-item label="开始">
                        <el-input :model-value="text(raw, 'startDate')" @update:model-value="(v: string) => patch(raw, { startDate: v })" />
                      </el-form-item>
                      <el-form-item label="结束">
                        <el-input :model-value="text(raw, 'endDate')" @update:model-value="(v: string) => patch(raw, { endDate: v })" />
                      </el-form-item>
                    </div>
                  </template>

                  <template v-else-if="section!.type === 'skills'">
                    <el-form-item label="名称">
                      <el-input :model-value="text(raw, 'name')" @update:model-value="(v: string) => patch(raw, { name: v })" />
                    </el-form-item>
                    <el-form-item label="熟练度">
                      <el-slider
                        :model-value="Number(field(raw, 'level') || 3)"
                        :min="1"
                        :max="5"
                        :step="1"
                        show-stops
                        @update:model-value="(v: number | number[]) => patch(raw, { level: Array.isArray(v) ? v[0] : v })"
                      />
                    </el-form-item>
                  </template>

                  <template v-else-if="section!.type === 'projects'">
                    <el-form-item label="名称">
                      <el-input :model-value="text(raw, 'name')" @update:model-value="(v: string) => patch(raw, { name: v })" />
                    </el-form-item>
                    <el-form-item label="链接">
                      <el-input :model-value="text(raw, 'url')" @update:model-value="(v: string) => patch(raw, { url: v })" />
                    </el-form-item>
                    <el-form-item label="描述">
                      <el-input :model-value="text(raw, 'description')" type="textarea" :rows="3" @update:model-value="(v: string) => patch(raw, { description: v })" />
                    </el-form-item>
                  </template>

                  <template v-else-if="section!.type === 'languages'">
                    <div class="row">
                      <el-form-item label="语言">
                        <el-input :model-value="text(raw, 'name')" @update:model-value="(v: string) => patch(raw, { name: v })" />
                      </el-form-item>
                      <el-form-item label="水平">
                        <el-input :model-value="text(raw, 'level')" @update:model-value="(v: string) => patch(raw, { level: v })" />
                      </el-form-item>
                    </div>
                  </template>

                  <template v-else>
                    <el-form-item label="标题">
                      <el-input
                        :model-value="text(raw, 'title') || text(raw, 'name')"
                        @update:model-value="(v: string) => patch(raw, section!.type === 'certificates' ? { name: v } : { title: v })"
                      />
                    </el-form-item>
                    <el-form-item label="描述">
                      <el-input
                        :model-value="text(raw, 'description')"
                        type="textarea"
                        :rows="2"
                        @update:model-value="(v: string) => patch(raw, { description: v })"
                      />
                    </el-form-item>
                  </template>
                </el-form>
              </div>
            </el-collapse-transition>
          </div>
        </template>
      </draggable>
    </template>
  </div>
</template>

<style scoped lang="scss">
.section-editor {
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;

    /* 模块名输入框吃掉剩余宽度，按钮固定在右侧 */
    :deep(.el-input) {
      flex: 1;
      min-width: 0;
    }
  }
}

.list-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  margin-bottom: 8px;

  .total {
    font-size: 12px;
    color: var(--cv-muted);
  }
}

.item-card {
  border: 1px solid var(--cv-border);
  border-radius: 8px;
  margin-bottom: 10px;
  background: #f8fafc;
  overflow: hidden;

  &.folded {
    background: #fff;
  }
}

.item-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 6px 9px 8px;
  font-size: 13px;
  cursor: pointer;
  user-select: none;

  &:hover {
    background: #f1f5f9;
  }

  &:focus-visible {
    outline: 2px solid var(--cv-primary);
    outline-offset: -2px;
  }

  .item-drag {
    flex: none;
    color: var(--cv-muted);
    cursor: grab;
    opacity: 0.5;
    transition: opacity 150ms ease;

    &:active {
      cursor: grabbing;
    }
  }

  &:hover .item-drag {
    opacity: 1;
  }

  .caret {
    flex: none;
    color: var(--cv-muted);
    transition: transform 200ms ease;

    &.open {
      transform: rotate(90deg);
    }
  }

  .item-label {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .item-title {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-meta {
    font-size: 12px;
    color: var(--cv-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-del {
    flex: none;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  &:hover .item-del,
  &:focus-visible .item-del {
    opacity: 1;
  }

  @media (hover: none) {
    .item-drag,
    .item-del {
      opacity: 1;
    }
  }
}

.item-body {
  padding: 2px 12px 4px;
}

/* 拖动时留在原位的占位卡片 */
.item-ghost {
  border-color: #93c5fd;
  background: #eff6ff;
  opacity: 0.5;
}

/* fallback 模式下跟随鼠标的克隆，由 sortablejs 挂到 body 上 */
.item-fallback {
  border-radius: 8px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
</style>
