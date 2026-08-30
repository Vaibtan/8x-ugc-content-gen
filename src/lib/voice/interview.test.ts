import { describe, expect, it } from "vitest";

import {
  INTERVIEW_QUESTION_COUNT,
  nextInterviewQuestion,
  type InterviewAnswer,
} from "@/lib/voice/interview";

const answers: ReadonlyArray<InterviewAnswer> = [
  {
    questionId: "offer",
    question: "What do you sell?",
    answer: "We help B2B founders turn their expertise into qualified demand.",
  },
  {
    questionId: "buyer",
    question: "Who buys it?",
    answer: "Technical founders after their first few customers arrive.",
  },
];

describe("nextInterviewQuestion", () => {
  it("adapts each bounded follow-up to the interview evidence already supplied", () => {
    expect(nextInterviewQuestion([])).toMatchObject({ id: "offer" });
    expect(nextInterviewQuestion(answers.slice(0, 1))).toMatchObject({
      id: "buyer",
      prompt: expect.stringContaining("qualified demand"),
    });
    expect(nextInterviewQuestion(answers)).toMatchObject({
      id: "why",
      prompt: expect.stringContaining("Technical founders"),
    });
  });

  it("ends after the five required founder-context questions", () => {
    const completed = Array.from({ length: INTERVIEW_QUESTION_COUNT }, (_, i) => ({
      questionId: `answer-${i}`,
      question: "Question",
      answer: "Answer",
    }));

    expect(nextInterviewQuestion(completed)).toBeNull();
  });
});
