import type { AcademyModuleContent } from "./types";

const academyModule: AcademyModuleContent = {
  key: "create-your-idea",
  position: 2,
  title: "Create Your Idea",
  summary: "Brainstorm creative solutions, choose the best one and build a quick prototype.",
  icon: "sparkles",
  tone: "coral",
  badge: {
    key: "idea-creator",
    title: "Idea Creator",
    description: "Completed Create Your Idea: you can brainstorm, choose a solution that fits and test it with a prototype.",
  },
  lessons: [
    {
      key: "brainstorm-like-a-founder",
      title: "Brainstorm like a founder",
      minutes: 5,
      intro:
        "Once you've found a problem, it's time for ideas — lots of them. Brainstorming is a way of coming up with many ideas quickly before choosing the best one.",
      blocks: [
        {
          type: "text",
          heading: "Start with \"How might we…?\"",
          body: "Turn the problem into a question that invites ideas. If the problem is \"Kids forget their water bottles\", ask \"How might we help kids remember their water bottles?\"",
        },
        {
          type: "list",
          heading: "Brainstorming rules",
          items: [
            "Go for lots of ideas — quantity first, quality later.",
            "No judging yet. Every idea gets written down.",
            "Build on other ideas: say \"yes, and…\" instead of \"no, but…\".",
            "Wild ideas are welcome. They often lead to clever, practical ones.",
            "Set a timer — 5 minutes keeps the energy up.",
          ],
        },
        {
          type: "example",
          title: "Ten ideas in five minutes",
          body: "Sam's group asked \"How might we make the walk to school safer in the dark?\" Ideas included reflective stickers, a walking buddy rota, a light-up backpack, glow-in-the-dark shoelaces and a map of well-lit routes. Not all were practical, but the list gave them three ideas worth testing.",
          scene: "brainstorm",
        },
        {
          type: "keyIdea",
          body: "Creativity is a skill. The more ideas you write down, the more likely one of them is great.",
        },
      ],
      reflect: "Pick a problem from Module 1. Can you and your grown-up think of five ideas in two minutes?",
      activity: {
        kind: "choose",
        multi: true,
        prompt: "Which of these are good brainstorming rules? Pick all that apply.",
        options: [
          { label: "Write down every idea, even wild ones", correct: true, feedback: "Yes — wild ideas often spark practical ones." },
          { label: "Say \"that won't work\" as soon as you hear an idea", feedback: "Judging too early stops ideas flowing. Save it for later." },
          { label: "Build on other people's ideas with \"yes, and…\"", correct: true, feedback: "Great — building on ideas makes them better." },
          { label: "Stop after the first idea", feedback: "The first idea is rarely the best. Aim for lots." },
        ],
        explanation: "Good brainstorming means many ideas, no early judging, and building on each other's ideas.",
      },
      takeaway: "Ask \"How might we…?\", write lots of ideas, and don't judge them yet.",
    },
    {
      key: "choose-the-best-idea",
      title: "Choose an idea that fits",
      minutes: 6,
      intro:
        "You've got a long list of ideas. Now it's time to be a judge. Founders check each idea against the problem to find one that really fits.",
      blocks: [
        {
          type: "table",
          caption: "The idea check",
          columns: ["Question", "What you're looking for"],
          rows: [
            ["Does it solve the problem?", "It must fix the actual problem, not a different one."],
            ["Would people use it?", "It should be easy and appealing for the people with the problem."],
            ["Can we make it?", "Could you build a simple version with what you have?"],
            ["Is it safe and kind?", "It shouldn't hurt anyone or anything, including the planet."],
          ],
        },
        {
          type: "example",
          title: "The forgotten water bottles",
          body: "Problem: kids forget their water bottles at home. A bottle clip on the school bag fixes it — the bottle stays with the bag. A louder school bell doesn't fix it at all, even though it's an idea. Always check: does this idea fix THIS problem?",
          scene: "check",
        },
        {
          type: "text",
          heading: "Innovation means making something better",
          body: "Innovation doesn't have to mean inventing something nobody has ever seen. Making something cheaper, simpler, safer or more fun is innovation too.",
        },
      ],
      reflect: "Look at your five ideas. Which one best fixes the problem? Why?",
      activity: {
        kind: "sort",
        prompt: "Problem: kids forget their water bottles at home. Which ideas solve this problem?",
        buckets: ["Solves the problem", "Doesn't solve it"],
        items: [
          { label: "A clip that keeps the bottle attached to the school bag", bucket: 0 },
          { label: "A sticker that says \"Have fun!\"", bucket: 1 },
          { label: "A reminder tag hung on the front door", bucket: 0 },
          { label: "A louder school bell", bucket: 1 },
        ],
        hint: "Ask of each idea: would it help someone remember or keep their bottle?",
        explanation: "The clip and the door tag help kids remember their bottles. A sticker and a louder bell don't change whether the bottle gets packed.",
      },
      takeaway: "The best idea is the one that actually fixes the problem — and that people would use.",
    },
    {
      key: "build-a-prototype",
      title: "Build a quick prototype",
      minutes: 6,
      intro:
        "Before spending lots of time or money, founders build a prototype: a quick, simple version of the idea that people can try.",
      blocks: [
        {
          type: "text",
          heading: "What is a prototype?",
          body: "A prototype is a rough early version made to learn from. It can be a paper sketch, a cardboard model, a role-play or a pretend app drawn on paper. It doesn't need to look perfect — it needs to help you learn.",
        },
        {
          type: "steps",
          heading: "The build–test–learn loop",
          items: [
            { title: "Build", body: "Make the simplest version you can, quickly and cheaply." },
            { title: "Test", body: "Let a few people try it. Watch what they do." },
            { title: "Learn", body: "What worked? What confused them? Change the idea, then go round again." },
          ],
        },
        {
          type: "example",
          title: "The cardboard lunch box",
          body: "Aisha thought a lunch box with separate sections would stop sandwiches getting squashed. Before buying anything, she taped cardboard dividers into an old box and let three friends use it for a week. They loved the sections — but said it needed a handle. She learned that for free.",
          scene: "prototype",
        },
        {
          type: "keyIdea",
          body: "Test early and cheaply. It's much easier to change a cardboard model than a finished product.",
        },
      ],
      reflect: "How could you build a prototype of your idea using paper, cardboard or a role-play?",
      activity: {
        kind: "choose",
        prompt: "You have an idea for a new kind of pencil case. What's the best first step?",
        options: [
          { label: "Spend all your savings making 100 of them", feedback: "That's risky — you don't know yet if people like it." },
          {
            label: "Make a cardboard model and let three friends try it",
            correct: true,
            feedback: "Yes! Quick, cheap, and you learn from real people.",
          },
          { label: "Keep it secret until it's perfect", feedback: "Without testing, you can't find out what to improve." },
        ],
        explanation: "A cheap prototype tested with real people teaches you the most with the least risk.",
      },
      takeaway: "Build a quick prototype, test it with people, learn and improve.",
    },
  ],
  quiz: {
    passMark: 60,
    questions: [
      {
        key: "m2-q1",
        prompt: "What is the main goal of brainstorming?",
        options: [
          { label: "To come up with lots of ideas quickly", correct: true, feedback: "Yes — quantity first, choose later." },
          { label: "To find one perfect idea straight away", feedback: "The best ideas usually come after many others." },
          { label: "To decide who is the smartest", feedback: "Brainstorming is a team activity, not a competition." },
        ],
        explanation: "Brainstorming is about generating many ideas without judging them, then choosing later.",
      },
      {
        key: "m2-q2",
        prompt: "Which is a good \"How might we…?\" question for the problem \"Plants die while families are on holiday\"?",
        options: [
          { label: "How might we keep plants watered while families are away?", correct: true, feedback: "That turns the problem into an invitation for ideas." },
          { label: "Why do people have plants?", feedback: "Interesting, but it doesn't invite solutions to the problem." },
          { label: "How might we make holidays longer?", feedback: "That's a different problem." },
        ],
        explanation: "A good \"How might we…?\" question restates the problem as a challenge to solve.",
      },
      {
        key: "m2-q3",
        prompt: "What is a prototype?",
        options: [
          { label: "A simple early version of an idea used for testing", correct: true, feedback: "Exactly." },
          { label: "The final product sold in shops", feedback: "A prototype comes long before the final product." },
          { label: "A type of advert", feedback: "Prototypes are for learning, not advertising." },
        ],
        explanation: "Prototypes are quick, rough versions you build to learn what works.",
      },
      {
        key: "m2-q4",
        prompt: "After testing a prototype, what should you do next?",
        options: [
          { label: "Learn from what happened and improve the idea", correct: true, feedback: "Yes — that's the build–test–learn loop." },
          { label: "Ignore feedback and keep going", feedback: "Feedback is the whole point of testing." },
          { label: "Throw away every idea", feedback: "Usually you improve the idea rather than starting over." },
        ],
        explanation: "Build, test, learn — then improve and test again.",
      },
      {
        key: "m2-q5",
        prompt: "Which of these counts as innovation?",
        options: [
          { label: "Making an existing product simpler and cheaper", correct: true, feedback: "Yes — improving something is innovation too." },
          { label: "Copying someone's product exactly", feedback: "Copying isn't innovation — and can be unfair." },
          { label: "Only inventions nobody has ever seen", feedback: "Innovation also includes improving things that exist." },
        ],
        explanation: "Innovation means making something new or better — simpler, cheaper, safer or more fun.",
      },
    ],
  },
};

export default academyModule;
