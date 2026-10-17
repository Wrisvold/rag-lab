# Week 3. Agentic RAG

**Microsoft lesson:** [05 Agentic RAG](https://github.com/microsoft/ai-agents-for-beginners/tree/main/05-agentic-rag)

**Tools:** [RAG Lab](https://wrisvold.github.io/rag-lab/) and RAG Lab [Agent mode](https://wrisvold.github.io/rag-lab/agent.html)

## Objectives

After this week, you can:

1. Explain the difference between RAG and agentic RAG.
2. Describe the maker-checker loop and its four steps.
3. Find a retrieval failure in RAG Lab, and correct it by hand as an agent would.
4. Write a check step and a stop condition for a retrieval loop.
5. Explain the limits of agentic RAG that Lesson 05 gives.
6. Run an agent loop in Agent mode, and name the stop condition that stopped it.

## Read and watch

1. Read Lesson 05 and watch its video.
2. Read these sections again: "Iterative Loops, Tool Integration, and Memory," "Handling Failure Modes and Self-Correction," and "Boundaries of Agency."
3. Do the RAG Lab activity below before you start the assignment.
4. Then do the Agent mode activity. It does the same loop with no person.

## Key ideas

### RAG does one pass. Agentic RAG does a loop.

In CBIS 5530 you used RAG Lab. Its pipeline runs one time, in a fixed sequence: chunk, embed, retrieve, assemble, answer. If the retrieval is bad, the answer is bad. The pipeline does not know that the retrieval is bad.

Lesson 05 describes a loop. The agent retrieves, examines the result, and retrieves again if the result is weak. Lesson 05 says that the agent "owns its reasoning process." The agent decides the next step from the quality of what it found.

### The four steps of the loop

Lesson 05 gives the loop in four steps:

1. **Initial call.** The model gets the goal of the user.
2. **Tool invocation.** The model selects a retrieval tool to get more context.
3. **Assessment and refinement.** The model decides if the information is sufficient. If not, it changes the query, uses a different tool, or changes its method.
4. **Repeat until satisfied.** The loop continues until the model has sufficient evidence.

Step 3 is the **check**. Step 4 needs a **stop condition**. Lesson 10 lists "continuous loops" as a common problem, and it recommends "clear termination terms and conditions." A loop with no maximum number of rounds can run for a long time and cost much money.

### The agent fixes failures

Lesson 05 gives three methods for failures:

- **Iterate and re-query.** Write a new query or search a different source.
- **Use diagnostic tools.** Check the retrieved data, and log each step.
- **Fall back on human oversight.** After repeated failures, tell the user and ask a person for help.

### Agentic RAG has limits

Lesson 05 says that agentic RAG is not general intelligence. The agent can use only the tools and data that developers give it. It must obey the guardrails of the business.

## RAG Lab activity: be the checker

In this activity, you do the work of the checker step by hand.

1. Open [RAG Lab](https://wrisvold.github.io/rag-lab/).
2. On Station 0, click **Load the sample document**.
3. Click **Chunk this document**. Keep the default dials: `CHUNK_SIZE` 400, `CHUNK_OVERLAP` 50, `TOP_K` 3.
4. Click **Embed these chunks**. Keep the **Glass Box** mode.
5. Click **Retrieve passages**. The question "How many days of PTO do new employees get?" is already there. Click **Retrieve**.
6. Read the three passages. Decide if they answer the question. This decision is the check.
7. Find the word that the lab strikes through in the question. The handbook does not use that word.
8. Write a new question that uses the words of the handbook. For example, use "vacation days" in place of "PTO."
9. Click **Retrieve** again. Find the passage for Section 3.1 Vacation in the results.
10. Click **Assemble the prompt**. Then click **Copy run summary**. Paste the summary into your assignment.
11. Optional: on Station 2, select **Black Box** mode. Retrieve the first question again. Compare the results.

In steps 6 to 9, you did the maker-checker loop. You checked the result, found the cause of the failure, wrote a new query, and retrieved again. An agent does these steps with no person.

## Agent mode activity: the loop with no person

In the RAG Lab activity, you were the checker. In this activity, an agent does the same loop. It needs no key.

1. Open [Agent mode](https://wrisvold.github.io/rag-lab/agent.html).
2. Click **Exercise 1. The loop that does not stop**. Do the steps in the exercise panel.
3. Click **Exercise 2. The PTO question**. Do the steps in the exercise panel.
4. In Exercise 2, click **Copy run summary** after the run with the synonym. Paste the summary into your assignment.
5. Compare the run of Exercise 2 with your work in the RAG Lab activity. For each part of a round, find the step that you did by hand.

In Exercise 1, the agent has no stop condition. It stops only at the hard limit of 12 rounds. In Exercise 2, the check of each round decides if the loop continues.

## Discussion 3

In the RAG Lab activity, Black Box mode finds the vacation passage for the word "PTO." Glass Box mode does not. If a better embedding model fixes the problem, does Fall Line still need an agentic loop? Give one case in which the loop still adds value.

## Assignment 3. The Retrieval Loop

**Purpose:** Design the loop that the Fall Line agent uses to answer handbook questions.

**Steps:**

1. Do the RAG Lab activity. Paste your two run summaries: the first question and your new question.
2. Do Exercises 1 and 2 in Agent mode. Paste the run summary of Exercise 2, after you add the synonym. In 100 to 150 words, compare the agent's loop with your work by hand. Tell which stop condition stopped each run of Exercise 1.
3. Write the check step. Give two or three tests that tell if the retrieved passages are sufficient. Each test must be specific. For example: "At least one passage has a section number."
4. Write the action for each failure. What does the agent do if a test fails?
5. Write the stop condition. Give the maximum number of rounds and the reason for that number.
6. Write what the agent tells the user when it stops with no good answer. Write the exact words.
7. Draw the loop as a flowchart. Use boxes for steps and diamonds for decisions.
8. At the end, write your statement about the AI tools that you used.

**Submit:** A document of 600 to 950 words with the three run summaries and the flowchart, as a PDF or Word file.

**Rubric (100 points):**

| Criterion | Full credit | Partial credit | Points |
|---|---|---|---|
| RAG Lab run summaries | Two run summaries. The second summary shows the vacation passage in the results. | Only one summary, or the second does not show an improvement. | 10 |
| Agent mode run and comparison | The Exercise 2 summary stops with ANSWER_ACCEPTED. The comparison matches each part of a round to a step by hand. It names the stop conditions of Exercise 1. | The summary is missing, or the comparison is general. | 15 |
| Check step | The tests are specific, and code or a model can apply them. | The tests are vague, for example "the passages are good." | 20 |
| Failure actions | Each failed test has an action. The actions use the methods of Lesson 05. | Some failures have no action. | 20 |
| Stop condition and message | A maximum number of rounds, with a reason. The message to the user is honest and tells the user what to do next. | No maximum, or the message hides the failure. | 20 |
| Flowchart | The flowchart agrees with the text and has no path that loops forever. | The flowchart is not complete or has a path with no end. | 15 |

## Optional code path

1. Open `05-agentic-rag/code_samples/05-python-agent-framework.ipynb`.
2. Find the tool `search_travel_knowledge`. Compare it with the tool `search_handbook` in the Fall Line case.
3. Find the section "Iterative Retrieval — The Maker-Checker Pattern."
4. Read the instructions of the agent `TravelRAGCheckerAgent`. Compare its check with the check step that you wrote.
