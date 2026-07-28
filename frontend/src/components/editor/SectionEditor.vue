<script setup lang="ts">
import { computed } from 'vue';
import { useResumeStore } from '/@/stores/resume';
import type { TSectionItem } from '/@/types/resume';

const props = defineProps<{
  sectionId: string;
}>();

const resumeStore = useResumeStore();

const section = computed(() =>
  resumeStore.data?.sections.find((s) => s.id === props.sectionId)
);

function field(item: TSectionItem, key: string): string | number | boolean | string[] | undefined {
  return (item as Record<string, unknown>)[key] as string | number | boolean | string[] | undefined;
}

function itemId(item: TSectionItem): string {
  return String((item as Record<string, unknown>).id || '');
}

function patch(item: TSectionItem, data: Record<string, unknown>) {
  if (!section.value) return;
  resumeStore.updateItem(section.value.id, itemId(item), data);
}

function remove(item: TSectionItem) {
  if (!section.value) return;
  resumeStore.removeItem(section.value.id, itemId(item));
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
    </div>

    <template v-if="section.type === 'summary'">
      <el-input
        :model-value="section.content || ''"
        type="textarea"
        :rows="5"
        placeholder="简要介绍你的背景与优势"
        @update:model-value="(v: string) => resumeStore.updateSectionContent(section!.id, v)"
      />
    </template>

    <template v-else-if="section.type === 'experience'">
      <div v-for="raw in section.items" :key="itemId(raw)" class="item-card">
        <div class="item-head">
          <strong>经历</strong>
          <el-button text type="danger" size="small" @click="remove(raw)">删除</el-button>
        </div>
        <el-form label-position="top" size="small">
          <div class="row">
            <el-form-item label="公司">
              <el-input :model-value="String(field(raw, 'company') || '')" @update:model-value="(v: string) => patch(raw, { company: v })" />
            </el-form-item>
            <el-form-item label="职位">
              <el-input :model-value="String(field(raw, 'position') || '')" @update:model-value="(v: string) => patch(raw, { position: v })" />
            </el-form-item>
          </div>
          <div class="row">
            <el-form-item label="开始">
              <el-input :model-value="String(field(raw, 'startDate') || '')" placeholder="2022-01" @update:model-value="(v: string) => patch(raw, { startDate: v })" />
            </el-form-item>
            <el-form-item label="结束">
              <el-input :model-value="String(field(raw, 'endDate') || '')" placeholder="至今" @update:model-value="(v: string) => patch(raw, { endDate: v })" />
            </el-form-item>
          </div>
          <el-form-item label="描述">
            <el-input :model-value="String(field(raw, 'description') || '')" type="textarea" :rows="3" @update:model-value="(v: string) => patch(raw, { description: v })" />
          </el-form-item>
        </el-form>
      </div>
    </template>

    <template v-else-if="section.type === 'education'">
      <div v-for="raw in section.items" :key="itemId(raw)" class="item-card">
        <div class="item-head">
          <strong>教育</strong>
          <el-button text type="danger" size="small" @click="remove(raw)">删除</el-button>
        </div>
        <el-form label-position="top" size="small">
          <el-form-item label="学校">
            <el-input :model-value="String(field(raw, 'school') || '')" @update:model-value="(v: string) => patch(raw, { school: v })" />
          </el-form-item>
          <div class="row">
            <el-form-item label="学历">
              <el-input :model-value="String(field(raw, 'degree') || '')" @update:model-value="(v: string) => patch(raw, { degree: v })" />
            </el-form-item>
            <el-form-item label="专业">
              <el-input :model-value="String(field(raw, 'major') || '')" @update:model-value="(v: string) => patch(raw, { major: v })" />
            </el-form-item>
          </div>
          <div class="row">
            <el-form-item label="开始">
              <el-input :model-value="String(field(raw, 'startDate') || '')" @update:model-value="(v: string) => patch(raw, { startDate: v })" />
            </el-form-item>
            <el-form-item label="结束">
              <el-input :model-value="String(field(raw, 'endDate') || '')" @update:model-value="(v: string) => patch(raw, { endDate: v })" />
            </el-form-item>
          </div>
        </el-form>
      </div>
    </template>

    <template v-else-if="section.type === 'skills'">
      <div v-for="raw in section.items" :key="itemId(raw)" class="item-card">
        <div class="item-head">
          <strong>技能</strong>
          <el-button text type="danger" size="small" @click="remove(raw)">删除</el-button>
        </div>
        <el-form label-position="top" size="small">
          <el-form-item label="名称">
            <el-input :model-value="String(field(raw, 'name') || '')" @update:model-value="(v: string) => patch(raw, { name: v })" />
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
        </el-form>
      </div>
    </template>

    <template v-else-if="section.type === 'projects'">
      <div v-for="raw in section.items" :key="itemId(raw)" class="item-card">
        <div class="item-head">
          <strong>项目</strong>
          <el-button text type="danger" size="small" @click="remove(raw)">删除</el-button>
        </div>
        <el-form label-position="top" size="small">
          <el-form-item label="名称">
            <el-input :model-value="String(field(raw, 'name') || '')" @update:model-value="(v: string) => patch(raw, { name: v })" />
          </el-form-item>
          <el-form-item label="链接">
            <el-input :model-value="String(field(raw, 'url') || '')" @update:model-value="(v: string) => patch(raw, { url: v })" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input :model-value="String(field(raw, 'description') || '')" type="textarea" :rows="3" @update:model-value="(v: string) => patch(raw, { description: v })" />
          </el-form-item>
        </el-form>
      </div>
    </template>

    <template v-else-if="section.type === 'languages'">
      <div v-for="raw in section.items" :key="itemId(raw)" class="item-card">
        <div class="item-head">
          <strong>语言</strong>
          <el-button text type="danger" size="small" @click="remove(raw)">删除</el-button>
        </div>
        <el-form label-position="top" size="small">
          <div class="row">
            <el-form-item label="语言">
              <el-input :model-value="String(field(raw, 'name') || '')" @update:model-value="(v: string) => patch(raw, { name: v })" />
            </el-form-item>
            <el-form-item label="水平">
              <el-input :model-value="String(field(raw, 'level') || '')" @update:model-value="(v: string) => patch(raw, { level: v })" />
            </el-form-item>
          </div>
        </el-form>
      </div>
    </template>

    <template v-else>
      <div v-for="raw in section.items" :key="itemId(raw)" class="item-card">
        <div class="item-head">
          <strong>条目</strong>
          <el-button text type="danger" size="small" @click="remove(raw)">删除</el-button>
        </div>
        <el-form label-position="top" size="small">
          <el-form-item label="标题">
            <el-input
              :model-value="String(field(raw, 'title') || field(raw, 'name') || '')"
              @update:model-value="(v: string) => patch(raw, section!.type === 'certificates' ? { name: v } : { title: v })"
            />
          </el-form-item>
          <el-form-item label="描述">
            <el-input
              :model-value="String(field(raw, 'description') || '')"
              type="textarea"
              :rows="2"
              @update:model-value="(v: string) => patch(raw, { description: v })"
            />
          </el-form-item>
        </el-form>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.section-editor {
  .head {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
}

.item-card {
  border: 1px solid var(--cv-border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
  background: #f8fafc;
}

.item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
</style>
