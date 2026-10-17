# Week 4. Planning and Metacognition

**Microsoft lessons:** [07 Planning Design](https://github.com/microsoft/ai-agents-for-beginners/tree/main/07-planning-design), [09 Metacognition](https://github.com/microsoft/ai-agents-for-beginners/tree/main/09-metacognition)

**Capstone:** The capstone proposal is due this week. See [capstone.md](capstone.md).

## Objectives

After this week, you can:

1. Write a clear goal for an agent.
2. Break a goal into subtasks and arrange them in a logical sequence.
3. Explain why structured output helps other agents and code to use a plan.
4. Explain when an agent must change its plan.
5. Define metacognition and give an example of an agent that changes its method.

## Read and watch

1. Read Lesson 07 and watch its video.
2. Lesson 09 is long. Read these sections only:
   - "Introduction to Metacognition"
   - "Components of an AI Agent," with the travel agent example
   - "2. Planning in Agents"
   - "3. Corrective RAG System," to the end of "Corrective RAG in Travel Agent"
   - "Example of Metacongition" (the lesson spells the title this way)
3. Watch the video of Lesson 09.

## Key ideas

### Start with a clear goal

Lesson 07 starts with a goal: "Generate a 3-day travel itinerary." The goal is easy to say but not yet clear. A clear goal tells the agent what result is complete.

Compare these two goals for Fall Line:

- Weak: "Help the employee with vacation."
- Clear: "Prepare a vacation request that obeys Section 3.1, and send it to the manager after the employee approves it."

### Break the goal into subtasks

Lesson 07 breaks the travel goal into subtasks: flight booking, hotel booking, car rental, and personalization. Each subtask can go to a different agent or process. A coordinator collects the results.

### Use structured output

A model can write a plan as structured output, for example JSON. Code and other agents can read structured output with no errors of interpretation. In the Lesson 07 notebook, the plan is a `TravelPlan` with a list of subtasks. Each subtask has an assigned agent.

### Change the plan when the facts change

Lesson 07 calls this **iterative planning**. The result of one subtask can change the next subtask. User feedback can also cause a new plan. For example, the employee does not have sufficient vacation days for the dates. The agent must then change the plan.

### Metacognition: the agent examines its own method

Lesson 09 defines metacognition as "thinking about thinking." An agent with metacognition examines its results and changes its method. Lesson 09 gives four abilities:

- **Self-reflection.** The agent analyzes its performance.
- **Adaptability.** The agent changes its methods from feedback.
- **Error correction.** The agent finds and corrects its errors.
- **Resource management.** The agent uses time and computing power carefully.

The last example in Lesson 09 is clear. An agent selects the cheapest hotel. User feedback says that the quality was too low. The agent then changes its rule from "cheapest" to "highest quality."

### Corrective RAG

Lesson 09 also gives corrective RAG. The agent uses feedback to write new search queries and to rank new results. This is the loop of Week 3, with feedback from the user added.

## Discussion 4

Metacognition lets an agent change its own rules. In the Lesson 09 example, the agent changes from "cheapest" to "highest quality." Which rules of the Fall Line agent must the agent never change by itself? Who must approve a change to those rules?

## Assignment 4. The Plan for One Request

**Purpose:** Write the plan that the Fall Line agent makes for one multi-step request.

Use this request from an employee:

> "I want to take the week of 14 December off. Also, I had a business lunch last Tuesday and paid 42 dollars. Can you deal with both?"

**Steps:**

1. Write a clear goal for the request.
2. Break the goal into subtasks. Arrange them in a logical sequence. For each subtask, give the tool that it uses.
3. Write the plan as a table with these columns: number, subtask, tool, input, output, and depends on.
4. Name the handbook rules that the plan must check. Give the section numbers. Include the notice period, the 90-day rule, the 30-day limit, and the receipt rule.
5. Give two events that make the agent change the plan. For each event, write the new plan steps.
6. Write one metacognition rule. The rule tells the agent how to change its method after a failure. Tell who must approve the rule.
7. At the end, write your statement about the AI tools that you used.

**Submit:** A plan table and 400 to 700 words of text, as a PDF or Word file.

**Rubric (100 points):**

| Criterion | Full credit | Partial credit | Points |
|---|---|---|---|
| Goal | The goal is clear and tells what result is complete. | The goal is vague. | 10 |
| Subtasks and sequence | All necessary subtasks are present. The sequence and the dependencies are correct. | A subtask is missing, or the sequence has an error. | 25 |
| Handbook rules | The four rules are correct, with section numbers. | One or two rules are missing or wrong. | 20 |
| Changes to the plan | Two realistic events, each with correct new steps. | One event, or the new steps do not solve the problem. | 25 |
| Metacognition rule | The rule is specific, safe, and has an approver. | The rule is vague or has no approver. | 20 |

## Optional code path

1. Open `07-planning-design/code_samples/07-python-agent-framework.ipynb`.
2. Find the classes `TravelSubTask` and `TravelPlan`. Write down their fields.
3. Compare those fields with the columns of your plan table.
4. Find the agent `Concierge`. Write down the tools that it uses to do the plan.
