export type HintType = "leaf" | "egg" | "fruit" | "footprint";
export type Operation = "add" | "subtract";
export type Difficulty = "sprout" | "helper" | "hero";
export type RescueLevel = "valley" | "nest" | "river";

export type Question = {
  id: string;
  operation: Operation;
  left: number;
  right: number;
  answer: number;
  prompt: string;
  mission: string;
  hintType: HintType;
  options: number[];
};

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

const addStories = [
  {
    mission: "喂饱小伙伴",
    prompt: (a: number, b: number) =>
      `蓝蓝先找到 ${a} 片嫩叶，救援队又送来 ${b} 片。蓝蓝一共有几片嫩叶？`,
    hintType: "leaf" as const,
  },
  {
    mission: "装满水果篮",
    prompt: (a: number, b: number) =>
      `小橙的篮子里有 ${a} 个果子，长脖又摘来 ${b} 个。篮子里现在有几个果子？`,
    hintType: "fruit" as const,
  },
  {
    mission: "找到脚印路",
    prompt: (a: number, b: number) =>
      `紫点发现 ${a} 个小脚印，草丛边又有 ${b} 个。救援队一共看见几个脚印？`,
    hintType: "footprint" as const,
  },
];

const subtractStories = [
  {
    mission: "送回恐龙蛋",
    prompt: (a: number, b: number) =>
      `窝里有 ${a} 颗恐龙蛋，团团把 ${b} 颗送回暖暖窝。窝里还剩几颗蛋？`,
    hintType: "egg" as const,
  },
  {
    mission: "分享嫩叶",
    prompt: (a: number, b: number) =>
      `长脖有 ${a} 片树叶，分给宝宝 ${b} 片。长脖还剩几片树叶？`,
    hintType: "leaf" as const,
  },
  {
    mission: "整理补给",
    prompt: (a: number, b: number) =>
      `救援篮里有 ${a} 个果子，小队吃掉 ${b} 个。篮子里还剩几个果子？`,
    hintType: "fruit" as const,
  },
];

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const shuffle = <T,>(items: T[]) =>
  [...items].sort(() => Math.random() - 0.5);

const makeOptions = (answer: number) => {
  const guesses = new Set<number>([answer]);
  const offsets = shuffle([-3, -2, -1, 1, 2, 3, 4, -4]);

  for (const offset of offsets) {
    const next = answer + offset;
    if (next >= 1 && next <= 20) {
      guesses.add(next);
    }
    if (guesses.size === 3) break;
  }

  while (guesses.size < 3) {
    guesses.add(randomInt(1, 20));
  }

  return shuffle([...guesses]);
};

const difficultyMax: Record<Difficulty, number> = {
  sprout: 10,
  helper: 15,
  hero: 20,
};

const subtractChance: Record<Difficulty, number> = {
  sprout: 0.24,
  helper: 0.42,
  hero: 0.55,
};

const levelBias: Record<RescueLevel, HintType> = {
  valley: "leaf",
  nest: "egg",
  river: "fruit",
};

const pickStory = <T extends { hintType: HintType }>(
  stories: T[],
  level: RescueLevel,
) => {
  const preferred = stories.filter(
    (story) => story.hintType === levelBias[level],
  );
  const pool = preferred.length > 0 && Math.random() > 0.25 ? preferred : stories;
  return pool[randomInt(0, pool.length - 1)];
};

export const makeQuestion = (
  index: number,
  difficulty: Difficulty = "helper",
  level: RescueLevel = "valley",
): Question => {
  const max = difficultyMax[difficulty];
  const operation: Operation =
    Math.random() > subtractChance[difficulty] ? "add" : "subtract";

  if (operation === "add") {
    const left = randomInt(1, Math.max(1, max - 3));
    const right = randomInt(1, max - left);
    const story = pickStory(addStories, level);
    const answer = left + right;

    return {
      id: `q-${Date.now()}-${index}`,
      operation,
      left,
      right,
      answer,
      prompt: story.prompt(left, right),
      mission: story.mission,
      hintType: story.hintType,
      options: makeOptions(answer),
    };
  }

  const left = randomInt(2, max);
  const right = randomInt(1, left - 1);
  const story = pickStory(subtractStories, level);
  const answer = left - right;

  return {
    id: `q-${Date.now()}-${index}`,
    operation,
    left,
    right,
    answer,
    prompt: story.prompt(left, right),
    mission: story.mission,
    hintType: story.hintType,
    options: makeOptions(answer),
  };
};

export const makeRound = (
  count = 5,
  difficulty: Difficulty = "helper",
  level: RescueLevel = "valley",
) =>
  Array.from({ length: count }, (_, index) =>
    makeQuestion(index, difficulty, level),
  );

export const pickUnlockedDino = (roundNumber: number, unlockedIds: string[]) => {
  const locked = dinos.find((dino) => !unlockedIds.includes(dino.id));
  return locked ?? dinos[roundNumber % dinos.length];
};
