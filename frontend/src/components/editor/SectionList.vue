<script setup lang="ts">
import { computed } from 'vue';
import draggable from 'vuedraggable';
import { ElMessageBox } from 'element-plus';
import { useResumeStore } from '/@/stores/resume';
import type { IResumeSection, TSectionType } from '/@/types/resume';

defineProps<{
  activeId: string;
}>();

const emit = defineEmits<{
  select: [id: string];
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
  if (id) emit('select', id);
}

async function handleRemove(section: IResumeSection) {
  await ElMessageBox.confirm(`删除模块「${section.name}」？`, '确认', { type: 'warning' });
  resumeStore.removeSection(section.id);
}
</script>

<template>
  <div class="section-list">
    <div class="head">
      <h3>模块（可拖拽排序）</h3>
      <el-dropdown trigger="click" @command="handleAdd">
        <el-button size="small" type="primary" plain>
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

    <draggable
      v-model="sections"
      item-key="id"
      handle=".drag-handle"
      ghost-class="ghost"
      animation="200"
      class="list"
    >
      <template #item="{ element }">
        <div
          class="item"
          :class="{ active: element.id === activeId, hidden: !element.visible }"
          @click="emit('select', element.id)"
        >
          <el-icon class="drag-handle"><Rank /></el-icon>
          <span class="name">{{ element.name }}</span>
          <div class="ops" @click.stop>
            <el-button
              text
              size="small"
              :title="element.visible ? '隐藏' : '显示'"
              @click="resumeStore.toggleSectionVisible(element.id)"
            >
              <el-icon>
                <View v-if="element.visible" />
                <Hide v-else />
              </el-icon>
            </el-button>
            <el-button text size="small" type="danger" @click="handleRemove(element)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </template>
    </draggable>
  </div>
</template>

<style scoped lang="scss">
.section-list {
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;

    h3 {
      font-size: 14px;
      color: var(--cv-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
  }
}

.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--cv-border);
  border-radius: 8px;
  background: #f8fafc;
  cursor: pointer;

  &.active {
    border-color: #93c5fd;
    background: #eff6ff;
  }

  &.hidden {
    opacity: 0.55;
  }

  .name {
    flex: 1;
    font-size: 13px;
  }

  .drag-handle {
    cursor: grab;
    color: var(--cv-muted);
  }

  .ops {
    display: flex;
  }
}

.ghost {
  opacity: 0.4;
  background: #dbeafe !important;
}
</style>
