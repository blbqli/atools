<template>
  <div
    v-html="content"
    class="container p-3"
  ></div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const content = ref<string>(`
<h2>About Us: ${useAppConfig().shortTitle}</h2>

<p>${
  useAppConfig().shortTitle
} is a one-stop resource hub dedicated to curating and connecting users with high-quality, practical ${
  useAppConfig().shortTitle
} from across the web. Our core mission is to simplify the process of finding reliable ${
  useAppConfig().shortTitle
}, making efficiency and productivity accessible to everyone—whether you’re navigating work tasks, academic pursuits, creative projects, or daily life needs.</p>

<p>We recognize that in today’s digital landscape, discovering ${
  useAppConfig().shortTitle
} that truly deliver on their promises can be time-consuming and overwhelming. Countless options exist, but separating the useful from the unnecessary often requires endless research and trial. That’s where we step in: our team meticulously vets and handpicks ${
  useAppConfig().shortTitle
} across a diverse range of categories, ensuring each recommended resource meets our standards for functionality, usability, and value.</p>

<h2>What We Offer</h2>

<p>As a curated toolbox of external links, we aggregate premium ${
  useAppConfig().shortTitle
} spanning key areas to cover your multifaceted needs:</p>

<ul>
  <li><strong>Productivity & Office Tools</strong>: Streamline document editing, project management, collaboration, and workflow automation—tools designed to cut down on tedious tasks and boost your output.</li>
  <li><strong>Creative & Design Tools</strong>: Unleash your creativity with user-friendly graphic design, video editing, photo enhancement, and content creation platforms that cater to both beginners and professionals.</li>
  <li><strong>Learning & Skill-Building</strong>: Access educational platforms, language learning ${
    useAppConfig().shortTitle
  }, coding resources, and knowledge-sharing hubs to foster continuous growth and skill development.</li>
  <li><strong>Data & Utility Tools</strong>: Simplify data analysis, file conversion, password management, and everyday utility tasks with intuitive, reliable ${
    useAppConfig().shortTitle
  } that solve specific problems efficiently.</li>
  <li><strong>Lifestyle & Convenience</strong>: Discover practical ${
    useAppConfig().shortTitle
  } for travel planning, budget tracking, health management, and other daily essentials that enhance your quality of life.</li>
</ul>

<p>We don’t develop ${
  useAppConfig().shortTitle
} ourselves—instead, we act as a trusted "curator" and "bridge" between users and the best-in-class resources available online. Our platform is designed to be clean, intuitive, and free of clutter: no unnecessary ads, no complicated sign-ups, just straightforward access to ${
  useAppConfig().shortTitle
} that matter.</p>

<p>Our commitment is to keep our toolbox dynamic and up-to-date. We regularly review and refresh our curated collection to remove outdated ${
  useAppConfig().shortTitle
}, add emerging gems, and ensure that every link leads to a resource that delivers real value. We believe that the right tool can transform how you work, learn, and live—and we’re here to make that discovery process seamless.</p>

<p>At ${
  useAppConfig().shortTitle
}, we’re passionate about empowering users through access to quality ${
  useAppConfig().shortTitle
}. Whether you’re a professional seeking to optimize workflows, a student looking to enhance learning, or someone simply wanting to make daily tasks easier, our curated collection has something for you. Explore, discover, and unlock new levels of efficiency—one tool at a time.</p>
`);

usePageSeo({
  canonicalPath: "/about/",
  title: `About Tools`,
  seoDescription: `Tools Curates Trusted Tools, Explains Our Review Process, And Shares How We Keep Recommendations Fresh.`,
  keywords: ["about", "tool curator"],
});
</script>

<style scoped>
.container * {
  all: revert;
}
</style>
