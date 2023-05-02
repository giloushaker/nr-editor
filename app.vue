<template>
  <div>{{ val }}</div>
</template>

<script>
import { rpc } from "@/assets/ts/rpc";

export default defineComponent({
  data() {
    return {
      val: "",
    };
  },

  async setup() {
    const session = await useSession();
    return {
      session,
    };
  },

  async created() {
    this.session.update({
      hello: "session",
      test: 1234,
      userLikesCookies: true,
    });
    let test = await rpc("test");
    this.val = test;
    console.log(test);
  },
});
</script>
