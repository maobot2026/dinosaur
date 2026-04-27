import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  Baby,
  BookOpen,
  Check,
  Heart,
  Home,
  Music2,
  Radio,
  RotateCcw,
  Sparkles,
  Volume2,
} from "lucide-react";
import backgroundUrl from "./assets/rescue-valley-optimized.jpg";
import dinoBrachioUrl from "./assets/cutouts/dino-brachio-small.png";
import dinoRaptorUrl from "./assets/cutouts/dino-raptor-small.png";
import dinoRexUrl from "./assets/cutouts/dino-rex-small.png";
import dinoStegoUrl from "./assets/cutouts/dino-stego-small.png";
import dinoTrikeUrl from "./assets/cutouts/dino-trike-small.png";
import itemEggUrl from "./assets/cutouts/item-egg-small.png";
import itemFootprintUrl from "./assets/cutouts/item-footprint-small.png";
import itemFruitUrl from "./assets/cutouts/item-fruit-small.png";
import itemLeafUrl from "./assets/cutouts/item-leaf-small.png";
import {
  Difficulty,
  Dino,
  HintType,
  Question,
  RescueLevel,
  SceneRewardId,
  dinos,
  makeRound,
  pickUnlockedDino,
} from "./gameLogic";

type Screen = "start" | "play" | "summary" | "dex";
type Feedback = "idle" | "correct" | "try";
type HelperMood = "idle" | "reading" | "cheer" | "thinking" | "radio";

const STORAGE_KEY = "dino-rescue-math-save";
const CHILD_NAME = "小宝";

const levelOptions: Array<{
  id: RescueLevel;
  title: string;
  text: string;
  icon: HintType;
}> = [
  { id: "valley", title: "山谷救援", text: "找树叶和脚印", icon: "leaf" },
  { id: "nest", title: "蛋窝救援", text: "保护恐龙蛋", icon: "egg" },
  { id: "river", title: "河边救援", text: "收集果子补给", icon: "fruit" },
];

const difficultyOptions: Array<{
  id: Difficulty;
  title: string;
  text: string;
}> = [
  { id: "sprout", title: "小芽", text: "10以内" },
  { id: "helper", title: "小队员", text: "15以内" },
  { id: "hero", title: "勇敢", text: "20以内" },
];

const sceneRewards: Record<
  SceneRewardId,
  { title: string; text: string; level: RescueLevel; marks: string[] }
> = {
  bridge: {
    title: "山谷小桥",
    text: "小宝修好桥，恐龙能回营地。",
    level: "valley",
    marks: ["桥墩", "桥板", "护栏", "旗子", "通路"],
  },
  nest: {
    title: "暖暖蛋窝",
    text: "小宝铺好窝，恐龙蛋暖起来。",
    level: "nest",
    marks: ["草垫", "蛋灯", "围栏", "小花", "暖窝"],
  },
  supply: {
    title: "河边补给车",
    text: "小宝装满车，救援队有力气。",
    level: "river",
    marks: ["车轮", "果篮", "水壶", "徽章", "出发"],
  },
};

const dinoImages: Record<string, string> = {
  rex: dinoRexUrl,
  trike: dinoTrikeUrl,
  brachio: dinoBrachioUrl,
  stego: dinoStegoUrl,
  raptor: dinoRaptorUrl,
};

const itemImages: Record<HintType, string> = {
  egg: itemEggUrl,
  footprint: itemFootprintUrl,
  fruit: itemFruitUrl,
  leaf: itemLeafUrl,
};

const helperDino = dinos.find((dino) => dino.id === "raptor") ?? dinos[0];

type SaveData = {
  unlockedIds: string[];
  baseRewardIds: SceneRewardId[];
  bestScore: number;
  roundsPlayed: number;
};

const defaultSave: SaveData = {
  unlockedIds: [],
  baseRewardIds: [],
  bestScore: 0,
  roundsPlayed: 0,
};

const readSave = (): SaveData => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultSave, ...JSON.parse(saved) } : defaultSave;
  } catch {
    return defaultSave;
  }
};

const tone = (
  audioContext: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  volume = 0.13,
) => {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
};

const playMusicNote = (
  audioContext: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  volumeScale = 1,
) => {
  tone(audioContext, frequency, start, duration, "sine", 0.024 * volumeScale);
  tone(
    audioContext,
    frequency * 2,
    start + 0.01,
    duration * 0.8,
    "triangle",
    0.01 * volumeScale,
  );
};

const preferredVoiceNames = [
  "Tingting",
  "Sinji",
  "Meijia",
  "Yu-shu",
  "Google 普通话",
  "Google 國語",
  "普通话",
  "Mandarin",
  "Chinese",
];

const pickChineseVoice = () => {
  const voices = window.speechSynthesis.getVoices();
  const chineseVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith("zh"),
  );

  return (
    preferredVoiceNames
      .map((name) =>
        chineseVoices.find((voice) =>
          voice.name.toLowerCase().includes(name.toLowerCase()),
        ),
      )
      .find(Boolean) ??
    chineseVoices.find((voice) => voice.lang.toLowerCase().includes("cn")) ??
    chineseVoices[0] ??
    voices[0]
  );
};

const splitSpeech = (text: string) =>
  text
    .replaceAll("？", "？|")
    .replaceAll("。", "。|")
    .replaceAll("，", "，|")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

const speakSegment = (text: string, voice?: SpeechSynthesisVoice) =>
  new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? "zh-CN";
    utterance.rate = 0.76;
    utterance.pitch = 1.03;
    utterance.volume = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });

const pause = (duration: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration);
  });

const resetPageScroll = () => {
  window.requestAnimationFrame(() => {
    window.scrollTo({ left: 0, top: 0, behavior: "auto" });
  });
};

const speakText = async (text: string) => {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const voice = pickChineseVoice();
  const segments = splitSpeech(text);

  for (const segment of segments) {
    await speakSegment(segment, voice);
    await pause(segment.endsWith("，") ? 90 : 170);
  }
};

const publicAssetUrl = (path: string | null | undefined) => {
  if (!path) return null;
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
};

const preloadVoiceClip = (path: string | null | undefined) => {
  const url = publicAssetUrl(path);
  if (!url) return;

  const audio = new Audio(url);
  audio.preload = "auto";
  audio.load();
};

const makeQuestionSpeech = (question: Question) => question.promptText;

const makeTenHint = (question: Question, itemName: string) => {
  if (question.operation === "add") {
    const needToTen = 10 - question.left;
    if (question.left > 0 && needToTen > 0 && question.right >= needToTen) {
      const rest = question.right - needToTen;
      return `还可以用凑十法：${question.left} 差 ${needToTen} 个到十。从 ${question.right} 个${itemName}里拿 ${needToTen} 个过去，先凑成十，还剩 ${rest} 个。十再加 ${rest}，就是 ${question.answer}。`;
    }

    const otherNeedToTen = 10 - question.right;
    if (question.right > 0 && otherNeedToTen > 0 && question.left >= otherNeedToTen) {
      const rest = question.left - otherNeedToTen;
      return `也可以反过来凑十：${question.right} 差 ${otherNeedToTen} 个到十。从 ${question.left} 个${itemName}里拿 ${otherNeedToTen} 个过去，十再加 ${rest}，就是 ${question.answer}。`;
    }

    return `这题还不用凑十法，直接把两堆${itemName}合在一起数就可以。每五个看成一小堆，会更清楚。`;
  }

  if (question.left > 10 && question.right <= 10) {
    const ones = question.left - 10;
    if (question.right <= ones) {
      return `减法也可以想成十和小尾巴：${question.left} 是十加 ${ones}。先从小尾巴里拿走 ${question.right} 个，剩下 ${question.answer}。`;
    }

    const fromTen = question.right - ones;
    return `减法可以先拆开：${question.left} 是十加 ${ones}。先拿走小尾巴 ${ones} 个，还要从十里面再拿 ${fromTen} 个，十少 ${fromTen}，剩 ${question.answer}。`;
  }

  return `这题先看左边一共有 ${question.left} 个${itemName}，再拿走 ${question.right} 个，剩下的就是答案。`;
};

const makeAiHint = (question: Question) => {
  if (question.dadHintText) return question.dadHintText;

  const itemName =
    question.hintType === "leaf"
      ? "树叶"
      : question.hintType === "egg"
        ? "恐龙蛋"
        : question.hintType === "fruit"
          ? "果子"
          : "脚印";

  if (question.strategyType === "count-on") {
    const big = Math.max(question.left, question.right);
    const small = Math.min(question.left, question.right);
    return `${CHILD_NAME}，爸爸提示来啦。先记住大的 ${big}，小恐龙往后跳 ${small} 下，跳到 ${question.answer}。`;
  }

  if (question.strategyType === "make-ten") {
    const big = Math.max(question.left, question.right);
    const small = Math.min(question.left, question.right);
    const need = 10 - big;
    const rest = small - need;
    return `${CHILD_NAME}，爸爸提示来啦。${big} 还差 ${need} 到 10，从 ${small} 个${itemName}里拿 ${need} 个过来，先变成 10，再加 ${rest}，就是 ${question.answer}。`;
  }

  if (question.strategyType === "break-ten") {
    const ones = question.left - 10;
    if (question.left === 20) {
      return `${CHILD_NAME}，爸爸提示来啦。20 是两个 10，先从一个 10 里拿走 ${question.right} 个，还剩 ${10 - question.right} 个，再加另一个 10，就是 ${question.answer}。`;
    }
    if (question.right <= ones) {
      return `${CHILD_NAME}，爸爸提示来啦。${question.left} 是 10 和 ${ones}，先从小尾巴里拿走 ${question.right} 个，剩下 ${question.answer}。`;
    }
    const fromTen = question.right - ones;
    return `${CHILD_NAME}，爸爸提示来啦。${question.left} 是 10 和 ${ones}，先拿走 ${ones} 个，还要从 10 里拿 ${fromTen} 个，剩下 ${question.answer}。`;
  }

  if (question.strategyType === "part-whole") {
    return question.operation === "add"
      ? `${CHILD_NAME}，爸爸提示来啦。${question.left} 个${itemName}是一部分，${question.right} 个是另一部分，两部分合起来就是 ${question.answer}。`
      : `${CHILD_NAME}，爸爸提示来啦。${question.left} 个${itemName}是整体，拿走 ${question.right} 个，留下来的部分就是 ${question.answer}。`;
  }

  return `${CHILD_NAME}，爸爸提示来啦。我们一个一个点亮数，数到最后一个，就是 ${question.answer}。`;
};

const makeSuccessSpeech = (question: Question) =>
  question.successText || `${CHILD_NAME}答对啦！小恐龙有力气了。`;

const storyTokenPattern =
  /(\d+|先找到|又送来|又摘来|现在有|一共有|一共看见|发现|又有|送回|还剩|分给|吃掉|找到|摘来|看见|剩下)/g;
const actionTokenPattern =
  /^(先找到|又送来|又摘来|现在有|一共有|一共看见|发现|又有|送回|还剩|分给|吃掉|找到|摘来|看见|剩下)$/;

const renderStoryPrompt = (prompt: string) =>
  prompt.split(storyTokenPattern).map((part, index) => {
    if (!part) return null;

    if (/^\d+$/.test(part)) {
      return (
        <span className="story-token number-token" key={`${part}-${index}`}>
          {part}
        </span>
      );
    }

    if (actionTokenPattern.test(part)) {
      return (
        <span className="story-token action-token" key={`${part}-${index}`}>
          {part}
        </span>
      );
    }

    return part;
  });

function App() {
  const [selectedLevel, setSelectedLevel] = useState<RescueLevel>("valley");
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<Difficulty>("helper");
  const [questions, setQuestions] = useState<Question[]>(() =>
    makeRound(5, "helper", "valley"),
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [saveData, setSaveData] = useState<SaveData>(() => readSave());
  const [screen, setScreen] = useState<Screen>("start");
  const [roundReward, setRoundReward] = useState<Dino | null>(null);
  const [speechReady, setSpeechReady] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicDuckedRef = useRef(false);
  const nextTimer = useRef<number | null>(null);
  const musicTimer = useRef<number | null>(null);
  const musicStep = useRef(0);

  const currentQuestion = questions[questionIndex];
  const progress = questionIndex + 1;
  const isLastQuestion = questionIndex === questions.length - 1;
  const currentSceneReward = sceneRewards[currentQuestion.sceneRewardId];

  const unlockedDinos = useMemo(
    () => dinos.filter((dino) => saveData.unlockedIds.includes(dino.id)),
    [saveData.unlockedIds],
  );

  const baseRewards = useMemo(
    () => (saveData.baseRewardIds ?? []).map((id) => sceneRewards[id]).filter(Boolean),
    [saveData.baseRewardIds],
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
  }, [saveData]);

  useEffect(() => {
    return () => {
      if (nextTimer.current) window.clearTimeout(nextTimer.current);
      if (musicTimer.current) window.clearInterval(musicTimer.current);
      if (voiceAudioRef.current) voiceAudioRef.current.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!musicOn) {
      if (musicTimer.current) window.clearInterval(musicTimer.current);
      musicTimer.current = null;
      return;
    }

    const ctx = ensureAudio();
    const melody = [392, 440, 523.25, 493.88, 440, 392, 349.23, 392];

    const playBar = () => {
      const now = ctx.currentTime;
      const volumeScale = musicDuckedRef.current ? 0.34 : 1;
      for (let i = 0; i < 4; i += 1) {
        const note = melody[(musicStep.current + i) % melody.length];
        playMusicNote(ctx, note, now + i * 0.42, 0.24, volumeScale);
      }
      musicStep.current = (musicStep.current + 4) % melody.length;
    };

    playBar();
    musicTimer.current = window.setInterval(playBar, 2300);

    return () => {
      if (musicTimer.current) window.clearInterval(musicTimer.current);
      musicTimer.current = null;
    };
  }, [musicOn]);

  useEffect(() => {
    if (!speechReady || screen !== "play") return;

    const readTimer = window.setTimeout(() => {
      playVoiceClip(currentQuestion.audio.read, makeQuestionSpeech(currentQuestion));
    }, 240);

    return () => window.clearTimeout(readTimer);
  }, [currentQuestion, screen, speechReady]);

  useEffect(() => {
    if (screen !== "play") return;

    preloadVoiceClip(currentQuestion.audio.read);
    preloadVoiceClip(questions[questionIndex + 1]?.audio.read);
  }, [currentQuestion, questionIndex, questions, screen]);

  const ensureAudio = () => {
    if (!audioRef.current) {
      audioRef.current = new AudioContext();
    }
    if (audioRef.current.state === "suspended") {
      void audioRef.current.resume();
    }
    return audioRef.current;
  };

  const stopVoiceAudio = () => {
    if (!voiceAudioRef.current) return;
    voiceAudioRef.current.pause();
    voiceAudioRef.current.currentTime = 0;
    voiceAudioRef.current = null;
    musicDuckedRef.current = false;
  };

  const playVoiceClip = async (
    clipPath: string | null | undefined,
    fallbackText: string,
  ) => {
    ensureAudio();
    stopVoiceAudio();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();

    const url = publicAssetUrl(clipPath);
    if (!url) {
      await speakText(fallbackText);
      return;
    }

    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = 1;
    musicDuckedRef.current = true;
    let didFallback = false;
    const fallback = () => {
      if (didFallback) return;
      didFallback = true;
      if (voiceAudioRef.current === audio) voiceAudioRef.current = null;
      musicDuckedRef.current = false;
      void speakText(fallbackText);
    };
    audio.onended = () => {
      if (voiceAudioRef.current === audio) voiceAudioRef.current = null;
      musicDuckedRef.current = false;
    };
    audio.onerror = fallback;
    voiceAudioRef.current = audio;

    try {
      await audio.play();
    } catch {
      fallback();
    }
  };

  const playCorrect = () => {
    const ctx = ensureAudio();
    const now = ctx.currentTime;
    tone(ctx, 523.25, now, 0.12, "sine");
    tone(ctx, 659.25, now + 0.1, 0.14, "sine");
    tone(ctx, 783.99, now + 0.22, 0.18, "triangle");
  };

  const playTryAgain = () => {
    const ctx = ensureAudio();
    const now = ctx.currentTime;
    tone(ctx, 392, now, 0.12, "triangle");
    tone(ctx, 349.23, now + 0.12, 0.18, "sine");
  };

  const finishRound = (nextScore: number) => {
    const reward = pickUnlockedDino(saveData.roundsPlayed, saveData.unlockedIds);
    setRoundReward(reward);
    setSaveData((current) => ({
      baseRewardIds: Array.from(
        new Set([...(current.baseRewardIds ?? []), currentQuestion.sceneRewardId]),
      ),
      unlockedIds: Array.from(new Set([...current.unlockedIds, reward.id])),
      bestScore: Math.max(current.bestScore, nextScore),
      roundsPlayed: current.roundsPlayed + 1,
    }));
    setScreen("summary");
  };

  const answer = (choice: number) => {
    if (feedback === "correct") return;

    if (choice === currentQuestion.answer) {
      const nextScore = score + 1;
      setScore(nextScore);
      setFeedback("correct");
      playCorrect();
      if (speechReady) {
        window.setTimeout(
          () =>
            void playVoiceClip(
              currentQuestion.audio.success,
              makeSuccessSpeech(currentQuestion),
            ),
          260,
        );
      }

      nextTimer.current = window.setTimeout(() => {
        setFeedback("idle");
        setWrongAttempts(0);
        if (isLastQuestion) {
          finishRound(nextScore);
        } else {
          setQuestionIndex((index) => index + 1);
        }
      }, 1900);
      return;
    }

    setFeedback("try");
    const nextWrongAttempts = wrongAttempts + 1;
    setWrongAttempts(nextWrongAttempts);
    playTryAgain();
    if (speechReady && nextWrongAttempts >= 2) {
      window.setTimeout(
        () => void playVoiceClip(currentQuestion.audio.hint, makeAiHint(currentQuestion)),
        220,
      );
    }
  };

  const startRound = (
    level = selectedLevel,
    difficulty = selectedDifficulty,
  ) => {
    if (nextTimer.current) window.clearTimeout(nextTimer.current);
    ensureAudio();
    setSpeechReady(true);
    setMusicOn(true);
    setSelectedLevel(level);
    setSelectedDifficulty(difficulty);
    setQuestions(makeRound(5, difficulty, level));
    setQuestionIndex(0);
    setScore(0);
    setFeedback("idle");
    setWrongAttempts(0);
    setRoundReward(null);
    setScreen("play");
    resetPageScroll();
  };

  const toggleMusic = () => {
    ensureAudio();
    setMusicOn((current) => !current);
  };

  const readQuestion = () => {
    ensureAudio();
    setSpeechReady(true);
    void playVoiceClip(currentQuestion.audio.read, makeQuestionSpeech(currentQuestion));
  };

  const askAi = () => {
    ensureAudio();
    setSpeechReady(true);
    setFeedback("try");
    setWrongAttempts((current) => Math.max(2, current));
    void playVoiceClip(currentQuestion.audio.hint, makeAiHint(currentQuestion));
  };

  return (
    <main
      className="app-shell"
      style={{ backgroundImage: `url(${backgroundUrl})` }}
    >
      <div className="soft-vignette" />
      <section
        className={`game-frame ${screen === "start" ? "start-frame" : ""}`}
        aria-label="恐龙救援队数学游戏"
      >
        {screen !== "start" && (
          <TopBar
            progress={progress}
            total={questions.length}
            score={score}
            bestScore={saveData.bestScore}
            musicOn={musicOn}
            onOpenDex={() => setScreen("dex")}
            onRestart={() => startRound()}
            onHome={() => {
              setRoundReward(null);
              setScreen("start");
              resetPageScroll();
            }}
            onToggleMusic={toggleMusic}
          />
        )}

        {screen === "start" && (
          <StartScreen
            level={selectedLevel}
            difficulty={selectedDifficulty}
            bestScore={saveData.bestScore}
            unlockedCount={saveData.unlockedIds.length}
            baseRewards={baseRewards}
            musicOn={musicOn}
            onLevel={setSelectedLevel}
            onDifficulty={setSelectedDifficulty}
            onToggleMusic={toggleMusic}
            onStart={() => startRound(selectedLevel, selectedDifficulty)}
            onDex={() => {
              setRoundReward(null);
              setScreen("dex");
              resetPageScroll();
            }}
          />
        )}

        {screen === "play" && (
          <RescueScene
            question={currentQuestion}
            questionIndex={questionIndex}
            total={questions.length}
            score={score}
            feedback={feedback}
            wrongAttempts={wrongAttempts}
            speechReady={speechReady}
            onAnswer={answer}
            onRead={readQuestion}
            onAiHint={askAi}
          />
        )}

        {screen === "summary" && roundReward && (
          <SummaryScreen
            score={score}
            total={questions.length}
            reward={roundReward}
            sceneReward={currentSceneReward}
            unlockedCount={saveData.unlockedIds.length}
            onPlay={() => startRound()}
            onDex={() => setScreen("dex")}
          />
        )}

        {screen === "dex" && (
          <DinoDex
            unlockedIds={saveData.unlockedIds}
            onClose={() =>
              setScreen(roundReward ? "summary" : questionIndex > 0 ? "play" : "start")
            }
          />
        )}
      </section>
    </main>
  );
}

type TopBarProps = {
  progress: number;
  total: number;
  score: number;
  bestScore: number;
  musicOn: boolean;
  onOpenDex: () => void;
  onRestart: () => void;
  onHome: () => void;
  onToggleMusic: () => void;
};

function TopBar({
  progress,
  total,
  score,
  bestScore,
  musicOn,
  onOpenDex,
  onRestart,
  onHome,
  onToggleMusic,
}: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="brand-pill">
        <Baby size={24} />
        <span>恐龙救援队</span>
      </div>
      <div className="progress-dots" aria-label={`第 ${progress} 题，共 ${total} 题`}>
        {Array.from({ length: total }, (_, index) => (
          <span
            className={index < progress ? "dot dot-active" : "dot"}
            key={index}
          />
        ))}
      </div>
      <div className="score-pill">
        <Sparkles size={22} />
        <span>
          {score}/{total}
        </span>
        <small>最好 {bestScore}</small>
      </div>
      <button className="icon-button" onClick={onOpenDex} aria-label="打开图鉴">
        <BookOpen size={26} />
      </button>
      <button className="icon-button" onClick={onToggleMusic} aria-label="开关音乐">
        <Music2 size={26} fill={musicOn ? "currentColor" : "none"} />
      </button>
      <button className="icon-button" onClick={onRestart} aria-label="重新开始">
        <RotateCcw size={26} />
      </button>
      <button className="icon-button" onClick={onHome} aria-label="回到首页">
        <Home size={26} />
      </button>
    </header>
  );
}

type StartScreenProps = {
  level: RescueLevel;
  difficulty: Difficulty;
  bestScore: number;
  unlockedCount: number;
  baseRewards: Array<(typeof sceneRewards)[SceneRewardId]>;
  musicOn: boolean;
  onLevel: (level: RescueLevel) => void;
  onDifficulty: (difficulty: Difficulty) => void;
  onToggleMusic: () => void;
  onStart: () => void;
  onDex: () => void;
};

function StartScreen({
  level,
  difficulty,
  bestScore,
  unlockedCount,
  baseRewards,
  musicOn,
  onLevel,
  onDifficulty,
  onToggleMusic,
  onStart,
  onDex,
}: StartScreenProps) {
  return (
    <section className="start-screen">
      <div className="start-hero">
        <div className="start-copy">
          <span className="mission-chip">小宝专属</span>
          <h1>恐龙救援队</h1>
          <p>AI爸爸语音陪小宝，选关卡，出发救恐龙。</p>
        </div>
        <div className="start-dinos" aria-hidden="true">
          {dinos.slice(0, 3).map((dino, index) => (
            <div className={`start-dino dino-${index}`} key={dino.id}>
              <DinoPortrait dino={dino} />
            </div>
          ))}
        </div>
      </div>

      <div className="start-options">
        <section className="option-group">
          <h2>关卡</h2>
          <div className="choice-grid">
            {levelOptions.map((option) => (
              <button
                className={`choice-card ${level === option.id ? "selected" : ""}`}
                key={option.id}
                onClick={() => onLevel(option.id)}
              >
                <AssetIcon kind={option.icon} />
                <strong>{option.title}</strong>
                <span>{option.text}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="option-group">
          <h2>难度</h2>
          <div className="choice-grid difficulty-grid">
            {difficultyOptions.map((option) => (
              <button
                className={`choice-card ${difficulty === option.id ? "selected" : ""}`}
                key={option.id}
                onClick={() => onDifficulty(option.id)}
              >
                <Sparkles size={30} />
                <strong>{option.title}</strong>
                <span>{option.text}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="start-footer">
        <button className="secondary-action compact-action" onClick={onDex}>
          图鉴 {unlockedCount}/{dinos.length}
        </button>
        <button className="music-action" onClick={onToggleMusic}>
          <Music2 size={24} fill={musicOn ? "currentColor" : "none"} />
          {musicOn ? "音乐开" : "音乐关"}
        </button>
        <button className="primary-action start-action" onClick={onStart}>
          小宝出发
        </button>
        <span className="best-badge">最好 {bestScore}/5</span>
      </div>
      <BasePreview rewards={baseRewards} />
    </section>
  );
}

function BasePreview({
  rewards,
}: {
  rewards: Array<(typeof sceneRewards)[SceneRewardId]>;
}) {
  const unlockedTitles = new Set(rewards.map((reward) => reward.title));

  return (
    <section className="base-preview" aria-label="恐龙基地">
      <div className="base-title">
        <span>小宝的恐龙基地</span>
        <strong>{rewards.length}/3</strong>
      </div>
      <div className="base-parts">
        {Object.values(sceneRewards).map((reward) => {
          const unlocked = unlockedTitles.has(reward.title);
          return (
            <div
              className={`base-part ${unlocked ? "unlocked" : ""}`}
              key={reward.title}
            >
              <span>{reward.title}</span>
              <small>{unlocked ? "已点亮" : "等小宝救援"}</small>
            </div>
          );
        })}
      </div>
      <div className="base-dinos" aria-hidden="true">
        {dinos.map((dino, index) => (
          <span className={`base-dino base-dino-${index}`} key={dino.id}>
            <DinoPortrait dino={dino} />
          </span>
        ))}
      </div>
    </section>
  );
}

type RescueSceneProps = {
  question: Question;
  questionIndex: number;
  total: number;
  score: number;
  feedback: Feedback;
  wrongAttempts: number;
  speechReady: boolean;
  onAnswer: (answer: number) => void;
  onRead: () => void;
  onAiHint: () => void;
};

function RescueScene({
  question,
  questionIndex,
  total,
  score,
  feedback,
  wrongAttempts,
  speechReady,
  onAnswer,
  onRead,
  onAiHint,
}: RescueSceneProps) {
  const rescueDino =
    dinos.find((dino) => dino.id === question.rescueDinoId) ??
    dinos[questionIndex % dinos.length];

  return (
    <div className="play-grid">
      <section className={`story-panel ${feedback}`} aria-live="polite">
        <div className="mission-row">
          <span className="mission-chip">{CHILD_NAME}的任务：{question.mission}</span>
          <span className="rescue-count">
            <Heart size={22} fill="currentColor" />
            {score}
          </span>
        </div>
        <AnimatedQuestionDemo
          dino={helperDino}
          question={question}
          feedback={feedback}
          wrongAttempts={wrongAttempts}
        />
        <div className="voice-actions">
          <button className="voice-button" onClick={onRead}>
            <Volume2 size={26} />
            读给{CHILD_NAME}听
          </button>
          <button className="ai-button" onClick={onAiHint}>
            <Radio size={26} />
            爸爸对讲机
          </button>
        </div>
        <RewardTray feedback={feedback} hintType={question.hintType} />
      </section>

      <aside className={`side-panel ${feedback === "try" ? "show-work" : ""}`}>
        <RescueDinoStatus
          dino={rescueDino}
          feedback={feedback}
          progress={feedback === "correct" ? questionIndex + 1 : questionIndex}
          total={total}
          question={question}
          wrongAttempts={wrongAttempts}
          speechReady={speechReady}
        />
        <EquationCard question={question} feedback={feedback} />
        <StrategyCard question={question} wrongAttempts={wrongAttempts} feedback={feedback} />
      </aside>

      <AnswerPad
        options={question.options}
        feedback={feedback}
        hintType={question.hintType}
        showQuantity={wrongAttempts > 0}
        onAnswer={onAnswer}
      />
    </div>
  );
}

type AnimatedQuestionDemoProps = {
  dino: Dino;
  question: Question;
  feedback: Feedback;
  wrongAttempts: number;
};

function AnimatedQuestionDemo({
  dino,
  question,
  feedback,
  wrongAttempts,
}: AnimatedQuestionDemoProps) {
  const helperMood: HelperMood =
    feedback === "correct"
      ? "cheer"
      : wrongAttempts >= 2
        ? "radio"
        : feedback === "try"
          ? "thinking"
          : "reading";

  return (
    <div
      className={`demo-stage ${question.operation} ${question.animationKind} ${feedback} hint-${Math.min(wrongAttempts, 3)}`}
      aria-label={question.prompt}
      role="img"
    >
      <DinoHelper dino={dino} mood={helperMood} />
      <StrategyDemo question={question} feedback={feedback} wrongAttempts={wrongAttempts} />
    </div>
  );
}

type StrategyDemoProps = {
  question: Question;
  feedback: Feedback;
  wrongAttempts: number;
};

function StrategyDemo({ question, feedback, wrongAttempts }: StrategyDemoProps) {
  if (question.animationKind === "number-line") {
    return <NumberLineDemo question={question} feedback={feedback} />;
  }

  if (question.animationKind === "ten-frame") {
    return <TenFrameDemo question={question} feedback={feedback} />;
  }

  if (question.animationKind === "break-ten") {
    return <BreakTenDemo question={question} feedback={feedback} />;
  }

  if (question.animationKind === "part-whole") {
    return <PartWholeDemo question={question} feedback={feedback} />;
  }

  return (
    <CountingDemo
      question={question}
      feedback={feedback}
      showAnswer={wrongAttempts >= 3 || feedback === "correct"}
    />
  );
}

function CountingDemo({
  question,
  feedback,
  showAnswer,
}: {
  question: Question;
  feedback: Feedback;
  showAnswer: boolean;
}) {
  const count = question.operation === "add" ? question.answer : question.left;
  const removed = question.operation === "subtract" ? question.right : 0;

  return (
    <div className="strategy-demo counting-demo">
      <div className="demo-label">{question.strategySummaryText}</div>
      <div className="counting-field">
        {Array.from({ length: count }, (_, index) => {
          const isRemoved = question.operation === "subtract" && index >= question.answer;
          return (
            <span
              className={`counting-item ${isRemoved ? "removed" : ""} ${showAnswer ? "lit" : ""}`}
              key={index}
              style={{ "--i": index } as CSSProperties}
            >
              <AssetIcon kind={question.hintType} />
            </span>
          );
        })}
      </div>
      {removed > 0 && <div className="mini-note">拿走 {removed} 个，留下 {question.answer}</div>}
      {feedback === "correct" && <div className="strategy-answer">{question.answer}</div>}
    </div>
  );
}

function PartWholeDemo({ question, feedback }: { question: Question; feedback: Feedback }) {
  const leftItems = Array.from({ length: question.left });
  const rightItems = Array.from({ length: question.right });
  const answerItems = Array.from({ length: question.answer });
  const isSubtract = question.operation === "subtract";

  return (
    <div className="strategy-demo part-whole-demo">
      <div className="part-box">
        <NumberBunch items={leftItems} type={question.hintType} compact />
      </div>
      <div className="part-action">{isSubtract ? "拿走" : "合起"}</div>
      <div className={`part-box ${isSubtract ? "taken-box" : ""}`}>
        <NumberBunch items={rightItems} type={question.hintType} compact dimmed={isSubtract} />
      </div>
      <div className={`whole-box ${feedback === "correct" ? "complete" : ""}`}>
        <span>{isSubtract ? "留下" : "总数"}</span>
        <NumberBunch items={answerItems} type={question.hintType} compact />
      </div>
    </div>
  );
}

function NumberLineDemo({ question, feedback }: { question: Question; feedback: Feedback }) {
  const big = Math.max(question.left, question.right);
  const steps = Math.min(question.left, question.right);
  const points = Array.from({ length: steps + 1 }, (_, index) => big + index);

  return (
    <div className="strategy-demo number-line-demo">
      <div className="demo-label">{question.strategySummaryText}</div>
      <div className="number-line-track">
        {points.map((value, index) => (
          <span
            className={`line-point ${index === 0 ? "start" : ""} ${index === points.length - 1 ? "finish" : ""}`}
            key={value}
            style={{ "--i": index } as CSSProperties}
          >
            <b>{value}</b>
          </span>
        ))}
      </div>
      <div className={`jump-dino ${feedback === "correct" ? "landed" : ""}`}>
        <DinoPortrait dino={dinos.find((dino) => dino.id === question.rescueDinoId) ?? dinos[0]} />
      </div>
    </div>
  );
}

function TenFrameDemo({ question, feedback }: { question: Question; feedback: Feedback }) {
  const big = Math.max(question.left, question.right);
  const small = Math.min(question.left, question.right);
  const need = Math.max(0, 10 - big);
  const rest = Math.max(0, small - need);
  const baseFilled = Math.min(big, 10);
  const filledUntil = Math.min(10, baseFilled + need);

  return (
    <div className="strategy-demo ten-frame-demo">
      <div className="demo-label">{question.strategySummaryText}</div>
      <div className={`ten-frame ${feedback === "correct" ? "packed" : ""}`}>
        {Array.from({ length: 10 }, (_, index) => (
          <span
            className={`ten-cell ${index < baseFilled ? "filled base" : ""} ${index >= baseFilled && index < filledUntil ? "filled moving" : ""}`}
            key={index}
            style={{ "--i": index } as CSSProperties}
          >
            {index < filledUntil ? <AssetIcon kind={question.hintType} /> : null}
          </span>
        ))}
      </div>
      <div className="ten-rest">
        {rest > 0 ? (
          <>
            <span>还剩 {rest}</span>
            <NumberBunch items={Array.from({ length: rest })} type={question.hintType} compact />
          </>
        ) : (
          <span>正好凑成十</span>
        )}
      </div>
    </div>
  );
}

function BreakTenDemo({ question, feedback }: { question: Question; feedback: Feedback }) {
  const ones = question.left - 10;
  const fromTen = Math.max(0, question.right - ones);
  const remainingTen = 10 - fromTen;

  return (
    <div className="strategy-demo break-ten-demo">
      <div className="demo-label">{question.strategySummaryText}</div>
      <div className={`ten-pack ${feedback === "try" ? "open" : ""}`}>
        <span>10</span>
        <div className="ten-frame mini">
          {Array.from({ length: 10 }, (_, index) => (
            <span
              className={`ten-cell filled ${index >= remainingTen ? "removed" : ""}`}
              key={index}
            >
              <AssetIcon kind={question.hintType} />
            </span>
          ))}
        </div>
      </div>
      <div className="loose-pack">
        <span>小尾巴 {ones}</span>
        <NumberBunch
          items={Array.from({ length: ones })}
          type={question.hintType}
          compact
          dimmed={feedback !== "idle"}
        />
      </div>
      <div className="strategy-answer">剩 {question.answer}</div>
    </div>
  );
}

function DinoHelper({ dino, mood }: { dino: Dino; mood: HelperMood }) {
  const cue =
    mood === "cheer"
      ? "欢呼"
      : mood === "thinking"
        ? "放大镜"
        : mood === "radio"
          ? "对讲机"
          : "指一指";

  return (
    <div className={`dino-helper ${mood}`} aria-hidden="true">
      <DinoPortrait dino={dino} />
      <span>{cue}</span>
    </div>
  );
}

type EquationCardProps = {
  question: Question;
  feedback: Feedback;
};

function EquationCard({ question, feedback }: EquationCardProps) {
  const operator = question.operation === "add" ? "+" : "-";
  const showAnswer = feedback === "correct";

  return (
    <section className={`equation-card ${feedback}`} aria-label="算术等式">
      <span className="equation-title">算式</span>
      <div className="equation-row">
        <strong>{question.left}</strong>
        <span>{operator}</span>
        <strong>{question.right}</strong>
        <span>=</span>
        <strong className={showAnswer ? "answer-reveal" : "answer-mystery"}>
          {showAnswer ? question.answer : "?"}
        </strong>
      </div>
    </section>
  );
}

type StrategyCardProps = {
  question: Question;
  wrongAttempts: number;
  feedback: Feedback;
};

const strategyLabels: Record<Question["strategyType"], { title: string; icon: string }> = {
  "count-all": { title: "点亮数", icon: "1 2 3" },
  "count-on": { title: "接着跳", icon: "+1 +1" },
  "part-whole": { title: "合和分", icon: "□ □" },
  "make-ten": { title: "凑成10", icon: "10" },
  "break-ten": { title: "拆开10", icon: "10 ->" },
};

function StrategyCard({ question, wrongAttempts, feedback }: StrategyCardProps) {
  const strategy = strategyLabels[question.strategyType];
  const hintText =
    wrongAttempts >= 3
      ? "小宝看完整演示"
      : wrongAttempts >= 2
        ? "爸爸陪小宝数"
        : wrongAttempts >= 1
          ? "亮起来再看"
          : feedback === "correct"
            ? "小宝会用啦"
            : "先看动画";

  return (
    <section
      className={`strategy-card ${question.strategyType} ${wrongAttempts > 0 ? "active" : ""} ${feedback}`}
      aria-label="数学方法提示"
    >
      <div className="strategy-badge">{strategy.icon}</div>
      <div>
        <span>{strategy.title}</span>
        <strong>{hintText}</strong>
        <p>{question.strategySummaryText}</p>
      </div>
    </section>
  );
}

type AnswerPadProps = {
  options: number[];
  feedback: Feedback;
  hintType: HintType;
  showQuantity: boolean;
  onAnswer: (answer: number) => void;
};

function AnswerPad({
  options,
  feedback,
  hintType,
  showQuantity,
  onAnswer,
}: AnswerPadProps) {
  return (
    <div className="answer-pad" aria-label="选择答案">
      {options.map((option) => (
        <button
          aria-label={`选择答案 ${option}`}
          className={`answer-button ${showQuantity ? "with-quantity" : ""}`}
          disabled={feedback === "correct"}
          key={option}
          onClick={() => onAnswer(option)}
        >
          <strong>{option}</strong>
          {showQuantity && (
            <span className="answer-mini-quantity" aria-hidden="true">
              <NumberBunch
                items={Array.from({ length: option })}
                type={hintType}
                compact
              />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

type VisualHintProps = {
  question: Question;
  feedback: Feedback;
};

function VisualHint({ question, feedback }: VisualHintProps) {
  const leftItems = Array.from({ length: question.left });
  const rightItems = Array.from({ length: question.right });
  const answerItems = Array.from({ length: question.answer });

  return (
    <div className={`visual-hint ${feedback === "try" ? "hint-open" : ""}`}>
      <span className="hint-title">
        {feedback === "try" ? "一起数一数" : "救援提示"}
      </span>
      {feedback === "try" ? (
        <>
          <div className="hint-equation">
            <NumberBunch items={leftItems} type={question.hintType} />
            <strong>{question.operation === "add" ? "+" : "-"}</strong>
            <NumberBunch items={rightItems} type={question.hintType} dimmed />
          </div>
          <div className="answer-bunch">
            <Check size={20} />
            <NumberBunch items={answerItems} type={question.hintType} compact />
          </div>
        </>
      ) : (
        <div className="quiet-hint">
          <AssetIcon kind={question.hintType} />
          <span>{CHILD_NAME}需要时，爸爸会提示</span>
        </div>
      )}
    </div>
  );
}

type RescueDinoStatusProps = {
  dino: Dino;
  feedback: Feedback;
  progress: number;
  total: number;
  question: Question;
  wrongAttempts: number;
  speechReady: boolean;
};

function RescueDinoStatus({
  dino,
  feedback,
  progress,
  total,
  question,
  wrongAttempts,
  speechReady,
}: RescueDinoStatusProps) {
  const rescuePercent = Math.round((progress / total) * 100);
  const status =
    feedback === "correct"
      ? "我好多啦！"
      : wrongAttempts >= 2
      ? "爸爸来陪你数"
      : wrongAttempts === 1
        ? "再帮我看一看"
        : rescuePercent === 0
          ? "等小宝来"
          : rescuePercent < 60
            ? "恢复一点"
            : "快得救啦";
  const itemName =
    question.hintType === "leaf"
      ? "树叶"
      : question.hintType === "egg"
        ? "恐龙蛋"
        : question.hintType === "fruit"
          ? "果子"
          : "脚印";

  return (
    <section
      className={`rescue-status ${feedback} rescue-step-${Math.min(wrongAttempts, 2)}`}
      aria-label="被救援恐龙状态"
    >
      <DinoPortrait dino={dino} />
      <div className="rescue-copy">
        <span>被救援：{dino.species}</span>
        <strong>{status}</strong>
        <div className="rescue-meter" aria-label={`救援进度 ${rescuePercent}%`}>
          <span style={{ width: `${rescuePercent}%` }} />
        </div>
        <small>{speechReady ? `小宝正在送${itemName}` : "点读题开始出声"}</small>
      </div>
    </section>
  );
}

type NumberBunchProps = {
  items: unknown[];
  type: HintType;
  dimmed?: boolean;
  compact?: boolean;
};

function NumberBunch({ items, type, dimmed, compact }: NumberBunchProps) {
  const groups =
    items.length === 0
      ? [[]]
      : Array.from({ length: Math.ceil(items.length / 5) }, (_, groupIndex) =>
          items.slice(groupIndex * 5, groupIndex * 5 + 5),
        );

  return (
    <div className={`number-bunch ${dimmed ? "dimmed" : ""} ${compact ? "compact" : ""}`}>
      {groups.map((group, groupIndex) => (
        <span
          className={`icon-pack ${group.length === 0 ? "zero-pack" : ""}`}
          key={groupIndex}
        >
          {group.length === 0 ? (
            <span className="zero-mark">0</span>
          ) : (
            group.map((_, itemIndex) => (
              <AssetIcon kind={type} key={`${groupIndex}-${itemIndex}`} />
            ))
          )}
        </span>
      ))}
    </div>
  );
}

function AssetIcon({ kind }: { kind: HintType }) {
  return <img className="asset-icon" src={itemImages[kind]} alt="" />;
}

type RewardTrayProps = {
  feedback: Feedback;
  hintType: HintType;
};

function RewardTray({ feedback, hintType }: RewardTrayProps) {
  return (
    <div className={`reward-tray ${feedback}`}>
      <AssetIcon kind={hintType} />
      <div>
        {feedback === "correct" && <strong>{CHILD_NAME}太棒了！</strong>}
        {feedback === "try" && <strong>{CHILD_NAME}差一点点！</strong>}
        {feedback === "idle" && <strong>{CHILD_NAME}选数字救恐龙</strong>}
        <p>
          {feedback === "correct"
            ? "AI爸爸会鼓励小宝。"
            : feedback === "try"
              ? "AI爸爸会读提示。"
              : "点读题，AI爸爸会说话。"}
        </p>
      </div>
      <Volume2 size={24} />
    </div>
  );
}

type SummaryScreenProps = {
  score: number;
  total: number;
  reward: Dino;
  sceneReward: (typeof sceneRewards)[SceneRewardId];
  unlockedCount: number;
  onPlay: () => void;
  onDex: () => void;
};

function SummaryScreen({
  score,
  total,
  reward,
  sceneReward,
  unlockedCount,
  onPlay,
  onDex,
}: SummaryScreenProps) {
  return (
    <section className="summary-screen">
      <div className="celebration">
        <div className="sparkle-ring">
          <DinoPortrait dino={reward} />
        </div>
        <div>
          <span className="mission-chip">{CHILD_NAME}救援完成</span>
          <h1>{score === total ? `${CHILD_NAME}救援全完成！` : "小队回到营地啦！"}</h1>
          <p>
            {CHILD_NAME}救到 {score} 次恐龙，{sceneReward.title}亮起来了。
          </p>
          <p>新伙伴：{reward.species} {reward.name}。</p>
          <p>{reward.reward}</p>
        </div>
      </div>
      <div className="scene-reward">
        <strong>{sceneReward.title}</strong>
        <span>{sceneReward.text}</span>
        <div className="reward-marks">
          {sceneReward.marks.map((mark, index) => (
            <span className={index < score ? "lit" : ""} key={mark}>
              {mark}
            </span>
          ))}
        </div>
      </div>
      <div className="star-row">
        {Array.from({ length: total }, (_, index) => (
          <span className={index < score ? "big-star active" : "big-star"} key={index}>
            ★
          </span>
        ))}
      </div>
      <p className="dex-count">图鉴 {unlockedCount}/{dinos.length}</p>
      <div className="summary-actions">
        <button className="primary-action" onClick={onPlay}>
          再玩一轮
        </button>
        <button className="secondary-action" onClick={onDex}>
          看图鉴
        </button>
      </div>
    </section>
  );
}

type DinoDexProps = {
  unlockedIds: string[];
  onClose: () => void;
};

function DinoDex({ unlockedIds, onClose }: DinoDexProps) {
  return (
    <section className="dex-screen">
      <div className="dex-heading">
        <div>
          <span className="mission-chip">恐龙图鉴</span>
          <h1>{CHILD_NAME}的伙伴</h1>
        </div>
        <button className="secondary-action compact-action" onClick={onClose}>
          回去
        </button>
      </div>
      <div className="dex-grid">
        {dinos.map((dino) => {
          const unlocked = unlockedIds.includes(dino.id);
          return (
            <article className={`dex-card ${unlocked ? "unlocked" : "locked"}`} key={dino.id}>
              <DinoPortrait dino={dino} />
              <h2>{unlocked ? dino.name : "等你救援"}</h2>
              <p>{unlocked ? dino.species : "完成一轮来点亮"}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DinoPortrait({ dino }: { dino: Dino }) {
  return (
    <img
      className="dino-portrait"
      src={dinoImages[dino.id]}
      alt={`${dino.species}${dino.name}`}
      aria-label={`${dino.species}${dino.name}`}
    />
  );
}

export default App;
