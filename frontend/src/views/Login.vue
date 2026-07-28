<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { useUserStore } from '/@/stores/user';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const isRegister = ref(false);
const isLoading = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  email: '',
  username: '',
  password: '',
  display_name: '',
});

const rules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 32, message: '用户名 3-32 字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
};

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    isLoading.value = true;
    try {
      if (isRegister.value) {
        await userStore.register({
          email: form.email,
          username: form.username,
          password: form.password,
          display_name: form.display_name || form.username,
        });
        ElMessage.success('注册成功');
      } else {
        await userStore.login({ email: form.email, password: form.password });
        ElMessage.success('登录成功');
      }
      const redirect = (route.query.redirect as string) || '/';
      router.replace(redirect);
    } catch {
      // error handled by interceptor
    } finally {
      isLoading.value = false;
    }
  });
}
</script>

<template>
  <div class="login-page">
    <div class="login-panel">
      <div class="brand">
        <div class="brand-mark">CV</div>
        <h1>CV Builder</h1>
        <p>模块化简历编辑 · 模板可扩展 · 桌面端优先</p>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="handleSubmit">
        <el-form-item prop="email">
          <el-input v-model="form.email" placeholder="邮箱" prefix-icon="Message" />
        </el-form-item>

        <el-form-item v-if="isRegister" prop="username">
          <el-input v-model="form.username" placeholder="用户名" prefix-icon="User" />
        </el-form-item>

        <el-form-item v-if="isRegister">
          <el-input v-model="form.display_name" placeholder="显示名称（可选）" prefix-icon="EditPen" />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            prefix-icon="Lock"
            show-password
            @keyup.enter="handleSubmit"
          />
        </el-form-item>

        <el-button type="primary" class="submit-btn" :loading="isLoading" @click="handleSubmit">
          {{ isRegister ? '注册' : '登录' }}
        </el-button>
      </el-form>

      <div class="switch">
        <span>{{ isRegister ? '已有账号？' : '还没有账号？' }}</span>
        <button type="button" @click="isRegister = !isRegister">
          {{ isRegister ? '去登录' : '去注册' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.login-page {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.login-panel {
  width: 100%;
  max-width: 420px;
  background: var(--cv-surface);
  border: 1px solid var(--cv-border);
  border-radius: 16px;
  box-shadow: var(--cv-shadow);
  padding: 40px 36px 32px;
}

.brand {
  text-align: center;
  margin-bottom: 32px;

  .brand-mark {
    width: 56px;
    height: 56px;
    margin: 0 auto 16px;
    border-radius: 14px;
    background: linear-gradient(135deg, #2563eb, #0ea5e9);
    color: white;
    font-weight: 700;
    font-size: 22px;
    display: grid;
    place-items: center;
  }

  h1 {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 8px;
  }

  p {
    color: var(--cv-muted);
    font-size: 14px;
    line-height: 1.5;
  }
}

.submit-btn {
  width: 100%;
  margin-top: 8px;
}

.switch {
  margin-top: 20px;
  text-align: center;
  font-size: 14px;
  color: var(--cv-muted);

  button {
    border: none;
    background: none;
    color: var(--cv-primary);
    cursor: pointer;
    margin-left: 4px;
    font-size: 14px;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
