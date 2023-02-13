<script setup lang="ts">
import { watchEffect } from 'vue'

let message = 'Hello world!'

watchEffect(() => {
  message = `${message} from effect`
})

watchEffect(() => {
  message = 'Hello Vue!'
})
</script>

<template>
  <div>
    <h1>{{ message }}</h1>
  </div>
</template>

<style scoped></style>
