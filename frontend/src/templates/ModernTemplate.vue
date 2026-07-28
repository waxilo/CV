<script setup lang="ts">
/**
 * 模板扩展方式：
 * 1. 在 templates/ 下新建 Vue 组件
 * 2. 在 ResumePreview.vue 的 componentMap 注册
 * 3. 后端 template 表写入配置（或通过「扩展模板」API）
 */
import { computed } from 'vue';
import type { IResumeData, IResumeSection, TSectionItem } from '/@/types/resume';

const props = defineProps<{ data: IResumeData }>();

const theme = computed(() => props.data.metadata.theme);
const sections = computed(() =>
  [...props.data.sections].filter((s) => s.visible).sort((a, b) => a.order - b.order)
);

const styleVars = computed(() => ({
  '--primary': theme.value.primaryColor,
  '--text': theme.value.textColor,
  '--bg': theme.value.backgroundColor,
  '--font': theme.value.fontFamily,
  '--size': `${theme.value.fontSize}px`,
  '--lh': String(theme.value.spacing),
  '--margin': `${props.data.metadata.page.margin}px`,
}));

function visibleItems(section: IResumeSection): TSectionItem[] {
  return section.items.filter((i) => (i as { visible?: boolean }).visible !== false);
}

function f(item: TSectionItem, key: string): string {
  const val = (item as Record<string, unknown>)[key];
  return val == null ? '' : String(val);
}

function n(item: TSectionItem, key: string): number {
  return Number((item as Record<string, unknown>)[key] || 0);
}

function idOf(item: TSectionItem): string {
  return f(item, 'id');
}
</script>

<template>
  <article class="modern" :style="styleVars">
    <aside class="sidebar">
      <h1>{{ data.basics.name || '你的姓名' }}</h1>
      <p class="headline">{{ data.basics.headline || '求职方向' }}</p>
      <ul class="contacts">
        <li v-if="data.basics.email">{{ data.basics.email }}</li>
        <li v-if="data.basics.phone">{{ data.basics.phone }}</li>
        <li v-if="data.basics.location">{{ data.basics.location }}</li>
        <li v-if="data.basics.url">{{ data.basics.url }}</li>
      </ul>
    </aside>

    <main class="main">
      <section v-for="section in sections" :key="section.id" class="block">
        <h2>{{ section.name }}</h2>

        <p v-if="section.type === 'summary'" class="summary">{{ section.content }}</p>

        <div v-else-if="section.type === 'experience'" class="entries">
          <div v-for="item in visibleItems(section)" :key="idOf(item)" class="entry">
            <div class="entry-head">
              <strong>{{ f(item, 'position') }} · {{ f(item, 'company') }}</strong>
              <span>{{ f(item, 'startDate') }} – {{ f(item, 'endDate') || '至今' }}</span>
            </div>
            <p class="desc">{{ f(item, 'description') }}</p>
          </div>
        </div>

        <div v-else-if="section.type === 'education'" class="entries">
          <div v-for="item in visibleItems(section)" :key="idOf(item)" class="entry">
            <div class="entry-head">
              <strong>{{ f(item, 'school') }} · {{ f(item, 'degree') }} {{ f(item, 'major') }}</strong>
              <span>{{ f(item, 'startDate') }} – {{ f(item, 'endDate') }}</span>
            </div>
            <p class="desc">{{ f(item, 'description') }}</p>
          </div>
        </div>

        <div v-else-if="section.type === 'skills'" class="skills">
          <div v-for="item in visibleItems(section)" :key="idOf(item)" class="skill">
            <span>{{ f(item, 'name') }}</span>
            <div class="bar"><i :style="{ width: `${(n(item, 'level') / 5) * 100}%` }" /></div>
          </div>
        </div>

        <div v-else-if="section.type === 'projects'" class="entries">
          <div v-for="item in visibleItems(section)" :key="idOf(item)" class="entry">
            <div class="entry-head">
              <strong>{{ f(item, 'name') }}</strong>
              <span>{{ f(item, 'startDate') }} – {{ f(item, 'endDate') }}</span>
            </div>
            <p class="desc">{{ f(item, 'description') }}</p>
          </div>
        </div>

        <div v-else-if="section.type === 'languages'" class="tags">
          <span v-for="item in visibleItems(section)" :key="idOf(item)">
            {{ f(item, 'name') }}（{{ f(item, 'level') }}）
          </span>
        </div>

        <div v-else class="entries">
          <div v-for="item in visibleItems(section)" :key="idOf(item)" class="entry">
            <strong>{{ f(item, 'title') || f(item, 'name') }}</strong>
            <p class="desc">{{ f(item, 'description') }}</p>
          </div>
        </div>
      </section>
    </main>
  </article>
</template>

<style scoped lang="scss">
.modern {
  display: grid;
  grid-template-columns: 72mm 1fr;
  min-height: 297mm;
  color: var(--text);
  font-family: var(--font), 'PingFang SC', sans-serif;
  font-size: var(--size);
  line-height: var(--lh);
  background: var(--bg);
}

.sidebar {
  background: var(--primary);
  color: #fff;
  padding: var(--margin);

  h1 {
    font-size: 1.7em;
    line-height: 1.2;
    margin-bottom: 8px;
  }

  .headline {
    opacity: 0.9;
    margin-bottom: 24px;
  }

  .contacts {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 0.9em;
    opacity: 0.92;
  }
}

.main {
  padding: var(--margin);
}

.block {
  margin-bottom: 18px;

  h2 {
    font-size: 1.05em;
    color: var(--primary);
    border-bottom: 2px solid var(--primary);
    padding-bottom: 4px;
    margin-bottom: 10px;
  }
}

.entry {
  margin-bottom: 12px;
}

.entry-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;

  span {
    color: #64748b;
    white-space: nowrap;
    font-size: 0.9em;
  }
}

.desc {
  white-space: pre-wrap;
  color: #334155;
}

.skills {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 10px;
  align-items: center;

  .bar {
    height: 6px;
    background: #e2e8f0;
    border-radius: 99px;
    overflow: hidden;

    i {
      display: block;
      height: 100%;
      background: var(--primary);
    }
  }
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  span {
    background: #f1f5f9;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.9em;
  }
}

.summary {
  white-space: pre-wrap;
}
</style>
