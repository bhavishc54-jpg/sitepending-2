export interface SurveyState {
  currentPage: string;
  answers: Record<string, string>;
  sweetIndex: number;
  catClicks: number;
  picChoice: string;
  forgiveClicks: number;
  rating: number;
  review: string;
  musicOn: boolean;
}

export interface QuestionDef {
  id: string;
  type: 'textarea' | 'statement' | 'dodge_pic' | 'dodge_forgive' | 'input' | 'sorry_letter' | 'appreciation' | 'apology_letter';
  title: string;
  subText: string;
  placeholder?: string;
}

export const SL_LINES = [
  "Tum meri zindagi ka sabse khoobsurat hissa ho... 🌸",
  "Har pal tere saath bitana chahta hoon... 💖",
  "Teri muskurahat meri duniya hai... ✨",
  "You're the reason I believe in love... 💕",
  "Meri princess, meri jaan... 👑",
  "Every moment with you is magical... 🌟",
  "Tum ho toh sab kuch hai mere paas... 💝",
  "I fall in love with you more every day... 🩷",
  "Tera saath meri sabse badi dua hai... 🙏💖",
  "Forever and always, my love... 💍"
];

export const MEOW_WORDS = [
  "meow meow cutie pie 🐾",
  "purr purr princess 👑",
  "mew mew I love you 💕",
  "nyaa~ so cute ✨",
  "meow meow jaan 💖"
];

export const QUOTE_POOL = [
  "Love is patient, love is kind... 🌸",
  "You are my sunshine... ☀️💖",
  "Together forever... 💍",
  "Always & forever... ✨",
  "Made for each other... 💕"
];

