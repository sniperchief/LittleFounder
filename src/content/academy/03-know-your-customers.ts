import type { AcademyModuleContent } from "./types";

const academyModule: AcademyModuleContent = {
  key: "know-your-customers",
  position: 3,
  title: "Know Your Customers",
  summary: "Find out who your customers are, ask good questions and learn from the answers.",
  icon: "users",
  tone: "sky",
  badge: {
    key: "customer-explorer",
    title: "Customer Explorer",
    description: "Completed Know Your Customers: you can describe a customer, ask fair questions and read the results.",
  },
  lessons: [
    {
      key: "who-is-your-customer",
      title: "Who is your customer?",
      minutes: 5,
      intro:
        "A business only works if someone wants what it offers. Those people are your customers. Knowing exactly who they are helps you build the right thing.",
      blocks: [
        {
          type: "text",
          heading: "Users and buyers",
          body: "The user is the person who uses the product. The buyer is the person who pays. Sometimes they're the same person — and sometimes they're not. A toy for a 5-year-old is used by the child, but usually bought by a parent or carer.",
        },
        {
          type: "list",
          heading: "Describe your customer",
          items: [
            "Who are they? (for example: students aged 10–13 who walk to school)",
            "What problem do they have?",
            "What do they care about? (price, speed, fun, looks, safety…)",
            "Where could you find them to ask questions?",
          ],
        },
        {
          type: "example",
          title: "Not \"everyone\"",
          body: "When Jordan first described customers for his bike-repair stall he said \"everyone\". But everyone doesn't ride a bike! When he changed it to \"kids in the neighbourhood with bikes that need small fixes\", he knew where to put posters and what to charge.",
          scene: "people",
        },
        {
          type: "keyIdea",
          body: "\"Everyone\" is not a customer. The more specific you are, the easier it is to help them.",
        },
      ],
      reflect: "For your idea, who would use it and who would pay for it? Are they the same person?",
      activity: {
        kind: "choose",
        prompt: "A business sells bath toys for toddlers. Who is usually the buyer?",
        options: [
          { label: "The toddler", feedback: "The toddler uses the toy, but toddlers don't usually buy things." },
          { label: "A parent or carer", correct: true, feedback: "Right — the toddler is the user, the grown-up is the buyer." },
          { label: "The toy factory", feedback: "The factory makes the toy; it isn't the customer." },
        ],
        explanation: "The user (toddler) and the buyer (parent or carer) are different people. A good business thinks about both.",
      },
      takeaway: "Know who uses your product and who pays — and describe them specifically.",
    },
    {
      key: "ask-good-questions",
      title: "Ask good questions",
      minutes: 6,
      intro:
        "Market research means finding out what customers really think and do. The secret is asking questions that get honest answers — not the answers you hope for.",
      blocks: [
        {
          type: "text",
          heading: "Why people tell you what you want to hear",
          body: "If you ask \"Would you buy my amazing idea?\", most people say yes to be kind. That isn't useful. Better questions ask about real life and what people actually did.",
        },
        {
          type: "table",
          caption: "Leading questions vs. good questions",
          columns: ["Leading question (avoid)", "Better question"],
          rows: [
            ["Don't you hate forgetting your water bottle?", "When did you last forget your water bottle? What happened?"],
            ["Would you buy my brilliant lunch box?", "How do you carry your lunch now? What's annoying about it?"],
            ["You'd pay 10 FB, right?", "What have you spent on something like this before?"],
          ],
        },
        {
          type: "list",
          heading: "Research safely",
          items: [
            "Ask people you know — family, friends, classmates — with a grown-up's OK.",
            "Never collect names, addresses or phone numbers. Tally answers instead.",
            "Listen more than you talk.",
          ],
        },
        {
          type: "keyIdea",
          body: "Ask about real past experiences, not about whether they like your idea.",
        },
      ],
      reflect: "Write one good, non-leading question you could ask about your idea. Practise asking it to your grown-up.",
      activity: {
        kind: "sort",
        prompt: "Sort the questions: which are good research questions, and which are leading?",
        buckets: ["Good question", "Leading question"],
        items: [
          { label: "Tell me about the last time your bike had a flat tyre.", bucket: 0 },
          { label: "My bike-repair stall is great, isn't it?", bucket: 1 },
          { label: "How do you get your bike fixed at the moment?", bucket: 0 },
          { label: "You'd definitely use my stall, right?", bucket: 1 },
        ],
        hint: "Leading questions push people towards a \"yes\". Good questions ask about what really happened.",
        explanation: "Good questions ask about real experiences. Leading questions suggest the answer you want.",
      },
      takeaway: "Good research questions are open, fair and about real experiences.",
    },
    {
      key: "learn-from-answers",
      title: "Learn from the answers",
      minutes: 6,
      intro:
        "You've asked your questions. Now turn the answers into something you can learn from. A little maths helps you see the pattern.",
      blocks: [
        {
          type: "text",
          heading: "Tally your answers",
          body: "Keep a simple tally chart: one mark for each answer. You don't need names — just count. Then look for patterns: what did most people say?",
        },
        {
          type: "example",
          title: "Turning a tally into a percentage",
          body: "Priya asked 10 classmates if they had trouble keeping their pencils sharp. 6 said yes. To find the percentage: 6 ÷ 10 = 0.6, and 0.6 × 100 = 60%. So 60% of the people she asked had the problem.",
          scene: "chart",
        },
        {
          type: "list",
          heading: "What to look for",
          items: [
            "How many people have the problem? (a high percentage is a good sign)",
            "What words do people use to describe it? Use their words in your pitch.",
            "Surprises — answers you didn't expect are often the most useful.",
          ],
        },
        {
          type: "scenario",
          title: "What if the answers say \"no\"?",
          body: "If very few people have the problem, that's useful too. It's much better to learn that early. You can change your idea, or look for a different group of customers.",
        },
      ],
      reflect: "If only 2 out of 10 people had your problem, what would you do next?",
      activity: {
        kind: "fill",
        prompt: "You asked 20 people. 15 said they have the problem. What percentage of people have the problem?",
        suffix: "%",
        answer: 75,
        hint: "Divide the number who said yes by the total, then multiply by 100.",
        explanation: "15 ÷ 20 = 0.75, and 0.75 × 100 = 75%. Three out of four people have the problem — a good sign!",
      },
      takeaway: "Count answers, turn them into percentages and look for patterns.",
    },
  ],
  quiz: {
    passMark: 60,
    questions: [
      {
        key: "m3-q1",
        prompt: "A bike helmet for kids is usually bought by…",
        options: [
          { label: "A parent or carer", correct: true, feedback: "Yes — the child uses it, the grown-up usually buys it." },
          { label: "The bike shop", feedback: "The shop sells it; it isn't the customer." },
          { label: "Nobody", feedback: "Someone has to buy it for the business to work." },
        ],
        explanation: "The user (child) and buyer (grown-up) can be different people.",
      },
      {
        key: "m3-q2",
        prompt: "Which is the best research question?",
        options: [
          { label: "You love my idea, don't you?", feedback: "That's leading — people will just say yes." },
          { label: "Tell me about the last time you lost your keys.", correct: true, feedback: "Open and about real experience. Great." },
          { label: "Would you pay a lot for my amazing key finder?", feedback: "Leading and hypothetical." },
        ],
        explanation: "Good questions ask about real past experiences without suggesting the answer.",
      },
      {
        key: "m3-q3",
        prompt: "You asked 10 people and 4 had the problem. What percentage is that?",
        options: [
          { label: "4%", feedback: "Remember to divide by the total and multiply by 100." },
          { label: "40%", correct: true, feedback: "Correct: 4 ÷ 10 × 100 = 40%." },
          { label: "14%", feedback: "Try 4 ÷ 10, then × 100." },
        ],
        explanation: "4 ÷ 10 = 0.4, and 0.4 × 100 = 40%.",
      },
      {
        key: "m3-q4",
        prompt: "Why is \"everyone\" a weak customer description?",
        options: [
          { label: "It's too broad to know who to help or where to find them", correct: true, feedback: "Exactly." },
          { label: "Because businesses only need one customer", feedback: "Businesses usually need many customers." },
          { label: "It isn't weak — it's the best answer", feedback: "A specific customer is much more useful." },
        ],
        explanation: "Specific customers help you design the product, set the price and find people to ask.",
      },
      {
        key: "m3-q5",
        prompt: "What should you avoid collecting when you do research?",
        options: [
          { label: "Tally marks", feedback: "Tallies are a great, safe way to count answers." },
          { label: "People's names, addresses or phone numbers", correct: true, feedback: "Right — you don't need personal details to learn." },
          { label: "Interesting words people use", feedback: "Those are useful — you can use them in your pitch." },
        ],
        explanation: "You can learn everything you need by counting answers. Personal details should stay private.",
      },
    ],
  },
};

export default academyModule;
