<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import draggable from 'vuedraggable';
import { ElMessageBox } from 'element-plus';
import { useResumeStore } from '/@/stores/resume';
import type { TSectionItem } from '/@/types/resume';
import RichTextArea from './RichTextArea.vue';

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

/** 正在编辑的条目：有值时底部升起覆盖左两栏的表单页 */
const editingItemId = ref<string | null>(null);
const sheetBodyRef = ref<HTMLElement | null>(null);

const editingItem = computed(() => {
  if (!editingItemId.value) return null;
  return items.value.find((item) => itemId(item) === editingItemId.value) ?? null;
});

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

/** 拖完松手时会触发 pointerup/click，用短抑制窗口区分「拖排序」和「点开编辑」 */
const suppressOpen = ref(false);
/** 按下时的坐标，用于判断是单击还是拖动意图 */
const pressPoint = ref<{ id: string; x: number; y: number } | null>(null);

/** 超过该像素位移才视为拖拽；单击时的手抖不会开拖、也不会被吞掉 */
const DRAG_DISTANCE_PX = 10;

function openItem(item: TSectionItem) {
  if (suppressOpen.value) return;
  editingItemId.value = itemId(item);
  nextTick(() => {
    sheetBodyRef.value?.scrollTo({ top: 0 });
  });
}

function onDragStart() {
  suppressOpen.value = true;
  pressPoint.value = null;
}

function onDragEnd() {
  window.setTimeout(() => {
    suppressOpen.value = false;
  }, 120);
}

function onCardPointerDown(event: PointerEvent, item: TSectionItem) {
  if (event.button !== 0) return;
  pressPoint.value = { id: itemId(item), x: event.clientX, y: event.clientY };
}

function onCardPointerUp(event: PointerEvent, item: TSectionItem) {
  const start = pressPoint.value;
  pressPoint.value = null;
  if (!start || start.id !== itemId(item)) return;
  if (suppressOpen.value) return;
  const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
  if (moved > DRAG_DISTANCE_PX) return;
  openItem(item);
}

function onCardPointerCancel() {
  pressPoint.value = null;
}

function closeSheet() {
  editingItemId.value = null;
}

function addItem() {
  if (!section.value) return;
  const before = new Set(items.value.map((item) => itemId(item)));
  resumeStore.addItem(section.value.id);
  const created = items.value.find((item) => !before.has(itemId(item)));
  if (created) openItem(created);
}

/** 列表行标题：用条目自己的内容，不能是「项目」这种类型名 */
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

/** 列表副标题，补充标题看不出来的信息 */
function itemMeta(item: TSectionItem): string {
  switch (section.value?.type) {
    case 'experience':
      return [text(item, 'position'), dateRange(item)].filter(Boolean).join(' · ');
    case 'education':
      return [text(item, 'degree'), text(item, 'major'), dateRange(item)].filter(Boolean).join(' · ');
    case 'skills':
      return text(item, 'description') || `熟练度 ${Number(field(item, 'level') || 3)}/5`;
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

async function remove(item: TSectionItem) {
  if (!section.value) return;
  try {
    await ElMessageBox.confirm(`删除条目「${itemTitle(item)}」？删除后不可恢复。`, '确认删除', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  const id = itemId(item);
  if (editingItemId.value === id) closeSheet();
  resumeStore.removeItem(section.value.id, id);
}

async function removeEditingItem() {
  if (!editingItem.value) return;
  await remove(editingItem.value);
}

/** 删除整个模块。左侧导航只负责选中与排序，破坏性操作收在这里 */
async function removeSection() {
  if (!section.value) return;
  try {
    await ElMessageBox.confirm(`删除模块「${section.value.name}」？`, '确认', { type: 'warning' });
  } catch {
    return;
  }
  closeSheet();
  resumeStore.removeSection(section.value.id);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !editingItemId.value) return;
  // 确认框打开时留给 Element Plus 处理
  if (document.querySelector('.el-overlay.is-message-box')) return;
  event.preventDefault();
  closeSheet();
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});

/** 条目被外部删掉时关掉编辑页，避免空白表单 */
watch(
  () => items.value.map((item) => itemId(item)).join(','),
  () => {
    if (editingItemId.value && !items.value.some((item) => itemId(item) === editingItemId.value)) {
      closeSheet();
    }
  }
);
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
        @click="addItem"
      >
        添加条目
      </el-button>
      <el-button size="small" text type="danger" title="删除整个模块" @click="removeSection">
        <el-icon><Delete /></el-icon>
      </el-button>
    </div>

    <!-- 个人简介只有一段正文，没有条目列表 -->
    <RichTextArea
      v-if="section.type === 'summary'"
      :model-value="section.content || ''"
      :rows="5"
      placeholder="简要介绍你的背景与优势"
      @update:model-value="(v: string) => resumeStore.updateSectionContent(section!.id, v)"
    />

    <template v-else>
      <div class="list-bar">
        <span class="total">共 {{ items.length }} 条</span>
      </div>

      <!--
        force-fallback：不用 HTML5 原生拖放。Windows 的 WebView2 没实现原生 DnD，
        Tauri 窗口里 dragstart 根本不触发，只有 sortablejs 的鼠标事件模拟能用。
        fallback-on-body：跟随鼠标的克隆挂到 body，否则会被中间栏的 overflow 裁掉。
        distance：移动超过阈值才开拖，避免单击被当成拖拽、点不开条目。
        filter：排除删除按钮，避免按删除时误触发拖拽。
      -->
      <draggable
        v-model="items"
        item-key="id"
        ghost-class="item-ghost"
        fallback-class="item-fallback"
        filter=".item-del"
        :prevent-on-filter="true"
        :force-fallback="true"
        :fallback-on-body="true"
        :distance="DRAG_DISTANCE_PX"
        :fallback-tolerance="DRAG_DISTANCE_PX"
        :animation="200"
        @start="onDragStart"
        @end="onDragEnd"
      >
        <template #item="{ element: raw }">
          <div
            class="item-card"
            :class="{ active: editingItemId === itemId(raw) }"
            role="button"
            tabindex="0"
            title="单击编辑，按住拖动可排序"
            @pointerdown="onCardPointerDown($event, raw)"
            @pointerup="onCardPointerUp($event, raw)"
            @pointercancel="onCardPointerCancel"
            @keydown.enter.prevent="openItem(raw)"
            @keydown.space.prevent="openItem(raw)"
          >
            <span class="item-label">
              <span class="item-title">{{ itemTitle(raw) }}</span>
              <span v-if="itemMeta(raw)" class="item-meta">{{ itemMeta(raw) }}</span>
            </span>
            <el-button
              class="item-del"
              text
              type="danger"
              size="small"
              title="删除条目"
              @pointerdown.stop
              @click.stop="remove(raw)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </template>
      </draggable>
    </template>

    <!-- 挂到 Editor 的 composer：盖住导航 + 表单两栏，预览不受影响 -->
    <Teleport defer to="[data-item-sheet-host]">
      <Transition name="sheet-up">
        <div
          v-if="editingItem"
          class="item-sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="itemTitle(editingItem)"
        >
          <header class="sheet-head">
            <el-button text class="sheet-back" title="关闭（Esc）" @click="closeSheet">
              <el-icon><ArrowDown /></el-icon>
            </el-button>
            <div class="sheet-title-wrap">
              <h3 class="sheet-title">{{ itemTitle(editingItem) }}</h3>
              <span class="sheet-hint">Esc 关闭</span>
            </div>
            <el-button text type="danger" title="删除条目" @click="removeEditingItem">
              <el-icon><Delete /></el-icon>
            </el-button>
          </header>

          <div ref="sheetBodyRef" class="sheet-body">
            <el-form label-position="top" size="small">
              <template v-if="section!.type === 'experience'">
                <div class="row">
                  <el-form-item label="公司">
                    <el-input
                      :model-value="text(editingItem, 'company')"
                      @update:model-value="(v: string) => patch(editingItem!, { company: v })"
                    />
                  </el-form-item>
                  <el-form-item label="职位">
                    <el-input
                      :model-value="text(editingItem, 'position')"
                      @update:model-value="(v: string) => patch(editingItem!, { position: v })"
                    />
                  </el-form-item>
                </div>
                <div class="row">
                  <el-form-item label="开始">
                    <el-input
                      :model-value="text(editingItem, 'startDate')"
                      placeholder="2022-01"
                      @update:model-value="(v: string) => patch(editingItem!, { startDate: v })"
                    />
                  </el-form-item>
                  <el-form-item label="结束">
                    <el-input
                      :model-value="text(editingItem, 'endDate')"
                      placeholder="至今"
                      @update:model-value="(v: string) => patch(editingItem!, { endDate: v })"
                    />
                  </el-form-item>
                </div>
                <el-form-item label="描述">
                  <RichTextArea
                    :model-value="text(editingItem, 'description')"
                    :rows="8"
                    @update:model-value="(v: string) => patch(editingItem!, { description: v })"
                  />
                </el-form-item>
              </template>

              <template v-else-if="section!.type === 'education'">
                <el-form-item label="学校">
                  <el-input
                    :model-value="text(editingItem, 'school')"
                    @update:model-value="(v: string) => patch(editingItem!, { school: v })"
                  />
                </el-form-item>
                <div class="row">
                  <el-form-item label="学历">
                    <el-input
                      :model-value="text(editingItem, 'degree')"
                      @update:model-value="(v: string) => patch(editingItem!, { degree: v })"
                    />
                  </el-form-item>
                  <el-form-item label="专业">
                    <el-input
                      :model-value="text(editingItem, 'major')"
                      @update:model-value="(v: string) => patch(editingItem!, { major: v })"
                    />
                  </el-form-item>
                </div>
                <div class="row">
                  <el-form-item label="开始">
                    <el-input
                      :model-value="text(editingItem, 'startDate')"
                      @update:model-value="(v: string) => patch(editingItem!, { startDate: v })"
                    />
                  </el-form-item>
                  <el-form-item label="结束">
                    <el-input
                      :model-value="text(editingItem, 'endDate')"
                      @update:model-value="(v: string) => patch(editingItem!, { endDate: v })"
                    />
                  </el-form-item>
                </div>
                <el-form-item label="描述">
                  <RichTextArea
                    :model-value="text(editingItem, 'description')"
                    :rows="6"
                    placeholder="主修课程、获奖、论文或其他补充说明"
                    @update:model-value="(v: string) => patch(editingItem!, { description: v })"
                  />
                </el-form-item>
              </template>

              <template v-else-if="section!.type === 'skills'">
                <el-form-item label="名称">
                  <el-input
                    :model-value="text(editingItem, 'name')"
                    @update:model-value="(v: string) => patch(editingItem!, { name: v })"
                  />
                </el-form-item>
                <el-form-item label="熟练度">
                  <el-slider
                    :model-value="Number(field(editingItem, 'level') || 3)"
                    :min="1"
                    :max="5"
                    :step="1"
                    show-stops
                    @update:model-value="(v: number | number[]) => patch(editingItem!, { level: Array.isArray(v) ? v[0] : v })"
                  />
                </el-form-item>
                <el-form-item label="描述">
                  <RichTextArea
                    :model-value="text(editingItem, 'description')"
                    :rows="6"
                    placeholder="说明掌握范围、技术细节或实践经验"
                    @update:model-value="(v: string) => patch(editingItem!, { description: v })"
                  />
                </el-form-item>
              </template>

              <template v-else-if="section!.type === 'projects'">
                <el-form-item label="名称">
                  <el-input
                    :model-value="text(editingItem, 'name')"
                    @update:model-value="(v: string) => patch(editingItem!, { name: v })"
                  />
                </el-form-item>
                <el-form-item label="链接">
                  <el-input
                    :model-value="text(editingItem, 'url')"
                    @update:model-value="(v: string) => patch(editingItem!, { url: v })"
                  />
                </el-form-item>
                <el-form-item label="描述">
                  <RichTextArea
                    :model-value="text(editingItem, 'description')"
                    :rows="8"
                    @update:model-value="(v: string) => patch(editingItem!, { description: v })"
                  />
                </el-form-item>
              </template>

              <template v-else-if="section!.type === 'languages'">
                <div class="row">
                  <el-form-item label="语言">
                    <el-input
                      :model-value="text(editingItem, 'name')"
                      @update:model-value="(v: string) => patch(editingItem!, { name: v })"
                    />
                  </el-form-item>
                  <el-form-item label="水平">
                    <el-input
                      :model-value="text(editingItem, 'level')"
                      @update:model-value="(v: string) => patch(editingItem!, { level: v })"
                    />
                  </el-form-item>
                </div>
              </template>

              <template v-else>
                <el-form-item label="标题">
                  <el-input
                    :model-value="text(editingItem, 'title') || text(editingItem, 'name')"
                    @update:model-value="(v: string) => patch(editingItem!, section!.type === 'certificates' ? { name: v } : { title: v })"
                  />
                </el-form-item>
                <el-form-item label="描述">
                  <RichTextArea
                    :model-value="text(editingItem, 'description')"
                    :rows="6"
                    @update:model-value="(v: string) => patch(editingItem!, { description: v })"
                  />
                </el-form-item>
              </template>
            </el-form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 预览在 iframe 内，父页面收不到点击；开编辑页时盖一层透明热区用来收起 -->
    <Teleport defer to="[data-preview-col]">
      <div
        v-if="editingItem"
        class="preview-close-catcher"
        title="点击关闭条目编辑"
        @pointerdown="closeSheet"
      />
    </Teleport>
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
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 8px 10px 12px;
  margin-bottom: 8px;
  border: 1px solid var(--cv-border);
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  cursor: grab;
  user-select: none;
  transition: border-color 150ms ease, background 150ms ease;

  &:active {
    cursor: grabbing;
  }

  &:hover {
    background: #f8fafc;
  }

  &.active {
    border-color: #93c5fd;
    background: #eff6ff;
  }

  &:focus-visible {
    outline: 2px solid var(--cv-primary);
    outline-offset: -2px;
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
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  &:hover .item-del,
  &:focus-visible .item-del {
    opacity: 1;
  }

  @media (hover: none) {
    .item-del {
      opacity: 1;
    }
  }
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

/*
 * Teleport 到 .composer 后仍带 scoped data 属性，样式能命中。
 * 绝对铺满左两栏；进出场用 translateY，关闭时从上往下收走。
 */
.item-sheet {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background: var(--cv-surface, #fff);
  box-shadow: 0 -8px 32px rgba(15, 23, 42, 0.12);
}

.sheet-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 52px;
  padding: 0 10px 0 6px;
  border-bottom: 1px solid var(--cv-border);
  background: rgba(248, 250, 252, 0.92);
  backdrop-filter: blur(8px);
}

.sheet-back {
  flex: none;
}

.sheet-title-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.sheet-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-hint {
  flex: none;
  font-size: 12px;
  color: var(--cv-muted);
}

.sheet-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px 18px 28px;
}

.sheet-up-enter-active,
.sheet-up-leave-active {
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.sheet-up-enter-from,
.sheet-up-leave-to {
  transform: translateY(100%);
}

.preview-close-catcher {
  position: absolute;
  inset: 0;
  z-index: 5;
  cursor: pointer;
}
</style>
