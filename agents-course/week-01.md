# Week 1. What an Agent Is, and When Not to Use One

**Microsoft lessons:** [01 Intro to AI Agents](https://github.com/microsoft/ai-agents-for-beginners/tree/main/01-intro-to-ai-agents), [02 Agentic Frameworks](https://github.com/microsoft/ai-agents-for-beginners/tree/main/02-explore-agentic-frameworks), [03 Agentic Design Principles](https://github.com/microsoft/ai-agents-for-beginners/tree/main/03-agentic-design-patterns)

## Objectives

After this week, you can:

1. Define an agent and name its parts.
2. Name the seven types of agent in Lesson 01, and give a business example of each type.
3. Tell when an agent is the correct solution and when a simpler solution is better.
4. Explain the difference between an agent framework and an agent platform.
5. Use the three design guidelines of Lesson 03: transparency, control, and consistency.

## Read and watch

1. Read the [Fall Line case](case-fall-line.md).
2. Read Lesson 01 and watch its video. The video link is at the top of the lesson.
3. Read Lesson 02. Read the text and skip the code blocks. Pay attention to the comparison of Microsoft Agent Framework and Microsoft Foundry Agent Service.
4. Read Lesson 03 and watch its video.
5. Optional: read the section "Why use LangGraph?" in the [LangGraph README](https://github.com/langchain-ai/langgraph). Compare LangGraph with Microsoft Agent Framework.

## Key ideas

### An agent acts

Lesson 01 defines agents as systems that let a model "do things." The model gets tools and knowledge, and it can act on the world. A chatbot only writes text. An agent can search a database, call an API, or send a message.

Lesson 01 gives three parts of an agent system:

- The **environment** is the space where the agent works. For the Fall Line agent, it is the company systems.
- The **sensors** read the state of the environment. For example, the agent reads a vacation balance.
- The **actuators** do actions in the environment. For example, the agent sends a vacation request.

An agent also has a model, tools, and memory.

### Seven types of agent

Lesson 01 gives seven types. They go from simple to complex:

1. Simple reflex agent
2. Model-based reflex agent
3. Goal-based agent
4. Utility-based agent
5. Learning agent
6. Hierarchical agent
7. Multi-agent system

Learn the difference between each type and the type before it.

### When to use an agent

Lesson 01 says that agents are useful in three conditions:

- **Open-ended problems.** You cannot write the steps in advance. The model must find the path.
- **Multi-step processes.** The task needs tools across many turns.
- **Improvement over time.** The system must get better from feedback.

This course adds a fourth test. If you can write all the steps in advance, a fixed workflow is usually better. A fixed workflow costs less, runs faster, and is easier to test. An agent adds cost and risk, so it must also add value.

### Frameworks and platforms

A **framework** is a software library for building agents. Microsoft Agent Framework and LangGraph are frameworks. A **platform** is a service that hosts and operates agents for you. Microsoft Foundry Agent Service is a platform. Lesson 02 suggests this sequence: build with the framework, then deploy on the platform.

### Three design guidelines

Lesson 03 gives three guidelines for the design of an agent:

- **Transparency.** Tell the user that the agent uses AI, how it works, and how to give feedback.
- **Control.** Let the user change preferences and delete their data.
- **Consistency.** Use familiar icons and words, and keep answers short.

## Discussion 1

Name one task at your workplace that an agent can do well. Then name one task that people want to give to an agent, but that a fixed workflow does better. For each task, give reasons from the three conditions in Lesson 01.

## Assignment 1. The Agent Decision Memo

**Purpose:** Decide where Fall Line needs an agent, and describe the agent at a high level.

**Steps:**

1. Read the four tasks in "What the Fall Line agent must do" in the [case](case-fall-line.md).
2. For each task, select one solution: an agent, a fixed workflow, or no automation.
3. For each task, give your reasons. Use the conditions from Lesson 01 and the fourth test of this course.
4. Select the agent type for the Fall Line agent from the Lesson 01 list. Give your reasons.
5. Make a table of the environment, the sensors, and the actuators of the Fall Line agent.
6. Write one design rule for each guideline in Lesson 03: transparency, control, and consistency.
7. At the end, write your statement about the AI tools that you used.

**Submit:** A memo of 600 to 900 words, as a PDF or Word file.

**Rubric (100 points):**

| Criterion | Full credit | Partial credit | Points |
|---|---|---|---|
| Decisions for the four tasks | Each task has a solution and reasons from Lesson 01. The reasons agree with the case facts. | Some reasons are missing or do not use Lesson 01. | 30 |
| Agent type | The type agrees with the scope. The memo tells why the next simpler type is not sufficient. | The type is given, but the reasons are weak. | 15 |
| Environment, sensors, and actuators | The table names the systems, the data that the agent reads, and the actions that it does. | The table is not complete or mixes sensors and actuators. | 20 |
| Design rules | Each rule is specific to Fall Line and a developer can test it. | The rules are general, for example "be transparent." | 20 |
| Writing | The memo is clear and short. It uses the terms in the [glossary](glossary.md). | The memo is long, or it uses terms with no clear meaning. | 15 |

## Optional code path

You do not need an Azure account for these steps. You only read the notebook.

1. Open the Lesson 01 notebook: `01-intro-to-ai-agents/code_samples/01-python-agent-framework.ipynb`.
2. Find the cell that creates the agent with `as_agent(`.
3. Write down the name of the agent, its instructions, and its tools.
4. Find the function `get_destinations`. Read the line `@tool(approval_mode="never_require")` above it. Write one sentence about what you think it means. You learn the answer in Week 2.
