import aiContentManifest from "./aiContentManifest.json";

export type HintType = "leaf" | "egg" | "fruit" | "footprint";
export type Operation = "add" | "subtract";
export type Difficulty = "sprout" | "helper" | "hero";
export type RescueLevel = "valley" | "nest" | "river";

export type AiVoiceClips = {
  read: string | null;
  hint: string | null;
  success: string | null;
};

export type Question = {
  id: string;
  level: RescueLevel;
  difficulty: Difficulty;
  operation: Operation;
  left: number;
  right: number;
  answer: number;
  prompt: string;
  promptText: string;
  dadHintText: string;
  successText: string;
  mission: string;
  hintType: HintType;
  options: number[];
  audio: AiVoiceClips;
};

type ManifestQuestion = Question;

export type Dino = {
  id: string;
  name: string;
  species: string;
  reward: string;
  position: string;
};

export const dinos: Dino[] = [
  {
    id: "rex",
    name: "小橙",
    species: "霸王龙",
    reward: "救援队徽章亮起来了！",
    position: "0% 0%",
  },
  {
    id: "trike",
    name: "蓝蓝",
    species: "三角龙",
    reward: "树叶补给车装满了！",
    position: "50% 0%",
  },
  {
    id: "brachio",
    name: "长脖",
    species: "腕龙",
    reward: "高高的瞭望塔修好了！",
    position: "100% 0%",
  },
  {
    id: "stego",
    name: "团团",
    species: "剑龙",
    reward: "恐龙蛋安全到家啦！",
    position: "25% 50%",
  },
  {
    id: "raptor",
    name: "紫点",
    species: "迅猛龙",
    reward: "小脚印路线找到了！",
    position: "75% 50%",
  },
];

const manifestQuestions = aiContentManifest.questions as ManifestQuestion[];

const shuffle = <T,>(items: T[]) =>
  [...items].sort(() => Math.random() - 0.5);

const cloneQuestion = (question: ManifestQuestion): Question => ({
  ...question,
  options: shuffle(question.options),
  audio: { ...question.audio },
});

export const makeQuestion = (
  index: number,
  difficulty: Difficulty = "helper",
  level: RescueLevel = "valley",
): Question => {
  const pool = manifestQuestions.filter(
    (question) => question.level === level && question.difficulty === difficulty,
  );
  const source = pool[index % pool.length] ?? manifestQuestions[index % manifestQuestions.length];
  return cloneQuestion(source);
};

export const makeRound = (
  count = 5,
  difficulty: Difficulty = "helper",
  level: RescueLevel = "valley",
) => {
  const pool = manifestQuestions.filter(
    (question) => question.level === level && question.difficulty === difficulty,
  );
  const selectedPool = pool.length >= count ? pool : manifestQuestions;
  return shuffle(selectedPool).slice(0, count).map(cloneQuestion);
};

export const pickUnlockedDino = (roundNumber: number, unlockedIds: string[]) => {
  const locked = dinos.find((dino) => !unlockedIds.includes(dino.id));
  return locked ?? dinos[roundNumber % dinos.length];
};
