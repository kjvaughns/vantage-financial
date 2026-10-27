# Fix "Find your agency path" recommending Individual Agent to team leaders

## What's wrong
The questionnaire isn't keeping your earlier answers. Each answer replaces the one before it, so by the end only the last answer ("Where do you want to be in 12 months?") gets sent for the recommendation. With no team-size answer, the system treats everyone as having no downlines and always says Individual Agent. That's why you got "You have no agents writing under you," even though you picked 11–25 agents and $100K+.

The same problem means the answers saved for the application and sent to you have been incomplete too.

## Fix
- Keep every answer as the person moves through the questions, so all six answers are sent for the recommendation.
- Add a stronger fallback rule: someone with 11+ agents who chose "Agency owner with my own brand" or "keep my own brand" is recommended **Owner**. Anyone else with downlines gets **Builder**, and anyone with no downlines gets **Individual Agent**.
- If the AI's pick goes against these rules (for example, Individual Agent for someone with a team), use the rule-based pick instead.

## Technical details
- `src/routes/agency.path.tsx`: call `setAnswers(next)` in `advance()` before moving to the next step or submitting. `goBack` already reads from `answers`.
- `src/lib/agency-path.functions.ts`: the hard rule already overrides an AI "agent" pick for people with downlines. Strengthen `fallback()` so an owner-brand answer with 4+ agents gives `owner`.
- Add a small test for `fallback()`. Your case (11–25 agents, $100K+, own brand) should give `owner`, 1–3 agents should give `builder`, and "None" should give `agent`.
- Check in the browser by running your exact answers through the questionnaire.
