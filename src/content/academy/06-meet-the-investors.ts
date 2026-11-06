import type { AcademyModuleContent } from "./types";

const academyModule: AcademyModuleContent = {
  key: "meet-the-investors",
  position: 6,
  title: "Meet the Investors",
  summary: "Learn how investment, ownership and fundraising work — with pretend money only.",
  icon: "handshake",
  tone: "rose",
  badge: {
    key: "young-investor-scholar",
    title: "Young Investor Scholar",
    description: "Completed Meet the Investors: you understand investment, ownership and what investors look for.",
  },
  lessons: [
    {
      key: "what-is-an-investor",
      title: "What is an investor?",
      minutes: 6,
      intro:
        "Some businesses need more money than the founders have to grow. One way to get it is from investors. Let's find out who they are and what they want. (In Little Founders everything is pretend — no real money is ever involved.)",
      blocks: [
        {
          type: "text",
          heading: "Investors buy a piece of the business",
          body: "An investor gives money to a business, hoping it will grow. In return, they usually get a share — a piece of the business. If the business grows, their piece becomes worth more. If it fails, they can lose their money. That's called risk.",
        },
        {
          type: "table",
          caption: "Ways a business can get money",
          columns: ["Way", "What it means"],
          rows: [
            ["Savings and sales", "Using money the business already earned — you keep full control."],
            ["Loan", "Borrowing money you must pay back, often with extra (interest)."],
            ["Grant or prize", "Money given for a purpose, usually not paid back."],
            ["Investment", "Money in exchange for a share of the business."],
          ],
        },
        {
          type: "example",
          title: "The bakery that grew",
          body: "A small bakery wanted a bigger oven to bake more bread. An investor gave them the money in exchange for a share of the bakery. The bakery sold more, and the investor's share became more valuable. Both were happy — but they took the risk that it might not work.",
          scene: "investor",
        },
        {
          type: "keyIdea",
          body: "Investors give money in exchange for a share of the business — and they take a risk.",
        },
      ],
      reflect: "If you had a business, would you rather use your own savings, borrow or find an investor? Talk about why with your grown-up.",
      activity: {
        kind: "choose",
        prompt: "What does an investor usually get in return for their money?",
        options: [
          { label: "A share (piece) of the business", correct: true, feedback: "Yes — they become part-owners." },
          { label: "Nothing — it's a gift", feedback: "A gift or grant isn't an investment. Investors expect a share." },
          { label: "Free products forever", feedback: "Not usually — investors want a share of the business." },
        ],
        explanation: "Investors swap money for a share of the business, hoping it grows in value.",
      },
      takeaway: "An investor gives money for a share of the business and takes a risk.",
    },
    {
      key: "ownership-and-shares",
      title: "Ownership and shares",
      minutes: 7,
      intro:
        "When an investor gets a share of a business, who owns what? Picture the business as a pizza cut into slices.",
      blocks: [
        {
          type: "text",
          heading: "The business pizza",
          body: "Imagine your business is one pizza cut into 10 equal slices. At the start you own all 10 slices — 100% of the business. Each slice is 10%.",
        },
        {
          type: "example",
          title: "Sharing slices",
          body: "An investor offers pretend money in exchange for 3 slices. Now the investor owns 3 slices (30%) and you own 7 slices (70%). You still own most of the business, but you share it — and you might share some decisions too.",
          scene: "pie",
        },
        {
          type: "list",
          heading: "Things to think about before sharing",
          items: [
            "How much of your business are you giving away?",
            "What will you do with the money? Will it help the business grow?",
            "Will the investor help with advice, or only money?",
            "Will you still own enough to make the big decisions?",
          ],
        },
        {
          type: "keyIdea",
          body: "Shares are slices of ownership. Giving some away means owning less — so it should help the business grow.",
        },
      ],
      reflect: "Would you rather own all of a small pizza or most of a much bigger one? Why?",
      activity: {
        kind: "fill",
        prompt: "Your business is split into 10 equal slices. You give 2 slices to an investor. What percentage of the business do you still own?",
        suffix: "%",
        answer: 80,
        hint: "Each slice is 10%. How many slices do you have left?",
        explanation: "You keep 8 of 10 slices. Each slice is 10%, so 8 × 10 = 80%.",
      },
      takeaway: "Each share is a slice of ownership. Know how much you keep.",
    },
    {
      key: "what-investors-look-for",
      title: "What investors look for",
      minutes: 6,
      intro:
        "Investors hear lots of pitches. They ask questions to decide which businesses are likely to grow. Knowing what they look for helps you prepare.",
      blocks: [
        {
          type: "list",
          heading: "Signs investors like",
          items: [
            "A real problem that many people have.",
            "Evidence: customers who've tried it and want more.",
            "A founder who knows their costs, prices and profit.",
            "A team that listens, learns and keeps improving.",
            "Honesty about what's working and what isn't.",
          ],
        },
        {
          type: "table",
          caption: "Questions investors often ask",
          columns: ["Question", "What they want to know"],
          rows: [
            ["Who are your customers?", "That you know exactly who you're helping."],
            ["How do you make money?", "That the business can earn more than it spends."],
            ["What will you use the money for?", "That the investment will help you grow."],
            ["What's the biggest risk?", "That you're honest and have thought ahead."],
          ],
        },
        {
          type: "keyIdea",
          body: "Investors look for a real problem, evidence, honest founders and a clear plan.",
        },
      ],
      reflect: "What's the biggest risk for your idea? How might you reduce it?",
      activity: {
        kind: "sort",
        prompt: "Sort these into good signs and warning signs for an investor.",
        buckets: ["Good sign", "Warning sign"],
        items: [
          { label: "Customers tried it and asked for more", bucket: 0 },
          { label: "The founder doesn't know what each item costs", bucket: 1 },
          { label: "The team keeps testing and improving", bucket: 0 },
          { label: "The founder exaggerates how many they've sold", bucket: 1 },
        ],
        hint: "Investors want evidence and honesty. Which statements show those?",
        explanation: "Customer demand and continuous improvement are good signs. Not knowing costs and exaggerating are warning signs.",
      },
      takeaway: "Show investors evidence, know your numbers and be honest about risks.",
    },
  ],
  quiz: {
    passMark: 60,
    questions: [
      {
        key: "m6-q1",
        prompt: "What is an investor?",
        options: [
          { label: "Someone who gives money to a business in exchange for a share", correct: true, feedback: "Exactly." },
          { label: "Someone who buys one product", feedback: "That's a customer." },
          { label: "Someone who lends money that must be paid back with interest", feedback: "That's a lender." },
        ],
        explanation: "Investors swap money for part-ownership of the business.",
      },
      {
        key: "m6-q2",
        prompt: "A business has 10 equal shares. An investor gets 4. What percentage does the investor own?",
        options: [
          { label: "4%", feedback: "Each share is 10%, not 1%." },
          { label: "40%", correct: true, feedback: "Correct: 4 × 10% = 40%." },
          { label: "60%", feedback: "That's what the founder keeps." },
        ],
        explanation: "4 out of 10 shares is 40% of the business.",
      },
      {
        key: "m6-q3",
        prompt: "What is \"risk\" for an investor?",
        options: [
          { label: "The chance they could lose their money if the business fails", correct: true, feedback: "Right." },
          { label: "A guarantee they'll get rich", feedback: "There are no guarantees in investing." },
          { label: "A type of share", feedback: "Risk is about the chance of losing money." },
        ],
        explanation: "Investing is risky: if the business doesn't succeed, the investment can be lost.",
      },
      {
        key: "m6-q4",
        prompt: "Which is a good sign for an investor?",
        options: [
          { label: "Customers have tried the product and want more", correct: true, feedback: "Yes — that's real evidence." },
          { label: "The founder has no idea what things cost", feedback: "Not knowing costs is a warning sign." },
          { label: "The founder exaggerates sales", feedback: "Exaggerating breaks trust." },
        ],
        explanation: "Evidence from real customers shows the idea solves a real problem.",
      },
      {
        key: "m6-q5",
        prompt: "In Little Founders, what kind of money do investors use?",
        options: [
          { label: "Pretend Founder Bucks — no real money", correct: true, feedback: "Correct. Everything here is practice." },
          { label: "Real money from your family", feedback: "No — nothing in Little Founders uses real money." },
          { label: "Cryptocurrency", feedback: "No — investing here is pretend and for learning only." },
        ],
        explanation: "All investing in Little Founders is pretend so you can learn safely.",
      },
    ],
  },
};

export default academyModule;
