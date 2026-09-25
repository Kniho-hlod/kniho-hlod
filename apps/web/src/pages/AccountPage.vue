<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import InstallAppCard from '@/components/InstallAppCard.vue';
import AvatarCard from '@/features/account/AvatarCard.vue';
import ProfileCard from '@/features/account/ProfileCard.vue';
import PasswordCard from '@/features/account/PasswordCard.vue';
import DeleteAccountCard from '@/features/account/DeleteAccountCard.vue';

const { t } = useI18n();
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-2xl font-semibold text-highlighted">{{ t('account.title') }}</h1>

    <AvatarCard />
    <ProfileCard />
    <InstallAppCard />
    <PasswordCard />
    <DeleteAccountCard />
  </section>
</template>
