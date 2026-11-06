import type { AcademyModuleContent } from "./types";

const academyModule: AcademyModuleContent = {
  key: "think-like-a-founder",
  position: 1,
  title: "Think Like a Founder",
  summary: "Spot everyday problems and turn them into opportunities.",
  icon: "lightbulb",
  tone: "sun",
  badge: {
    key: "problem-spotter",
    title: "Problem Spotter",
    description: "Completed Think Like a Founder: you can spot problems and see the opportunities inside them.",
  },
  lessons: [
    {
      key: "what-founders-do",
      title: "What does a founder do?",
      minutes: 5,
      intro:
        "A founder is someone who starts something new to make life better for other people. Let's find out what founders actually do — and why you can start thinking like one today.",
      blocks: [
        {
          type: "text",
          heading: "Founders start things",
          body: "A founder notices something that could be better and decides to do something about it. They might start a business, a club, a charity or a school project. The thing they start is often called a venture.",
        },
        {
          type: "example",
          title: "The water-bottle refill map",
          body: "Mia noticed that people in her town kept buying plastic bottles of water because they didn't know where the free refill taps were. She drew a map of every tap in the park and the library and pinned it up at the sports centre. That's founder thinking: she spotted a problem, came up with a simple fix, and tested it.",
          scene: "magnifier",
        },
        {
          type: "list",
          heading: "Habits founders practise",
          items: [
            "Curiosity — asking \"why does it work like this?\"",
            "Listening — finding out what other people actually need.",
            "Persistence — trying again when the first idea doesn't work.",
            "Honesty — telling the truth about what works and what doesn't.",
            "Teamwork — asking for help and sharing the credit.",
          ],
        },
        {
          type: "keyIdea",
          body: "You don't need money or to be a grown-up to think like a founder. You need curiosity and a wish to help.",
        },
      ],
      reflect: "Think of a time you fixed something annoying, even something small. Tell your grown-up what you did.",
      activity: {
        kind: "choose",
        multi: true,
        prompt: "Which of these are founder habits? Pick all that apply.",
        options: [
          { label: "Asking \"why?\" when something is annoying", correct: true, feedback: "Yes! Curiosity is where most ideas start." },
          { label: "Giving up after the first try", feedback: "Founders usually have to try several times. Persistence is a key habit." },
          { label: "Listening to what other people need", correct: true, feedback: "Exactly. Good ideas solve real needs, so founders listen a lot." },
          { label: "Hiding mistakes so nobody finds out", feedback: "Founders are honest about mistakes so they can learn and fix them." },
        ],
        explanation: "Curiosity and listening are founder habits. Giving up early and hiding mistakes get in the way of learning.",
      },
      takeaway: "A founder spots something that could be better and starts something to improve it.",
    },
    {
      key: "spotting-problems",
      title: "Be a problem detective",
      minutes: 6,
      intro:
        "Every business starts with a problem. Founders train themselves to notice problems that other people walk straight past. Time to put on your detective hat.",
      blocks: [
        {
          type: "text",
          heading: "What counts as a problem?",
          body: "A problem is anything that is annoying, slow, difficult, expensive, unsafe or wasteful for someone. If people grumble about it, wait for it, or work around it, there's probably a problem hiding there.",
        },
        {
          type: "steps",
          heading: "The detective questions",
          items: [
            { title: "Who?", body: "Who has this problem? Be specific: \"younger kids at the bus stop\", not \"people\"." },
            { title: "What?", body: "What exactly goes wrong?" },
            { title: "When and how often?", body: "Does it happen every day, every week or once a year?" },
            { title: "Why does it matter?", body: "What happens because of it? Lost time, money, fun or safety?" },
          ],
        },
        {
          type: "example",
          title: "A vague problem vs. a clear one",
          body: "Vague: \"Lunch is bad.\"\nClear: \"The lunch queue takes 20 minutes, so lots of students have only 10 minutes left to eat and play.\"\nThe clear version tells you who, what, how often and why it matters — so you can start thinking of fixes.",
          scene: "check",
        },
        {
          type: "keyIdea",
          body: "A clear problem statement says who has the problem, what goes wrong, and why it matters.",
        },
      ],
      reflect: "Look around your home or classroom. What is one thing people often grumble about? Who has that problem?",
      activity: {
        kind: "sort",
        prompt: "Sort each statement: is it a clear problem, or too vague to work on?",
        buckets: ["Clear problem", "Too vague"],
        items: [
          { label: "My little brother can't reach the light switch, so he needs help every night.", bucket: 0 },
          { label: "Things are bad.", bucket: 1 },
          { label: "Football boots get muddy and make the car dirty after every Saturday match.", bucket: 0 },
          { label: "People are annoying.", bucket: 1 },
        ],
        hint: "A clear problem says who has it and what goes wrong. Look for the statements that answer those questions.",
        explanation: "The clear problems name who is affected and what goes wrong. \"Things are bad\" and \"people are annoying\" don't tell you what to fix.",
      },
      takeaway: "Good founders describe problems clearly: who has it, what goes wrong and why it matters.",
    },
    {
      key: "problems-to-opportunities",
      title: "From problem to opportunity",
      minutes: 6,
      intro:
        "Not every problem is worth building a business around. Founders look for opportunities: problems that lots of people have, often, and would be glad to see solved.",
      blocks: [
        {
          type: "text",
          heading: "What is an opportunity?",
          body: "An opportunity is a problem you could help solve in a way people value. The bigger and more common the problem, the bigger the opportunity tends to be.",
        },
        {
          type: "table",
          caption: "Three questions to size up a problem",
          columns: ["Question", "Why it matters"],
          rows: [
            ["How many people have it?", "A problem shared by many people is a bigger opportunity."],
            ["How often does it happen?", "A weekly problem matters more than a once-a-year one."],
            ["How painful is it?", "If people already spend time or money working around it, they care."],
          ],
        },
        {
          type: "example",
          title: "Holiday plant rescue",
          body: "Leo noticed that every summer his neighbours' plants dried out while they were away. Lots of families went away, it happened every holiday, and people were sad to lose their plants. He offered a plant-watering service with his older sister — and had five families sign up in the first week.",
          scene: "lightbulb",
        },
        {
          type: "scenario",
          title: "Already solved?",
          body: "Sometimes a problem is already solved well and for free. That doesn't mean you should give up thinking — but it means you'd need to do something better, cheaper or different.",
        },
      ],
      reflect: "Pick one problem you noticed. How many people have it, and how often? Is it a big opportunity or a small one?",
      activity: {
        kind: "choose",
        prompt: "Which problem is the best opportunity to build something?",
        options: [
          { label: "A problem only you have, once a year", feedback: "It's real, but few people have it and it rarely happens, so it's a small opportunity." },
          {
            label: "A problem many families on your street have every week",
            correct: true,
            feedback: "Yes! Lots of people, often — that's a strong opportunity.",
          },
          { label: "A problem that's already solved perfectly, for free", feedback: "People already have a great free fix, so a new idea would struggle." },
        ],
        explanation: "Opportunities are biggest when many people have a problem often and care about solving it.",
      },
      takeaway: "An opportunity is a problem many people have, often, and want solved.",
    },
  ],
  quiz: {
    passMark: 60,
    questions: [
      {
        key: "m1-q1",
        prompt: "What is a founder?",
        options: [
          { label: "Someone who starts something new to make things better", correct: true, feedback: "That's it." },
          { label: "Someone who only gives money to businesses", feedback: "That's closer to an investor." },
          { label: "Someone who works in a shop", feedback: "Shop workers are important, but a founder is the person who starts something." },
        ],
        explanation: "A founder starts something new — a business, club or project — to solve a problem.",
      },
      {
        key: "m1-q2",
        prompt: "Which of these is the clearest problem statement?",
        options: [
          { label: "School is boring.", feedback: "This is too vague — who, what and why aren't clear." },
          {
            label: "Younger students wait 15 minutes in the rain for the bus because the shelter is too small.",
            correct: true,
            feedback: "Clear: it says who, what and why it matters.",
          },
          { label: "Buses are bad.", feedback: "Too vague to act on." },
        ],
        explanation: "Clear problem statements say who has the problem, what goes wrong and why it matters.",
      },
      {
        key: "m1-q3",
        prompt: "Which habit helps a founder most when their first idea doesn't work?",
        options: [
          { label: "Persistence", correct: true, feedback: "Right — founders keep trying and improving." },
          { label: "Hiding the result", feedback: "Hiding results stops you learning from them." },
          { label: "Blaming customers", feedback: "Customers' reactions are useful information, not something to blame." },
        ],
        explanation: "Most first ideas need changes. Persistence means trying again with what you learned.",
      },
      {
        key: "m1-q4",
        prompt: "Which makes a problem a bigger opportunity?",
        options: [
          { label: "Only one person has it", feedback: "Fewer people means a smaller opportunity." },
          { label: "Lots of people have it often", correct: true, feedback: "Yes — common, frequent problems are bigger opportunities." },
          { label: "Nobody minds it", feedback: "If nobody minds, nobody will want a fix." },
        ],
        explanation: "The more people have a problem, the more often, and the more they care, the bigger the opportunity.",
      },
      {
        key: "m1-q5",
        prompt: "Mia drew a map of free water-refill taps. What problem was she solving?",
        options: [
          { label: "People didn't know where to refill bottles for free", correct: true, feedback: "Exactly." },
          { label: "The park had too many trees", feedback: "That wasn't the problem Mia noticed." },
          { label: "Taps were too expensive to build", feedback: "The taps already existed — people just couldn't find them." },
        ],
        explanation: "People bought plastic bottles because they couldn't find the free taps. The map solved that.",
      },
    ],
  },
};

export default academyModule;
