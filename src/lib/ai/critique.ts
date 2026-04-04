import { generateText, Output } from "ai";
import { z } from "zod";

const PROMPT_VERSION = "2026-04-01.v2";

const critiqueSchema = z.object({
  overall_verdict: z
    .string()
    .describe("Concise verdict on the submission quality and readiness."),
  thesis_strength: z
    .string()
    .describe("Assessment of the thesis or central claim's strength."),
  structural_failures: z
    .array(z.string())
    .describe("Structural breakdowns in argument, organization, or flow."),
  unsupported_claims: z
    .array(z.string())
    .describe("Claims lacking evidence or citation."),
  vague_terms: z
    .array(z.string())
    .describe("Terms or phrases that are vague or undefined."),
  strongest_objection: z
    .string()
    .describe("Most serious objection to the argument."),
  doctrinal_or_historical_imprecision: z
    .array(z.string())
    .describe("Doctrinal or historical inaccuracies or imprecision."),
  rewrite_priorities: z
    .array(z.string())
    .describe("Prioritized rewrite actions for the next draft."),
  score: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .describe("Overall score from 0-100, or null if not applicable."),
});

const assignmentTypeGuidance: Record<string, string> = {
  general:
    "Focus on clarity, intellectual rigor, and the assignment instructions.",
  essay:
    "Evaluate thesis clarity, argument structure, evidence quality, and style.",
  analysis:
    "Prioritize analytical depth, logical coherence, and interpretive precision.",
  exegesis:
    "Assess fidelity to the primary text, close-reading accuracy, and contextual grounding.",
  translation:
    "Assess semantic accuracy, tone, and consistency; note any interpretive drift.",
  problem_set:
    "Check correctness, method rigor, and clarity of reasoning or calculations.",
  presentation:
    "Evaluate organization, narrative arc, and alignment with audience expectations.",
  other:
    "Apply the assignment instructions strictly and note any unmet requirements.",
};

export type CritiqueResult = z.infer<typeof critiqueSchema>;

export async function generateCritique(input: {
  assignmentTitle: string;
  assignmentType?: string | null;
  instructions: string;
  submission: string;
}) {
  const model = process.env.AI_MODEL ?? "openai/gpt-5.4";
  const normalizedType = (input.assignmentType ?? "general")
    .toLowerCase()
    .replace(/\s+/g, "_");
  const typeGuidance =
    assignmentTypeGuidance[normalizedType] ?? assignmentTypeGuidance.general;

  const prompt = `You are a rigorous academic reviewer.

Assignment: ${input.assignmentTitle}
Assignment type: ${input.assignmentType ?? "general"}
Instructions: ${input.instructions}

Submission:
${input.submission}

Guidance: ${typeGuidance}

Return a critique as structured JSON following the schema. Be precise, cite concrete issues, and avoid filler.`;

  const { output } = await generateText({
    model,
    prompt,
    output: Output.object({
      schema: critiqueSchema,
      name: "critique",
      description:
        "Academic critique with verdict, thesis strength, structural failures, unsupported claims, vague terms, strongest objection, doctrinal or historical imprecision, rewrite priorities, and optional score.",
    }),
  });

  return { output, model, promptVersion: PROMPT_VERSION };
}
