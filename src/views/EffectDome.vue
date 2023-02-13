<script setup lang="ts">
import { effect, ref } from 'vue'

let message = ref('Hello world!')

function updateMessage() {
  message.value = 'Message Updated'
}

function updateTime() {
  console.log(`Time: ${new Date().toLocaleTimeString()}`)
}

effect(() => {
  console.log(`Message, ${message.value}`)

  updateTime()
})
</script>

<template>
  <div>
    <h1>{{ message }}</h1>
    <button @click="updateMessage">更新数据</button>
  </div>
</template>

<style scoped></style>
