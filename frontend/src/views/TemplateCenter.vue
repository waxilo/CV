<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useTemplateStore } from '/@/stores/template';
import { useResumeStore } from '/@/stores/resume';
import { createSampleResumeData } from '/@/features/template-renderer/sampleData';
import { migrateTemplateConfig } from '/@/features/template-renderer';
import AppTopbar from '/@/components/AppTopbar.vue';
import PaperThumb from '/@/components/preview/PaperThumb.vue';
import ResumeFullPreview from '/@/components/preview/ResumeFullPreview.vue';
import type { ITemplate, ITemplateConfig } from '/@/types/template';

interface ITemplateCategory {
  label: string;
  keywords: string[];
}

const router = useRouter();
const templateStore = useTemplateStore();
const resumeStore = useResumeStore();
const sampleData = createSampleResumeData();
const creating = ref(false);
const activeCategory = ref('全部');
const previewTemplate = ref<ITemplate | null>(null);
const previewConfig = ref<ITemplateConfig | null>(null);
const isPreviewVisible = ref(false);
const isLargePreviewVisible = ref(false);
const previewPageIndex = ref(0);
const previewPageCount = ref(1);
let previewWheelLockedUntil = 0;
const FAVORITE_STORAGE_KEY = 'cv_favorite_template_ids';
const favoriteTemplateIds = ref<Set<string>>(loadFavoriteTemplateIds());

const categories: ITemplateCategory[] = [
  { label: '全部', keywords: [] },
  { label: '我的模板', keywords: [] },
  { label: '推荐', keywords: ['推荐', '内置'] },
  { label: '应届生', keywords: ['应届生', '校招', '学生', '实习'] },
  { label: '程序员', keywords: ['程序员', '开发', '工程师', '互联网', '技术'] },
  { label: '设计师', keywords: ['设计师', '设计', '极简'] },
  { label: '产品经理', keywords: ['产品经理', '产品'] },
  { label: '运营', keywords: ['运营'] },
  { label: '海外求职', keywords: ['海外', '英文', '国际'] },
];

const myTemplates = computed(() => templateStore.list.filter((t) => !t.is_builtin));

const filteredTemplates = computed(() => {
  // 「我的模板」：只展示当前账号的自定义模板（简历内微调后保存到模板中心的模板）
  if (activeCategory.value === '我的模板') return myTemplates.value;

  const category = categories.find((item) => item.label === activeCategory.value);
  if (!category || category.label === '全部') return templateStore.list;

  return templateStore.list.filter((template) => {
    const searchableText = getTemplateSearchText(template);
    if (category.label === '推荐') return template.is_builtin;
    return category.keywords.some((keyword) => searchableText.includes(keyword.toLocaleLowerCase()));
  });
});

onMounted(() => {
  templateStore.fetchList();
});

function goEdit(tpl: ITemplate) {
  router.push(`/templates/${tpl.template_id}/edit`);
}

async function handleClone(tpl: ITemplate) {
  const id = await templateStore.cloneTemplate(tpl.template_id);
  if (id) {
    ElMessage.success('已复制为个人模板');
    router.push(`/templates/${id}/edit`);
  }
}

async function handleDelete(tpl: ITemplate) {
  try {
    await ElMessageBox.confirm(`删除后将无法恢复「${tpl.name}」，确定继续吗？`, '删除这个模板？', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '保留模板',
      closeOnClickModal: false,
    });
  } catch {
    return;
  }
  await templateStore.removeTemplate(tpl.template_id);
  isPreviewVisible.value = false;
  isLargePreviewVisible.value = false;
  previewTemplate.value = null;
  previewConfig.value = null;
  ElMessage.success('已删除');
}

async function useTemplate(tpl: ITemplate) {
  creating.value = true;
  try {
    const id = await resumeStore.createResume(`基于「${tpl.name}」的简历`, tpl.template_id);
    if (id) {
      ElMessage.success('已创建简历，开始填充内容');
      router.push(`/editor/${id}`);
    }
  } finally {
    creating.value = false;
  }
}

function getTemplateTags(tpl: ITemplate): string[] {
  const tags = tpl.config.meta.tags || [];
  return tags.length ? tags.slice(0, 3) : [tpl.is_builtin ? '官方模板' : '个性模板'];
}

function getTemplateSearchText(tpl: ITemplate): string {
  return [
    tpl.name,
    tpl.description || '',
    tpl.config.meta.title,
    tpl.config.meta.description || '',
    ...getTemplateTags(tpl),
    tpl.is_builtin ? '内置 推荐' : '自定义',
  ]
    .join(' ')
    .toLocaleLowerCase();
}

function getTemplateDescription(tpl: ITemplate): string {
  return tpl.description || tpl.config.meta.description || '清晰专业的版式，适合快速制作职业简历';
}

function openPreview(tpl: ITemplate): void {
  previewTemplate.value = tpl;
  previewConfig.value = migrateTemplateConfig(tpl.config);
  previewPageIndex.value = 0;
  previewPageCount.value = 1;
  isLargePreviewVisible.value = false;
  isPreviewVisible.value = true;
}

function openLargePreview(): void {
  if (!previewTemplate.value || !previewConfig.value) return;
  isLargePreviewVisible.value = true;
}

function handlePreviewPageCount(count: number): void {
  previewPageCount.value = Math.max(1, count);
  if (previewPageIndex.value > previewPageCount.value - 1) {
    previewPageIndex.value = previewPageCount.value - 1;
  }
}

function goPreviewPage(delta: number): void {
  const next = previewPageIndex.value + delta;
  if (next < 0 || next >= previewPageCount.value) return;
  previewPageIndex.value = next;
}

function handlePreviewWheel(event: WheelEvent): void {
  if (previewPageCount.value <= 1) return;
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (Math.abs(delta) < 20) return;
  event.preventDefault();
  const now = Date.now();
  if (now < previewWheelLockedUntil) return;
  previewWheelLockedUntil = now + 280;
  goPreviewPage(delta > 0 ? 1 : -1);
}

function selectCategory(category: string): void {
  activeCategory.value = category;
}

function loadFavoriteTemplateIds(): Set<string> {
  try {
    const storedValue = localStorage.getItem(FAVORITE_STORAGE_KEY);
    const templateIds: unknown = storedValue ? JSON.parse(storedValue) : [];
    return new Set(Array.isArray(templateIds) ? templateIds.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function isFavorite(tpl: ITemplate): boolean {
  return favoriteTemplateIds.value.has(tpl.template_id);
}

function toggleFavorite(tpl: ITemplate): void {
  const nextTemplateIds = new Set(favoriteTemplateIds.value);
  const willFavorite = !nextTemplateIds.has(tpl.template_id);
  if (willFavorite) {
    nextTemplateIds.add(tpl.template_id);
  } else {
    nextTemplateIds.delete(tpl.template_id);
  }
  favoriteTemplateIds.value = nextTemplateIds;
  localStorage.setItem(FAVORITE_STORAGE_KEY, JSON.stringify([...nextTemplateIds]));
  ElMessage.success(willFavorite ? '已收藏模板' : '已取消收藏');
}
</script>

<template>
  <div class="template-market">
    <AppTopbar />

    <main class="content">
      <section class="page-heading">
        <div>
          <h1>简历模板</h1>
          <p>选择专业模板，快速创建你的职业简历</p>
        </div>
        <span class="count">{{ filteredTemplates.length }} 个模板</span>
      </section>

      <section class="gallery-section">
        <div class="category-tabs" role="tablist" aria-label="模板分类">
          <button
            v-for="category in categories"
            :key="category.label"
            type="button"
            role="tab"
            :aria-selected="activeCategory === category.label"
            :class="{ active: activeCategory === category.label }"
            @click="selectCategory(category.label)"
          >
            {{ category.label }}
          </button>
        </div>

        <div v-loading="templateStore.isLoading" class="template-grid">
          <button
            v-if="activeCategory === '我的模板'"
            class="create-template-card"
            type="button"
            @click="router.push('/templates/new')"
          >
            <span class="create-icon"><el-icon :size="22"><Plus /></el-icon></span>
            <strong>新建模板</strong>
            <span class="create-hint">从零开始，或复制内置模板微调</span>
          </button>

          <article
            v-for="(tpl, index) in filteredTemplates"
            :key="tpl.template_id"
            class="template-card"
            :style="{ '--template-index': index }"
            tabindex="0"
            @click="openPreview(tpl)"
            @keydown.enter="openPreview(tpl)"
          >
            <div class="card-preview">
              <PaperThumb :data="sampleData" :config="migrateTemplateConfig(tpl.config)" />
            </div>
          </article>

          <div v-if="!templateStore.isLoading && !filteredTemplates.length" class="empty-state">
            <span class="empty-icon"><el-icon :size="26"><Collection /></el-icon></span>
            <h3 v-if="activeCategory === '我的模板'">还没有个人模板</h3>
            <h3 v-else>这个分类还没有模板</h3>
            <p v-if="activeCategory === '我的模板'">
              在简历编辑页「模板」面板微调后点「保存到模板中心」，或直接新建模板
            </p>
            <p v-else>切换其他分类，或创建属于你的模板</p>
            <el-button @click="selectCategory('全部')">查看全部模板</el-button>
          </div>
        </div>
      </section>
    </main>

    <el-dialog
      v-model="isPreviewVisible"
      class="preview-dialog"
      width="min(780px, calc(100vw - 32px), calc((100vh - 48px) * 210 / 297 / 0.55))"
      :show-close="false"
      align-center
      destroy-on-close
    >
      <template v-if="previewTemplate">
        <div class="modal-preview">
          <div class="modal-preview-stage" @wheel="handlePreviewWheel">
            <button
              class="modal-paper enlarge-trigger"
              type="button"
              aria-label="查看大图"
              @click="openLargePreview"
            >
              <PaperThumb
                v-if="previewConfig"
                :data="sampleData"
                :config="previewConfig"
                :fallback-scale="0.54"
                show-all-pages
                page-layout="flip"
                :page-index="previewPageIndex"
                @page-count="handlePreviewPageCount"
              />
              <span class="enlarge-hint">
                <el-icon><ZoomIn /></el-icon>
                查看大图
              </span>
            </button>

            <button
              v-if="previewPageIndex > 0"
              class="page-nav prev"
              type="button"
              aria-label="上一页"
              @click="goPreviewPage(-1)"
            >
              <el-icon><ArrowLeft /></el-icon>
            </button>
            <button
              v-if="previewPageIndex < previewPageCount - 1"
              class="page-nav next"
              type="button"
              aria-label="下一页"
              @click="goPreviewPage(1)"
            >
              <el-icon><ArrowRight /></el-icon>
            </button>
            <div v-if="previewPageCount > 1" class="page-indicator">
              {{ previewPageIndex + 1 }} / {{ previewPageCount }}
            </div>
          </div>

          <aside class="modal-details">
            <button
              class="modal-close"
              type="button"
              aria-label="关闭预览"
              @click="isPreviewVisible = false"
            >
              <el-icon><Close /></el-icon>
            </button>
            <span class="detail-eyebrow">{{ previewTemplate.is_builtin ? '官方精选模板' : '个人模板' }}</span>
            <h2>{{ previewTemplate.name }}</h2>
            <p class="detail-description">{{ getTemplateDescription(previewTemplate) }}</p>

            <div class="detail-block">
              <span>适用岗位</span>
              <strong>{{ getTemplateTags(previewTemplate).join(' · ') }}</strong>
            </div>
            <div class="detail-block">
              <span>设计特点</span>
              <strong>清晰层级、专业排版、A4 打印优化</strong>
            </div>
            <div class="recommendation">
              <span>推荐指数</span>
              <div class="stars" aria-label="五星推荐">
                <el-icon v-for="index in 5" :key="index"><StarFilled /></el-icon>
              </div>
            </div>

            <div class="modal-tags">
              <span v-for="tag in getTemplateTags(previewTemplate)" :key="tag">{{ tag }}</span>
            </div>

            <el-button
              class="modal-use-button"
              :loading="creating"
              @click="useTemplate(previewTemplate)"
            >
              立即使用模板
              <el-icon><ArrowRight /></el-icon>
            </el-button>

            <div class="modal-secondary-actions">
              <button type="button" @click="toggleFavorite(previewTemplate)">
                <el-icon>
                  <StarFilled v-if="isFavorite(previewTemplate)" />
                  <Star v-else />
                </el-icon>
                {{ isFavorite(previewTemplate) ? '取消收藏' : '收藏' }}
              </button>
              <button type="button" @click="goEdit(previewTemplate)">
                <el-icon><EditPen /></el-icon>
                {{ previewTemplate.is_builtin ? '定制' : '编辑' }}
              </button>
              <button type="button" @click="handleClone(previewTemplate)">
                <el-icon><CopyDocument /></el-icon>
                复制
              </button>
              <button
                v-if="!previewTemplate.is_builtin"
                type="button"
                class="danger"
                @click="handleDelete(previewTemplate)"
              >
                <el-icon><Delete /></el-icon>
                删除
              </button>
            </div>
          </aside>
        </div>
      </template>
    </el-dialog>

    <ResumeFullPreview
      v-if="isLargePreviewVisible && previewTemplate && previewConfig"
      :data="sampleData"
      :title="previewTemplate.name"
      :config="previewConfig"
      variant="overlay"
      @close="isLargePreviewVisible = false"
    />
  </div>
</template>

<style scoped lang="scss">
/* 与首页共用同一条缓动，保持纸张浮起手感一致 */
$paper-ease: cubic-bezier(0.22, 1, 0.36, 1);

.template-market {
  min-height: 100%;
  background:
    radial-gradient(circle at 10% 6%, rgba(99, 102, 241, 0.07), transparent 28rem),
    radial-gradient(circle at 90% 18%, rgba(37, 99, 235, 0.06), transparent 26rem),
    #f8fafc;
}

.content {
  max-width: 1240px;
  margin: 0 auto;
  padding: 28px 24px 80px;
}

/* 标题区压到 100px 以内，第一屏尽量多留给模板本身 */
.page-heading {
  min-height: 0;
  padding: 4px 0 24px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;

  h1 {
    margin: 0;
    color: #0f172a;
    font-size: 26px;
    line-height: 1.25;
    letter-spacing: -0.035em;
  }

  p {
    margin-top: 8px;
    color: #64748b;
    font-size: 14px;
  }

  .count {
    color: #94a3b8;
    font-size: 12px;
    white-space: nowrap;
  }
}

.gallery-section {
  margin-top: 0;
}

.category-tabs {
  margin-bottom: 22px;
  padding-bottom: 4px;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  button {
    height: 34px;
    padding: 0 15px;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.86);
    color: #64748b;
    flex: 0 0 auto;
    font-size: 13px;
    cursor: pointer;
    transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease,
      transform 0.2s ease;

    &:hover {
      border-color: #bfdbfe;
      color: #2563eb;
      transform: translateY(-1px);
    }

    &.active {
      border-color: #2563eb;
      color: #fff;
      background: #2563eb;
      box-shadow: 0 5px 14px rgba(37, 99, 235, 0.2);
    }
  }
}

/* 卡片只展示纸张预览，名称与操作放到点击后的预览页 */
.template-grid {
  min-height: 280px;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: start;
  gap: 24px;
}

.template-card {
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  outline: none;
  background: transparent;
  cursor: pointer;
  animation: card-enter 0.48s both;
  animation-delay: calc(var(--template-index, 0) * 55ms);
}

/* 「我的模板」下的新建入口：与模板纸张同尺寸，只靠留白和虚线降低视觉权重 */
.create-template-card {
  width: 100%;
  aspect-ratio: 210 / 297;
  padding: 20px;
  border: 1.5px dashed #dfe5ec;
  border-radius: 4px;
  background: rgba(248, 250, 252, 0.55);
  color: #94a3b8;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: transform 0.25s ease, border-color 0.25s ease, background-color 0.25s ease;

  .create-icon {
    width: 44px;
    height: 44px;
    margin-bottom: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: #94a3b8;
    background: #fff;
    transition: transform 0.25s ease, border-color 0.25s ease, color 0.25s ease;
  }

  strong {
    color: #475569;
    font-size: 14px;
    font-weight: 650;
  }

  .create-hint {
    font-size: 12px;
  }

  &:hover {
    transform: translateY(-4px);
    border-color: #60a5fa;
    background: rgba(239, 246, 255, 0.7);
  }

  &:hover .create-icon {
    transform: rotate(90deg) scale(1.08);
    border-color: #bfdbfe;
    color: #2563eb;
  }
}

.card-preview {
  min-width: 0;
  border-radius: 4px;
}

/* 像拿起纸张一样轻微上浮，不缩放、不遮挡真实内容 */
.template-card:hover :deep(.cv-paper),
.template-card:focus-visible :deep(.cv-paper) {
  transform: translateY(-4px);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.14);
}

.modal-tags {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  span {
    padding: 4px 8px;
    border-radius: 6px;
    color: #64748b;
    background: #f1f5f9;
    font-size: 10px;
  }
}

.empty-state {
  min-height: 320px;
  padding: 48px 24px;
  grid-column: 1 / -1;
  border: 1px dashed #cbd5e1;
  border-radius: 16px;
  text-align: center;
  background: rgba(255, 255, 255, 0.6);

  .empty-icon {
    width: 58px;
    height: 58px;
    margin: 0 auto 16px;
    border-radius: 16px;
    color: #2563eb;
    background: #eff6ff;
    display: grid;
    place-items: center;
  }

  h3 {
    color: #0f172a;
    font-size: 16px;
  }

  p {
    margin: 7px 0 18px;
    color: #94a3b8;
    font-size: 13px;
  }
}

:deep(.preview-dialog) {
  padding: 0;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.22);

  .el-dialog__header {
    display: none;
  }

  .el-dialog__body {
    padding: 0;
  }
}

.modal-preview {
  display: grid;
  grid-template-columns: 55% 45%;
}

.modal-preview-stage {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: stretch;

  &:hover,
  &:focus-within {
    .page-nav,
    .page-indicator {
      opacity: 1;
      pointer-events: auto;
    }
  }
}

.modal-paper {
  width: 100%;
  aspect-ratio: 210 / 297;
  overflow: hidden;
  position: relative;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: zoom-in;
  display: block;
  text-align: left;

  &.enlarge-trigger {
    &:hover .enlarge-hint,
    &:focus-visible .enlarge-hint {
      opacity: 1;
    }
  }

  :deep(.cv-paper) {
    width: 100%;
    height: 100%;
    border-radius: 0;
    box-shadow: none;
    pointer-events: none;
  }
}

.enlarge-hint {
  position: absolute;
  left: 50%;
  bottom: 16px;
  z-index: 4;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.78);
  color: #fff;
  font-size: 12px;
  font-weight: 650;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.page-nav {
  width: 36px;
  height: 36px;
  position: absolute;
  top: 50%;
  z-index: 5;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  color: #334155;
  display: grid;
  place-items: center;
  transform: translateY(-50%);
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.16);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, color 0.18s ease, border-color 0.18s ease;

  &:hover {
    color: #2563eb;
    border-color: #bfdbfe;
  }

  &.prev {
    left: 10px;
  }

  &.next {
    right: 10px;
  }
}

.page-indicator {
  position: absolute;
  left: 50%;
  bottom: 12px;
  z-index: 5;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.78);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  transform: translateX(-50%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.modal-details {
  padding: 42px 28px 28px;
  position: relative;
  background: #fff;

  .detail-eyebrow {
    color: #2563eb;
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.08em;
  }

  h2 {
    margin-top: 10px;
    color: #0f172a;
    font-size: 24px;
    letter-spacing: -0.04em;
  }
}

.modal-close {
  width: 34px;
  height: 34px;
  position: absolute;
  top: 18px;
  right: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  color: #64748b;
  display: grid;
  place-items: center;
  cursor: pointer;

  &:hover {
    color: #0f172a;
    background: #f8fafc;
  }
}

.detail-description {
  margin: 12px 0 18px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}

.detail-block {
  padding: 11px 0;
  border-top: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 6px;

  span,
  .recommendation > span {
    color: #94a3b8;
    font-size: 11px;
  }

  strong {
    color: #334155;
    font-size: 13px;
    line-height: 1.5;
  }
}

.recommendation {
  padding: 11px 0;
  border-top: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;

  > span {
    color: #94a3b8;
    font-size: 11px;
  }
}

.stars {
  color: #f59e0b;
  display: flex;
  gap: 2px;
  font-size: 14px;
}

:deep(.modal-use-button) {
  width: 100%;
  height: 40px;
  margin: 20px 0 0;
  border: 0;
  border-radius: 10px;
  color: #fff;
  background: linear-gradient(135deg, #2563eb, #6366f1);
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.24);
  font-weight: 650;

  &:hover {
    color: #fff;
    transform: translateY(-2px);
    box-shadow: 0 14px 28px rgba(37, 99, 235, 0.3);
  }
}

.modal-secondary-actions {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  button {
    height: 34px;
    padding: 0 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #64748b;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    cursor: pointer;
    transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;

    &:hover {
      border-color: #bfdbfe;
      color: #2563eb;
      background: #f8fbff;
    }

    &.danger:hover {
      border-color: #fecaca;
      color: #dc2626;
      background: #fef2f2;
    }
  }
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1024px) {
  .template-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .modal-preview {
    grid-template-columns: 55% 45%;
  }

  .modal-preview-stage {
    padding: 0;
  }
}

@media (max-width: 720px) {
  .content {
    padding: 28px 16px 52px;
  }

  .page-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
    padding-bottom: 20px;

    h1 {
      font-size: 22px;
    }

    p {
      font-size: 13px;
    }
  }

  /* 手机单列，确保 A4 页面完整展示且不裁剪 */
  .template-grid {
    grid-template-columns: 1fr;
    gap: 30px;
  }

  .template-card {
    padding: 0;
  }

  .modal-preview {
    display: block;
    height: auto;
  }

  .modal-preview-stage {
    height: auto;
    padding: 0;
  }

  .modal-paper {
    width: 100%;
  }

  .modal-details {
    padding: 34px 24px 28px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .template-card {
    animation: none;
  }

  .template-card,
  :deep(.el-button) {
    transition: none;
  }

  .template-card:hover :deep(.cv-paper),
  .template-card:focus-visible :deep(.cv-paper) {
    transform: none;
  }
}
</style>
