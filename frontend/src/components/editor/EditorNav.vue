<script setup lang="ts">
import { computed } from 'vue';
import draggable from 'vuedraggable';
import { useResumeStore } from '/@/stores/resume';
import type { IResumeSection, TSectionType } from '/@/types/resume';

defineProps<{
  /** 当前选中的面板 key：basics / template / theme / `section:<id>` */
  activeKey: string;
}>();

const emit = defineEmits<{
  select: [key: string];
}>();

const resumeStore = useResumeStore();

const sections = computed({
  get: () => resumeStore.sortedSections,
  set: (value: IResumeSection[]) => resumeStore.reorderSections(value),
});

const addableTypes: { type: TSectionType; label: string }[] = [
  { type: 'experience', label: '工作经历' },
  { type: 'education', label: '教育经历' },
  { type: 'skills', label: '专业技能' },
  { type: 'projects', label: '项目经历' },
  { type: 'languages', label: '语言能力' },
  { type: 'certificates', label: '证书资质' },
  { type: 'summary', label: '个人简介' },
  { type: 'custom', label: '自定义模块' },
];

function handleAdd(type: TSectionType) {
  const id = resumeStore.addSection(type);
  if (id) emit('select', `section:${id}`);
}
</script>

<template>
  <nav class="editor-nav">
    <div class="group">
      <div class="group-title"><span>简历</span></div>
      <button
        type="button"
        class="nav-item"
        :class="{ active: activeKey === 'basics' }"
        @click="emit('select', 'basics')"
      >
        <el-icon class="lead"><User /></el-icon>
        <span class="name">基本信息</span>
      </button>
    </div>

    <div class="group">
      <div class="group-title">
        <span>模块</span>
        <el-dropdown trigger="click" @command="handleAdd">
          <el-button text size="small" class="add-btn">
            <el-icon><Plus /></el-icon>
            添加
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="item in addableTypes" :key="item.type" :command="item.type">
                {{ item.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <!-- 同 SectionEditor：WebView2 没有原生 DnD，必须走 sortablejs 的 fallback 模式 -->
      <draggable
        v-model="sections"
        item-key="id"
        handle=".drag-handle"
        ghost-class="ghost"
        fallback-class="nav-fallback"
        :force-fallback="true"
        :fallback-on-body="true"
        :animation="200"
        class="list"
      >
        <template #item="{ element }">
          <div
            class="nav-item"
            :class="{
              active: activeKey === `section:${element.id}`,
              invisible: !element.visible,
            }"
            @click="emit('select', `section:${element.id}`)"
          >
            <el-icon class="lead drag-handle" title="拖拽排序"><Rank /></el-icon>
            <span class="name">{{ element.name }}</span>
            <span class="ops" @click.stop>
              <el-button
                text
                size="small"
                :title="element.visible ? '在简历中隐藏' : '在简历中显示'"
                @click="resumeStore.toggleSectionVisible(element.id)"
              >
                <el-icon>
                  <View v-if="element.visible" />
                  <Hide v-else />
                </el-icon>
              </el-button>
            </span>
          </div>
        </template>
      </draggable>

      <p v-if="!sections.length" class="empty">还没有模块，点「添加」新建一个</p>
    </div>

    <div class="group">
      <div class="group-title"><span>外观</span></div>
      <button
        type="button"
        class="nav-item"
        :class="{ active: activeKey === 'template' }"
        @click="emit('select', 'template')"
      >
        <el-icon class="lead"><Files /></el-icon>
        <span class="name">模板</span>
      </button>
      <button
        type="button"
        class="nav-item"
        :class="{ active: activeKey === 'theme' }"
        @click="emit('select', 'theme')"
      >
        <el-icon class="lead"><Brush /></el-icon>
        <span class="name">主题</span>
      </button>
    </div>
  </nav>
</template>

<style scoped lang="scss">
.editor-nav {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 18px;
  padding: 16px 12px 20px;
  overflow: auto;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
  margin-bottom: 2px;
  font-size: 12px;
  color: var(--cv-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.add-btn {
  height: 24px;
  padding: 0 6px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* button 与 div 两种标签共用同一套视觉 */
.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 8px 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--cv-text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  user-select: none;
  transition:
    background 150ms ease,
    border-color 150ms ease;

  &:hover {
    background: #f1f5f9;
  }

  &.active {
    border-color: #93c5fd;
    background: #eff6ff;
    font-weight: 600;
  }

  /* 模块被设为不在简历中展示 */
  &.invisible {
    opacity: 0.55;
  }

  .lead {
    flex: none;
    color: var(--cv-muted);
  }

  .drag-handle {
    cursor: grab;
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* 只保留显隐切换，常驻占位，避免 hover 时名称宽度跳动 */
  .ops {
    flex: none;
    display: flex;
    opacity: 0.45;
    transition: opacity 150ms ease;

    /* 收窄 el-button 默认内边距，把宽度让给模块名 */
    :deep(.el-button) {
      height: 22px;
      padding: 0 3px;
      margin: 0;
    }
  }

  &:hover .ops,
  &.active .ops {
    opacity: 1;
  }

  /* 已隐藏的模块要一眼看出来，图标保持高亮 */
  &.invisible .ops {
    opacity: 1;
  }
}

.empty {
  padding: 8px 10px;
  color: var(--cv-muted);
  font-size: 12px;
  line-height: 1.6;
}

.ghost {
  opacity: 0.4;
  background: #dbeafe !important;
}

/* fallback 模式下跟随鼠标的克隆，由 sortablejs 挂到 body 上 */
.nav-fallback {
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
}
</style>
