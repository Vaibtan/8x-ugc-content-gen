import { inngest } from "@/inngest/client";
import {
  generateContentPack,
  type ContentPackInput,
} from "@/lib/content-pack/service";
import { runApp } from "@/lib/runtime";

type ContentPackRequestedEvent = Readonly<{
  name: "content-pack/generate.requested";
  data: ContentPackInput;
}>;

/**
 * A rerun after a worker restart calls the same idempotent use case. The pack
 * row and job keys prevent duplicate content and media work, while Inngest
 * supplies the durable hand-off from the mobile request to the worker.
 */
export const generateContentPackFunction = inngest.createFunction(
  {
    id: "generate-content-pack",
    retries: 0,
  },
  { event: "content-pack/generate.requested" },
  async ({ event, step }) => {
    const contentEvent = event as ContentPackRequestedEvent;
    return step.run("generate-pack-text", () =>
      runApp(generateContentPack(contentEvent.data)),
    );
  },
);

export const inngestFunctions = [generateContentPackFunction];
