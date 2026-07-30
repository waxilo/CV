<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useTemplateStore } from '/@/stores/template';
import { useResumeStore } from '/@/stores/resume';
import { useUserStore } from '/@/stores/user';
import { createSampleResumeData } from '/@/features/template-renderer/sampleData';
import { migrateTemplateConfig } from '/@/features/template-renderer';
import PaperThumb from '/@/components/preview/PaperThumb.vue';
import type { ITemplate } from '/@/types/template';

interface ITemplateCategory {
  label: string;
  keywords: string[];
}

const router = useRouter();
const templateStore = useTemplateStore();
const resumeStore = useResumeStore();
const userStore = useUserStore();
const sampleData = createSampleResumeData();
const creating = ref(false);
const searchQuery = ref('');
const activeCategory = ref('全部');
const previewTemplate = ref<ITemplate | null>(null);
const isPreviewVisible = ref(false);

const categories: ITemplateCategory[] = [
  { label: '全部', keywords: [] },
  { label: '推荐', keywords: ['推荐', '内置'] },
  { label: '热门', keywords: ['热门', '互联网', '极简'] },
  { label: '应届生', keywords: ['应届生', '校招', '学生', '实习'] },
  { label: '程序员', keywords: ['程序员', '开发', '工程师', '互联网', '技术'] },
  { label: '设计师', keywords: ['设计师', '设计', '极简'] },
  { label: '产品经理', keywords: ['产品经理', '产品'] },
  { label: '运营', keywords: ['运营'] },
  { label: '海外求职', keywords: ['海外', '英文', '国际'] },
];

const userInitial = computed(() => userStore.displayName.trim().charAt(0).toUpperCase() || 'U');
const featuredTemplates = computed(() => {
  const builtinTemplates = templateStore.list.filter((template) => template.is_builtin);
  return (builtinTemplates.length ? builtinTemplates : templateStore.list).slice(0, 4);
});
const filteredTemplates = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  const category = categories.find((item) => item.label === activeCategory.value);

  return templateStore.list.filter((template) => {
    const searchableText = getTemplateSearchText(template);
    const matchesSearch = !query || searchableText.includes(query);
    const matchesCategory =
      !category ||
      category.label === '全部' ||
      (category.label === '推荐' && template.is_builtin) ||
      category.keywords.some((keyword) => searchableText.includes(keyword.toLocaleLowerCase()));
    return matchesSearch && matchesCategory;
  });
});

onMounted(() => {
  templateStore.fetchList();
});

function goCreate() {
  router.push({ name: 'TemplateCreate' });
}

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

function goDashboard() {
  router.push('/');
}

function handleUserCommand(command: string): void {
  if (command === 'dashboard') {
    goDashboard();
    return;
  }
  if (command === 'logout') {
    userStore.logout();
    router.replace('/login');
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
  isPreviewVisible.value = true;
}

function selectCategory(category: string): void {
  activeCategory.value = category;
}
</script>

<template>
  <div class="template-market">
    <header class="topbar no-print">
      <div class="nav-inner">
        <button class="brand" type="button" aria-label="返回简历首页" @click="goDashboard">
          <span class="mark">
            <el-icon :size="18"><Document /></el-icon>
          </span>
          <strong>CV Builder</strong>
        </button>

        <div class="nav-actions">
          <button class="nav-link" type="button" @click="goDashboard">我的简历</button>
          <el-button class="create-template-button" @click="goCreate">
            <el-icon><Plus /></el-icon>
            创建模板
          </el-button>
          <el-dropdown trigger="click" placement="bottom-end" @command="handleUserCommand">
            <button class="user-menu" type="button" aria-label="用户菜单">
              <span class="avatar">
                <img
                  v-if="userStore.user?.avatar_url"
                  :src="userStore.user.avatar_url"
                  :alt="userStore.displayName"
                />
                <span v-else>{{ userInitial }}</span>
              </span>
              <el-icon class="chevron"><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="dashboard">
                  <el-icon><House /></el-icon>
                  我的简历
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </header>

    <main class="content">
      <section class="hero">
        <span class="eyebrow">专业简历模板市场</span>
        <h1>选择一个适合你的简历模板</h1>
        <p>专业设计模板，快速创建属于你的职业简历</p>
        <div class="search-box">
          <el-icon :size="19"><Search /></el-icon>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="搜索模板，例如：程序员、设计师、应届生"
            aria-label="搜索模板"
          />
          <kbd>⌘ K</kbd>
        </div>
      </section>

      <section v-if="featuredTemplates.length" class="featured-section">
        <div class="section-title">
          <div>
            <span class="title-icon">🔥</span>
            <h2>热门模板</h2>
          </div>
          <p>为你精选的高质量职业简历模板</p>
        </div>
        <div class="featured-grid">
          <button
            v-for="tpl in featuredTemplates"
            :key="tpl.template_id"
            class="featured-card"
            type="button"
            @click="openPreview(tpl)"
          >
            <div class="featured-preview">
              <PaperThumb :data="sampleData" :config="migrateTemplateConfig(tpl.config)" />
            </div>
            <div class="featured-info">
              <span>精选模板</span>
              <strong>{{ tpl.name }}</strong>
              <el-icon><ArrowRight /></el-icon>
            </div>
          </button>
        </div>
      </section>

      <section class="gallery-section">
        <div class="gallery-heading">
          <div>
            <h2>探索全部模板</h2>
            <span>{{ filteredTemplates.length }} 个模板</span>
          </div>
        </div>

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
          <article
            v-for="(tpl, index) in filteredTemplates"
            :key="tpl.template_id"
            class="template-card"
            :style="{ '--template-index': index }"
            @click="openPreview(tpl)"
          >
            <PaperThumb :data="sampleData" :config="migrateTemplateConfig(tpl.config)">
              <span v-if="tpl.is_builtin" class="official-badge">官方</span>
              <div class="paper-actions" @click.stop>
                <el-button class="use-button" :loading="creating" @click.stop="useTemplate(tpl)">
                  使用
                </el-button>
                <el-dropdown trigger="click" placement="bottom-end">
                  <button class="more-button" type="button" aria-label="模板更多操作">
                    更多
                    <el-icon><ArrowDown /></el-icon>
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="openPreview(tpl)">
                        <el-icon><View /></el-icon>
                        查看预览
                      </el-dropdown-item>
                      <el-dropdown-item @click="goEdit(tpl)">
                        <el-icon><EditPen /></el-icon>
                        {{ tpl.is_builtin ? '定制模板' : '编辑模板' }}
                      </el-dropdown-item>
                      <el-dropdown-item @click="handleClone(tpl)">
                        <el-icon><CopyDocument /></el-icon>
                        复制模板
                      </el-dropdown-item>
                      <el-dropdown-item v-if="!tpl.is_builtin" divided @click="handleDelete(tpl)">
                        <el-icon><Delete /></el-icon>
                        删除模板
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </PaperThumb>

            <div class="card-meta">
              <h3>{{ tpl.name }}</h3>
              <p class="meta-line">
                <span>{{ tpl.is_builtin ? '官方模板' : '个人模板' }}</span>
                <span class="dot" aria-hidden="true">·</span>
                <span>{{ getTemplateTags(tpl)[0] }}</span>
              </p>
            </div>
          </article>

          <div v-if="!templateStore.isLoading && !filteredTemplates.length" class="empty-state">
            <span class="empty-icon"><el-icon :size="28"><Search /></el-icon></span>
            <h3>没有找到匹配的模板</h3>
            <p>试试其他关键词或切换模板分类</p>
            <el-button @click="searchQuery = ''; activeCategory = '全部'">查看全部模板</el-button>
          </div>
        </div>
      </section>
    </main>

    <el-dialog
      v-model="isPreviewVisible"
      class="preview-dialog"
      width="min(1040px, calc(100vw - 32px))"
      :show-close="false"
      destroy-on-close
    >
      <template v-if="previewTemplate">
        <div class="modal-preview">
          <div class="modal-preview-stage">
            <div class="modal-paper">
              <PaperThumb
                :data="sampleData"
                :config="migrateTemplateConfig(previewTemplate.config)"
                :fallback-scale="0.52"
              />
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
            <button class="customize-link" type="button" @click="goEdit(previewTemplate)">
              {{ previewTemplate.is_builtin ? '基于此模板进行定制' : '编辑这个模板' }}
            </button>
          </aside>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.template-market {
  min-height: 100%;
  background:
    radial-gradient(circle at 10% 6%, rgba(99, 102, 241, 0.07), transparent 28rem),
    radial-gradient(circle at 90% 18%, rgba(37, 99, 235, 0.06), transparent 26rem),
    #f8fafc;
}

.topbar {
  height: 64px;
  background: rgba(255, 255, 255, 0.78);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  position: sticky;
  top: 0;
  z-index: 20;
}

.nav-inner {
  max-width: 1320px;
  height: 100%;
  margin: 0 auto;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #0f172a;
  cursor: pointer;

  .mark {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: linear-gradient(135deg, #2563eb, #6366f1);
    color: #fff;
    display: grid;
    place-items: center;
    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.24);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  strong {
    font-size: 15px;
    font-weight: 750;
    letter-spacing: -0.02em;
  }

  &:hover .mark {
    transform: translateY(-1px) rotate(-2deg);
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
  }
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nav-link {
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #475569;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s ease, background-color 0.2s ease;

  &:hover {
    color: #0f172a;
    background: rgba(241, 245, 249, 0.9);
  }
}

:deep(.create-template-button) {
  height: 36px;
  margin: 0;
  border: 0;
  border-radius: 9px;
  color: #fff;
  background: #0f172a;
  font-weight: 600;

  &:hover {
    color: #fff;
    background: #1e293b;
    transform: translateY(-1px);
  }
}

.user-menu {
  padding: 3px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;

  &:hover {
    border-color: #e2e8f0;
    background: #fff;
  }

  .chevron {
    color: #94a3b8;
    font-size: 11px;
  }
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #dbeafe, #e0e7ff);
  color: #4338ca;
  font-size: 13px;
  font-weight: 700;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 44px 24px 80px;
}

.hero {
  padding: 52px 24px 48px;
  text-align: center;

  .eyebrow {
    display: inline-block;
    margin-bottom: 14px;
    color: #4f46e5;
    font-size: 12px;
    font-weight: 750;
    letter-spacing: 0.12em;
  }

  h1 {
    margin: 0;
    color: #0f172a;
    font-size: clamp(34px, 4vw, 50px);
    line-height: 1.12;
    letter-spacing: -0.05em;
  }

  p {
    margin-top: 15px;
    color: #64748b;
    font-size: 16px;
  }
}

.search-box {
  width: min(620px, 100%);
  height: 52px;
  margin: 32px auto 0;
  padding: 0 14px 0 17px;
  border: 1px solid #dbe3ee;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
  display: flex;
  align-items: center;
  gap: 12px;
  color: #94a3b8;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:focus-within {
    border-color: #93c5fd;
    box-shadow: 0 14px 34px rgba(37, 99, 235, 0.12), 0 0 0 3px rgba(37, 99, 235, 0.08);
  }

  input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: 0;
    background: transparent;
    color: #0f172a;
    font: inherit;
    font-size: 14px;

    &::placeholder {
      color: #94a3b8;
    }

    &::-webkit-search-cancel-button {
      cursor: pointer;
    }
  }

  kbd {
    padding: 4px 7px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #f8fafc;
    color: #94a3b8;
    font-family: inherit;
    font-size: 11px;
  }
}

.featured-section {
  margin-top: 12px;
}

.section-title {
  margin-bottom: 16px;
  display: flex;
  align-items: end;
  justify-content: space-between;

  > div {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .title-icon {
    font-size: 18px;
  }

  h2 {
    color: #0f172a;
    font-size: 20px;
    letter-spacing: -0.03em;
  }

  p {
    color: #94a3b8;
    font-size: 12px;
  }
}

.featured-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.featured-card {
  min-width: 0;
  padding: 0;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fff;
  overflow: hidden;
  display: flex;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
  transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;

  &:hover {
    border-color: #bfdbfe;
    transform: translateY(-3px);
    box-shadow: 0 14px 30px rgba(15, 23, 42, 0.1);
  }
}

/* 与画廊卡片同一套预览：真实 A4 纸张，只是尺寸更小 */
.featured-preview {
  width: 146px;
  flex: 0 0 146px;
  padding: 16px 0 16px 16px;
  pointer-events: none;
}

.featured-info {
  min-width: 0;
  padding: 20px 18px;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;

  span {
    color: #2563eb;
    font-size: 11px;
    font-weight: 700;
  }

  strong {
    max-width: 100%;
    margin-top: 7px;
    overflow: hidden;
    color: #0f172a;
    font-size: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .el-icon {
    margin-top: auto;
    color: #94a3b8;
    transition: transform 0.2s ease, color 0.2s ease;
  }
}

.featured-card:hover .featured-info .el-icon {
  color: #2563eb;
  transform: translateX(4px);
}

.gallery-section {
  margin-top: 42px;
}

.gallery-heading {
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  > div {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  h2 {
    color: #0f172a;
    font-size: 20px;
    letter-spacing: -0.03em;
  }

  span {
    color: #94a3b8;
    font-size: 12px;
  }
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

/* 与首页同一套栅格：A4 缩到约 210px 宽平铺 */
.template-grid {
  min-height: 280px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  align-items: start;
  gap: 24px;
}

.template-card {
  min-width: 0;
  cursor: pointer;
  perspective: 1400px;
  animation: card-enter 0.48s both;
  animation-delay: calc(var(--template-index, 0) * 55ms);
}

/* 抬起纸张：与首页简历卡一致的手感 */
.template-card:hover .cv-paper,
.template-card:focus-within .cv-paper {
  transform: translateY(-8px) rotateX(2deg);
  box-shadow:
    0 26px 50px rgba(15, 23, 42, 0.16),
    0 8px 16px rgba(15, 23, 42, 0.06);
}

.official-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 4px 8px;
  border: 1px solid rgba(191, 219, 254, 0.9);
  border-radius: 999px;
  color: #1d4ed8;
  background: rgba(239, 246, 255, 0.92);
  backdrop-filter: blur(8px);
  font-size: 10px;
  font-weight: 700;
}

/* 操作栏默认隐藏，hover / 键盘聚焦时从纸张底部淡入 */
.paper-actions {
  position: absolute;
  inset: auto 0 0;
  padding: 36px 10px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.94) 58%);
  opacity: 0;
  transform: translateY(12px);
  pointer-events: none;
  transition:
    opacity 250ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 250ms cubic-bezier(0.22, 1, 0.36, 1);
}

.template-card:hover .paper-actions,
.template-card:focus-within .paper-actions {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

:deep(.use-button) {
  height: 30px;
  margin: 0;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: #2563eb;
  font-weight: 600;
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.28);
  transition: background-color 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    color: #fff;
    background: #1d4ed8;
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.34);
  }
}

.more-button {
  height: 30px;
  padding: 0 12px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #fff;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.1);
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;

  &:hover {
    border-color: #cbd5e1;
    color: #0f172a;
    background: #f8fafc;
  }
}

.card-meta {
  min-width: 0;
  padding: 14px 2px 0;

  h3 {
    overflow: hidden;
    color: #0f172a;
    font-size: 14px;
    font-weight: 650;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta-line {
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    color: #94a3b8;
    font-size: 12px;
    white-space: nowrap;

    > span:last-child {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .dot {
    color: #cbd5e1;
  }
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
  min-height: 690px;
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.8fr);
}

.modal-preview-stage {
  min-width: 0;
  padding: 42px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 12%, rgba(219, 234, 254, 0.5), transparent 55%),
    #f8fafc;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.modal-paper {
  width: 413px;
  max-width: 100%;

  :deep(.cv-paper) {
    box-shadow: 0 22px 55px rgba(15, 23, 42, 0.18);
  }
}

.modal-details {
  padding: 48px 38px 38px;
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
    font-size: 28px;
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
  margin: 14px 0 28px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}

.detail-block {
  padding: 16px 0;
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
  padding: 16px 0;
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

.modal-tags {
  margin-top: 6px;
}

:deep(.modal-use-button) {
  width: 100%;
  height: 44px;
  margin: 30px 0 0;
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

.customize-link {
  width: 100%;
  margin-top: 14px;
  border: 0;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    color: #2563eb;
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
  .featured-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .modal-preview {
    grid-template-columns: minmax(0, 1.1fr) minmax(300px, 0.9fr);
  }

  .modal-preview-stage {
    padding: 34px 20px;
  }
}

@media (max-width: 720px) {
  .nav-inner {
    padding: 0 16px;
  }

  .nav-link {
    display: none;
  }

  :deep(.create-template-button) {
    width: 36px;
    padding: 0;

    span:not(.el-icon) {
      display: none;
    }
  }

  .content {
    padding: 28px 16px 52px;
  }

  .hero {
    padding: 36px 4px 40px;

    h1 {
      font-size: 34px;
    }

    p {
      font-size: 14px;
    }
  }

  .search-box {
    kbd {
      display: none;
    }
  }

  .section-title {
    align-items: flex-start;

    p {
      display: none;
    }
  }

  .featured-grid {
    grid-template-columns: 1fr;
  }

  /* 窄屏保持两列，避免单列时纸张被拉得过大 */
  .template-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .featured-card:nth-child(n + 4) {
    display: none;
  }

  .gallery-section {
    margin-top: 34px;
  }

  .modal-preview {
    display: block;
  }

  .modal-preview-stage {
    height: 430px;
    padding: 26px 12px;
  }

  .modal-paper {
    width: 262px;
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
  .featured-card,
  .paper-actions,
  :deep(.el-button) {
    transition: none;
  }

  .template-card:hover .cv-paper,
  .template-card:focus-within .cv-paper {
    transform: none;
  }
}
</style>
