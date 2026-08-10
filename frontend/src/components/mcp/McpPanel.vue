<script setup lang="ts">
/**
 * MCP 接入面板：管理 API Key，一键复制「安装 / 更新全局 MCP」的 AI 提示词。
 */
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { createApiKeyApi, listApiKeysApi, revokeApiKeyApi } from '/@/api/apiKey';
import type { IApiKeyCreated, IApiKeySummary } from '/@/types/apiKey';
import { copyText } from '/@/utils/clipboard';

const isLoading = ref(false);
const isCreating = ref(false);
const keys = ref<IApiKeySummary[]>([]);
const keyName = ref('Cursor MCP');
/** 刚创建的明文，仅本地展示直至关闭；也用于生成安装提示词 */
const freshlyCreated = ref<IApiKeyCreated | null>(null);

const apiBase = computed(() => {
  const fromEnv = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return 'https://cv-api.sloan.dpdns.org';
});

const activeKeys = computed(() => keys.value.filter((k) => !k.is_revoked));
const revokedKeys = computed(() => keys.value.filter((k) => k.is_revoked));

const hasInstallToken = computed(() => Boolean(freshlyCreated.value?.api_key));

/** 贴进 Cursor / Claude 等 Agent 的安装提示词 */
const installPrompt = computed(() => {
  const token = freshlyCreated.value?.api_key || '';
  return `请帮我在当前 AI 客户端中全局安装并启用 CV Builder MCP（用于读写我的在线简历）。

【必须完成】
1. 使用 npm 包 @waxilo/cv-mcp，通过 npx 启动（不要用本地仓库路径）。
2. 写入全局 MCP 配置，服务器名称：cv-builder。
3. 配置内容如下（可直接采用）：

{
  "mcpServers": {
    "cv-builder": {
      "command": "npx",
      "args": ["-y", "@waxilo/cv-mcp"],
      "env": {
        "CV_API_BASE": "${apiBase.value}",
        "CV_API_TOKEN": "${token}"
      }
    }
  }
}

4. 若客户端使用 mcp.json / Claude Desktop 的 claude_desktop_config.json / Cursor 的 MCP 设置，请写入对应文件并保存。
5. 配置完成后提示我刷新或重启 MCP；可用工具 list_resumes 验证是否连通。
6. 若账号还没有简历：用 create_resume 从零新建（迁移旧简历时可带上完整 data）；已有简历则默认先 duplicate_resume 再改副本，不要直接改原件。

【注意】
- CV_API_TOKEN 是我的私密密钥，不要提交到 git，不要发到公开场合。
- 不要改成其他包名或本地 tsx 路径。
- 只改 MCP 配置，不要改我的业务代码（除非我另行要求）。`;
});

/** 已装过 MCP 时，贴给 Agent 拉取最新包并重启 */
const updatePrompt = computed(() => {
  const tokenLine = freshlyCreated.value?.api_key
    ? `- 若需轮换密钥，将 env.CV_API_TOKEN 更新为：${freshlyCreated.value.api_key}`
    : '- 保留现有 env.CV_API_TOKEN（除非我另行提供新 Key）；不要删除或清空密钥。';

  return `请帮我把当前 AI 客户端里已安装的 CV Builder MCP（cv-builder / @waxilo/cv-mcp）更新到最新版本。

【必须完成】
1. 确认全局 MCP 仍通过 npx 启动，推荐配置：

{
  "mcpServers": {
    "cv-builder": {
      "command": "npx",
      "args": ["-y", "@waxilo/cv-mcp"],
      "env": {
        "CV_API_BASE": "${apiBase.value}",
        "CV_API_TOKEN": "（保留我现有的密钥，不要改成占位符）"
      }
    }
  }
}

2. 清理 npx 缓存并拉最新包（任选可用方式执行）：
   - npx clear-npx-cache
   - 或 npm cache clean --force
3. 保存 MCP 配置后，提示我刷新 / 重启 MCP（Cursor：Settings → MCP 开关或 Reload）。
4. 用 list_resumes 验证连通；若返回 RESUME_LOCKED，说明该简历已锁定，需我在网页解锁后再改原件，或先 duplicate_resume 再改副本。空账号可用 create_resume 从零新建（可带 data 迁移）。
${tokenLine}

【改简历约定】
- 无简历时用 create_resume；已有简历默认先 duplicate_resume 再 update_* 副本，不要直接改正式原件（除非我明确要求）。
- 不要改成其他包名或本地仓库 / tsx 路径。
- 不要把 CV_API_TOKEN 提交到 git 或发到公开场合。
- 只更新 MCP 相关配置与缓存，不要改我的业务代码（除非我另行要求）。`;
});

const mcpConfigJson = computed(() => {
  const token = freshlyCreated.value?.api_key || 'cvk_先创建API_Key';
  return JSON.stringify(
    {
      mcpServers: {
        'cv-builder': {
          command: 'npx',
          args: ['-y', '@waxilo/cv-mcp'],
          env: {
            CV_API_BASE: apiBase.value,
            CV_API_TOKEN: token,
          },
        },
      },
    },
    null,
    2
  );
});

async function loadKeys() {
  isLoading.value = true;
  try {
    const res = await listApiKeysApi();
    keys.value = res.data ?? [];
  } catch {
    // 错误提示由 request 拦截器处理
  } finally {
    isLoading.value = false;
  }
}

async function handleCreate() {
  if (isCreating.value) return;
  isCreating.value = true;
  try {
    const res = await createApiKeyApi({ name: keyName.value.trim() || 'Cursor MCP' });
    if (!res.data?.api_key) {
      ElMessage.error(res.message || '创建失败');
      return;
    }
    freshlyCreated.value = res.data;
    ElMessage.success('已创建，请复制下方安装提示词');
    await loadKeys();
  } catch {
    // 错误提示由 request 拦截器处理
  } finally {
    isCreating.value = false;
  }
}

async function handleRevoke(item: IApiKeySummary) {
  try {
    await ElMessageBox.confirm(
      `吊销后使用 ${item.key_prefix} 的 MCP 将立即失效，确定？`,
      '吊销 API Key',
      { type: 'warning', confirmButtonText: '吊销', cancelButtonText: '取消' }
    );
  } catch {
    return;
  }

  try {
    await revokeApiKeyApi(item.api_key_id);
    if (freshlyCreated.value?.api_key_id === item.api_key_id) {
      freshlyCreated.value = null;
    }
    ElMessage.success('已吊销');
    await loadKeys();
  } catch {
    // 错误提示由 request 拦截器处理
  }
}

async function handleCopy(text: string, label: string) {
  const ok = await copyText(text);
  if (ok) ElMessage.success(`${label}已复制`);
  else ElMessage.error('复制失败，请手动选择文本');
}

async function handleCopyInstallPrompt() {
  if (!hasInstallToken.value) {
    ElMessage.warning('请先创建 API Key，提示词需要带上密钥');
    return;
  }
  await handleCopy(installPrompt.value, '安装提示词');
}

async function handleCopyUpdatePrompt() {
  await handleCopy(updatePrompt.value, '更新提示词');
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

onMounted(() => {
  void loadKeys();
});
</script>

<template>
  <div class="mcp-panel" v-loading="isLoading">
    <section class="block">
      <h3>用 AI 改简历</h3>
      <p class="desc">
        创建 API Key → 复制安装提示词给 Agent 装全局 MCP；已装过则复制更新提示词拉最新
        <code>@waxilo/cv-mcp</code>。之后即可直接改简历。
      </p>
    </section>

    <section class="block">
      <div class="block-head">
        <h3>1. 创建 API Key</h3>
        <span class="meta">有效 {{ activeKeys.length }} / 10</span>
      </div>

      <div class="create-row">
        <el-input v-model="keyName" maxlength="64" placeholder="密钥名称，如 Cursor MCP" />
        <el-button type="primary" :loading="isCreating" @click="handleCreate">创建</el-button>
      </div>

      <div v-if="freshlyCreated" class="secret-box">
        <p class="secret-title">明文仅显示一次；复制提示词时会自动带上此密钥</p>
        <el-input :model-value="freshlyCreated.api_key" readonly type="textarea" :rows="2" />
        <div class="secret-actions">
          <el-button type="primary" @click="handleCopy(freshlyCreated.api_key, 'API Key')">
            复制 API Key
          </el-button>
          <el-button @click="freshlyCreated = null">收起明文</el-button>
        </div>
      </div>

      <ul v-if="activeKeys.length" class="key-list">
        <li v-for="item in activeKeys" :key="item.api_key_id" class="key-item">
          <div class="key-main">
            <strong>{{ item.name }}</strong>
            <code>{{ item.key_prefix }}</code>
            <span class="time">创建 {{ formatTime(item.created_at) }}</span>
            <span class="time">最近使用 {{ formatTime(item.last_used_at) }}</span>
          </div>
          <el-button link type="danger" @click="handleRevoke(item)">吊销</el-button>
        </li>
      </ul>
      <p v-else class="empty">暂无有效密钥，先创建后再复制安装提示词。</p>

      <details v-if="revokedKeys.length" class="revoked">
        <summary>已吊销（{{ revokedKeys.length }}）</summary>
        <ul class="key-list muted">
          <li v-for="item in revokedKeys" :key="item.api_key_id" class="key-item">
            <div class="key-main">
              <strong>{{ item.name }}</strong>
              <code>{{ item.key_prefix }}</code>
              <span class="time">吊销于 {{ formatTime(item.revoked_at) }}</span>
            </div>
          </li>
        </ul>
      </details>
    </section>

    <section class="block highlight">
      <div class="block-head">
        <h3>2. 一键复制安装提示词</h3>
      </div>
      <p class="desc">
        复制后粘贴到 Cursor Agent / Claude 等对话里，让它帮你写入全局 MCP 配置并启用
        <code>@waxilo/cv-mcp</code>。
      </p>

      <div class="prompt-actions">
        <el-button
          type="primary"
          size="large"
          :disabled="!hasInstallToken"
          @click="handleCopyInstallPrompt"
        >
          一键复制安装提示词
        </el-button>
        <span v-if="!hasInstallToken" class="hint">需先创建 API Key（明文会写入提示词）</span>
        <span v-else class="hint ok">已带上刚创建的 API Key</span>
      </div>

      <pre class="config prompt">{{ installPrompt }}</pre>
    </section>

    <section class="block">
      <div class="block-head">
        <h3>3. 一键复制更新提示词</h3>
      </div>
      <p class="desc">
        已装过 MCP、只需拉最新 <code>@waxilo/cv-mcp</code> 时用这个。不强制新建
        Key；若本页刚创建了密钥，提示词会附带轮换说明。
      </p>

      <div class="prompt-actions">
        <el-button type="primary" plain size="large" @click="handleCopyUpdatePrompt">
          一键复制更新提示词
        </el-button>
        <span class="hint ok">清缓存 → 拉最新包 → 重启 MCP</span>
      </div>

      <pre class="config prompt">{{ updatePrompt }}</pre>
    </section>

    <section class="block">
      <div class="block-head">
        <h3>可选：手动 MCP JSON</h3>
        <el-button
          link
          type="primary"
          :disabled="!hasInstallToken"
          @click="handleCopy(mcpConfigJson, 'MCP 配置')"
        >
          复制 JSON
        </el-button>
      </div>
      <p class="desc">若你更想自己改配置文件，可复制这段到 Cursor Settings → MCP。</p>
      <pre class="config">{{ mcpConfigJson }}</pre>
    </section>

    <section class="block tip">
      <h3>使用提示</h3>
      <ol>
        <li>创建 API Key 后点「一键复制安装提示词」</li>
        <li>粘贴到 Agent，等它写好全局 MCP</li>
        <li>在对话里说「列出我的简历」验证连通</li>
        <li>新用户 / 空账号：让 Agent <code>create_resume</code>（可带旧简历 data 迁移）</li>
        <li>已有简历：让 Agent「先复制再改副本」，避免直接改原件</li>
        <li>回到「我的简历」刷新即可看到 AI 的修改</li>
        <li>包有更新时：复制「更新提示词」贴给 Agent，清缓存并重启 MCP</li>
      </ol>
    </section>
  </div>
</template>

<style scoped lang="scss">
.mcp-panel {
  width: 100%;
  margin: 0;
  padding: 16px 0 8px;
  color: #0f172a;
}

.block {
  margin-bottom: 22px;
  padding: 16px 18px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.block.highlight {
  border-color: #93c5fd;
  background: linear-gradient(180deg, #eff6ff, #ffffff 48%);
}

.block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

h3 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 650;
}

.desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #475569;

  code {
    font-size: 12px;
    padding: 0 4px;
    border-radius: 4px;
    background: #f1f5f9;
  }
}

.meta {
  font-size: 12px;
  color: #64748b;
}

.create-row {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.secret-box {
  margin-bottom: 14px;
  padding: 12px;
  border-radius: 8px;
  background: #fff7ed;
  border: 1px solid #fdba74;
}

.secret-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #9a3412;
}

.secret-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.prompt-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 14px 0 12px;
}

.hint {
  font-size: 12px;
  color: #b45309;

  &.ok {
    color: #047857;
  }
}

.key-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.key-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.key-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  strong {
    font-size: 13px;
  }

  code {
    font-size: 12px;
    color: #334155;
  }

  .time {
    font-size: 12px;
    color: #94a3b8;
  }
}

.empty {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}

.revoked {
  margin-top: 12px;
  font-size: 13px;
  color: #64748b;

  summary {
    cursor: pointer;
    user-select: none;
  }
}

.muted .key-item {
  opacity: 0.72;
}

.config {
  margin: 0;
  padding: 12px;
  overflow: auto;
  max-height: 220px;
  font-size: 12px;
  line-height: 1.45;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #0f172a;
  background: #0f172a0a;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  white-space: pre-wrap;
  word-break: break-word;

  &.prompt {
    max-height: 320px;
    margin-top: 4px;
  }
}

.tip ol {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.6;
  color: #475569;
}
</style>
