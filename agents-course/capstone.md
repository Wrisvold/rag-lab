# Capstone: The Agent Design Brief

In the capstone, you write an **agent design brief**. The brief describes one agent for one business problem. It must be complete enough for two readers:

- A technical team can build the agent from it.
- A manager can decide from it to approve the agent or not.

The capstone has three parts:

| Part | Due | Weight |
|---|---|---|
| Proposal | Week 4 | 5% |
| Brief | Week 8 | 20% |
| Presentation | Week 8 | 5% |

## Select your problem

You can use one of these two options:

1. **The Fall Line case.** Use your weekly assignments as the base. Add the parts that are missing, and correct the parts that your instructor marked.
2. **A problem from your own organization.** Use a real problem, but change the names and the numbers. Do not put confidential data into the brief. Do not put confidential data into an AI tool.

If you use option 2, the problem must need an agent. Use the test from Week 1. If a fixed workflow can do the task, select a different problem.

## Part 1. The proposal (Week 4)

**Steps:**

1. Select option 1 or option 2.
2. Describe the problem in 100 to 150 words. Tell who has the problem and what it costs now.
3. Tell why an agent is the correct solution. Use the conditions from Lesson 01.
4. Name the users and the business owner.
5. List the systems that the agent must use.
6. Name the largest risk that you see now.

**Submit:** One page, as a PDF or Word file.

**Rubric (100 points):**

| Criterion | Full credit | Partial credit | Points |
|---|---|---|---|
| Problem | Specific, with a user and a cost. | Vague, or no cost. | 30 |
| Agent decision | Uses Lesson 01 and shows why a fixed workflow is not sufficient. | The reasons are general. | 30 |
| Users, owner, and systems | All are named. | Some are missing. | 20 |
| Largest risk | A specific risk, and the reason that it is the largest. | A general risk, for example "the AI can be wrong." | 20 |

## Part 2. The brief (Week 8)

The brief has these 11 sections. Use these section titles. Each section shows which week teaches the topic.

1. **Summary.** The problem, the agent, the value, and the main risk, in 150 words or fewer. Write this section last.
2. **The decision to use an agent** (Week 1). Why an agent, the agent type, and what the agent must not do.
3. **Users and scope** (Week 1). The users, the business owner, the tasks in scope, and the tasks out of scope.
4. **Tools** (Week 2). A tool table with the schema, the type, and the approval rule of each tool.
5. **Knowledge and retrieval** (Week 3). The sources, the retrieval loop, the check step, and the stop condition.
6. **Planning** (Week 4). The plan for the most complex request, and the events that cause a new plan.
7. **Architecture** (Week 5). One agent or many, the pattern, and where MCP or A2A apply.
8. **Context and memory** (Week 6). The context map and the memory policy.
9. **Trust and security** (Week 7). The threat register, the approval matrix, and the rules for the system message.
10. **Evaluation and cost** (Week 8). These parts:
    - At least 10 offline test cases, with the correct behavior for each case
    - The online metrics, with a target for each metric
    - A cost estimate as a range for each month, with your assumptions
    - The cost limits, and what the agent does when it gets to a limit
11. **Open questions and next steps.** What you do not know yet, and how to learn it. Include a decision for the manager: approve a pilot, change the design, or stop.

**Length:** 3,000 to 5,000 words, not counting tables and diagrams.

**Writing:** Write the brief for a manager who is not a technical expert. Define each technical term the first time you use it. Use short sentences. The writing standard of this course, ASD-STE100, is a good model.

**Submit:** One PDF or Word file. Put your AI-use statement at the end.

**Rubric (100 points):**

| Criterion | Full credit | Partial credit | Points |
|---|---|---|---|
| Decision and scope (sections 2 and 3) | The decision is convincing. The scope is clear and has limits. | The decision or the scope is vague. | 10 |
| Tools (section 4) | A developer can build each tool from its schema. Each write tool has an approval rule. | Some schemas are not complete, or approval rules are missing. | 10 |
| Retrieval and planning (sections 5 and 6) | The loop has a check and a stop condition. The plan is complete and changes when the facts change. | The loop has no stop condition, or the plan is not complete. | 15 |
| Architecture, context, and memory (sections 7 and 8) | The architecture agrees with the scope. The memory policy protects personal data. | The architecture has no reasons, or the memory policy has gaps. | 15 |
| Trust and security (section 9) | The threat register is realistic. Each high-risk action needs approval. | Some threats or approvals are missing. | 15 |
| Evaluation and cost (section 10) | The test cases include failures and attacks. The metrics have targets. The cost estimate gives its assumptions. | Only normal test cases, or no targets, or no assumptions. | 15 |
| Summary and next steps (sections 1 and 11) | A manager can make a decision from the summary alone. | The summary does not give the value or the risk. | 10 |
| Consistency | All sections agree. For example, each tool in section 4 is in the approval matrix in section 9. | Some sections do not agree. | 5 |
| Writing | Clear and short. Each technical term has a definition. | Long or unclear. | 5 |

## Part 3. The presentation (Week 8)

Present your brief to the class as if the class is the approval board of the company.

**Steps:**

1. Prepare a presentation of 8 minutes, with 6 slides or fewer.
2. Show the problem, the agent, one complete example request, the main risks, and the cost.
3. End with the decision that you ask the board to make.
4. Answer questions for 4 minutes.

**Rubric (100 points):**

| Criterion | Full credit | Partial credit | Points |
|---|---|---|---|
| Clarity | A manager understands the agent and its value. | The presentation has too much technical detail, or it is not clear. | 30 |
| Example request | The example shows the tools, the check, and one approval. | The example is not complete. | 25 |
| Risks and cost | The main risks and the cost are clear and honest. | The risks or the cost are hidden or missing. | 25 |
| Answers to questions | The answers are direct and use the brief. | The answers are vague. | 10 |
| Time | 8 minutes or fewer. | More than 8 minutes. | 10 |
