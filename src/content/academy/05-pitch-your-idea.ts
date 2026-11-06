import type { AcademyModuleContent } from "./types";

const academyModule: AcademyModuleContent = {
  key: "pitch-your-idea",
  position: 5,
  title: "Pitch Your Idea",
  summary: "Tell a clear, memorable story about your idea and present it with confidence.",
  icon: "presentation",
  tone: "grape",
  badge: {
    key: "confident-pitcher",
    title: "Confident Pitcher",
    description: "Completed Pitch Your Idea: you can structure a pitch as a story and present it confidently.",
  },
  lessons: [
    {
      key: "why-stories-work",
      title: "Why stories work",
      minutes: 5,
      intro:
        "A pitch is a short talk that explains your idea and why it matters. The best pitches don't sound like a list of facts — they tell a story.",
      blocks: [
        {
          type: "text",
          heading: "People remember stories",
          body: "Our brains are built to follow stories. When you describe a real person with a real problem, listeners picture it and care about what happens next.",
        },
        {
          type: "steps",
          heading: "A simple story shape",
          items: [
            { title: "Hook", body: "Grab attention with a question or a surprising moment." },
            { title: "Problem", body: "Show who is struggling and why." },
            { title: "Solution", body: "Introduce your idea as the turning point." },
            { title: "Happy ending", body: "Show how life is better with your idea." },
          ],
        },
        {
          type: "example",
          title: "Two ways to start",
          body: "Flat: \"My product is a lunch box with sections.\"\nStory: \"Have you ever opened your lunch to find your sandwich squashed by an apple? That happened to me every week — until I designed a lunch box with sections.\"",
          scene: "story",
        },
        {
          type: "keyIdea",
          body: "Start with a hook, show the problem, then reveal your solution.",
        },
      ],
      reflect: "Think of a hook question for your idea that starts with \"Have you ever…?\" Try it on your grown-up.",
      activity: {
        kind: "choose",
        prompt: "Which is the best opening hook for a pitch about a squash-proof lunch box?",
        options: [
          { label: "\"Hello. This is my lunch box. Thank you.\"", feedback: "It's polite, but it doesn't grab attention or show a problem." },
          {
            label: "\"Have you ever opened your lunch to find a squashed sandwich?\"",
            correct: true,
            feedback: "Yes! It's a question everyone can picture.",
          },
          { label: "\"My lunch box is 22 centimetres long and 9 centimetres high.\"", feedback: "Facts can come later. Start with something people care about." },
        ],
        explanation: "A relatable question makes listeners picture the problem straight away.",
      },
      takeaway: "Good pitches are stories: hook, problem, solution, happy ending.",
    },
    {
      key: "parts-of-a-pitch",
      title: "The parts of a pitch",
      minutes: 6,
      intro:
        "Every strong pitch answers the same few questions. If one is missing, listeners are left wondering.",
      blocks: [
        {
          type: "table",
          caption: "Five questions every pitch answers",
          columns: ["Part", "Question it answers"],
          rows: [
            ["Problem", "What's wrong, and who has it?"],
            ["Solution", "What is your idea and how does it fix the problem?"],
            ["Customer", "Who exactly will use it or buy it?"],
            ["Business", "How does it make money, and what does it cost?"],
            ["Next step", "What do you want to do next, or what help do you need?"],
          ],
        },
        {
          type: "example",
          title: "A 30-second pitch",
          body: "\"Every summer, plants die while families are on holiday (problem). Plant Pals waters them for you (solution). We help families on our street who travel in the summer (customer). We charge 5 FB a visit and our costs are about 1 FB (business). Next, we want to test it with ten families (next step).\"",
          scene: "pitch",
        },
        {
          type: "keyIdea",
          body: "Problem, solution, customer, business, next step — check your pitch has all five.",
        },
      ],
      reflect: "Can you say all five parts of your pitch in 30 seconds? Time yourself with your grown-up.",
      activity: {
        kind: "choose",
        prompt:
          "Read this pitch: \"Bikes get flat tyres (problem). I fix them quickly at my stall (solution). I charge 3 FB and parts cost 1 FB (business). Next, I'll put up posters (next step).\" Which part is missing?",
        options: [
          { label: "The problem", feedback: "The problem is there: bikes get flat tyres." },
          { label: "The customer", correct: true, feedback: "Yes — the pitch never says who the stall is for." },
          { label: "The next step", feedback: "The next step is there: putting up posters." },
        ],
        explanation: "The pitch doesn't say who the customers are — for example, kids in the neighbourhood with bikes.",
      },
      takeaway: "A complete pitch covers problem, solution, customer, business and next step.",
    },
    {
      key: "present-with-confidence",
      title: "Present with confidence",
      minutes: 6,
      intro:
        "Feeling nervous before presenting is normal — even for experienced founders. Practice and a few simple habits make a big difference.",
      blocks: [
        {
          type: "list",
          heading: "Confident presenting habits",
          items: [
            "Practise out loud a few times, ideally to a friendly audience.",
            "Look at your listeners, not at the floor.",
            "Speak slowly and pause after important points.",
            "Stand still and smile — it helps you and your audience relax.",
            "Keep it short. You can always add detail when people ask.",
          ],
        },
        {
          type: "text",
          heading: "Handling questions",
          body: "Questions mean people are interested! Listen to the whole question, take a breath, then answer honestly. If you don't know, say so: \"Great question — I don't know yet, but I'll find out.\" That's much better than guessing.",
        },
        {
          type: "example",
          title: "Turning nerves into energy",
          body: "Before her school pitch, Zara practised three times in front of her family and wrote her five parts on a small card. When a judge asked a question she couldn't answer, she said she'd test it next week. The judges said that honesty was one of the best parts of her pitch.",
          scene: "stage",
        },
        {
          type: "keyIdea",
          body: "Practise, slow down, look at your audience — and be honest when you don't know.",
        },
      ],
      reflect: "Practise your 30-second pitch twice for your grown-up. Ask them to tell you one thing you did well.",
      activity: {
        kind: "choose",
        multi: true,
        prompt: "Which of these are good presenting habits? Pick all that apply.",
        options: [
          { label: "Practising out loud before the real thing", correct: true, feedback: "Yes — practice builds confidence." },
          { label: "Speaking as fast as possible to finish quickly", feedback: "Slow down — people need time to follow." },
          { label: "Saying \"I don't know yet, but I'll find out\" when unsure", correct: true, feedback: "Honest answers build trust." },
          { label: "Making up an answer so you look clever", feedback: "Guessing can mislead people. Honesty is better." },
        ],
        explanation: "Practising and answering honestly are good habits. Rushing and making things up hurt your pitch.",
      },
      takeaway: "Practise, speak slowly and answer questions honestly.",
    },
  ],
  quiz: {
    passMark: 60,
    questions: [
      {
        key: "m5-q1",
        prompt: "What is a pitch?",
        options: [
          { label: "A short talk explaining your idea and why it matters", correct: true, feedback: "Exactly." },
          { label: "A long report about everything you know", feedback: "Pitches are short and focused." },
          { label: "A football field", feedback: "That's a different kind of pitch!" },
        ],
        explanation: "A pitch is a short, clear presentation of your idea.",
      },
      {
        key: "m5-q2",
        prompt: "What should come first in a story-style pitch?",
        options: [
          { label: "A hook that grabs attention", correct: true, feedback: "Yes — start by making people care." },
          { label: "A long list of prices", feedback: "Prices come later." },
          { label: "Thanking everyone for listening", feedback: "Thank them at the end." },
        ],
        explanation: "Hook first, then the problem, then your solution.",
      },
      {
        key: "m5-q3",
        prompt: "Which part of a pitch answers \"Who will use or buy it?\"",
        options: [
          { label: "The customer", correct: true, feedback: "Right." },
          { label: "The solution", feedback: "The solution explains what the idea is." },
          { label: "The hook", feedback: "The hook grabs attention." },
        ],
        explanation: "The customer part says exactly who the idea is for.",
      },
      {
        key: "m5-q4",
        prompt: "A judge asks a question you can't answer. What's the best response?",
        options: [
          { label: "Make up an answer", feedback: "Guessing can mislead people." },
          { label: "\"Great question — I don't know yet, but I'll find out.\"", correct: true, feedback: "Honest and confident." },
          { label: "Ignore the question", feedback: "Ignoring questions loses trust." },
        ],
        explanation: "Honesty builds trust, and it shows you're still learning.",
      },
      {
        key: "m5-q5",
        prompt: "Which habit helps you present confidently?",
        options: [
          { label: "Practising out loud beforehand", correct: true, feedback: "Yes — practice is the best cure for nerves." },
          { label: "Looking at the floor the whole time", feedback: "Looking at your audience helps them connect with you." },
          { label: "Speaking as fast as you can", feedback: "Slow down so people can follow." },
        ],
        explanation: "Practice, eye contact and a steady pace make presenting easier.",
      },
    ],
  },
};

export default academyModule;
