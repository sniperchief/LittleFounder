import type { AcademyModuleContent } from "./types";

const academyModule: AcademyModuleContent = {
  key: "understand-business",
  position: 4,
  title: "Understand Business",
  summary: "Costs, prices, revenue and profit — the maths that keeps a business going.",
  icon: "coins",
  tone: "mint",
  badge: {
    key: "business-thinker",
    title: "Business Thinker",
    description: "Completed Understand Business: you can work out costs, set a fair price and calculate profit.",
  },
  lessons: [
    {
      key: "what-things-cost",
      title: "What does it cost?",
      minutes: 6,
      intro:
        "Every business spends money to make and sell things. These are its costs. In Little Founders we use pretend money called Founder Bucks (FB) — but the maths is the same as with real money.",
      blocks: [
        {
          type: "text",
          heading: "Two kinds of cost",
          body: "Fixed costs stay the same however many things you sell — like a table for your stall. Variable costs go up with every item you make — like the lemons in each cup of lemonade.",
        },
        {
          type: "table",
          caption: "A lemonade stand's costs",
          columns: ["Cost", "Type"],
          rows: [
            ["A folding table (bought once)", "Fixed"],
            ["A painted sign", "Fixed"],
            ["Lemons and sugar for each cup", "Variable"],
            ["A paper cup for each drink", "Variable"],
          ],
        },
        {
          type: "example",
          title: "Cost per item",
          body: "If 10 cups of lemonade need 20 FB of lemons, sugar and cups, the variable cost per cup is 20 ÷ 10 = 2 FB. Knowing the cost of each item helps you choose a price.",
          scene: "costs",
        },
        {
          type: "keyIdea",
          body: "Fixed costs don't change with how much you sell. Variable costs grow with every item.",
        },
      ],
      reflect: "Think of a business you'd like to run. What would you need to buy once? What would you need for every item?",
      activity: {
        kind: "sort",
        prompt: "A friendship-bracelet business: sort each cost as fixed or variable.",
        buckets: ["Fixed cost", "Variable cost"],
        items: [
          { label: "A storage box for supplies (bought once)", bucket: 0 },
          { label: "Beads for each bracelet", bucket: 1 },
          { label: "A sign for the stall", bucket: 0 },
          { label: "Thread for each bracelet", bucket: 1 },
        ],
        hint: "Ask: would this cost go up if I made one more bracelet?",
        explanation: "The box and sign are bought once (fixed). Beads and thread are needed for every bracelet (variable).",
      },
      takeaway: "Know your fixed costs, your variable costs and the cost of making one item.",
    },
    {
      key: "setting-a-price",
      title: "Setting a price",
      minutes: 6,
      intro:
        "Choosing a price is one of the most important decisions a founder makes. Too low and you lose money. Too high and nobody buys.",
      blocks: [
        {
          type: "list",
          heading: "Three things to check",
          items: [
            "Your cost: the price must be higher than what each item costs you to make.",
            "Your customers: what would they be happy to pay?",
            "Other options: what do similar things cost elsewhere?",
          ],
        },
        {
          type: "example",
          title: "Pricing a bookmark",
          body: "Each hand-made bookmark costs 3 FB in card and ribbon. Similar bookmarks at the school fair sell for 6–8 FB. A price of 7 FB covers the cost, leaves something extra, and is fair compared with others.",
          scene: "price-tag",
        },
        {
          type: "scenario",
          title: "Value, not just cost",
          body: "Customers pay for what something does for them, not for what it cost you. A bookmark with someone's favourite animal on it may be worth more to them than a plain one — even if both cost the same to make.",
        },
        {
          type: "keyIdea",
          body: "A good price covers your costs, feels fair to customers and makes sense next to other options.",
        },
      ],
      reflect: "Think of something you bought recently. Do you think the price was fair? Why?",
      activity: {
        kind: "choose",
        prompt: "Each bookmark costs 3 FB to make. Similar ones sell for 6–8 FB. What's the best price?",
        options: [
          { label: "1 FB", feedback: "That's less than it costs to make — you'd lose 2 FB on every bookmark." },
          { label: "7 FB", correct: true, feedback: "Yes — it covers the cost and is fair compared with others." },
          { label: "50 FB", feedback: "Much higher than similar bookmarks, so customers would likely go elsewhere." },
        ],
        explanation: "7 FB is above the 3 FB cost and in line with what customers already pay for similar bookmarks.",
      },
      takeaway: "Price above your cost, at a level customers think is fair.",
    },
    {
      key: "revenue-and-profit",
      title: "Revenue and profit",
      minutes: 7,
      intro:
        "How do you know if a business is doing well? Two words help: revenue and profit. They sound similar but mean different things.",
      blocks: [
        {
          type: "steps",
          heading: "The two formulas",
          items: [
            { title: "Revenue = price × number sold", body: "All the money that comes in from sales." },
            { title: "Profit = revenue − costs", body: "What's left after you pay for everything." },
          ],
        },
        {
          type: "example",
          title: "A Saturday lemonade stand",
          body: "You sell 20 cups at 5 FB each. Revenue = 5 × 20 = 100 FB. Your lemons, sugar, cups and a sign cost 40 FB in total. Profit = 100 − 40 = 60 FB.",
          scene: "profit",
        },
        {
          type: "text",
          heading: "What if profit is negative?",
          body: "If costs are bigger than revenue, the result is a loss. Founders then look for ways to lower costs, change the price or sell more — and try again.",
        },
        {
          type: "keyIdea",
          body: "Revenue is what comes in. Profit is what's left after costs.",
        },
      ],
      reflect: "If your lemonade stand made a loss, what are two things you could change?",
      activity: {
        kind: "fill",
        prompt: "You sell 12 bracelets at 6 FB each. Your total costs were 30 FB. What is your profit?",
        suffix: "FB",
        answer: 42,
        hint: "First find revenue (price × number sold), then subtract the costs.",
        explanation: "Revenue = 6 × 12 = 72 FB. Profit = 72 − 30 = 42 FB.",
      },
      takeaway: "Revenue = price × number sold. Profit = revenue − costs.",
    },
  ],
  quiz: {
    passMark: 60,
    questions: [
      {
        key: "m4-q1",
        prompt: "Which of these is a variable cost for a cupcake stall?",
        options: [
          { label: "Flour and icing for each cupcake", correct: true, feedback: "Yes — you need more for every cupcake." },
          { label: "A cake stand bought once", feedback: "That's a fixed cost — it doesn't change with sales." },
          { label: "A tablecloth", feedback: "That's fixed too." },
        ],
        explanation: "Variable costs grow with each item you make.",
      },
      {
        key: "m4-q2",
        prompt: "You sell 10 cards at 4 FB each. What is your revenue?",
        options: [
          { label: "14 FB", feedback: "Revenue is price × number sold, not price + number." },
          { label: "40 FB", correct: true, feedback: "Correct: 4 × 10 = 40 FB." },
          { label: "6 FB", feedback: "Multiply the price by the number sold." },
        ],
        explanation: "Revenue = price × number sold = 4 × 10 = 40 FB.",
      },
      {
        key: "m4-q3",
        prompt: "Revenue is 50 FB and costs are 20 FB. What is the profit?",
        options: [
          { label: "70 FB", feedback: "Profit takes costs away — it doesn't add them." },
          { label: "30 FB", correct: true, feedback: "Correct: 50 − 20 = 30 FB." },
          { label: "20 FB", feedback: "That's the cost. Subtract it from the revenue." },
        ],
        explanation: "Profit = revenue − costs = 50 − 20 = 30 FB.",
      },
      {
        key: "m4-q4",
        prompt: "A keyring costs 5 FB to make. Which price would lose money on every sale?",
        options: [
          { label: "4 FB", correct: true, feedback: "Right — you'd lose 1 FB on each keyring." },
          { label: "8 FB", feedback: "8 FB is above the cost, so it makes a profit." },
          { label: "10 FB", feedback: "10 FB is above the cost." },
        ],
        explanation: "Any price below the cost of making the item loses money.",
      },
      {
        key: "m4-q5",
        prompt: "What are Founder Bucks (FB)?",
        options: [
          { label: "Pretend money used for learning in Little Founders", correct: true, feedback: "Yes — they can't be spent or swapped for real money." },
          { label: "Real money you can spend in shops", feedback: "No — Founder Bucks are pretend." },
          { label: "A type of bank account", feedback: "No — Founder Bucks are only for learning." },
        ],
        explanation: "Founder Bucks are a pretend currency so you can practise business maths safely.",
      },
    ],
  },
};

export default academyModule;
