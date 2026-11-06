// Investor Room personas and question bank (Phase 6). Rules: docs/PITCH_STUDIO.md.
//
// Seeded into investor_personas / investor_questions / investor_answer_options by
// `npm run content:seed`. This file contains the rubric scores, so the app never
// imports it: pages read personas and questions from the database, where option scores
// and feedback are hidden by column grants until the child has answered.
//
// Every persona is a made-up, friendly, PRETEND investor for practice. They never make
// investment decisions, promise funding or review a child's idea for real.
// Each persona asks exactly one question per pitch section (= rubric criterion).
// Each question has three answers: one strong (3), one partial (1) and one off-track (0).
// Keep this file free of imports (Node loads it).

export type InvestorOption = { label: string; score: 0 | 1 | 2 | 3; feedback: string };

export type InvestorQuestion = {
  key: string;
  section: "problem" | "solution" | "customer" | "business_model" | "ask";
  prompt: string;
  hint: string;
  options: InvestorOption[];
};

export type InvestorPersona = {
  key: "penny" | "captain" | "ivy" | "sam";
  name: string;
  focus: string;
  style: string;
  intro: string;
  questions: InvestorQuestion[];
};

export const investorPersonas: InvestorPersona[] = [
  {
    key: "penny",
    name: "Penny the Planner",
    focus: "Money, costs and profit",
    style: "Precise and friendly",
    intro:
      "Hello! I'm Penny, a pretend investor who loves a good plan. I like to see how the numbers fit together — don't worry about being exact, I just want to see you've thought about it.",
    questions: [
      {
        key: "penny-problem",
        section: "problem",
        prompt: "How do you know this problem is worth solving?",
        hint: "Think about evidence: who told you, or what did you see?",
        options: [
          { label: "I asked people who have the problem, and most of them said it happens often.", score: 3, feedback: "Strong! Talking to real people is the best evidence that a problem matters." },
          { label: "I think it's a problem because it annoys me.", score: 1, feedback: "Noticing it yourself is a good start. Next, check whether other people have the same problem." },
          { label: "Every single person in the world has this problem.", score: 0, feedback: "Investors get a bit wary when they hear 'everyone'. Try saying exactly who has it." },
        ],
      },
      {
        key: "penny-solution",
        section: "solution",
        prompt: "What would it cost to make or run your solution?",
        hint: "Think about materials, tools and time.",
        options: [
          { label: "I listed what I'd need, like materials and time, and guessed the cost of each.", score: 3, feedback: "Great planning! Breaking costs into parts makes them much easier to work out." },
          { label: "It wouldn't cost much, I think.", score: 1, feedback: "Maybe! Try listing each thing you'd need — it's easy to forget small costs." },
          { label: "Costs don't matter if the idea is good enough.", score: 0, feedback: "Even great ideas need to cover their costs, or the business runs out of money." },
        ],
      },
      {
        key: "penny-customer",
        section: "customer",
        prompt: "How many customers could you realistically reach at first?",
        hint: "Start small — who could you actually reach?",
        options: [
          { label: "A small group I can really reach, like my class or a club, then grow from there.", score: 3, feedback: "Sensible! Starting small lets you learn before you grow." },
          { label: "Probably millions, once it becomes famous.", score: 1, feedback: "Dreaming big is fun! Investors also like a first step: who would your very first customers be?" },
          { label: "I haven't thought about who would buy it.", score: 0, feedback: "That's okay for now — a good next step is to picture your first ten customers." },
        ],
      },
      {
        key: "penny-business-model",
        section: "business_model",
        prompt: "How will your price cover your costs?",
        hint: "Compare what you charge with what each one costs you.",
        options: [
          { label: "My price is more than each one costs to make, so every sale leaves some profit.", score: 3, feedback: "Exactly right! Price minus cost is the profit on each sale." },
          { label: "I'd set my price the same as my costs.", score: 1, feedback: "That's called breaking even: you wouldn't lose money, but you wouldn't make any either." },
          { label: "I'd charge whatever people feel like and work it out later.", score: 0, feedback: "Penny likes a plan! Try comparing a price with your costs before you start." },
        ],
      },
      {
        key: "penny-ask",
        section: "ask",
        prompt: "If you had some pretend funding, what would you spend it on first?",
        hint: "What would help your idea most right now?",
        options: [
          { label: "Something that helps me test or improve my idea, like materials for a better prototype.", score: 3, feedback: "Smart! Spending on testing and improving helps your idea grow." },
          { label: "A big launch party to celebrate.", score: 1, feedback: "Celebrating is lovely! First, spend on things that make the idea work better." },
          { label: "I'm not sure. I'd probably just keep it.", score: 0, feedback: "Saving is sensible, but investors want to hear a plan for how the funding helps the business." },
        ],
      },
    ],
  },
  {
    key: "captain",
    name: "Captain Customer",
    focus: "Who buys, and why",
    style: "Curious",
    intro:
      "Ahoy! I'm Captain Customer, a pretend investor. I'm always curious about the people your idea is for — let's find out how well you know them!",
    questions: [
      {
        key: "captain-problem",
        section: "problem",
        prompt: "Who has this problem the most?",
        hint: "Be specific: which people, and why them?",
        options: [
          { label: "A specific group, like children who walk dogs before school, and I can explain why.", score: 3, feedback: "Spot on! A specific group is much easier to help than 'everyone'." },
          { label: "Lots of different people, probably.", score: 1, feedback: "Maybe so! Try picking the group who has it worst — they'll want your idea most." },
          { label: "I don't really know who has it.", score: 0, feedback: "No problem — watching and asking people is a great way to find out." },
        ],
      },
      {
        key: "captain-solution",
        section: "solution",
        prompt: "Why would customers choose your idea instead of what they do now?",
        hint: "What's one way yours is better?",
        options: [
          { label: "Mine is better in one clear way, like quicker or cheaper, and I can say how.", score: 3, feedback: "Excellent! One clear reason is more convincing than lots of vague ones." },
          { label: "Because mine is new.", score: 1, feedback: "New is exciting, but customers want to know how it's better for them." },
          { label: "They wouldn't have any other choice.", score: 0, feedback: "Customers almost always have another choice — even doing nothing! Think about why yours wins." },
        ],
      },
      {
        key: "captain-customer",
        section: "customer",
        prompt: "How did you find out what your customers want?",
        hint: "Did you ask, watch or guess?",
        options: [
          { label: "I asked a few people who might use it what they think, and listened to their answers.", score: 3, feedback: "That's exactly what real founders do. Listening to customers is a superpower!" },
          { label: "I guessed, based on what I would want.", score: 1, feedback: "Your own view is a fine starting point. Next, check it with a few other people." },
          { label: "Customers will want whatever I make.", score: 0, feedback: "If only! The best businesses make what customers already want." },
        ],
      },
      {
        key: "captain-business-model",
        section: "business_model",
        prompt: "Who pays: the person who uses it, or someone else?",
        hint: "Users and buyers can be different people.",
        options: [
          { label: "I know who pays and why they'd be happy to, even if they're not the user.", score: 3, feedback: "Great thinking! Knowing who pays, and why, is the heart of a business model." },
          { label: "Whoever wants to, I suppose.", score: 1, feedback: "Try naming the person who pays. For example, parents often buy things children use." },
          { label: "I haven't decided if anyone pays.", score: 0, feedback: "That's worth working out. Without someone paying, a business can't keep going." },
        ],
      },
      {
        key: "captain-ask",
        section: "ask",
        prompt: "What would you do next to learn more about your customers?",
        hint: "How could you test your idea with real people?",
        options: [
          { label: "Let a few people try a simple version, then ask what they'd change.", score: 3, feedback: "Perfect! Testing a simple version is quick, cheap and teaches you loads." },
          { label: "Make lots of them straight away and see what happens.", score: 1, feedback: "Bold! It's safer to test a few first, so you don't make lots of something people don't want." },
          { label: "Nothing. I already know enough.", score: 0, feedback: "Even big companies keep learning about their customers. There's always more to find out!" },
        ],
      },
    ],
  },
  {
    key: "ivy",
    name: "Inventor Ivy",
    focus: "Solutions and creativity",
    style: "Enthusiastic",
    intro:
      "Hi hi! I'm Inventor Ivy, a pretend investor who loves clever ideas. I want to hear all about how your invention works and how you'll make it even better!",
    questions: [
      {
        key: "ivy-problem",
        section: "problem",
        prompt: "What made you notice this problem?",
        hint: "Can you describe a time you saw it happen?",
        options: [
          { label: "I saw it happen in real life, and I can describe a time it happened.", score: 3, feedback: "Love it! A real story makes listeners understand the problem straight away." },
          { label: "Someone told me it might be a problem.", score: 1, feedback: "Good listening! Can you also see it for yourself, or ask a few more people?" },
          { label: "I picked it because it sounded exciting.", score: 0, feedback: "Excitement is great fuel! Make sure it's a problem real people have, too." },
        ],
      },
      {
        key: "ivy-solution",
        section: "solution",
        prompt: "How does your solution actually work?",
        hint: "Could you explain it in steps?",
        options: [
          { label: "I can explain it step by step, from start to finish.", score: 3, feedback: "Wonderful! If you can explain it in steps, other people can picture it." },
          { label: "It's hard to explain, but it's really cool.", score: 1, feedback: "It might be very cool! Practise explaining it in three simple steps." },
          { label: "I'll work out how it works later.", score: 0, feedback: "Inventors sketch how things work early. Try drawing a quick diagram." },
        ],
      },
      {
        key: "ivy-customer",
        section: "customer",
        prompt: "What would customers say after using your idea?",
        hint: "Think about how it helps them.",
        options: [
          { label: "They'd say it fixed their problem, because I designed it around what they need.", score: 3, feedback: "Brilliant! Designing around customers' needs is what makes inventions useful." },
          { label: "They'd say it looks nice.", score: 1, feedback: "Looks matter, but customers care most about whether it solves their problem." },
          { label: "I don't know what they'd think.", score: 0, feedback: "Why not find out? Show a sketch to a few people and ask what they think." },
        ],
      },
      {
        key: "ivy-business-model",
        section: "business_model",
        prompt: "How could your clever idea make money?",
        hint: "What would people pay, and for what?",
        options: [
          { label: "By selling it for a price people are happy to pay, which is more than it costs to make.", score: 3, feedback: "Yes! A clever idea plus a sensible price makes a real business." },
          { label: "It's so clever that money will just come in.", score: 1, feedback: "Clever helps, but you still need a plan for who pays and how much." },
          { label: "Money isn't important for an invention.", score: 0, feedback: "To keep inventing, a business needs to cover its costs. Money helps ideas keep going!" },
        ],
      },
      {
        key: "ivy-ask",
        section: "ask",
        prompt: "How would you make your idea even better?",
        hint: "What's your plan to improve it?",
        options: [
          { label: "Build a prototype, test it and improve it based on what I learn.", score: 3, feedback: "That's the inventor's loop: build, test, improve. Fantastic!" },
          { label: "Add lots of extra features straight away.", score: 1, feedback: "Extra features can wait. Test the simple version first to see what people really need." },
          { label: "It's already perfect.", score: 0, feedback: "Even the best inventions get improved many times. Testing will show you how!" },
        ],
      },
    ],
  },
  {
    key: "sam",
    name: "Steady Sam",
    focus: "Risks and next steps",
    style: "Calm and careful",
    intro:
      "Hello there. I'm Steady Sam, a pretend investor. I like to think carefully about what could go wrong and what comes next. Take your time — there are no trick questions.",
    questions: [
      {
        key: "sam-problem",
        section: "problem",
        prompt: "What happens if nobody solves this problem?",
        hint: "What do people lose: time, money, fun?",
        options: [
          { label: "People keep losing time, money or fun, and I can give an example.", score: 3, feedback: "Very clear. Showing what people lose helps others see why your idea matters." },
          { label: "Nothing much, but it would be nice to fix.", score: 1, feedback: "Nice-to-fix problems can work, but think about how much it really bothers people." },
          { label: "I don't know.", score: 0, feedback: "That's a good thing to think about. Ask someone who has the problem how it affects them." },
        ],
      },
      {
        key: "sam-solution",
        section: "solution",
        prompt: "What could go wrong with your solution, and what would you do?",
        hint: "Name one risk and one way to handle it.",
        options: [
          { label: "I've thought of one thing that might go wrong and a way to handle it.", score: 3, feedback: "Very sensible. Planning for problems shows you're a careful founder." },
          { label: "Something might go wrong, but I'll worry about it later.", score: 1, feedback: "Later is fine for some things, but thinking about one risk now can save trouble." },
          { label: "Nothing could ever go wrong.", score: 0, feedback: "Things can always go wrong, and that's okay! Founders plan for it." },
        ],
      },
      {
        key: "sam-customer",
        section: "customer",
        prompt: "What would you do if your first customers didn't like it?",
        hint: "How would you use their feedback?",
        options: [
          { label: "Ask them why, then change my idea using what they said.", score: 3, feedback: "Excellent. Feedback, even when it's hard to hear, helps you build something better." },
          { label: "Look for different customers who might like it.", score: 1, feedback: "Sometimes that works! It's worth asking the first customers why, too." },
          { label: "Give up on the idea.", score: 0, feedback: "Most founders hear 'no' lots of times. Each 'no' teaches you something." },
        ],
      },
      {
        key: "sam-business-model",
        section: "business_model",
        prompt: "What would you do if it cost more to make than you expected?",
        hint: "How could you change the plan?",
        options: [
          { label: "Look for cheaper materials or change my price, then check the numbers again.", score: 3, feedback: "Calm and clever. Adjusting costs or price is exactly how businesses handle surprises." },
          { label: "Keep going and hope it works out.", score: 1, feedback: "Hope helps, but checking your numbers again is safer." },
          { label: "Just spend more without checking the numbers.", score: 0, feedback: "Spending more without checking could mean losing money. Always look at the numbers first." },
        ],
      },
      {
        key: "sam-ask",
        section: "ask",
        prompt: "What is the very next small step you would take?",
        hint: "Something you could actually do soon.",
        options: [
          { label: "One small, clear step I could do this week, like sketching it or asking five people.", score: 3, feedback: "Perfect. Small, clear steps are how big ideas get started." },
          { label: "Start a huge company straight away.", score: 1, feedback: "Big dreams are great! Break them into a small first step you can do soon." },
          { label: "Wait until someone else does it first.", score: 0, feedback: "Waiting means someone else might solve it. A tiny first step is a great start!" },
        ],
      },
    ],
  },
];
