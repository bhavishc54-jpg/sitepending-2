import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import bgmUrl from './assets/bgm.mp3';
import { 
  LoveHeader 
} from './components/LoveHeader';
import { 
  CuteCat 
} from './components/CuteCat';
import { 
  SweetTransition 
} from './components/SweetTransition';
import { 
  RomanticParticleCanvas, 
  useRomanticTyping, 
  spawnRomanticParticle 
} from './components/CaretParticles';
import { BackgroundHearts } from './components/BackgroundHearts';
import { HeartExplosion } from './components/HeartExplosion';
import { HeartRain } from './components/HeartRain';
import { 
  SL_LINES, 
  QUOTE_POOL, 
  QuestionDef 
} from './types';

export { globalBgm }; // Export just in case we need it anywhere else

// Create a single, stable global Audio instance to prevent duplicate audio playbacks or overlap
const globalBgm = typeof window !== 'undefined' ? new Audio(bgmUrl) : null;
if (globalBgm) {
  globalBgm.loop = true;
  globalBgm.volume = 0.15;
  globalBgm.id = "bgm";
}

// Let's declare our high-quality interactive questions/steps
const QUESTIONS: QuestionDef[] = [
  {
    id: 'q1',
    type: 'textarea',
    title: "How are you feeling right now? 💖",
    subText: "Be honest with me baby...",
    placeholder: "Tell me everything..."
  },
  {
    id: 'q2',
    type: 'textarea',
    title: "Abhi bhi gussa ho mere se? 🥺",
    subText: "Please batao na...",
    placeholder: "Jo feel ho raha hai likh do..."
  },
  {
    id: 'q3',
    type: 'textarea',
    title: "Yrr... Kya ho gaya tha apko? 🥺😢",
    subText: "Pata hai kitna bura laga mujhe kal... Aap ignore toh mat kiya karo. Agar aapka mann nahi ho baat karne ka, toh bas mujhe bata diya karo. Main samajh jaunga. 💗",
    placeholder: "Batao na yrr, kya baat hui thi..."
  },
  {
    id: 'q4',
    type: 'appreciation',
    title: "I Love You So Much ❤️",
    subText: "Meri Cutie Princess 💖👑"
  },
  {
    id: 'q5',
    type: 'textarea',
    title: "Pic kab bhej rahi ho ab? 🥺📸",
    subText: "Mera mann ho raha hai aapko dekhne ka. VN's bhi bhejo! 💕",
    placeholder: "Kab bhejogi? Promise karo..."
  },
  {
    id: 'q6',
    type: 'apology_letter',
    title: "❤️ A Letter For You",
    subText: "Please read this from your heart..."
  },
  {
    id: 'rq1',
    type: 'textarea',
    title: "Are you afraid of losing me?",
    subText: "Tell me honestly, meri jaan...",
    placeholder: "Write what your heart feels..."
  },
  {
    id: 'rq2',
    type: 'textarea',
    title: "What is one thing about me that scares you, and you want me to change or improve?",
    subText: "I promise I will read this softly and understand you.",
    placeholder: "Tell me what I should change or improve..."
  },
  {
    id: 'rq3',
    type: 'textarea',
    title: "Do I make you feel loved, safe, and happy?",
    subText: "Your comfort matters to me the most.",
    placeholder: "Tell me if I make you feel loved, safe, and happy..."
  },
  {
    id: 'rq4',
    type: 'textarea',
    title: "Am I loving you the way you want to be loved?",
    subText: "I want to love you in the way your heart needs.",
    placeholder: "Tell me how you want to be loved..."
  },
  {
    id: 'rq5',
    type: 'textarea',
    title: "I am sorry for the times when I do something wrong. Please don’t get very angry at me, yrr. I get scared when that happens. I really don’t want to hurt you.",
    subText: "This is from my heart. Please write anything you want me to understand.",
    placeholder: "Write your feelings here..."
  },
  {
    id: 'rq6',
    type: 'textarea',
    title: "I will always love you, yrr. My heart beats only for you, and I always keep thinking about you.",
    subText: "A little forever promise from me to you.",
    placeholder: "Write something for me, my princess..."
  },
  {
    id: 'gq1',
    type: 'input',
    title: "Why do you want to open this gift? 🎁",
    subText: "Answer before opening...",
    placeholder: "Because I love you, or because you are curious?"
  },
  {
    id: 'gq2',
    type: 'input',
    title: "What if you don't like the gift? 🎀",
    subText: "One last check...",
    placeholder: "Will you still smile and hug me?"
  }
];

export default function App() {
  // Page states: 'splash' | 'greeting' | 'question_X' | 'gift' | 'ending'
  const [currentPage, setCurrentPage] = useState<string>('splash');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sweetIndex, setSweetIndex] = useState(0);
  const [catClicks, setCatClicks] = useState(0);
  const [picChoice, setPicChoice] = useState('');
  const [forgiveClicks, setForgiveClicks] = useState(0);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [musicOn, setMusicOn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('nikita-love-react');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.musicOn !== undefined) {
          return parsed.musicOn;
        }
      }
    } catch (e) {}
    return false;
  });

  // Animation triggers
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSweetOverlay, setShowSweetOverlay] = useState(false);
  const [sweetLineText, setSweetLineText] = useState('');
  const [nextPageAfterSweet, setNextPageAfterSweet] = useState('');
  const [isPBarGlowing, setIsPBarGlowing] = useState(false);
  const [isPBarPulsing, setIsPBarPulsing] = useState(false);
  const [flyingHearts, setFlyingHearts] = useState<{ id: number; x: number; y: number; tx: number; ty: number }[]>([]);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [isGiftOpened, setIsGiftOpened] = useState(false);
  const [formspreeStatus, setFormspreeStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [showHeartRain, setShowHeartRain] = useState(false);

  // Dodge button relative positions for greeting & dodge questions
  const [greetingDodgePos, setGreetingDodgePos] = useState({ left: '30%', top: '0px' });
  const [picDodgePos, setPicDodgePos] = useState({ left: '30%', top: '0px' });
  const [forgiveDodgePos, setForgiveDodgePos] = useState({ left: '60%', top: '70px' });

  // Floating background petals (persistent)
  const [petals, setPetals] = useState<{ id: number; left: number; delay: number; duration: number; size: number }[]>([]);

  // Sound Synth Functions using Web Audio API
  const playCaretSfx = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  };

  const playPrimarySfx = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  const playSparkleSfx = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [0, 0.08, 0.16].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000 + delay * 500, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.04, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.12);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.12);
      });
    } catch (e) {}
  };

  const playEndingSfx = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [0, 0.1, 0.2, 0.3].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(500 + delay * 300, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.03, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.15);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.15);
      });
    } catch (e) {}
  };

  // Typing hook references for standard inputs
  const typing1 = useRomanticTyping<HTMLTextAreaElement>();
  const typing2 = useRomanticTyping<HTMLTextAreaElement>();
  const typing3 = useRomanticTyping<HTMLTextAreaElement>();
  const typing4 = useRomanticTyping<HTMLTextAreaElement>();
  const typing5 = useRomanticTyping<HTMLTextAreaElement>();
  const typing7 = useRomanticTyping<HTMLTextAreaElement>();
  const typing8 = useRomanticTyping<HTMLTextAreaElement>();
  const typing10 = useRomanticTyping<HTMLTextAreaElement>();
  const typingGq1 = useRomanticTyping<HTMLInputElement>();
  const typingGq2 = useRomanticTyping<HTMLInputElement>();
  const typingReview = useRomanticTyping<HTMLTextAreaElement>();

  // Map each question ID to its typing hook
  const getTypingProps = (id: string) => {
    switch (id) {
      case 'q1': return typing1;
      case 'q2': return typing2;
      case 'q3': return typing3;
      case 'q4': return typing4;
      case 'q5': return typing5;
      case 'q7': return typing7;
      case 'q8': return typing8;
      case 'q10': return typing10;
      case 'gq1': return typingGq1;
      case 'gq2': return typingGq2;
      default: return { ref: null, handleInput: undefined };
    }
  };

  // Clock state
  const [currentTimeText, setCurrentTimeText] = useState('');

  useEffect(() => {
    // Generate background falling petals
    const items = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 8,
      duration: Math.random() * 6 + 8,
      size: Math.random() * 10 + 8
    }));
    setPetals(items);

    // Load initial clock
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      };
      const dateStr = now.toLocaleDateString('en-IN', options);
      const timeStr = now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      setCurrentTimeText(`${dateStr} | ${timeStr}`);
    };
    updateTime();
    const clockTimer = setInterval(updateTime, 1000);

    // LocalStorage loading
    try {
      const saved = localStorage.getItem('nikita-love-react');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.currentPage) {
          setCurrentPage(parsed.currentPage);
          if (parsed.currentPage === 'ending') {
            setShowHeartRain(true);
          }
        }
        if (parsed.answers) setAnswers(parsed.answers);
        if (parsed.sweetIndex) setSweetIndex(parsed.sweetIndex);
        if (parsed.picChoice) setPicChoice(parsed.picChoice);
        if (parsed.rating) setRating(parsed.rating);
        if (parsed.reviewText) setReviewText(parsed.reviewText);
        if (parsed.musicOn) setMusicOn(parsed.musicOn);
      }
    } catch (e) {}

    return () => clearInterval(clockTimer);
  }, []);

  // Audio helper functions using global single Audio instance
  const playBGM = () => {
    if (!globalBgm) {
      console.warn("[BGM Warning] playBGM called but globalBgm is null (server-side environment).");
      return;
    }
    
    console.log("[BGM Info] playBGM() triggered. Current paused state:", globalBgm.paused, "Muted:", globalBgm.muted, "Loop:", globalBgm.loop);
    
    if ((globalBgm as any)._fadeInterval) {
      clearInterval((globalBgm as any)._fadeInterval);
    }
    
    globalBgm.muted = false;
    globalBgm.loop = true; // Ensure loop is strictly true
    
    const triggerFadeIn = () => {
      let vol = globalBgm.volume;
      const targetVolume = 0.15; // Confirmed target volume is exactly 0.15 as requested
      const duration = 2000; // 2 seconds fade-in
      const intervalTime = 50;
      const stepAmount = targetVolume / (duration / intervalTime);

      console.log("[BGM Info] Fade-in initiated from volume:", vol, "Target volume:", targetVolume);

      const interval = setInterval(() => {
        if (globalBgm) {
          vol = Math.min(targetVolume, vol + stepAmount);
          globalBgm.volume = vol;
          if (vol >= targetVolume) {
            clearInterval(interval);
            console.log("[BGM Info] Fade-in completed. Target volume reached:", globalBgm.volume);
          }
        } else {
          clearInterval(interval);
        }
      }, intervalTime);
      (globalBgm as any)._fadeInterval = interval;
    };

    if (globalBgm.paused) {
      globalBgm.volume = 0;
      const playPromise = globalBgm.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("[BGM Success] Audio play promise resolved successfully.");
            triggerFadeIn();
          })
          .catch(err => {
            console.error("[BGM Error] play() promise was rejected. Browser autoplay or document gesture block detected:", err);
          });
      } else {
        console.log("[BGM Success] Audio started playing (no promise returned).");
        triggerFadeIn();
      }
    } else {
      console.log("[BGM Info] Audio is already playing. Adjusting volume...");
      triggerFadeIn();
    }
  };

  const pauseBGM = () => {
    if (!globalBgm) {
      console.warn("[BGM Warning] pauseBGM called but globalBgm is null.");
      return;
    }
    
    console.log("[BGM Info] pauseBGM() triggered. Current volume:", globalBgm.volume);
    
    if ((globalBgm as any)._fadeInterval) {
      clearInterval((globalBgm as any)._fadeInterval);
    }
    
    let vol = globalBgm.volume;
    const duration = 500;
    const intervalTime = 50;
    const stepAmount = vol > 0 ? (vol / (duration / intervalTime)) : 0.01;

    const interval = setInterval(() => {
      if (globalBgm) {
        vol = Math.max(0, vol - stepAmount);
        globalBgm.volume = vol;
        if (vol <= 0) {
          clearInterval(interval);
          globalBgm.pause();
          console.log("[BGM Info] Fade-out completed. Audio paused successfully.");
        }
      } else {
        clearInterval(interval);
      }
    }, intervalTime);
    (globalBgm as any)._fadeInterval = interval;
  };

  // Re-sync background audio state on mount or interaction if needed
  useEffect(() => {
    const syncAudioOnInteraction = () => {
      if (musicOn && globalBgm && globalBgm.paused) {
        playBGM();
      }
    };
    window.addEventListener('click', syncAudioOnInteraction, { once: true });
    window.addEventListener('touchstart', syncAudioOnInteraction, { once: true });
    
    return () => {
      window.removeEventListener('click', syncAudioOnInteraction);
      window.removeEventListener('touchstart', syncAudioOnInteraction);
    };
  }, [musicOn]);

  // Synchronize musicOn changes to LocalStorage instantly
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nikita-love-react');
      let data: any = {};
      if (saved) {
        data = JSON.parse(saved);
      }
      data.musicOn = musicOn;
      localStorage.setItem('nikita-love-react', JSON.stringify(data));
    } catch (e) {}
  }, [musicOn]);

  // Persist state to LocalStorage
  const saveToLocal = (updatedPage?: string, updatedAnswers?: any) => {
    try {
      const data = {
        currentPage: updatedPage || currentPage,
        answers: updatedAnswers || answers,
        sweetIndex,
        picChoice,
        rating,
        reviewText,
        musicOn
      };
      localStorage.setItem('nikita-love-react', JSON.stringify(data));
    } catch (e) {}
  };

  // Sound effects click wrappers
  const handleStartMusic = () => {
    playPrimarySfx();
    setMusicOn(true);
    playBGM();
    setCurrentPage('greeting');
    saveToLocal('greeting');
  };

  // Dodge coordinate jumps
  const dodgeGreetingButton = () => {
    const randomLeft = Math.floor(Math.random() * 60 + 10) + '%';
    const randomTop = Math.floor(Math.random() * 120 - 40) + 'px';
    setGreetingDodgePos({ left: randomLeft, top: randomTop });
  };

  const dodgePicButton = () => {
    const randomLeft = Math.floor(Math.random() * 60 + 10) + '%';
    const randomTop = Math.floor(Math.random() * 120 - 40) + 'px';
    setPicDodgePos({ left: randomLeft, top: randomTop });
  };

  const dodgeForgiveButton = () => {
    const randomLeft = Math.floor(Math.random() * 60 + 10) + '%';
    const randomTop = Math.floor(Math.random() * 120 - 40) + 'px';
    setForgiveDodgePos({ left: randomLeft, top: randomTop });
  };

  // Heart flying from button toward progress bar
  const triggerFlyingHeart = (clickEvent: React.MouseEvent<HTMLButtonElement>) => {
    const targetHeader = document.querySelector('.fixed.top-3');
    if (!targetHeader) return;
    
    const targetRect = targetHeader.getBoundingClientRect();
    const startX = clickEvent.clientX;
    const startY = clickEvent.clientY;
    
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;

    const id = Date.now();
    setFlyingHearts(prev => [...prev, { id, x: startX, y: startY, tx: endX, ty: endY }]);

    // Clean up flying heart after animation finishes
    setTimeout(() => {
      setFlyingHearts(prev => prev.filter(h => h.id !== id));
      // Trigger header glowing/pulsing
      setIsPBarGlowing(true);
      setIsPBarPulsing(true);
      setTimeout(() => {
        setIsPBarGlowing(false);
        setIsPBarPulsing(false);
      }, 1000);
    }, 700);
  };

  // Proceeding questions
  const handleNextQuestion = (qId: string, value: string, e: React.MouseEvent<HTMLButtonElement>) => {
    // Sound effect
    playPrimarySfx();

    // Trigger flying heart from click coordinate
    triggerFlyingHeart(e);

    // Save answer
    const nextAnswers = { ...answers, [qId]: value };
    setAnswers(nextAnswers);

    // Apply 0.5s local text glowing visual before sweet line transition
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);

      // Select sweet line
      const line = SL_LINES[sweetIndex % SL_LINES.length];
      setSweetLineText(line);
      setSweetIndex(prev => prev + 1);

      // Show sweet line screen
      setShowSweetOverlay(true);

      // Determine next screen
      const currentQIdx = QUESTIONS.findIndex(q => q.id === qId);
      const nextQ = QUESTIONS[currentQIdx + 1];

      if (nextQ) {
        setNextPageAfterSweet(`question_${nextQ.id}`);
      } else {
        // Questions completed, move to unboxing
        setNextPageAfterSweet('gift');
      }
    }, 550);
  };

  const handleSweetComplete = () => {
    setShowSweetOverlay(false);
    setCurrentPage(nextPageAfterSweet);
    saveToLocal(nextPageAfterSweet);
  };

  // Forgiving action (Q12) requires 3 taps
  const handleForgiveTap = () => {
    playPrimarySfx();
    const nextCount = forgiveClicks + 1;
    setForgiveClicks(nextCount);

    if (nextCount === 1) {
      // Spawn extra sparkles
      for (let i = 0; i < 15; i++) {
        spawnRomanticParticle(window.innerWidth / 2 + (Math.random() * 200 - 100), window.innerHeight / 2 + (Math.random() * 200 - 100));
      }
    } else if (nextCount === 2) {
      // Spawn more sparkles
      for (let i = 0; i < 25; i++) {
        spawnRomanticParticle(window.innerWidth / 2 + (Math.random() * 200 - 100), window.innerHeight / 2 + (Math.random() * 200 - 100));
      }
    } else if (nextCount >= 3) {
      playSparkleSfx();
      // Burst confetti
      for (let i = 0; i < 40; i++) {
        spawnRomanticParticle(window.innerWidth / 2 + (Math.random() * 300 - 150), window.innerHeight / 2 + (Math.random() * 300 - 150));
      }
      
      // Save answer and proceed to next page (gq1)
      const nextAnswers = { ...answers, forgive: 'forgiven' };
      setAnswers(nextAnswers);
      
      // Proceed via Sweet overlay
      const line = SL_LINES[sweetIndex % SL_LINES.length];
      setSweetLineText(line);
      setSweetIndex(prev => prev + 1);
      setShowSweetOverlay(true);
      setNextPageAfterSweet('question_gq1');
    }
  };

  // Handle Easter Egg
  const handleTapCat = () => {
    const clicks = catClicks + 1;
    setCatClicks(clicks);
    if (clicks >= 5) {
      playSparkleSfx();
      setShowEasterEgg(true);
      setCatClicks(0);
    }
  };

  // Unboxing gift box
  const handleOpenGift = () => {
    playSparkleSfx();
    setIsGiftOpened(true);
  };

  // Form submission to Formspree
  const handleSubmitReview = async () => {
    playEndingSfx();
    setFormspreeStatus('sending');

    // Setup payload matching original labels exactly
    const payload: Record<string, string> = {
      '_subject': 'Someone answered your love website! 💖👑',
      'Greeting Choice': answers['greeting'] || '(not chosen)',
      'Q1 - How feeling right now': answers['q1'] || '',
      'Q2 - Abhi bhi gussa ho': answers['q2'] || '',
      'Q3 - Yrr... Kya ho gaya tha': answers['q3'] || '',
      'Q4 - Romantic appreciation': answers['q4'] || 'Read and continued 💌',
      'Q5 - Pic kab bhej rahi ho': answers['q5'] || '',
      'Q6 - Apology Letter Response': answers['q6'] || 'I Forgive You 💖',
      'Romantic Q1 - Afraid of losing me': answers['rq1'] || '',
      'Romantic Q2 - What scares you / change or improve': answers['rq2'] || '',
      'Romantic Q3 - Loved safe and happy': answers['rq3'] || '',
      'Romantic Q4 - Loving you the way you want': answers['rq4'] || '',
      'Romantic Q5 - Sorry anger scared': answers['rq5'] || '',
      'Romantic Q6 - Always love you': answers['rq6'] || '',
      'Gift Q1 - Why open': answers['gq1'] || '',
      'Gift Q2 - What if you dont like': answers['gq2'] || '',
      'Heart Rating': `${rating} / 5 💖`,
      'Review/Message': reviewText
    };

    try {
      const res = await fetch('https://formspree.io/f/xnjkpozb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setFormspreeStatus('success');
        setTimeout(() => {
          setCurrentPage('ending');
          saveToLocal('ending');
          setShowHeartRain(true);
        }, 2200);
      } else {
        setFormspreeStatus('error');
      }
    } catch (err) {
      setFormspreeStatus('error');
    }
  };

  // Reset to begin again
  const handleReset = () => {
    localStorage.removeItem('nikita-love-react');
    setCurrentPage('splash');
    setShowHeartRain(false);
    setAnswers({});
    setRating(0);
    setReviewText('');
    setPicChoice('');
    setIsGiftOpened(false);
    setForgiveClicks(0);
    setFormspreeStatus('idle');
  };

  // Find if we are currently displaying an active question screen
  const activeQuestionId = currentPage.startsWith('question_') ? currentPage.replace('question_', '') : '';
  const currentQuestionIdx = QUESTIONS.findIndex(q => q.id === activeQuestionId);
  const currentQuestionNum = currentQuestionIdx !== -1 ? currentQuestionIdx + 1 : 1;
  const isQuestionScreen = activeQuestionId !== '';

  return (
    <div className="relative min-h-screen bg-[#1a050d] text-[#fff0f3] font-sans flex flex-col justify-between overflow-x-hidden pt-24 pb-8">
      {/* Background Mouse Hover Hearts Effect */}
      <BackgroundHearts />
      {/* Background Soft Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-[#ff4d6d] rounded-full blur-[160px] opacity-20" />
        <div className="absolute bottom-[-100px] right-[-100px] w-[500px] h-[500px] bg-[#ff85a1] rounded-full blur-[160px] opacity-10" />
        <div className="absolute top-[35%] left-[25%] w-[400px] h-[400px] bg-pink-400/5 rounded-full blur-[120px]" />
      </div>

      {/* Background Petals Falling */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-10">
        {petals.map(p => (
          <div
            key={p.id}
            className="petal"
            style={{
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              width: `${p.size}px`,
              height: `${p.size}px`
            }}
          />
        ))}
      </div>

      {/* Background Hearts on Mouse Move */}
      <BackgroundHearts />

      {/* Magical Heart Rain finale effect */}
      {showHeartRain && <HeartRain />}



      {/* Floating Music Toggle Button */}
      <motion.button
        className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-full border border-white/15 bg-white/5 backdrop-blur-md flex items-center gap-2 text-xs font-sans font-semibold text-[#fff0f3] opacity-75 hover:opacity-100 transition-opacity cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.3)] border-white/10"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          const newState = !musicOn;
          setMusicOn(newState);
          if (newState) playBGM();
          else pauseBGM();
        }}
      >
        <span>{musicOn ? '🎵 Music On' : '🔇 Music Off'}</span>
      </motion.button>

      {/* Floating Hearts Animation Layer */}
      {flyingHearts.map(h => (
        <motion.div
          key={h.id}
          className="fixed text-xl z-[9999] pointer-events-none"
          initial={{ left: h.x, top: h.y, scale: 1, opacity: 1 }}
          animate={{ left: h.tx, top: h.ty, scale: 0.4, opacity: 0.7 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          💖
        </motion.div>
      ))}

      {/* Caret Particles Canvas */}
      <RomanticParticleCanvas />

      {/* Floating Redesigned Progress Header */}
      {isQuestionScreen && (
        <LoveHeader
          currentQuestion={currentQuestionNum}
          totalQuestions={QUESTIONS.length}
          isGlowing={isPBarGlowing}
          isPulsing={isPBarPulsing}
        />
      )}

      {/* Main Content Area */}
      <main className="w-full max-w-lg mx-auto px-4 z-20 flex-grow flex items-center justify-center">
        <AnimatePresence mode="wait">

          {/* 1. SPLASH SCREEN */}
          {currentPage === 'splash' && (
            <motion.div
              key="splash"
              className="w-full flex flex-col items-center"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.5 }}
            >
              {/* Elegant local Indian Clock */}
              <div className="font-mono text-pink-300/80 text-[10px] uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full border border-white/10 mb-6 font-bold">
                {currentTimeText || 'Princess 🌸'}
              </div>

              {/* Central Bouncing Cutie Cat */}
              <div className="relative mb-6">
                <CuteCat big onClickCat={handleTapCat} />
              </div>

              {/* Glass Greeting Card */}
              <div className="w-full rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 text-center shadow-[0_15px_45px_rgba(0,0,0,0.5)]">
                <h1 className="font-display font-light italic text-[#fff0f3] text-2xl sm:text-3xl mb-3 tracking-tight leading-tight">
                  For My Princess 💖
                </h1>
                <p className="font-sans text-pink-300/60 uppercase tracking-widest text-[10px] sm:text-xs mb-4 font-bold">
                  A little interactive love card made with all my love...
                </p>
                <p className="font-sans text-white/40 text-xs mb-8">
                  Every page brings you closer to my heart ✉️
                </p>
                <button
                  className="w-full sm:w-auto px-10 py-3.5 bg-white text-[#1a050d] rounded-full text-xs uppercase tracking-[0.2em] font-outfit font-bold shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:shadow-[0_10px_35px_rgba(255,77,109,0.3)] transition-all hover:scale-[1.03] active:scale-95 duration-200 cursor-pointer"
                  onClick={handleStartMusic}
                >
                  Yes, I'm Ready 💌
                </button>
              </div>
            </motion.div>
          )}

          {/* 2. GREETING SCREEN */}
          {currentPage === 'greeting' && (
            <motion.div
              key="greeting"
              className="w-full"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              <div className="w-full rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 text-center shadow-[0_15px_45px_rgba(0,0,0,0.5)] relative">
                {/* Cat helper */}
                <div className="absolute top-[-30px] right-[-10px]">
                  <CuteCat onClickCat={handleTapCat} />
                </div>

                <h2 className="font-display font-light italic text-[#fff0f3] text-2xl sm:text-3xl mb-3 tracking-tight leading-tight">
                  Hey, Princess 👑
                </h2>
                <p className="font-sans text-pink-300/60 uppercase tracking-widest text-[10px] sm:text-xs mb-8 font-bold">
                  How's my baby doing today?
                </p>

                {answers['greeting'] ? (
                  <motion.div
                    className="flex flex-col items-center gap-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <p className="font-sans text-white/90 text-sm sm:text-base leading-relaxed max-w-xs mb-6">
                      Aww! Whatever your mood, I'm always here for you my jaan 💖
                    </p>
                    <button
                      className="px-10 py-3.5 bg-white text-[#1a050d] rounded-full text-xs uppercase tracking-[0.2em] font-outfit font-bold shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:shadow-[0_10px_35px_rgba(255,77,109,0.3)] transition-all hover:scale-[1.03] active:scale-95 duration-200 cursor-pointer"
                      onClick={() => {
                        playPrimarySfx();
                        setCurrentPage(`question_${QUESTIONS[0].id}`);
                        saveToLocal(`question_${QUESTIONS[0].id}`);
                      }}
                    >
                      Chalein aage? 💌
                    </button>
                  </motion.div>
                ) : (
                  <div className="flex flex-col gap-4 relative min-h-[140px]">
                    <button
                      className="w-full py-3.5 bg-white text-[#1a050d] rounded-full text-xs uppercase tracking-[0.2em] font-outfit font-bold shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:shadow-[0_10px_35px_rgba(255,77,109,0.3)] transition-all hover:scale-[1.02] active:scale-95 duration-200 cursor-pointer"
                      onClick={() => {
                        playPrimarySfx();
                        const nextAns = { ...answers, greeting: 'Haan baby I am fine' };
                        setAnswers(nextAns);
                        saveToLocal('greeting', nextAns);
                      }}
                    >
                      Haan baby, I'm fine 😊
                    </button>

                    <div className="relative h-12 w-full">
                      <button
                        className="absolute w-2/3 left-1/2 -translate-x-1/2 py-2 px-4 rounded-full border border-white/20 bg-white/5 text-white/90 font-sans text-xs sm:text-sm cursor-pointer whitespace-nowrap hover:bg-white/10 transition-colors"
                        style={{
                          left: greetingDodgePos.left,
                          top: greetingDodgePos.top,
                          transition: 'all 0.15s cubic-bezier(0.25, 0.8, 0.25, 1)'
                        }}
                        onMouseEnter={dodgeGreetingButton}
                        onTouchStart={dodgeGreetingButton}
                        onClick={dodgeGreetingButton}
                      >
                        Nahi baat nahi karungi 😡
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* 3. DYNAMIC 14 QUESTIONS LOOP */}
          {isQuestionScreen && (() => {
            const currentQ = QUESTIONS[currentQuestionNum - 1];
            if (!currentQ) return null;

            const hookProps = getTypingProps(currentQ.id);

            return (
              <motion.div
                key={currentQ.id}
                className="w-full"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.4 }}
              >
                <div className="w-full rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 sm:p-8 shadow-[0_15px_45px_rgba(0,0,0,0.5)] relative text-[#fff0f3]">
                  {/* Floating Cat Companion */}
                  <div className="absolute top-[-30px] right-[-10px]">
                    <CuteCat onClickCat={handleTapCat} />
                  </div>

                  <h2 className="font-display font-light italic text-[#fff0f3] text-xl sm:text-2xl md:text-3xl mb-2 text-center leading-tight tracking-tight">
                    {currentQ.title}
                  </h2>
                  <p className="font-sans text-pink-300/60 uppercase tracking-widest text-[10px] sm:text-xs text-center mb-6 font-bold">
                    {currentQ.subText}
                  </p>

                  {/* Rendering based on Question Type */}
                  {currentQ.type === 'textarea' && (
                    <div className="flex flex-col gap-4">
                      <div className="relative group w-full">
                        <textarea
                          ref={hookProps.ref as React.RefObject<HTMLTextAreaElement>}
                          onInput={hookProps.handleInput}
                          className={`w-full min-h-[120px] p-4 bg-white/5 border-b border-white/20 text-[#fff0f3] text-sm focus:bg-white/10 outline-none resize-none transition-all duration-300 rounded-t-xl placeholder:text-white/20 focus:border-pink-400 focus:ring-0 ${
                            isSubmitting ? 'bg-pink-900/20 border-pink-400 shadow-lg' : ''
                          }`}
                          placeholder={currentQ.placeholder}
                          value={answers[currentQ.id] || ''}
                          onChange={(e) => setAnswers({ ...answers, [currentQ.id]: e.target.value })}
                        />
                        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-pink-400/50 to-transparent"></div>
                      </div>
                      <button
                        className="w-full sm:w-auto self-center px-10 py-3 bg-white text-[#1a050d] rounded-full text-xs uppercase tracking-[0.2em] font-outfit font-bold shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:shadow-[0_10px_35px_rgba(255,77,109,0.3)] transition-all cursor-pointer hover:scale-[1.03] active:scale-95 duration-200"
                        disabled={!(answers[currentQ.id]?.trim())}
                        style={{ opacity: answers[currentQ.id]?.trim() ? 1 : 0.4 }}
                        onClick={(e) => handleNextQuestion(currentQ.id, answers[currentQ.id], e)}
                      >
                        Next 💌
                      </button>
                    </div>
                  )}

                  {currentQ.type === 'input' && (
                    <div className="flex flex-col gap-4">
                      <div className="relative group w-full">
                        <input
                          type="text"
                          ref={hookProps.ref as React.RefObject<HTMLInputElement>}
                          onInput={hookProps.handleInput}
                          className={`w-full p-4 bg-white/5 border-b border-white/20 text-[#fff0f3] text-sm focus:bg-white/10 outline-none transition-all duration-300 rounded-t-xl placeholder:text-white/20 focus:border-pink-400 focus:ring-0 ${
                            isSubmitting ? 'bg-pink-900/20 border-pink-400 shadow-lg' : ''
                          }`}
                          placeholder={currentQ.placeholder}
                          value={answers[currentQ.id] || ''}
                          onChange={(e) => setAnswers({ ...answers, [currentQ.id]: e.target.value })}
                        />
                        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-pink-400/50 to-transparent"></div>
                      </div>
                      <button
                        className="w-full sm:w-auto self-center px-10 py-3 bg-white text-[#1a050d] rounded-full text-xs uppercase tracking-[0.2em] font-outfit font-bold shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:shadow-[0_10px_35px_rgba(255,77,109,0.3)] transition-all cursor-pointer hover:scale-[1.03] active:scale-95 duration-200"
                        disabled={!(answers[currentQ.id]?.trim())}
                        style={{ opacity: answers[currentQ.id]?.trim() ? 1 : 0.4 }}
                        onClick={(e) => handleNextQuestion(currentQ.id, answers[currentQ.id], e)}
                      >
                        Next 💌
                      </button>
                    </div>
                  )}

                  {currentQ.type === 'appreciation' && (
                    <div className="flex flex-col gap-6 text-center py-4 items-center">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8 }}
                        className="border border-white/10 bg-white/5 rounded-2xl p-6 leading-relaxed max-w-md shadow-inner"
                      >
                        <p className="font-sans text-pink-100 text-sm sm:text-base leading-relaxed mb-4">
                          You are my absolute favorite person, my dream come true, and the most precious gift in my life. Every single heartbeat of mine belongs only to you. 💖
                        </p>
                        <p className="font-sans text-pink-200 text-sm sm:text-base leading-relaxed">
                          You make my world incredibly beautiful just by being in it. I am forever deeply in love with you, my princess! ✨🌸
                        </p>
                      </motion.div>
                      
                      <button
                        className="px-10 py-3.5 bg-white text-[#1a050d] rounded-full text-xs uppercase tracking-[0.2em] font-outfit font-bold shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:shadow-[0_10px_35px_rgba(255,77,109,0.3)] transition-all cursor-pointer hover:scale-[1.03] active:scale-95 duration-200"
                        onClick={(e) => handleNextQuestion(currentQ.id, 'appreciation_read', e)}
                      >
                        Continue 💌
                      </button>
                    </div>
                  )}

                  {currentQ.type === 'apology_letter' && (() => {
                    const letterParagraphs = [
                      "Sorry for yesterday and for the day when I wasn't able to give you enough attention.",
                      "I really love you so much.",
                      "Because of some reasons, I wasn't available the way I wanted to be.",
                      "I'm truly sorry for making you feel ignored.",
                      "I'm still learning every day to become the best person I can be for you.",
                      "Please forgive me.",
                      "Trust me, I'll always keep improving myself for us.",
                      "I would never hurt you intentionally.",
                      "It was a mistake, and I'm genuinely sorry.",
                      "I love you more than words can ever explain. ❤️🌸"
                    ];

                    return (
                      <div className="flex flex-col gap-6">
                        <div className="border border-white/10 bg-white/5 rounded-2xl p-5 sm:p-7 text-sm sm:text-base text-[#fff0f3] leading-relaxed font-sans max-h-[400px] overflow-y-auto shadow-inner">
                          <p className="font-bold mb-4 text-[#ff85a1] text-lg">Dear Princess,</p>
                          <div className="flex flex-col gap-3">
                            {letterParagraphs.map((para, idx) => (
                              <motion.p
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.4, duration: 0.6 }}
                                className="text-white/90 text-sm sm:text-base"
                              >
                                {para}
                              </motion.p>
                            ))}
                          </div>
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: letterParagraphs.length * 0.4 + 0.3, duration: 0.8 }}
                            className="text-right italic font-display font-bold text-[#ff85a1] mt-6"
                          >
                            Forever Yours,<br />Your Bhavish 💖
                          </motion.p>
                        </div>
                        <motion.button
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: letterParagraphs.length * 0.4 + 0.6, duration: 0.5 }}
                          className="w-full sm:w-auto self-center px-12 py-3.5 bg-gradient-to-r from-[#ff4d6d] to-[#ff85a1] text-white rounded-full text-xs uppercase tracking-[0.2em] font-outfit font-bold shadow-[0_10px_30px_rgba(255,77,109,0.25)] hover:shadow-[0_10px_35px_rgba(255,77,109,0.5)] transition-all cursor-pointer hover:scale-[1.03] active:scale-95 duration-200"
                          onClick={(e) => handleNextQuestion(currentQ.id, 'apology_forgiven', e)}
                        >
                          I Forgive You 💖
                        </motion.button>
                      </div>
                    );
                  })()}

                </div>
              </motion.div>
            );
          })()}

          {/* 4. GIFT UNBOXING SCREEN */}
          {currentPage === 'gift' && (
            <>
              <HeartExplosion />
              <motion.div
                key="gift"
                className="w-full"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.5 }}
              >
              <div className="w-full rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 sm:p-8 shadow-[0_15px_45px_rgba(0,0,0,0.5)] text-center relative text-[#fff0f3]">
                <div className="absolute top-[-30px] right-[-10px]">
                  <CuteCat onClickCat={handleTapCat} />
                </div>

                <h2 className="font-display font-light italic text-[#fff0f3] text-xl sm:text-2xl mb-4 tracking-tight">
                  A Special Gift 🎁
                </h2>

                {!isGiftOpened ? (
                  <div className="flex flex-col items-center">
                    <p className="font-sans text-pink-300/60 uppercase tracking-widest text-[10px] sm:text-xs mb-6 font-bold">
                      Tap the glowing gift box to unbox it! 💖
                    </p>

                    <motion.div
                      className="w-40 h-40 cursor-pointer flex items-center justify-center relative"
                      onClick={handleOpenGift}
                      animate={{
                        scale: [1, 1.05, 1],
                        rotate: [0, -2, 2, 0],
                        filter: [
                          'drop-shadow(0 0 8px rgba(255,77,109,0.25))',
                          'drop-shadow(0 0 20px rgba(255,77,109,0.5))',
                          'drop-shadow(0 0 8px rgba(255,77,109,0.25))'
                        ]
                      }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                      whileHover={{ scale: 1.12 }}
                    >
                      <svg viewBox="0 0 120 120" className="w-32 h-32">
                        <rect x="15" y="45" width="90" height="65" rx="8" fill="#e01e5a" stroke="#fff" strokeWidth="2.5" />
                        <rect x="10" y="32" width="100" height="20" rx="5" fill="#fff" />
                        <rect x="51" y="32" width="18" height="78" fill="#ffb6d3" opacity="0.6" />
                        <path d="M60 32C60 16 43 5 38 10S33 32 60 32" fill="#fff" />
                        <path d="M60 32C60 16 77 5 82 10S87 32 60 32" fill="#e01e5a" />
                      </svg>
                    </motion.div>

                    <p className="text-xs text-white/40 mt-6 italic">
                      Made with all my heart just for you 🌸
                    </p>
                  </div>
                ) : (
                  <motion.div
                    className="flex flex-col items-center"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                  >
                    {/* Glowing Shayari Poem */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 text-white/90 font-display italic text-sm sm:text-base leading-relaxed tracking-tight max-w-sm mx-auto shadow-inner shadow-white/5">
                      <p className="mb-2">"Meri Ankhon ke samne tera Chehra ho,"</p>
                      <p className="mb-2">"Tere Chehre Par Mera Pehara Ho,"</p>
                      <p className="mb-2">"Tujhe Mujhse Ishq ho Kudha kare,"</p>
                      <p className="font-bold text-[#ff85a1]">"YEH ISHQ SAMANDAR SE BHE GEHRA HO."</p>
                    </div>

                    <p className="font-display font-light text-[#fff0f3] text-base mb-6">
                      Thank you for being mine 🌸💖
                    </p>

                    {/* Interactive Ratings & Submission */}
                    <div className="w-full border-t border-white/10 pt-6">
                      <p className="text-xs text-pink-300/60 uppercase tracking-widest mb-3 font-bold">
                        Rate our love journey
                      </p>

                      <div className="flex gap-2 justify-center mb-6">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <motion.button
                            key={val}
                            className={`text-3xl focus:outline-none cursor-pointer`}
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              playPrimarySfx();
                              setRating(val);
                            }}
                          >
                            {rating >= val ? '💖' : '🖤'}
                          </motion.button>
                        ))}
                      </div>

                      <p className="text-xs text-pink-300/60 uppercase tracking-widest mb-2 font-bold text-left">
                        Write something sweet for Bhavish... 💌
                      </p>

                      <textarea
                        ref={typingReview.ref as React.RefObject<HTMLTextAreaElement>}
                        onInput={typingReview.handleInput}
                        className="w-full min-h-[90px] p-3 rounded-xl border border-white/10 bg-white/5 text-[#fff0f3] text-sm focus:bg-white/10 outline-none resize-none mb-4"
                        placeholder="Dil ki baatein likh do..."
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                      />

                      {formspreeStatus === 'sending' ? (
                        <div className="flex flex-col items-center gap-2 mt-2">
                          <div className="w-6 h-6 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
                          <p className="text-xs text-pink-300/70 italic">Sending your thoughts to Bhavish...</p>
                        </div>
                      ) : formspreeStatus === 'success' ? (
                        <p className="text-sm text-green-400 font-semibold mb-2">
                          Sent! Sab kuch Bhavish tak pahuch gaya! 💌
                        </p>
                      ) : (
                        <button
                          className="w-full py-3.5 bg-white text-[#1a050d] rounded-full text-xs uppercase tracking-[0.2em] font-outfit font-bold shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:shadow-[0_10px_35px_rgba(255,77,109,0.3)] transition-all cursor-pointer disabled:opacity-50"
                          disabled={rating === 0 || reviewText.trim().length < 3}
                          onClick={handleSubmitReview}
                        >
                          Send Everything to Bhavish 💌
                        </button>
                      )}

                      {formspreeStatus === 'error' && (
                        <p className="text-xs text-red-400 mt-2">
                          Could not send - check internet and try again.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </>
          )}

          {/* 5. ENDING SCREEN */}
          {currentPage === 'ending' && (
            <motion.div
              key="ending"
              className="w-full"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.6 }}
            >
              <div className="w-full rounded-2xl bg-gradient-to-br from-[#2c0b17] to-[#1a050d] border border-white/10 p-8 text-center text-[#fff0f3] shadow-[0_15px_45px_rgba(0,0,0,0.5)] relative overflow-hidden">
                {/* Floating Cosmic Stars inside ending box */}
                <div className="absolute inset-0 pointer-events-none opacity-45">
                  <div className="absolute top-[20%] left-[10%] w-1.5 h-1.5 bg-white rounded-full animate-ping duration-1000" />
                  <div className="absolute top-[60%] right-[15%] w-1.5 h-1.5 bg-white rounded-full animate-ping duration-[1.5s]" />
                  <div className="absolute bottom-[20%] left-[40%] w-1 h-1 bg-white rounded-full animate-pulse" />
                </div>

                <motion.div
                  className="text-4xl sm:text-5xl mb-6 inline-block"
                  animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                >
                  💖
                </motion.div>

                <h2 className="font-display font-light italic text-[#fff0f3] text-2xl sm:text-3xl mb-4 tracking-tight">
                  Thank you, Princess 💖
                </h2>
                
                <p className="font-sans text-pink-100/90 text-sm sm:text-base leading-relaxed max-w-xs mx-auto mb-6 italic">
                  For spending your precious time with me...
                </p>

                <p className="font-sans text-pink-300/60 uppercase tracking-widest text-[10px] sm:text-xs mb-8 font-bold">
                  Until our next little adventure...
                </p>

                <button
                  className="px-6 py-2 rounded-full border border-white/20 bg-white/5 text-white/90 hover:bg-white/10 text-xs tracking-wider transition-colors duration-200 cursor-pointer"
                  onClick={handleReset}
                >
                  Start Over 🌸
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Floating Sweettransition Overlay Overlay */}
      <SweetTransition
        text={sweetLineText}
        isOpen={showSweetOverlay}
        onComplete={handleSweetComplete}
      />

      {/* Bottom info spacer to avoid layout overlapping */}
      <footer className="w-full text-center text-[10px] text-pink-300/30 font-sans mt-8 select-none pointer-events-none uppercase tracking-widest font-bold">
        Copyright © 2026 Bhavish. All Rights Reserved.
      </footer>
    </div>
  );
}
