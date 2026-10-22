import { z } from "zod";

export const MOODS = [
  { id: "happy", label: "Happy" },
  { id: "confident", label: "Confident" },
  { id: "savage", label: "Savage" },
  { id: "heartbroken", label: "Heartbroken" },
  { id: "overthinking", label: "Overthinking" },
  { id: "energetic", label: "Energetic" },
  { id: "exhausted", label: "Exhausted" },
  { id: "angry", label: "Angry" },
  { id: "funny", label: "Funny" },
  { id: "emotional", label: "Emotional" },
] as const;

export const QUOTE_STYLES = [
  { id: "deep", label: "Deep & meaningful" },
  { id: "savage", label: "Savage & sarcastic" },
  { id: "minimal", label: "Short & minimal" },
  { id: "funny", label: "Funny & relatable" },
] as const;

const MOOD_IDS = ["happy", "confident", "savage", "heartbroken", "overthinking", "energetic", "exhausted", "angry", "funny", "emotional"] as const;
const STYLE_IDS = ["deep", "savage", "minimal", "funny"] as const;

export const MOOD_QUOTE_REQUEST_SCHEMA = z.object({
  mood: z.enum(MOOD_IDS),
  style: z.enum(STYLE_IDS),
  story: z.string().trim().max(240, "Keep your story under 240 characters.").optional().default(""),
});

export type MoodId = (typeof MOODS)[number]["id"];
export type QuoteStyleId = (typeof QUOTE_STYLES)[number]["id"];

const QUOTES: Record<MoodId, Record<QuoteStyleId, string[]>> = {
  happy: {
    deep: ["Joy looks good on me", "Collecting little suns", "Happiness, in my own time", "A softer kind of sunshine", "Good things grow here"],
    savage: ["Too sunny to care", "Smiling. Still selective.", "Good mood, bad influence", "My joy is not up for debate", "Unbothered looks bright"],
    minimal: ["Choose joy", "Sun on repeat", "Good energy", "Bright side", "Joy, lately"],
    funny: ["Powered by good vibes", "Smiling through the group chat", "Today's forecast: me", "Happy looks suspicious", "Good mood. No notes."],
  },
  confident: {
    deep: ["Becoming my own standard", "I belong in every room", "Quiet confidence, loud results", "I know what I bring", "No permission needed"],
    savage: ["I am the reference", "Not everyone gets the view", "Confidence: self supplied", "I said what I said", "Respectfully, watch me"],
    minimal: ["Own it", "Self made", "No permission", "In my lane", "Unshaken"],
    funny: ["My hype person is me", "Confidence on airplane mode", "Main character, low battery", "I look expensive", "Ego? Great question."],
  },
  savage: {
    deep: ["Boundaries are self respect", "I outgrew the explanation", "Peace made me unavailable", "My silence has a point", "Growth looks good from here"],
    savage: ["I am not for everyone", "Less access, more peace", "Read the room. Then leave.", "Noted. Ignored.", "Your opinion missed the deadline"],
    minimal: ["No access", "Try less", "Still no", "Not today", "Keep scrolling"],
    funny: ["My patience left the chat", "I brought receipts", "Kindness with a limit", "Respectfully, absolutely not", "Sarcasm is my cardio"],
  },
  heartbroken: {
    deep: ["Healing has its own rhythm", "I can miss you and move on", "Soft heart, stronger edges", "Some goodbyes grow us", "Still learning to let go"],
    savage: ["Character development, thanks", "Returned to sender", "I kept the lesson", "Your loss, my laundry day", "Love left. Standards stayed."],
    minimal: ["Still healing", "Let it pass", "Soft, still", "New chapter", "Heart in progress"],
    funny: ["Crying, but well dressed", "My ex is a plot point", "Love songs: under review", "Healing with snacks", "Heartbreak, meet hoodie"],
  },
  overthinking: {
    deep: ["Let the moment be enough", "Not every thought is a sign", "I can pause the noise", "One thing at a time", "The night can wait"],
    savage: ["Brain, read the room", "Overthinking has no office hours", "No reply is also a reply", "I have reviewed the evidence", "Thought spiral? Declined."],
    minimal: ["Breathe first", "Mind, hush", "One moment", "Let it be", "Offline inside"],
    funny: ["I have 47 tabs open", "Replaying a 2019 conversation", "My brain needs a nap", "Overthinker on break", "I made a spreadsheet"],
  },
  energetic: {
    deep: ["Make room for momentum", "I came alive in motion", "Small steps, bright sparks", "Energy follows intention", "Today has my attention"],
    savage: ["Catch up if you can", "Busy becoming", "I make my own momentum", "No brakes, good boundaries", "Powered by audacity"],
    minimal: ["Full charge", "Let's move", "All spark", "In motion", "Go mode"],
    funny: ["Too much coffee, great ideas", "If found, add more snacks", "My playlist is driving", "Rest is a future problem", "Currently doing the most"],
  },
  exhausted: {
    deep: ["Rest is part of becoming", "I deserve a slower day", "Even the sky takes breaks", "Gentle is still progress", "Pause without apology"],
    savage: ["Unavailable for extra tasks", "Ask me after a nap", "My limits have limits", "Out of office, in my bed", "Not accepting new plotlines"],
    minimal: ["Need a minute", "Soft reset", "Rest mode", "Low power", "Slow today"],
    funny: ["Running on one percent", "Do not disturb: human", "My coffee needs coffee", "I need a loading screen", "Nap is the plan"],
  },
  angry: {
    deep: ["Let the fire clear the way", "I can feel it and choose", "Anger points to what matters", "Heat fades, truth stays", "Strong enough to pause"],
    savage: ["Let's all take a minute", "My patience is on leave", "Not the day to test me", "I have notes", "Handle with a deep breath"],
    minimal: ["Not amused", "Deep breaths", "Heat check", "Pause first", "Try again"],
    funny: ["Currently buffering calm", "My face said it first", "Angry, but hydrated", "Taking the scenic exhale", "Do not poke the plot"],
  },
  funny: {
    deep: ["Laughter keeps me human", "Joy is serious business", "A little weird, a lot alive", "Life needs better punchlines", "I find the bright side"],
    savage: ["Funny because it's true", "I came with commentary", "My face has subtitles", "Not a bug, a feature", "Comedy with boundaries"],
    minimal: ["Ha. Same.", "Plot twist", "Oops again", "Tiny chaos", "Well then"],
    funny: ["I need adult supervision", "My plan has no plan", "Professional snack tester", "I laughed at my own text", "Mentally at the buffet"],
  },
  emotional: {
    deep: ["Feeling deeply is my strength", "Tender is a kind of brave", "I let the feeling move", "A full heart, still learning", "There is room for all of me"],
    savage: ["Yes, I have feelings", "Soft heart, firm boundaries", "Emotional, not available", "I care. Selectively.", "Feelings with good taste"],
    minimal: ["Feel it all", "Soft heart", "Still tender", "Open, always", "Made of feeling"],
    funny: ["Cried at an advert again", "Feelings brought snacks", "I am the emotional support", "Currently a soft launch", "All heart, no manual"],
  },
};

function storyHint(story: string): string | null {
  const value = story.toLowerCase();
  if (/work|job|office|deadline|meeting/.test(value)) return "Deadline season, still me";
  if (/love|date|breakup|ex|heart/.test(value)) return "A plot twist, not the ending";
  if (/friend|people|family|everyone/.test(value)) return "People are a whole hobby";
  if (/sleep|tired|late|busy|long day/.test(value)) return "One thing at a time";
  return null;
}

export function generateMoodQuotes(input: { mood: MoodId; style: QuoteStyleId; story?: string }): string[] {
  const quotes = [...QUOTES[input.mood][input.style]];
  const hint = input.story?.trim() ? storyHint(input.story) : null;
  if (hint && !quotes.includes(hint)) quotes[4] = hint;
  return [...new Set(quotes)].slice(0, 5);
}
