# Week 6. Context Engineering and Memory

**Microsoft lessons:** [12 Context Engineering](https://github.com/microsoft/ai-agents-for-beginners/tree/main/12-context-engineering), [13 Agent Memory](https://github.com/microsoft/ai-agents-for-beginners/tree/main/13-agent-memory)

## Objectives

After this week, you can:

1. Define context engineering and compare it with prompt engineering.
2. Name the five types of context in Lesson 12.
3. Name the four context failures, and give a control for each failure.
4. Name the types of memory in Lesson 13, and give an example of each type.
5. Write a memory policy that tells what an agent keeps, for how long, and who can delete it.

## Read and watch

1. Read Lesson 12 and watch its video.
2. Read Lesson 13 and watch its video. You can skip the sections about Mem0 and Cognee.
3. Optional: read the [LangGraph memory page](https://docs.langchain.com/oss/python/langgraph/memory). Compare its short-term and long-term memory with the types in Lesson 13.

## Key ideas

### Context is everything the model sees

Lesson 12 says that context engineering makes sure that the agent "has the right information to complete the next step of the task." The context window has a limit. The agent builder must add, remove, and compress information in it.

Prompt engineering writes one set of fixed instructions. Context engineering manages information that changes at each step.

### Five types of context

Lesson 12 gives five types:

1. **Instructions.** The system message, examples, and tool descriptions.
2. **Knowledge.** Facts from documents, databases, and RAG.
3. **Tools.** Tool definitions and the results of tool calls.
4. **Conversation history.** The dialogue with the user.
5. **User preferences.** Likes and dislikes that the agent learned.

### Plan the context

Lesson 12 gives three planning steps:

1. **Define clear results.** What is different when the agent completes the task?
2. **Map the context.** What information does the agent need, and where is it?
3. **Create context pipelines.** How does the agent get the information? For example, use RAG, MCP servers, or other tools.

### Four context failures

| Failure | What it is | Control from Lesson 12 |
|---|---|---|
| Context poisoning | A hallucination or an error goes into the context, and the agent uses it again and again. | Validate information before you store it. Quarantine bad information. |
| Context distraction | The context is so large that the model focuses on old history. | Summarize the context at intervals. |
| Context confusion | Too many tools or too much information causes wrong tool calls. | Give the model only the tools for the current task. |
| Context clash | The context has conflicting information. | Remove old information when new information replaces it. Use a scratchpad. |

### Types of memory

Lesson 13 gives these types:

- **Working memory.** The facts for the current step, like a sheet of scratch paper.
- **Short-term memory.** The facts for one conversation.
- **Long-term memory.** Facts that stay across conversations, for example user preferences.
- **Persona memory.** The role and the style of the agent.
- **Episodic memory.** The steps of past tasks, with successes and failures.
- **Entity memory.** People, places, and things from conversations.
- **Structured RAG.** Facts in fields, which allow exact queries.

### Memory is a governance decision

Each item that an agent keeps is data about a person. The agent must obey the rules for that data. Recall the control guideline of Lesson 03: users can see and delete their data. A memory policy tells what the agent keeps, for how long, and who can see it.

## Agent mode activity: measure the context

Do this activity before Assignment 6. It needs no key.

1. Open [Agent mode](https://wrisvold.github.io/rag-lab/agent.html).
2. Click **Exercise 2. The PTO question**.
3. Scroll the set-up column to **Synonym table (rule F1)**. Add the pair PTO → vacation. Then click **Run to end**.
4. For each round, click **Show context**. In the inspector, record the tokens of each of the five types of context.
5. Find the types of context that increase in each round. Tell why they increase.
6. Click **Exercise 1. The loop that does not stop**. Click **Run to end**, and record the tokens of round 12 and of the run.
7. Select the box **Keep only the last two rounds in the context**. Click **Run to end** again, and record the same two numbers.

Each round sends the full context again. The instructions are the same in each round, but the knowledge and the tool results increase. When the agent keeps only the last rounds, the context stops its increase. The context map of Assignment 6 must control this increase.

## Discussion 6

Should the Fall Line agent keep an employee's vacation balance in long-term memory, or get it from the HR system each time? Think about context poisoning and Section 5.2 of the handbook. Give your decision and your reasons.

## Assignment 6. The Context and Memory Policy

**Purpose:** Specify what the Fall Line agent sees at each step and what it keeps.

**Steps:**

1. Define the result of the Fall Line agent in one or two sentences. Use the first planning step of Lesson 12.
2. Make a context map. For each of the five types of context, give:
   - The Fall Line information of that type
   - The source system
   - How the agent gets it: in the system message, by RAG, or by a tool
3. For each of the four context failures, give one realistic Fall Line example and one control.
4. Write a memory policy as a table. For each item that the agent keeps, give:
   - The memory type from Lesson 13
   - The reason to keep it
   - How long the agent keeps it
   - Who can see it and who can delete it
5. List the items that the agent must never keep. Give the reason for each item.
6. At the end, write your statement about the AI tools that you used.

**Submit:** A context map, a memory policy, and 300 to 600 words of text, as a PDF or Word file.

**Rubric (100 points):**

| Criterion | Full credit | Partial credit | Points |
|---|---|---|---|
| Result | The result is specific and testable. | The result is vague. | 10 |
| Context map | All five types, each with a source and a method. | One or two types are missing or have no source. | 25 |
| Context failures | Four realistic examples, each with a correct control. | Some examples are not realistic, or a control does not agree with the failure. | 25 |
| Memory policy | Each item has a type, a reason, a time limit, and access rules. | Some fields are missing. | 25 |
| Items never kept | The list includes confidential data and gives reasons from the handbook. | The list is short or has no reasons. | 15 |

## Optional code path

1. Open `12-context-engineering/code_samples/12-chat_summarization.ipynb`.
2. Find the tool `summarize_preferences`. Write down what it keeps and what it removes.
3. Open `13-agent-memory/13-agent-memory.ipynb`.
4. Find the tools `save_preference` and `get_preferences`. These tools give the agent long-term memory.
5. Read the two scenarios at the end of the notebook. Write down what the agent remembers in the second scenario.
