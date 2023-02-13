<script setup lang="ts">
import { reactive, effect } from '../reactive/index'

let state = reactive({
  message: 'Hello world!',
})

effect(() => {
  console.log('=====', state.message)
})

setTimeout(() => {
  state.message = 'dsdasfdasdfasdf'
}, 1000)
</script>

<template>
  <div>
    <h1>自定义响应式系统测试</h1>
  </div>
</template>

<style scoped></style>
