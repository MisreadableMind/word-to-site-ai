import { queryOptions } from "@tanstack/react-query";
import { recommendSkins } from "./wizardApi";
import type { InterviewAnswers, SkinRecommendation } from "./types";

export function skinRecommendQuery(answers: InterviewAnswers) {
  return queryOptions({
    queryKey: [
      "skins",
      "recommend",
      answers.companyName,
      answers.industry,
      answers.services,
      answers.aboutUs,
    ],
    queryFn: async (): Promise<SkinRecommendation[]> => {
      const res = await recommendSkins(answers);
      if (!res.success) throw new Error("recommend failed");
      return res.recommended;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
