/* ==========================================================================
   7RepWorkout.com - assessment content
   "Is 7RepWorkout right for you?" Edit the questions, scores and notes here.

   Each option has:
     id    - short, stable code (this is what gets saved and sent with the sign-up)
     text  - what the visitor sees
     score - how much it points toward "good fit" (can be negative)
     flag  - true for a "this isn't for you" signal. Any flag gives the kind
             "may not be your best fit" result, whatever else was answered.
     note  - optional line shown on the result screen when this option is chosen

   Result tiers (when nothing is flagged):
     score >= great     -> "This was built for you"
     score >= probable  -> "Probably a good fit"
     otherwise          -> "This may not be your best fit"
   No health information is asked for or stored.
   ========================================================================== */
window.ASSESSMENT = {
  version: 1,
  thresholds: { great: 8, probable: 4 },
  questions: [
    {
      id: "q1",
      type: "single",
      text: "Right now, what does your workout look like?",
      options: [
        { id: "starting", text: "I'm just starting", score: 1 },
        { id: "gap", text: "I haven't worked out in a year or two", score: 1 },
        { id: "hitmiss", text: "I work out, but it's hit-and-miss", score: 1 },
        { id: "regular", text: "I work out regularly", score: -1 }
      ]
    },
    {
      id: "q2",
      type: "single",
      text: "Do you have a workout program you love?",
      options: [
        { id: "yes", text: "Yes, I love my current program", score: 0, flag: true,
          note: "You already have a program you love. Keep it!" },
        { id: "sortof", text: "Sort of, kind of", score: 0 },
        { id: "no", text: "No", score: 1 }
      ]
    },
    {
      id: "q3",
      type: "single",
      text: "How much time can you spend per workout?",
      options: [
        { id: "u45", text: "Under 45 minutes", score: 1 },
        { id: "hour", text: "About an hour", score: 1 },
        { id: "over", text: "Over an hour, and I love it", score: 0, flag: true,
          note: "Every 7RepWorkout session is under an hour, and you love longer gym time." }
      ]
    },
    {
      id: "q4",
      type: "single",
      text: "How many days a week can you realistically work out?",
      options: [
        { id: "d12", text: "1 or 2 days", score: 0,
          note: "Weeks 5-8 build to 4 short sessions a week, so you'll want a couple more days by then." },
        { id: "d3", text: "3 days", score: 1,
          note: "Weeks 5-8 build to 4 short sessions a week, so you'll want one more day by then." },
        { id: "d4", text: "4 or more days", score: 1 },
        { id: "d5", text: "I need to work out every day", score: 0, flag: true,
          note: "7RepWorkout is built for 4 short sessions a week.  You'll need recovery time." }
      ]
    },
    {
      id: "q5",
      type: "multi",
      text: "Which of these sound like you?",
      hint: "Pick any that apply.",
      maxScore: 2,
      options: [
        { id: "startstop", text: "I start strong, then stop", score: 1 },
        { id: "noprogress", text: "I quit because I wasn't seeing progress", score: 1 },
        { id: "hurt", text: "I've been hurt lifting too heavy or doing too much", score: 1 },
        { id: "skipmuscles", text: "I skip muscle groups I don't like training", score: 1 },
        { id: "none", text: "None of these", score: 0, exclusive: true }
      ]
    },
    {
      id: "q6",
      type: "single",
      text: "What do you want most from a workout?",
      options: [
        { id: "progress", text: "Steady, visible progress", score: 1 },
        { id: "schedule", text: "Something that fits my busy schedule", score: 1 },
        { id: "safe", text: "Not getting hurt", score: 1 },
        { id: "max", text: "Maximum size or to compete professionally", score: 0, flag: true,
          note: "7RepWorkout isn't built for maximum size or competing." }
      ]
    },
    {
      id: "q7",
      type: "single",
      text: "How do you feel about lifting heavy?",
      options: [
        { id: "light", text: "Are you kidding me?  Ah no.", score: 1 },
        { id: "moderate", text: "I'd rather go moderate and build steadily", score: 1 },
        { id: "heavy", text: "I love lifting as heavy as I can", score: 0, flag: true,
          note: "You love lifting as heavy as you can, and 7RepWorkout starts at 70% of your max." }
      ]
    },
    {
      id: "q8",
      type: "single",
      text: "Do you have a set of dumbbells?",
      options: [
        { id: "yes", text: "Yes", score: 1 },
        { id: "notyet", text: "Not yet", score: 0,
          note: "You'll need a set of dumbbells to get started." }
      ]
    },
    {
      id: "q9",
      type: "single",
      text: "How much equipment do you need to feel set?",
      options: [
        { id: "basics", text: "A set of dumbbells and a few basics is plenty", score: 1 },
        { id: "room", text: "I need a room full of equipment", score: -1,
          note: "7RepWorkout is built around the basics, not a room full of equipment." }
      ]
    },
    {
      id: "q10",
      type: "single",
      text: "Will you follow the same plan for 8 weeks and write down your weights?",
      options: [
        { id: "yes", text: "Yes", score: 1 },
        { id: "maybe", text: "Maybe", score: 0,
          note: "It works best to follow the same plan for all 8 weeks and write down the weights you use." },
        { id: "no", text: "No", score: -1 }
      ]
    }
  ]
};
