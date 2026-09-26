<template>
  <!--
    A form's save and cancel stay within reach while a long form scrolls: stuck to the bottom of
    the screen, above the phone's tab bar (which the desktop layout doesn't have).
  -->
  <div
    class="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[5] -mx-4 flex flex-wrap items-center justify-end gap-2 border-t-2 border-line/10 bg-paper/90 px-4 py-3 backdrop-blur lg:bottom-0"
  >
    <slot />
  </div>
</template>
