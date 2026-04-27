import { mkdir, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const CHILD_NAME = "小宝";
const MANIFEST_PATH = new URL("../src/aiContentManifest.json", import.meta.url);
const AUDIO_DIR = new URL("../public/ai-audio/", import.meta.url);

const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? "gpt-4.1-mini";
const TTS_MODEL = process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";
const TTS_VOICE = process.env.OPENAI_TTS_VOICE ?? "cedar";
const API_KEY = process.env.OPENAI_API_KEY;

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.split("=");
    return [key.replace(/^--/, ""), value];
  }),
);

const limit = args.has("limit") ? Number(args.get("limit")) : null;
const textOnly = args.has("text-only");
const provider = args.get("provider") ?? (API_KEY ? "openai" : "fallback");
const fallbackOnly = args.has("fallback-only") || provider === "fallback";
const useOpenAiText = provider === "openai" && Boolean(API_KEY);
const useOpenAiAudio = provider === "openai" && Boolean(API_KEY) && !textOnly;
const useEdgeAudio = provider === "edge" && !textOnly;
const shouldGenerateAudio = useOpenAiAudio || useEdgeAudio;
const EDGE_READ_VOICE = process.env.EDGE_TTS_READ_VOICE ?? "zh-CN-XiaoyiNeural";
const EDGE_DAD_VOICE = process.env.EDGE_TTS_DAD_VOICE ?? "zh-CN-YunxiNeural";

const levels = ["valley", "nest", "river"];
const difficulties = ["sprout", "helper", "hero"];

const difficultyPairs = {
  sprout: [
    ["add", 2, 3],
    ["add", 4, 5],
    ["add", 6, 3],
    ["add", 1, 8],
    ["add", 7, 2],
    ["subtract", 9, 4],
    ["subtract", 8, 3],
    ["subtract", 10, 6],
  ],
  helper: [
    ["add", 8, 5],
    ["add", 7, 6],
    ["add", 9, 4],
    ["add", 6, 8],
    ["subtract", 14, 5],
    ["subtract", 13, 6],
    ["subtract", 15, 8],
    ["subtract", 12, 7],
  ],
  hero: [
    ["add", 9, 8],
    ["add", 12, 6],
    ["add", 7, 13],
    ["add", 11, 8],
    ["subtract", 20, 7],
    ["subtract", 18, 9],
    ["subtract", 16, 8],
    ["subtract", 15, 6],
  ],
};

const levelStories = {
  valley: {
    add: [
      {
        mission: "喂饱小伙伴",
        hintType: "leaf",
        itemName: "树叶",
        story: (a, b) =>
          `蓝蓝先找到 ${a} 片嫩叶，救援队又送来 ${b} 片。蓝蓝一共有几片嫩叶？`,
      },
      {
        mission: "找到脚印路",
        hintType: "footprint",
        itemName: "脚印",
        story: (a, b) =>
          `紫点发现 ${a} 个小脚印，草丛边又有 ${b} 个。救援队一共看见几个脚印？`,
      },
    ],
    subtract: [
      {
        mission: "分享嫩叶",
        hintType: "leaf",
        itemName: "树叶",
        story: (a, b) =>
          `长脖有 ${a} 片树叶，分给宝宝 ${b} 片。长脖还剩几片树叶？`,
      },
      {
        mission: "确认路线",
        hintType: "footprint",
        itemName: "脚印",
        story: (a, b) =>
          `泥地上有 ${a} 个脚印，风吹淡了 ${b} 个。小队还能看到几个脚印？`,
      },
    ],
  },
  nest: {
    add: [
      {
        mission: "保护蛋窝",
        hintType: "egg",
        itemName: "恐龙蛋",
        story: (a, b) =>
          `暖暖窝里有 ${a} 颗恐龙蛋，爸爸救援队又送回 ${b} 颗。窝里一共有几颗蛋？`,
      },
      {
        mission: "补充嫩叶",
        hintType: "leaf",
        itemName: "树叶",
        story: (a, b) =>
          `蛋窝旁边有 ${a} 片软树叶，团团又铺上 ${b} 片。现在有几片树叶？`,
      },
    ],
    subtract: [
      {
        mission: "送回恐龙蛋",
        hintType: "egg",
        itemName: "恐龙蛋",
        story: (a, b) =>
          `窝里有 ${a} 颗恐龙蛋，团团把 ${b} 颗送回暖暖窝。窝里还剩几颗蛋？`,
      },
      {
        mission: "整理蛋窝",
        hintType: "leaf",
        itemName: "树叶",
        story: (a, b) =>
          `蛋窝里铺了 ${a} 片树叶，小队拿走 ${b} 片去盖小蛋。蛋窝还剩几片树叶？`,
      },
    ],
  },
  river: {
    add: [
      {
        mission: "装满水果篮",
        hintType: "fruit",
        itemName: "果子",
        story: (a, b) =>
          `小橙的篮子里有 ${a} 个果子，长脖又摘来 ${b} 个。篮子里现在有几个果子？`,
      },
      {
        mission: "河边找脚印",
        hintType: "footprint",
        itemName: "脚印",
        story: (a, b) =>
          `河边沙地有 ${a} 个脚印，石头后面又发现 ${b} 个。小队一共找到几个脚印？`,
      },
    ],
    subtract: [
      {
        mission: "整理补给",
        hintType: "fruit",
        itemName: "果子",
        story: (a, b) =>
          `救援篮里有 ${a} 个果子，小队吃掉 ${b} 个。篮子里还剩几个果子？`,
      },
      {
        mission: "分水果",
        hintType: "fruit",
        itemName: "果子",
        story: (a, b) =>
          `河边补给站有 ${a} 个果子，送给小恐龙 ${b} 个。补给站还剩几个果子？`,
      },
    ],
  },
};

const itemNameByHint = {
  egg: "恐龙蛋",
  footprint: "脚印",
  fruit: "果子",
  leaf: "树叶",
};

const itemUnitByHint = {
  egg: "颗恐龙蛋",
  footprint: "个脚印",
  fruit: "个果子",
  leaf: "片树叶",
};

const successLines = [
  "小宝答对啦！小恐龙站起来挥挥手，救援队继续前进。",
  "小宝真棒！补给送到了，小恐龙的眼睛亮起来啦。",
  "答对啦小宝！恐龙宝宝开心地跳了一下。",
  "小宝救援成功！爸爸给你一颗亮亮星。",
  "太好了小宝！小恐龙有力气跟着队伍走啦。",
  "小宝选对了！救援徽章闪闪发光。",
  "答对啦！爸爸看到小宝数得很认真。",
  "小宝真厉害！恐龙朋友离安全营地更近啦。",
];

const makeOptions = (answer, index) => {
  const guesses = new Set([answer]);
  const offsets = index % 2 === 0 ? [-1, 1, 2, -2, 3, -3, 4, -4] : [1, -1, -2, 2, -3, 3, -4, 4];

  for (const offset of offsets) {
    const next = answer + offset;
    if (next >= 1 && next <= 20) guesses.add(next);
    if (guesses.size === 3) break;
  }

  for (let candidate = 1; guesses.size < 3 && candidate <= 20; candidate += 1) {
    guesses.add(candidate);
  }

  return [...guesses].sort((a, b) => a - b);
};

const makeMathHint = ({ operation, left, right, answer, itemUnit }) => {
  if (operation === "add") {
    const needToTen = 10 - left;
    if (needToTen > 0 && right >= needToTen) {
      const rest = right - needToTen;
      return `${left} 差 ${needToTen} 个到十。可以把 ${right} ${itemUnit}分成 ${needToTen} 个和 ${rest} 个，先凑成十，再加 ${rest}，就是 ${answer}。`;
    }

    const otherNeedToTen = 10 - right;
    if (otherNeedToTen > 0 && left >= otherNeedToTen) {
      const rest = left - otherNeedToTen;
      return `${right} 差 ${otherNeedToTen} 个到十。可以从 ${left} ${itemUnit}里拿 ${otherNeedToTen} 个过去，先凑成十，再加 ${rest}，就是 ${answer}。`;
    }

    return `先看 ${left} ${itemUnit}，再接着数 ${right} 个。每五个放一小堆，数起来更清楚，答案就是 ${answer}。`;
  }

  if (left > 10) {
    const ones = left - 10;
    if (right <= ones) {
      return `${left} 可以看成十和 ${ones}。先从小尾巴里拿走 ${right} 个，还剩 ${answer}。`;
    }

    const fromTen = right - ones;
    return `${left} 可以看成十和 ${ones}。先拿走小尾巴 ${ones} 个，还要从十里面再拿 ${fromTen} 个，所以剩 ${answer}。`;
  }

  return `先摆好 ${left} ${itemUnit}，再轻轻拿走 ${right} 个。留下来的就是 ${answer}。`;
};

const makeFallbackText = (seed, index) => ({
  promptText: `${CHILD_NAME}，爸爸来读救援任务。${seed.prompt} 你来选一个数字吧。`,
  dadHintText: `${CHILD_NAME}，爸爸陪你慢慢看。${seed.mathHint}`,
  successText: successLines[index % successLines.length],
});

const makeSeed = (level, difficulty, rawPair, index) => {
  const [operation, left, right] = rawPair;
  const answer = operation === "add" ? left + right : left - right;
  const templates = levelStories[level][operation];
  const template = templates[index % templates.length];
  const id = `${level}-${difficulty}-${String(index + 1).padStart(2, "0")}`;
  const prompt = template.story(left, right);
  const itemName = template.itemName ?? itemNameByHint[template.hintType];
  const itemUnit = itemUnitByHint[template.hintType];
  const mathHint = makeMathHint({ operation, left, right, answer, itemUnit });

  return {
    id,
    level,
    difficulty,
    operation,
    left,
    right,
    answer,
    prompt,
    mission: template.mission,
    hintType: template.hintType,
    itemName,
    itemUnit,
    mathHint,
    options: makeOptions(answer, index),
  };
};

const makeSeeds = () =>
  levels.flatMap((level) =>
    difficulties.flatMap((difficulty) =>
      difficultyPairs[difficulty].map((pair, index) =>
        makeSeed(level, difficulty, pair, index),
      ),
    ),
  );

const extractResponseText = (json) => {
  if (typeof json.output_text === "string") return json.output_text;

  for (const item of json.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") return content.text;
    }
  }

  throw new Error("OpenAI response did not include text output.");
};

const generateText = async (seed) => {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      input: [
        {
          role: "system",
          content:
            "你是儿童数学游戏的中文陪玩文案老师。给五岁半孩子写短句，温柔、鼓励、像爸爸在旁边陪玩。必须保留题目的数字、答案和数学逻辑，不能改题，不能引入新数字。",
        },
        {
          role: "user",
          content: JSON.stringify({
            childName: CHILD_NAME,
            story: seed.prompt,
            operation: seed.operation,
            left: seed.left,
            right: seed.right,
            answer: seed.answer,
            itemName: seed.itemName,
            itemUnit: seed.itemUnit,
            deterministicMathHint: seed.mathHint,
            requirements: [
              "promptText 直接叫小宝，并自然读出救援任务，最后问选哪个数字。",
              "dadHintText 直接叫小宝，必须使用 deterministicMathHint 的数学解释，可以改写得更像爸爸，但不能改变算式。",
              "successText 直接叫小宝，答对后鼓励，不超过 28 个汉字。",
            ],
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "dino_voice_content",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["promptText", "dadHintText", "successText"],
            properties: {
              promptText: { type: "string" },
              dadHintText: { type: "string" },
              successText: { type: "string" },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Text generation failed: ${response.status} ${await response.text()}`);
  }

  return JSON.parse(extractResponseText(await response.json()));
};

const generateSpeech = async (text, fileUrl) => {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: text,
      instructions:
        "温柔、自然、像爸爸陪五岁半孩子玩恐龙救援数学游戏。中文普通话，语速稍慢，带一点笑意，句子之间有轻柔停顿。",
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    throw new Error(`Speech generation failed: ${response.status} ${await response.text()}`);
  }

  await writeFile(fileUrl, Buffer.from(await response.arrayBuffer()));
};

const run = (command, commandArgs) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });

const hasAudioFile = async (fileUrl) => {
  try {
    const stats = await stat(fileUrl);
    return stats.size > 1024;
  } catch {
    return false;
  }
};

const generateEdgeSpeech = async (text, fileUrl, voice, role) => {
  if (await hasAudioFile(fileUrl)) return;

  const rate = role === "read" ? "+4%" : "-4%";
  const pitch = role === "read" ? "+10Hz" : "-2Hz";
  const baseArgs = [
    "-m",
    "edge_tts",
    "--voice",
    voice,
    "--text",
    text,
    "--write-media",
    fileUrl.pathname,
  ];
  const tunedArgs = [
    "-m",
    "edge_tts",
    "--voice",
    voice,
    `--rate=${rate}`,
    `--pitch=${pitch}`,
    "--text",
    text,
    "--write-media",
    fileUrl.pathname,
  ];

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await run("python3", attempt < 4 ? tunedArgs : baseArgs);
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
};

const makeAudioPaths = (id) => ({
  read: shouldGenerateAudio ? `ai-audio/${id}-read.mp3` : null,
  hint: shouldGenerateAudio ? `ai-audio/${id}-hint.mp3` : null,
  success: shouldGenerateAudio ? `ai-audio/${id}-success.mp3` : null,
});

const buildManifest = async () => {
  await mkdir(AUDIO_DIR, { recursive: true });

  const seeds = makeSeeds();
  const selectedSeeds = limit ? seeds.slice(0, limit) : seeds;
  const generated = [];

  for (let index = 0; index < selectedSeeds.length; index += 1) {
    const seed = selectedSeeds[index];
    const text = useOpenAiText ? await generateText(seed) : makeFallbackText(seed, index);
    const audio = makeAudioPaths(seed.id);

    if (useOpenAiAudio) {
      await generateSpeech(text.promptText, new URL(`${seed.id}-read.mp3`, AUDIO_DIR));
      await generateSpeech(text.dadHintText, new URL(`${seed.id}-hint.mp3`, AUDIO_DIR));
      await generateSpeech(text.successText, new URL(`${seed.id}-success.mp3`, AUDIO_DIR));
    }

    if (useEdgeAudio) {
      await generateEdgeSpeech(
        text.promptText,
        new URL(`${seed.id}-read.mp3`, AUDIO_DIR),
        EDGE_READ_VOICE,
        "read",
      );
      await generateEdgeSpeech(
        text.dadHintText,
        new URL(`${seed.id}-hint.mp3`, AUDIO_DIR),
        EDGE_DAD_VOICE,
        "dad",
      );
      await generateEdgeSpeech(
        text.successText,
        new URL(`${seed.id}-success.mp3`, AUDIO_DIR),
        EDGE_DAD_VOICE,
        "dad",
      );
    }

    generated.push({
      id: seed.id,
      level: seed.level,
      difficulty: seed.difficulty,
      operation: seed.operation,
      left: seed.left,
      right: seed.right,
      answer: seed.answer,
      prompt: seed.prompt,
      promptText: text.promptText,
      dadHintText: text.dadHintText,
      successText: text.successText,
      mission: seed.mission,
      hintType: seed.hintType,
      options: seed.options,
      audio,
    });

    console.log(
      `${index + 1}/${selectedSeeds.length} ${seed.id} ${provider}`,
    );
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    generatedBy: provider,
    childName: CHILD_NAME,
    textModel: useOpenAiText ? TEXT_MODEL : null,
    ttsModel: useOpenAiAudio ? TTS_MODEL : useEdgeAudio ? "edge-tts" : null,
    ttsVoice: useOpenAiAudio
      ? TTS_VOICE
      : useEdgeAudio
        ? { read: EDGE_READ_VOICE, dad: EDGE_DAD_VOICE }
        : null,
    questions: generated,
  };

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
};

buildManifest().catch((error) => {
  console.error(error);
  process.exit(1);
});
