<script setup lang="ts">
import { reactive, effect } from 'vue'

let state = reactive({
  message: 'Hello world!',
})

effect(() => {
  console.log('=====', state.message)
})

setInterval(() => {
  state.message = 'dsdasfdasdfasdf'
}, 1000)
</script>

<template>
  <div>
    <h1>Vue响应式系统</h1>
  </div>
</template>

<style scoped></style>
