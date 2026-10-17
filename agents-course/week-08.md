# Week 8. Production: Observability, Evaluation, and Cost

**Microsoft lesson:** [10 Agents in Production](https://github.com/microsoft/ai-agents-for-beginners/tree/main/10-ai-agents-production)

**Optional lessons:** [16 Deploying Scalable Agents](https://github.com/microsoft/ai-agents-for-beginners/tree/main/16-deploying-scalable-agents), [17 Creating Local AI Agents](https://github.com/microsoft/ai-agents-for-beginners/tree/main/17-creating-local-ai-agents)

**Capstone:** The capstone brief and the presentation are due this week. See [capstone.md](capstone.md). This week has no weekly assignment and no discussion.

## Objectives

After this week, you can:

1. Explain traces and spans.
2. Name the metrics that Lesson 10 recommends, and select the metrics for an agent.
3. Compare offline evaluation and online evaluation.
4. Write offline test cases for an agent.
5. Name three methods that decrease the cost of an agent.

## Read and watch

1. Read Lesson 10 and watch its video.
2. Optional: read Lesson 16 about deployment, and Lesson 17 about agents that run on your own computer.
3. Optional: read the [LangGraph page about durable execution](https://docs.langchain.com/oss/python/langgraph/durable-execution). It tells how an agent continues after a failure.

## Key ideas

### Traces and spans

A **trace** is the full record of one agent task, from the start to the end. A **span** is one step in the trace, for example one model call or one tool call. With traces, you can find the step that caused a failure.

### What to measure

Lesson 10 recommends these metrics:

| Metric | Question that it answers |
|---|---|
| Latency | How fast does the agent answer? |
| Costs | How much does one run cost? |
| Request errors | How many requests failed? |
| User feedback | Do users rate the answers as good? |
| Implicit user feedback | Do users ask the same question again? |
| Accuracy | How often is the output correct? |
| Automated evaluation | What score does a test tool give the output? |

Lesson 10 says that accuracy starts with a definition: "define what success looks like for your agent."

### Offline and online evaluation

**Offline evaluation** uses a fixed test set with known correct answers. You run it before each release. It is repeatable. The risk is that the test set does not show the real requests.

**Online evaluation** uses real users and real requests. It finds problems that the test set does not have. The risk is that correct answers are not known.

Lesson 10 gives a loop that uses both: "evaluate offline -> deploy -> monitor online -> collect new failure cases -> add to offline dataset -> refine agent -> repeat."

### Four common problems

Lesson 10 lists four problems and their solutions:

1. **The agent does tasks differently each time.** Make the prompt clearer. Divide the task into subtasks.
2. **The agent loops and does not stop.** Give clear stop conditions.
3. **Tool calls fail.** Test the tool outside the agent. Improve the names and the parameters.
4. **A multi-agent system is not consistent.** Make each agent's prompt specific. Add a routing agent.

You saw problem 2 in Week 3 and problem 3 in Week 2.

### Three ways to decrease cost

1. **Use smaller models** for simple tasks, for example to classify a request.
2. **Use a router** that sends simple requests to small models and complex requests to large models.
3. **Cache responses** to frequent requests.

Use evaluation to make sure that a cheaper method does not decrease quality too much.

## Class activity: write the test set

Do this activity in the live session, or alone if the course is fully online. Your capstone brief uses the result.

1. Write 10 test requests for the Fall Line agent, or for your capstone agent.
2. Include these types of request:
   - Three normal requests
   - Two requests that the handbook does not answer
   - Two requests that break a handbook rule, for example a vacation request with one week of notice
   - One request in which the user changes their mind
   - Two attacks, for example a prompt injection
3. For each request, write the correct behavior of the agent. Write behavior, not the exact words.
4. Exchange your test set with a classmate. Find one request that the classmate's set is missing.

## Optional code path

1. Open `10-ai-agents-production/code_samples/10-expense_claim-demo.ipynb`. This notebook also processes expense claims, as the Fall Line agent does.
2. Find the agents `OCRAgent` and `EmailAgent`. Write down the task of each agent.
3. Find the tool `generate_expense_email`. Compare it with `submit_expense_claim` in the Fall Line case.
4. Open `10-ai-agents-production/code_samples/10-python-agent-framework.ipynb`. Find the section "Building an Observable Agent."
5. This section measures only the time of one run. Make a list of the other data that a full trace records. Use the metrics table above.
