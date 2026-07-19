<template>
  <div
    v-html="content"
    class="container p-3"
  ></div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const content = ref<string>(`<h2><strong>Privacy Policy for ${
  useAppConfig().shortTitle
}</strong></h2>

<p>Last Updated: November 29, 2025</p>

<h2>1. Introduction</h2>

<p>Welcome to ${
  useAppConfig().shortTitle
} (&quot;we&quot;, &quot;our&quot;, or &quot;the Service&quot;). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related services (collectively, the &quot;Service&quot;).</p>

<p>By accessing or using the Service, you acknowledge that you have read, understood, and agree to the terms of this Privacy Policy. If you do not agree with this Privacy Policy, please do not use the Service.</p>

<h2>2. Information We Collect</h2>

<h3>2.1 Personal Information</h3>

<p>Personal Information refers to information that can be used to identify you as an individual. We may collect the following Personal Information when you use the Service:</p>

<ul>
	<li>Account information (e.g., username, email address, password)</li>
	<li>Profile information (e.g., name, profile picture, contact details)</li>
	<li>Payment information (if applicable, e.g., credit card details, billing address) &ndash; processed through third-party payment processors</li>
</ul>

<h3>2.2 Non-Personal Information</h3>

<p>Non-Personal Information refers to information that cannot be used to identify you individually. We may collect the following Non-Personal Information automatically when you use the Service:</p>

<ul>
	<li>Device information (e.g., device model, operating system, unique device identifiers)</li>
	<li>Usage data (e.g., features used, time spent on the Service, interaction history)</li>
	<li>Log data (e.g., IP address, browser type, access times, pages visited)</li>
	<li>Location information (if you enable location services, only with your explicit consent)</li>
</ul>

<h2>3. How We Use Your Information</h2>

<p>We use the collected information for the following purposes:</p>

<ul>
	<li>To provide, maintain, and improve the Service</li>
	<li>To personalize your experience (e.g., tailor features and content to your preferences)</li>
	<li>To process transactions and provide customer support</li>
	<li>To communicate with you (e.g., send updates, notifications, and service-related messages)</li>
	<li>To monitor and analyze usage patterns and trends to enhance the Service</li>
	<li>To detect, prevent, and address technical issues, fraud, or other illegal activities</li>
</ul>

<h2>4. Information Disclosure</h2>

<p>We will not disclose your Personal Information to third parties except in the following circumstances:</p>

<ul>
	<li>With your explicit consent</li>
	<li>To third-party service providers who assist us in operating the Service (e.g., payment processors, cloud storage providers, analytics ${
    useAppConfig().shortTitle
  }) &ndash; these providers are obligated to protect your information</li>
	<li>To comply with legal obligations (e.g., respond to subpoenas, court orders, or legal requests)</li>
	<li>To protect the rights, property, or safety of us, our users, or others</li>
	<li>In connection with a merger, acquisition, or sale of all or part of our assets &ndash; in such cases, we will notify you before your Personal Information is transferred</li>
</ul>

<h2>5. Data Security</h2>

<p>We implement reasonable technical and organizational measures to protect your information from unauthorized access, disclosure, alteration, or destruction. These measures include:</p>

<ul>
	<li>Encryption of sensitive data (both in transit and at rest)</li>
	<li>Secure authentication protocols</li>
	<li>Regular security audits and updates</li>
	<li>Restricted access to Personal Information within our organization</li>
</ul>

<p>While we strive to protect your information, no security system is completely impenetrable. You acknowledge that you provide your information at your own risk.</p>

<h2>6. Your Rights and Choices</h2>

<p>You have the following rights regarding your Personal Information:</p>

<ul>
	<li>Access: Request a copy of the Personal Information we hold about you</li>
	<li>Correction: Request correction of inaccurate or incomplete Personal Information</li>
	<li>Deletion: Request deletion of your Personal Information (subject to legal obligations)</li>
	<li>Opt-out: Unsubscribe from marketing communications or disable location services</li>
	<li>Data portability: Request transfer of your Personal Information to another service provider (where applicable)</li>
</ul>

<p>To exercise these rights, please contact us using the information provided in Section 10.</p>

<h2>7. Children&#39;s Privacy</h2>

<p>The Service is not intended for use by children under the age of 13. We do not knowingly collect Personal Information from children under 13. If we become aware that we have collected Personal Information from a child under 13 without parental consent, we will take steps to delete such information promptly. If you are a parent or guardian and believe your child has provided us with Personal Information, please contact us.</p>

<h2>8. Third-Party Links and Services</h2>

<p>The Service may contain links to third-party websites or services. This Privacy Policy does not apply to such third parties. We are not responsible for the privacy practices or content of these third parties. We encourage you to review the privacy policies of any third-party services you access.</p>

<h2>9. Changes to This Privacy Policy</h2>

<p>We may update this Privacy Policy from time to time. When we do, we will revise the &quot;Last Updated&quot; date at the top of this page. We encourage you to review this Privacy Policy periodically. Your continued use of the Service after the updated Privacy Policy is posted constitutes your acceptance of the changes.</p>
`);

usePageSeo({
  canonicalPath: "/privacy/",
  title: `Tools Privacy Policy`,
  seoDescription: `Learn How Tools Collect Analytics Data, Handles Outbound Links, And Keeps Users Informed.`,
  keywords: ["privacy policy", "data usage"],
});
</script>

<style scoped>
.container * {
  all: revert;
}
</style>
