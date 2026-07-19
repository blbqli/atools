import type { NuxtConfig, NuxtOptions } from "nuxt/schema";

type ExperimentalConfig = NonNullable<NuxtConfig["experimental"]>;
type ExperimentalOptions = NonNullable<NuxtOptions["experimental"]>;

declare module "nuxt/schema" {
  interface NuxtConfig {
    experimental?: Partial<ExperimentalConfig> & {
      inlineSSRStyles?: boolean;
    };
  }

  interface NuxtOptions {
    experimental?: Partial<ExperimentalOptions> & {
      inlineSSRStyles?: boolean;
    };
  }
}
