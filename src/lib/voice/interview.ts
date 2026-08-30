export type InterviewAnswer = Readonly<{
  questionId: string;
  question: string;
  answer: string;
}>;

export type InterviewQuestion = Readonly<{
  id: string;
  prompt: string;
  helper: string;
}>;

const excerpt = (answer: string | undefined) => {
  const normalized = answer?.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  return normalized.length > 88
    ? `${normalized.slice(0, 85).trimEnd()}…`
    : normalized;
};

const answerFor = (answers: ReadonlyArray<InterviewAnswer>, id: string) =>
  answers.find((answer) => answer.questionId === id)?.answer;

/**
 * A bounded interview that uses prior answers to shape each next question.
 * It keeps the five pieces of founder context required for profile generation
 * without inventing an unbounded LLM-guided questionnaire in the browser.
 */
export const nextInterviewQuestion = (
  answers: ReadonlyArray<InterviewAnswer>,
): InterviewQuestion | null => {
  switch (answers.length) {
    case 0:
      return {
        id: "offer",
        prompt: "What do you sell?",
        helper: "Name the outcome, not just the category.",
      };
    case 1: {
      const offer = excerpt(answerFor(answers, "offer"));
      return {
        id: "buyer",
        prompt: offer
          ? `You said “${offer}.” Who buys it, and when do they look for it?`
          : "Who buys it, and when do they look for it?",
        helper: "Think role, trigger, and the job they need done.",
      };
    }
    case 2: {
      const buyer = excerpt(answerFor(answers, "buyer"));
      return {
        id: "why",
        prompt: buyer
          ? `Why did you choose to solve this problem for ${buyer}?`
          : "Why did you choose this problem?",
        helper: "A concrete moment is more useful than a polished origin story.",
      };
    }
    case 3: {
      const offer = excerpt(answerFor(answers, "offer"));
      return {
        id: "belief",
        prompt: offer
          ? `What do you believe about ${offer} that most people in your space miss?`
          : "What do you believe that most people in your space miss?",
        helper: "Your useful contrarian view often becomes your strongest content.",
      };
    }
    case 4: {
      const buyer = excerpt(answerFor(answers, "buyer"));
      return {
        id: "story",
        prompt: buyer
          ? `Tell one customer story or hard-earned lesson from working with ${buyer}.`
          : "Tell one customer story or hard-earned lesson.",
        helper: "What changed before and after? Keep the details real.",
      };
    }
    default:
      return null;
  }
};

export const INTERVIEW_QUESTION_COUNT = 5;
