<template>
  <div class="titlebar">
    <div class="titlebar-content titlebar-left" id="titlebar-content">
      <NuxtLink :to="{ name: 'index' }" class="link">
        <h1>NR-Editor</h1>
      </NuxtLink>
      <slot />
    </div>
    <div class="titlebar-content titlebar-right" id="titlebar-content-right">
      <div class="flex flex-col" @click="bug = true">
        <img src="assets/icons/bug.png" class="icon" />
        <span class="icontext">Bug</span>
      </div>
      <div class="flex flex-col" @click="feedback = true">
        <img src="assets/icons/feedback.png" class="icon" />
        <span class="icontext">Feedback</span>
      </div>
      <PopupDialog
        v-if="bug"
        :disabled="!can_submit_bug"
        v-model="bug"
        button="Submit"
        @button="submit_bug"
      >
        <div class="m-20px">
          <h2 class="text-center">Bug Report form</h2>
          <label for="contact">Contact:</label>
          <div>
            <input type="text" id="contact" v-model="contact" />
          </div>
          <label for="text1"
            >What happened
            <span class="gray">(include the steps to reproduce)</span>:*</label
          >
          <textarea
            required
            class="w-full textbox"
            type="text"
            id="text1"
            v-model="text1"
          />

          <label for="text2">What did you expect to happen:*</label>
          <textarea
            required
            class="w-full mt-1px textbox"
            type="text"
            id="text2"
            v-model="text2"
          />
        </div>
      </PopupDialog>
      <PopupDialog
        v-if="feedback"
        :disabled="!can_submit_feedback"
        v-model="feedback"
        button="Submit"
        @button="submit_feedback"
      >
        <div class="m-20px">
          <h2 class="text-center">Feedback form</h2>
          <label for="contact">Contact:</label>
          <div>
            <input type="text" id="contact" v-model="contact" />
          </div>
          <label for="text">
            Do you have any suggestions to improve NewRecruit ?:*
          </label>
          <textarea
            required
            class="w-full mt-1px textbox"
            type="text"
            id="text"
            v-model="text"
          />
        </div>
      </PopupDialog>
    </div>
  </div>
</template>
<script lang="ts">
export default {
  data() {
    return {
      bug: false,
      feedback: false,
      contact: "",
      text: "",
      text1: "",
      text2: "",
    };
  },
  computed: {
    can_submit_bug() {
      return this.text1 && this.text2;
    },
    can_submit_feedback() {
      return this.text;
    },
  },
  methods: {
    submit_bug() {
      const data = {
        contact: this.contact,
        happened: this.text1,
        expected: this.text2,
        type: "bug",
      };
      fetch("https://newrecruit.eu/api/feedback/post", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
    submit_feedback() {
      const data = {
        contact: this.contact,
        content: this.text,
        type: "suggestion",
      };
      fetch("https://newrecruit.eu/api/feedback/post", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
  },
};
</script>
<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";
.titlebar {
  display: flex;
  width: 100%;
  height: 50px;
  background-color: slategray;
  color: #fff;
  padding: 8px;
  box-sizing: border-box;
  z-index: 2;
}
.titlebar-left {
  height: 100%;
  display: flex;
  align-items: center;
}
.titlebar-right {
  height: 100%;
  display: flex;
  align-items: center;
  margin-left: auto;
  flex-direction: row-reverse;
}
.titlebar-content > * {
  margin: 4px;
}

.link {
  color: rgba(200, 200, 200);
  text-decoration: none;
}

.icon {
  margin: auto;
  padding: 4px;
}
.icontext {
  font-size: smaller;
  text-align: center;
}
.icon:hover {
  cursor: pointer;
  background-color: rgba(255, 255, 255, 0.2);
}

.textbox {
  height: 150px;
}
</style>
