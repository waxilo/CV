<script setup lang="ts">
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
  '--font': theme.value.fontFamily,
  '--size': `${theme.value.fontSize}px`,
  '--lh': String(theme.value.spacing),
  '--margin': `${props.data.metadata.page.margin + 8}px`,
}));

function visibleItems(section: IResumeSection): TSectionItem[] {
  return section.items.filter((i) => (i as { visible?: boolean }).visible !== false);
}

function f(item: TSectionItem, key: string): string {
  const val = (item as Record<string, unknown>)[key];
  return val == null ? '' : String(val);
}

function idOf(item: TSectionItem): string {
  return f(item, 'id');
}

function skillNames(section: IResumeSection): string {
  return visibleItems(section)
    .map((i) => f(i, 'name'))
    .filter(Boolean)
    .join(' / ');
}

const contactLine = computed(() =>
  [props.data.basics.email, props.data.basics.phone, props.data.basics.location, props.data.basics.url]
    .filter(Boolean)
    .join('  ·  ')
);
</script>

<template>
  <article class="minimal" :style="styleVars">
    <header>
      <h1>{{ data.basics.name || '你的姓名' }}</h1>
      <p>{{ data.basics.headline }}</p>
      <p class="meta">{{ contactLine }}</p>
    </header>

    <section v-for="section in sections" :key="section.id" class="block">
      <h2>{{ section.name }}</h2>

      <p v-if="section.type === 'summary'">{{ section.content }}</p>

      <template v-else-if="section.type === 'experience'">
        <div v-for="item in visibleItems(section)" :key="idOf(item)" class="entry">
          <div class="title">
            <span>{{ f(item, 'position') }} @ {{ f(item, 'company') }}</span>
            <span class="date">{{ f(item, 'startDate') }} – {{ f(item, 'endDate') || '至今' }}</span>
          </div>
          <p>{{ f(item, 'description') }}</p>
        </div>
      </template>

      <template v-else-if="section.type === 'education'">
        <div v-for="item in visibleItems(section)" :key="idOf(item)" class="entry">
          <div class="title">
            <span>{{ f(item, 'school') }} / {{ f(item, 'degree') }} {{ f(item, 'major') }}</span>
            <span class="date">{{ f(item, 'startDate') }} – {{ f(item, 'endDate') }}</span>
          </div>
        </div>
      </template>

      <template v-else-if="section.type === 'skills'">
        <p>{{ skillNames(section) }}</p>
      </template>

      <template v-else-if="section.type === 'projects'">
        <div v-for="item in visibleItems(section)" :key="idOf(item)" class="entry">
          <div class="title"><span>{{ f(item, 'name') }}</span></div>
          <p>{{ f(item, 'description') }}</p>
        </div>
      </template>
    </section>
  </article>
</template>

<style scoped lang="scss">
.minimal {
  padding: var(--margin);
  color: var(--text);
  font-family: var(--font), Helvetica, sans-serif;
  font-size: var(--size);
  line-height: var(--lh);
  min-height: 297mm;
}

header {
  margin-bottom: 36px;

  h1 {
    font-size: 2.2em;
    font-weight: 500;
    letter-spacing: -0.03em;
    margin-bottom: 6px;
  }

  .meta {
    margin-top: 10px;
    color: #64748b;
    font-size: 0.92em;
  }
}

.block {
  margin-bottom: 28px;

  h2 {
    font-size: 0.78em;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #94a3b8;
    margin-bottom: 12px;
  }
}

.entry {
  margin-bottom: 14px;

  p {
    white-space: pre-wrap;
    margin-top: 4px;
    color: #334155;
  }
}

.title {
  display: flex;
  justify-content: space-between;
  gap: 16px;

  .date {
    color: #94a3b8;
    white-space: nowrap;
  }
}
</style>
