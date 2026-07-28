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
  '--margin': `${props.data.metadata.page.margin}px`,
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
</script>

<template>
  <article class="classic" :style="styleVars">
    <header>
      <h1>{{ data.basics.name || '你的姓名' }}</h1>
      <p class="headline">{{ data.basics.headline }}</p>
      <p class="contacts">
        <span v-if="data.basics.email">{{ data.basics.email }}</span>
        <span v-if="data.basics.phone">{{ data.basics.phone }}</span>
        <span v-if="data.basics.location">{{ data.basics.location }}</span>
        <span v-if="data.basics.url">{{ data.basics.url }}</span>
      </p>
    </header>

    <section v-for="section in sections" :key="section.id" class="block">
      <h2>{{ section.name }}</h2>

      <p v-if="section.type === 'summary'" class="desc">{{ section.content }}</p>

      <div v-else-if="section.type === 'experience'">
        <div v-for="item in visibleItems(section)" :key="idOf(item)" class="entry">
          <div class="row">
            <strong>{{ f(item, 'company') }} — {{ f(item, 'position') }}</strong>
            <em>{{ f(item, 'startDate') }} – {{ f(item, 'endDate') || '至今' }}</em>
          </div>
          <p class="desc">{{ f(item, 'description') }}</p>
        </div>
      </div>

      <div v-else-if="section.type === 'education'">
        <div v-for="item in visibleItems(section)" :key="idOf(item)" class="entry">
          <div class="row">
            <strong>{{ f(item, 'school') }} — {{ f(item, 'degree') }} {{ f(item, 'major') }}</strong>
            <em>{{ f(item, 'startDate') }} – {{ f(item, 'endDate') }}</em>
          </div>
        </div>
      </div>

      <div v-else-if="section.type === 'skills'" class="skill-line">
        <span v-for="item in visibleItems(section)" :key="idOf(item)">{{ f(item, 'name') }}</span>
      </div>

      <div v-else-if="section.type === 'projects'">
        <div v-for="item in visibleItems(section)" :key="idOf(item)" class="entry">
          <strong>{{ f(item, 'name') }}</strong>
          <p class="desc">{{ f(item, 'description') }}</p>
        </div>
      </div>

      <div v-else>
        <div v-for="item in section.items" :key="idOf(item)" class="entry">
          <p class="desc">{{ f(item, 'description') || f(item, 'name') || f(item, 'title') }}</p>
        </div>
      </div>
    </section>
  </article>
</template>

<style scoped lang="scss">
.classic {
  padding: var(--margin);
  color: var(--text);
  font-family: var(--font), Georgia, serif;
  font-size: var(--size);
  line-height: var(--lh);
  min-height: 297mm;
}

header {
  text-align: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--primary);

  h1 {
    font-size: 2em;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
  }

  .headline {
    color: #475569;
    margin-bottom: 8px;
  }

  .contacts {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 0.9em;
    color: #64748b;
  }
}

.block {
  margin-bottom: 16px;

  h2 {
    font-size: 1.05em;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 4px;
    margin-bottom: 10px;
    color: var(--primary);
  }
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;

  em {
    font-style: normal;
    color: #64748b;
    white-space: nowrap;
  }
}

.entry {
  margin-bottom: 10px;
}

.desc {
  white-space: pre-wrap;
  margin-top: 4px;
}

.skill-line {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  span {
    border: 1px solid #cbd5e1;
    padding: 2px 8px;
    border-radius: 2px;
  }
}
</style>
